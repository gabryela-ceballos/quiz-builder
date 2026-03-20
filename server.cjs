const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const compression = require('compression');
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
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'starter',
    status TEXT DEFAULT 'active',
    quiz_count INTEGER DEFAULT 0,
    ai_count INTEGER DEFAULT 0,
    clone_count INTEGER DEFAULT 0,
    period_start INTEGER DEFAULT (strftime('%s','now') * 1000),
    started_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    expires_at INTEGER
  );
`);

// Add user_id column to quizzes if not present
try {
    db.exec(`ALTER TABLE quizzes ADD COLUMN user_id INTEGER`);
} catch (e) { /* column already exists */ }

// ── Plan limits ──
// 🧪 TEST MODE — set to false when ready to enforce real limits
const TEST_MODE = true;

const PLAN_LIMITS = {
    starter: { quiz: 3, ai: 1, clone: 0, price: 29.90, name: 'Starter' },
    pro:     { quiz: 8, ai: 3, clone: 1, price: 49.90, name: 'Pro' },
    business:{ quiz: 15, ai: 8, clone: 3, price: 99.90, name: 'Business' },
};

function getOrCreateSub(userId) {
    let sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
    if (!sub) {
        db.prepare('INSERT INTO subscriptions (user_id, plan) VALUES (?, ?)').run(userId, 'starter');
        sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
    }
    // Auto-reset counters if period expired (monthly)
    const now = Date.now();
    const elapsed = now - (sub.period_start || 0);
    const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
    if (elapsed > ONE_MONTH) {
        db.prepare('UPDATE subscriptions SET quiz_count = 0, ai_count = 0, clone_count = 0, period_start = ? WHERE user_id = ?').run(now, userId);
        sub.quiz_count = 0; sub.ai_count = 0; sub.clone_count = 0; sub.period_start = now;
    }
    return sub;
}


// ── Server hostname (for CNAME instructions) ──
// Priority: explicit SERVER_HOSTNAME > Railway public domain > localhost fallback
const SERVER_HOSTNAME = process.env.SERVER_HOSTNAME
    || process.env.RAILWAY_PUBLIC_DOMAIN
    || `localhost:${PORT}`;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@test.com').toLowerCase().trim();

// ── Middleware ──
app.use(cors());
app.use(compression({
    filter: (req, res) => {
        // Don't compress SSE streams — compression buffers them and breaks real-time delivery
        if (req.headers.accept === 'text/event-stream' || req.path === '/api/clone-stream') return false;
        return compression.filter(req, res);
    }
}));
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

app.put('/api/auth/profile', requireAuth, (req, res) => {
    const { name } = req.body;
    if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), req.user.id);
    res.json({ ok: true });
});

app.put('/api/auth/password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Senhas obrigatórias' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) return res.status(401).json({ error: 'Senha atual incorreta' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.user.id);
    res.json({ ok: true });
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

// ── Subscription API ──
app.get('/api/plans', (req, res) => {
    res.json(PLAN_LIMITS);
});

app.get('/api/subscription', requireAuth, (req, res) => {
    if (req.user.role === 'admin') {
        return res.json({ plan: 'business', status: 'active', quiz_count: 0, ai_count: 0, clone_count: 0, limits: { quiz: 999, ai: 999, clone: 999 }, isAdmin: true });
    }
    const sub = getOrCreateSub(req.user.id);
    const limits = PLAN_LIMITS[sub.plan] || PLAN_LIMITS.starter;
    res.json({
        plan: sub.plan,
        status: sub.status,
        quiz_count: sub.quiz_count,
        ai_count: sub.ai_count,
        clone_count: sub.clone_count,
        limits: { quiz: limits.quiz, ai: limits.ai, clone: limits.clone },
        period_start: sub.period_start,
        started_at: sub.started_at,
        isAdmin: false,
    });
});

app.post('/api/subscription/check', requireAuth, (req, res) => {
    const { action } = req.body; // 'quiz' | 'ai' | 'clone'
    if (!action) return res.status(400).json({ error: 'action required' });

    if (req.user.role === 'admin' || TEST_MODE) return res.json({ allowed: true, remaining: 999 });

    const sub = getOrCreateSub(req.user.id);
    const limits = PLAN_LIMITS[sub.plan] || PLAN_LIMITS.starter;

    const countKey = action === 'quiz' ? 'quiz_count' : action === 'ai' ? 'ai_count' : 'clone_count';
    const limitKey = action === 'quiz' ? 'quiz' : action === 'ai' ? 'ai' : 'clone';
    const current = sub[countKey] || 0;
    const limit = limits[limitKey];
    const allowed = current < limit;
    const remaining = Math.max(0, limit - current);

    res.json({ allowed, remaining, current, limit, plan: sub.plan, planName: limits.name });
});

app.post('/api/subscription/consume', requireAuth, (req, res) => {
    const { action } = req.body; // 'quiz' | 'ai' | 'clone'
    if (!action) return res.status(400).json({ error: 'action required' });

    if (req.user.role === 'admin' || TEST_MODE) return res.json({ ok: true, remaining: 999 });

    const sub = getOrCreateSub(req.user.id);
    const limits = PLAN_LIMITS[sub.plan] || PLAN_LIMITS.starter;
    const col = action === 'quiz' ? 'quiz_count' : action === 'ai' ? 'ai_count' : 'clone_count';
    const limitKey = action === 'quiz' ? 'quiz' : action === 'ai' ? 'ai' : 'clone';
    const current = sub[col] || 0;

    if (current >= limits[limitKey]) {
        return res.status(403).json({ error: 'Limite do plano atingido', plan: sub.plan, limit: limits[limitKey] });
    }

    db.prepare(`UPDATE subscriptions SET ${col} = ${col} + 1 WHERE user_id = ?`).run(req.user.id);
    res.json({ ok: true, remaining: limits[limitKey] - current - 1 });
});

app.put('/api/admin/subscription/:userId', requireAdmin, (req, res) => {
    const { plan } = req.body;
    if (!plan || !PLAN_LIMITS[plan]) return res.status(400).json({ error: 'Plano inválido' });
    const sub = getOrCreateSub(parseInt(req.params.userId));
    db.prepare('UPDATE subscriptions SET plan = ? WHERE user_id = ?').run(plan, parseInt(req.params.userId));
    res.json({ ok: true, plan });
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

// ── Translate texts batch ──
app.post('/api/translate', async (req, res) => {
    try {
        const { texts, targetLang } = req.body;
        if (!texts || !Array.isArray(texts) || texts.length === 0) {
            return res.status(400).json({ error: 'texts array required' });
        }
        if (!targetLang) {
            return res.status(400).json({ error: 'targetLang required' });
        }
        
        const langNames = {
            'pt': 'Portuguese (Brazil)', 'en': 'English', 'es': 'Spanish',
            'fr': 'French', 'de': 'German', 'it': 'Italian',
        };
        const langName = langNames[targetLang] || targetLang;
        
        const numberedTexts = texts.map((t, i) => `[${i}] ${t}`).join('\n');
        
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'system',
                    content: `You are a professional translator. Translate each numbered text to ${langName}. Keep the numbering format [0], [1], etc. Do NOT translate brand names, URLs, or email addresses. Maintain formatting (line breaks, uppercase style). Return ONLY the numbered translations, nothing else.`
                }, {
                    role: 'user',
                    content: `Translate these texts to ${langName}:\n\n${numberedTexts}`
                }],
                temperature: 0.3,
                max_tokens: 4000,
            })
        });
        
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        
        // Parse numbered translations
        const translated = [];
        for (let i = 0; i < texts.length; i++) {
            const regex = new RegExp(`\\[${i}\\]\\s*(.+?)(?=\\n\\[\\d+\\]|$)`, 's');
            const match = content.match(regex);
            translated.push(match ? match[1].trim() : texts[i]);
        }
        
        res.json({ translated });
    } catch (err) {
        console.error('[Translate] Error:', err);
        res.status(500).json({ error: 'Translation failed' });
    }
});

// ── Clone from Screenshots (GPT-4o Vision) ──

app.post('/api/clone-screenshots', upload.array('screenshots', 30), async (req, res) => {
    if (!OPENAI_KEY) return res.status(400).json({ error: 'VITE_OPENAI_API_KEY não configurada no .env' });
    const files = req.files;
    if (!files || files.length === 0) return res.status(400).json({ error: 'Nenhuma imagem enviada' });

    console.log(`[CloneScreenshots] Processing ${files.length} screenshots...`);

    try {
        // Process screenshots in parallel batches of 5 for speed
        const BATCH_SIZE = 5;
        const allResults = new Array(files.length);

        async function processImage(i) {
            console.log(`[CloneScreenshots] Analyzing image ${i + 1}/${files.length}: ${files[i].originalname}`);
            const imageBuffer = fs.readFileSync(files[i].path);
            const base64 = imageBuffer.toString('base64');
            const mimeType = files[i].mimetype || 'image/png';

            try {
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
                    return { type: 'insight', text: `(Erro ao analisar screenshot ${i + 1})`, options: [], _error: true };
                }

                const visionData = await visionRes.json();
                const content = visionData.choices?.[0]?.message?.content || '';
                let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                if (jsonMatch) cleaned = jsonMatch[0];
                const page = JSON.parse(cleaned);
                console.log(`[CloneScreenshots] ✅ Image ${i + 1}: type=${page.type}, text="${(page.text || '').slice(0, 40)}..."`);
                return page;
            } catch (e) {
                console.error(`[CloneScreenshots] Error for image ${i + 1}:`, e.message);
                return { type: 'insight', text: `(Erro ao processar screenshot ${i + 1})`, options: [], _error: true };
            } finally {
                try { fs.unlinkSync(files[i].path); } catch { }
            }
        }

        // Process in parallel batches
        for (let batch = 0; batch < files.length; batch += BATCH_SIZE) {
            const batchIndices = [];
            for (let i = batch; i < Math.min(batch + BATCH_SIZE, files.length); i++) {
                batchIndices.push(i);
            }
            console.log(`[CloneScreenshots] Processing batch ${Math.floor(batch / BATCH_SIZE) + 1} (${batchIndices.length} images)...`);
            const batchResults = await Promise.all(batchIndices.map(i => processImage(i)));
            batchIndices.forEach((idx, j) => { allResults[idx] = batchResults[j]; });
        }

        const pages = allResults;

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
    const { productName, productDescription, niche, questionCount = 10, useConditionals = false, customInstructions = '', companyName = '', language = 'pt' } = req.body;
    const langMap = { pt: 'Português Brasileiro', en: 'English', es: 'Español', fr: 'Français', it: 'Italiano', de: 'Deutsch', nl: 'Nederlands', ja: '日本語' };
    const langName = langMap[language] || 'Português Brasileiro';
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
Tudo em ${langName}.`, { temperature: 0.5, maxTokens: 500 });
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
- IMPORTANTE: TODO o conteúdo DEVE ser escrito em ${langName}. Perguntas, opções, insights, resultados, botões — TUDO em ${langName}.
- Retorne SOMENTE o JSON.
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
            system: `Você é um especialista em quiz funnels de alta conversão.
Você DEVE criar todo o conteúdo do quiz em ${langName}.
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

        // Language-aware translations for hardcoded steps
        const translations = {
            pt: { sex: 'Qual é o seu sexo?', female: 'Feminino', male: 'Masculino', preferNot: 'Prefiro não dizer', age: 'Qual é a sua faixa de idade?', years: 'anos', capture: 'Captura de E-mail', almostThere: 'Quase lá!', fillToSee: 'Preencha para ver seu resultado personalizado', seeResult: 'Ver meu resultado →', result: 'Resultado', diagnosis: 'Seu Diagnóstico Personalizado', fallbackCta: '🔥 Quero minha solução →', step: 'Etapa' },
            en: { sex: 'What is your gender?', female: 'Female', male: 'Male', preferNot: 'Prefer not to say', age: 'What is your age range?', years: 'years', capture: 'Email Capture', almostThere: 'Almost there!', fillToSee: 'Fill in to see your personalized result', seeResult: 'See my result →', result: 'Result', diagnosis: 'Your Personalized Diagnosis', fallbackCta: '🔥 I want my solution →', step: 'Step' },
            es: { sex: '¿Cuál es tu sexo?', female: 'Femenino', male: 'Masculino', preferNot: 'Prefiero no decir', age: '¿Cuál es tu rango de edad?', years: 'años', capture: 'Captura de Email', almostThere: '¡Ya casi!', fillToSee: 'Completa para ver tu resultado personalizado', seeResult: 'Ver mi resultado →', result: 'Resultado', diagnosis: 'Tu Diagnóstico Personalizado', fallbackCta: '🔥 Quiero mi solución →', step: 'Paso' },
            fr: { sex: 'Quel est votre sexe ?', female: 'Féminin', male: 'Masculin', preferNot: 'Je préfère ne pas dire', age: 'Quelle est votre tranche d\'âge ?', years: 'ans', capture: 'Capture d\'email', almostThere: 'Presque fini !', fillToSee: 'Remplissez pour voir votre résultat personnalisé', seeResult: 'Voir mon résultat →', result: 'Résultat', diagnosis: 'Votre Diagnostic Personnalisé', fallbackCta: '🔥 Je veux ma solution →', step: 'Étape' },
            it: { sex: 'Qual è il tuo sesso?', female: 'Femminile', male: 'Maschile', preferNot: 'Preferisco non dire', age: 'Qual è la tua fascia d\'età?', years: 'anni', capture: 'Cattura Email', almostThere: 'Quasi fatto!', fillToSee: 'Compila per vedere il tuo risultato personalizzato', seeResult: 'Vedi il mio risultato →', result: 'Risultato', diagnosis: 'La Tua Diagnosi Personalizzata', fallbackCta: '🔥 Voglio la mia soluzione →', step: 'Fase' },
            de: { sex: 'Was ist Ihr Geschlecht?', female: 'Weiblich', male: 'Männlich', preferNot: 'Möchte ich nicht sagen', age: 'Wie alt sind Sie?', years: 'Jahre', capture: 'E-Mail erfassen', almostThere: 'Fast geschafft!', fillToSee: 'Ausfüllen, um Ihr personalisiertes Ergebnis zu sehen', seeResult: 'Mein Ergebnis sehen →', result: 'Ergebnis', diagnosis: 'Ihre Personalisierte Diagnose', fallbackCta: '🔥 Ich will meine Lösung →', step: 'Schritt' },
            nl: { sex: 'Wat is uw geslacht?', female: 'Vrouwelijk', male: 'Mannelijk', preferNot: 'Zeg ik liever niet', age: 'Wat is uw leeftijdscategorie?', years: 'jaar', capture: 'E-mail vastleggen', almostThere: 'Bijna klaar!', fillToSee: 'Vul in om uw gepersonaliseerd resultaat te zien', seeResult: 'Mijn resultaat bekijken →', result: 'Resultaat', diagnosis: 'Uw Gepersonaliseerde Diagnose', fallbackCta: '🔥 Ik wil mijn oplossing →', step: 'Stap' },
            ja: { sex: 'あなたの性別は？', female: '女性', male: '男性', preferNot: '回答しない', age: 'あなたの年齢層は？', years: '歳', capture: 'メール登録', almostThere: 'もう少し！', fillToSee: '入力してパーソナライズされた結果を見る', seeResult: '結果を見る →', result: '結果', diagnosis: 'あなたのパーソナル診断', fallbackCta: '🔥 解決策が欲しい →', step: 'ステップ' },
        };
        const t = translations[language] || translations.pt;

        // Add demographic steps (sex + age) right after welcome
        steps.push({
            id: `stp_sex_${Date.now()}`,
            name: t.sex,
            blocks: [{
                type: 'choice',
                text: t.sex,
                options: [
                    { text: t.female, emoji: '👩', weight: 1 },
                    { text: t.male, emoji: '👨', weight: 1 },
                    { text: t.preferNot, emoji: '🤝', weight: 1 },
                ],
                optionLayout: 'list',
            }],
        });
        steps.push({
            id: `stp_age_${Date.now() + 1}`,
            name: t.age,
            blocks: [{
                type: 'choice',
                text: t.age,
                options: [
                    { text: `18-24 ${t.years}`, emoji: '🧑', weight: 1 },
                    { text: `25-34 ${t.years}`, emoji: '💼', weight: 2 },
                    { text: `35-44 ${t.years}`, emoji: '🏠', weight: 3 },
                    { text: `45-54 ${t.years}`, emoji: '✨', weight: 4 },
                    { text: `55+ ${t.years}`, emoji: '🌟', weight: 5 },
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
                    name: block.text || block.title || block.headline || `${t.step} ${i + 1}`,
                    blocks: [block],
                };
                if (stepGoToName) stepObj._goToStepName = stepGoToName;
                steps.push(stepObj);
            });
        }

        // Always add email capture step BEFORE results
        steps.push({
            id: `stp_capture_${Date.now()}`,
            name: t.capture,
            blocks: [{
                type: 'capture',
                title: t.almostThere,
                subtitle: t.fillToSee,
                fields: ['name', 'email'],
                buttonText: t.seeResult,
                required: true,
            }],
        });

        // Add result step at the very end
        const resultData = quizContent.results || [];
        steps.push({
            id: `stp_result_${Date.now()}`,
            name: t.result,
            blocks: [{
                type: 'result',
                productName: productName,
                salesUrl: '',
                cta: resultData[0]?.cta || t.fallbackCta,
                productContext: productDescription || '',
                title: t.diagnosis,
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
    const targetLang = req.query.lang || null; // e.g. 'pt', 'en', 'es', 'fr', 'de'
    if (!url) return res.status(400).json({ error: 'URL obrigatória' });

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Increase timeout for long-running clone operations (5 minutes)
    req.setTimeout(300000);
    res.setTimeout(300000);

    // Generate a unique session ID for asset storage
    const cloneSessionId = 'clone_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    const send = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    // Keep connection alive with periodic pings every 15 seconds
    const keepAlive = setInterval(() => {
        try { res.write(': keepalive\n\n'); } catch {}
    }, 15000);

    let browser;
    try {
        send('progress', { stage: 'connecting', msg: '🌐 Conectando ao servidor...', pct: 5 });

        const puppeteer = require('puppeteer');
        const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || null;
        browser = await puppeteer.launch({
            headless: 'new',
            ...(execPath ? { executablePath: execPath } : {}),
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--disable-gpu'],
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

        // ── Extract theme CSS variables on first load ──
        const quizTheme = await pg.evaluate(() => {
            const root = document.documentElement;
            const style = getComputedStyle(root);
            const getVar = name => style.getPropertyValue(name).trim();
            // Try common CSS variable patterns
            const themeColor = getVar('--theme-color') || getVar('--primary') || getVar('--accent') || '';
            const bgColor = getVar('--theme-background-color') || getVar('--bg') || '';
            const titleColor = getVar('--theme-title-color') || getVar('--title-color') || '';
            const contentColor = getVar('--theme-content-color') || getVar('--text-color') || '';
            const contentFont = getVar('--theme-content-font') || getVar('--font-family') || '';
            const rounded = getVar('--theme-rounded') || '';
            const elSize = getVar('--theme-element-size') || '';
            // Detect CTA button color
            let ctaColor = '';
            const ctaBtns = document.querySelectorAll('button, [role="button"], .btn, a.btn');
            for (const btn of ctaBtns) {
                const s = getComputedStyle(btn);
                const bg = s.backgroundColor;
                if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== 'rgb(255, 255, 255)') {
                    ctaColor = bg; break;
                }
            }
            return { themeColor, bgColor, titleColor, contentColor, contentFont, rounded, elSize, ctaColor };
        });
        console.log('[Clone-Stream] Theme:', JSON.stringify(quizTheme));

        // Convert rgb to hex helper
        const rgb2hex = (rgb) => {
            if (!rgb) return '';
            const m = rgb.match(/\d+/g);
            if (m && m.length >= 3) return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
            if (rgb.startsWith('#')) return rgb;
            return '';
        };

        // ── Reuse the same scrape logic as /api/clone-quiz ──
        const MAX_PAGES = 40;
        const MAX_STUCK = 5;
        let allPages = [], welcomeData = null, collectLead = false;
        let prevHash = '', stuckCount = 0, sameTitleCount = 0, prevTitle = '';
        const pageScreenshots = []; // Store screenshots for AI analysis




        const extractScreen = async () => pg.evaluate(() => {
            // Extract structured text with hierarchy
            const titleEls = [...document.querySelectorAll('h1,h2,h3')].filter(el => {
                const r = el.getBoundingClientRect();
                return r.height > 0 && r.width > 0 && r.top < 800;
            });
            const mainTitle = titleEls.map(el => (el.innerText || '').trim()).find(t => t.length > 3 && t.length < 300) || '';

            // Subtitle/body text (p, span with significant text)
            const bodyEls = [...document.querySelectorAll('p, span, div')].filter(el => {
                const r = el.getBoundingClientRect();
                if (r.height <= 0 || r.width <= 0 || r.top > 1000) return false;
                const t = (el.innerText || '').trim();
                if (t.length < 5 || t.length > 500) return false;
                // Skip if it's just a container of other elements
                if (el.children.length > 3) return false;
                // Skip if text is same as main title
                if (t === mainTitle) return false;
                return true;
            });
            const subtitleTexts = [];
            const seenText = new Set();
            seenText.add(mainTitle);
            for (const el of bodyEls) {
                const t = (el.innerText || '').trim();
                if (seenText.has(t)) continue;
                // Check if this text is a substring of another already-added text
                let isSubstring = false;
                for (const existing of seenText) {
                    if (existing.includes(t) || t.includes(existing)) { isSubstring = true; break; }
                }
                if (isSubstring) continue;
                seenText.add(t);
                subtitleTexts.push(t);
                if (subtitleTexts.length >= 3) break;
            }

            const texts = [mainTitle, ...subtitleTexts].filter(Boolean);

            const clickables = [];
            const seen = new Set();
            for (const el of document.querySelectorAll('button, a, [role="button"], [onclick], label, div, span, li')) {
                const r = el.getBoundingClientRect();
                if (r.height <= 5 || r.width <= 5 || r.height > 200) continue;
                const text = (el.innerText || '').trim();
                if (!text || text.length === 0 || text.length > 300) continue;
                const isNav = /voltar|back|prev|skip|pular|anterior|logo|cookie|privacy|privacidade|termos|fechar|close|sign.?up|sign.?in|log.?in|register|pricing|features|blog|about|contact|home|faq|pol[ií]tica|inlead|central de an[úu]ncios|criado via|© \d{4}|todas as suas respostas|t[eé]rminos|condiciones|suscripci[oó]n|derechos reservados|cookies/i.test(text);
                if (isNav) continue;
                const isSubmitText = /^(próximo|next|continuar|continue|começar|start|enviar|submit|avançar|advance|ok|prosseguir|ver resultado|iniciar|vamos lá|quero|bora|let'?s go|take the quiz|get started|take quiz|start quiz|toque aqui|clique para|clique aqui|comece agora|clique e|saiba mais|ver mais|siguiente|comenzar|empezar|aceptar|confirmar|prueba|test|gratis|gratuito)$/i.test(text.replace(/[→►▶\s]/g, '').trim()) || /continuar|começar|comece|start|toque|siguiente|comenzar|continuer|weiter|avançar|próximo|continue|submit|enviar|prueba|test/i.test(text);
                const style = getComputedStyle(el);
                const isPointer = style.cursor === 'pointer';
                const tag = el.tagName.toLowerCase();
                const isClickable = tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button' || isPointer;
                const isSubmit = isSubmitText;
                const isDisabled = el.disabled || el.classList.contains('cursor-not-allowed') || el.getAttribute('aria-disabled') === 'true' || style.cursor === 'not-allowed';
                if (text.length > 2 && text.length < 200 && !seen.has(text) && (isClickable || isSubmit)) {
                    seen.add(text);
                    clickables.push({ text, isSubmit, isDisabled, tag, x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, bgColor: style.backgroundColor, color: style.color, borderRadius: style.borderRadius });
                }
            }

            const inputs = [...document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),textarea,select')].filter(el => {
                const r = el.getBoundingClientRect(); return r.height > 0 && r.width > 0;
            }).map(el => ({ type: el.type || el.tagName.toLowerCase(), name: el.name || el.placeholder || '', label: el.labels?.[0]?.innerText || '' }));

            // Detect checkboxes and radio buttons (including visual ones)
            const checkboxes = [...document.querySelectorAll('input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"], [data-state], [aria-checked]')].filter(el => {
                const r = el.getBoundingClientRect(); return r.height > 0 && r.width > 0 && r.top < 1200;
            });
            // Also detect visual checkboxes (□, ☐, ☑ characters or styled checkbox-like elements)
            const visualCheckboxes = [...document.querySelectorAll('[class*="check"], [class*="toggle"], [class*="tick"]')].filter(el => {
                const r = el.getBoundingClientRect(); return r.height > 0 && r.width > 0 && r.top < 1200;
            });
            // Count options that have checkbox-like UI (empty squares, circles with borders)
            const optionsWithCheckVisual = clickables.filter(c => {
                const el = document.elementFromPoint(c.x, c.y);
                if (!el) return false;
                const container = el.closest('[class*="option"], [class*="choice"], [class*="answer"]') || el;
                const text = container.textContent || '';
                // Check for visual checkbox characters
                if (/[□☐☑✓✔✗✘○●◯◉]/u.test(text)) return true;
                // Check for small bordered elements that look like checkboxes
                const checkEl = container.querySelector('[style*="border"][style*="radius"]') || 
                    container.querySelector('[class*="check"], [class*="box"], [class*="toggle"]');
                return !!checkEl;
            });
            const hasCheckboxes = checkboxes.length > 1 || visualCheckboxes.length > 1 || optionsWithCheckVisual.length > 1 ||
                // Also detect multi-select by disabled submit button: if there are multiple options AND a disabled submit button, it's multi-select
                (clickables.filter(c => !c.isSubmit && !c.isDisabled).length >= 3 && clickables.some(c => c.isDisabled && c.isSubmit));

            // Detect videos
            const videos = [...document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="wistia"]')].filter(el => {
                const r = el.getBoundingClientRect(); return r.height > 20 && r.width > 20;
            }).map(el => ({ tag: el.tagName.toLowerCase(), src: el.src || el.querySelector('source')?.src || '', w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }));

            // Detect animations (CSS animations, transitions, loading states)
            // Only detect significant loading/progress animations (not micro-animations or hover effects)
            const hasAnimations = (() => {
                const allEls = document.querySelectorAll('*');
                for (const el of allEls) {
                    try {
                        const style = getComputedStyle(el);
                        if (style.animationName && style.animationName !== 'none') {
                            const dur = parseFloat(style.animationDuration) || 0;
                            const r = el.getBoundingClientRect();
                            // Only count as animation if: duration > 2s AND element is large (likely loading bar)
                            if (dur > 2 && r.width > 100 && r.height > 10) return true;
                        }
                    } catch {}
                }
                return false;
            })();

            // Detect loading/progress animations
            // Only mark as loading if there's an actual loading spinner/indicator AND very little text content
            let hasLoading = false;
            const loadingEl = document.querySelector('.loader, .spin, [class*="spinner"], [class*="loading"]');
            if (loadingEl) {
                const r = loadingEl.getBoundingClientRect();
                // Must be visible and not tiny
                if (r.height > 15 && r.width > 15) hasLoading = true;
            }
            // Also check for loading text patterns
            const allBodyText = (document.body.innerText || '').toLowerCase();
            if (/calculando|analisando|processando|carregando|loading|analyzing/i.test(allBodyText) && allBodyText.length < 200) {
                hasLoading = true;
            }

            const images = [...document.querySelectorAll('img')].filter(el => {
                const r = el.getBoundingClientRect(); return r.height > 20 && r.width > 20 && r.top < 1200;
            }).map(el => ({ src: el.src, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, top: Math.round(el.getBoundingClientRect().top) })).filter(s => s.src && !s.src.includes('data:'));

            // Separate logo (small image at top) from hero images (large images)
            const logoImg = images.find(img => img.top < 200 && img.h < 100 && img.w < 200);
            const heroImg = images.find(img => img.w > 200 && img.h > 100);

            // Extract visual/CSS properties
            const body = document.body;
            const bodyStyle = getComputedStyle(body);
            const mainEl = document.querySelector('main, [role="main"], .main-content, #app, #root, #__next, .quiz-container, [class*="quiz"], [class*="funnel"]') || body;
            const mainStyle = getComputedStyle(mainEl);
            const bgColor = mainStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ? mainStyle.backgroundColor : bodyStyle.backgroundColor;

            // Find CTA button color
            let primaryColor = '';
            const btns = document.querySelectorAll('button, [role="button"], a.btn, .cta');
            for (const btn of btns) {
                const s = getComputedStyle(btn);
                if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent' && s.backgroundColor !== 'rgb(255, 255, 255)') {
                    primaryColor = s.backgroundColor;
                    break;
                }
            }

            // Extract progress bar info
            const progressEls = document.querySelectorAll('[class*="progress"], [role="progressbar"], .bar');
            const hasProgress = progressEls.length > 0;

            return {
                mainTitle,
                subtitle: subtitleTexts[0] || '',
                bodyTexts: subtitleTexts.slice(1),
                texts,
                clickables,
                inputs,
                images,
                videos,
                hasCheckboxes,
                hasAnimations,
                hasLoading,
                logoUrl: logoImg?.src || '',
                heroImageUrl: heroImg?.src || '',
                visual: { bgColor, primaryColor, hasProgress }
            };
        });

        const classifyPage = (screen) => {
            const { clickables, inputs, texts, mainTitle, hasCheckboxes, hasAnimations, hasLoading } = screen;
            const options = clickables.filter(c => !c.isSubmit);
            const submitBtns = clickables.filter(c => c.isSubmit);
            const allText = texts.join(' ').toLowerCase();
            const titleText = (mainTitle || '').toLowerCase();
            if (allText.match(/bem.?vind|welcome|vamos começar|start|iniciar|comece agora/i) && options.length <= 1) return 'welcome';
            // Result: only if the keyword is in the TITLE and there are few/no options
            if (titleText.match(/resultado|result|diagnóstico|parabéns|congrat/i) && options.length <= 1) return 'result';
            // Only classify as loading if there's very little text (actual loading/progress pages have minimal content)
            if ((hasLoading || allText.match(/calculando|analisando|processando|carregando|aguarde|loading|analyzing|processing/i)) && texts.length <= 2 && options.length === 0) return 'loading';
            if (inputs.some(i => i.type === 'email' || i.name.match(/email|nome|name|phone|telefone|whatsapp/i))) return 'lead';
            if (inputs.length > 0) return 'input';
            // Multi-select: detected by checkboxes OR text hints OR submit button coexisting with 3+ options
            const isMultiHint = allText.match(/marcar v[aá]rios|selecione.*mais|pode escolher|multiple|select.*more|choose.*more|pode marcar|selecciona.*m[aá]s|elige.*varios|puedes elegir|puedes seleccionar|seleccione|marca.*varios|marca.*todas/i);
            const hasSubmitWithOptions = submitBtns.length > 0 && options.length >= 3;
            if ((hasCheckboxes || isMultiHint || hasSubmitWithOptions) && options.length > 1) return 'multi-select';
            if (options.length > 1) return 'choice';
            if (options.length === 1) return 'statement';
            // Late result detection: only for pages with no options at all
            if (allText.match(/resultado|result|diagnóstico|parabéns|congrat/i) && options.length === 0) return 'result';
            return 'insight';
        };

        const buildPage = (screen, type) => {
            const options = screen.clickables.filter(c => !c.isSubmit);
            const ctaBtn = screen.clickables.find(c => c.isSubmit);
            const ctaText = ctaBtn?.text || '';

            if (type === 'welcome') {
                return {
                    headline: screen.mainTitle || screen.texts[0] || '',
                    subheadline: screen.subtitle || screen.texts[1] || '',
                    cta: ctaText || 'Começar →',
                    logoUrl: screen.logoUrl || '',
                    heroImageUrl: screen.heroImageUrl || '',
                };
            }

            return {
                type,
                text: screen.mainTitle || screen.texts.find(t => t.length > 3 && t.length < 300) || '',
                subtitle: screen.subtitle || '',
                ctaText: ctaText || '',
                imageUrl: screen.heroImageUrl || '',
                logoUrl: screen.logoUrl || '',
                options: options.map((o, j) => ({
                    text: o.text,
                    emoji: '',
                    image: '',
                    weight: j + 1
                })),
            };
        };

        const getContentHash = async () => pg.evaluate(() => {
            const main = document.querySelector('main, [role="main"], .main-content, #app, #root, #__next') || document.body;
            const text = (main.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500);
            // Also hash the DOM structure for SPA transitions that change layout but not text
            const elCount = main.querySelectorAll('*').length;
            const imgCount = main.querySelectorAll('img').length;
            return `${text}|e${elCount}|i${imgCount}`;
        });

        // Install mutation observer in the page for reliable change detection
        await pg.evaluate(() => {
            window.__cloneMutated = false;
            window.__cloneMutationCount = 0;
            const main = document.querySelector('#__next, #app, #root, main, [role=main]') || document.body;
            const observer = new MutationObserver((mutations) => {
                let significant = 0;
                for (const m of mutations) {
                    if (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) significant++;
                    if (m.type === 'attributes') significant++;
                }
                if (significant >= 2) {
                    window.__cloneMutated = true;
                    window.__cloneMutationCount += significant;
                }
            });
            observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-state'] });
        });

        const clickAndWait = async (clickable) => {
            try {
                // Reset mutation flag
                await pg.evaluate(() => { window.__cloneMutated = false; window.__cloneMutationCount = 0; });
                
                // Strategy 1: Native Puppeteer click (works best with SPA frameworks)
                await pg.mouse.click(clickable.x, clickable.y);
                await delay(800);
                
                // Check mutation flag first (fastest signal)
                let mutated = await pg.evaluate(() => window.__cloneMutated);
                if (mutated) {
                    await delay(1500); // Let SPA transition complete
                    const newHash = await getContentHash();
                    if (newHash !== prevHash) return true;
                }
                
                // Strategy 2: JavaScript dispatchEvent (for elements that need synthetic events)
                await pg.evaluate(({ x, y }) => {
                    const el = document.elementFromPoint(x, y);
                    if (!el) return;
                    let target = el;
                    for (let i = 0; i < 8; i++) {
                        const t = target.tagName;
                        if (t === 'BUTTON' || t === 'A' || t === 'LABEL' || t === 'INPUT' ||
                            target.getAttribute('role') === 'button' || target.getAttribute('role') === 'option' ||
                            target.onclick) break;
                        if (target.parentElement) target = target.parentElement;
                    }
                    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
                    target.dispatchEvent(new PointerEvent('pointerdown', opts));
                    target.dispatchEvent(new MouseEvent('mousedown', opts));
                    target.dispatchEvent(new PointerEvent('pointerup', opts));
                    target.dispatchEvent(new MouseEvent('mouseup', opts));
                    target.dispatchEvent(new MouseEvent('click', opts));
                }, { x: clickable.x, y: clickable.y });
                
                await delay(800);
                
                // Check both mutation flag and content hash
                mutated = await pg.evaluate(() => window.__cloneMutated);
                const newHash = await getContentHash();
                if (newHash !== prevHash || mutated) {
                    // Extra wait for transition to fully complete
                    if (mutated && newHash === prevHash) await delay(1500);
                    const finalHash = await getContentHash();
                    if (finalHash !== prevHash) return true;
                }
                
                return false;
            } catch { return false; }
        };

        // Click without checking hash — used for toggling checkboxes/options
        const clickElement = async (clickable) => {
            try {
                // Use native Puppeteer mouse click — this sends CDP input events that
                // SPA frameworks (React, Next.js, Vue) properly handle
                await pg.mouse.click(clickable.x, clickable.y);
                await delay(800);
                return true;
            } catch {
                // Fallback: use JS dispatchEvent
                try {
                    await pg.evaluate(({ x, y }) => {
                        const el = document.elementFromPoint(x, y);
                        if (!el) return;
                        let target = el;
                        for (let i = 0; i < 5; i++) {
                            if (['BUTTON', 'A', 'LABEL', 'INPUT'].includes(target.tagName) || target.getAttribute('role') === 'button') break;
                            if (target.parentElement) target = target.parentElement;
                        }
                        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
                    }, { x: clickable.x, y: clickable.y });
                    await delay(800);
                    return true;
                } catch { return false; }
            }
        };

        // ── Extract ALL CSS from the page ONCE (before the loop) ──
        const cachedCSS = await pg.evaluate(() => {
            let cssText = '';
            try {
                for (const sheet of document.styleSheets) {
                    try {
                        for (const rule of sheet.cssRules) {
                            cssText += rule.cssText + '\n';
                        }
                    } catch (e) { /* cross-origin stylesheet, skip */ }
                }
            } catch (e) { }

            // Extract CSS variables from inline style tags
            let cssVars = ':root {\n';
            for (const s of document.querySelectorAll('style')) {
                const txt = s.textContent || '';
                const varMatches = txt.matchAll(/--([\w-]+)\s*:\s*([^;]+)/g);
                for (const m of varMatches) {
                    cssVars += `  --${m[1]}: ${m[2]};\n`;
                }
            }
            cssVars += '}\n';

            const bodyBg = getComputedStyle(document.body).backgroundColor;
            const bodyColor = getComputedStyle(document.body).color;
            const bodyFont = getComputedStyle(document.body).fontFamily;

            return { cssText, cssVars, bodyBg, bodyColor, bodyFont };
        });
        console.log('[Clone-Stream] CSS extracted, length:', cachedCSS.cssText.length);

        // ── Per-page HTML extractor — combines cached CSS with page innerHTML ──
        // ── Extract CSS @keyframes from all stylesheets ──
        const keyframesCSS = await pg.evaluate(() => {
            let kf = '';
            try {
                for (const sheet of document.styleSheets) {
                    try {
                        for (const rule of sheet.cssRules) {
                            if (rule.type === CSSRule.KEYFRAMES_RULE) {
                                kf += rule.cssText + '\n';
                            }
                        }
                    } catch {}
                }
            } catch {}
            return kf;
        });
        console.log('[Clone-Stream] Keyframes extracted, length:', keyframesCSS.length);

        const extractPageHTML = async () => {
            // ── Part 1: Editable HTML (lightweight, for Builder) ──
            let innerHTML = await pg.evaluate(() => {
                const container = document.querySelector('.main-content, main, [role="main"], #app, #root, #__next') || document.body;
                const contentEl = container.querySelector('[class*="main-content"]') || container;
                
                // Strip popups, notifications, urgency banners, cookie banners before extraction
                const popupSelectors = [
                    '[class*="popup"]', '[class*="modal"]', '[class*="overlay"]',
                    '[class*="notification"]', '[class*="banner"]', '[class*="toast"]',
                    '[class*="cookie"]', '[class*="consent"]', '[class*="social-proof"]',
                    '[class*="urgency"]', '[class*="fomo"]', '[class*="countdown"]',
                    '[class*="alert"]', '[class*="snackbar"]',
                ];
                const allPopups = contentEl.querySelectorAll(popupSelectors.join(','));
                allPopups.forEach(el => {
                    // Only remove if it looks like a floating element
                    const cs = getComputedStyle(el);
                    if (cs.position === 'fixed' || cs.position === 'absolute' || cs.zIndex > 100) {
                        el.remove();
                    }
                });
                // Also remove fixed-position elements that might be popups
                document.querySelectorAll('*').forEach(el => {
                    const cs = getComputedStyle(el);
                    if (cs.position === 'fixed' && el.getBoundingClientRect().height < 200 && el.getBoundingClientRect().height > 20) {
                        // Likely a notification/toast/banner
                        const text = (el.textContent || '').toLowerCase();
                        if (/atenci[oó]n|personas|acaban|urgente|oferta|promo|cookie|notification|alert/i.test(text)) {
                            el.remove();
                        }
                    }
                });
                
                contentEl.querySelectorAll('video').forEach(v => {
                    v.setAttribute('playsinline', '');
                    v.setAttribute('controls', '');
                    if (v.src) v.setAttribute('src', v.src);
                    v.querySelectorAll('source').forEach(s => { if (s.src) s.setAttribute('src', s.src); });
                });
                contentEl.querySelectorAll('iframe').forEach(iframe => {
                    if (iframe.src) iframe.setAttribute('src', iframe.src);
                });
                return contentEl.innerHTML;
            });

            // ── Carousel/Slideshow detection and conversion ──
            const carouselData = await pg.evaluate(() => {
                const carousels = [];
                // Look for carousel containers
                const candidates = document.querySelectorAll(
                    '[class*="swiper"], [class*="slick"], [class*="carousel"], [class*="slider"], [class*="slideshow"], [class*="gallery"]'
                );
                // Also check overflow-x containers
                const allDivs = document.querySelectorAll('div, section');
                const overflowContainers = [...allDivs].filter(el => {
                    const cs = getComputedStyle(el);
                    return (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') &&
                        el.scrollWidth > el.clientWidth + 20 && el.children.length > 1;
                });

                const allCarousels = new Set([...candidates, ...overflowContainers]);

                for (const container of allCarousels) {
                    const slides = [];
                    // Get direct children or items with slide-like classes
                    const items = container.querySelectorAll(
                        '[class*="slide"], [class*="item"], [class*="card"]'
                    );
                    const slideElements = items.length > 1 ? items : container.children;

                    for (const slide of slideElements) {
                        const img = slide.querySelector('img');
                        const text = slide.textContent?.trim();
                        if (img?.src || (text && text.length > 0)) {
                            slides.push({
                                imgSrc: img?.src || '',
                                imgAlt: img?.alt || '',
                                html: slide.outerHTML,
                                text: text?.substring(0, 200) || '',
                            });
                        }
                    }

                    if (slides.length > 1) {
                        // Get container's approximate dimensions
                        const rect = container.getBoundingClientRect();
                        carousels.push({
                            slides,
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                            outerHTML: container.outerHTML,
                            // Get a unique identifier for this container
                            id: container.id || container.className?.toString()?.substring(0, 60) || '',
                        });
                    }
                }
                return carousels;
            });

            // Convert carousels to CSS scroll-snap
            if (carouselData.length > 0) {
                for (const carousel of carouselData) {
                    const slideHTML = carousel.slides.map((s, i) =>
                        `<div style="flex:0 0 100%;scroll-snap-align:start;min-width:100%;box-sizing:border-box">${
                            s.imgSrc
                                ? `<img src="${s.imgSrc}" alt="${s.imgAlt}" style="width:100%;height:auto;display:block;border-radius:8px"/>`
                                : s.html
                        }</div>`
                    ).join('');

                    const dots = carousel.slides.map((_, i) =>
                        `<span style="width:8px;height:8px;border-radius:50%;background:${i === 0 ? '#6366f1' : '#d1d5db'};display:inline-block"></span>`
                    ).join('');

                    const scrollSnapCarousel = `<div style="position:relative;width:100%;overflow:hidden;margin:8px 0">
                        <div style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:0" class="clone-carousel">
                            ${slideHTML}
                        </div>
                        <div style="display:flex;justify-content:center;gap:6px;padding:8px 0">${dots}</div>
                        <style>.clone-carousel::-webkit-scrollbar{display:none}</style>
                    </div>`;

                    // Try to replace the original carousel HTML with our scroll-snap version
                    // We use a distinctive substring from the original to find and replace
                    const searchStr = carousel.outerHTML.substring(0, 200);
                    const searchIdx = innerHTML.indexOf(searchStr);
                    if (searchIdx >= 0) {
                        // Find the end of the original carousel element
                        const originalLen = carousel.outerHTML.length;
                        innerHTML = innerHTML.substring(0, searchIdx) + scrollSnapCarousel + innerHTML.substring(searchIdx + originalLen);
                    }
                }
            }

            // Strip tracking from editable HTML
            const stripTracking = (html) => html
                .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match) => {
                    const lower = match.toLowerCase();
                    const t = ['fbq(', 'facebook.com/tr', 'fbevents.js', 'fb-pixel',
                        'google-analytics', 'googletagmanager', 'gtag(', 'ga(', 'analytics.js', 'gtm.js',
                        'hotjar', 'hj(', 'hjSiteSettings', 'tiktok.com/i18n/pixel', 'ttq.',
                        'snap.licdn.com', 'linkedin.com/px', 'ads.reddit.com',
                        'clarity.ms', 'clarity(', 'adsbygoogle', 'googlesyndication'];
                    if (t.some(p => lower.includes(p.toLowerCase()))) return '';
                    return match;
                })
                .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, (match) => {
                    const l = match.toLowerCase();
                    if (l.includes('facebook.com') || l.includes('googletagmanager') || l.includes('pixel') || l.includes('analytics')) return '';
                    return match;
                })
                .replace(/<img[^>]*(facebook\.com\/tr|google-analytics|googletagmanager)[^>]*\/?>/gi, '');

            // ═══ DOWNLOAD EXTERNAL ASSETS LOCALLY ═══
            const downloadCloneAssets = async (htmlStr, quizId) => {
                const assetDir = path.join(uploadsDir, 'clone-assets', quizId);
                if (!fs.existsSync(assetDir)) fs.mkdirSync(assetDir, { recursive: true });

                // Extract all external URLs from HTML
                const urlSet = new Set();
                
                // img src
                const imgMatches = htmlStr.match(/(?:src|data-src)=["'](https?:\/\/[^"']+)["']/gi) || [];
                imgMatches.forEach(m => {
                    const url = m.match(/["'](https?:\/\/[^"']+)["']/)?.[1];
                    if (url) urlSet.add(url);
                });
                
                // CSS url() — background images, fonts, etc.
                const cssUrlMatches = htmlStr.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/gi) || [];
                cssUrlMatches.forEach(m => {
                    const url = m.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/i)?.[1];
                    if (url) urlSet.add(url);
                });
                
                // link href (CSS files)
                const linkMatches = htmlStr.match(/<link[^>]+href=["'](https?:\/\/[^"']+\.css[^"']*)["']/gi) || [];
                linkMatches.forEach(m => {
                    const url = m.match(/href=["'](https?:\/\/[^"']+)["']/)?.[1];
                    if (url) urlSet.add(url);
                });

                // Filter: skip tracking pixels, fonts, and JS files
                const skipPatterns = [
                    /facebook\.com/i, /google-analytics/i, /googletagmanager/i,
                    /hotjar/i, /tiktok/i, /clarity\.ms/i, /linkedin\.com/i,
                    /\.js(\?|$)/i, /\.woff2?(\?|$)/i, /\.ttf(\?|$)/i, /\.eot(\?|$)/i,
                    /data:image/i, /pixel/i, /tracker/i, /beacon/i
                ];
                
                const urls = [...urlSet].filter(u => !skipPatterns.some(p => p.test(u)));
                
                // Limit to 30 assets per page to avoid overwhelming
                const limitedUrls = urls.slice(0, 30);
                console.log(`[CloneAssets] Downloading ${limitedUrls.length} assets for quiz ${quizId}...`);
                
                const urlMap = {}; // original URL → local path
                
                const downloads = limitedUrls.map(async (url) => {
                    try {
                        const crypto = require('crypto');
                        const urlHash = crypto.createHash('md5').update(url).digest('hex').substring(0, 12);
                        const extMatch = url.match(/\.(\w{2,5})(?:\?|$)/);
                        const ext = extMatch ? extMatch[1] : 'bin';
                        const safeExt = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'ico', 'css'].includes(ext.toLowerCase()) ? ext.toLowerCase() : 'bin';
                        const filename = `${urlHash}.${safeExt}`;
                        const filepath = path.join(assetDir, filename);
                        
                        // Skip if already downloaded
                        if (fs.existsSync(filepath)) {
                            urlMap[url] = `/uploads/clone-assets/${quizId}/${filename}`;
                            return;
                        }
                        
                        const controller = new AbortController();
                        const timeout = setTimeout(() => controller.abort(), 8000);
                        
                        const res = await fetch(url, {
                            signal: controller.signal,
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                        });
                        clearTimeout(timeout);
                        
                        if (!res.ok) return;
                        
                        // Check content length (skip files > 5MB)
                        const contentLength = parseInt(res.headers.get('content-length') || '0');
                        if (contentLength > 5 * 1024 * 1024) return;
                        
                        const buffer = Buffer.from(await res.arrayBuffer());
                        fs.writeFileSync(filepath, buffer);
                        urlMap[url] = `/uploads/clone-assets/${quizId}/${filename}`;
                    } catch (err) {
                        // Silent fail — asset will keep original URL
                    }
                });
                
                await Promise.allSettled(downloads);
                
                console.log(`[CloneAssets] Downloaded ${Object.keys(urlMap).length}/${limitedUrls.length} assets`);
                
                // Replace all URLs in HTML
                let result = htmlStr;
                for (const [originalUrl, localPath] of Object.entries(urlMap)) {
                    // Escape special regex characters in URL
                    const escaped = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    result = result.replace(new RegExp(escaped, 'g'), localPath);
                }
                
                // Remove <base> tag since we no longer need it (all URLs are local now)
                result = result.replace(/<base[^>]*>/gi, '');
                
                return result;
            };

            innerHTML = stripTracking(innerHTML);
            const allCSS = cachedCSS.cssVars + cachedCSS.cssText + (keyframesCSS || '');

            // ── Inject interactive widgets for known patterns ──
            // Detect pages with sliders (weight, height, age) and inject working HTML range inputs
            const pageText = await pg.evaluate(() => document.body?.innerText || '');
            const isSliderPage = /qual.*peso|weight|qual.*altura|height|quantos.*anos|age|arraste|drag|deslize/i.test(pageText);

            let widgetScript = '';
            if (isSliderPage) {
                // Extract the current value shown on the page
                const sliderInfo = await pg.evaluate(() => {
                    // Look for displayed value (like "70kg", "165cm")
                    const numEls = [...document.querySelectorAll('span, div, p, strong')].filter(el => {
                        const t = (el.innerText || '').trim();
                        return /^\d{2,3}\s*(kg|cm|lb|ft|anos|years)?$/i.test(t) && el.getBoundingClientRect().height > 0;
                    });
                    const valEl = numEls[0];
                    const rawVal = valEl ? parseInt((valEl.innerText || '').match(/\d+/)?.[0] || '70') : 70;
                    const unit = valEl ? ((valEl.innerText || '').match(/(kg|cm|lb|ft|anos|years)/i)?.[0] || '') : '';

                    // Detect if height or weight
                    const fullText = document.body.innerText.toLowerCase();
                    const isHeight = /altura|height|cm/i.test(fullText);
                    const isAge = /anos|age|idade/i.test(fullText);

                    return {
                        value: rawVal,
                        unit: unit,
                        min: isHeight ? 120 : (isAge ? 14 : 30),
                        max: isHeight ? 220 : (isAge ? 90 : 200),
                        isHeight,
                        isAge
                    };
                });

                widgetScript = `
<div data-clone-slider style="padding:10px 20px;margin:10px 0;text-align:center">
  <div style="font-size:2.2rem;font-weight:700;margin-bottom:8px">
    <span id="clone-slider-val">${sliderInfo.value}</span><span style="font-size:1.2rem;font-weight:400">${sliderInfo.unit}</span>
  </div>
  <input type="range" min="${sliderInfo.min}" max="${sliderInfo.max}" value="${sliderInfo.value}" id="clone-slider-input"
    style="width:100%;height:6px;accent-color:var(--primary-color,#f59e0b);cursor:pointer;-webkit-appearance:none;background:linear-gradient(to right,#f59e0b 50%,#e5e7eb 50%);border-radius:3px"
    oninput="document.getElementById('clone-slider-val').textContent=this.value" />
  <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:#999;margin-top:4px">
    <span>${sliderInfo.min}</span><span>${sliderInfo.max}</span>
  </div>
</div>`;
            }

            let finalHTML = innerHTML;
            // If it's a slider page, try to append the interactive widget near the existing slider visual
            if (widgetScript) {
                // Find the container that has slider-like elements and add ours
                finalHTML = await pg.evaluate((args) => {
                    const { innerHTML: html, widget } = args;
                    const temp = document.createElement('div');
                    temp.innerHTML = html;

                    // Remove static slider elements that don't work
                    const staticSliders = temp.querySelectorAll('[class*=slider], [class*=ruler], [class*=range], [class*=dial], [class*=scale]');
                    staticSliders.forEach(el => el.style.display = 'none');

                    // Find the CTA/continue button and insert slider before it
                    const buttons = temp.querySelectorAll('button, a, [role=button]');
                    let ctaBtn = null;
                    for (const btn of buttons) {
                        if (/continuar|continue|next|próximo/i.test(btn.textContent)) {
                            ctaBtn = btn;
                            break;
                        }
                    }

                    if (ctaBtn && ctaBtn.parentElement) {
                        const wrapper = document.createElement('div');
                        wrapper.innerHTML = widget;
                        ctaBtn.parentElement.insertBefore(wrapper, ctaBtn);
                    }

                    return temp.innerHTML;
                }, { innerHTML: finalHTML, widget: widgetScript });
            }

            const editableCode = `<div class="cloned-page" style="background:${cachedCSS.bodyBg};color:${cachedCSS.bodyColor};font-family:${cachedCSS.bodyFont};min-height:100%;width:100%;overflow:hidden;box-sizing:border-box"><style>${allCSS}.cloned-page *{box-sizing:border-box}.cloned-page img{max-width:100%;height:auto}.cloned-page video{max-width:100%;height:auto}.cloned-page button,.cloned-page [role="button"]{cursor:pointer}.cloned-page a{text-decoration:none;color:inherit}[data-clone-slider] input[type=range]{-webkit-appearance:none;height:6px;border-radius:3px;outline:none}[data-clone-slider] input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:#f59e0b;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.2)}</style>${finalHTML}</div>`;

            // ── Part 2: Full interactive HTML (with all JS, for Player iframe) ──
            let fullDoc = '';
            try {
                const pageUrl = pg.url();
                const origin = new URL(pageUrl).origin;
                fullDoc = await pg.content();
                fullDoc = stripTracking(fullDoc);

                // Inject <base> tag for correct relative URL resolution
                if (!fullDoc.includes('<base ')) {
                    fullDoc = fullDoc.replace(/<head([^>]*)>/i, `<head$1><base href="${origin}/" target="_self">`);
                }

                // Inject navigation bridge script — handles ALL interactive elements
                const navBridge = `<script data-clone-nav>
(function(){
  var advanceTimer = null;
  function advance() {
    if (advanceTimer) return;
    advanceTimer = setTimeout(function(){ advanceTimer = null; }, 800);
    window.parent.postMessage({type:'clone-advance'},'*');
  }

  // Intercept all clicks on interactive elements
  document.addEventListener('click', function(e) {
    var target = e.target;
    for (var i = 0; i < 12; i++) {
      if (!target || target === document.body || target === document.documentElement) break;
      var tag = target.tagName ? target.tagName.toLowerCase() : '';

      // SKIP: let interactive widgets work naturally (sliders, inputs, toggles)
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (tag === 'label' && target.querySelector && target.querySelector('input')) return;
      // Skip range slider containers
      var cls = (target.className || '').toString().toLowerCase();
      if (cls.includes('slider') || cls.includes('range') || cls.includes('dial') || cls.includes('knob') || cls.includes('thumb') || cls.includes('ruler') || cls.includes('scale')) return;

      // CATCH: buttons, links, options, clickable cards
      var role = target.getAttribute ? (target.getAttribute('role') || '') : '';
      var isBtn = tag === 'button' || tag === 'a' || role === 'button' || role === 'option' ||
        cls.includes('btn') || cls.includes('button') || cls.includes('cta') ||
        cls.includes('option') || cls.includes('choice') || cls.includes('answer') ||
        cls.includes('card') || cls.includes('select');

      // Also catch styled divs/spans with cursor:pointer that look like buttons
      if (!isBtn && target.style) {
        var cursor = window.getComputedStyle ? window.getComputedStyle(target).cursor : '';
        if (cursor === 'pointer' && target.textContent && target.textContent.trim().length > 1 && target.textContent.trim().length < 200) {
          isBtn = true;
        }
      }

      if (isBtn) {
        // Let the original handler run briefly for visual feedback, then advance
        setTimeout(function() { advance(); }, 350);
        return;
      }
      target = target.parentElement;
    }
  }, false);

  // Intercept form submissions
  document.addEventListener('submit', function(e) {
    e.preventDefault();
    advance();
  }, true);

  // MutationObserver: detect SPA page transitions (large DOM changes)
  var mainEl = document.querySelector('#__next, #app, #root, main, [role=main]') || document.body;
  var lastContent = (mainEl.textContent || '').slice(0, 200);
  var observer = new MutationObserver(function(mutations) {
    var currentContent = (mainEl.textContent || '').slice(0, 200);
    if (currentContent !== lastContent) {
      lastContent = currentContent;
      // Significant content change = page transition
      advance();
    }
  });
  observer.observe(mainEl, { childList: true, subtree: true });

  // Intercept SPA navigation (pushState/replaceState)
  var origPush = history.pushState;
  var origReplace = history.replaceState;
  history.pushState = function() { origPush.apply(this, arguments); advance(); };
  history.replaceState = function() { origReplace.apply(this, arguments); advance(); };
  window.addEventListener('popstate', function() { advance(); });
})();
</script>`;
                fullDoc = fullDoc.replace('</body>', navBridge + '</body>');

                // Add responsive viewport if missing
                if (!fullDoc.includes('viewport')) {
                    fullDoc = fullDoc.replace(/<head([^>]*)>/i, '<head$1><meta name="viewport" content="width=device-width,initial-scale=1">');
                }

                // ── Inject chart animation CSS + detection ──
                const chartAnimCSS = `<style data-clone-charts>
@keyframes chartBarGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes chartFadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes countUp { from { opacity: 0; } to { opacity: 1; } }
[data-clone-chart] { cursor: pointer; transition: outline 0.15s; }
[data-clone-chart]:hover { outline: 2px dashed #6c63ff; outline-offset: 4px; }
[data-clone-bar] { 
    transform-origin: bottom center; 
    animation: chartBarGrow 1s ease-out forwards;
}
[data-clone-bar-label] {
    animation: chartFadeIn 0.8s ease-out forwards;
    animation-delay: 0.5s;
    opacity: 0;
}
</style>`;
                fullDoc = fullDoc.replace('</head>', chartAnimCSS + '</head>');

                // Inject a script that detects bar charts and marks them with data attributes
                const chartDetectScript = `<script data-clone-chart-detect>
(function() {
    function detectCharts() {
        // Find groups of colored siblings that look like bar charts
        const allContainers = document.querySelectorAll('div, section');
        allContainers.forEach(container => {
            const children = [...container.children];
            if (children.length < 2 || children.length > 10) return;
            
            // Check if children have distinct background colors and similar widths
            let coloredChildren = 0;
            let hasPercentage = false;
            children.forEach(child => {
                const style = getComputedStyle(child);
                const bg = style.backgroundColor;
                if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== 'rgb(255, 255, 255)') {
                    coloredChildren++;
                }
                const text = (child.textContent || '').trim();
                if (/\\d+%/.test(text)) hasPercentage = true;
            });
            
            // If 2+ colored children with percentages, it's likely a bar chart
            if (coloredChildren >= 2 && hasPercentage) {
                container.setAttribute('data-clone-chart', 'bar');
                container.setAttribute('data-clone-type', 'chart');
                
                // Mark individual bar elements
                children.forEach((child, idx) => {
                    const style = getComputedStyle(child);
                    const bg = style.backgroundColor;
                    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== 'rgb(255, 255, 255)') {
                        child.setAttribute('data-clone-bar', idx);
                        child.style.animationDelay = (idx * 0.3) + 's';
                        
                        // Find percentage text inside
                        const percentEl = [...child.querySelectorAll('*')].find(el => /\\d+%/.test(el.textContent?.trim()));
                        if (percentEl) percentEl.setAttribute('data-clone-bar-label', idx);
                    }
                });
            }
        });
        
        // Also detect progress fill bars (thin colored bars that represent progress)
        document.querySelectorAll('[style*="width:"], [style*="width :"]').forEach(el => {
            const style = getComputedStyle(el);
            const h = parseFloat(style.height);
            const w = parseFloat(style.width);
            const bg = style.backgroundColor;
            if (h > 5 && h < 40 && w > 20 && bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                const parent = el.parentElement;
                if (parent && !parent.hasAttribute('data-clone-chart')) {
                    parent.setAttribute('data-clone-chart', 'progress');
                    parent.setAttribute('data-clone-type', 'chart');
                    el.setAttribute('data-clone-bar', '0');
                }
            }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', detectCharts);
    else setTimeout(detectCharts, 100);
})();
</script>`;
                fullDoc = fullDoc.replace('</body>', chartDetectScript + '</body>');

                console.log('[Clone-Stream] Full doc captured, size:', Math.round(fullDoc.length / 1024), 'KB');
            } catch (e) {
                console.log('[Clone-Stream] Failed to capture full doc:', e.message);
            }

            // Download all external assets locally for independence
            let localEditable = editableCode;
            let localFullDoc = fullDoc || '';
            try {
                console.log('[CloneAssets] Processing assets for page...');
                localEditable = await downloadCloneAssets(localEditable, cloneSessionId);
                if (localFullDoc) localFullDoc = await downloadCloneAssets(localFullDoc, cloneSessionId);
            } catch (assetErr) {
                console.log('[CloneAssets] Asset download error (non-fatal):', assetErr.message);
            }

            return { editableCode: localEditable, fullCode: localFullDoc };
        };

        let prevPageType = '';
        for (let i = 0; i < MAX_PAGES; i++) {
            await delay(1200);
            
            // Extra wait after loading/animation pages — they need more time to transition
            if (prevPageType === 'loading') {
                await delay(3000);
            }
            
            // Strip ONLY obvious popup/notification elements (very targeted to avoid removing content)
            await pg.evaluate(() => {
                // Only remove elements that are BOTH: fixed/absolute AND contain spam text
                document.querySelectorAll('*').forEach(el => {
                    try {
                        const cs = getComputedStyle(el);
                        if (cs.position !== 'fixed') return;
                        const r = el.getBoundingClientRect();
                        // Skip large containers (likely main content)
                        if (r.height > 400) return;
                        // Skip tiny elements
                        if (r.height < 10 || r.width < 10) return;
                        const text = (el.textContent || '').toLowerCase();
                        // Only remove if it has promotional/spam text
                        const isSpam = /atenci[oó]n.*personas|acaban de|urgente|últimas vagas|cookie|consent|aceitar cookies|countdown|timer|oferta.*expira|promo.*flash|social.proof|personas.*viendo|people.*viewing|viewers.*right now/i.test(text);
                        if (isSpam) el.remove();
                    } catch {}
                });
            }).catch(() => {});
            
            // Reset mutation flag before extraction
            await pg.evaluate(() => { window.__cloneMutated = false; window.__cloneMutationCount = 0; }).catch(() => {});
            
            let screen = await extractScreen();
            
            // If screen is empty (e.g. after loading animation), wait more and retry
            if (screen.texts.length === 0 && screen.clickables.length === 0) {
                console.log('[Clone-Stream] Empty screen, waiting 3s and retrying...');
                await delay(3000);
                screen = await extractScreen();
            }

            // Only wait extra for actual loading indicators (not CSS hover animations)
            if (screen.hasLoading) {
                console.log('[Clone-Stream] Loading indicator detected, waiting extra...');
                await delay(2000);
            }
            const options = screen.clickables.filter(c => !c.isSubmit);
            const submitBtns = screen.clickables.filter(c => c.isSubmit);

            const hash = await getContentHash();
            const currentTitle = (screen.mainTitle || '').trim();
            if (hash === prevHash) {
                stuckCount++;
                if (stuckCount >= MAX_STUCK) { send('progress', { stage: 'done', msg: `⛔ Quiz travou após ${allPages.length} páginas`, pct: 90 }); break; }
            } else { stuckCount = 0; }
            // Track same-title loops (hash changes due to checkbox toggles but page is the same)
            if (currentTitle.length > 5 && currentTitle === prevTitle) {
                sameTitleCount++;
                if (sameTitleCount >= 4) {
                    console.log(`[Clone-Stream] Same page title detected ${sameTitleCount} times, forcing advance...`);
                    stuckCount = MAX_STUCK;
                    send('progress', { stage: 'done', msg: `⛔ Não foi possível avançar. ${allPages.length} páginas clonadas.`, pct: 90 });
                    break;
                }
            } else { sameTitleCount = 0; }
            prevTitle = currentTitle;
            prevHash = hash;

            const type = classifyPage(screen);
            prevPageType = type;

            const pageHash = hash;
            const pageTitle = (screen.mainTitle || '').trim();
            const isDuplicate = allPages.some(p => p._hash === pageHash || (pageTitle.length > 5 && p._title === pageTitle));
            if (isDuplicate) {
                // skip — same hash or same title (e.g. multi-select page after option click)
            } else if (type === 'lead' || type === 'input') {
                collectLead = type === 'lead' ? true : collectLead;
                
                // ── STILL capture the HTML for the page ──
                let pageHTML = '';
                let fullCode = '';
                try {
                    const result = await extractPageHTML();
                    pageHTML = result.editableCode;
                    fullCode = result.fullCode;
                } catch (e) {
                    console.log('[Clone] HTML extraction failed for lead page', i, e.message);
                }
                let screenshotBase64 = '';
                try {
                    const screenshotBuf = await pg.screenshot({ type: 'jpeg', quality: 80 });
                    screenshotBase64 = screenshotBuf.toString('base64');
                } catch (e) { }

                const title = screen.mainTitle || screen.texts?.[0] || '';
                const pageObj = {
                    type: 'html-script',
                    code: pageHTML,
                    fullCode: fullCode,
                    text: title,
                    subtitle: screen.subtitle || '',
                    _pageType: type,
                    _hash: pageHash,
                    _screenshot: screenshotBase64,
                };
                pageObj._title = pageTitle;
                allPages.push(pageObj);

                send('progress', { stage: 'scraping', msg: `📧 Página ${allPages.length} (formulário) clonada`, pct: 15 + allPages.length * 5, pageNum: i + 1, pageType: type });

                // ── Fill test data into form inputs so we can advance ──
                console.log(`[Clone-Stream] 📝 Filling test data in ${type} form...`);
                await pg.evaluate(() => {
                    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="range"]), textarea, select');
                    inputs.forEach(el => {
                        const r = el.getBoundingClientRect();
                        if (r.height <= 0 || r.width <= 0) return;
                        const type = (el.type || '').toLowerCase();
                        const name = (el.name || el.placeholder || el.id || '').toLowerCase();
                        const label = (el.labels?.[0]?.innerText || '').toLowerCase();
                        const all = name + ' ' + label + ' ' + type;
                        
                        let val = '';
                        if (type === 'email' || all.includes('email') || all.includes('e-mail') || all.includes('correo')) {
                            val = 'teste@gmail.com';
                        } else if (all.includes('phone') || all.includes('telefone') || all.includes('whatsapp') || all.includes('celular') || all.includes('tel') || type === 'tel') {
                            val = '11999999999';
                        } else if (all.includes('nome') || all.includes('name') || all.includes('nombre')) {
                            val = 'Teste';
                        } else if (all.includes('sobrenome') || all.includes('last') || all.includes('apellido')) {
                            val = 'Silva';
                        } else if (all.includes('cpf') || all.includes('documento') || all.includes('rg')) {
                            val = '12345678900';
                        } else if (type === 'number' || all.includes('idade') || all.includes('age') || all.includes('edad')) {
                            val = '30';
                        } else if (el.tagName === 'SELECT') {
                            // Select first non-empty option
                            const opts = el.querySelectorAll('option');
                            for (const opt of opts) {
                                if (opt.value && opt.value !== '') { el.value = opt.value; break; }
                            }
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            return;
                        } else {
                            val = 'Teste';
                        }
                        
                        // Set value using native setter to trigger React/Vue reactivity
                        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set || 
                                           Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                        if (nativeSetter) {
                            nativeSetter.call(el, val);
                        } else {
                            el.value = val;
                        }
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        el.dispatchEvent(new Event('blur', { bubbles: true }));
                    });
                    
                    // Also check any checkboxes/consent boxes
                    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                    checkboxes.forEach(cb => {
                        if (!cb.checked) {
                            cb.click();
                            cb.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });
                });
                await delay(1500);
                console.log(`[Clone-Stream] 📝 Test data filled, looking for submit button...`);
            } else {
                // Extract FULL HTML for pixel-perfect clone
                let pageHTML = '';
                let fullCode = '';
                try {
                    const result = await extractPageHTML();
                    pageHTML = result.editableCode;
                    fullCode = result.fullCode;
                } catch (e) {
                    console.log('[Clone] HTML extraction failed for page', i, e.message);
                }

                // Also take a screenshot  
                let screenshotBase64 = '';
                try {
                    const screenshotBuf = await pg.screenshot({ type: 'jpeg', quality: 80 });
                    screenshotBase64 = screenshotBuf.toString('base64');
                } catch (e) { }

                const title = screen.mainTitle || screen.texts?.[0] || '';

                if (type === 'welcome' && !welcomeData) {
                    welcomeData = buildPage(screen, type);
                }

                const pageObj = {
                    type: 'html-script',
                    code: pageHTML,
                    fullCode: fullCode,
                    text: title,
                    subtitle: screen.subtitle || '',
                    _pageType: type,
                    _hash: pageHash,
                    _screenshot: screenshotBase64,
                };
                pageObj._title = pageTitle;
                allPages.push(pageObj);

                const preview = title.replace(/\n/g, ' ').slice(0, 50);
                send('progress', {
                    stage: 'scraping',
                    msg: `✅ Página ${allPages.length} clonada — "${preview}..."`,
                    pct: Math.min(85, 15 + allPages.length * 5),
                    pageNum: i + 1, pageType: type, pageText: preview, totalPages: allPages.length
                });
            }

            // ── Advance strategies (improved for multi-page quizzes) ──
            let advanced = false;

            // ═══ FORM PAGE HANDLER: after filling inputs, click submit ═══
            if (!advanced && (type === 'lead' || type === 'input') && screen.inputs.length > 0) {
                console.log(`[Clone-Stream] 📝 Form page — trying to submit after filling data...`);
                prevHash = await getContentHash();
                // Find submit/continue button
                const formSubmit = await pg.evaluate(() => {
                    const pattern = /continuar|continue|pr[oó]ximo|next|enviar|submit|avan[cç]ar|ver resultado|prosseguir|siguiente|comenzar|confirmar|quero|bora|ver.meu|ver.seu|get|start|come[cç]ar/i;
                    const btns = [...document.querySelectorAll('button, [role="button"], a, [type="submit"], input[type="submit"]')].filter(el => {
                        const r = el.getBoundingClientRect();
                        if (r.height < 15 || r.width < 30 || r.top > 1200 || r.top < 0) return false;
                        const disabled = el.disabled || el.classList.contains('cursor-not-allowed') || getComputedStyle(el).cursor === 'not-allowed';
                        if (disabled) return false;
                        const text = (el.innerText || el.value || '').trim();
                        return pattern.test(text) || el.type === 'submit';
                    }).sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
                    if (btns.length > 0) {
                        const r = btns[0].getBoundingClientRect();
                        return { x: r.x + r.width/2, y: r.y + r.height/2, text: (btns[0].innerText||btns[0].value||'').trim().slice(0,50) };
                    }
                    return null;
                });
                if (formSubmit) {
                    console.log(`[Clone-Stream] 📝 Clicking form submit: "${formSubmit.text}"`);
                    await pg.mouse.click(formSubmit.x, formSubmit.y);
                    await delay(3000);
                    const nh = await getContentHash();
                    if (nh !== prevHash) {
                        advanced = true;
                        console.log('[Clone-Stream] 📝 Form submitted and advanced!');
                    } else {
                        // Try submitting form element directly
                        await pg.evaluate(() => {
                            const form = document.querySelector('form');
                            if (form) {
                                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                            }
                        });
                        await delay(2000);
                        const nh2 = await getContentHash();
                        if (nh2 !== prevHash) {
                            advanced = true;
                            console.log('[Clone-Stream] 📝 Form.submit() advanced!');
                        }
                    }
                }
            }

            // Helper: scroll down and re-extract to find buttons below viewport
            const scrollAndExtract = async () => {
                await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await delay(500);
                return extractScreen();
            };

            // Helper: find submit/continue buttons (broader matching)
            const findSubmits = (scr) => {
                const submitPattern = /continuar|continue|pr[oó]ximo|next|come[cç]ar|start|enviar|submit|avan[cç]ar|advance|prosseguir|ver resultado|iniciar|vamos l[aá]|quero|bora|let'?s go|take the quiz|get started|take quiz|start quiz|siguiente|comenzar|empezar|confirmar|confirm|aceptar|accept/i;
                return scr.clickables.filter(c => c.isSubmit || submitPattern.test(c.text.replace(/[→►▶\s]/g, '').trim()));
            };

            // ═══════════════════════════════════════════════════════════════
            // ══ DETERMINISTIC MULTI-SELECT HANDLER (runs BEFORE AI) ══════
            // ═══════════════════════════════════════════════════════════════
            // Detect: multiple non-disabled options + a disabled submit button
            const disabledSubmit = screen.clickables.find(c => c.isSubmit && c.isDisabled);
            const isMultiSelect = (screen.hasCheckboxes || type === 'multi-select' || !!disabledSubmit) && options.length >= 2;
            
            if (isMultiSelect && !advanced) {
                console.log('[Clone-Stream] 🎯 Multi-select detected (disabled submit), using direct handler');
                
                // Step 1: Click first option with native Puppeteer click
                const firstOption = options[0];
                console.log(`[Clone-Stream] 🎯 Clicking option: "${firstOption.text.slice(0,40)}"`);
                prevHash = await getContentHash();
                await pg.mouse.click(firstOption.x, firstOption.y);
                await delay(2000);
                
                // Step 2: Re-find the submit button with FRESH DOM coordinates
                // After clicking option, Continuar should become enabled
                for (let retry = 0; retry < 3 && !advanced; retry++) {
                    const freshSubmit = await pg.evaluate(() => {
                        const pattern = /continuar|continue|siguiente|next|enviar|submit|avançar|comenzar|empezar|seguir|prosseguir|próximo/i;
                        const btns = [...document.querySelectorAll('button, [role="button"], a, [type="submit"]')].filter(el => {
                            const r = el.getBoundingClientRect();
                            if (r.height < 20 || r.width < 40 || r.top > 1200 || r.top < 0) return false;
                            const text = (el.innerText || '').trim();
                            const disabled = el.disabled || el.classList.contains('cursor-not-allowed') || getComputedStyle(el).cursor === 'not-allowed';
                            return !disabled && (pattern.test(text) || el.type === 'submit');
                        }).sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top); // lowest first
                        if (btns.length > 0) {
                            const r = btns[0].getBoundingClientRect();
                            return { x: r.x + r.width/2, y: r.y + r.height/2, text: (btns[0].innerText||'').trim().slice(0,50) };
                        }
                        return null;
                    });
                    
                    if (freshSubmit) {
                        console.log(`[Clone-Stream] 🎯 Submit found (fresh): "${freshSubmit.text}"`);
                        await pg.mouse.click(freshSubmit.x, freshSubmit.y);
                        await delay(2500);
                        const nh = await getContentHash();
                        if (nh !== prevHash) {
                            advanced = true;
                            console.log('[Clone-Stream] 🎯 Multi-select advanced!');
                        }
                    } else {
                        console.log(`[Clone-Stream] 🎯 Submit not found yet (retry ${retry+1}/3), waiting...`);
                        await delay(1500);
                    }
                }
                
                // Fallback: click lowest visible button
                if (!advanced) {
                    const lowestBtn = await pg.evaluate(() => {
                        const btns = [...document.querySelectorAll('button, [role="button"], [type="submit"]')].filter(el => {
                            const r = el.getBoundingClientRect();
                            return r.height > 20 && r.width > 40 && r.top > 0 && r.top < 1200 && !el.disabled && !el.classList.contains('cursor-not-allowed');
                        }).sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
                        if (btns.length > 0) { const r = btns[0].getBoundingClientRect(); return { x: r.x+r.width/2, y: r.y+r.height/2, text: (btns[0].innerText||'').trim().slice(0,50) }; }
                        return null;
                    });
                    if (lowestBtn) {
                        console.log(`[Clone-Stream] 🎯 Lowest button fallback: "${lowestBtn.text}"`);
                        await pg.mouse.click(lowestBtn.x, lowestBtn.y);
                        await delay(2500);
                        const nh2 = await getContentHash();
                        if (nh2 !== prevHash) { advanced = true; console.log('[Clone-Stream] 🎯 Lowest button worked!'); }
                    }
                }
            }

            // ═══════════════════════════════════════════════════════════
            // ══ SAME-PAGE RECOVERY (when stuck on same title) ════════
            // ═══════════════════════════════════════════════════════════
            if (!advanced && sameTitleCount >= 1) {
                console.log(`[Clone-Stream] ⚡ Same page recovery (title seen ${sameTitleCount+1}x)`);
                // Don't click options — just find and click an enabled submit button directly
                const submitBtn = await pg.evaluate(() => {
                    const pattern = /continuar|continue|siguiente|next|enviar|submit|avançar|comenzar|empezar|seguir|prosseguir|próximo/i;
                    const btns = [...document.querySelectorAll('button, [role="button"], a, [type="submit"]')].filter(el => {
                        const r = el.getBoundingClientRect();
                        if (r.height < 20 || r.width < 40 || r.top > 1200 || r.top < 0) return false;
                        const disabled = el.disabled || el.classList.contains('cursor-not-allowed') || getComputedStyle(el).cursor === 'not-allowed';
                        const text = (el.innerText || '').trim();
                        return !disabled && (pattern.test(text) || el.type === 'submit');
                    }).sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
                    if (btns.length > 0) {
                        const r = btns[0].getBoundingClientRect();
                        return { x: r.x + r.width/2, y: r.y + r.height/2, text: (btns[0].innerText||'').trim().slice(0,50) };
                    }
                    // Try ANY lowest non-disabled button
                    const allBtns = [...document.querySelectorAll('button, [role="button"]')].filter(el => {
                        const r = el.getBoundingClientRect();
                        return r.height > 20 && r.width > 40 && r.top > 0 && r.top < 1200 && !el.disabled;
                    }).sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
                    if (allBtns.length > 0) {
                        const r = allBtns[0].getBoundingClientRect();
                        return { x: r.x + r.width/2, y: r.y + r.height/2, text: (allBtns[0].innerText||'').trim().slice(0,50), isAny: true };
                    }
                    return null;
                });
                if (submitBtn) {
                    console.log(`[Clone-Stream] ⚡ Recovery clicking: "${submitBtn.text}" ${submitBtn.isAny ? '(lowest btn)' : '(submit)'}`);
                    prevHash = await getContentHash();
                    await pg.mouse.click(submitBtn.x, submitBtn.y);
                    await delay(2500);
                    const nh = await getContentHash();
                    if (nh !== prevHash) { advanced = true; console.log('[Clone-Stream] ⚡ Recovery advanced!'); }
                }
            }

            // ═══════════════════════════════════════════════════════
            // ══ AI-GUIDED NAVIGATION (for single-choice pages) ═══
            // ═══════════════════════════════════════════════════════
            if (!advanced && !isMultiSelect && sameTitleCount === 0 && OPENAI_KEY && options.length > 0) {
                try {
                    // Build a compact description of the page for the AI
                    const pageElements = screen.clickables.map((c, idx) => ({
                        idx,
                        text: c.text.slice(0, 60),
                        isSubmit: c.isSubmit,
                        isDisabled: c.isDisabled || false,
                        y: Math.round(c.y),
                        w: Math.round(c.w),
                        h: Math.round(c.h),
                    }));
                    
                    const pageDesc = {
                        title: screen.mainTitle || '',
                        texts: screen.texts.slice(0, 5),
                        elements: pageElements,
                        hasCheckboxes: screen.hasCheckboxes,
                        pageType: type,
                    };

                    const aiPrompt = `You are a bot navigating a quiz/funnel page. Return JSON with what to click to advance.

Page data:
${JSON.stringify(pageDesc, null, 2)}

IMPORTANT RULES:
1. SINGLE-CHOICE pages (hasCheckboxes=false, multiple option buttons visible): click ONLY ONE option button. The page auto-advances. Return: {"actions": [{"click": <option_idx>}]}  DO NOT also click a submit button!
2. MULTI-SELECT pages (hasCheckboxes=true OR text mentions "marcar vários"/"selecciona"/"puede elegir"): click ONE option, wait, then click the submit/continuar button. Return: {"actions": [{"click": <option_idx>, "reason": "select"}, {"wait": 1500}, {"click": <submit_idx>, "reason": "submit"}]}
3. INFO pages (0 or 1 buttons, no options): click the only button. Return: {"actions": [{"click": <idx>}]}
4. Submit buttons are: the LOWEST button, OR isSubmit=true, OR text like "Continuar"/"Continue"/"Siguiente"/"Next"
5. If isDisabled=true, do NOT click that element — click an option first, wait, then it becomes enabled
6. Options are NON-submit buttons (isSubmit=false). Submit is the button with isSubmit=true or the lowest/last button
7. Return ONLY {"actions": [...]}`;


                    const aiResult = await callOpenAI(aiPrompt, { temperature: 0, maxTokens: 200 });
                    let actions = aiResult?.actions;
                    
                    // SAFETY: If multi-select page but AI only returned 1 click (no submit), inject submit step
                    if (actions && Array.isArray(actions) && (screen.hasCheckboxes || type === 'multi-select')) {
                        const hasSubmitAction = actions.some(a => a.reason === 'submit');
                        if (!hasSubmitAction) {
                            // Find the submit button index (disabled or not — it becomes enabled after option click)
                            const submitIdx = screen.clickables.findIndex(c => c.isSubmit || c.isDisabled);
                            if (submitIdx >= 0) {
                                console.log(`[Clone-Stream] 🤖 AI forgot submit for multi-select, injecting submit at idx ${submitIdx}`);
                                actions = [...actions, { wait: 1500 }, { click: submitIdx, reason: 'submit' }];
                            }
                        }
                    }
                    
                    if (actions && Array.isArray(actions) && actions.length > 0) {
                        console.log('[Clone-Stream] 🤖 AI navigation:', JSON.stringify(actions));
                        prevHash = await getContentHash();
                        
                        let lastClickedOption = false;
                        for (const action of actions) {
                            if (action.wait) {
                                await delay(action.wait);
                            } else if (action.click !== undefined && action.click >= 0 && action.click < screen.clickables.length) {
                                const target = screen.clickables[action.click];
                                const isSubmitAction = action.reason === 'submit';
                                
                                if (isSubmitAction && lastClickedOption) {
                                    // For submit after option click: re-find button with FRESH DOM coordinates
                                    // The button may have moved or become enabled after option selection
                                    await delay(500);
                                    const freshBtn = await pg.evaluate(() => {
                                        const pattern = /continuar|continue|siguiente|next|enviar|submit|avançar|comenzar|empezar|seguir/i;
                                        const btns = [...document.querySelectorAll('button, [role="button"], a')].filter(el => {
                                            const r = el.getBoundingClientRect();
                                            if (r.height < 20 || r.width < 40 || r.top > 1200 || r.top < 0) return false;
                                            const text = (el.innerText || '').trim();
                                            if (text.length > 80) return false;
                                            const disabled = el.disabled || el.classList.contains('cursor-not-allowed');
                                            return !disabled && (pattern.test(text) || (r.width > 200 && r.height >= 40 && r.height <= 70));
                                        }).sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
                                        if (btns.length > 0) {
                                            const r = btns[0].getBoundingClientRect();
                                            return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: (btns[0].innerText || '').trim().slice(0, 50) };
                                        }
                                        return null;
                                    });
                                    if (freshBtn) {
                                        console.log(`[Clone-Stream] 🤖 AI submit (fresh coords): "${freshBtn.text}"`);
                                        await pg.mouse.click(freshBtn.x, freshBtn.y);
                                    } else {
                                        console.log(`[Clone-Stream] 🤖 AI submit using original coords: "${target.text}"`);
                                        await pg.mouse.click(target.x, target.y);
                                    }
                                } else {
                                    console.log(`[Clone-Stream] 🤖 AI clicking [${action.click}]: "${target.text}" (${action.reason || ''})`);
                                    await pg.mouse.click(target.x, target.y);
                                    if (!isSubmitAction) lastClickedOption = true;
                                }
                                await delay(800);
                            }
                        }
                        
                        // Check if page actually advanced
                        await delay(2000);
                        const newHash = await getContentHash();
                        if (newHash !== prevHash) {
                            advanced = true;
                            console.log('[Clone-Stream] 🤖 AI navigation succeeded!');
                        } else {
                            // Last resort: try clicking the LOWEST non-disabled button on the page
                            const lowestBtn = await pg.evaluate(() => {
                                const btns = [...document.querySelectorAll('button, [role="button"]')].filter(el => {
                                    const r = el.getBoundingClientRect();
                                    return r.height > 20 && r.width > 40 && r.top > 0 && r.top < 1200 && !el.disabled && !el.classList.contains('cursor-not-allowed');
                                }).sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
                                if (btns.length > 0) {
                                    const r = btns[0].getBoundingClientRect();
                                    return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: (btns[0].innerText || '').trim().slice(0, 50) };
                                }
                                return null;
                            });
                            if (lowestBtn) {
                                console.log(`[Clone-Stream] 🤖 AI retry lowest button: "${lowestBtn.text}"`);
                                await pg.mouse.click(lowestBtn.x, lowestBtn.y);
                                await delay(2500);
                                const nh2 = await getContentHash();
                                if (nh2 !== prevHash) { advanced = true; console.log('[Clone-Stream] 🤖 AI retry succeeded!'); }
                            }
                            if (!advanced) console.log('[Clone-Stream] 🤖 AI navigation did not advance, trying fallbacks...');
                        }
                    }
                } catch (aiErr) {
                    console.log('[Clone-Stream] 🤖 AI navigation error:', aiErr.message);
                }
            }

            if (!advanced && options.length === 0) {
                // ── INFO / SLIDER / INPUT PAGE (no options, just a submit/continue button) ──
                console.log('[Clone-Stream] Info page, looking for submit buttons...');
                
                // Try standard submit buttons
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
                
                // Try interacting with sliders, range inputs, and custom inputs
                if (!advanced) {
                    console.log('[Clone-Stream] Trying to interact with sliders/inputs...');
                    await pg.evaluate(() => {
                        // Fill range/slider inputs with middle value
                        document.querySelectorAll('input[type="range"]').forEach(el => {
                            const min = parseFloat(el.min) || 0;
                            const max = parseFloat(el.max) || 100;
                            el.value = Math.round((min + max) / 2);
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        });
                        // Fill number inputs with reasonable defaults
                        document.querySelectorAll('input[type="number"], input[type="text"]').forEach(el => {
                            if (!el.value && el.getBoundingClientRect().height > 0) {
                                const placeholder = el.placeholder?.toLowerCase() || '';
                                if (placeholder.includes('peso') || placeholder.includes('weight') || placeholder.includes('kg')) {
                                    el.value = '70';
                                } else if (placeholder.includes('altura') || placeholder.includes('height') || placeholder.includes('cm')) {
                                    el.value = '165';
                                } else if (placeholder.includes('edad') || placeholder.includes('age') || placeholder.includes('idade')) {
                                    el.value = '35';
                                } else {
                                    el.value = '50';
                                }
                                el.dispatchEvent(new Event('input', { bubbles: true }));
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        });
                        // Click on any custom slider/dial elements
                        document.querySelectorAll('[class*="slider"], [class*="range"], [class*="dial"], [class*="thumb"], [class*="knob"], [class*="picker"]').forEach(el => {
                            const r = el.getBoundingClientRect();
                            if (r.height > 10 && r.width > 10) {
                                el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2 }));
                            }
                        });
                    }).catch(() => {});
                    
                    await delay(1500);
                    
                    // After interacting, look for submit buttons that may have appeared
                    const newScreen = await extractScreen();
                    const newSubmits = findSubmits(newScreen);
                    prevHash = await getContentHash();
                    for (const btn of newSubmits) {
                        advanced = await clickAndWait(btn);
                        if (advanced) break;
                    }
                }
                
                // XPath fallback for Continuar/Next buttons
                if (!advanced) {
                    try {
                        const xpathBtn = await pg.$x(
                            '//button[contains(text(),"Continuar")] | //a[contains(text(),"Continuar")]' +
                            ' | //button[contains(text(),"Siguiente")] | //a[contains(text(),"Siguiente")]' +
                            ' | //button[contains(text(),"Continue")] | //a[contains(text(),"Continue")]' +
                            ' | //button[contains(text(),"Next")] | //a[contains(text(),"Next")]' +
                            ' | //button[contains(text(),"Avançar")] | //a[contains(text(),"Avançar")]' +
                            ' | //div[contains(text(),"Continuar")] | //span[contains(text(),"Continuar")]'
                        );
                        if (xpathBtn.length > 0) {
                            console.log('[Clone-Stream] XPath found', xpathBtn.length, 'buttons');
                            prevHash = await getContentHash();
                            await xpathBtn[0].click();
                            await delay(2500);
                            const nh = await getContentHash();
                            if (nh !== prevHash) advanced = true;
                        }
                    } catch {}
                }
            } else if (type === 'multi-select' || screen.hasCheckboxes) {
                // ── MULTI-SELECT / CHECKBOX PAGE ──
                console.log('[Clone-Stream] Multi-select page detected, clicking option then submit');
                
                // Step 1: Click first option using native Puppeteer click
                if (options.length > 0) {
                    await pg.mouse.click(options[0].x, options[0].y);
                    console.log('[Clone-Stream] Clicked multi-select option:', options[0].text);
                }
                
                // Step 2: Wait for Continuar/Submit button to become enabled
                // Many quizzes disable the submit button until at least one option is selected
                await delay(1500);
                
                // Step 3: Find and click the submit button using Puppeteer native click
                // First try via extractScreen to get updated button states
                for (let attempt = 0; attempt < 3 && !advanced; attempt++) {
                    if (attempt > 0) await delay(1000);
                    
                    // Find submit button — check element's OWN text, not nested children
                    const submitClicked = await pg.evaluate(() => {
                        const submitPattern = /continuar|continue|pr[oó]ximo|next|come[cç]ar|start|enviar|submit|avan[cç]ar|siguiente|comenzar/i;
                        
                        // Get element's direct text (excluding children text)
                        function getDirectText(el) {
                            let text = '';
                            for (const node of el.childNodes) {
                                if (node.nodeType === 3) text += node.textContent; // TEXT_NODE
                            }
                            return text.trim();
                        }
                        
                        const candidates = [...document.querySelectorAll('button, [role="button"], a')].filter(el => {
                            const r = el.getBoundingClientRect();
                            if (r.height < 20 || r.height > 100 || r.width < 40 || r.top > 1200 || r.top < 0) return false;
                            const text = (el.innerText || '').trim();
                            if (!submitPattern.test(text)) return false;
                            if (text.length > 80) return false; // Too long = container, not button
                            const isDisabled = el.disabled || el.classList.contains('cursor-not-allowed') || el.getAttribute('aria-disabled') === 'true';
                            return !isDisabled;
                        });
                        
                        // Also look for div/span with DIRECT text matching submit pattern
                        const divCandidates = [...document.querySelectorAll('div, span')].filter(el => {
                            const r = el.getBoundingClientRect();
                            if (r.height < 20 || r.height > 80 || r.width < 40 || r.top > 1200 || r.top < 0) return false;
                            const directText = getDirectText(el);
                            if (!submitPattern.test(directText)) return false;
                            if (directText.length > 50) return false;
                            if (el.children.length > 2) return false; // Must be a leaf-ish element
                            const isDisabled = el.classList.contains('cursor-not-allowed') || el.getAttribute('aria-disabled') === 'true';
                            return !isDisabled;
                        });
                        
                        const all = [...candidates, ...divCandidates];
                        if (all.length > 0) {
                            const btn = all[0];
                            const r = btn.getBoundingClientRect();
                            return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: (btn.innerText || '').trim().slice(0, 50) };
                        }
                        return null;
                    });
                    
                    if (submitClicked) {
                        console.log('[Clone-Stream] Found enabled submit button:', submitClicked.text);
                        prevHash = await getContentHash();
                        await pg.mouse.click(submitClicked.x, submitClicked.y);
                        await delay(2500);
                        const nh = await getContentHash();
                        if (nh !== prevHash) { advanced = true; break; }
                    }
                }
                
                // Step 4: XPath fallback
                if (!advanced) {
                    try {
                        const continueBtn = await pg.$x(
                            '//button[contains(text(),"Continuar")] | //a[contains(text(),"Continuar")]' +
                            ' | //button[contains(text(),"Siguiente")] | //a[contains(text(),"Siguiente")]' +
                            ' | //button[contains(text(),"Continue")] | //a[contains(text(),"Continue")]' +
                            ' | //button[contains(text(),"Next")] | //a[contains(text(),"Next")]' +
                            ' | //button[contains(text(),"Avançar")] | //a[contains(text(),"Avançar")]' +
                            ' | //div[contains(text(),"Continuar")] | //span[contains(text(),"Continuar")]'
                        );
                        if (continueBtn.length > 0) {
                            prevHash = await getContentHash();
                            await continueBtn[0].click();
                            await delay(2500);
                            const nh = await getContentHash();
                            if (nh !== prevHash) advanced = true;
                        }
                    } catch {}
                }
            } else if (type === 'loading') {
                // ── LOADING/ANIMATION PAGE ──
                console.log('[Clone-Stream] Loading/animation page, waiting for completion...');
                // Wait longer for animated progress pages (some take 15-20s)
                for (let waitI = 0; waitI < 8; waitI++) {
                    await delay(3000);
                    const newHash = await getContentHash();
                    if (newHash !== prevHash) { advanced = true; prevHash = newHash; break; }
                }
                // Let DOM fully stabilize after animation
                if (!advanced) {
                    await delay(3000);
                    prevHash = await getContentHash();
                }
                // Try clicking submit/continuar that may have appeared
                if (!advanced) {
                    const newScreen = await extractScreen();
                    console.log('[Clone-Stream] After loading wait - clickables:', newScreen.clickables.length, 'texts:', newScreen.texts.length);
                    const submits = findSubmits(newScreen);
                    for (const btn of submits) {
                        advanced = await clickAndWait(btn);
                        if (advanced) break;
                    }
                }
                // XPath fallback after loading
                if (!advanced) {
                    try {
                        const xpathBtn = await pg.$x(
                            '//button[contains(text(),"Continuar")] | //a[contains(text(),"Continuar")]' +
                            ' | //button[contains(text(),"Siguiente")] | //a[contains(text(),"Siguiente")]' +
                            ' | //button[contains(text(),"Continue")] | //button[contains(text(),"Next")]' +
                            ' | //button[contains(text(),"Avançar")] | //button[contains(text(),"Comenzar")]' +
                            ' | //div[contains(text(),"Continuar")] | //span[contains(text(),"Continuar")]' +
                            ' | //button[contains(text(),"TESTE")] | //button[contains(text(),"teste")]' +
                            ' | //div[contains(text(),"TESTE")] | //a[contains(text(),"TESTE")]'
                        );
                        if (xpathBtn.length > 0) {
                            console.log('[Clone-Stream] XPath found', xpathBtn.length, 'buttons after loading');
                            prevHash = await getContentHash();
                            await xpathBtn[0].click();
                            await delay(2500);
                            const nh = await getContentHash();
                            if (nh !== prevHash) advanced = true;
                        }
                    } catch {}
                }
                // Try scrolling down to find hidden buttons
                if (!advanced) {
                    const scrolled = await scrollAndExtract();
                    const scrollSubmits = findSubmits(scrolled);
                    prevHash = await getContentHash();
                    for (const btn of scrollSubmits) {
                        advanced = await clickAndWait(btn);
                        if (advanced) break;
                    }
                }
            } else {
                // ── QUESTION PAGE (has options) ──
                // Step 1: Click first option
                advanced = await clickAndWait(options[0]);

                // Step 2: If didn't auto-advance, look for submit/Continuar
                if (!advanced) {
                    await delay(500);
                    prevHash = await getContentHash();
                    const newScreen = await extractScreen();
                    const newSubmits = findSubmits(newScreen);
                    for (const btn of newSubmits) {
                        advanced = await clickAndWait(btn);
                        if (advanced) break;
                    }
                }
                // Step 3: Scroll down to find buttons below viewport
                if (!advanced) {
                    const scrolled = await scrollAndExtract();
                    const scrollSubmits = findSubmits(scrolled);
                    prevHash = await getContentHash();
                    for (const btn of scrollSubmits) {
                        advanced = await clickAndWait(btn);
                        if (advanced) break;
                    }
                }
                // Step 4: XPath fallback for Continuar/Continue/Next/Siguiente
                if (!advanced) {
                    try {
                        const xpathBtn = await pg.$x(
                            '//button[contains(text(),"Continuar")] | //a[contains(text(),"Continuar")]' +
                            ' | //button[contains(text(),"Siguiente")] | //a[contains(text(),"Siguiente")]' +
                            ' | //button[contains(text(),"Continue")] | //a[contains(text(),"Continue")]' +
                            ' | //button[contains(text(),"Next")] | //a[contains(text(),"Next")]' +
                            ' | //button[contains(text(),"Avançar")] | //a[contains(text(),"Avançar")]' +
                            ' | //button[contains(text(),"Comenzar")] | //a[contains(text(),"Comenzar")]' +
                            ' | //div[contains(text(),"Continuar")] | //span[contains(text(),"Continuar")]' +
                            ' | //div[contains(text(),"Siguiente")] | //span[contains(text(),"Siguiente")]'
                        );
                        if (xpathBtn.length > 0) {
                            prevHash = await getContentHash();
                            await xpathBtn[0].click();
                            await delay(2500);
                            const nh = await getContentHash();
                            if (nh !== prevHash) advanced = true;
                        }
                    } catch {}
                }
            }

            // ── UNIVERSAL FALLBACK: Click lowest visible non-disabled button ──
            if (!advanced) {
                const lowestBtn = await pg.evaluate(() => {
                    const navPattern = /voltar|back|prev|skip|anterior|logo|cookie|privacy|termos|fechar|close|inlead|central|©|criado via/i;
                    const buttons = [...document.querySelectorAll('button, [role="button"], a')].filter(el => {
                        const r = el.getBoundingClientRect();
                        if (r.height < 15 || r.width < 30 || r.top > 1200 || r.top < 0) return false;
                        const text = (el.innerText || '').trim();
                        if (text.length < 1 || text.length > 200 || navPattern.test(text)) return false;
                        const isDisabled = el.disabled || el.classList.contains('cursor-not-allowed') || el.getAttribute('aria-disabled') === 'true';
                        return !isDisabled;
                    }).sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top); // sort by Y desc (lowest first)
                    if (buttons.length > 0) {
                        const btn = buttons[0]; // lowest button
                        const r = btn.getBoundingClientRect();
                        return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: (btn.innerText || '').trim().slice(0, 50) };
                    }
                    return null;
                });
                if (lowestBtn) {
                    console.log('[Clone-Stream] Universal fallback: clicking lowest button:', lowestBtn.text);
                    prevHash = await getContentHash();
                    await pg.mouse.click(lowestBtn.x, lowestBtn.y);
                    await delay(2500);
                    const nh = await getContentHash();
                    if (nh !== prevHash) advanced = true;
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

        // Clean up internal metadata from pages + detect warnings
        allPages.forEach(p => {
            delete p._hash;
            p.clonePageType = p._pageType || 'choice';
            delete p._pageType;
            delete p._screenshot;

            // ── Detect complex elements that may need review ──
            const fc = (p.fullCode || '').toLowerCase();
            // Strip HTML tags to get text-only content for keyword matching
            const textOnly = fc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
            p.warnings = [];

            // Carousel / Slider galleries — only match class names or data attributes
            if (/class\s*=\s*["'][^"']*(?:swiper|slick|carousel|slideshow)/.test(fc) ||
                fc.includes('clone-carousel') || fc.includes('data-carousel')) {
                p.warnings.push({ type: 'carousel', icon: '🎠', label: 'Carrossel', desc: 'Carrossel de imagens pode não funcionar corretamente sem o JavaScript original' });
            }

            // Charts / progress bars — only data attributes we injected
            if (fc.includes('data-clone-chart') || fc.includes('chartbargrow') || fc.includes('chartfadein')) {
                p.warnings.push({ type: 'chart', icon: '📊', label: 'Gráfico', desc: 'Gráfico ou barra de progresso animada' });
            }

            // Loading / animations — only when the PAGE TYPE is loading, or text says "calculando"/"analisando" etc
            if (p.clonePageType === 'loading' || /\b(calculando|analisando|processando|analyzing)\b/.test(textOnly)) {
                p.warnings.push({ type: 'animation', icon: '⏳', label: 'Animação', desc: 'Página de loading/animação pode não reproduzir' });
            }

            // Sliders / range inputs
            if (fc.includes('type="range"') || fc.includes("type='range'")) {
                p.warnings.push({ type: 'slider', icon: '🎚️', label: 'Slider', desc: 'Slider/input interativo que pode precisar de ajuste' });
            }

            // Videos
            if (fc.includes('<video') || fc.includes('youtube.com/embed') || fc.includes('vimeo.com/video') || fc.includes('player.vimeo')) {
                p.warnings.push({ type: 'video', icon: '🎬', label: 'Vídeo', desc: 'Vídeo embutido pode não carregar no clone' });
            }
        });

        // ═══ TRANSLATE PAGES IF LANGUAGE SELECTED ═══
        console.log(`[Clone-Stream] Translation check: targetLang="${targetLang}", OPENAI_KEY=${OPENAI_KEY ? 'SET' : 'NOT SET'}, pages=${allPages.length}`);
        if (targetLang && OPENAI_KEY) {
            const langNames = { pt: 'Português (Brasil)', en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch' };
            const langName = langNames[targetLang] || targetLang;
            console.log(`[Clone-Stream] 🌐 Starting translation to ${langName} for ${allPages.length} pages...`);
            send('progress', { stage: 'translating', msg: `🌐 Traduzindo para ${langName}...`, pct: 90 });

            // Helper: extract visible text strings from HTML
            function extractTexts(html) {
                const texts = [];
                // Remove script/style content first
                const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
                // Match text between tags
                const matches = cleaned.match(/>[^<]+</g) || [];
                for (const m of matches) {
                    const t = m.slice(1, -1).trim();
                    if (t.length >= 2 && !/^[\s\d.,;:!?@#$%^&*()+=\-_\[\]{}|\\/<>'"~`]+$/.test(t) && !/^https?:/.test(t)) {
                        texts.push(t);
                    }
                }
                return [...new Set(texts)]; // deduplicate
            }

            // Helper: translate a batch of texts via OpenAI
            async function translateBatch(texts, lang) {
                const numberedTexts = texts.map((t, i) => `[${i}] ${t}`).join('\n');
                const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [{
                            role: 'system',
                            content: `You are a professional translator. Translate each numbered text to ${lang}. Keep the numbering format [0], [1], etc. Do NOT translate brand names, URLs, or email addresses. Maintain formatting. Return ONLY the numbered translations.`
                        }, {
                            role: 'user',
                            content: `Translate these texts to ${lang}:\n\n${numberedTexts}`
                        }],
                        temperature: 0.3,
                        max_tokens: 4000,
                    })
                });
                if (!aiRes.ok) {
                    console.log(`[Clone] Translation API error: ${aiRes.status}`);
                    return texts; // fallback to original
                }
                const aiData = await aiRes.json();
                const content = aiData.choices?.[0]?.message?.content || '';
                const translated = [];
                for (let i = 0; i < texts.length; i++) {
                    const regex = new RegExp(`\\[${i}\\]\\s*(.+?)(?=\\n\\[\\d+\\]|$)`, 's');
                    const match = content.match(regex);
                    translated.push(match ? match[1].trim() : texts[i]);
                }
                return translated;
            }

            for (let pi = 0; pi < allPages.length; pi++) {
                const page = allPages[pi];
                if (!page.code || page.code.length < 20) continue;
                try {
                    const texts = extractTexts(page.code);
                    if (texts.length === 0) { console.log(`[Clone] Page ${pi}: no texts found`); continue; }
                    console.log(`[Clone] Page ${pi}: found ${texts.length} text strings to translate`);

                    // Translate in batches of 30
                    const batchSize = 30;
                    const allTranslated = [];
                    for (let b = 0; b < texts.length; b += batchSize) {
                        const batch = texts.slice(b, b + batchSize);
                        const result = await translateBatch(batch, langName);
                        allTranslated.push(...result);
                    }

                    // Replace texts in HTML
                    let translatedCode = page.code;
                    for (let ti = 0; ti < texts.length; ti++) {
                        if (allTranslated[ti] && allTranslated[ti] !== texts[ti]) {
                            // Escape regex special chars in original text
                            const escaped = texts[ti].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            translatedCode = translatedCode.replace(new RegExp(`(>\\s*)${escaped}(\\s*<)`, 'g'), `$1${allTranslated[ti]}$2`);
                        }
                    }
                    allPages[pi].code = translatedCode;
                    allPages[pi].fullCode = translatedCode;
                    console.log(`[Clone] Page ${pi} translated ✅ (${texts.length} strings)`);
                } catch (transErr) {
                    console.log(`[Clone] Translation failed for page ${pi}:`, transErr.message);
                }
                send('progress', { stage: 'translating', msg: `🌐 Traduzindo página ${pi + 1}/${allPages.length}...`, pct: 90 + Math.round((pi / allPages.length) * 8) });
            }
            // Translate welcome data
            if (welcomeData) {
                try {
                    const wTexts = [welcomeData.headline || '', welcomeData.subheadline || '', welcomeData.cta || ''].filter(t => t.length > 0);
                    if (wTexts.length > 0) {
                        const wTranslated = await translateBatch(wTexts, langName);
                        let idx = 0;
                        if (welcomeData.headline) { welcomeData.headline = wTranslated[idx] || welcomeData.headline; idx++; }
                        if (welcomeData.subheadline) { welcomeData.subheadline = wTranslated[idx] || welcomeData.subheadline; idx++; }
                        if (welcomeData.cta) { welcomeData.cta = wTranslated[idx] || welcomeData.cta; }
                    }
                } catch {}
            }
        }

        const quizResult = {
            cloneSessionId,
            quizName: welcomeData?.headline || 'Quiz Clonado',
            niche: 'outro',
            primaryColor: rgb2hex(quizTheme.ctaColor) || rgb2hex(quizTheme.themeColor) || '#2563eb',
            bgColor: rgb2hex(quizTheme.bgColor) || '#ffffff',
            titleColor: rgb2hex(quizTheme.titleColor) || '',
            contentFont: (quizTheme.contentFont || '').split(',')[0].replace(/["']/g, '').trim() || '',
            borderRadius: quizTheme.rounded || '',
            welcome: {
                headline: welcomeData?.headline || 'Quiz Clonado',
                subheadline: welcomeData?.subheadline || '',
                cta: welcomeData?.cta || 'Começar →',
                logoUrl: welcomeData?.logoUrl || '',
                heroImageUrl: welcomeData?.heroImageUrl || '',
            },
            pages: allPages,
            clonedCSS: {
                cssText: cachedCSS.cssText,
                cssVars: cachedCSS.cssVars,
                bodyBg: cachedCSS.bodyBg,
                bodyColor: cachedCSS.bodyColor,
                bodyFont: cachedCSS.bodyFont,
            },
            results: [
                { id: 'r1', name: 'Resultado A', description: 'Seu perfil indica...', cta: 'Ver recomendação →', minPct: 0, maxPct: 50 },
                { id: 'r2', name: 'Resultado B', description: 'Seu perfil indica...', cta: 'Ver recomendação →', minPct: 51, maxPct: 100 },
            ],
            collectLead,
        };

        send('progress', { stage: 'building', msg: `🧱 Montando quiz com ${allPages.length} páginas...`, pct: 98 });
        send('result', { quiz: quizResult });
        send('progress', { stage: 'complete', msg: `✅ ${allPages.length} páginas clonadas com formato visual!`, pct: 100 });
        clearInterval(keepAlive);
        res.end();

    } catch (err) {
        console.error('[Clone-Stream] Error:', err.message);
        if (browser) try { await browser.close(); } catch { }
        send('error', { error: err.message || 'Erro ao clonar' });
        clearInterval(keepAlive);
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
    const indexHtml = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
    app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
        res.type('html').send(indexHtml);
    });
    console.log('📦 Serving frontend from dist/');
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Quiz API rodando em http://localhost:${PORT}`);
    console.log(`📁 Banco de dados: ${path.join(dbDir, 'quizzes.db')}`);
    console.log(`🖼️  Uploads: ${uploadsDir}`);
    console.log(`🤖 OpenAI API: ${OPENAI_KEY ? '✅ Configurada' : '❌ Não configurada'}`);
});
