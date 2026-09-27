// dynamic.cjs — finds page content that depends on the visitor's answers.
// Walks the quiz twice more (runs B and C) with different, known answers, diffs the texts page by page
// and explains each changing number/date/text with a formula over quiz variables.

const { openQuiz, runPath, fillInputs, dragRuler, snapshot, delay } = require('./walker.cjs');
const { inputSemantics } = require('./convert.cjs');

const VARIANTS = {
    B: { option: 'first', values: { nome: 'Ana', email: 'ana.teste@gmail.com', telefone: '11988887777', peso: 72, peso_meta: 62, altura: 160, idade: 30, numero: 40, texto: 'teste', rangePct: 0.3, selectIndex: 1 }, rulerPx: 0 },
    C: { option: 'last', values: { nome: 'Bruno', email: 'bruno.teste@gmail.com', telefone: '11977776666', peso: 96, peso_meta: 78, altura: 184, idade: 46, numero: 70, texto: 'teste', rangePct: 0.7, selectIndex: 2 }, rulerPx: 140 },
};

const MONTHS = {
    pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    en: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
};
const MONTH_RE = `(${[...MONTHS.pt, ...MONTHS.es, ...MONTHS.en].map(m => m.replace('ç', '[cç]')).join('|')})`;
const DATE_PATTERNS = [
    { re: /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g, fmt: 'dd/mm/aaaa' },
    { re: /\b(\d{1,2})\/(\d{1,2})\b/g, fmt: 'dd/mm' },
    { re: new RegExp(`\\b(\\d{1,2}) de ${MONTH_RE}( de (\\d{4}))?`, 'gi'), fmt: 'extenso' },
    { re: new RegExp(`\\b${MONTH_RE} (\\d{1,2})(, (\\d{4}))?`, 'gi'), fmt: 'en' },
];

function monthIndex(name) {
    const n = name.toLowerCase().replace('c', 'ç').replace('marco', 'março');
    for (const list of Object.values(MONTHS)) {
        const i = list.findIndex(m => m === n || m.replace('ç', 'c') === name.toLowerCase());
        if (i >= 0) return i;
    }
    return -1;
}

// Tokens: numbers and dates in order of appearance
function tokenize(text) {
    const tokens = [];
    const taken = [];
    const now = new Date(); now.setHours(0, 0, 0, 0);
    for (const p of DATE_PATTERNS) {
        p.re.lastIndex = 0;
        let m;
        while ((m = p.re.exec(text))) {
            const start = m.index, end = m.index + m[0].length;
            if (taken.some(([s, e]) => start < e && end > s)) continue;
            let d = null;
            if (p.fmt === 'dd/mm/aaaa') d = new Date(Number(m[3].length === 2 ? `20${m[3]}` : m[3]), Number(m[2]) - 1, Number(m[1]));
            else if (p.fmt === 'dd/mm') { if (Number(m[2]) <= 12 && Number(m[1]) <= 31) d = new Date(now.getFullYear(), Number(m[2]) - 1, Number(m[1])); }
            else if (p.fmt === 'extenso') { const mi = monthIndex(m[2]); if (mi >= 0) d = new Date(m[4] ? Number(m[4]) : now.getFullYear(), mi, Number(m[1])); }
            else if (p.fmt === 'en') { const mi = monthIndex(m[1]); if (mi >= 0) d = new Date(m[4] ? Number(m[4]) : now.getFullYear(), mi, Number(m[2])); }
            if (!d || isNaN(d)) continue;
            if (d < now && !m[4] && p.fmt !== 'dd/mm/aaaa') d.setFullYear(d.getFullYear() + 1);
            taken.push([start, end]);
            tokens.push({ kind: 'date', raw: m[0], start, end, days: Math.round((d - now) / 86400000), fmt: p.fmt });
        }
    }
    const numRe = /-?\d+(?:[.,]\d+)?/g;
    let m;
    while ((m = numRe.exec(text))) {
        const start = m.index, end = start + m[0].length;
        if (taken.some(([s, e]) => start < e && end > s)) continue;
        const decimals = (m[0].split(/[.,]/)[1] || '').length;
        tokens.push({ kind: 'num', raw: m[0], start, end, value: parseFloat(m[0].replace(',', '.')), decimals, comma: m[0].includes(',') });
    }
    return tokens.sort((a, b) => a.start - b.start);
}

const near = (a, b, tol = 0.051) => Math.abs(a - b) <= tol;
const imc = (p, a) => p / Math.pow(a / 100, 2);

// Find an expression f(vars) with f(B) = numB and f(C) = numC
function explainNumber(numB, numC, varsB, varsC, decimals) {
    const tol = decimals ? Math.pow(10, -decimals) * 0.51 : 0.51;
    const names = Object.keys(varsB).filter(k => typeof varsB[k] === 'number' && typeof varsC[k] === 'number' && varsB[k] !== varsC[k]);
    const round = (e) => (decimals ? `round(${e}, ${decimals})` : `round(${e})`);
    for (const k of names) if (near(varsB[k], numB, tol) && near(varsC[k], numC, tol)) return decimals ? round(k) : k;
    if (names.includes('peso') && names.includes('altura') && near(imc(varsB.peso, varsB.altura), numB, tol) && near(imc(varsC.peso, varsC.altura), numC, tol)) return round('imc(peso, altura)');
    for (const a of names) for (const b of names) {
        if (a === b) continue;
        if (near(varsB[a] - varsB[b], numB, tol) && near(varsC[a] - varsC[b], numC, tol)) return `${a} - ${b}`;
        if (varsB[b] && varsC[b] && near((varsB[a] - varsB[b]) / varsB[a] * 100, numB, tol) && near((varsC[a] - varsC[b]) / varsC[a] * 100, numC, tol)) return round(`(${a} - ${b}) / ${a} * 100`);
    }
    // Linear on one variable (or a difference) with "nice" coefficients
    const series = names.map(k => [k, varsB[k], varsC[k]]);
    for (const a of names) for (const b of names) if (a !== b) series.push([`(${a} - ${b})`, varsB[a] - varsB[b], varsC[a] - varsC[b]]);
    for (const [expr, xb, xc] of series) {
        if (xb === xc) continue;
        const slope = (numC - numB) / (xc - xb);
        const icpt = numB - slope * xb;
        const niceSlope = [0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 7, 10, 0.1, 0.2, 0.9, 1.1, 0.8, 1.2].find(s => Math.abs(Math.abs(slope) - s) < 0.02);
        if (niceSlope && Math.abs(icpt - Math.round(icpt)) < 0.05 && Math.abs(icpt) < 1000) {
            const s = slope < 0 ? -niceSlope : niceSlope;
            const c = Math.round(icpt);
            return round(`${s === 1 ? '' : `${s} * `}${expr}${c ? ` ${c > 0 ? '+' : '-'} ${Math.abs(c)}` : ''}`);
        }
    }
    return null;
}

function explainDays(dB, dC, varsB, varsC) {
    const names = Object.keys(varsB).filter(k => typeof varsB[k] === 'number' && typeof varsC[k] === 'number' && varsB[k] !== varsC[k]);
    // Timelines usually depend on "how much to lose/gain", so differences come first
    const series = [];
    for (const a of names) for (const b of names) if (a !== b && varsB[a] - varsB[b] > 0) series.push([`(${a} - ${b})`, varsB[a] - varsB[b], varsC[a] - varsC[b]]);
    names.forEach(k => series.push([k, varsB[k], varsC[k]]));
    for (const [expr, xb, xc] of series) {
        if (xb === xc) continue;
        const slope = (dC - dB) / (xc - xb);
        const icpt = dB - slope * xb;
        if (slope > 0 && Math.abs(slope * 2 - Math.round(slope * 2)) < 0.15 && Math.abs(icpt - Math.round(icpt)) < 1.5) {
            const s = Math.round(slope * 2) / 2;
            const c = Math.round(icpt);
            return `${s === 1 ? '' : `${s} * `}${expr}${c ? ` ${c > 0 ? '+' : '-'} ${Math.abs(c)}` : ''}`;
        }
    }
    return null;
}

// Diff one text between runs; returns the template for run A's text, or null
function explainText(textA, textB, textC, varsB, varsC, choiceVars) {
    if (textB === textC) return null;
    const tA = tokenize(textA), tB = tokenize(textB), tC = tokenize(textC);
    const staticB = textB.replace(/-?\d+([.,]\d+)?/g, '#'), staticC = textC.replace(/-?\d+([.,]\d+)?/g, '#');
    if (tA.length === tB.length && tB.length === tC.length && tB.length && (staticB === staticC || tB.some(t => t.kind === 'date'))) {
        let template = '';
        let last = 0;
        let explained = 0, changed = 0;
        for (let i = 0; i < tA.length; i++) {
            const a = tA[i], b = tB[i], c = tC[i];
            template += textA.slice(last, a.start);
            last = a.end;
            if (b.raw === c.raw) { template += a.raw; continue; }
            changed++;
            let expr = null;
            if (b.kind === 'date' && c.kind === 'date') {
                const days = explainDays(b.days, c.days, varsB, varsC);
                if (days) expr = `data(${days}, '${a.fmt || b.fmt}')`;
            } else if (b.kind === 'num' && c.kind === 'num') {
                expr = explainNumber(b.value, c.value, varsB, varsC, Math.max(b.decimals, c.decimals));
                if (expr && (b.comma || a.comma)) expr = `virgula(${expr})`;
            }
            if (expr) { explained++; template += /^[a-z_]+$/.test(expr) ? `{{${expr}}}` : `{{= ${expr}}}`; }
            else template += a.raw;
        }
        template += textA.slice(last);
        if (changed && explained) return { template, explained, changed };
        return changed ? { template: null, explained: 0, changed } : null;
    }
    // Non-numeric change: isolate the segment that differs between B and C (common prefix/suffix)
    let p = 0;
    while (p < textB.length && p < textC.length && textB[p] === textC[p]) p++;
    let s = 0;
    while (s < textB.length - p && s < textC.length - p && textB[textB.length - 1 - s] === textC[textC.length - 1 - s]) s++;
    // Never split a word: grow the differing segment to word boundaries
    const W = /[\p{L}\p{N}]/u;
    while (p > 0 && W.test(textB[p - 1]) && W.test(textB[p] || '')) p--;
    while (s > 0 && W.test(textB[textB.length - s]) && W.test(textB[textB.length - s - 1] || '')) s--;
    const prefix = textB.slice(0, p), suffix = textB.slice(textB.length - s);
    const segB = textB.slice(p, textB.length - s).trim(), segC = textC.slice(p, textC.length - s).trim();
    const aligned = textA.startsWith(prefix) && textA.endsWith(suffix) && textA.length >= prefix.length + suffix.length;
    const segA = aligned ? textA.slice(prefix.length, textA.length - suffix.length) : '';
    const norm = (x) => String(x || '').trim().toLowerCase();
    let key = null;
    if (varsB.nome && norm(segB).startsWith(norm(varsB.nome)) && norm(segC).startsWith(norm(varsC.nome))) key = 'primeiro_nome';
    else {
        for (const [k, [vb, vc]] of Object.entries(choiceVars)) {
            if (vb && vc && vb !== vc && norm(segB).includes(norm(vb)) && norm(segC).includes(norm(vc))) { key = k; break; }
        }
    }
    if (key && aligned && segA.trim()) {
        const lead = segA.match(/^\s*/)[0], trail = segA.match(/\s*$/)[0];
        return { template: `${prefix}${lead}{{${key}}}${trail}${suffix}`, explained: 1, changed: 1, usesVar: key };
    }
    return { template: null, explained: 0, changed: 1 };
}

const hashStr = (str) => {
    const t = String(str || '');
    if (!t) return '';
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    return `${t.length}:${(h >>> 0).toString(36)}`;
};

// ── One controlled pass (text-only) ──
async function collectRun(browser, url, variantKey, { maxSteps = 70, timeBudgetMs = 5 * 60 * 1000, log = () => { } } = {}) {
    const variant = VARIANTS[variantKey];
    const pg = await openQuiz(browser, url);
    const pages = [];
    const vars = {};
    const choices = {};
    try {
        await runPath(pg, {
            maxSteps, timeBudgetMs,
            onPage: async ({ snap }) => {
                const texts = snap.ann.outline.filter(n => n.k === 'text' || n.k === 'heading' || n.k === 'button').map(n => n.text).filter(Boolean);
                const charts = snap.ann.outline.filter(n => n.k === 'chart').map(n => hashStr(n.canvas ? snap.ann.canvases[n.canvas] : n.svg));
                pages.push({ fp: snap.fp, kind: snap.kind, texts, charts, title: snap.ann.title });
            },
            policy: async ({ snap, pg: page }) => {
                const idx = pages.length - 1;
                const opts = snap.ann.outline.find(n => n.k === 'options');
                if (snap.kind === 'choice' || snap.kind === 'multi') {
                    const i = variant.option === 'last' ? opts.items.length - 1 : 0;
                    choices[snap.fp] = opts.items[i]?.text || '';
                    return snap.kind === 'multi' ? { kind: 'multi', indices: [i] } : { kind: 'option', index: i };
                }
                if (snap.kind === 'form') {
                    const filled = await fillInputs(page, variant.values);
                    Object.entries(filled).forEach(([k, v]) => { vars[k] = isNaN(Number(v)) ? v : Number(v); });
                    return { kind: 'next' };
                }
                if (snap.kind === 'slider') {
                    const slider = snap.ann.outline.find(n => n.k === 'slider');
                    if (slider?.custom) {
                        if (variant.rulerPx) await dragRuler(page, variant.rulerPx);
                    } else if (slider) {
                        await fillInputs(page, { rangePct: variant.values.rangePct });
                    }
                    await delay(300);
                    const after = await snapshot(page);
                    const s2 = after?.ann.outline.find(n => n.k === 'slider');
                    const bodyText = (after?.ann.title || '').toLowerCase();
                    const key = s2?.kind === 'height' ? 'altura' : s2?.kind === 'weight' ? (s2.goal ? 'peso_meta' : 'peso') : s2?.kind === 'age' ? 'idade' : inputSemantics(bodyText).varName || `valor_${idx}`;
                    if (s2 && typeof s2.value === 'number') vars[key] = s2.value;
                    return { kind: 'next' };
                }
                return null;
            },
        });
    } catch (err) {
        log(`[Dynamic ${variantKey}] ${err.message}`);
    } finally {
        await pg.close().catch(() => { });
    }
    if (vars.nome === undefined) vars.nome = variant.values.nome;
    return { pages, vars, choices };
}

/**
 * mainPages: [{ fp, texts: [...] }] from the main crawl (run A)
 * returns findings per main page index: { [i]: [{ original, expr, note }] } + unexplained notes
 */
function diffRuns(mainPages, runB, runC, mainChoices = {}) {
    const findings = {};
    const notes = {};
    // Pages are matched by fingerprint, or by similar wording when the title itself is dynamic ("Ana, seu plano…")
    const words = (fp) => new Set(String(fp || '').split(/[\s|/]+/).filter(w => w.length > 2 && w !== '#'));
    const similar = (a, b) => {
        const A = words(a), B = words(b);
        if (!A.size || !B.size) return 0;
        let inter = 0;
        A.forEach(w => { if (B.has(w)) inter++; });
        return inter / (A.size + B.size - inter);
    };
    const byFp = (run, fp, from, kind) => {
        for (let i = from; i < run.pages.length; i++) if (run.pages[i].fp === fp) return i;
        let best = -1, bestScore = 0.5;
        for (let i = from; i < Math.min(run.pages.length, from + 4); i++) {
            if (kind && run.pages[i].kind !== kind) continue;
            const sc = similar(run.pages[i].fp, fp);
            if (sc > bestScore) { best = i; bestScore = sc; }
        }
        return best;
    };
    let fromB = 0, fromC = 0;
    const choiceVars = {};
    mainPages.forEach((mp, mi) => {
        if (runB.choices[mp.fp] !== undefined || runC.choices[mp.fp] !== undefined) choiceVars[`resposta_${mi}`] = [runB.choices[mp.fp], runC.choices[mp.fp], mainChoices[mi]];
    });
    const varsUsed = new Set();

    mainPages.forEach((mp, mi) => {
        const bi = byFp(runB, mp.fp, fromB, mp.kind), ci = byFp(runC, mp.fp, fromC, mp.kind);
        if (bi < 0 || ci < 0) return;
        fromB = bi; fromC = ci;
        const pb = runB.pages[bi], pc = runC.pages[ci];
        const n = Math.min(mp.texts.length, pb.texts.length, pc.texts.length);
        for (let t = 0; t < n; t++) {
            const r = explainText(mp.texts[t], pb.texts[t], pc.texts[t], runB.vars, runC.vars, choiceVars);
            if (!r) continue;
            if (r.usesVar) varsUsed.add(r.usesVar);
            if (r.template) (findings[mi] = findings[mi] || []).push({ original: mp.texts[t], expr: r.template });
            else (notes[mi] = notes[mi] || []).push(r.nameEcho ? `Texto usa o nome da pessoa: “${mp.texts[t].slice(0, 60)}”` : `Texto muda conforme as respostas: “${pb.texts[t].slice(0, 50)}” / “${pc.texts[t].slice(0, 50)}”`);
        }
        if (pb.charts.some((c, i) => c && pc.charts[i] && c !== pc.charts[i])) {
            (findings[mi] = findings[mi] || []).push({ chart: true });
            (notes[mi] = notes[mi] || []).push('Gráfico muda conforme as respostas');
        }
    });
    return { findings, notes, varsB: runB.vars, varsC: runC.vars, varsUsed: [...varsUsed] };
}

module.exports = { collectRun, diffRuns, tokenize, explainNumber, explainText, VARIANTS };
