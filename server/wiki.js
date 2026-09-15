import * as cheerio from 'cheerio';

// The language admin-curated word pairs are authored and resolved against.
// Rooms in a different language look up an equivalent article via
// getLangLink() instead of re-authoring pairs per language.
export const DEFAULT_LANG = process.env.WIKI_LANG || 'pt';
export const SUPPORTED_LANGS = ['pt', 'en'];

const apiUrl = (lang) => `https://${lang}.wikipedia.org/w/api.php`;

const BLOCKED_NAMESPACES = [
  'file', 'ficheiro', 'imagem', 'category', 'categoria', 'special', 'especial',
  'help', 'ajuda', 'portal', 'talk', 'discussão', 'discussao', 'wikipedia', 'wikipédia',
  'template', 'predefinição', 'predefinicao', 'module', 'módulo', 'modulo', 'draft', 'rascunho',
  'mediawiki', 'user', 'usuário', 'usuario', 'utilizador', 'book', 'livro', 'timedtext',
];

function isBlockedTitle(title) {
  const colonIndex = title.indexOf(':');
  if (colonIndex === -1) return false;
  const prefix = title.slice(0, colonIndex).trim().toLowerCase();
  return BLOCKED_NAMESPACES.includes(prefix);
}

function fixProtocolRelative(html) {
  return html
    .replace(/src="\/\//g, 'src="https://')
    .replace(/srcset="([^"]*)"/g, (m, val) => `srcset="${val.replace(/(^|,\s*)\/\//g, '$1https://')}"`);
}

function sanitizeArticleHtml(rawHtml) {
  const $ = cheerio.load(rawHtml, null, false);

  $('.mw-editsection, .noprint, sup.reference, .mw-empty-elt, .navbox, .vertical-navbox, .ambox').remove();

  $('a').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    let title = null;

    if (href.startsWith('./')) {
      title = decodeURIComponent(href.slice(2).split('#')[0]).replace(/_/g, ' ');
    } else if (href.startsWith('/wiki/')) {
      title = decodeURIComponent(href.slice(6).split('#')[0]).replace(/_/g, ' ');
    }

    if (title && !isBlockedTitle(title) && title.length > 0) {
      $el.attr('data-wiki-title', title);
      $el.attr('href', '#');
      $el.addClass('wiki-link');
    } else {
      $el.removeAttr('href');
      $el.addClass('wiki-link-disabled');
    }
  });

  return fixProtocolRelative($.html());
}

const API_TIMEOUT_MS = 10000;

async function apiGet(lang, params) {
  const url = new URL(apiUrl(lang));
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('origin', '*');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'WikiHunt/1.0' }, signal: controller.signal });
    if (!res.ok) throw new Error(`Wikipedia API error: ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchArticle(title, lang = DEFAULT_LANG) {
  const data = await apiGet(lang, { action: 'parse', page: title, prop: 'text|displaytitle', redirects: 1 });
  if (data.error) throw new Error(data.error.info || 'Artigo não encontrado');
  return {
    title: data.parse.title,
    displayTitle: data.parse.displaytitle.replace(/<[^>]+>/g, ''),
    html: sanitizeArticleHtml(data.parse.text),
  };
}

export async function resolveTitle(title, lang = DEFAULT_LANG) {
  const data = await apiGet(lang, { action: 'query', titles: title, redirects: 1 });
  const pages = Object.values(data.query.pages);
  if (!pages.length || pages[0].missing) return null;
  return pages[0].title;
}

// A wiki-link on the page before the target often points at a redirect/alias
// title rather than the target's canonical title (e.g. a link to "EUA" that
// redirects to "Estados Unidos"). Resolving those aliases up front lets the
// client recognize "one click from the target" and "arrived at the target"
// correctly even when the clicked title isn't the canonical one.
export async function getRedirectAliases(title, lang = DEFAULT_LANG) {
  const data = await apiGet(lang, { action: 'query', titles: title, prop: 'redirects', rdlimit: 'max' });
  const pages = Object.values(data.query.pages);
  if (!pages.length) return [];
  return (pages[0].redirects || []).map((r) => r.title);
}

// Word pairs are curated once, in DEFAULT_LANG. A room running in a different
// language needs the equivalent article via Wikipedia's own interlanguage
// links rather than asking the admin to re-author every pair per language.
// Returns null when no equivalent article exists in toLang.
export async function getLangLink(title, fromLang, toLang) {
  if (fromLang === toLang) return title;
  const data = await apiGet(fromLang, {
    action: 'query', titles: title, prop: 'langlinks', lllang: toLang, redirects: 1,
  });
  const pages = Object.values(data.query.pages);
  if (!pages.length || pages[0].missing) return null;
  const link = (pages[0].langlinks || [])[0];
  return link ? link.title : null;
}

// Chaos mode: a live-drawn pair instead of an admin-curated one.
export async function getRandomArticle(lang = DEFAULT_LANG) {
  const data = await apiGet(lang, { action: 'query', list: 'random', rnnamespace: 0, rnlimit: 1 });
  const page = (data.query?.random || [])[0];
  if (!page) throw new Error('Nenhum artigo aleatório retornado pela Wikipedia.');
  return page.title;
}

// Runs async `fn` over `items` with at most `limit` in flight at once —
// enough to speed up the shortest-path backlink walk without hammering the
// API hard enough to trip its rate limiter.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Shown on the round-result screen after a race: the actual shortest click
// path between the two articles, found with a bounded bidirectional search
// over Wikipedia's own link graph (no third-party index — MediaWiki has no
// endpoint for this, so it's a real live graph search, not a lookup).
//
// Bidirectional: expand outbound links from the start and inbound links
// (backlinks) toward the target at the same time, meeting in the middle.
// This is the same technique tools like "Six Degrees of Wikipedia" use,
// just computed on demand instead of against a precomputed index — so it's
// deliberately bounded (depth, total pages, wall-clock) and returns null
// rather than hanging when a pair is too far apart to resolve in time.
const SHORTEST_PATH_MAX_DEPTH = 5;
const SHORTEST_PATH_MAX_PAGES = 1500;
const SHORTEST_PATH_TIMEOUT_MS = 12000;
const SHORTEST_PATH_BATCH = 50;
const BACKLINK_CONCURRENCY = 5;

export async function findShortestPath(startTitle, targetTitle, lang = DEFAULT_LANG) {
  if (startTitle.trim().toLowerCase() === targetTitle.trim().toLowerCase()) return [startTitle];

  const deadline = Date.now() + SHORTEST_PATH_TIMEOUT_MS;
  const forwardParent = new Map([[startTitle, null]]);
  const backwardParent = new Map([[targetTitle, null]]);
  let forwardFrontier = [startTitle];
  let backwardFrontier = [targetTitle];
  let pagesExplored = 2;

  const budgetLeft = () => Date.now() < deadline && pagesExplored < SHORTEST_PATH_MAX_PAGES;

  function meetingPoint() {
    for (const t of forwardFrontier) if (backwardParent.has(t)) return t;
    for (const t of backwardFrontier) if (forwardParent.has(t)) return t;
    return null;
  }

  // A requested title (e.g. "Cachorro") can resolve to a different
  // canonical page ("Cão") via redirect or MediaWiki's own normalization.
  // The parent chain is only walkable if that canonical title is ALSO a
  // valid key pointing at the same parent as the title that was requested —
  // otherwise reconstruct() below chains through a title that was never
  // registered and never reaches its `null` root.
  function reconcileRedirects(data, parentMap) {
    const toFrom = [...(data.query?.redirects || []), ...(data.query?.normalized || [])];
    for (const { from, to } of toFrom) {
      if (parentMap.has(from) && !parentMap.has(to)) parentMap.set(to, parentMap.get(from));
      else if (parentMap.has(to) && !parentMap.has(from)) parentMap.set(from, parentMap.get(to));
    }
  }

  // A hard cap on chain-walking, independent of every other bound above: no
  // plausible real path is anywhere near this long, so hitting it means a
  // cycle slipped through and this stops it from freezing the whole process
  // instead of just failing this one lookup.
  const MAX_CHAIN_STEPS = 200;
  function reconstruct(meet) {
    const forwardPath = [];
    let steps = 0;
    for (let cur = meet; cur !== null; cur = forwardParent.get(cur)) {
      if (cur === undefined || steps++ > MAX_CHAIN_STEPS) return null;
      forwardPath.unshift(cur);
    }
    const backwardPath = [];
    steps = 0;
    for (let cur = backwardParent.get(meet); cur !== null && cur !== undefined; cur = backwardParent.get(cur)) {
      if (steps++ > MAX_CHAIN_STEPS) return null;
      backwardPath.push(cur);
    }
    return [...forwardPath, ...backwardPath];
  }

  async function expandForward(frontier) {
    const next = [];
    for (let i = 0; i < frontier.length && budgetLeft(); i += SHORTEST_PATH_BATCH) {
      const batch = frontier.slice(i, i + SHORTEST_PATH_BATCH);
      let data;
      try {
        data = await apiGet(lang, {
          action: 'query', titles: batch.join('|'), prop: 'links', plnamespace: 0, pllimit: 'max', redirects: 1,
        });
      } catch { continue; }
      reconcileRedirects(data, forwardParent);
      for (const page of Object.values(data.query?.pages || {})) {
        if (!forwardParent.has(page.title)) continue; // orphaned by a redirect chain reconcile couldn't bridge
        for (const link of page.links || []) {
          if (!forwardParent.has(link.title)) {
            forwardParent.set(link.title, page.title);
            next.push(link.title);
            pagesExplored += 1;
          }
        }
      }
    }
    return next;
  }

  async function expandBackward(frontier) {
    const next = [];
    const toWalk = frontier.slice(0, Math.max(SHORTEST_PATH_MAX_PAGES - pagesExplored, 0));
    const results = await mapWithConcurrency(toWalk, BACKLINK_CONCURRENCY, async (title) => {
      if (!budgetLeft()) return { title, backlinks: [] };
      try {
        const data = await apiGet(lang, { action: 'query', list: 'backlinks', bltitle: title, blnamespace: 0, bllimit: 'max' });
        return { title, backlinks: data.query?.backlinks || [] };
      } catch {
        return { title, backlinks: [] };
      }
    });
    for (const { title, backlinks } of results) {
      for (const bl of backlinks) {
        if (!backwardParent.has(bl.title)) {
          backwardParent.set(bl.title, title);
          next.push(bl.title);
          pagesExplored += 1;
        }
      }
    }
    return next;
  }

  for (let depth = 0; depth < SHORTEST_PATH_MAX_DEPTH && budgetLeft(); depth += 1) {
    if (forwardFrontier.length <= backwardFrontier.length) {
      forwardFrontier = await expandForward(forwardFrontier);
    } else {
      backwardFrontier = await expandBackward(backwardFrontier);
    }
    const meet = meetingPoint();
    if (meet) {
      const path = reconstruct(meet);
      if (path) return path;
      // A chain the redirect reconciliation couldn't fully bridge; treat as
      // not-found rather than retrying into the same corrupted state.
      return null;
    }
  }
  return null;
}

export async function searchTitles(query, limit = 8) {
  if (!query || query.trim().length < 2) return [];
  const data = await apiGet(DEFAULT_LANG, { action: 'opensearch', search: query, limit, namespace: 0 });
  return data[1] || [];
}
