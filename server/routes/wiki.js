import { Router } from 'express';
import { fetchArticle, searchTitles, SUPPORTED_LANGS, DEFAULT_LANG } from '../wiki.js';

const router = Router();

router.get('/page', async (req, res) => {
  const title = String(req.query.title || '').trim();
  const lang = SUPPORTED_LANGS.includes(req.query.lang) ? req.query.lang : DEFAULT_LANG;
  if (!title) return res.status(400).json({ error: 'Título obrigatório.' });
  try {
    const article = await fetchArticle(title, lang);
    res.json(article);
  } catch (err) {
    res.status(502).json({ error: err.message || 'Erro ao buscar artigo.' });
  }
});

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  try {
    const results = await searchTitles(q);
    res.json({ results });
  } catch (err) {
    res.status(502).json({ error: 'Erro ao buscar na Wikipedia.' });
  }
});

export default router;
