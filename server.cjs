const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dns = require('dns');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Database ──
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const db = new Database(path.join(dbDir, 'quizzes.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );
  CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id TEXT NOT NULL,
    event TEXT NOT NULL,
    data TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );
  CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending',
    verified_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );
  CREATE TABLE IF NOT EXISTS shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id TEXT NOT NULL,
    shared_with TEXT NOT NULL,
    role TEXT DEFAULT 'editor',
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    UNIQUE(quiz_id, shared_with)
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    last_login INTEGER
  );
  CREATE TABLE IF NOT EXISTS ai_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    detail TEXT,
    tokens_used INTEGER DEFAULT 0,
    cost_estimate REAL DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );
`);

// Add user_id column to quizzes if not present
try {
    db.exec(`ALTER TABLE quizzes ADD COLUMN user_id INTEGER`);
} catch (e) { /* column already exists */ }


// ── Server hostname (for CNAME instructions) ──
const SERVER_HOSTNAME = process.env.SERVER_HOSTNAME || 'localhost:3001';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@test.com').toLowerCase().trim();

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Simple token helpers ──
function makeToken(userId) {
    return Buffer.from(JSON.stringify({ id: userId, ts: Date.now() })).toString('base64');
}
function parseToken(token) {
    try { return JSON.parse(Buffer.from(token, 'base64').toString()); } catch { return null; }
}

// ── Auth middleware ──
function requireAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Token necessário' });
    const payload = parseToken(auth.slice(7));
    if (!payload || !payload.id) return res.status(401).json({ error: 'Token inválido' });
    const user = db.prepare('SELECT id, name, email, role, created_at, last_login FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
    req.user = user;
    next();
}
function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
        next();
    });
}

// ── Auth endpoints ──
app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nome, email e senha obrigatórios' });
    if (password.length < 4) return res.status(400).json({ error: 'Senha deve ter pelo menos 4 caracteres' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) return res.status(409).json({ error: 'Email já cadastrado' });

    const hash = bcrypt.hashSync(password, 10);
    // Admin if email matches ADMIN_EMAIL or first user
    const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const role = (email.toLowerCase().trim() === ADMIN_EMAIL || userCount === 0) ? 'admin' : 'user';

    const result = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name.trim(), email.toLowerCase().trim(), hash, role);
    const token = makeToken(result.lastInsertRowid);
    res.json({ token, user: { id: result.lastInsertRowid, name: name.trim(), email: email.toLowerCase().trim(), role } });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Credenciais inválidas' });

    db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(Date.now(), user.id);
    const token = makeToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json(req.user);
});

// ── Admin endpoints ──
app.get('/api/admin/stats', requireAdmin, (req, res) => {
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const totalQuizzes = db.prepare('SELECT COUNT(*) as c FROM quizzes').get().c;
    const totalLeads = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
    const totalDomains = db.prepare('SELECT COUNT(*) as c FROM domains').get().c;
    const totalShares = db.prepare('SELECT COUNT(*) as c FROM shares').get().c;
    const aiUsage = db.prepare('SELECT COUNT(*) as count, SUM(tokens_used) as tokens, SUM(cost_estimate) as cost FROM ai_usage').get();
    const recentUsers = db.prepare('SELECT id, name, email, role, created_at, last_login FROM users ORDER BY created_at DESC LIMIT 5').all();
    res.json({ totalUsers, totalQuizzes, totalLeads, totalDomains, totalShares, aiUsage: { count: aiUsage.count || 0, tokens: aiUsage.tokens || 0, cost: aiUsage.cost || 0 }, recentUsers });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
    const users = db.prepare('SELECT id, name, email, role, created_at, last_login FROM users ORDER BY created_at DESC').all();
    res.json(users);
});

app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
    const { role, name } = req.body;
    if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.params.id);
    res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'Não pode deletar a si mesmo' });
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

app.get('/api/admin/ai-usage', requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT au.*, u.name as user_name, u.email as user_email FROM ai_usage au LEFT JOIN users u ON au.user_id = u.id ORDER BY au.created_at DESC LIMIT 100').all();
    res.json(rows);
});

// ── Custom Domain Resolution Middleware ──
// Checks if the incoming Host header matches a verified custom domain
app.use((req, res, next) => {
    // Skip API routes and uploads
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();

    const host = (req.headers.host || '').split(':')[0].toLowerCase();
    // Skip localhost and known app domains
    if (!host || host === 'localhost' || host === '127.0.0.1') return next();

    const domainRow = db.prepare('SELECT quiz_id, status FROM domains WHERE domain = ?').get(host);
    if (domainRow && domainRow.status === 'verified') {
        // Inject quizId so the SPA can load the right quiz
        req.customDomainQuizId = domainRow.quiz_id;
        // For SPA: serve index.html with quiz context
        if (!req.path.startsWith('/assets/') && !req.path.match(/\.[a-z]{2,4}$/i)) {
            // Rewrite to serve the player page
            req.url = `/q/${domainRow.quiz_id}${req.url === '/' ? '' : req.url}`;
        }
    }
    next();
});

// Serve uploaded images
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ── Image Upload ──
const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url, filename: req.file.filename });
});

// ── Quizzes CRUD ──

// GET all quizzes
app.get('/api/quizzes', requireAuth, (req, res) => {
    let rows;
    if (req.user.role === 'admin') {
        // Admin sees all quizzes
        rows = db.prepare('SELECT id, data, user_id, created_at, updated_at FROM quizzes ORDER BY updated_at DESC').all();
    } else {
        // Regular user sees only their own quizzes
        rows = db.prepare('SELECT id, data, user_id, created_at, updated_at FROM quizzes WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
    }
    const quizzes = rows.map(r => ({ ...JSON.parse(r.data), id: r.id }));
    res.json(quizzes);
});

// GET single quiz
app.get('/api/quizzes/:id', (req, res) => {
    const row = db.prepare('SELECT data FROM quizzes WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ ...JSON.parse(row.data), id: req.params.id });
});

// POST create/update quiz
app.post('/api/quizzes', requireAuth, (req, res) => {
    const quiz = req.body;
    const id = quiz.id || Math.random().toString(36).slice(2, 10);
    const now = Date.now();
    const data = JSON.stringify({ ...quiz, id, updatedAt: now });

    const existing = db.prepare('SELECT id, user_id FROM quizzes WHERE id = ?').get(id);
    if (existing) {
        // Only owner or admin can update
        if (existing.user_id && existing.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        db.prepare('UPDATE quizzes SET data = ?, updated_at = ? WHERE id = ?').run(data, now, id);
    } else {
        db.prepare('INSERT INTO quizzes (id, data, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?)').run(id, data, now, now, req.user.id);
    }
    res.json({ ...quiz, id, updatedAt: now });
});

// DELETE single quiz
app.delete('/api/quizzes/:id', requireAuth, (req, res) => {
    const quiz = db.prepare('SELECT user_id FROM quizzes WHERE id = ?').get(req.params.id);
    if (quiz && quiz.user_id && quiz.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    db.prepare('DELETE FROM quizzes WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

// DELETE all quizzes
app.delete('/api/quizzes', (req, res) => {
    db.prepare('DELETE FROM quizzes').run();
    db.prepare('DELETE FROM leads').run();
    db.prepare('DELETE FROM analytics').run();
    res.json({ ok: true });
});

// ── Custom Domains ──
app.get('/api/domains/:quizId', (req, res) => {
    const rows = db.prepare('SELECT id, quiz_id, domain, status, verified_at, created_at FROM domains WHERE quiz_id = ? ORDER BY created_at DESC').all(req.params.quizId);
    res.json(rows);
});

// All domains across all quizzes
app.get('/api/domains-all', (req, res) => {
    const rows = db.prepare(`
        SELECT d.id, d.quiz_id, d.domain, d.status, d.verified_at, d.created_at, q.data as quiz_data
        FROM domains d LEFT JOIN quizzes q ON d.quiz_id = q.id
        ORDER BY d.created_at DESC
    `).all();
    res.json(rows.map(r => {
        let quizName = 'Quiz removido';
        try { quizName = JSON.parse(r.quiz_data)?.name || 'Sem título'; } catch { }
        return { id: r.id, quiz_id: r.quiz_id, domain: r.domain, status: r.status, verified_at: r.verified_at, created_at: r.created_at, quizName };
    }));
});

app.post('/api/domains', (req, res) => {
    const { quizId, domain } = req.body;
    if (!quizId || !domain) return res.status(400).json({ error: 'quizId e domain são obrigatórios' });

    // Normalize domain
    const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
    if (!cleanDomain || cleanDomain.length < 3) return res.status(400).json({ error: 'Domínio inválido' });

    // Check if domain already exists
    const existing = db.prepare('SELECT id FROM domains WHERE domain = ?').get(cleanDomain);
    if (existing) return res.status(409).json({ error: 'Este domínio já está em uso' });

    // Check if quiz exists
    const quiz = db.prepare('SELECT id FROM quizzes WHERE id = ?').get(quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz não encontrado' });

    const result = db.prepare('INSERT INTO domains (quiz_id, domain) VALUES (?, ?)').run(quizId, cleanDomain);
    res.json({ id: result.lastInsertRowid, quiz_id: quizId, domain: cleanDomain, status: 'pending', serverHostname: SERVER_HOSTNAME });
});

app.delete('/api/domains/:id', (req, res) => {
    db.prepare('DELETE FROM domains WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

app.post('/api/domains/:id/verify', async (req, res) => {
    const row = db.prepare('SELECT * FROM domains WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Domínio não encontrado' });

    try {
        // Check CNAME records
        const records = await dns.promises.resolveCname(row.domain).catch(() => []);
        const serverHost = SERVER_HOSTNAME.split(':')[0].toLowerCase();
        const verified = records.some(r => r.toLowerCase().includes(serverHost));

        // Also check A/AAAA records as fallback (some DNS configs use A records)
        let aVerified = false;
        if (!verified) {
            try {
                const aRecords = await dns.promises.resolve4(row.domain).catch(() => []);
                // If domain resolves at all, consider it potentially valid
                aVerified = aRecords.length > 0;
            } catch (e) { /* ignore */ }
        }

        const isVerified = verified || aVerified;
        const status = isVerified ? 'verified' : 'error';
        const now = isVerified ? Date.now() : null;

        db.prepare('UPDATE domains SET status = ?, verified_at = ? WHERE id = ?').run(status, now, row.id);

        res.json({
            id: row.id,
            domain: row.domain,
            status,
            verified_at: now,
            cnameRecords: records,
            message: isVerified
                ? `✅ Domínio ${row.domain} verificado com sucesso!`
                : `❌ CNAME não encontrado. Crie um registro CNAME apontando ${row.domain} para ${SERVER_HOSTNAME}`,
        });
    } catch (err) {
        db.prepare('UPDATE domains SET status = ? WHERE id = ?').run('error', row.id);
        res.json({ id: row.id, domain: row.domain, status: 'error', message: `Erro ao verificar DNS: ${err.message}` });
    }
});

app.get('/api/server-info', (req, res) => {
    res.json({ hostname: SERVER_HOSTNAME });
});

// ── Leads ──
app.post('/api/leads', (req, res) => {
    const { quizId, ...leadData } = req.body;
    db.prepare('INSERT INTO leads (quiz_id, data) VALUES (?, ?)').run(quizId, JSON.stringify(leadData));
    res.json({ ok: true });
});

app.get('/api/leads/:quizId', (req, res) => {
    const rows = db.prepare('SELECT data, created_at FROM leads WHERE quiz_id = ? ORDER BY created_at DESC').all(req.params.quizId);
    res.json(rows.map(r => ({ ...JSON.parse(r.data), date: new Date(r.created_at).toISOString() })));
});

// ── Analytics ──
app.post('/api/analytics', (req, res) => {
    const { quizId, event, data } = req.body;
    db.prepare('INSERT INTO analytics (quiz_id, event, data) VALUES (?, ?, ?)').run(quizId, event, JSON.stringify(data || {}));
    res.json({ ok: true });
});

app.get('/api/analytics/:quizId', (req, res) => {
    const rows = db.prepare('SELECT event, data, created_at FROM analytics WHERE quiz_id = ? ORDER BY created_at DESC').all(req.params.quizId);
    const events = rows.map(r => ({ event: r.event, ...JSON.parse(r.data || '{}'), date: new Date(r.created_at).toISOString() }));

    const views = events.filter(e => e.event === 'view').length;
    const starts = events.filter(e => e.event === 'start').length;
    const completes = events.filter(e => e.event === 'complete').length;
    const answers = events.filter(e => e.event === 'answer');

    res.json({ views, starts, completes, conversionRate: starts ? Math.round(completes / starts * 100) : 0, events, answers });
});

// ── Shares / Collaboration ──
app.post('/api/shares', (req, res) => {
    const { quizId, sharedWith, role = 'editor' } = req.body;
    if (!quizId || !sharedWith) return res.status(400).json({ error: 'quizId e sharedWith obrigatórios' });
    try {
        db.prepare('INSERT OR REPLACE INTO shares (quiz_id, shared_with, role) VALUES (?, ?, ?)').run(quizId, sharedWith.toLowerCase(), role);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/shares/:quizId', (req, res) => {
    const rows = db.prepare('SELECT id, shared_with, role, created_at FROM shares WHERE quiz_id = ? ORDER BY created_at DESC').all(req.params.quizId);
    res.json(rows.map(r => ({ ...r, date: new Date(r.created_at).toISOString() })));
});

app.delete('/api/shares/:id', (req, res) => {
    db.prepare('DELETE FROM shares WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

app.get('/api/shared-quizzes/:email', (req, res) => {
    const shares = db.prepare('SELECT quiz_id, role FROM shares WHERE shared_with = ?').all(req.params.email.toLowerCase());
    const quizzes = shares.map(s => {
        const row = db.prepare('SELECT data FROM quizzes WHERE id = ?').get(s.quiz_id);
        if (!row) return null;
        const quiz = JSON.parse(row.data);
        return { ...quiz, _sharedRole: s.role };
    }).filter(Boolean);
    res.json(quizzes);
});

// ── AI Quiz Generation ──
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// Read API key from env vars (Railway) or .env file (local)
let OPENAI_KEY = process.env.VITE_OPENAI_API_KEY || '';
if (!OPENAI_KEY) {
    try {
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const match = envContent.match(/VITE_OPENAI_API_KEY=(.+)/);
            if (match) OPENAI_KEY = match[1].trim();
        }
    } catch (e) { console.warn('Could not read .env:', e.message); }
}

async function callOpenAI(prompt, { system = '', temperature = 0.7, maxTokens = 4000 } = {}) {
    if (!OPENAI_KEY) throw new Error('API key não configurada');
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature, max_tokens: maxTokens, response_format: { type: 'json_object' } }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `OpenAI error ${res.status}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    // Robust JSON extraction
    let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    // Try to find JSON object in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];
    try { return JSON.parse(cleaned); }
    catch (e) { console.error('[AI] Parse error:', cleaned.slice(0, 500)); throw new Error('AI retornou formato inválido'); }
}

// ── Clone from Screenshots (GPT-4o Vision) ──

app.post('/api/clone-screenshots', upload.array('screenshots', 30), async (req, res) => {
    if (!OPENAI_KEY) return res.status(400).json({ error: 'VITE_OPENAI_API_KEY não configurada no .env' });
    const files = req.files;
    if (!files || files.length === 0) return res.status(400).json({ error: 'Nenhuma imagem enviada' });

    console.log(`[CloneScreenshots] Processing ${files.length} screenshots...`);

    try {
        const pages = [];
        for (let i = 0; i < files.length; i++) {
            console.log(`[CloneScreenshots] Analyzing image ${i + 1}/${files.length}: ${files[i].originalname}`);

            const imageBuffer = fs.readFileSync(files[i].path);
            const base64 = imageBuffer.toString('base64');
            const mimeType = files[i].mimetype || 'image/png';

            const visionRes = await fetch(OPENAI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: `Você é um especialista em análise de quizzes/funnels de marketing. Analise o screenshot de uma etapa de quiz e extraia a estrutura em JSON.

Retorne SEMPRE um JSON com esta estrutura:
{
  "type": "choice" | "multi-select" | "statement" | "insight" | "lead" | "result" | "welcome",
  "text": "Texto principal da pergunta ou mensagem",
  "subtitle": "Subtítulo ou descrição adicional (se houver)",
  "options": [{"text": "Opção 1", "emoji": "🔥"}, {"text": "Opção 2", "emoji": ""}],
  "buttonText": "Texto do botão de ação (se houver, ex: Continuar, Próximo)",
  "hasImages": false,
  "pageDescription": "Breve descrição do que esta página faz"
}

Regras:
- Se a página mostra uma pergunta com várias opções clicáveis → type "choice"
- Se a página tem checkboxes/seleção múltipla → type "multi-select"
- Se a página mostra apenas texto informativo com botão Continuar → type "insight" ou "statement"
- Se pede email/nome/telefone → type "lead"
- Se mostra resultado/diagnóstico → type "result"
- Se é página inicial com botão começar → type "welcome"
- Extraia o texto EXATO das opções como aparecem na tela
- Inclua emojis se visíveis nas opções
- Se não há opções, retorne array vazio []`
                        },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: `Analise este screenshot (etapa ${i + 1} de ${files.length} do quiz) e extraia a estrutura:` },
                                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } }
                            ]
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 1000,
                    response_format: { type: 'json_object' }
                }),
            });

            if (!visionRes.ok) {
                const err = await visionRes.json().catch(() => ({}));
                console.error(`[CloneScreenshots] Vision error for image ${i + 1}:`, err);
                pages.push({ type: 'insight', text: `(Erro ao analisar screenshot ${i + 1})`, options: [], _error: true });
                continue;
            }

            const visionData = await visionRes.json();
            const content = visionData.choices?.[0]?.message?.content || '';
            try {
                let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                if (jsonMatch) cleaned = jsonMatch[0];
                const page = JSON.parse(cleaned);
                pages.push(page);
                console.log(`[CloneScreenshots] ✅ Image ${i + 1}: type=${page.type}, text="${(page.text || '').slice(0, 40)}..."`);
            } catch (e) {
                console.error(`[CloneScreenshots] Parse error for image ${i + 1}:`, content.slice(0, 200));
                pages.push({ type: 'insight', text: `(Erro ao processar screenshot ${i + 1})`, options: [], _error: true });
            }

            // Clean up temp file
            try { fs.unlinkSync(files[i].path); } catch { }
        }

        console.log(`[CloneScreenshots] Done! ${pages.length} pages extracted`);
        res.json({ pages, total: pages.length });

    } catch (err) {
        console.error('[CloneScreenshots] Error:', err.message);
        // Clean up temp files
        for (const f of files) { try { fs.unlinkSync(f.path); } catch { } }
        res.status(500).json({ error: err.message || 'Erro ao processar screenshots' });
    }
});

// ── Generate contextual step with AI ──

app.post('/api/generate-step', async (req, res) => {
    if (!OPENAI_KEY) return res.status(400).json({ error: 'VITE_OPENAI_API_KEY não configurada' });
    const { existingSteps = [], productName = 'Quiz', niche = 'outro', totalSteps = 0, productDescription = '', targetAudience = '' } = req.body;

    try {
        const stepsContext = existingSteps.length > 0
            ? existingSteps.map(s => `Etapa ${s.step} "${s.name}": ${s.blocks.map(b => `[${b.type}] ${b.text} ${b.options?.length ? `(opções: ${b.options.join(', ')})` : ''}`).join('; ')}`).join('\n')
            : 'Nenhuma etapa existente ainda.';

        const productContext = productDescription ? `\nDescrição do produto: ${productDescription}` : '';
        const audienceContext = targetAudience ? `\nPúblico-alvo: ${targetAudience}` : '';

        const result = await callOpenAI(`Você está criando um quiz/funnel de marketing.
Produto/Quiz: "${productName}"
Nicho: ${niche}${productContext}${audienceContext}
Total de etapas atuais: ${totalSteps}

Etapas existentes:
${stepsContext}

Crie a PRÓXIMA etapa que faça sentido na sequência. Analise o que já existe e crie algo complementar.

Retorne JSON:
{
  "step": {
    "name": "Nome curto da etapa (max 25 chars)",
    "blocks": [{
      "type": "choice|insight|lead|number-input|welcome",
      "text": "Texto da pergunta ou mensagem",
      "headline": "(se welcome) Título",
      "subtitle": "(se welcome ou insight) Subtítulo",
      "cta": "(se welcome ou insight) Texto do botão",
      "options": [{"text": "Opção 1", "emoji": "🔥", "weight": 1}],
      "placeholder": "(se input) Placeholder",
      "unit": "(se number-input) Unidade (kg, cm, etc)"
    }]
  }
}

Regras:
- NÃO repita tipos de etapa que já existem (se já tem choice de idade, não crie outra de idade)
- Varie entre: choice (perguntas), insight (dica/informação), lead (captura email/nome), number-input
- Use emojis relevantes nas opções
- O texto deve ser envolvente e em português
- Adapte o conteúdo ao produto e público-alvo fornecidos
- Se não há etapas, comece com uma welcome page`, {
            system: 'Você é especialista em criar quizzes de marketing de alta conversão em português.',
            temperature: 0.8,
            maxTokens: 1000,
        });

        res.json(result);
    } catch (err) {
        console.error('[GenerateStep] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/generate-quiz', async (req, res) => {
    const { productName, productDescription, niche, questionCount = 10, useConditionals = false, customInstructions = '', companyName = '' } = req.body;
    if (!productName) return res.status(400).json({ error: 'Nome do produto obrigatório' });
    if (!OPENAI_KEY) return res.status(400).json({ error: 'VITE_OPENAI_API_KEY não configurada no .env' });

    try {
        console.log(`[AI] Gerando quiz para "${productName}" (${niche}, ${questionCount} perguntas, conditionals: ${useConditionals})...`);

        // STEP 1: Analyze product
        const metadata = await callOpenAI(`Analise este produto e retorne JSON:
{
  "niche": "nicho refinado",
  "subTheme": "sub-tema específico",
  "tone": "empático|motivacional|profissional|urgente|casual",
  "palette": ["#hex1", "#hex2", "#hex3"],
  "emojiStyle": "minimal|moderate|expressive"
}

Produto: ${productName}
Descrição: ${productDescription || 'Não fornecida'}
Nicho: ${niche}
Tudo em português brasileiro.`, { temperature: 0.5, maxTokens: 500 });
        console.log('[AI] Step 1/3 ✅ metadata');

        // STEP 2: Generate all quiz content in one call
        const quizContent = await callOpenAI(`Você vai montar um quiz de funil de vendas para o produto "${productName}".

═══════════════════════════════════
CONTEXTO FUNDAMENTAL — LEIA ANTES DE TUDO
═══════════════════════════════════

Este quiz NÃO é uma landing page de vendas. O usuário NÃO sabe que vai receber uma oferta.
Ele clicou em um anúncio curioso (ex: "Descubra seu perfil de...", "Teste seu nível de...") e está fazendo um quiz por curiosidade.

A ESTRATÉGIA é:
1. Fazer perguntas que despertem problemas, dores e desejos relacionados ao nicho
2. Usar insights e provas sociais para educar e gerar consciência do problema
3. Criar urgência e desejo ao longo da jornada
4. No FINAL, o resultado revela "a solução" — que é o produto "${productName}"
5. O usuário chega ao resultado QUERENDO a solução, sem ter percebido que era um funil de vendas

Portanto: as perguntas devem ser sobre O PROBLEMA/DESEJO do usuário, NUNCA sobre o produto diretamente.
Não mencione o nome do produto nas perguntas. O produto só aparece nos "results" como solução.

Nicho: ${metadata.niche || niche}
Sub-tema: ${metadata.subTheme || productName}
Tom: ${metadata.tone || 'empático'}
Total de páginas: ${questionCount}
${customInstructions ? `\nINSTRUÇÕES ESPECIAIS DO USUÁRIO (siga fielmente como prioridade):\n${customInstructions}\n` : ''}

═══════════════════════════════════
CATÁLOGO DE COMPONENTES DISPONÍVEIS
═══════════════════════════════════

📋 PERGUNTAS (coletam respostas do usuário):
• "choice" — Pergunta de múltipla escolha com 3-5 opções. Cada opção tem emoji e peso. Ideal para segmentar o perfil do usuário. Use layouts variados.
  JSON: {"type": "choice", "text": "Pergunta?", "options": [{"text": "Opção", "emoji": "😊", "weight": 1}]}
• "likert" — Escala de frequência 1-5 (Nunca → Sempre). Ideal para medir hábitos e comportamentos recorrentes.
  JSON: {"type": "likert", "text": "Com que frequência...?", "options": [{"text": "Nunca", "value": 1, "weight": 1}, {"text": "Raramente", "value": 2, "weight": 2}, {"text": "Às vezes", "value": 3, "weight": 3}, {"text": "Frequentemente", "value": 4, "weight": 4}, {"text": "Sempre", "value": 5, "weight": 5}]}
• "yes-no" — Pergunta simples de Sim ou Não. Ideal para validar um problema ou situação binária.
  JSON: {"type": "yes-no", "text": "Você já tentou...?"}
• "statement" — Afirmação para concordar/discordar. Inclui uma citação reflexiva/motivacional. Ideal para engajar emocionalmente.
  JSON: {"type": "statement", "text": "Você concorda?", "quote": "Frase motivacional", "options": ["Discordo vivamente", "Discordo parcialmente", "Concordo parcialmente", "Concordo vivamente"]}

📌 CONTEÚDO PERSUASIVO (não coletam dados, reforçam engajamento):
• "insight" — Dica educativa com dado estatístico real e relevante. Funciona como uma "pausa inteligente" que educa o usuário. Máximo 2-3 no quiz inteiro.
  JSON: {"type": "insight", "title": "Título do insight", "body": "Texto educativo com dado concreto."}
• "social-proof" — Prova social com número impactante (ex: "92% das pessoas"). Gera confiança e valida a jornada. Ideal no meio do quiz. Máximo 1-2 no quiz.
  JSON: {"type": "social-proof", "headline": "92% das pessoas", "subheadline": "relataram melhora significativa"}
• "testimonial" — Depoimento fictício mas realista de cliente satisfeito. Gera identificação. Máximo 1 no quiz.
  JSON: {"type": "testimonial", "name": "Maria S.", "text": "Esse programa mudou minha perspectiva totalmente!", "rating": 5}
• "before-after" — Comparação visual de antes vs depois. Ideal para mostrar transformação. Máximo 1 no quiz.
  JSON: {"type": "before-after", "title": "Transformação real", "beforeLabel": "Antes", "afterLabel": "Depois", "beforeImage": "", "afterImage": ""}

⏳ TRANSIÇÃO (só no FINAL do quiz, ANTES do resultado):
• "loading" — Tela de carregamento que simula análise das respostas. Cria expectativa. USAR APENAS 1x como PENÚLTIMA ou ANTEPENÚLTIMA página.
  JSON: {"type": "loading", "title": "Analisando suas respostas...", "items": ["Calculando seu perfil...", "Gerando recomendações...", "Preparando diagnóstico..."]}

═══════════════════════════════════
REGRAS OBRIGATÓRIAS DE ORDENAÇÃO
═══════════════════════════════════

A ordem DEVE fazer sentido como uma JORNADA DO USUÁRIO:

FASE 1 — ABERTURA (páginas 1-3): Perguntas simples e leves para o usuário entrar no quiz. Só use "choice" ou "yes-no" aqui.

FASE 2 — APROFUNDAMENTO (páginas 4 até 60%): Perguntas mais específicas (choice, likert, statement). Intercale 1 insight ou social-proof entre as perguntas de forma IRREGULAR.

FASE 3 — PERSUASÃO (60% até 80%): Aqui o usuário pode desistir. Coloque testimonial, before-after, ou social-proof para mantê-lo engajado. Misture com 1-2 perguntas.

FASE 4 — FECHAMENTO (últimas 2-3 páginas): Últimas perguntas decisivas + loading (análise). O loading SEMPRE vem AQUI, nunca antes.

⛔ PROIBIÇÕES ABSOLUTAS:
1. NUNCA coloque "loading" no início ou meio do quiz — SOMENTE nas últimas 2-3 páginas
2. NUNCA coloque perguntas (choice/likert/yes-no) DEPOIS do loading — o loading marca o fim
3. NUNCA use mais de 3 vezes o mesmo tipo de componente (ex: máximo 3 insights, máximo 3 choices seguidos)
4. NUNCA deixe mais de 2 componentes do mesmo tipo EM SEQUÊNCIA (ex: choice, choice é ok; choice, choice, choice é proibido)
5. NUNCA comece o quiz com insight, testimonial, ou social-proof — comece SEMPRE com uma pergunta
6. NUNCA coloque before-after ou testimonial nos primeiros 40% do quiz

═══════════════════════════════════

Retorne JSON com esta estrutura:
{
  "welcome": {"headline": "Título chamativo sobre o PROBLEMA (não sobre o produto)", "subheadline": "Subtítulo que gere curiosidade", "cta": "Texto do botão →"},
  "pages": [... array com ${questionCount} objetos usando os tipos acima ...],
  "results": [
    {"id": "baixo", "name": "Perfil Nome", "minPct": 0, "maxPct": 40, "description": "Diagnóstico do perfil + como o produto ${productName} é a solução ideal para esse caso", "cta": "Quero minha solução →", "ctaUrl": ""},
    {"id": "medio", "name": "Perfil Nome", "minPct": 41, "maxPct": 70, "description": "Diagnóstico + como ${productName} resolve os pontos identificados", "cta": "Garantir meu acesso →", "ctaUrl": ""},
    {"id": "alto", "name": "Perfil Nome", "minPct": 71, "maxPct": 100, "description": "Diagnóstico + como ${productName} potencializa os resultados", "cta": "Começar agora →", "ctaUrl": ""}
  ]
}

LEMBRETES FINAIS:
- Perguntas sobre o PROBLEMA/DESEJO do usuário, NUNCA sobre o produto
- O produto "${productName}" só aparece nos "results" como solução revelada
- O welcome NÃO menciona o produto — deve parecer um quiz educativo/diagnóstico
- Tudo em português BR. Retorne SOMENTE o JSON.
${useConditionals ? `
FLUXO CONDICIONAL — OBRIGATÓRIO:
A segunda ou terceira página DEVE ser uma pergunta de ramificação. Depois dela, crie páginas específicas para cada ramo.
Cada página de ramo DEVE ter "stepGoToName" apontando para a página de convergência.

EXEMPLO:
"pages": [
  {"type": "choice", "text": "Qual seu objetivo?", "options": [{"text": "Emagrecer", "emoji": "🏃", "weight": 1}, {"text": "Ganhar massa", "emoji": "💪", "weight": 2}]},
  {"type": "choice", "text": "Qual seu sexo biológico?", "options": [
    {"text": "Masculino", "emoji": "👨", "weight": 1, "goToStepName": "Rotina Masculina"},
    {"text": "Feminino", "emoji": "👩", "weight": 1, "goToStepName": "Rotina Feminina"}
  ]},
  {"type": "insight", "title": "Rotina Masculina", "body": "Dica para homens...", "stepGoToName": "Alimentação"},
  {"type": "insight", "title": "Rotina Feminina", "body": "Dica para mulheres...", "stepGoToName": "Alimentação"},
  {"type": "choice", "text": "Alimentação", "options": [...]},
  ... restante segue as regras normais de ordenação ...
]
REGRAS: goToStepName dentro de cada opção, stepGoToName na raiz do ramo. title/text = nomes referenciados. Fluxo SEMPRE converge.` : ''}`, {
            system: `Você é um especialista em quiz funnels de alta conversão com anos de experiência.
Você DEVE criar quizzes que sigam uma jornada lógica e narrativa:
1. ABERTURA: perguntas fáceis → APROFUNDAMENTO: perguntas específicas + conteúdo → PERSUASÃO: provas sociais → FECHAMENTO: loading + resultado.
2. NUNCA coloque loading no início ou meio. NUNCA coloque perguntas depois do loading.
3. MESCLE diferentes tipos de componentes de forma natural. Máximo 3 do mesmo tipo no quiz inteiro.
4. Cada quiz deve parecer uma conversa fluida, não uma lista repetitiva de perguntas.`,
            temperature: 0.8,
            maxTokens: 5000
        });
        console.log('[AI] Step 2/3 ✅ quiz content');

        // Build PageBuilder steps from AI response
        const steps = [];
        const quizId = Math.random().toString(36).slice(2, 10);

        // Welcome step
        if (quizContent.welcome) {
            steps.push({
                id: `stp_welcome_${Date.now()}`,
                name: 'Capa do Quiz',
                blocks: [{
                    type: 'welcome',
                    headline: quizContent.welcome.headline || '',
                    subtitle: quizContent.welcome.subheadline || '',
                    cta: quizContent.welcome.cta || 'Começar →',
                    emoji: '🔥',
                    imageUrl: '', imageWidth: 100, imagePosition: 'top', textAlign: 'center', bgColor: '',
                }],
            });
        }

        // Add demographic steps (sex + age) right after welcome
        steps.push({
            id: `stp_sex_${Date.now()}`,
            name: 'Qual é o seu sexo?',
            blocks: [{
                type: 'choice',
                text: 'Qual é o seu sexo?',
                options: [
                    { text: 'Feminino', emoji: '👩', weight: 1 },
                    { text: 'Masculino', emoji: '👨', weight: 1 },
                    { text: 'Prefiro não dizer', emoji: '🤝', weight: 1 },
                ],
                optionLayout: 'list',
            }],
        });
        steps.push({
            id: `stp_age_${Date.now() + 1}`,
            name: 'Qual é a sua faixa de idade?',
            blocks: [{
                type: 'choice',
                text: 'Qual é a sua faixa de idade?',
                options: [
                    { text: '18-24 anos', emoji: '🧑', weight: 1 },
                    { text: '25-34 anos', emoji: '💼', weight: 2 },
                    { text: '35-44 anos', emoji: '🏠', weight: 3 },
                    { text: '45-54 anos', emoji: '✨', weight: 4 },
                    { text: '55+ anos', emoji: '🌟', weight: 5 },
                ],
                optionLayout: 'list',
            }],
        });

        // Page steps
        if (quizContent.pages?.length) {
            quizContent.pages.forEach((page, i) => {
                const block = { ...page };
                const stepGoToName = block.stepGoToName; delete block.stepGoToName;
                delete block.branch;
                if (block.options && Array.isArray(block.options)) {
                    block.options = block.options.map(opt => {
                        if (typeof opt === 'string') return { text: opt, emoji: '', weight: 1 };
                        const cleaned = { text: opt.text || '', emoji: opt.emoji || '', weight: opt.weight || 1, ...(opt.value !== undefined ? { value: opt.value } : {}) };
                        if (opt.goToStepName) cleaned._goToStepName = opt.goToStepName;
                        return cleaned;
                    });
                }
                if (block.type === 'choice') block.optionLayout = block.optionLayout || 'list';
                const stepObj = {
                    id: `stp_${Date.now()}_${i}`,
                    name: block.text || block.title || block.headline || `Etapa ${i + 1}`,
                    blocks: [block],
                };
                if (stepGoToName) stepObj._goToStepName = stepGoToName;
                steps.push(stepObj);
            });
        }

        // Always add email capture step BEFORE results
        steps.push({
            id: `stp_capture_${Date.now()}`,
            name: 'Captura de E-mail',
            blocks: [{
                type: 'capture',
                title: 'Quase lá!',
                subtitle: 'Preencha para ver seu resultado personalizado',
                fields: ['name', 'email'],
                buttonText: 'Ver meu resultado →',
                required: true,
            }],
        });

        // Add result step at the very end
        const resultData = quizContent.results || [];
        steps.push({
            id: `stp_result_${Date.now()}`,
            name: 'Resultado',
            blocks: [{
                type: 'result',
                productName: productName,
                salesUrl: '',
                cta: resultData[0]?.cta || '🔥 Quero minha solução →',
                productContext: productDescription || '',
                title: 'Seu Diagnóstico Personalizado',
            }],
        });

        // Resolve conditional routing references (goToStepName → goToStep ID)
        if (useConditionals) {
            const nameToId = {};
            steps.forEach(s => { nameToId[s.name] = s.id; });
            steps.forEach(step => {
                if (step._goToStepName) {
                    const targetId = nameToId[step._goToStepName];
                    if (targetId) step.goToStep = targetId;
                    delete step._goToStepName;
                }
                step.blocks.forEach(block => {
                    if (block.options) {
                        block.options.forEach(opt => {
                            if (opt._goToStepName) {
                                const targetId = nameToId[opt._goToStepName];
                                if (targetId) opt.goToStep = targetId;
                                delete opt._goToStepName;
                            }
                        });
                    }
                });
            });
            console.log('[AI] Conditional routing resolved ✅');
        }

        // Extract questions for Player compatibility
        const questions = (quizContent.pages || [])
            .filter(p => ['choice', 'multi-select', 'statement', 'likert', 'image-select'].includes(p.type))
            .map(p => {
                const q = { ...p };
                if (q.options) q.options = q.options.map(o => typeof o === 'string' ? { text: o, emoji: '' } : o);
                return q;
            });

        // Build stepPageMap and stepGoToMap
        const stepPageMap = {};
        const stepGoToMap = {};
        steps.forEach((s, i) => { stepPageMap[s.id] = i; if (s.goToStep) stepGoToMap[i] = s.goToStep; });

        const result = {
            id: quizId,
            name: `Quiz: ${productName}`,
            companyName: companyName || productName,
            emoji: '📊',
            primaryColor: metadata.palette?.[0] || '#2563eb',
            niche: niche,
            welcome: quizContent.welcome,
            steps,
            stepPageMap,
            stepGoToMap,
            pages: quizContent.pages || [],
            questions,
            results: quizContent.results || [],
            collectLead: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        console.log(`[AI] Step 3/3 ✅ Quiz "${productName}" gerado: ${steps.length} steps, ${questions.length} questions${useConditionals ? ', with conditionals' : ''}`);
        res.json(result);
    } catch (err) {
        console.error('[AI] ❌ Erro:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Quiz Clone SSE (real-time progress) ──

app.get('/api/clone-stream', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'URL obrigatória' });

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const send = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    let browser;
    try {
        send('progress', { stage: 'connecting', msg: '🌐 Conectando ao servidor...', pct: 5 });

        const puppeteer = require('puppeteer');
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security'],
        });
        const pg = await browser.newPage();
        const delay = ms => new Promise(r => setTimeout(r, ms));
        await pg.setViewport({ width: 430, height: 932 });
        await pg.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

        send('progress', { stage: 'scraping', msg: '🔍 Abrindo quiz no navegador...', pct: 10 });

        await pg.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(3000);

        // Dismiss popups
        await pg.evaluate(() => {
            const p = /accept|aceitar|ok|got it|entendi|fechar|close|dismiss|consent/i;
            document.querySelectorAll('button,a,[role="button"]').forEach(el => {
                const t = (el.innerText || '').trim();
                if (t.length < 30 && p.test(t)) { const r = el.getBoundingClientRect(); if (r.height > 0 && r.width > 0) el.click(); }
            });
        });
        await delay(1000);

        send('progress', { stage: 'scraping', msg: '🔍 Quiz carregado. Extraindo páginas...', pct: 15 });

        // ── Reuse the same scrape logic as /api/clone-quiz ──
        const MAX_PAGES = 30;
        const MAX_STUCK = 3;
        let allPages = [], welcomeData = null, collectLead = false;
        let prevHash = '', stuckCount = 0;

        const getContentHash = async () => pg.evaluate(() => {
            const main = document.querySelector('main, [role="main"], .main-content, #app, #root, #__next') || document.body;
            return (main.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500);
        });

        const extractScreen = async () => pg.evaluate(() => {
            const allEls = [...document.querySelectorAll('h1,h2,h3,h4,h5,p,span,label,li,td,th,div')].filter(el => {
                const r = el.getBoundingClientRect();
                if (r.height <= 0 || r.width <= 0) return false;
                const t = (el.innerText || '').trim();
                return t.length > 0 && t.length < 500 && el.children.length < 3;
            });
            const texts = [...new Set(allEls.map(el => (el.innerText || '').trim()))].filter(t => t.length > 1 && t.length < 500);

            const clickables = [];
            const seen = new Set();
            for (const el of document.querySelectorAll('button, a, [role="button"], [onclick], label, div, span, li')) {
                const r = el.getBoundingClientRect();
                if (r.height <= 5 || r.width <= 5 || r.height > 200) continue;
                const text = (el.innerText || '').trim();
                if (!text || text.length === 0 || text.length > 300) continue;
                const isNav = /voltar|back|prev|skip|pular|anterior|logo|cookie|privacy|privacidade|termos|fechar|close|sign.?up|sign.?in|log.?in|register|pricing|features|blog|about|contact|home|faq|pol[ií]tica|inlead|central de an[úu]ncios|criado via|© \d{4}/i.test(text);
                if (isNav) continue;
                const isSubmit = /^(próximo|next|continuar|continue|começar|start|enviar|submit|avançar|advance|ok|prosseguir|ver resultado|iniciar|vamos lá|quero|bora|let'?s go|take the quiz|get started|take quiz|start quiz)$/i.test(text.replace(/[→►▶\s]/g, '').trim());
                const style = getComputedStyle(el);
                const isPointer = style.cursor === 'pointer';
                const tag = el.tagName.toLowerCase();
                const isClickable = tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button' || isPointer;
                if (text.length > 2 && text.length < 200 && !seen.has(text) && (isClickable || isSubmit)) {
                    seen.add(text);
                    clickables.push({ text, isSubmit, tag, x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height });
                }
            }

            const inputs = [...document.querySelectorAll('input:not([type="hidden"]),textarea,select')].filter(el => {
                const r = el.getBoundingClientRect(); return r.height > 0 && r.width > 0;
            }).map(el => ({ type: el.type || el.tagName.toLowerCase(), name: el.name || el.placeholder || '', label: el.labels?.[0]?.innerText || '' }));

            const images = [...document.querySelectorAll('img')].filter(el => {
                const r = el.getBoundingClientRect(); return r.height > 40 && r.width > 40;
            }).map(el => el.src).filter(s => s && !s.includes('data:'));

            return { texts, clickables, inputs, images };
        });

        const classifyPage = (screen) => {
            const { clickables, inputs, texts } = screen;
            const options = clickables.filter(c => !c.isSubmit);
            const allText = texts.join(' ').toLowerCase();
            if (allText.match(/bem.?vind|welcome|vamos começar|start|iniciar/i) && options.length <= 1) return 'welcome';
            if (inputs.some(i => i.type === 'email' || i.name.match(/email|nome|name|phone|telefone|whatsapp/i))) return 'lead';
            if (inputs.length > 0) return 'input';
            if (options.length > 1) return 'choice';
            if (options.length === 1) return 'statement';
            return 'insight';
        };

        const buildPage = (screen, type) => {
            const options = screen.clickables.filter(c => !c.isSubmit);
            const mainText = screen.texts.filter(t => t.length > 3 && t.length < 300).slice(0, 3).join('\n');
            if (type === 'welcome') return { headline: screen.texts[0] || '', subheadline: screen.texts[1] || '', cta: screen.clickables.find(c => c.isSubmit)?.text || 'Começar →' };
            return { type, text: mainText, options: options.map((o, j) => ({ text: o.text, emoji: '', image: '', weight: j + 1 })), images: screen.images?.slice(0, 2) || [] };
        };

        const clickAndWait = async (clickable) => {
            try {
                // Use JavaScript dispatchEvent for SPA frameworks (React/Next.js)
                // which don't respond to native Puppeteer mouse events
                await pg.evaluate(({ x, y }) => {
                    const el = document.elementFromPoint(x, y);
                    if (!el) return;
                    // Walk up to find the closest button/clickable
                    let target = el;
                    for (let i = 0; i < 5; i++) {
                        if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.getAttribute('role') === 'button') break;
                        if (target.parentElement) target = target.parentElement;
                    }
                    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
                    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
                        target.dispatchEvent(new MouseEvent(type, opts));
                    });
                }, { x: clickable.x, y: clickable.y });
                await delay(2500);
                const newHash = await getContentHash();
                if (newHash !== prevHash) return true;
                // Fallback: try Puppeteer native click
                await pg.mouse.click(clickable.x, clickable.y);
                await delay(2000);
                const newHash2 = await getContentHash();
                return newHash2 !== prevHash;
            } catch { return false; }
        };

        for (let i = 0; i < MAX_PAGES; i++) {
            await delay(500);
            const screen = await extractScreen();
            const options = screen.clickables.filter(c => !c.isSubmit);
            const submitBtns = screen.clickables.filter(c => c.isSubmit);

            const hash = await getContentHash();
            if (hash === prevHash) {
                stuckCount++;
                if (stuckCount >= MAX_STUCK) { send('progress', { stage: 'done', msg: `⛔ Quiz travou após ${allPages.length} páginas`, pct: 90 }); break; }
            } else { stuckCount = 0; }
            prevHash = hash;

            const type = classifyPage(screen);

            const pageHash = hash;
            const isDuplicate = allPages.some(p => p._hash === pageHash);
            if (isDuplicate) {
                // skip
            } else if (type === 'welcome') {
                welcomeData = buildPage(screen, type);
                send('progress', { stage: 'scraping', msg: `📄 Página de boas-vindas detectada`, pct: 15 + i * 3, pageNum: i + 1, pageType: 'welcome', pageText: (welcomeData.headline || '').slice(0, 50) });
            } else if (type === 'lead') {
                collectLead = true;
                send('progress', { stage: 'scraping', msg: `📧 Formulário de captura detectado`, pct: 15 + i * 3, pageNum: i + 1, pageType: 'lead' });
            } else if (type !== 'input') {
                const pageObj = buildPage(screen, type);
                if (pageObj) {
                    pageObj._hash = pageHash;
                    allPages.push(pageObj);
                    const preview = (pageObj.text || '').replace(/\n/g, ' ').slice(0, 50);
                    send('progress', { stage: 'scraping', msg: `✅ Página ${allPages.length} clonada — "${preview}..."`, pct: Math.min(85, 15 + allPages.length * 5), pageNum: i + 1, pageType: type, pageText: preview, totalPages: allPages.length });
                }
            }

            // ── Advance strategies (improved for multi-page quizzes) ──
            let advanced = false;

            // Helper: scroll down and re-extract to find buttons below viewport
            const scrollAndExtract = async () => {
                await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await delay(500);
                return extractScreen();
            };

            // Helper: find submit/continue buttons (broader matching)
            const findSubmits = (scr) => {
                const submitPattern = /continuar|continue|próximo|next|começar|start|enviar|submit|avançar|advance|prosseguir|ver resultado|iniciar|vamos lá|quero|bora|let'?s go|take the quiz|get started|take quiz|start quiz/i;
                return scr.clickables.filter(c => c.isSubmit || submitPattern.test(c.text.replace(/[→►▶\s]/g, '').trim()));
            };

            if (options.length === 0) {
                // ── INFO PAGE (no options, just a submit/continue button) ──
                const allSubmits = findSubmits(screen);
                if (allSubmits.length > 0) {
                    for (const btn of allSubmits) {
                        advanced = await clickAndWait(btn);
                        if (advanced) break;
                    }
                }
                // Try after scrolling down
                if (!advanced) {
                    const scrolled = await scrollAndExtract();
                    const scrollSubmits = findSubmits(scrolled);
                    for (const btn of scrollSubmits) {
                        advanced = await clickAndWait(btn);
                        if (advanced) break;
                    }
                }
            } else {
                // ── QUESTION PAGE (has options) ──
                // Click first option
                advanced = await clickAndWait(options[0]);

                // If didn't auto-advance, maybe need to click "Continuar" that appeared after selecting
                if (!advanced) {
                    await delay(500);
                    // Re-extract screen to find newly appeared/enabled buttons
                    const newScreen = await extractScreen();
                    const newSubmits = findSubmits(newScreen);
                    if (newSubmits.length > 0) {
                        for (const btn of newSubmits) {
                            advanced = await clickAndWait(btn);
                            if (advanced) break;
                        }
                    }
                    // Try scrolling down to find Continuar below viewport
                    if (!advanced) {
                        const scrolled = await scrollAndExtract();
                        const scrollSubmits = findSubmits(scrolled);
                        for (const btn of scrollSubmits) {
                            advanced = await clickAndWait(btn);
                            if (advanced) break;
                        }
                    }
                }
            }

            // Fallback: try any remaining clickable
            if (!advanced) {
                for (const c of screen.clickables) {
                    if (options.includes(c) || findSubmits(screen).includes(c)) continue;
                    advanced = await clickAndWait(c);
                    if (advanced) break;
                }
            }

            // Fallback: content-area click
            if (!advanced) { try { await pg.mouse.click(215, 450); await delay(2000); if (await getContentHash() !== prevHash) advanced = true; } catch { } }
            // Fallback: keyboard
            if (!advanced) { for (const key of ['Enter', 'Space', 'ArrowRight']) { try { await pg.keyboard.press(key); await delay(1500); if (await getContentHash() !== prevHash) { advanced = true; break; } } catch { } } }

            if (!advanced) {
                send('progress', { stage: 'done', msg: `⛔ Não foi possível avançar. ${allPages.length} páginas clonadas.`, pct: 90 });
                break;
            }
        }

        await browser.close();
        browser = null;

        const quizResult = {
            quizName: welcomeData?.headline || 'Quiz Clonado',
            niche: 'outro', primaryColor: '#2563eb',
            welcome: welcomeData || { headline: 'Quiz Clonado', subheadline: '', cta: 'Começar →' },
            pages: allPages.map(p => { delete p._hash; return p; }),
            results: [
                { id: 'r1', name: 'Resultado A', description: 'Seu perfil indica...', cta: 'Ver recomendação →', minPct: 0, maxPct: 50 },
                { id: 'r2', name: 'Resultado B', description: 'Seu perfil indica...', cta: 'Ver recomendação →', minPct: 51, maxPct: 100 },
            ],
            collectLead,
        };

        send('progress', { stage: 'building', msg: `🧱 Montando quiz com ${allPages.length} páginas...`, pct: 95 });
        send('result', { quiz: quizResult });
        send('progress', { stage: 'complete', msg: `✅ ${allPages.length} páginas clonadas com sucesso!`, pct: 100 });
        res.end();

    } catch (err) {
        console.error('[Clone-Stream] Error:', err.message);
        if (browser) try { await browser.close(); } catch { }
        send('error', { error: err.message || 'Erro ao clonar' });
        res.end();
    }
});

// ── Quiz Clone (Puppeteer page-by-page scrape) ──

app.post('/api/clone-quiz', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL obrigatória' });

    let browser;
    try {
        console.log(`[Clone] Starting scrape of: ${url}`);
        const puppeteer = require('puppeteer');
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security'],
        });
        const pg = await browser.newPage();
        const delay = ms => new Promise(r => setTimeout(r, ms));
        await pg.setViewport({ width: 430, height: 932 });
        await pg.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

        // Navigate
        await pg.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(3000); // extra wait for SPA hydration

        // Dismiss cookie/consent popups
        await pg.evaluate(() => {
            const dismissPatterns = /accept|aceitar|ok|got it|entendi|fechar|close|dismiss|consent/i;
            document.querySelectorAll('button,a,[role="button"]').forEach(el => {
                const t = (el.innerText || '').trim();
                if (t.length < 30 && dismissPatterns.test(t)) {
                    const r = el.getBoundingClientRect();
                    if (r.height > 0 && r.width > 0) el.click();
                }
            });
        });
        await delay(500);

        const allPages = [];
        let prevHash = '';
        let stuckCount = 0;
        const MAX_PAGES = 40;
        const MAX_STUCK = 3;

        // ── Safe evaluate with retry after navigation ──
        async function safeEval(fn, ...args) {
            for (let attempt = 0; attempt < 3; attempt++) {
                try { return await pg.evaluate(fn, ...args); }
                catch (e) {
                    if (e.message.includes('context') || e.message.includes('navigation') || e.message.includes('detached')) {
                        console.log(`[Clone] Context lost, waiting for navigation...`);
                        try { await pg.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => { }); } catch { }
                        await delay(2000);
                    } else throw e;
                }
            }
            return null;
        }

        // ── Get a content hash for change detection ──
        async function getContentHash() {
            const result = await safeEval(() => {
                const texts = [];
                // Include heading text
                document.querySelectorAll('h1,h2,h3,h4,p').forEach(el => {
                    const r = el.getBoundingClientRect();
                    if (r.height > 0 && r.width > 0) texts.push((el.innerText || '').trim());
                });
                // Include clickable element text for better differentiation
                document.querySelectorAll('button,[role="button"],[class*="option"],[class*="choice"]').forEach(el => {
                    const r = el.getBoundingClientRect();
                    if (r.height > 0 && r.width > 0) texts.push('BTN:' + (el.innerText || '').trim());
                });
                return texts.slice(0, 50).join('|');
            });
            return result || '';
        }

        // ── Extract EVERYTHING visible on screen ──
        async function extractScreen() {
            const result = await safeEval(() => {
                const result = { texts: [], clickables: [], images: [], inputs: [], meta: {} };
                const seen = new Set();

                // ── 1. Get ALL visible text with hierarchy info ──
                const allEls = document.body.querySelectorAll('*');
                for (const el of allEls) {
                    const rect = el.getBoundingClientRect();
                    if (rect.height <= 0 || rect.width <= 0 || rect.top > 1200) continue;

                    const style = getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

                    // Get direct text content (not children's text)
                    let ownText = '';
                    for (const child of el.childNodes) {
                        if (child.nodeType === Node.TEXT_NODE) {
                            ownText += child.textContent.trim() + ' ';
                        }
                    }
                    ownText = ownText.trim();

                    // Also get full innerText for elements that are leaf-ish
                    const fullText = (el.innerText || '').trim();

                    if (fullText && fullText.length > 1 && fullText.length < 500 && !seen.has(fullText)) {
                        const tag = el.tagName.toLowerCase();
                        const isHeading = /^h[1-6]$/.test(tag);
                        const fontSize = parseFloat(style.fontSize);
                        const isLargeText = fontSize >= 18;
                        const hasQuestionClass = el.className?.toString().match(/title|heading|question|headline|header/i);

                        // Only add if this element is somewhat "leaf" (not a huge container)
                        if (fullText.length < 300 || isHeading) {
                            seen.add(fullText);
                            result.texts.push({
                                text: fullText,
                                isHeading: isHeading || isLargeText || !!hasQuestionClass,
                                tag,
                                fontSize: style.fontSize,
                                top: rect.top,
                            });
                        }
                    }
                }

                // Sort texts by vertical position
                result.texts.sort((a, b) => a.top - b.top);

                // ── Helper: check if element is inside nav/header/footer/cookie ──
                function isInSiteChrome(el) {
                    let p = el;
                    for (let d = 0; d < 10 && p && p !== document.body; d++) {
                        const tag = p.tagName?.toLowerCase() || '';
                        const cls = p.className?.toString() || '';
                        const role = p.getAttribute?.('role') || '';
                        const id = p.id || '';
                        // Skip nav, header, footer, cookie banners, sidebars
                        if (['nav', 'header', 'footer', 'aside'].includes(tag)) return true;
                        if (role === 'navigation' || role === 'banner' || role === 'contentinfo') return true;
                        if (/nav|header|footer|sidebar|cookie|consent|banner|menu|toolbar|topbar|bottombar/i.test(cls + ' ' + id)) return true;
                        // Skip fixed/sticky elements (likely overlays, navs)
                        const pos = getComputedStyle(p).position;
                        if (pos === 'fixed' || pos === 'sticky') return true;
                        p = p.parentElement;
                    }
                    return false;
                }

                // ── 2. Get ALL clickable elements ──
                for (const el of allEls) {
                    const rect = el.getBoundingClientRect();
                    if (rect.height <= 10 || rect.width <= 30 || rect.top > 1200) continue;
                    // Skip elements in header zone (top 70px usually nav)
                    if (rect.top < 70 && rect.height < 60) continue;

                    const style = getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

                    // Skip site chrome elements
                    if (isInSiteChrome(el)) continue;

                    const tag = el.tagName.toLowerCase();
                    const role = el.getAttribute('role') || '';
                    const cursor = style.cursor;
                    const cls = el.className?.toString() || '';
                    const text = (el.innerText || '').trim();

                    // Is this element clickable?
                    const isButton = tag === 'button' || role === 'button';
                    const isLink = tag === 'a';
                    const hasPointerCursor = cursor === 'pointer';
                    const hasClickClass = /btn|button|option|answer|choice|card|cta|action|select|item/i.test(cls);
                    const hasOnClick = el.hasAttribute('onclick') || el.hasAttribute('data-click');
                    const isRadio = tag === 'input' && (el.type === 'radio' || el.type === 'checkbox');
                    const isLabel = tag === 'label';

                    const isClickable = isButton || isLink || hasPointerCursor || hasClickClass || hasOnClick || isRadio || isLabel;
                    if (!isClickable) continue;
                    if (!text || text.length === 0 || text.length > 300) continue;

                    // Classify this clickable
                    const isNav = /voltar|back|prev|skip|pular|anterior|logo|cookie|privacy|privacidade|termos|assinatura|fechar|close|sign.?up|sign.?in|log.?in|register|pricing|features|blog|about|contact|home|faq|pol[ií]tica|inlead|central de an[úu]ncios|criado via|© \d{4}/i.test(text);
                    const isSubmit = /^(próximo|next|continuar|continue|começar|start|enviar|submit|avançar|advance|ok|prosseguir|ver resultado|iniciar|vamos lá|quero|bora|let'?s go|take the quiz|get started|take quiz|start quiz)$/i.test(text.replace(/[→►▶\s]/g, '').trim());

                    if (isNav) continue;

                    // Deduplicate
                    const key = text.slice(0, 50) + '|' + Math.round(rect.top);
                    if (seen.has(key)) continue;
                    seen.add(key);

                    // Extract emoji
                    const emojiMatch = text.match(/^([\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}])\s*/u);
                    const emoji = emojiMatch ? emojiMatch[1] : '';
                    const cleanText = emojiMatch ? text.replace(emojiMatch[0], '').trim() : text;

                    // Check for embedded image
                    const img = el.querySelector('img');
                    const imgSrc = img ? (img.src || img.getAttribute('data-src') || '') : '';

                    result.clickables.push({
                        text: cleanText,
                        emoji,
                        image: imgSrc,
                        isSubmit,
                        tag,
                        ariaLabel: el.getAttribute('aria-label') || '',
                        fullText: text,
                        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                        area: rect.width * rect.height,
                    });
                }

                // Sort by vertical position
                result.clickables.sort((a, b) => a.rect.top - b.rect.top);

                // Deduplicate options by text (keep the one with image if any)
                const deduped = [];
                const seenTexts = new Map();
                for (const c of result.clickables) {
                    const key = c.text.toLowerCase().trim();
                    if (seenTexts.has(key)) {
                        // Keep the version with image
                        if (c.image && !seenTexts.get(key).image) {
                            const idx = deduped.indexOf(seenTexts.get(key));
                            if (idx >= 0) deduped[idx] = c;
                            seenTexts.set(key, c);
                        }
                    } else {
                        seenTexts.set(key, c);
                        deduped.push(c);
                    }
                }
                result.clickables = deduped;

                // ── 3. Images ──
                document.querySelectorAll('img').forEach(img => {
                    const src = img.src || img.getAttribute('data-src') || '';
                    const rect = img.getBoundingClientRect();
                    if (src && !src.startsWith('data:') && src.length > 10 && rect.height > 30 && rect.width > 30) {
                        result.images.push({ src, alt: img.alt || '' });
                    }
                });

                // ── 4. Inputs ──
                document.querySelectorAll('input,textarea,select').forEach(inp => {
                    const rect = inp.getBoundingClientRect();
                    if (rect.height > 0 && rect.width > 0) {
                        result.inputs.push({ type: inp.type || 'text', placeholder: inp.placeholder || '', name: inp.name || '' });
                    }
                });

                // ── 5. Meta ──
                result.meta.bodyText = (document.body.innerText || '').slice(0, 500);

                return result;
            });
            return result || { texts: [], clickables: [], images: [], inputs: [], meta: {} };
        }

        // ── Classify page type ──
        function classifyPage(screen) {
            const options = screen.clickables.filter(c => !c.isSubmit);
            const hasInputs = screen.inputs.some(i => !['hidden', 'submit', 'button'].includes(i.type));
            const hasRange = screen.inputs.some(i => i.type === 'range');

            // Welcome (first page, few or no options)
            if (allPages.length === 0 && options.length <= 1) return 'welcome';

            // Likert/slider
            if (hasRange) return 'likert';
            if (options.length >= 4 && options.every(o =>
                /nunca|raramente|às vezes|frequente|sempre|never|rarely|sometimes|often|always|pouco|muito|nada|concordo|discordo|agree|disagree/i.test(o.text)
            )) return 'likert';

            // Statement
            if (options.length === 2 && options.every(o =>
                /concordo|discordo|sim|não|yes|no|verdade|falso|true|false/i.test(o.text)
            )) return 'statement';

            // Image select
            if (options.length >= 2 && options.filter(o => o.image).length >= options.length * 0.7) return 'image-select';

            // Email/lead capture
            if (hasInputs && screen.inputs.some(i => i.type === 'email' || /email/i.test(i.name || i.placeholder))) return 'lead';

            // Other input page
            if (hasInputs && options.length === 0) return 'input';

            // Insight/informational (no options, just text)
            if (options.length === 0) {
                const bodyText = screen.texts.map(t => t.text).join(' ');
                if (/\d+[\.\,]?\d*\s*(pessoas|users|people|%|mil|k\b)/i.test(bodyText)) return 'social-proof';
                return 'insight';
            }

            // Choice (default)
            if (options.length >= 2) return 'choice';

            return 'insight';
        }

        // ── Build page data ──
        function buildPage(screen, type) {
            const headings = screen.texts.filter(t => t.isHeading).map(t => t.text);
            const bodies = screen.texts.filter(t => !t.isHeading).map(t => t.text);
            const options = screen.clickables.filter(c => !c.isSubmit);
            const heading = headings[0] || '';
            const body = bodies.filter(t => t !== heading).join(' ').slice(0, 500);

            switch (type) {
                case 'welcome':
                    return {
                        _type: 'welcome',
                        headline: heading,
                        subheadline: bodies[0] || '',
                        cta: screen.clickables.find(c => c.isSubmit)?.text || options[0]?.text || 'Começar →',
                    };
                case 'insight':
                    return { type: 'insight', title: heading || 'Você sabia?', body: body || heading };
                case 'social-proof':
                    return { type: 'social-proof', headline: heading, subheadline: bodies[0] || '' };
                case 'lead':
                    return { _type: 'lead' };
                case 'input':
                    return { _type: 'input' };
                case 'choice':
                case 'multi-select':
                    return {
                        type,
                        text: heading || body.slice(0, 150),
                        options: options.map((o, i) => ({ text: o.text, emoji: o.emoji || '', image: o.image || '', weight: i + 1 })),
                    };
                case 'likert':
                    return {
                        type: 'likert',
                        text: heading || body.slice(0, 150),
                        options: options.map((o, i) => ({ text: o.text, value: i + 1, weight: i + 1 })),
                    };
                case 'statement':
                    return {
                        type: 'statement',
                        text: heading || body.slice(0, 150),
                        options: options.map(o => o.text),
                    };
                case 'image-select':
                    return {
                        type: 'image-select',
                        text: heading || body.slice(0, 150),
                        options: options.map((o, i) => ({ text: o.text, image: o.image || '', emoji: o.emoji || '', weight: i + 1 })),
                    };
                default:
                    return { type: 'insight', title: heading || 'Info', body };
            }
        }

        // ── Click an element and wait for page change ──
        async function clickAndWait(clickable) {
            const hashBefore = await getContentHash();

            // Pure page.evaluate click — avoids Puppeteer pg.click/pg.$$ hanging on hidden duplicates
            const method = await safeEval((ariaLabel, fullText, rect, tag) => {
                function doClick(el) {
                    el.scrollIntoView({ block: 'center', behavior: 'instant' });
                    const o = { bubbles: true, cancelable: true, view: window };
                    el.dispatchEvent(new PointerEvent('pointerdown', o));
                    el.dispatchEvent(new MouseEvent('mousedown', o));
                    el.dispatchEvent(new PointerEvent('pointerup', o));
                    el.dispatchEvent(new MouseEvent('mouseup', o));
                    el.dispatchEvent(new MouseEvent('click', o));
                    el.click();
                    return true;
                }
                // 1) aria-label
                if (ariaLabel) {
                    for (const el of document.querySelectorAll('[aria-label]')) {
                        if (el.getAttribute('aria-label') !== ariaLabel) continue;
                        const r = el.getBoundingClientRect();
                        if (r.height > 10 && r.width > 10) return doClick(el) && 'aria';
                    }
                }
                // 2) exact text
                if (fullText) {
                    for (const el of document.querySelectorAll('button,[role="button"],a,label,div,span')) {
                        const r = el.getBoundingClientRect();
                        if (r.height < 10 || r.width < 10) continue;
                        if (el.innerText && el.innerText.trim() === fullText) return doClick(el) && 'text';
                    }
                }
                // 3) coordinate
                if (rect) {
                    const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
                    if (el) return doClick(el) && 'coord';
                }
                return false;
            }, clickable.ariaLabel || '', clickable.fullText || clickable.text, clickable.rect, clickable.tag || 'button');

            console.log(`[Clone]   click=${method || 'FAIL'} url=${pg.url().slice(-30)}`);
            if (!method) return false;

            for (let w = 0; w < 10; w++) {
                await delay(500);
                try {
                    if (await getContentHash() !== hashBefore) return true;
                } catch { await delay(1500); return true; }
            }
            return false;
        }

        // ═══ MAIN SCRAPE LOOP ═══
        let welcomeData = null;
        let collectLead = false;

        for (let i = 0; i < MAX_PAGES; i++) {
            const screen = await extractScreen();
            const options = screen.clickables.filter(c => !c.isSubmit);
            const submitBtns = screen.clickables.filter(c => c.isSubmit);

            // Log
            console.log(`[Clone] Page ${i + 1}: ${options.length} options, ${submitBtns.length} submits, ${screen.texts.length} texts, ${screen.inputs.length} inputs`);
            if (options.length > 0) console.log(`[Clone]   Options: ${options.map(o => `"${o.text.slice(0, 30)}"`).join(', ')}`);

            // Detect stuck
            const hash = await getContentHash();
            if (hash === prevHash) {
                stuckCount++;
                if (stuckCount >= MAX_STUCK) {
                    console.log(`[Clone] ⛔ Stuck after ${allPages.length} pages.`);
                    break;
                }
            } else {
                stuckCount = 0;
            }
            prevHash = hash;

            // Classify
            const type = classifyPage(screen);
            console.log(`[Clone]   → type: ${type}`);

            // Build page (skip duplicates)
            const pageHash = hash;
            const isDuplicate = allPages.some(p => p._hash === pageHash);
            if (isDuplicate) {
                console.log(`[Clone]   ⚠ Duplicate page, skipping`);
            } else if (type === 'welcome') {
                welcomeData = buildPage(screen, type);
            } else if (type === 'lead') {
                collectLead = true;
            } else if (type !== 'input') {
                const pageObj = buildPage(screen, type);
                if (pageObj) { pageObj._hash = pageHash; allPages.push(pageObj); }
            }

            // ── Advance to next page ──
            let advanced = false;

            // Strategy 1: If choice page, click first option
            if (['choice', 'image-select', 'statement', 'multi-select', 'likert'].includes(type) && options.length > 0) {
                advanced = await clickAndWait(options[0]);
                // If didn't advance, maybe need to also click submit
                if (!advanced && submitBtns.length > 0) {
                    advanced = await clickAndWait(submitBtns[0]);
                }
            }

            // Strategy 2: Click submit/continue button
            if (!advanced && submitBtns.length > 0) {
                advanced = await clickAndWait(submitBtns[0]);
            }

            // Strategy 3: Click any clickable that's not already tried
            if (!advanced) {
                for (const c of screen.clickables) {
                    advanced = await clickAndWait(c);
                    if (advanced) break;
                }
            }

            // Strategy 4: Click center of main content area (for SPA quizzes like Inlead)
            if (!advanced) {
                try {
                    console.log(`[Clone]   Trying content-area click...`);
                    await pg.mouse.click(215, 450);
                    await delay(2000);
                    const h = await getContentHash();
                    if (h !== prevHash) { advanced = true; console.log(`[Clone]   ✅ Content-area click worked`); }
                } catch { }
            }

            // Strategy 5: Touch tap (mobile quizzes)
            if (!advanced) {
                try {
                    await pg.touchscreen.tap(215, 450);
                    await delay(2000);
                    const h = await getContentHash();
                    if (h !== prevHash) { advanced = true; console.log(`[Clone]   ✅ Touch tap worked`); }
                } catch { }
            }

            // Strategy 6: Keyboard (Enter, Space, ArrowRight)
            if (!advanced) {
                for (const key of ['Enter', 'Space', 'ArrowRight']) {
                    try {
                        await pg.keyboard.press(key);
                        await delay(1500);
                        const h = await getContentHash();
                        if (h !== prevHash) { advanced = true; console.log(`[Clone]   ✅ Key ${key} worked`); break; }
                    } catch { }
                }
            }

            // Strategy 7: Swipe up (some mobile quizzes use swipe navigation)
            if (!advanced) {
                try {
                    await pg.touchscreen.touchStart(215, 600);
                    await delay(100);
                    await pg.touchscreen.touchMove(215, 200);
                    await delay(100);
                    await pg.touchscreen.touchEnd();
                    await delay(2000);
                    const h = await getContentHash();
                    if (h !== prevHash) { advanced = true; console.log(`[Clone]   ✅ Swipe worked`); }
                } catch { }
            }

            if (!advanced) {
                console.log(`[Clone] ⛔ Could not advance from page ${i + 1}. Stopping.`);
                break;
            }

            await delay(500); // small extra wait after transition
        }

        await browser.close();
        browser = null;

        // ── Result ──
        const quizResult = {
            quizName: welcomeData?.headline || 'Quiz Clonado',
            niche: 'outro',
            primaryColor: '#2563eb',
            welcome: welcomeData || { headline: 'Quiz Clonado', subheadline: '', cta: 'Começar →' },
            pages: allPages,
            results: [
                { id: 'r1', name: 'Resultado A', description: 'Seu perfil indica...', cta: 'Ver recomendação →', minPct: 0, maxPct: 50 },
                { id: 'r2', name: 'Resultado B', description: 'Seu perfil indica...', cta: 'Ver recomendação →', minPct: 51, maxPct: 100 },
            ],
            collectLead,
        };

        console.log(`[Clone] ✅ Done! ${allPages.length} pages scraped from ${url}`);
        res.json(quizResult);

    } catch (err) {
        console.error('[Clone] ❌ Error:', err.message);
        if (browser) try { await browser.close(); } catch { }
        res.status(500).json({ error: err.message || 'Erro ao clonar quiz' });
    }
});

// ── Clone + Optimize (AI-powered) ──
app.post('/api/clone-optimize', async (req, res) => {
    const { url, niche = 'outro', mode = 'clone_only', productDescription = '' } = req.body;
    if (!url) return res.status(400).json({ error: 'URL obrigatória' });

    const startTime = Date.now();
    console.log(`[CloneOptimize] Starting: url=${url} niche=${niche} mode=${mode}`);

    try {
        // Step 1: Scrape via internal fetch to existing clone endpoint
        const cloneRes = await fetch(`http://localhost:${PORT}/api/clone-quiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });

        if (!cloneRes.ok) {
            const err = await cloneRes.json().catch(() => ({}));
            return res.status(500).json({ error: err.error || 'Falha na clonagem', partial: null });
        }

        const extracted = await cloneRes.json();
        console.log(`[CloneOptimize] Scraped ${extracted.pages?.length || 0} pages in ${Date.now() - startTime}ms`);

        // Mode: clone_only → return as-is
        if (mode === 'clone_only') {
            extracted.metadata = { ...(extracted.metadata || {}), cloneSource: url, optimizationMode: mode };
            return res.json(extracted);
        }

        // Mode: clone_optimize or clone_adapt → send to AI
        if (!OPENAI_KEY) {
            console.warn('[CloneOptimize] No OpenAI key, returning unoptimized');
            extracted.metadata = { ...(extracted.metadata || {}), cloneSource: url, optimizationMode: 'clone_only', warning: 'OpenAI não configurada' };
            return res.json(extracted);
        }

        // Build the AI prompt
        const stepsJson = JSON.stringify(extracted.pages?.map((p, i) => ({
            step: i + 1,
            question: p.text || p.title || p.headline || '',
            type: p.type || 'choice',
            options: (p.options || []).map(o => typeof o === 'string' ? o : o.text || ''),
        })) || [], null, 2);

        const nicheDescriptions = {
            emagrecimento: 'perda de peso, dieta, exercícios, corpo ideal',
            'saúde intestinal': 'intestino, digestão, microbioma, desconforto abdominal',
            relacionamento: 'amor, parceiro, conexão emocional, autoestima afetiva',
            finanças: 'dinheiro, investimentos, dívidas, liberdade financeira',
            produtividade: 'foco, organização, tempo, performance, energia',
            outro: 'genérico',
        };

        const nicheContext = nicheDescriptions[niche] || nicheDescriptions.outro;

        let systemPrompt = `Você é um especialista em funis de conversão e quizzes low ticket.
Nicho: ${niche} (${nicheContext})
Tom: empático, específico, urgente mas não agressivo.`;

        let userPrompt = `Analise este quiz extraído e otimize-o para máxima conversão.

ESTRUTURA ATUAL:
${stepsJson}

REGRAS:
1. Manter EXATAMENTE a mesma quantidade de etapas (${extracted.pages?.length || 0})
2. Manter os mesmos tipos de interação
3. Reescrever todas as perguntas para:
   - Maior identificação pessoal
   - Maior dor e urgência
   - Maior clareza
   - Maior curiosidade
   - Maior comprometimento (micro-compromissos progressivos)
4. Substituir perguntas genéricas por específicas:
   Em vez de "Você sofre com isso?" → "Quantas vezes por semana você sente X mesmo tentando Y?"
5. Vocabulário adaptado ao nicho: ${niche}
6. Opções devem criar escala de comprometimento

RESULTADO OTIMIZADO:
- Parecer diagnóstico personalizado
- Usar "com base nas suas respostas"
- Incluir recomendação implícita
- Promessa específica
- Autoridade implícita
- Transição suave para oferta`;

        if (mode === 'clone_adapt' && productDescription) {
            userPrompt += `\n\nPRODUTO DO USUÁRIO:\n${productDescription}\n\nAdapte TODAS as perguntas e o resultado para direcionar ao produto acima. A linguagem deve alinhar com os benefícios do produto.`;
        }

        userPrompt += `\n\nRetorne APENAS JSON válido:
{
  "optimized_steps": [
    {
      "question": "pergunta otimizada",
      "type": "tipo original (choice/image-select/likert/etc)",
      "options": ["opção 1", "opção 2", ...],
      "psychological_role": "papel psicológico desta etapa"
    }
  ],
  "optimized_result": {
    "headline": "título do resultado",
    "body": "corpo do resultado com 'com base nas suas respostas'",
    "cta": "texto do botão CTA"
  }
}`;

        console.log('[CloneOptimize] Sending to AI...');
        const aiResult = await callOpenAI(userPrompt, {
            system: systemPrompt,
            temperature: 0.7,
            maxTokens: 4000,
        });

        if (!aiResult) {
            console.warn('[CloneOptimize] AI returned null, using original');
            extracted.metadata = { ...(extracted.metadata || {}), cloneSource: url, optimizationMode: mode, warning: 'AI falhou, usando original' };
            return res.json(extracted);
        }

        // Parse AI response
        let optimized;
        try {
            const clean = aiResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            optimized = JSON.parse(clean);
        } catch (parseErr) {
            console.error('[CloneOptimize] Failed to parse AI JSON:', parseErr.message);
            extracted.metadata = { ...(extracted.metadata || {}), cloneSource: url, optimizationMode: mode, warning: 'AI retornou JSON inválido' };
            return res.json(extracted);
        }

        // Merge optimized into extracted pages
        if (optimized.optimized_steps && Array.isArray(optimized.optimized_steps)) {
            const pages = extracted.pages || [];
            for (let i = 0; i < Math.min(optimized.optimized_steps.length, pages.length); i++) {
                const opt = optimized.optimized_steps[i];
                if (opt.question) {
                    pages[i].text = opt.question;
                    pages[i].title = opt.question;
                }
                if (opt.options && Array.isArray(opt.options) && pages[i].options) {
                    // Merge option texts while keeping original structure
                    for (let j = 0; j < Math.min(opt.options.length, pages[i].options.length); j++) {
                        const optText = typeof opt.options[j] === 'string' ? opt.options[j] : opt.options[j]?.text || '';
                        if (typeof pages[i].options[j] === 'object') {
                            pages[i].options[j].text = optText;
                        } else {
                            pages[i].options[j] = optText;
                        }
                    }
                }
                if (opt.psychological_role) {
                    pages[i]._psychologicalRole = opt.psychological_role;
                }
            }
        }

        // Merge optimized result
        if (optimized.optimized_result) {
            extracted.results = [
                {
                    id: 'r1',
                    name: optimized.optimized_result.headline || 'Seu Resultado',
                    description: optimized.optimized_result.body || '',
                    cta: optimized.optimized_result.cta || 'Ver recomendação →',
                    minPct: 0, maxPct: 50,
                },
                {
                    id: 'r2',
                    name: (optimized.optimized_result.headline || 'Resultado') + ' Premium',
                    description: (optimized.optimized_result.body || '').replace('suas respostas', 'seu perfil avançado'),
                    cta: optimized.optimized_result.cta || 'Acessar agora →',
                    minPct: 51, maxPct: 100,
                },
            ];
        }

        extracted.metadata = {
            ...(extracted.metadata || {}),
            cloneSource: url,
            optimizationMode: mode,
            niche,
            optimizedAt: Date.now(),
            executionTimeMs: Date.now() - startTime,
        };

        console.log(`[CloneOptimize] ✅ Done in ${Date.now() - startTime}ms`);
        res.json(extracted);

    } catch (err) {
        console.error('[CloneOptimize] ❌ Error:', err.message);
        res.status(500).json({ error: err.message || 'Erro ao otimizar quiz', partial: null });
    }
});

// ── Serve built frontend (production) ──
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    // SPA fallback — all non-API routes serve index.html
    app.get(/.*/, (req, res) => {
        if (!req.path.startsWith('/api/') && !req.path.startsWith('/uploads/')) {
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
    console.log('📦 Serving frontend from dist/');
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Quiz API rodando em http://localhost:${PORT}`);
    console.log(`📁 Banco de dados: ${path.join(dbDir, 'quizzes.db')}`);
    console.log(`🖼️  Uploads: ${uploadsDir}`);
    console.log(`🤖 OpenAI API: ${OPENAI_KEY ? '✅ Configurada' : '❌ Não configurada'}`);
});
