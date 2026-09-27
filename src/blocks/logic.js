// logic.js — answers, variables, conditions, actions and scoring for the v2 quiz renderer

// ── Block families ──
export const SINGLE_SELECT_TYPES = new Set(['single-choice', 'yes-no', 'rating', 'nps', 'likert', 'statement', 'video-response']);
export const ANSWERABLE_TYPES = new Set([
    'choice', 'single-choice', 'image-select', 'yes-no', 'rating', 'nps', 'slider', 'likert', 'statement', 'video-response',
    'text-input', 'email-input', 'phone-input', 'textarea-input', 'date-input',
]);
// Blocks that move the quiz forward on their own (they render their own button / finish by themselves)
export const OWN_ADVANCE_TYPES = new Set([
    'button', 'welcome', 'capture', 'scroll-picker', 'weight-picker', 'number-input', 'bmi', 'loading', 'progress-bar', 'risk-chart', 'result',
]);

export function isSingleSelect(block) {
    if (!block) return false;
    if (SINGLE_SELECT_TYPES.has(block.type)) return true;
    if (block.type === 'choice') return !block.multiSelect;
    if (block.type === 'image-select') return block.multiSelect === false;
    return false;
}

// A step holding a page cloned from an external quiz (rendered full-bleed by ClonedPage)
export function isCloneStep(step) {
    const b = step?.blocks?.[0];
    return !!b && b.type === 'html-script' && !b.executeOnLoad && (b.fullCode !== undefined || !!b.clonePageType || !!b._pageType || (step.blocks.length === 1 && /<(div|section|body|main)\b/i.test(b.code || '')));
}

// Cloned HTML step: which step an answered option leads to (branches found by the cloner)
export function routeForAnswer(step, answer) {
    const n = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const a = n(answer);
    if (!a) return null;
    const hit = (step?.clone?.optionRoutes || []).find(r => n(r.text) && (a === n(r.text) || a.includes(n(r.text))));
    return hit ? { type: 'goto', stepId: hit.stepId } : null;
}

export function isMultiSelect(block) {
    return (block?.type === 'choice' && !!block.multiSelect) || (block?.type === 'image-select' && block.multiSelect !== false);
}

// ── Options ──
export const optId = (o, i) => (o && typeof o === 'object' && o.id) || `o${i}`;

export function getOptions(block) {
    if (!block) return [];
    if (block.type === 'yes-no') {
        return [
            { id: 'yes', text: block.yesLabel || 'Sim', emoji: block.yesEmoji ?? '✅', action: block.yesAction, points: block.yesPoints },
            { id: 'no', text: block.noLabel || 'Não', emoji: block.noEmoji ?? '🚫', action: block.noAction, points: block.noPoints },
        ];
    }
    return (block.options || []).map((o, i) => (typeof o === 'string' ? { id: `o${i}`, text: o } : { ...o, id: optId(o, i) }));
}

export function newOptionId() {
    return `o_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Answers ──
// answers: { [blockId]: { ids?: string[], idx?: number[], value?: any, text: string, other?: string } }
export function choiceAnswer(block, ids, other) {
    const opts = getOptions(block);
    const idx = ids.map(id => opts.findIndex(o => o.id === id)).filter(i => i >= 0);
    const labels = idx.map(i => {
        const o = opts[i];
        return o.isOther && other ? `${o.text}: ${other}` : o.text;
    });
    return { ids, idx, text: labels.join(', '), other };
}

export function valueAnswer(value, unit = '') {
    return { value, text: value === undefined || value === null || value === '' ? '' : `${value}${unit ? ` ${unit}` : ''}` };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isAnswerValid(block, answer) {
    if (!block) return true;
    const required = block.required === undefined ? !['textarea-input', 'date-input'].includes(block.type) : !!block.required;
    const empty = !answer || (answer.ids ? answer.ids.length === 0 : (answer.value === undefined || answer.value === null || String(answer.value).trim() === ''));
    if (empty) return !required;
    if (block.type === 'email-input') return EMAIL_RE.test(String(answer.value).trim());
    if (block.type === 'phone-input') return String(answer.value).replace(/\D/g, '').length >= 10;
    if (answer.ids && isMultiSelect(block)) {
        const min = Number(block.minSelect) || 0;
        const max = Number(block.maxSelect) || 0;
        if (min && answer.ids.length < min) return false;
        if (max && answer.ids.length > max) return false;
    }
    return true;
}

export function formatPhone(v) {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ── Variables ──
export const DEFAULT_VARS = [
    { key: 'nome', label: 'Nome' },
    { key: 'primeiro_nome', label: 'Primeiro nome' },
    { key: 'email', label: 'E-mail' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'pontos', label: 'Pontuação' },
];

export function defaultVarName(block) {
    if (!block) return '';
    if (block.varName) return block.varName;
    if (block.type === 'email-input') return 'email';
    if (block.type === 'phone-input') return 'telefone';
    return '';
}

export function buildVars(steps, answers) {
    const vars = {};
    (steps || []).forEach(s => (s.blocks || []).forEach(b => {
        const a = answers[b.id];
        if (!a) return;
        if (b.type === 'capture' && a.value) {
            if (a.value.name) vars.nome = a.value.name;
            if (a.value.email) vars.email = a.value.email;
            if (a.value.phone) vars.telefone = a.value.phone;
        }
        const key = defaultVarName(b);
        // Numbers stay numeric so formulas ({{= peso - peso_meta}}) work
        if (key) vars[key] = typeof a.value === 'number' ? a.value : (a.text ?? String(a.value ?? ''));
    }));
    if (vars.nome) vars.primeiro_nome = String(vars.nome).trim().split(/\s+/)[0];
    vars.pontos = computeScore(steps, answers);
    return vars;
}

export function interpolate(text, vars) {
    if (!text || typeof text !== 'string' || !text.includes('{{')) return text;
    return text
        .replace(/\{\{=\s*([^}]+?)\s*\}\}/g, (_, expr) => {
            const v = evaluateExpr(expr, vars || {});
            return v === null || v === undefined || (typeof v === 'number' && !isFinite(v)) ? '' : String(v);
        })
        .replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => {
            const v = vars?.[k] ?? vars?.[k.toLowerCase()];
            return v === undefined || v === null ? '' : String(v);
        });
}

// ── Formulas: {{= peso - peso_meta}}, {{= imc(peso, altura)}}, {{= data(7 * (peso - peso_meta), 'dd/mm')}} ──
const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const toNum = (v) => (typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')));
const FUNCS = {
    round: (x, d = 0) => { const f = Math.pow(10, toNum(d) || 0); return Math.round(toNum(x) * f) / f; },
    floor: (x) => Math.floor(toNum(x)),
    ceil: (x) => Math.ceil(toNum(x)),
    abs: (x) => Math.abs(toNum(x)),
    min: (...a) => Math.min(...a.map(toNum)),
    max: (...a) => Math.max(...a.map(toNum)),
    imc: (peso, altura) => { const h = toNum(altura) > 3 ? toNum(altura) / 100 : toNum(altura); return h ? toNum(peso) / (h * h) : NaN; },
    virgula: (x) => String(x).replace('.', ','),
    data: (dias, fmt = 'dd/mm') => {
        const d = new Date();
        d.setDate(d.getDate() + Math.round(toNum(dias) || 0));
        const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0');
        if (fmt === 'dd/mm/aaaa') return `${dd}/${mm}/${d.getFullYear()}`;
        if (fmt === 'extenso') return `${d.getDate()} de ${MONTHS_PT[d.getMonth()]}`;
        if (fmt === 'en') return `${MONTHS_EN[d.getMonth()]} ${d.getDate()}`;
        return `${dd}/${mm}`;
    },
};

export function evaluateExpr(src, vars) {
    const tokens = String(src).match(/\s*(\d+(?:[.,]\d+)?|[A-Za-z_][\w]*|'[^']*'|"[^"]*"|[-+*/%(),])/g);
    if (!tokens) return '';
    let pos = 0;
    const peek = () => tokens[pos]?.trim();
    const next = () => tokens[pos++]?.trim();
    const expect = (t) => { if (next() !== t) throw new Error(`esperado ${t}`); };
    const primary = () => {
        const t = next();
        if (t === undefined) throw new Error('fim inesperado');
        if (t === '(') { const v = expr(); expect(')'); return v; }
        if (t === '-') return -toNum(primary());
        if (t === '+') return toNum(primary());
        if (/^\d/.test(t)) return toNum(t);
        if (/^['"]/.test(t)) return t.slice(1, -1);
        if (peek() === '(') {
            next();
            const args = [];
            if (peek() !== ')') { args.push(expr()); while (peek() === ',') { next(); args.push(expr()); } }
            expect(')');
            const fn = FUNCS[t.toLowerCase()];
            return fn ? fn(...args) : NaN;
        }
        const v = vars[t] ?? vars[t.toLowerCase()];
        const n = toNum(v);
        return Number.isNaN(n) ? (v ?? '') : n;
    };
    const term = () => {
        let v = primary();
        while (['*', '/', '%'].includes(peek())) {
            const op = next(); const r = toNum(primary());
            v = op === '*' ? toNum(v) * r : op === '/' ? toNum(v) / r : toNum(v) % r;
        }
        return v;
    };
    function expr() {
        let v = term();
        while (['+', '-'].includes(peek())) {
            const op = next(); const r = term();
            v = op === '+' ? (typeof v === 'string' || typeof r === 'string' ? `${v}${r}` : v + r) : toNum(v) - toNum(r);
        }
        return v;
    }
    try {
        const v = expr();
        if (typeof v === 'number') return Math.round(v * 100) / 100;
        return v;
    } catch {
        return '';
    }
}

// ── Scoring ──
export function computeScore(steps, answers) {
    let total = 0;
    (steps || []).forEach(s => (s.blocks || []).forEach(b => {
        const a = answers[b.id];
        if (!a) return;
        if (a.ids) {
            const opts = getOptions(b);
            a.ids.forEach(id => { const o = opts.find(x => x.id === id); total += Number(o?.points) || 0; });
        } else if ((b.type === 'rating' || b.type === 'nps' || b.type === 'slider') && b.countPoints) {
            total += Number(a.value) || 0;
        }
    }));
    return total;
}

export function pickOutcome(block, score) {
    const outcomes = block?.outcomes || [];
    return outcomes.find(o => score >= (Number(o.min) || 0) && score <= (o.max === '' || o.max === undefined ? Infinity : Number(o.max))) || outcomes[outcomes.length - 1] || null;
}

// ── Conditions ──
// showIf: { blockId, op: 'is' | 'not' | 'answered' | 'gte' | 'lte', optionIds: [], value }
export function evaluateCondition(cond, answers) {
    if (!cond || !cond.blockId) return true;
    const a = answers[cond.blockId];
    const op = cond.op || 'is';
    if (op === 'answered') return !!a;
    if (!a) return op === 'not';
    if (op === 'gte') return Number(a.value) >= Number(cond.value);
    if (op === 'lte') return Number(a.value) <= Number(cond.value);
    const want = cond.optionIds || [];
    const hit = (a.ids || []).some(id => want.includes(id));
    return op === 'not' ? !hit : hit;
}

export function isBlockVisible(block, answers) {
    return evaluateCondition(block?.showIf, answers || {});
}

// ── Actions ──
// { type: 'next' | 'goto' | 'end' | 'url' | 'whatsapp', stepId, url, newTab, phone, message }
export function normalizeAction(a) {
    if (!a) return null;
    if (typeof a === 'string') return a === '__end' ? { type: 'end' } : { type: 'goto', stepId: a };
    if (typeof a === 'object' && a.type) return a;
    return null;
}

export function optionAction(opt) {
    return normalizeAction(opt?.action) || normalizeAction(opt?.goToStep);
}

export function buttonAction(block) {
    return normalizeAction(block?.action) || (block?.url ? { type: 'url', url: block.url, newTab: true } : { type: 'next' });
}

export function stepExitAction(step) {
    return normalizeAction(step?.exitAction) || normalizeAction(step?.goToStep) || { type: 'next' };
}

export function describeAction(a, steps = []) {
    const n = normalizeAction(a);
    if (!n || n.type === 'next') return 'Próxima etapa';
    if (n.type === 'goto') {
        const i = steps.findIndex(s => s.id === n.stepId);
        return i >= 0 ? `Ir para ${i + 1}. ${steps[i].name}` : 'Ir para etapa';
    }
    if (n.type === 'end') return 'Finalizar quiz';
    if (n.type === 'url') return `Abrir link${n.url ? ` (${n.url.replace(/^https?:\/\//, '').slice(0, 24)})` : ''}`;
    if (n.type === 'whatsapp') return 'Abrir WhatsApp';
    return 'Próxima etapa';
}

export function whatsappUrl(phone, message) {
    const digits = String(phone || '').replace(/\D/g, '');
    return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

// ── Step flow (how a step advances in the live quiz) ──
export function stepFlow(step, answers) {
    const visible = (step?.blocks || []).filter(b => isBlockVisible(b, answers));
    const questions = visible.filter(b => ANSWERABLE_TYPES.has(b.type));
    const ownAdvance = visible.some(b => OWN_ADVANCE_TYPES.has(b.type));
    const autoBlock = !ownAdvance && questions.length === 1 && isSingleSelect(questions[0]) && questions[0].autoAdvance !== false
        ? questions[0] : null;
    const mode = step?.continueButton || 'auto';
    const needsContinue = mode === 'always' || (mode === 'auto' && !ownAdvance && !autoBlock);
    const valid = questions.every(b => isAnswerValid(b, answers[b.id]));
    return { visible, questions, autoBlockId: autoBlock?.id || null, needsContinue, valid };
}

// ── Confetti (tiny, dependency-free) ──
export function fireConfetti(colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#ec4899'], container) {
    if (typeof document === 'undefined') return;
    const host = container || document.body;
    const rect = host.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.style.cssText = `position:${container ? 'absolute' : 'fixed'};inset:0;pointer-events:none;overflow:hidden;z-index:9999`;
    host.appendChild(layer);
    const w = container ? rect.width : window.innerWidth;
    for (let i = 0; i < 90; i++) {
        const p = document.createElement('div');
        const size = 6 + Math.random() * 6;
        p.style.cssText = `position:absolute;top:-12px;left:${Math.random() * w}px;width:${size}px;height:${size * 0.45}px;background:${colors[i % colors.length]};border-radius:2px`;
        layer.appendChild(p);
        const dx = (Math.random() - 0.5) * 240;
        const dur = 1600 + Math.random() * 1400;
        p.animate([
            { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${dx}px, ${(container ? rect.height : window.innerHeight) + 40}px) rotate(${Math.random() * 720}deg)`, opacity: 0.9 },
        ], { duration: dur, delay: Math.random() * 300, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
    }
    setTimeout(() => layer.remove(), 3400);
}
