// StepSettings.jsx — right panel when no block is selected: step flow settings + global design
import { Settings2, Palette as PaletteIcon, Zap, MousePointerClick, Hand, Blocks, Code2, RefreshCw, ScanSearch } from 'lucide-react';
import { stepFlow, describeAction, stepExitAction } from '../blocks/logic';
import { THEME_PRESETS, FONTS } from '../blocks/theme';
import { paletteByType } from '../blocks/registry';
import { Section, Field, Seg, Switch, ImageField, ActionPicker, TextWithVars } from './ui';

function FlowExplainer({ step, steps }) {
    if (!step?.blocks?.length) return null;
    const flow = stepFlow(step, {});
    const auto = step.blocks.find(b => b.id === flow.autoBlockId);
    const own = step.blocks.find(b => ['button', 'welcome', 'capture', 'scroll-picker', 'weight-picker', 'number-input', 'loading', 'progress-bar', 'risk-chart', 'bmi'].includes(b.type));
    let icon = <MousePointerClick size={15} />, text;
    if (auto) { icon = <Zap size={15} />; text = <>Avança sozinha quando a pessoa escolhe uma opção em <b>{paletteByType(auto.type, auto).label}</b>.</>; }
    else if (own) { icon = <Hand size={15} />; text = <>Avança pelo bloco <b>{paletteByType(own.type, own).label}</b>.</>; }
    else if (flow.needsContinue) text = <>Mostra o botão <b>{step.continueLabel || 'Continuar'}</b> no fim da etapa.</>;
    else text = <>Esta etapa não tem como avançar. Adicione um botão ou ligue o “Continuar”.</>;
    const exit = stepExitAction(step);
    return (
        <div className="qb-card" style={{ display: 'flex', gap: 10, background: '#f8f7ff', borderColor: '#e0e7ff' }}>
            <span style={{ color: '#4f46e5', marginTop: 1 }}>{icon}</span>
            <div style={{ fontSize: '.74rem', color: '#374151', lineHeight: 1.45 }}>
                {text}<br />
                <span style={{ color: '#6b7280' }}>Depois: {describeAction(exit, steps)}.</span>
            </div>
        </div>
    );
}

export default function StepSettings({ tab, setTab, step, steps, stepIndex, onStepChange, config, updateConfig, onSwitchCloneMode, onReclone, recloning, onOpenCloneReview }) {
    const set = patch => onStepChange({ ...step, ...patch });
    return (
        <div className="qb-right">
            <div className="qb-insp-tabs" style={{ paddingTop: 4 }}>
                <button className={`qb-insp-tab ${tab === 'step' ? 'active' : ''}`} onClick={() => setTab('step')}><Settings2 size={13} /> Etapa</button>
                <button className={`qb-insp-tab ${tab === 'design' ? 'active' : ''}`} onClick={() => setTab('design')}><PaletteIcon size={13} /> Design do quiz</button>
            </div>
            <div className="qb-insp-body">
                {tab === 'step' && step && (<>
                    {step.clone && (
                        <div className="qb-clone-card">
                            <div className="qb-row" style={{ justifyContent: 'space-between' }}>
                                <b style={{ fontSize: '.78rem' }}>Página clonada</b>
                                {step.clone.confidence != null && <span className={`qb-cr-conf ${step.clone.confidence < 45 ? 'low' : ''}`}>{step.clone.confidence}%</span>}
                            </div>
                            {step.clone.screenshotUrl && <img src={step.clone.screenshotUrl} alt="Original" onClick={() => window.open(step.clone.screenshotUrl, '_blank')} title="Ver original" />}
                            <div className="qb-seg" style={{ marginBottom: 8 }}>
                                <button className={step.clone.mode === 'native' ? 'active' : ''} disabled={!step.clone.native?.length} onClick={() => onSwitchCloneMode?.('native')}><Blocks size={13} /> Blocos editáveis</button>
                                <button className={step.clone.mode === 'html' ? 'active' : ''} onClick={() => onSwitchCloneMode?.('html')}><Code2 size={13} /> HTML fiel</button>
                            </div>
                            <div className="qb-hint" style={{ marginBottom: 8 }}>{step.clone.mode === 'native' ? 'Versão em blocos: edite tudo, use variáveis e lógica. A versão HTML fica guardada.' : 'Visual idêntico ao original. Seus ajustes nos blocos ficam guardados.'}</div>
                            <div className="qb-row">
                                {onOpenCloneReview && <button className="qb-btn" onClick={onOpenCloneReview}><ScanSearch size={13} /> Revisão</button>}
                                {onReclone && <button className="qb-btn" disabled={recloning} onClick={onReclone}><RefreshCw size={13} className={recloning ? 'spin' : ''} /> {recloning ? 'Re-clonando…' : 'Re-clonar página'}</button>}
                            </div>
                        </div>
                    )}
                    <Section title={`Etapa ${stepIndex + 1}`}>
                        <Field label="Nome (aparece nos relatórios)"><input className="qb-in" value={step.name || ''} onChange={e => set({ name: e.target.value })} /></Field>
                        <FlowExplainer step={step} steps={steps} />
                    </Section>
                    <Section title="Fluxo">
                        <Field label="Depois desta etapa">
                            <ActionPicker value={step.exitAction || step.goToStep} steps={steps} currentStepId={step.id} defaultLabel="Próxima etapa"
                                onChange={a => set({ exitAction: a, goToStep: undefined })} />
                        </Field>
                        <Field label="Botão Continuar">
                            <Seg value={step.continueButton || 'auto'} onChange={v => set({ continueButton: v })} options={[{ value: 'auto', label: 'Automático' }, { value: 'always', label: 'Sempre' }, { value: 'never', label: 'Nunca' }]} />
                        </Field>
                        {(step.continueButton || 'auto') !== 'never' && <Field label="Texto do botão"><input className="qb-in" value={step.continueLabel || ''} placeholder="Continuar" onChange={e => set({ continueLabel: e.target.value })} /></Field>}
                    </Section>
                    <Section title="Exibição">
                        <Switch label="Mostrar barra de progresso" checked={!step.hideProgress} onChange={v => set({ hideProgress: !v })} />
                        <Switch label="Mostrar logo e voltar" checked={!step.hideHeader} onChange={v => set({ hideHeader: !v })} />
                        <Switch label="🎉 Confete ao abrir" checked={step.confetti} onChange={v => set({ confetti: v })} hint="Ótimo para a etapa de resultado." />
                    </Section>
                </>)}

                {tab === 'design' && (<>
                    <Section title="Temas prontos">
                        <div className="qb-swatches">
                            {THEME_PRESETS.map(p => (
                                <button key={p.key} type="button" title={p.label} className={`qb-swatch ${config.primaryColor === p.primaryColor && (config.bgColor || '#ffffff') === p.bgColor ? 'active' : ''}`}
                                    style={{ background: `linear-gradient(135deg, ${p.primaryColor} 50%, ${p.bgColor} 50%)` }}
                                    onClick={() => { updateConfig('primaryColor', p.primaryColor); updateConfig('bgColor', p.bgColor); }} />
                            ))}
                        </div>
                    </Section>
                    <Section title="Cores">
                        <div className="qb-row">
                            <Field label="Principal">
                                <div className="qb-row"><input type="color" value={config.primaryColor || '#2563eb'} onChange={e => updateConfig('primaryColor', e.target.value)} style={{ width: 34, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
                                    <input className="qb-in" value={config.primaryColor || ''} onChange={e => updateConfig('primaryColor', e.target.value)} style={{ fontFamily: 'monospace', fontSize: '.72rem' }} /></div>
                            </Field>
                            <Field label="Fundo">
                                <div className="qb-row"><input type="color" value={config.bgColor || '#ffffff'} onChange={e => updateConfig('bgColor', e.target.value)} style={{ width: 34, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
                                    <input className="qb-in" value={config.bgColor || ''} placeholder="auto" onChange={e => updateConfig('bgColor', e.target.value)} style={{ fontFamily: 'monospace', fontSize: '.72rem' }} /></div>
                            </Field>
                        </div>
                        <Field label="Imagem de fundo"><ImageField value={config.bgImage} onChange={v => updateConfig('bgImage', v)} height={70} /></Field>
                    </Section>
                    <Section title="Marca">
                        <Field label="Logo"><ImageField value={config.logoUrl} onChange={v => updateConfig('logoUrl', v)} label="Enviar logo" height={60} /></Field>
                        <Switch label="Mostrar logo no topo" checked={config.showLogo !== false} onChange={v => updateConfig('showLogo', v)} />
                        <Switch label="Barra de progresso" checked={config.showProgress !== false} onChange={v => updateConfig('showProgress', v)} />
                        <Switch label="Botão de voltar" checked={config.allowBack !== false} onChange={v => updateConfig('allowBack', v)} />
                    </Section>
                    <Section title="Tipografia e forma">
                        <Field label="Fonte">
                            <select className="qb-sel" value={config.fontFamily || 'Inter'} onChange={e => updateConfig('fontFamily', e.target.value)}>
                                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </Field>
                        <Field label="Cantos"><Seg value={config.borderRadius || 'medium'} onChange={v => updateConfig('borderRadius', v)} options={[{ value: 'none', label: 'Retos' }, { value: 'small', label: 'Suaves' }, { value: 'medium', label: 'Médios' }, { value: 'large', label: 'Redondos' }]} /></Field>
                        <Field label="Alinhamento"><Seg value={config.alignment || 'center'} onChange={v => updateConfig('alignment', v)} options={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }]} /></Field>
                        <Field label="Largura no computador"><Seg value={config.mainWidth || 'small'} onChange={v => updateConfig('mainWidth', v)} options={[{ value: 'small', label: 'Estreita' }, { value: 'medium', label: 'Média' }, { value: 'large', label: 'Larga' }]} /></Field>
                        <Field label="Espaço entre blocos"><Seg value={config.spacing || 'small'} onChange={v => updateConfig('spacing', v)} options={[{ value: 'small', label: 'Compacto' }, { value: 'medium', label: 'Médio' }, { value: 'large', label: 'Amplo' }]} /></Field>
                        <Field label="Animação de entrada"><Seg value={config.animation || 'fade-up'} onChange={v => updateConfig('animation', v)} options={[{ value: 'fade-up', label: 'Subir' }, { value: 'zoom', label: 'Zoom' }, { value: 'slide', label: 'Lado' }, { value: 'fade', label: 'Fade' }, { value: 'none', label: 'Sem' }]} /></Field>
                    </Section>
                    <Section title="Pixel e scripts">
                        <div className="qb-hint" style={{ marginBottom: 8 }}>Cole o código do Pixel do Facebook, TikTok ou Google. Os eventos <b>Lead</b> (formulário), <b>InitiateCheckout</b> (botão de link) e <b>QuizComplete</b> são disparados sozinhos.</div>
                        <textarea className="qb-ta" rows={4} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.68rem' }} value={config.pixelCode || ''} placeholder="<script>!function(f,b,e,v,n,t,s){...}</script>" onChange={e => updateConfig('pixelCode', e.target.value)} />
                    </Section>
                    <Section title="Tela final">
                        <div className="qb-hint" style={{ marginBottom: 8 }}>Aparece quando a pessoa passa da última etapa ou uma ação “Finalizar quiz” é usada.</div>
                        <Field label="Título"><TextWithVars value={config.doneTitle} onChange={v => updateConfig('doneTitle', v)} placeholder="Tudo certo, {{primeiro_nome}}!" /></Field>
                        <Field label="Texto"><TextWithVars multiline rows={2} value={config.doneText} onChange={v => updateConfig('doneText', v)} placeholder="Suas respostas foram registradas." /></Field>
                    </Section>
                </>)}
            </div>
        </div>
    );
}
