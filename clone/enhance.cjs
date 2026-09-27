// enhance.cjs — Clone v2 post-processing on top of the main crawl:
//   1. branch discovery (other options that lead to different pages)
//   2. dynamic content (texts/charts that depend on answers → variables and formulas)
//   3. native block conversion (+ optional AI refinement) with media copied to our storage

const { openQuiz, snapshot, fingerprint, sameFp, pageKind, perform, defaultDecision, goBack, waitForChange, clickOption, delay } = require('./walker.cjs');
const { convertPage, applyDynamic, refineWithAI } = require('./convert.cjs');
const { collectRun, diffRuns } = require('./dynamic.cjs');
const { makeCapture } = require('./capture.cjs');

// Lookup in a fingerprint → page index map, tolerating dynamic words (names, numbers) in titles
function findKnown(map, fp) {
    if (map.has(fp)) return map.get(fp);
    for (const [k, v] of map) if (sameFp(k, fp, 0.8)) return v;
    return undefined;
}

const KIND_TO_TYPE = { choice: 'choice', multi: 'multi-select', form: 'lead', slider: 'input', loading: 'loading', info: 'insight', end: 'result' };
const lc = (s) => String(s || '').trim().toLowerCase();

// Main-path decisions reconstructed from the crawler's click log
function mainPath(allPages, clickLog) {
    return allPages.map((p, i) => {
        const clicks = clickLog.filter(c => c.page === i);
        const kind = p._ann ? pageKind(p._ann) : 'info';
        const opt = clicks.filter(c => c.role === 'option' && c.text);
        const chosen = opt.length ? opt[opt.length - 1].text : null;
        let decision;
        if (kind === 'choice') decision = { kind: 'option', index: chosen || 0 };
        else if (kind === 'multi') decision = { kind: 'multi', indices: opt.length ? [...new Set(opt.map(c => c.text))] : [0] };
        else if (kind === 'form') decision = { kind: 'fill', values: {} };
        else decision = { kind: 'next' };
        return { fp: p._fp, kind, decision, chosen };
    });
}

// Walk the main path until page `target`
async function replayTo(pg, main, target, deadline) {
    let i = 0, guard = 0;
    while (i < target) {
        if (Date.now() > deadline || guard++ > target * 3 + 12) return false;
        const snap = await snapshot(pg);
        if (!snap) return false;
        if (snap.kind === 'loading') { await waitForChange(pg, snap.hash, 20000); continue; }
        if (!sameFp(snap.fp, main[i].fp)) {
            const ahead = main.findIndex((m, k) => k > i && k <= target && sameFp(m.fp, snap.fp));
            if (ahead >= 0) { i = ahead; continue; }
            if (!main.some(m => sameFp(m.fp, snap.fp))) {
                // A transition page the crawl didn't keep
                if (!(await perform(pg, snap, defaultDecision(snap)))) return false;
                continue;
            }
            await delay(1200);
            continue;
        }
        if (!(await perform(pg, snap, main[i].decision))) return false;
        i++;
    }
    // The target may sit behind a loading/transition screen
    for (let tries = 0; tries < 4; tries++) {
        const s = await snapshot(pg);
        if (sameFp(s?.fp, main[target]?.fp)) return true;
        if (s?.kind === 'loading') await waitForChange(pg, s.hash, 20000);
        else await delay(1200);
    }
    return false;
}

async function probeBranches(browser, url, main, { deadline, maxProbes = 45, maxOptions = 8, log }) {
    const pg = await openQuiz(browser, url);
    const probes = [];
    let used = 0;
    let partial = false;
    try {
        let i = 0, guard = 0;
        while (i < main.length - 1 && Date.now() < deadline && guard++ < main.length * 3) {
            let snap = await snapshot(pg);
            if (!snap) break;
            if (snap.kind === 'loading') { await waitForChange(pg, snap.hash, 20000); continue; }
            if (!sameFp(snap.fp, main[i].fp)) {
                const ahead = main.findIndex((m, k) => k > i && sameFp(m.fp, snap.fp));
                if (ahead >= 0) { i = ahead; continue; }
                if (!(await perform(pg, snap, defaultDecision(snap)))) break;
                continue;
            }
            const opts = snap.ann.outline.find(n => n.k === 'options');
            if (main[i].kind === 'choice' && opts && opts.items.length >= 2 && opts.items.length <= maxOptions) {
                const chosen = lc(main[i].chosen);
                for (let j = 0; j < opts.items.length; j++) {
                    const it = opts.items[j];
                    if (used >= maxProbes || Date.now() > deadline) { partial = true; break; }
                    if ((chosen && lc(it.text) && chosen.includes(lc(it.text))) || (!chosen && j === 0)) continue;
                    used++;
                    const before = snap.hash;
                    if (!(await clickOption(pg, it.text || j))) continue;
                    if (!(await waitForChange(pg, before, 6000))) continue;
                    let s2 = await snapshot(pg);
                    if (s2?.kind === 'loading') { await waitForChange(pg, s2.hash, 20000); s2 = await snapshot(pg); }
                    probes.push({ from: i, optionText: it.text, optionIndex: j, fp: s2?.fp || '' });
                    log?.(`🔀 Opção “${it.text.slice(0, 30)}” da página ${i + 1} testada`);
                    if (!(await goBack(pg, snap.fp))) {
                        await pg.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });
                        await delay(2000);
                        if (!(await replayTo(pg, main, i, deadline))) { partial = true; return { probes, partial }; }
                    }
                    snap = await snapshot(pg);
                    if (!snap) return { probes, partial: true };
                }
            }
            if (!(await perform(pg, snap, main[i].decision))) break;
            i++;
        }
    } finally {
        await pg.close().catch(() => { });
    }
    return { probes, partial };
}

async function crawlBranch(browser, url, main, probe, knownFps, { deadline, sessionId, uploadsDir, maxPages = 12 }) {
    const pg = await openQuiz(browser, url);
    try {
        if (!(await replayTo(pg, main, probe.from, deadline))) return null;
        const snap0 = await snapshot(pg);
        if (!(await clickOption(pg, probe.optionText || probe.optionIndex))) return null;
        await waitForChange(pg, snap0.hash, 6000);
        const capture = await makeCapture(pg, { sessionId, uploadsDir });
        const pages = [];
        for (let n = 0; n < maxPages && Date.now() < deadline; n++) {
            let snap = await snapshot(pg);
            if (!snap) break;
            if (snap.kind === 'loading' && pages.length) { await waitForChange(pg, snap.hash, 20000); snap = await snapshot(pg); if (!snap) break; }
            const known = findKnown(knownFps, snap.fp);
            if (known !== undefined) return { pages, mergeTo: known };
            const html = await capture.extractPageHTML(snap.ann.canvases).catch(() => ({ editableCode: '', fullCode: '', canvasUrls: {} }));
            const shot = await capture.saveScreenshot(`b${probe.from}_${n}`);
            pages.push({
                type: 'html-script', code: html.editableCode, fullCode: html.fullCode, text: snap.ann.title || '', subtitle: '',
                _pageType: KIND_TO_TYPE[snap.kind] || 'insight', _hash: snap.hash, _screenshot: shot.base64, screenshotUrl: shot.url,
                _ann: snap.ann, _fp: snap.fp, _canvasUrls: html.canvasUrls || {},
            });
            const d = defaultDecision(snap);
            if (d.kind === 'stop') break;
            if (!(await perform(pg, snap, d))) break;
        }
        return { pages, mergeTo: null };
    } finally {
        await pg.close().catch(() => { });
    }
}

const textsOf = (ann) => (ann?.outline || []).filter(n => n.k === 'text' || n.k === 'heading' || n.k === 'button').map(n => n.text).filter(Boolean);

async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
    }));
    return out;
}

// Replace outline URLs with local copies and chart placeholders with saved images
async function localizeBlocks(blocks, page, capture) {
    const cache = new Map();
    const loc = async (u) => {
        if (!u || typeof u !== 'string') return u;
        if (u.startsWith('canvas:')) return page._canvasUrls?.[u.slice(7)] || '';
        if (!/^https?:\/\//.test(u)) return u;
        if (!cache.has(u)) cache.set(u, capture.downloadAsset(u));
        return cache.get(u);
    };
    const out = [];
    for (const b of blocks) {
        const nb = { ...b };
        if (nb.type === 'image' && nb._svg) { nb.imageUrl = capture.saveText(nb._svg, 'svg') || ''; delete nb._svg; }
        for (const k of ['imageUrl', 'audioUrl', 'src', 'avatar', 'beforeImage', 'afterImage']) if (nb[k]) nb[k] = await loc(nb[k]);
        if (nb.type === 'video' && /\.(mp4|webm)(\?|$)/i.test(nb.videoUrl || '')) nb.videoUrl = await loc(nb.videoUrl);
        if (Array.isArray(nb.options)) nb.options = await Promise.all(nb.options.map(async o => (o && o.image ? { ...o, image: await loc(o.image) } : o)));
        if (nb.type === 'image' && !nb.imageUrl) continue;
        out.push(nb);
    }
    return out;
}

/**
 * ctx: { browser, url, allPages, clickLog, capture, send, opts: { native, dynamic, branches }, sessionId, uploadsDir, callOpenAI }
 * Mutates allPages (adds nativeBlocks, report…) and returns { graph, design, extraPages }
 */
async function enhanceClone(ctx) {
    const { browser, url, allPages, clickLog, capture, send, opts = {}, sessionId, uploadsDir, callOpenAI } = ctx;
    const log = (msg, pct) => send('progress', { stage: 'enhancing', msg, pct: pct ?? -1 });
    allPages.forEach(p => { if (!p._fp && p._ann) p._fp = fingerprint(p._ann); });
    const main = mainPath(allPages, clickLog);
    const graph = { edges: [], exits: [], path: main.map(m => ({ fp: m.fp, kind: m.kind, decision: m.decision })), partial: false };
    const extraPages = [];

    // ── 1. Branches ──
    if (opts.branches && main.length > 2) {
        log('🔀 Procurando caminhos alternativos (ramificações)...', 86);
        const deadline = Date.now() + 9 * 60 * 1000;
        try {
            const { probes, partial } = await probeBranches(browser, url, main, { deadline, log: m => log(m) });
            graph.partial = partial;
            const knownFps = new Map(main.map((m, i) => [m.fp, i]));
            const seen = new Set();
            for (const pr of probes) {
                if (!pr.fp || sameFp(pr.fp, main[pr.from + 1]?.fp, 0.8)) continue;
                const key = `${pr.from}|${pr.fp}`;
                const known = findKnown(knownFps, pr.fp);
                if (seen.has(key)) { if (known !== undefined) graph.edges.push({ from: pr.from, optionText: pr.optionText, to: known }); continue; }
                seen.add(key);
                if (known !== undefined) { graph.edges.push({ from: pr.from, optionText: pr.optionText, to: known }); continue; }
                if (Date.now() > deadline) { graph.partial = true; break; }
                log(`🔀 Clonando o caminho da opção “${pr.optionText.slice(0, 30)}”...`);
                const res = await crawlBranch(browser, url, main, pr, knownFps, { deadline, sessionId, uploadsDir });
                if (!res || !res.pages.length) continue;
                const firstIdx = allPages.length + extraPages.length;
                res.pages.forEach((bp, k) => {
                    const idx = firstIdx + k;
                    bp._branch = { from: pr.from, optionText: pr.optionText };
                    knownFps.set(bp._fp, idx);
                    extraPages.push(bp);
                    if (k > 0) graph.exits.push({ from: idx - 1, to: idx });
                });
                graph.edges.push({ from: pr.from, optionText: pr.optionText, to: firstIdx });
                const lastIdx = firstIdx + res.pages.length - 1;
                graph.exits.push({ from: lastIdx, to: res.mergeTo ?? 'end' });
                log(`🔀 Caminho alternativo com ${res.pages.length} página(s) clonado`);
            }
        } catch (err) {
            graph.partial = true;
            log(`⚠️ Ramificações: ${err.message}`);
        }
    }
    const pagesAll = [...allPages, ...extraPages];

    // ── 2. Dynamic content ──
    let dyn = { findings: {}, notes: {}, varsUsed: [] };
    if (opts.dynamic && allPages.length > 1) {
        log('🧮 Rodando o quiz com outras respostas para achar conteúdo dinâmico...', 90);
        try {
            const [runB, runC] = await Promise.all([
                collectRun(browser, url, 'B', { maxSteps: allPages.length + 12, log: m => log(m) }),
                collectRun(browser, url, 'C', { maxSteps: allPages.length + 12, log: m => log(m) }),
            ]);
            const mainTexts = allPages.map(p => ({ fp: p._fp, kind: p._ann ? pageKind(p._ann) : '', texts: textsOf(p._ann) }));
            dyn = diffRuns(mainTexts, runB, runC);
            const count = Object.values(dyn.findings).reduce((a, f) => a + f.length, 0);
            log(`🧮 ${count} trecho(s) dinâmico(s) encontrados`);
        } catch (err) {
            log(`⚠️ Conteúdo dinâmico: ${err.message}`);
        }
    }

    // ── 3. Native blocks ──
    const design = { allowBack: pagesAll.some(p => p._ann?.hasBack) };
    if (opts.native !== false) {
        log('🧱 Convertendo páginas em blocos editáveis...', 93);
        await mapLimit(pagesAll, 4, async (p, i) => {
            if (!p._ann) return;
            const conv = convertPage({ outline: p._ann.outline, pageType: p._pageType, media: p._ann.media, links: p._ann.links, hasBack: p._ann.hasBack, title: p._ann.title }, i);
            if (conv.logoUrl && !design.logoUrl) design.logoUrl = await capture.downloadAsset(conv.logoUrl);
            let blocks = applyDynamic(conv.blocks, dyn.findings[i]);
            // Variables referenced by dynamic texts (resposta_N) must be saved by that question
            if (dyn.varsUsed?.includes(`resposta_${i}`)) blocks = blocks.map(b => (b.type === 'choice' ? { ...b, varName: `resposta_${i}` } : b));
            if (callOpenAI && opts.ai !== false) {
                const refined = await refineWithAI({ outline: p._ann.outline, pageType: p._pageType }, { blocks }, { callOpenAI, screenshotB64: p._screenshot });
                if (refined) { blocks = refined; conv.report.converted.push('Estrutura revisada pela IA'); }
            }
            blocks = await localizeBlocks(blocks, p, capture);
            p.nativeBlocks = blocks;
            p.stepProps = conv.step;
            p.confidence = conv.confidence;
            p.cloneReport = {
                converted: conv.report.converted,
                notes: [...conv.report.notes, ...(dyn.notes[i] || [])],
                dynamic: (dyn.findings[i] || []).filter(f => f.expr).map(f => ({ from: f.original.slice(0, 80), to: f.expr.slice(0, 120) })),
                links: p._ann.links || [],
                hasBack: !!p._ann.hasBack,
                media: (p._ann.media || []).map(m => ({ kind: m.kind, provider: m.provider || '', src: m.src || '' })),
            };
            p.stepName = conv.name;
        });
    }
    // "Logo moved to the top" only matters once
    let logoNoted = false;
    pagesAll.forEach(p => {
        if (!p.cloneReport) return;
        p.cloneReport.converted = p.cloneReport.converted.filter(c => { if (!/^Logo movida/.test(c)) return true; if (logoNoted) return false; logoNoted = true; return true; });
    });
    design.vars = { B: dyn.varsB || null, C: dyn.varsC || null };
    return { graph, design, extraPages };
}

// Re-clone one page: replay the recorded path, capture the page again (HTML + native blocks)
async function recloneSinglePage({ browser, url, path, index, sessionId, uploadsDir, callOpenAI }) {
    const pg = await openQuiz(browser, url);
    try {
        const deadline = Date.now() + 4 * 60 * 1000;
        if (index > 0 && !(await replayTo(pg, path, index, deadline))) throw new Error('Não consegui refazer o caminho até esta página');
        let snap = await snapshot(pg);
        if (snap?.kind === 'loading') { await waitForChange(pg, snap.hash, 20000); snap = await snapshot(pg); }
        if (!snap) throw new Error('Página não carregou');
        const capture = await makeCapture(pg, { sessionId, uploadsDir });
        const html = await capture.extractPageHTML(snap.ann.canvases);
        const shot = await capture.saveScreenshot(`r${index}`);
        const page = { _ann: snap.ann, _pageType: KIND_TO_TYPE[snap.kind] || 'insight', _canvasUrls: html.canvasUrls || {}, _screenshot: shot.base64 };
        const conv = convertPage({ outline: snap.ann.outline, pageType: page._pageType, media: snap.ann.media, links: snap.ann.links, hasBack: snap.ann.hasBack, title: snap.ann.title }, index);
        let blocks = conv.blocks;
        if (callOpenAI) {
            const refined = await refineWithAI({ outline: snap.ann.outline, pageType: page._pageType }, { blocks }, { callOpenAI, screenshotB64: shot.base64 });
            if (refined) blocks = refined;
        }
        blocks = await localizeBlocks(blocks, page, capture);
        return {
            type: 'html-script', code: html.editableCode, fullCode: html.fullCode, text: snap.ann.title || '', clonePageType: page._pageType,
            screenshotUrl: shot.url, fingerprint: snap.fp, nativeBlocks: blocks, stepProps: conv.step, stepName: conv.name, confidence: conv.confidence,
            cloneReport: { converted: conv.report.converted, notes: conv.report.notes, dynamic: [], links: snap.ann.links || [], hasBack: !!snap.ann.hasBack, media: (snap.ann.media || []).map(m => ({ kind: m.kind, provider: m.provider || '', src: m.src || '' })) },
        };
    } finally {
        await pg.close().catch(() => { });
    }
}

module.exports = { enhanceClone, recloneSinglePage, mainPath, replayTo, KIND_TO_TYPE };
