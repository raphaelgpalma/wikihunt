import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'wikihunt-dev-secret-change-me';

export function signAdminToken(admin) {
  return jwt.sign({ id: admin.id, username: admin.username }, SECRET, { expiresIn: '12h' });
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    req.admin = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }
}
