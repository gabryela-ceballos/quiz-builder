// CloneReview.jsx — side-by-side review of a cloned quiz: original screenshot × our version + conversion report
import { useState } from 'react';
import { X, Blocks, Code2, RefreshCw, GitBranch, Link2, Film, Sparkles, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import StepView, { QuizFrame } from '../blocks/StepView';
import { MIN_CONFIDENCE } from './cloneImport';

function Stat({ icon, label, value, tone }) {
    return (
        <div className={`qb-cr-stat ${tone || ''}`}>
            {icon}<b>{value}</b><span>{label}</span>
        </div>
    );
}

function MiniRender({ step, steps, index, T, config }) {
    if (step.clone?.mode === 'html') {
        return (
            <div className="qb-cr-html">
                <Code2 size={18} />
                <b>HTML fiel</b>
                <span>Visual idêntico ao original, editável no editor de página clonada.</span>
            </div>
        );
    }
    return (
        <div className="qb-cr-mini">
            <div className="qb-cr-mini-inner">
                <QuizFrame T={T} design={config} step={step} index={index} total={steps.length} canBack={index > 0} onBack={() => { }} minHeight={560}>
                    <StepView step={step} T={T} design={config} mode="edit" steps={steps} />
                </QuizFrame>
            </div>
        </div>
    );
}

export default function CloneReview({ steps, T, config, graphPartial, onClose, onSwitchMode, onSwitchAll, onGoToStep, onReclone, recloningIdx, canReclone }) {
    const [filter, setFilter] = useState('all');
    const cloned = steps.map((s, i) => ({ s, i })).filter(x => x.s.clone);
    const nativeCount = cloned.filter(x => x.s.clone.mode === 'native').length;
    const dynCount = cloned.reduce((a, x) => a + (x.s.clone.report?.dynamic?.length || 0), 0);
    const branchCount = cloned.filter(x => x.s.clone.branch).length;
    const linkCount = cloned.reduce((a, x) => a + (x.s.clone.report?.links?.length || 0), 0);
    const mediaCount = cloned.reduce((a, x) => a + (x.s.clone.report?.media?.length || 0), 0);
    const reviewCount = cloned.filter(x => (x.s.clone.confidence ?? 100) < MIN_CONFIDENCE || x.s.clone.report?.notes?.length).length;

    const list = cloned.filter(({ s }) => {
        if (filter === 'review') return (s.clone.confidence ?? 100) < MIN_CONFIDENCE || s.clone.report?.notes?.length;
        if (filter === 'dynamic') return s.clone.report?.dynamic?.length;
        if (filter === 'branch') return s.clone.branch || s.clone.optionRoutes?.length;
        return true;
    });

    return (
        <div className="qb-cr-overlay" onClick={onClose}>
            <div className="qb-cr" onClick={e => e.stopPropagation()}>
                <div className="qb-cr-head">
                    <div>
                        <h2>Revisão do clone</h2>
                        <p>Compare cada página com o original. Blocos são 100% editáveis; HTML fiel mantém o visual idêntico.</p>
                    </div>
                    <div className="qb-row">
                        <button className="qb-btn" onClick={() => onSwitchAll('native')}><Blocks size={14} /> Tudo em blocos</button>
                        <button className="qb-btn" onClick={() => onSwitchAll('html')}><Code2 size={14} /> Tudo em HTML</button>
                        <button className="qb-opt-more" onClick={onClose} title="Fechar"><X size={18} /></button>
                    </div>
                </div>
                <div className="qb-cr-stats">
                    <Stat icon={<CheckCircle2 size={15} />} value={cloned.length} label="páginas" />
                    <Stat icon={<Blocks size={15} />} value={nativeCount} label="em blocos" tone="ok" />
                    <Stat icon={<Sparkles size={15} />} value={dynCount} label="trechos dinâmicos" />
                    <Stat icon={<GitBranch size={15} />} value={branchCount} label="páginas de ramificação" />
                    <Stat icon={<Link2 size={15} />} value={linkCount} label="links/WhatsApp" />
                    <Stat icon={<Film size={15} />} value={mediaCount} label="mídias" />
                    {reviewCount > 0 && <Stat icon={<AlertTriangle size={15} />} value={reviewCount} label="para revisar" tone="warn" />}
                </div>
                {graphPartial && <div className="qb-cr-warn"><AlertTriangle size={14} /> A busca de caminhos alternativos parou antes do fim (tempo limite). Algumas ramificações podem estar faltando.</div>}
                <div className="qb-cr-filters">
                    {[['all', 'Todas'], ['review', 'Para revisar'], ['dynamic', 'Dinâmicas'], ['branch', 'Ramificações']].map(([k, l]) => (
                        <button key={k} className={`qb-chip ${filter === k ? 'action' : ''}`} onClick={() => setFilter(k)}>{l}</button>
                    ))}
                </div>
                <div className="qb-cr-list">
                    {list.map(({ s, i }) => {
                        const r = s.clone.report || {};
                        const low = (s.clone.confidence ?? 100) < MIN_CONFIDENCE;
                        return (
                            <div key={s.id} className="qb-cr-row">
                                <div className="qb-cr-col">
                                    <div className="qb-cr-label">Original</div>
                                    {s.clone.screenshotUrl
                                        ? <img className="qb-cr-shot" src={s.clone.screenshotUrl} alt={`Página ${i + 1} original`} loading="lazy" />
                                        : <div className="qb-cr-html"><span>Sem screenshot</span></div>}
                                </div>
                                <div className="qb-cr-col">
                                    <div className="qb-cr-label">No QuizFlow</div>
                                    <MiniRender step={s} steps={steps} index={i} T={T} config={config} />
                                </div>
                                <div className="qb-cr-info">
                                    <div className="qb-row" style={{ justifyContent: 'space-between' }}>
                                        <b className="qb-cr-title">{i + 1}. {s.name}</b>
                                        {s.clone.confidence !== null && s.clone.confidence !== undefined && (
                                            <span className={`qb-cr-conf ${low ? 'low' : ''}`} title="Quanto do texto da página foi reconhecido em blocos">{s.clone.confidence}%</span>
                                        )}
                                    </div>
                                    <div className="qb-seg" style={{ margin: '8px 0 10px' }}>
                                        <button className={s.clone.mode === 'native' ? 'active' : ''} disabled={!s.clone.native?.length} onClick={() => onSwitchMode(i, 'native')}><Blocks size={13} /> Blocos</button>
                                        <button className={s.clone.mode === 'html' ? 'active' : ''} onClick={() => onSwitchMode(i, 'html')}><Code2 size={13} /> HTML fiel</button>
                                    </div>
                                    {s.clone.branch && <div className="qb-cr-tag branch"><GitBranch size={12} /> Caminho alternativo: opção “{s.clone.branch.optionText}” da etapa {s.clone.branch.from + 1}</div>}
                                    {s.clone.optionRoutes?.length > 0 && <div className="qb-cr-tag branch"><GitBranch size={12} /> {s.clone.optionRoutes.length} opção(ões) levam para outro caminho</div>}
                                    {r.hasBack && <div className="qb-cr-tag">← Botão voltar detectado</div>}
                                    {(r.converted || []).length > 0 && (
                                        <ul className="qb-cr-ul ok">{r.converted.map((c, k) => <li key={k}>{c}</li>)}</ul>
                                    )}
                                    {(r.dynamic || []).length > 0 && (
                                        <div className="qb-cr-block">
                                            <div className="qb-cr-sub"><Sparkles size={12} /> Conteúdo dinâmico</div>
                                            {r.dynamic.map((d, k) => <div key={k} className="qb-cr-dyn"><span>{d.from}</span><ArrowRight size={11} /><code>{d.to}</code></div>)}
                                        </div>
                                    )}
                                    {(r.links || []).length > 0 && (
                                        <div className="qb-cr-block">
                                            <div className="qb-cr-sub"><Link2 size={12} /> Links</div>
                                            {r.links.map((l, k) => <div key={k} className="qb-cr-link">{l.role === 'whatsapp' ? '💬' : '🔗'} {l.text || 'Botão'} → <a href={l.href} target="_blank" rel="noreferrer">{l.href.replace(/^https?:\/\//, '').slice(0, 40)}</a></div>)}
                                        </div>
                                    )}
                                    {(r.media || []).length > 0 && <div className="qb-cr-tag"><Film size={12} /> {r.media.map(m => `${m.kind}${m.provider ? ` (${m.provider})` : ''}`).join(', ')}</div>}
                                    {(r.notes || []).length > 0 && (
                                        <ul className="qb-cr-ul warn">{r.notes.map((c, k) => <li key={k}>{c}</li>)}</ul>
                                    )}
                                    <div className="qb-row" style={{ marginTop: 10 }}>
                                        <button className="qb-btn" onClick={() => onGoToStep(i)}>Editar etapa</button>
                                        {canReclone && (
                                            <button className="qb-btn" disabled={recloningIdx !== null} onClick={() => onReclone(i)}>
                                                <RefreshCw size={13} className={recloningIdx === i ? 'spin' : ''} /> {recloningIdx === i ? 'Re-clonando…' : 'Re-clonar'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {!list.length && <div className="qb-hint" style={{ padding: 30, textAlign: 'center' }}>Nenhuma página neste filtro.</div>}
                </div>
            </div>
        </div>
    );
}
