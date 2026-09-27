// walker.cjs — a controllable quiz walker built on the annotations from annotate.cjs.
// Used for branch discovery, dynamic-content passes and re-cloning a single page.

const { annotatePage } = require('./annotate.cjs');

const delay = (ms) => new Promise(r => setTimeout(r, ms));
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const normText = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\d+([.,]\d+)?/g, '#').replace(/[^\p{L}#]+/gu, ' ').trim();

// Page identity that survives dynamic numbers/names (digits are masked)
function fingerprint(ann) {
    if (!ann) return '';
    const heading = ann.outline.find(n => n.k === 'heading')?.text || ann.outline.find(n => n.k === 'text')?.text || '';
    const opts = ann.outline.find(n => n.k === 'options');
    const inputs = ann.outline.filter(n => n.k === 'input' || n.k === 'slider').map(n => n.type || n.kind).join(',');
    return [normText(heading).slice(0, 80), opts ? opts.items.slice(0, 5).map(i => normText(i.text).slice(0, 24)).join('/') : '', inputs].join('|');
}

// Same page? Exact fingerprint, or similar wording (titles may contain the visitor's name/numbers)
function fpSimilarity(a, b) {
    const words = (fp) => new Set(String(fp || '').split(/[\s|/]+/).filter(w => w.length > 2 && w !== '#'));
    const A = words(a), B = words(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    A.forEach(w => { if (B.has(w)) inter++; });
    return inter / (A.size + B.size - inter);
}
function sameFp(a, b, threshold = 0.6) {
    return !!a && !!b && (a === b || fpSimilarity(a, b) >= threshold);
}

function pageKind(ann) {
    const o = ann.outline;
    const opts = o.find(n => n.k === 'options');
    if (opts) return opts.multi ? 'multi' : 'choice';
    if (o.some(n => n.k === 'input')) return 'form';
    if (o.some(n => n.k === 'slider')) return 'slider';
    if (o.some(n => n.k === 'percent')) return 'loading';
    if (o.some(n => n.k === 'button' && n.role === 'next')) return 'info';
    return 'end';
}

async function openQuiz(browser, url) {
    const pg = await browser.newPage();
    await pg.setViewport({ width: 430, height: 932 });
    await pg.setUserAgent(MOBILE_UA);
    await pg.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2500);
    await pg.evaluate(() => {
        const p = /accept|aceitar|ok|got it|entendi|fechar|close|dismiss|consent/i;
        document.querySelectorAll('button,a,[role="button"]').forEach(el => {
            const t = (el.innerText || '').trim();
            if (t.length < 30 && p.test(t)) { const r = el.getBoundingClientRect(); if (r.height > 0 && r.width > 0) el.click(); }
        });
    }).catch(() => { });
    await delay(600);
    return pg;
}

async function contentHash(pg) {
    return pg.evaluate(() => {
        const main = document.querySelector('main, [role="main"], #app, #root, #__next') || document.body;
        return `${location.href}|${(main.innerText || '').replace(/\s+/g, ' ').slice(0, 600)}|${main.querySelectorAll('*').length}`;
    }).catch(() => '');
}

async function snapshot(pg) {
    const ann = await pg.evaluate(annotatePage).catch(() => null);
    if (!ann) return null;
    return { ann, fp: fingerprint(ann), kind: pageKind(ann), hash: await contentHash(pg) };
}

async function waitForChange(pg, prevHash, timeout = 7000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        await delay(350);
        const h = await contentHash(pg);
        if (h && h !== prevHash) { await delay(700); return true; }
    }
    return false;
}

async function clickSelector(pg, selector, index = 'last') {
    const pt = await pg.evaluate((sel, idx) => {
        const els = [...document.querySelectorAll(sel)].filter(e => {
            const r = e.getBoundingClientRect();
            const s = getComputedStyle(e);
            return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && !e.disabled && e.getAttribute('aria-disabled') !== 'true';
        });
        const el = idx === 'last' ? els[els.length - 1] : typeof idx === 'number' ? els[Math.min(idx, els.length - 1)] : els.find(e => (e.innerText || '').trim().toLowerCase().includes(String(idx).toLowerCase()));
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: (el.innerText || '').trim().slice(0, 120) };
    }, selector, index).catch(() => null);
    if (!pt) return null;
    await delay(150);
    await pg.mouse.click(pt.x, pt.y);
    return pt;
}

const clickOption = (pg, index) => clickSelector(pg, '[data-qf-role="option"]', index);
const clickNext = (pg) => clickSelector(pg, '[data-qf-role="next"]', 'last');

async function fillInputs(pg, values) {
    return pg.evaluate((vals) => {
        const filled = {};
        const setVal = (el, v) => {
            const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            el.focus();
            if (setter) setter.call(el, v); else el.value = v;
            ['input', 'change', 'blur'].forEach(e => el.dispatchEvent(new Event(e, { bubbles: true })));
        };
        document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), textarea, select').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) return;
            const all = `${el.name} ${el.placeholder} ${el.id} ${el.labels?.[0]?.innerText || ''} ${el.type} ${document.querySelector('h1,h2,h3')?.innerText || ''}`.toLowerCase();
            if (el.tagName === 'SELECT') {
                const idx = Math.min(vals.selectIndex ?? 1, el.options.length - 1);
                el.selectedIndex = Math.max(0, idx);
                el.dispatchEvent(new Event('change', { bubbles: true }));
                filled.select = el.options[el.selectedIndex]?.text;
                return;
            }
            if (el.type === 'range') {
                const min = Number(el.min) || 0, max = Number(el.max) || 100;
                const v = Math.round(min + (max - min) * (vals.rangePct ?? 0.5));
                setVal(el, String(v)); filled.range = v; return;
            }
            let key = 'texto';
            if (/e-?mail|correo/.test(all) || el.type === 'email') key = 'email';
            else if (/whats|telefone|celular|phone|tel\b/.test(all) || el.type === 'tel') key = 'telefone';
            else if (/(peso|weight).{0,20}(meta|desej|ideal|goal|target)|(meta|desej|ideal|goal|target).{0,20}(peso|weight)/.test(all)) key = 'peso_meta';
            else if (/peso|weight|\bkg\b/.test(all)) key = 'peso';
            else if (/altura|height|estatura|\bcm\b/.test(all)) key = 'altura';
            else if (/idade|age\b|edad|anos/.test(all)) key = 'idade';
            else if (/nome|name|nombre/.test(all)) key = 'nome';
            else if (el.type === 'number') key = 'numero';
            const v = vals[key] ?? vals.texto ?? 'teste';
            setVal(el, String(v));
            filled[key] = v;
        });
        document.querySelectorAll('input[type=checkbox]').forEach(cb => { if (!cb.checked) cb.click(); });
        return filled;
    }, values).catch(() => ({}));
}

// Drag a custom ruler / wheel picker by `px` pixels and return the value shown afterwards
async function dragRuler(pg, px) {
    const box = await pg.evaluate(() => {
        const cand = [...document.querySelectorAll('[class*="ruler"], [class*="scroll"], [class*="picker"], [class*="slider"], [class*="scale"], [class*="wheel"], div')]
            .filter(d => {
                const r = d.getBoundingClientRect();
                if (r.width < 120 || r.height < 20 || r.height > 400) return false;
                const kids = [...d.children].slice(0, 30);
                return kids.length > 10 && kids.filter(c => { const cr = c.getBoundingClientRect(); return (cr.width < 6 && cr.height > 6) || /^\d{2,3}$/.test((c.innerText || '').trim()); }).length > 6;
            });
        const el = cand[0];
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, vertical: r.height > r.width };
    }).catch(() => null);
    if (!box || !px) return null;
    await pg.mouse.move(box.x, box.y);
    await pg.mouse.down();
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
        await pg.mouse.move(box.vertical ? box.x : box.x - (px * i) / steps, box.vertical ? box.y - (px * i) / steps : box.y);
        await delay(25);
    }
    await pg.mouse.up();
    await delay(500);
    return true;
}

/**
 * Walk the quiz with a policy.
 *   policy(state) → decision { kind: 'option', index } | { kind: 'multi', indices } | { kind: 'fill', values } | { kind: 'ruler', px } | { kind: 'range', pct } | { kind: 'next' } | { kind: 'stop' }
 *   onPage(state) → called on every new page (return false to stop)
 * state = { pg, step, snap, history }
 */
async function runPath(pg, { policy, onPage, maxSteps = 60, timeBudgetMs = 6 * 60 * 1000 }) {
    const start = Date.now();
    const history = [];
    let stuck = 0;
    for (let step = 0; step < maxSteps; step++) {
        if (Date.now() - start > timeBudgetMs) break;
        await delay(400);
        let snap = await snapshot(pg);
        if (!snap) break;
        if (snap.kind === 'loading') {
            await waitForChange(pg, snap.hash, 20000);
            snap = await snapshot(pg);
            if (!snap) break;
        }
        const state = { pg, step, snap, history };
        if (onPage) {
            const cont = await onPage(state);
            if (cont === false) break;
        }
        const decision = (policy && (await policy(state))) || defaultDecision(snap);
        history.push({ fp: snap.fp, kind: snap.kind, decision });
        if (decision.kind === 'stop') break;
        const ok = await perform(pg, snap, decision);
        if (!ok) { stuck++; if (stuck >= 2) break; } else stuck = 0;
    }
    return history;
}

function defaultDecision(snap) {
    switch (snap.kind) {
        case 'choice': return { kind: 'option', index: 0 };
        case 'multi': return { kind: 'multi', indices: [0] };
        case 'form': return { kind: 'fill', values: {} };
        case 'slider': return { kind: 'next' };
        case 'info': return { kind: 'next' };
        default: return { kind: 'stop' };
    }
}

const DEFAULT_VALUES = { email: 'teste@gmail.com', telefone: '11999999999', nome: 'Maria', peso: 70, peso_meta: 60, altura: 165, idade: 35, numero: 50, texto: 'teste' };

async function perform(pg, snap, d) {
    const before = snap.hash;
    if (d.kind === 'option') {
        const r = await clickOption(pg, d.index ?? d.text ?? 0);
        if (!r) return false;
        if (await waitForChange(pg, before)) return true;
        // Single choice that needs a confirm button
        await clickNext(pg);
        return waitForChange(pg, before);
    }
    if (d.kind === 'multi') {
        for (const i of d.indices || [0]) { await clickOption(pg, i); await delay(350); }
        await clickNext(pg);
        return waitForChange(pg, before);
    }
    if (d.kind === 'fill') {
        await fillInputs(pg, { ...DEFAULT_VALUES, ...(d.values || {}) });
        await delay(400);
        await clickNext(pg);
        if (await waitForChange(pg, before)) return true;
        await pg.evaluate(() => document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))).catch(() => { });
        return waitForChange(pg, before);
    }
    if (d.kind === 'ruler') {
        if (d.px) await dragRuler(pg, d.px);
        await clickNext(pg);
        return waitForChange(pg, before);
    }
    if (d.kind === 'range') {
        await fillInputs(pg, { rangePct: d.pct ?? 0.5 });
        await clickNext(pg);
        return waitForChange(pg, before);
    }
    if (d.kind === 'next') {
        const r = await clickNext(pg);
        if (!r) {
            // Last resort: lowest visible button
            await clickSelector(pg, 'button, [role="button"]', 'last');
        }
        return waitForChange(pg, before);
    }
    return false;
}

// Try to return to the previous page (in-app back button, then browser history)
async function goBack(pg, targetFp) {
    const matches = async () => sameFp((await snapshot(pg))?.fp, targetFp);
    const before = await contentHash(pg);
    if (await clickSelector(pg, '[data-qf-role="back"]', 0)) {
        await waitForChange(pg, before, 4000);
        if (await matches()) return true;
    }
    try {
        await pg.goBack({ waitUntil: 'networkidle2', timeout: 8000 });
        await delay(900);
        if (await matches()) return true;
    } catch { /* ignore */ }
    return false;
}

module.exports = { openQuiz, snapshot, fingerprint, fpSimilarity, sameFp, pageKind, runPath, perform, defaultDecision, goBack, waitForChange, contentHash, clickOption, clickNext, fillInputs, dragRuler, delay, DEFAULT_VALUES };
