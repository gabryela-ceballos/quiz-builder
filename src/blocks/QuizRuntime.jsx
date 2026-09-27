// QuizRuntime.jsx — the published quiz for builder v2 (same renderer as the editor canvas)
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveLead, recordEvent } from '../hooks/useQuizStore';
import StepView, { QuizFrame } from './StepView';
import ClonedPageBlock from './ClonedPage';
import { CSS as LEGACY_CSS } from './widgets';
import { buildTheme, ensureFont } from './theme';
import { buildVars, interpolate, normalizeAction, stepExitAction, whatsappUrl, fireConfetti, computeScore, isCloneStep, valueAnswer, routeForAnswer } from './logic';

function newSessionId() {
    return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Answer summary keyed by question text (what the Leads tab shows)
function answerSummary(steps, answers) {
    const out = {};
    steps.forEach((s, si) => (s.blocks || []).forEach(b => {
        const a = answers[b.id];
        if (!a || !a.text) return;
        let label = b.text || b.title || b.headline || s.name || `Etapa ${si + 1}`;
        while (out[label] !== undefined) label += ' ';
        out[label] = a.text;
    }));
    return out;
}

// Legacy (page-indexed) view of answers for widgets written for the old player (BMI, AI diagnosis)
function legacyView(steps, answers) {
    const pages = [], arr = [];
    steps.forEach(s => (s.blocks || []).forEach(b => {
        const a = answers[b.id];
        if (!a) return;
        pages.push(b);
        arr.push(a.idx ? (a.idx.length === 1 && !(b.multiSelect) ? a.idx[0] : a.idx) : a.value ?? a.text);
    }));
    return { pages, answers: arr };
}

export default function QuizRuntime({ quiz, preview = false }) {
    const steps = useMemo(() => (quiz.steps || []).filter(s => s.blocks?.length), [quiz]);
    const design = useMemo(() => ({ primaryColor: quiz.primaryColor, bgColor: quiz.bgColor, ...(quiz.design || {}) }), [quiz]);
    const T = useMemo(() => buildTheme(design), [design]);
    useEffect(() => { ensureFont(T.font); }, [T.font]);

    const [idx, setIdx] = useState(0);
    const [done, setDone] = useState(false);
    const [answers, setAnswers] = useState({});
    const answersRef = useRef({});
    const [history, setHistory] = useState([]);
    const sessionRef = useRef(newSessionId());
    const leadRef = useRef({});
    const startedRef = useRef(false);
    const [dir, setDir] = useState(1);

    const step = steps[idx];
    const vars = useMemo(() => buildVars(steps, answers), [steps, answers]);
    const legacy = useMemo(() => legacyView(steps, answers), [steps, answers]);

    const track = useCallback((event, data) => { if (!preview) recordEvent(quiz.id, event, data); }, [preview, quiz.id]);

    // Owner's pixels / tracking scripts (Design do quiz → Pixel e scripts)
    useEffect(() => {
        if (preview || !design.pixelCode) return undefined;
        const holder = document.createElement('div');
        holder.style.display = 'none';
        holder.innerHTML = design.pixelCode;
        const nodes = [];
        holder.querySelectorAll('script').forEach(old => {
            const sc = document.createElement('script');
            [...old.attributes].forEach(a => sc.setAttribute(a.name, a.value));
            sc.textContent = old.textContent;
            document.head.appendChild(sc);
            nodes.push(sc);
            old.remove();
        });
        document.body.appendChild(holder);
        return () => { holder.remove(); nodes.forEach(n => n.remove()); };
    }, [preview, design.pixelCode]);
    const pixelEvent = useCallback((kind) => {
        if (preview) return;
        try {
            if (kind === 'lead') { window.fbq?.('track', 'Lead'); window.ttq?.track?.('SubmitForm'); window.gtag?.('event', 'generate_lead'); }
            if (kind === 'checkout') { window.fbq?.('track', 'InitiateCheckout'); window.ttq?.track?.('InitiateCheckout'); window.gtag?.('event', 'begin_checkout'); }
            if (kind === 'complete') { window.fbq?.('trackCustom', 'QuizComplete'); window.gtag?.('event', 'quiz_complete'); }
        } catch { /* ignore */ }
    }, [preview]);

    const persistLead = useCallback((source) => {
        if (preview) return;
        const a = answersRef.current;
        const summary = answerSummary(steps, a);
        const contact = leadRef.current;
        if (!Object.keys(summary).length && !contact.email && !contact.phone) return;
        const v = buildVars(steps, a);
        saveLead(quiz.id, {
            sessionId: sessionRef.current,
            name: contact.name || v.nome || '',
            email: contact.email || v.email || '',
            phone: contact.phone || v.telefone || '',
            score: computeScore(steps, a),
            answers: summary,
            source,
            date: new Date().toISOString(),
        });
    }, [preview, quiz.id, steps]);

    const setAnswer = useCallback((blockId, answer) => {
        answersRef.current = { ...answersRef.current, [blockId]: answer };
        setAnswers(answersRef.current);
        const block = steps[idx]?.blocks.find(b => b.id === blockId);
        if (block && answer?.idx) track('answer', { questionIndex: idx, optionIndex: answer.idx[0] ?? 0, blockId });
        else if (block) track('answer', { questionIndex: idx, value: answer?.value, blockId });
    }, [steps, idx, track]);

    const finish = useCallback(() => {
        persistLead('complete');
        track('complete');
        pixelEvent('complete');
        setDone(true);
    }, [persistLead, track, pixelEvent]);

    const goTo = useCallback((next) => {
        if (next >= steps.length || next < 0) { finish(); return; }
        if (!startedRef.current) { startedRef.current = true; track('start'); }
        setHistory(h => [...h, idx]);
        setDir(next > idx ? 1 : -1);
        setIdx(next);
        track('step_view', { stepIndex: next, stepId: steps[next].id });
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
        if (steps[next].confetti) setTimeout(() => fireConfetti([T.primary, '#f59e0b', '#10b981', '#ec4899', '#6366f1']), 350);
    }, [steps, idx, finish, track, T.primary]);

    const act = useCallback((action) => {
        const run = (action) => {
        const a = normalizeAction(action) || { type: 'next' };
        const v = buildVars(steps, answersRef.current);
        switch (a.type) {
            case 'goto': {
                const target = steps.findIndex(s => s.id === a.stepId);
                goTo(target >= 0 ? target : idx + 1);
                break;
            }
            case 'end': finish(); break;
            case 'url': {
                persistLead('cta');
                track('cta_click', { url: a.url });
                pixelEvent('checkout');
                const url = interpolate(a.url || '', v);
                if (!url) { goTo(idx + 1); break; }
                if (a.newTab) window.open(url, '_blank', 'noopener');
                else window.location.href = url;
                break;
            }
            case 'whatsapp': {
                persistLead('whatsapp');
                track('cta_click', { whatsapp: true });
                window.open(whatsappUrl(interpolate(a.phone, v), interpolate(a.message, v)), '_blank', 'noopener');
                break;
            }
            default: {
                const exit = stepExitAction(steps[idx]);
                if (exit.type !== 'next') run(exit);
                else goTo(idx + 1);
            }
        }
        };
        run(action);
    }, [steps, idx, goTo, finish, persistLead, track, pixelEvent]);

    const onLead = useCallback((contact) => {
        leadRef.current = { ...leadRef.current, ...contact };
        persistLead('capture');
        pixelEvent('lead');
    }, [persistLead, pixelEvent]);

    const back = () => {
        if (!history.length) return;
        setDir(-1);
        setIdx(history[history.length - 1]);
        setHistory(h => h.slice(0, -1));
    };

    // Confetti on the very first step, if configured
    useEffect(() => {
        if (steps[0]?.confetti) setTimeout(() => fireConfetti([T.primary, '#f59e0b', '#10b981']), 400);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const restart = () => {
        answersRef.current = {};
        setAnswers({});
        setHistory([]);
        sessionRef.current = newSessionId();
        leadRef.current = {};
        setDone(false);
        setIdx(0);
    };

    if (!steps.length) {
        return <QuizFrame T={T} design={design} minHeight="100vh"><p style={{ textAlign: 'center', color: T.textSec }}>Este quiz ainda não tem etapas.</p></QuizFrame>;
    }

    if (done) {
        return (
            <QuizFrame T={T} design={design} step={{ hideProgress: true }} minHeight="100vh">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', paddingTop: 60 }}>
                    <div style={{ fontSize: 60, marginBottom: 12 }}>🎉</div>
                    <h2 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: '0 0 8px' }}>{design.doneTitle ? interpolate(design.doneTitle, vars) : (vars.primeiro_nome ? `Tudo certo, ${vars.primeiro_nome}!` : 'Tudo certo!')}</h2>
                    <p style={{ color: T.textSec, fontSize: 15.5, lineHeight: 1.6, margin: '0 auto 24px', maxWidth: 360 }}>{interpolate(design.doneText || 'Suas respostas foram registradas. Obrigado por participar!', vars)}</p>
                    <button type="button" onClick={restart} style={{ padding: '12px 22px', borderRadius: T.btnRadius, border: `1.5px solid ${T.border}`, background: T.card, color: T.text, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>↺ Refazer</button>
                </motion.div>
            </QuizFrame>
        );
    }

    return (
        <>
            {preview && (
                <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 9999, background: '#111827', color: '#fff', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 99, boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}>
                    Prévia · respostas não são salvas
                </div>
            )}
            {steps.some(isCloneStep) && <style>{LEGACY_CSS.replace(/var\(--qp-rgb\)/g, T.rgb)}</style>}
            <QuizFrame T={T} design={design} step={isCloneStep(step) ? { ...step, hideHeader: true, hideProgress: true } : step} index={idx} total={steps.length} canBack={history.length > 0} onBack={back} minHeight="100vh" flush={isCloneStep(step)}>
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={step.id}
                        initial={{ opacity: 0, x: 18 * dir }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -18 * dir }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}>
                        {isCloneStep(step) ? (
                            <ClonedPageBlock html={step.blocks[0].code || ''} fullCode={step.blocks[0].fullCode || ''} onAdvance={(answer) => act(routeForAnswer(step, answer) || { type: 'next' })}
                                onBack={back} onLink={(href, newTab) => act(/wa\.me|whatsapp/i.test(href) ? { type: 'url', url: href, newTab: true } : { type: 'url', url: href, newTab })}
                                btnStyle={{ width: '100%', padding: '16px 0', borderRadius: T.btnRadius, border: 'none', background: T.primary, color: T.onPrimary, fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
                                buttonActions={step.blocks[0].buttonActions} pixelCode={step.blocks[0].pixelCode} clonePageType={step.blocks[0].clonePageType}
                                quizId={preview ? '' : quiz.id} pageIndex={idx}
                                setAnswers={fn => { const r = fn({}); const v = Object.values(r)[0]; if (v !== undefined) setAnswer(step.blocks[0].id || `clone_${idx}`, valueAnswer(v)); }} />
                        ) : (
                            <StepView step={step} T={T} design={design} mode="live" answers={answers} setAnswer={setAnswer}
                                vars={vars} act={act} onLead={onLead} steps={steps} legacy={legacy} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </QuizFrame>
        </>
    );
}

