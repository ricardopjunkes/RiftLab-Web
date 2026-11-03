import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import pg from 'pg';

const { Pool } = pg;
const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
const LANES = ['Topo', 'Selva', 'Meio', 'Atirador', 'Suporte'];
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:8000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!DATABASE_URL)
  throw new Error('Configure DATABASE_URL com a conexão PostgreSQL do Neon.');

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
});
pool.on('error', (error) =>
  console.error('Erro inesperado no pool PostgreSQL:', error.message),
);

const app = express();
app.disable('x-powered-by');
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(
        new Error('Origem não autorizada pela configuração FRONTEND_ORIGIN.'),
      );
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  }),
);
app.use(express.json({ limit: '16kb' }));
const createLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
});

function normalizeTeam(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  for (const lane of LANES) {
    const championId = value[lane] ?? null;
    if (
      championId !== null &&
      (typeof championId !== 'string' || !/^[A-Za-z0-9]{1,40}$/.test(championId))
    )
      return null;
    result[lane] = championId;
  }
  return result;
}

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ ok: true, database: 'connected' });
  } catch {
    response.status(503).json({ ok: false, error: 'Banco de dados indisponível.' });
  }
});

app.post('/api/compositions', createLimiter, async (request, response) => {
  const ally = normalizeTeam(request.body?.ally);
  const enemy = normalizeTeam(request.body?.enemy);
  if (!ally || !enemy)
    return response
      .status(400)
      .json({ error: 'Composição inválida. Confira as rotas e campeões.' });
  if (![...Object.values(ally), ...Object.values(enemy)].some(Boolean))
    return response.status(400).json({ error: 'Adicione pelo menos um campeão.' });
  const title =
    typeof request.body?.title === 'string'
      ? request.body.title.trim().slice(0, 60)
      : 'Composição do RiftLab';
  const code = randomBytes(6).toString('hex');
  try {
    await pool.query(
      'INSERT INTO compositions (code, title, ally, enemy) VALUES ($1, $2, $3::jsonb, $4::jsonb)',
      [
        code,
        title || 'Composição do RiftLab',
        JSON.stringify(ally),
        JSON.stringify(enemy),
      ],
    );
    return response
      .status(201)
      .json({ code, title: title || 'Composição do RiftLab', ally, enemy });
  } catch (error) {
    console.error('Falha ao salvar composição:', error.message);
    return response
      .status(500)
      .json({ error: 'Não foi possível salvar agora. Tente novamente.' });
  }
});

app.get('/api/compositions/:code', async (request, response) => {
  const code = String(request.params.code || '').toLowerCase();
  if (!/^[a-f0-9]{12}$/.test(code))
    return response.status(400).json({ error: 'Código de composição inválido.' });
  try {
    const { rows } = await pool.query(
      'SELECT code, title, ally, enemy, created_at FROM compositions WHERE code = $1 LIMIT 1',
      [code],
    );
    if (!rows[0])
      return response.status(404).json({ error: 'Composição não encontrada.' });
    const row = rows[0];
    return response.json({
      code: row.code,
      title: row.title,
      ally: row.ally,
      enemy: row.enemy,
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error('Falha ao carregar composição:', error.message);
    return response
      .status(500)
      .json({ error: 'Não foi possível carregar agora. Tente novamente.' });
  }
});

app.use((_request, response) =>
  response.status(404).json({ error: 'Rota da API não encontrada.' }),
);
app.use((error, _request, response, _next) => {
  if (error.message?.startsWith('Origem não autorizada'))
    return response.status(403).json({ error: error.message });
  console.error('Erro da API:', error.message);
  return response.status(500).json({ error: 'Erro interno da API.' });
});

const currentFile = fileURLToPath(import.meta.url);
const schemaPath = path.join(path.dirname(currentFile), 'schema.sql');
const schema = await readFile(schemaPath, 'utf8');
await pool.query(schema);
app.listen(PORT, '0.0.0.0', () =>
  console.log(`RiftLab API escutando na porta ${PORT}.`),
);
