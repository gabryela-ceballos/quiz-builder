const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
`);

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
app.get('/api/quizzes', (req, res) => {
    const rows = db.prepare('SELECT id, data, created_at, updated_at FROM quizzes ORDER BY updated_at DESC').all();
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
app.post('/api/quizzes', (req, res) => {
    const quiz = req.body;
    const id = quiz.id || Math.random().toString(36).slice(2, 10);
    const now = Date.now();
    const data = JSON.stringify({ ...quiz, id, updatedAt: now });

    const existing = db.prepare('SELECT id FROM quizzes WHERE id = ?').get(id);
    if (existing) {
        db.prepare('UPDATE quizzes SET data = ?, updated_at = ? WHERE id = ?').run(data, now, id);
    } else {
        db.prepare('INSERT INTO quizzes (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, data, now, now);
    }
    res.json({ ...quiz, id, updatedAt: now });
});

// DELETE single quiz
app.delete('/api/quizzes/:id', (req, res) => {
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

    const starts = events.filter(e => e.event === 'start').length;
    const completes = events.filter(e => e.event === 'complete').length;
    const answers = events.filter(e => e.event === 'answer');

    res.json({ starts, completes, conversionRate: starts ? Math.round(completes / starts * 100) : 0, events, answers });
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

app.post('/api/generate-quiz', async (req, res) => {
    const { productName, productDescription, niche, questionCount = 10 } = req.body;
    if (!productName) return res.status(400).json({ error: 'Nome do produto obrigatório' });
    if (!OPENAI_KEY) return res.status(400).json({ error: 'VITE_OPENAI_API_KEY não configurada no .env' });

    try {
        console.log(`[AI] Gerando quiz para "${productName}" (${niche}, ${questionCount} perguntas)...`);

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
        const quizContent = await callOpenAI(`Crie um quiz completo com ${questionCount} perguntas para o produto "${productName}".

Nicho: ${metadata.niche || niche}
Sub-tema: ${metadata.subTheme || productName}
Tom: ${metadata.tone || 'empático'}

Retorne JSON com esta estrutura EXATA:
{
  "welcome": {
    "headline": "Título chamativo do quiz",
    "subheadline": "Subtítulo explicativo",
    "cta": "Texto do botão →"
  },
  "pages": [
    {"type": "choice", "text": "Pergunta?", "options": [{"text": "Opção 1", "emoji": "😊", "weight": 1}, {"text": "Opção 2", "emoji": "💪", "weight": 2}]},
    {"type": "likert", "text": "Com que frequência...?", "options": [{"text": "Nunca", "value": 1, "weight": 1}, {"text": "Raramente", "value": 2, "weight": 2}, {"text": "Às vezes", "value": 3, "weight": 3}, {"text": "Frequentemente", "value": 4, "weight": 4}, {"text": "Sempre", "value": 5, "weight": 5}]},
    {"type": "statement", "text": "Afirmação reflexiva", "quote": "Frase motivacional", "options": ["Discordo vivamente", "Discordo parcialmente", "Concordo parcialmente", "Concordo vivamente"]},
    {"type": "insight", "title": "Você sabia?", "body": "Texto educativo com dado estatístico relevante."},
    {"type": "social-proof", "headline": "87% das pessoas", "subheadline": "descobriram que tinham esse problema"}
  ],
  "results": [
    {"id": "baixo", "name": "Perfil Iniciante", "minPct": 0, "maxPct": 40, "description": "Descrição detalhada do perfil...", "cta": "Comece sua jornada →", "ctaUrl": ""},
    {"id": "medio", "name": "Perfil Intermediário", "minPct": 41, "maxPct": 70, "description": "Descrição detalhada...", "cta": "Eleve seu nível →", "ctaUrl": ""},
    {"id": "alto", "name": "Perfil Avançado", "minPct": 71, "maxPct": 100, "description": "Descrição detalhada...", "cta": "Alcance a excelência →", "ctaUrl": ""}
  ]
}

REGRAS:
- Gere exatamente ${questionCount} pages (perguntas + insights intercalados)
- ~50% choice, ~20% likert, ~15% statement, ~15% insight/social-proof  
- Distribua os tipos: NÃO coloque todos do mesmo tipo seguidos
- Cada choice deve ter 3-5 opções com emoji e weight
- Cada likert deve ter 5 opções com value 1-5
- Adicione 1-2 insights entre as perguntas (dados e curiosidades sobre o tema)
- Adicione 1 social-proof no meio do quiz
- 3 resultados que cubram 0-100% sem gaps
- Perguntas específicas ao sub-tema "${metadata.subTheme || productName}", nunca genéricas
- Tudo em português brasileiro
- Retorne SOMENTE o JSON`, {
            system: 'Você é um especialista em quiz funnels de alta conversão. Crie quizzes envolventes e personalizados.',
            temperature: 0.75,
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

        // Page steps
        if (quizContent.pages?.length) {
            quizContent.pages.forEach((page, i) => {
                const block = { ...page };
                if (block.options && Array.isArray(block.options)) {
                    block.options = block.options.map(opt => {
                        if (typeof opt === 'string') return { text: opt, emoji: '', weight: 1 };
                        return { text: opt.text || '', emoji: opt.emoji || '', weight: opt.weight || 1, ...(opt.value !== undefined ? { value: opt.value } : {}) };
                    });
                }
                if (block.type === 'choice') block.optionLayout = block.optionLayout || 'list';
                steps.push({
                    id: `stp_${Date.now()}_${i}`,
                    name: block.text || block.title || block.headline || `Etapa ${i + 1}`,
                    blocks: [block],
                });
            });
        }

        // Extract questions for Player compatibility
        const questions = (quizContent.pages || [])
            .filter(p => ['choice', 'multi-select', 'statement', 'likert', 'image-select'].includes(p.type))
            .map(p => {
                const q = { ...p };
                if (q.options) q.options = q.options.map(o => typeof o === 'string' ? { text: o, emoji: '' } : o);
                return q;
            });

        const result = {
            id: quizId,
            name: `Quiz: ${productName}`,
            emoji: '📊',
            primaryColor: metadata.palette?.[0] || '#2563eb',
            niche: niche,
            welcome: quizContent.welcome,
            steps,
            pages: quizContent.pages || [],
            questions,
            results: quizContent.results || [],
            collectLead: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        console.log(`[AI] Step 3/3 ✅ Quiz "${productName}" gerado: ${steps.length} steps, ${questions.length} questions`);
        res.json(result);
    } catch (err) {
        console.error('[AI] ❌ Erro:', err.message);
        res.status(500).json({ error: err.message });
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
                    const isNav = /voltar|back|prev|skip|pular|anterior|logo|cookie|privacy|privacidade|termos|assinatura|fechar|close|sign.?up|sign.?in|log.?in|register|pricing|features|blog|about|contact|home|faq|pol[ií]tica/i.test(text);
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

            // Build page
            if (type === 'welcome') {
                welcomeData = buildPage(screen, type);
            } else if (type === 'lead') {
                collectLead = true;
            } else if (type !== 'input') {
                const pageObj = buildPage(screen, type);
                if (pageObj) allPages.push(pageObj);
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

            // Strategy 4: Try keyboard (Enter, Space, ArrowRight)
            if (!advanced) {
                try {
                    await pg.keyboard.press('Enter');
                    await delay(1500);
                    const h = await getContentHash();
                    if (h !== prevHash) advanced = true;
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

// ── Serve built frontend (production) ──
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    // SPA fallback — all non-API routes serve index.html
    app.get('*', (req, res) => {
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
