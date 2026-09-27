// cloneImport.js — turns a clone result (server) into builder steps.
// Every cloned step keeps both versions: native blocks (editable) and the faithful HTML page.

import { FONTS } from '../blocks/theme';

const uid = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const STEP_PROP_KEYS = ['continueLabel', 'continueButton', 'hideProgress', 'hideHeader'];
export const MIN_CONFIDENCE = 45;

function withBlockIds(blocks) {
    return (blocks || []).map(b => ({
        ...b,
        id: b.id || uid('blk'),
        ...(Array.isArray(b.options) ? { options: b.options.map((o, i) => (o && typeof o === 'object' ? { ...o, id: o.id || `o${i}` } : o)) } : {}),
    }));
}

function htmlBlockOf(p) {
    return { id: uid('blk'), type: 'html-script', code: p.code || '', fullCode: p.fullCode || '', text: p.text || '', clonePageType: p.clonePageType || 'choice', buttonActions: p.buttonActions };
}

function routeOptions(blocks, optionText, stepId) {
    const want = norm(optionText);
    return blocks.map(b => {
        if (!Array.isArray(b.options) || !['choice', 'single-choice', 'image-select'].includes(b.type)) return b;
        return { ...b, options: b.options.map(o => (want && (norm(o.text) === want || want.includes(norm(o.text)) || norm(o.text).includes(want)) ? { ...o, action: { type: 'goto', stepId } } : o)) };
    });
}

export function stepsFromClone(quiz) {
    const pages = quiz.pages || [];
    const ids = pages.map((_, i) => uid(`stp_clone${i}`));
    const mainCount = pages.filter(p => !p.branch).length;

    const steps = pages.map((p, i) => {
        const html = htmlBlockOf(p);
        const native = withBlockIds(p.nativeBlocks);
        const useNative = native.length > 0 && (p.confidence ?? 0) >= MIN_CONFIDENCE;
        const stepProps = p.stepProps || {};
        return {
            id: ids[i],
            name: (p.stepName || (p.text || '').replace(/\s+/g, ' ').slice(0, 28) || `Etapa ${i + 1}`).trim(),
            blocks: useNative ? native : [html],
            ...(useNative ? stepProps : {}),
            clone: {
                mode: useNative ? 'native' : 'html',
                html, native, stepProps,
                screenshotUrl: p.screenshotUrl || '',
                report: p.cloneReport || null,
                confidence: p.confidence ?? null,
                index: i,
                fingerprint: p.fingerprint || '',
                branch: p.branch || null,
                optionRoutes: [],
            },
        };
    });

    // Branches: option → step, and where each alternative path rejoins
    (quiz.graph?.edges || []).forEach(e => {
        const st = steps[e.from];
        const target = typeof e.to === 'number' ? ids[e.to] : null;
        if (!st || !target) return;
        st.clone.native = routeOptions(st.clone.native, e.optionText, target);
        if (st.clone.mode === 'native') st.blocks = routeOptions(st.blocks, e.optionText, target);
        st.clone.optionRoutes.push({ text: e.optionText, stepId: target });
    });
    (quiz.graph?.exits || []).forEach(x => {
        const st = steps[x.from];
        if (!st) return;
        if (x.to === 'end') st.exitAction = { type: 'end' };
        else if (typeof x.to === 'number' && ids[x.to] && x.to !== x.from + 1) st.exitAction = { type: 'goto', stepId: ids[x.to] };
    });
    // Alternative paths are appended after the main path: the main path must not fall into them
    if (steps.length > mainCount && steps[mainCount - 1] && !steps[mainCount - 1].exitAction) steps[mainCount - 1].exitAction = { type: 'end' };

    return steps;
}

export function designFromClone(quiz) {
    const d = quiz.cloneDesign || {};
    const font = (quiz.contentFont || '').trim();
    return {
        primaryColor: quiz.primaryColor || undefined,
        bgColor: quiz.bgColor && quiz.bgColor !== '#ffffff' ? quiz.bgColor : undefined,
        fontFamily: FONTS.find(f => f.toLowerCase() === font.toLowerCase()) || undefined,
        logoUrl: d.logoUrl || undefined,
        showLogo: d.logoUrl ? true : undefined,
        allowBack: d.allowBack ? true : undefined,
    };
}

// Switch a cloned step between native blocks and faithful HTML, keeping edits made in either mode
export function switchCloneMode(step, mode) {
    if (!step?.clone || step.clone.mode === mode) return step;
    const pickProps = (s) => Object.fromEntries(STEP_PROP_KEYS.filter(k => s[k] !== undefined).map(k => [k, s[k]]));
    const clearProps = (s) => { const n = { ...s }; STEP_PROP_KEYS.forEach(k => delete n[k]); return n; };
    if (mode === 'html') {
        return { ...clearProps(step), blocks: [step.clone.html], clone: { ...step.clone, mode: 'html', native: step.blocks, stepProps: pickProps(step) } };
    }
    const html = step.blocks?.[0]?.type === 'html-script' ? step.blocks[0] : step.clone.html;
    return { ...step, ...step.clone.stepProps, blocks: withBlockIds(step.clone.native), clone: { ...step.clone, mode: 'native', html } };
}

// Apply a re-cloned page to an existing step
export function applyReclone(step, page) {
    const html = htmlBlockOf(page);
    const native = withBlockIds(page.nativeBlocks);
    const clone = { ...step.clone, html, native, stepProps: page.stepProps || {}, screenshotUrl: page.screenshotUrl || step.clone.screenshotUrl, report: page.cloneReport || step.clone.report, confidence: page.confidence ?? step.clone.confidence };
    return step.clone.mode === 'html' ? { ...step, blocks: [html], clone } : { ...step, ...(page.stepProps || {}), blocks: native.length ? native : step.blocks, clone };
}
