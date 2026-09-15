import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

import './db.js';
import adminRoutes from './routes/admin.js';
import wikiRoutes from './routes/wiki.js';
import { registerGameHandlers } from './game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/admin', adminRoutes);
app.use('/api/wiki', wikiRoutes);

process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

const server = http.createServer(app);
const io = new Server(server);
registerGameHandlers(io);

server.listen(PORT, () => {
  console.log(`WikiHunt rodando em http://localhost:${PORT}`);
});
