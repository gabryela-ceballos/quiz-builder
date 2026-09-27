// StepView.jsx — one quiz step (blocks + automatic "Continuar"), plus the frame around it (logo, back, progress)
import { ChevronLeft } from 'lucide-react';
import BlockView, { ContinueButton } from './BlockView';
import { stepFlow, isBlockVisible, isSingleSelect, optionAction, getOptions } from './logic';
import './blocks.css';

const GAP = { small: 14, medium: 20, large: 28 };

export function blockBoxStyle(block, T) {
    const s = {};
    if (block.bgColor) s.background = block.bgColor;
    if (block.padding) s.padding = block.padding;
    if (block.borderRadius) s.borderRadius = block.borderRadius === 999 ? 999 : block.borderRadius;
    if (block.borderStyle && block.borderStyle !== 'none') s.border = `${block.borderWidth || 1}px ${block.borderStyle} ${block.borderColor || T.border}`;
    if (block.shadow === 'sm') s.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
    if (block.shadow === 'md') s.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    if (block.shadow === 'lg') s.boxShadow = '0 10px 28px rgba(0,0,0,0.14)';
    if (block.opacity !== undefined && block.opacity !== 100) s.opacity = block.opacity / 100;
    if (block.heightPx) { s.height = block.heightPx; s.overflow = 'hidden'; }
    return s;
}

/**
 * props:
 *  step, T, design, mode ('edit' | 'live')
 *  answers, setAnswer(blockId, answer), vars, act(action), onLead(data), steps, legacy
 *  renderBlock?(block, index, node) — editor chrome wrapper (edit mode)
 *  selectedId — block selected in the editor (enables inline editing)
 *  onEditBlock?(blockId, patch)
 *  onContinueClick? — editor: clicking the auto button opens step settings
 */
export default function StepView({ step, T, design = {}, mode, answers = {}, setAnswer, vars = {}, act, onLead, steps = [], legacy, renderBlock, selectedId, onEditBlock, onContinueClick }) {
    if (!step) return null;
    const flow = stepFlow(step, mode === 'live' ? answers : {});
    const blocks = step.blocks || [];
    const gap = GAP[design.spacing] ?? GAP.small;
    const anim = design.animation || 'fade-up';

    const continueAction = () => {
        // A selected option with its own action wins over the step's default exit
        for (const b of flow.questions) {
            if (isSingleSelect(b) && answers[b.id]?.ids?.length) {
                const opt = getOptions(b).find(o => o.id === answers[b.id].ids[0]);
                const a = optionAction(opt);
                if (a) return a;
            }
        }
        return { type: 'next' };
    };

    const submit = () => { if (mode === 'live' && flow.valid) act(continueAction()); };

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap, alignItems: 'flex-start' }}>
            {blocks.map((block, i) => {
                const visible = mode === 'edit' || isBlockVisible(block, answers);
                if (!visible) return null;
                const w = block.widthPct || 100;
                const ctx = {
                    mode, vars, steps, legacy,
                    answer: answers[block.id], answers,
                    setAnswer: a => setAnswer?.(block.id, a),
                    act: a => act?.(a),
                    onLead,
                    onSubmit: submit,
                    autoAdvance: flow.autoBlockId === block.id,
                    editable: mode === 'edit' && selectedId === block.id,
                    onEdit: patch => onEditBlock?.(block.id, patch),
                };
                const inner = (
                    <div style={blockBoxStyle(block, T)}>
                        <BlockView block={block} T={T} ctx={ctx} />
                    </div>
                );
                const animCls = mode === 'live' && (block.anim || anim) !== 'none' ? `qv-in-${block.anim || anim}` : '';
                return (
                    <div key={block.id || i} className={animCls}
                        style={{ width: w < 100 ? `calc(${w}% - ${gap / 2}px)` : '100%', animationDelay: animCls ? `${Math.min(i, 6) * 70}ms` : undefined, minWidth: 0 }}>
                        {renderBlock ? renderBlock(block, i, inner) : inner}
                    </div>
                );
            })}
            {flow.needsContinue && blocks.length > 0 && (
                <div style={{ width: '100%' }} className={mode === 'live' && anim !== 'none' ? `qv-in-${anim}` : ''}
                    onClick={mode === 'edit' ? (e => { e.stopPropagation(); onContinueClick?.(); }) : undefined}>
                    <ContinueButton T={T} mode={mode} label={step.continueLabel} disabled={!flow.valid} onClick={submit} />
                </div>
            )}
        </div>
    );
}

// ── Frame: background, header (back / logo) and progress bar ──
export function QuizFrame({ T, design = {}, step, index = 0, total = 1, canBack, onBack, children, minHeight = '100%', scrollRef, flush }) {
    const showProgress = design.showProgress !== false && !step?.hideProgress && total > 1;
    const showLogo = design.showLogo !== false && !!design.logoUrl && !step?.hideHeader;
    const showBack = design.allowBack !== false && canBack && !step?.hideHeader;
    const pct = Math.round(((index + 1) / Math.max(total, 1)) * 100);
    return (
        <div ref={scrollRef} className="qv-root" style={{
            '--qv-primary': T.primary, '--qv-rgb': T.rgb, '--qv-radius': `${T.radius}px`,
            minHeight, background: T.bgImage ? `url(${T.bgImage}) center / cover no-repeat, ${T.bg}` : T.bg,
            color: T.text, fontFamily: `'${T.font}', Inter, -apple-system, 'Segoe UI', sans-serif`, display: 'flex', flexDirection: 'column',
        }}>
            <div style={{ width: '100%', maxWidth: flush ? '100%' : T.mainWidth, margin: '0 auto', padding: flush ? 0 : '0 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {(showBack || showLogo || showProgress) && (
                    <div style={{ paddingTop: 14 }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: showLogo || showBack ? 36 : 0 }}>
                            {showBack && (
                                <button type="button" onClick={onBack} aria-label="Voltar"
                                    style={{ position: 'absolute', left: -8, background: 'none', border: 'none', cursor: 'pointer', color: T.text, padding: 6, display: 'flex' }}>
                                    <ChevronLeft size={24} />
                                </button>
                            )}
                            {showLogo && <img src={design.logoUrl} alt="Logo" style={{ maxHeight: 34, maxWidth: 150, objectFit: 'contain' }} />}
                        </div>
                        {showProgress && (
                            <div style={{ height: 6, borderRadius: 99, background: `rgba(${T.rgb},.12)`, overflow: 'hidden', marginTop: showLogo || showBack ? 10 : 4 }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: T.primary, borderRadius: 99, transition: 'width .5s cubic-bezier(.4,0,.2,1)' }} />
                            </div>
                        )}
                    </div>
                )}
                <div style={{ flex: 1, padding: flush ? 0 : '22px 0 36px', textAlign: T.align, display: 'flex', flexDirection: 'column' }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
