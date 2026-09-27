// Inspector.jsx — right panel for the selected block: Conteúdo / Estilo / Lógica
import { useState } from 'react';
import { Copy, Trash2, X, GitBranch, Palette as PaletteIcon, FileText, Plus, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import PropertiesPanel from '../components/PropertiesPanel';
import { paletteByType } from '../blocks/registry';
import { ANSWERABLE_TYPES, getOptions, normalizeAction, isMultiSelect, isSingleSelect, defaultVarName } from '../blocks/logic';
import OptionsEditor from './OptionsEditor';
import { Section, Field, Seg, Switch, TextWithVars, ImageField, ActionPicker, EmojiInput } from './ui';

const CUSTOM_CONTENT = new Set([
    'choice', 'single-choice', 'image-select', 'yes-no', 'rating', 'nps', 'slider', 'text-input', 'email-input', 'phone-input',
    'textarea-input', 'date-input', 'capture', 'text', 'button', 'welcome', 'outcome', 'price', 'timer', 'video', 'lottie', 'projection',
]);

function answerableBlocksBefore(steps, stepIndex, blockId) {
    const out = [];
    steps.forEach((s, si) => {
        if (si > stepIndex) return;
        for (const b of s.blocks || []) {
            if (si === stepIndex && b.id === blockId) break;
            if (ANSWERABLE_TYPES.has(b.type) || ['scroll-picker', 'weight-picker', 'number-input'].includes(b.type)) out.push({ block: b, step: s, stepIndex: si });
        }
    });
    return out;
}

function ConditionEditor({ block, steps, stepIndex, onChange }) {
    const sources = answerableBlocksBefore(steps, stepIndex, block.id);
    const cond = block.showIf || null;
    const src = sources.find(x => x.block.id === cond?.blockId)?.block;
    const hasOptions = src && getOptions(src).length > 0 && !['rating', 'nps', 'slider'].includes(src.type);
    if (!cond) {
        return (
            <div>
                <div className="qb-hint" style={{ marginBottom: 8 }}>Mostre este bloco só para quem respondeu algo específico antes. Ex: um depoimento diferente para cada objetivo.</div>
                <button type="button" className="qb-btn dashed" disabled={!sources.length} onClick={() => onChange({ showIf: { blockId: sources[sources.length - 1]?.block.id, op: 'is', optionIds: [] } })}>
                    <Plus size={13} /> Adicionar condição
                </button>
                {!sources.length && <div className="qb-hint">Adicione uma pergunta em uma etapa anterior para usar condições.</div>}
            </div>
        );
    }
    return (
        <div className="qb-card">
            <Field label="Mostrar somente se a pergunta">
                <select className="qb-sel" value={cond.blockId || ''} onChange={e => onChange({ showIf: { ...cond, blockId: e.target.value, optionIds: [] } })}>
                    {sources.map(({ block: b, stepIndex: si }) => <option key={b.id} value={b.id}>{si + 1}. {(b.text || b.title || paletteByType(b.type, b).label).slice(0, 48)}</option>)}
                </select>
            </Field>
            <Field>
                <select className="qb-sel" value={cond.op || 'is'} onChange={e => onChange({ showIf: { ...cond, op: e.target.value } })}>
                    {hasOptions ? (<>
                        <option value="is">tiver como resposta</option>
                        <option value="not">não tiver como resposta</option>
                    </>) : (<>
                        <option value="gte">for maior ou igual a</option>
                        <option value="lte">for menor ou igual a</option>
                    </>)}
                    <option value="answered">tiver sido respondida</option>
                </select>
            </Field>
            {hasOptions && (cond.op === 'is' || cond.op === 'not' || !cond.op) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {getOptions(src).map(o => (
                        <label key={o.id} className="qb-switch" style={{ justifyContent: 'flex-start', padding: '4px 0' }}>
                            <input type="checkbox" style={{ display: 'inline-block', accentColor: '#4f46e5' }} checked={(cond.optionIds || []).includes(o.id)}
                                onChange={e => onChange({ showIf: { ...cond, optionIds: e.target.checked ? [...(cond.optionIds || []), o.id] : (cond.optionIds || []).filter(x => x !== o.id) } })} />
                            <span>{o.emoji} {o.text}</span>
                        </label>
                    ))}
                    <div className="qb-hint">Qualquer uma das marcadas.</div>
                </div>
            )}
            {!hasOptions && (cond.op === 'gte' || cond.op === 'lte') && (
                <input className="qb-in" type="number" value={cond.value ?? ''} placeholder="Valor" onChange={e => onChange({ showIf: { ...cond, value: e.target.value } })} />
            )}
            <button type="button" className="qb-btn danger block" style={{ marginTop: 8 }} onClick={() => onChange({ showIf: null })}>Remover condição</button>
        </div>
    );
}

function OutcomesEditor({ block, onChange }) {
    const outcomes = block.outcomes || [];
    const upd = (i, patch) => onChange({ outcomes: outcomes.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
    return (
        <div>
            <div className="qb-hint" style={{ marginBottom: 10 }}>A pessoa vê o resultado cuja faixa contém a pontuação dela. Os pontos vêm das opções de cada pergunta (edite em “Mais opções” de cada opção).</div>
            {outcomes.map((o, i) => (
                <div key={o.id || i} className="qb-card" style={{ borderColor: (block._previewIdx || 0) === i ? '#a5b4fc' : undefined }}>
                    <div className="qb-row" style={{ marginBottom: 8 }}>
                        <b style={{ fontSize: '.74rem', flex: 1 }}>Resultado {i + 1}</b>
                        <button type="button" className="qb-chip action" onClick={() => onChange({ _previewIdx: i })}>{(block._previewIdx || 0) === i ? 'Na prévia' : 'Ver na prévia'}</button>
                        <button type="button" className="qb-opt-more" onClick={() => onChange({ outcomes: outcomes.filter((_, j) => j !== i), _previewIdx: 0 })}><Trash2 size={13} /></button>
                    </div>
                    <div className="qb-row" style={{ marginBottom: 8 }}>
                        <Field label="De (pts)"><input className="qb-in" type="number" value={o.min ?? 0} onChange={e => upd(i, { min: Number(e.target.value) })} /></Field>
                        <Field label="Até (pts)"><input className="qb-in" type="number" value={o.max ?? ''} placeholder="∞" onChange={e => upd(i, { max: e.target.value === '' ? '' : Number(e.target.value) })} /></Field>
                        <Field label="Emoji"><input className="qb-in" value={o.emoji || ''} onChange={e => upd(i, { emoji: e.target.value })} style={{ width: 52 }} /></Field>
                    </div>
                    <Field label="Título"><TextWithVars value={o.title} onChange={v => upd(i, { title: v })} /></Field>
                    <Field label="Texto"><TextWithVars multiline value={o.text} onChange={v => upd(i, { text: v })} /></Field>
                    <Field label="Imagem"><ImageField value={o.image} onChange={v => upd(i, { image: v })} height={70} /></Field>
                    <div className="qb-row">
                        <Field label="Botão"><input className="qb-in" value={o.ctaText || ''} onChange={e => upd(i, { ctaText: e.target.value })} /></Field>
                        <Field label="Link do botão"><input className="qb-in" value={o.ctaUrl || ''} placeholder="https://" onChange={e => upd(i, { ctaUrl: e.target.value })} /></Field>
                    </div>
                </div>
            ))}
            <button type="button" className="qb-btn dashed" onClick={() => {
                const last = outcomes[outcomes.length - 1];
                const min = last ? (last.max === '' || last.max === undefined ? Number(last.min) + 5 : Number(last.max) + 1) : 0;
                onChange({ outcomes: [...outcomes, { id: `r_${Date.now()}`, min, max: '', emoji: '⭐', title: 'Novo resultado', text: '', ctaText: 'Continuar →', ctaUrl: '' }] });
            }}><Plus size={13} /> Resultado</button>
        </div>
    );
}

function AlignSeg({ value, onChange }) {
    return <Seg value={value || 'center'} onChange={onChange} options={[
        { value: 'left', icon: <AlignLeft size={13} />, label: '', title: 'Esquerda' },
        { value: 'center', icon: <AlignCenter size={13} />, label: '', title: 'Centro' },
        { value: 'right', icon: <AlignRight size={13} />, label: '', title: 'Direita' },
    ]} />;
}

function ContentTab({ block, set, steps, stepId, config, onConfigChange }) {
    const t = block.type;
    const isQuestion = ['choice', 'single-choice', 'image-select', 'rating', 'nps', 'slider', 'yes-no'].includes(t);

    if (!CUSTOM_CONTENT.has(t)) {
        return <PropertiesPanel mode="component" block={block} onChange={nb => set(nb, true)} config={config} onConfigChange={onConfigChange} steps={steps} />;
    }

    return (<>
        {isQuestion && (
            <Section title="Pergunta">
                <Field><TextWithVars multiline rows={2} value={block.text} onChange={v => set({ text: v })} placeholder="Escreva a pergunta" /></Field>
                <Field label="Descrição"><input className="qb-in" value={block.desc || ''} placeholder="Opcional" onChange={e => set({ desc: e.target.value })} /></Field>
            </Section>
        )}

        {['choice', 'image-select', 'single-choice'].includes(t) && (<>
            <Section title="Formato">
                {t !== 'single-choice' && (
                    <Field label="Seleção">
                        <Seg value={isMultiSelect(block) ? 'multi' : 'single'} onChange={v => set({ multiSelect: v === 'multi', autoAdvance: v === 'multi' ? false : block.autoAdvance ?? true })}
                            options={[{ value: 'single', label: 'Uma resposta' }, { value: 'multi', label: 'Várias' }]} />
                    </Field>
                )}
                {t === 'choice' && (
                    <Field label="Layout">
                        <Seg value={block.optionLayout || 'list'} onChange={v => set({ optionLayout: v })} options={[
                            { value: 'list', label: 'Lista' }, { value: 'grid', label: 'Grade' }, { value: 'image-text', label: 'Imagens' }, { value: 'horizontal', label: 'Linha' }, { value: 'icon-text', label: 'Ícone' },
                        ]} />
                    </Field>
                )}
                {isMultiSelect(block) && (
                    <div className="qb-row">
                        <Field label="Mínimo"><input className="qb-in" type="number" min={0} value={block.minSelect || ''} placeholder="—" onChange={e => set({ minSelect: e.target.value ? Number(e.target.value) : undefined })} /></Field>
                        <Field label="Máximo"><input className="qb-in" type="number" min={0} value={block.maxSelect || ''} placeholder="—" onChange={e => set({ maxSelect: e.target.value ? Number(e.target.value) : undefined })} /></Field>
                    </div>
                )}
                {isSingleSelect(block) && <Switch label="Avançar ao clicar" checked={block.autoAdvance !== false} onChange={v => set({ autoAdvance: v })} hint="Sem botão Continuar quando é a única pergunta da etapa." />}
                <Switch label="Letras A, B, C" checked={block.showLetters} onChange={v => set({ showLetters: v })} />
                {t === 'choice' && !isMultiSelect(block) && <Switch label="Marcador de seleção" checked={block.showIndicator} onChange={v => set({ showIndicator: v })} />}
            </Section>
            <Section><OptionsEditor block={block} onChange={p => set(p)} steps={steps} stepId={stepId} /></Section>
        </>)}

        {t === 'yes-no' && (
            <Section title="Respostas">
                {[['yes', 'Sim'], ['no', 'Não']].map(([k, def]) => (
                    <div key={k} className="qb-card">
                        <div className="qb-row" style={{ marginBottom: 8 }}>
                            <EmojiInput value={block[`${k}Emoji`]} onChange={v => set({ [`${k}Emoji`]: v })} />
                            <input className="qb-in" value={block[`${k}Label`] || ''} placeholder={def} onChange={e => set({ [`${k}Label`]: e.target.value })} />
                        </div>
                        <Field label="Ao escolher"><ActionPicker value={block[`${k}Action`]} steps={steps} currentStepId={stepId} defaultLabel="Seguir o fluxo da etapa" onChange={a => set({ [`${k}Action`]: a })} /></Field>
                        <Field label="Pontos"><input className="qb-in" type="number" value={block[`${k}Points`] ?? ''} onChange={e => set({ [`${k}Points`]: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
                    </div>
                ))}
                <Switch label="Avançar ao clicar" checked={block.autoAdvance !== false} onChange={v => set({ autoAdvance: v })} />
            </Section>
        )}

        {t === 'rating' && (
            <Section title="Avaliação">
                <Field label="Ícone"><Seg value={block.icon || 'star'} onChange={v => set({ icon: v })} options={[{ value: 'star', label: '★ Estrelas' }, { value: 'heart', label: '♥ Corações' }, { value: 'emoji', label: '😊 Emojis' }]} /></Field>
                {block.icon !== 'emoji' && <Field label={`Quantidade: ${block.max || 5}`}><input type="range" min={3} max={10} value={block.max || 5} onChange={e => set({ max: Number(e.target.value) })} style={{ width: '100%', accentColor: '#4f46e5' }} /></Field>}
                <div className="qb-row">
                    <Field label="Rótulo menor"><input className="qb-in" value={block.minLabel || ''} onChange={e => set({ minLabel: e.target.value })} /></Field>
                    <Field label="Rótulo maior"><input className="qb-in" value={block.maxLabel || ''} onChange={e => set({ maxLabel: e.target.value })} /></Field>
                </div>
                <Switch label="Avançar ao clicar" checked={block.autoAdvance !== false} onChange={v => set({ autoAdvance: v })} />
                <Switch label="Somar nota na pontuação" checked={block.countPoints} onChange={v => set({ countPoints: v })} />
            </Section>
        )}

        {t === 'nps' && (
            <Section title="Escala 0–10">
                <div className="qb-row">
                    <Field label="Rótulo 0"><input className="qb-in" value={block.minLabel || ''} onChange={e => set({ minLabel: e.target.value })} /></Field>
                    <Field label="Rótulo 10"><input className="qb-in" value={block.maxLabel || ''} onChange={e => set({ maxLabel: e.target.value })} /></Field>
                </div>
                <Switch label="Cores (vermelho → verde)" checked={block.colored} onChange={v => set({ colored: v })} />
                <Switch label="Avançar ao clicar" checked={block.autoAdvance !== false} onChange={v => set({ autoAdvance: v })} />
                <Switch label="Somar nota na pontuação" checked={block.countPoints} onChange={v => set({ countPoints: v })} />
            </Section>
        )}

        {t === 'slider' && (
            <Section title="Escala">
                <div className="qb-row">
                    <Field label="Mín."><input className="qb-in" type="number" value={block.min ?? 0} onChange={e => set({ min: Number(e.target.value) })} /></Field>
                    <Field label="Máx."><input className="qb-in" type="number" value={block.max ?? 10} onChange={e => set({ max: Number(e.target.value) })} /></Field>
                    <Field label="Passo"><input className="qb-in" type="number" value={block.step ?? 1} onChange={e => set({ step: Number(e.target.value) || 1 })} /></Field>
                </div>
                <div className="qb-row">
                    <Field label="Inicial"><input className="qb-in" type="number" value={block.defaultValue ?? ''} onChange={e => set({ defaultValue: Number(e.target.value) })} /></Field>
                    <Field label="Unidade"><input className="qb-in" value={block.unit || ''} placeholder="kg, h, R$…" onChange={e => set({ unit: e.target.value })} /></Field>
                </div>
                <div className="qb-row">
                    <Field label="Rótulo mín."><input className="qb-in" value={block.minLabel || ''} onChange={e => set({ minLabel: e.target.value })} /></Field>
                    <Field label="Rótulo máx."><input className="qb-in" value={block.maxLabel || ''} onChange={e => set({ maxLabel: e.target.value })} /></Field>
                </div>
                <Switch label="Somar valor na pontuação" checked={block.countPoints} onChange={v => set({ countPoints: v })} />
            </Section>
        )}

        {['text-input', 'email-input', 'phone-input', 'textarea-input', 'date-input'].includes(t) && (
            <Section title="Campo">
                <Field label="Pergunta / rótulo"><TextWithVars value={block.text} onChange={v => set({ text: v })} /></Field>
                {t !== 'date-input' && <Field label="Texto de exemplo"><input className="qb-in" value={block.placeholder || ''} onChange={e => set({ placeholder: e.target.value })} /></Field>}
                <Switch label="Obrigatório" checked={block.required === undefined ? !['textarea-input', 'date-input'].includes(t) : block.required} onChange={v => set({ required: v })} />
            </Section>
        )}

        {t === 'capture' && (
            <Section title="Formulário de lead">
                <Field label="Título"><TextWithVars value={block.title} onChange={v => set({ title: v })} /></Field>
                <Field label="Subtítulo"><TextWithVars value={block.subtitle} onChange={v => set({ subtitle: v })} /></Field>
                <Field label="Campos">
                    {[['name', 'Nome'], ['email', 'E-mail'], ['phone', 'WhatsApp']].map(([k, l]) => (
                        <Switch key={k} label={l} checked={(block.fields || []).includes(k)} onChange={v => set({ fields: v ? [...new Set([...(block.fields || []), k])] : (block.fields || []).filter(f => f !== k) })} />
                    ))}
                </Field>
                <Field label="Texto do botão"><input className="qb-in" value={block.buttonText || ''} onChange={e => set({ buttonText: e.target.value })} /></Field>
                <Field label="Consentimento (LGPD)" hint="Se preenchido, mostra uma caixinha obrigatória."><input className="qb-in" value={block.consentText || ''} placeholder="Ex: Aceito receber contato por WhatsApp" onChange={e => set({ consentText: e.target.value })} /></Field>
                <div className="qb-hint">Os dados preenchidos viram as variáveis {'{{nome}}'}, {'{{email}}'} e {'{{telefone}}'} e o lead é salvo na hora.</div>
            </Section>
        )}

        {t === 'text' && (
            <Section title="Texto">
                <Field label="Tipo"><Seg value={block.variant || 'body'} onChange={v => set({ variant: v })} options={[{ value: 'headline', label: 'Título' }, { value: 'subheadline', label: 'Subtítulo' }, { value: 'body', label: 'Texto' }, { value: 'caption', label: 'Legenda' }]} /></Field>
                <Field hint="Dica: use **negrito** e variáveis como {{nome}}. Você também pode editar direto no celular."><TextWithVars multiline rows={4} value={block.content} onChange={v => set({ content: v })} /></Field>
                <div className="qb-row">
                    <Field label="Alinhamento"><AlignSeg value={block.align} onChange={v => set({ align: v })} /></Field>
                    <Field label="Cor"><input type="color" value={block.textColor || '#111827'} onChange={e => set({ textColor: e.target.value })} style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} /></Field>
                </div>
                <div className="qb-row">
                    <Switch label="Negrito" checked={block.bold} onChange={v => set({ bold: v })} />
                    <Switch label="Itálico" checked={block.italic} onChange={v => set({ italic: v })} />
                </div>
            </Section>
        )}

        {t === 'button' && (<>
            <Section title="Botão">
                <Field label="Texto"><TextWithVars value={block.text} onChange={v => set({ text: v })} /></Field>
                <Field label="Texto abaixo (opcional)"><input className="qb-in" value={block.subtext || ''} placeholder="Ex: 🔒 Compra segura" onChange={e => set({ subtext: e.target.value })} /></Field>
                <Field label="Estilo"><Seg value={block.style || 'primary'} onChange={v => set({ style: v })} options={[{ value: 'primary', label: 'Sólido' }, { value: 'outline', label: 'Contorno' }, { value: 'ghost', label: 'Suave' }]} /></Field>
                <Field label="Tamanho"><Seg value={block.size || 'lg'} onChange={v => set({ size: v })} options={[{ value: 'lg', label: 'Largo' }, { value: 'md', label: 'Médio' }, { value: 'sm', label: 'Pequeno' }]} /></Field>
                <Field label="Animação"><Seg value={block.animation || 'none'} onChange={v => set({ animation: v })} options={[{ value: 'none', label: 'Nenhuma' }, { value: 'pulse', label: 'Pulsar' }, { value: 'glow', label: 'Brilho' }, { value: 'shake', label: 'Tremer' }]} /></Field>
                <div className="qb-row">
                    <Field label="Cor do botão"><input type="color" value={block.buttonColor || config.primaryColor || '#2563eb'} onChange={e => set({ buttonColor: e.target.value })} style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} /></Field>
                    <Field label="Cor do texto"><input type="color" value={block.buttonTextColor || '#ffffff'} onChange={e => set({ buttonTextColor: e.target.value })} style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} /></Field>
                    {(block.buttonColor || block.buttonTextColor) && <button type="button" className="qb-chip" onClick={() => set({ buttonColor: '', buttonTextColor: '' })}>Usar tema</button>}
                </div>
            </Section>
            <Section title="Ao clicar">
                <ActionPicker value={block.action || (block.url ? { type: 'url', url: block.url, newTab: true } : null)} steps={steps} currentStepId={stepId} onChange={a => set({ action: a, url: undefined })} />
            </Section>
        </>)}

        {t === 'welcome' && (
            <Section title="Capa">
                <Field label="Emoji"><EmojiInput value={block.emoji} onChange={v => set({ emoji: v })} /></Field>
                <Field label="Título"><TextWithVars multiline rows={2} value={block.headline} onChange={v => set({ headline: v })} /></Field>
                <Field label="Subtítulo"><TextWithVars multiline rows={2} value={block.subtitle} onChange={v => set({ subtitle: v })} /></Field>
                <Field label="Botão"><input className="qb-in" value={block.cta || ''} onChange={e => set({ cta: e.target.value })} /></Field>
                <Field label="Nota abaixo do botão"><input className="qb-in" value={block.note ?? '⏱ Leva menos de 2 minutos'} onChange={e => set({ note: e.target.value })} /></Field>
                <Field label="Imagem"><ImageField value={block.imageUrl} onChange={v => set({ imageUrl: v })} /></Field>
                {block.imageUrl && <Field label="Posição da imagem"><Seg value={block.imagePosition || 'top'} onChange={v => set({ imagePosition: v })} options={[{ value: 'top', label: 'Topo' }, { value: 'center', label: 'Meio' }, { value: 'bottom', label: 'Fim' }]} /></Field>}
                <Field label="Alinhamento"><AlignSeg value={block.textAlign || 'center'} onChange={v => set({ textAlign: v })} /></Field>
            </Section>
        )}

        {t === 'outcome' && (
            <Section title="Resultados por pontuação">
                <Field label="Selo no topo"><TextWithVars value={block.title} onChange={v => set({ title: v })} /></Field>
                <OutcomesEditor block={block} onChange={set} />
            </Section>
        )}

        {t === 'price' && (
            <Section title="Oferta">
                <Field label="Nome da oferta"><input className="qb-in" value={block.title || ''} onChange={e => set({ title: e.target.value })} /></Field>
                <div className="qb-row">
                    <Field label="De"><input className="qb-in" value={block.originalPrice || ''} onChange={e => set({ originalPrice: e.target.value })} /></Field>
                    <Field label="Por"><input className="qb-in" value={block.price || ''} onChange={e => set({ price: e.target.value })} /></Field>
                </div>
                <div className="qb-row">
                    <Field label="Selo"><input className="qb-in" value={block.discount || ''} placeholder="76% OFF" onChange={e => set({ discount: e.target.value })} /></Field>
                    <Field label="Parcelas"><input className="qb-in" value={block.installments || ''} placeholder="ou 12x de R$ 4,70" onChange={e => set({ installments: e.target.value })} /></Field>
                </div>
                <Field label="Itens inclusos (um por linha)"><textarea className="qb-ta" rows={3} value={(block.features || []).join('\n')} onChange={e => set({ features: e.target.value.split('\n') })} /></Field>
                <Field label="Texto do botão"><input className="qb-in" value={block.cta || ''} onChange={e => set({ cta: e.target.value })} /></Field>
                <Field label="Link do checkout"><input className="qb-in" value={block.ctaUrl || ''} placeholder="https://pay.hotmart.com/…" onChange={e => set({ ctaUrl: e.target.value })} /></Field>
                <Field label="Cor do botão"><input type="color" value={block.ctaColor || '#16a34a'} onChange={e => set({ ctaColor: e.target.value })} style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} /></Field>
            </Section>
        )}

        {t === 'video' && (
            <Section title="Vídeo">
                <Field label="Link do vídeo" hint="YouTube, Vimeo, Wistia, Panda, Bunny ou arquivo .mp4">
                    <input className="qb-in" value={block.videoUrl || ''} placeholder="https://youtube.com/watch?v=…" onChange={e => set({ videoUrl: e.target.value, embedHtml: e.target.value ? '' : block.embedHtml })} />
                </Field>
                <Field label="…ou código de incorporação" hint="Cole o código do player (Vturb, Panda, etc.). Tem prioridade sobre o link.">
                    <textarea className="qb-ta" rows={4} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.7rem' }} value={block.embedHtml || ''} placeholder='<div id="vid_…"></div><script src="https://scripts.converteai.net/…"></script>' onChange={e => set({ embedHtml: e.target.value })} />
                </Field>
                {block.provider && <div className="qb-hint">Origem detectada no clone: {block.provider}</div>}
                <Field label="Legenda"><input className="qb-in" value={block.caption || ''} onChange={e => set({ caption: e.target.value })} /></Field>
            </Section>
        )}

        {t === 'lottie' && (
            <Section title="Animação Lottie">
                <Field label="URL do arquivo .json" hint="Pegue em lottiefiles.com → Download → Lottie JSON (link)"><input className="qb-in" value={block.src || ''} onChange={e => set({ src: e.target.value })} /></Field>
                <Field label={`Altura: ${block.height || 220}px`}><input type="range" min={80} max={420} value={block.height || 220} onChange={e => set({ height: Number(e.target.value) })} style={{ width: '100%', accentColor: '#4f46e5' }} /></Field>
                <Switch label="Repetir" checked={block.loop !== false} onChange={v => set({ loop: v })} />
            </Section>
        )}

        {t === 'projection' && (
            <Section title="Gráfico de projeção">
                <div className="qb-hint" style={{ marginBottom: 8 }}>Use variáveis ou fórmulas, ex.: <code>{'{{peso}}'}</code>, <code>{'{{peso_meta}}'}</code>, <code>{"{{= data(7 * (peso - peso_meta), 'extenso')}}"}</code>.</div>
                <Field label="Título"><TextWithVars value={block.title} onChange={v => set({ title: v })} /></Field>
                <div className="qb-row">
                    <Field label="Valor atual"><input className="qb-in" value={block.from || ''} onChange={e => set({ from: e.target.value })} /></Field>
                    <Field label="Meta"><input className="qb-in" value={block.to || ''} onChange={e => set({ to: e.target.value })} /></Field>
                    <Field label="Unidade"><input className="qb-in" value={block.unit || ''} onChange={e => set({ unit: e.target.value })} style={{ width: 60 }} /></Field>
                </div>
                <div className="qb-row">
                    <Field label="Rótulo inicial"><TextWithVars value={block.startLabel} onChange={v => set({ startLabel: v })} /></Field>
                    <Field label="Rótulo final"><TextWithVars value={block.endLabel} onChange={v => set({ endLabel: v })} /></Field>
                </div>
                <Field label="Selo na meta"><input className="qb-in" value={block.badge || ''} onChange={e => set({ badge: e.target.value })} /></Field>
            </Section>
        )}

        {t === 'timer' && (
            <Section title="Timer">
                <Field label="Texto"><input className="qb-in" value={block.title || ''} onChange={e => set({ title: e.target.value })} /></Field>
                <div className="qb-row">
                    <Field label="Minutos"><input className="qb-in" type="number" min={0} value={Math.floor((block.duration || 0) / 60)} onChange={e => set({ duration: Number(e.target.value) * 60 + ((block.duration || 0) % 60) })} /></Field>
                    <Field label="Segundos"><input className="qb-in" type="number" min={0} max={59} value={(block.duration || 0) % 60} onChange={e => set({ duration: Math.floor((block.duration || 0) / 60) * 60 + Math.min(59, Number(e.target.value)) })} /></Field>
                </div>
                <Field label="Formato"><Seg value={block.timerFormat || 'digital'} onChange={v => set({ timerFormat: v })} options={[{ value: 'digital', label: 'Digital' }, { value: 'circular', label: 'Círculo' }, { value: 'progress', label: 'Barra' }]} /></Field>
                <Switch label="Avançar quando zerar" checked={block.autoAdvance} onChange={v => set({ autoAdvance: v })} />
            </Section>
        )}
    </>);
}

function StyleTab({ block, set, config, onConfigChange, steps }) {
    return (<>
        <Section title="Largura">
            <Seg value={block.widthPct || 100} onChange={v => set({ widthPct: v })} options={[{ value: 25, label: '¼' }, { value: 50, label: '½' }, { value: 75, label: '¾' }, { value: 100, label: 'Inteira' }]} />
            <div className="qb-hint">Blocos menores ficam lado a lado.</div>
        </Section>
        <Section title="Animação de entrada">
            <Seg value={block.anim || ''} onChange={v => set({ anim: v || undefined })} options={[{ value: '', label: 'Padrão' }, { value: 'fade-up', label: 'Subir' }, { value: 'zoom', label: 'Zoom' }, { value: 'slide', label: 'Lado' }, { value: 'none', label: 'Nenhuma' }]} />
        </Section>
        <PropertiesPanel mode="style" block={block} onChange={nb => set(nb, true)} config={config} onConfigChange={onConfigChange} steps={steps} />
    </>);
}

function LogicTab({ block, set, steps, stepIndex, stepId }) {
    const answerable = ANSWERABLE_TYPES.has(block.type) || ['scroll-picker', 'weight-picker', 'number-input'].includes(block.type);
    const optActions = getOptions(block).filter(o => normalizeAction(o.action) || o.goToStep);
    return (<>
        <Section title="Visibilidade">
            <ConditionEditor block={block} steps={steps} stepIndex={stepIndex} onChange={set} />
        </Section>
        {answerable && (
            <Section title="Resposta">
                <Field label="Salvar como variável" hint={`Use {{${block.varName || defaultVarName(block) || 'variavel'}}} em qualquer texto das próximas etapas.`}>
                    <input className="qb-in" value={block.varName ?? defaultVarName(block)} placeholder="ex: objetivo" onChange={e => set({ varName: e.target.value.replace(/[^\w-]/g, '_').toLowerCase() })} />
                </Field>
                {!['scroll-picker', 'weight-picker', 'number-input', 'slider'].includes(block.type) && (
                    <Switch label="Resposta obrigatória" checked={block.required === undefined ? !['textarea-input', 'date-input'].includes(block.type) : block.required} onChange={v => set({ required: v })} />
                )}
            </Section>
        )}
        {getOptions(block).length > 0 && block.type !== 'yes-no' && (
            <Section title="Ramificação por opção">
                {optActions.length ? optActions.map(o => <div key={o.id} className="qb-hint" style={{ fontSize: '.72rem', color: '#4b5563' }}>• {o.emoji} {o.text} → <b>{normalizeAction(o.action || o.goToStep)?.type === 'goto' ? `etapa ${steps.findIndex(s => s.id === normalizeAction(o.action || o.goToStep).stepId) + 1}` : normalizeAction(o.action || o.goToStep)?.type}</b></div>)
                    : <div className="qb-hint">Nenhuma opção desvia o fluxo. Em Conteúdo, abra “Mais opções” de uma opção para escolher para onde ela leva.</div>}
            </Section>
        )}
        {['capture', 'welcome'].includes(block.type) && (
            <Section title="Ao enviar / clicar">
                <ActionPicker value={block.action} steps={steps} currentStepId={stepId} onChange={a => set({ action: a })} />
            </Section>
        )}
    </>);
}

export default function Inspector({ block, steps, stepIndex, config, onConfigChange, onChange, onDuplicate, onDelete, onClose }) {
    const [tab, setTab] = useState('content');
    const entry = paletteByType(block.type, block);
    const Icon = entry.icon;
    const stepId = steps[stepIndex]?.id;
    const hasLogic = !!block.showIf?.blockId || getOptions(block).some(o => normalizeAction(o.action) || o.goToStep);
    // set(patch) merges; set(fullBlock, true) replaces (legacy PropertiesPanel)
    const set = (patch, replace) => onChange(replace ? patch : { ...block, ...patch });

    return (
        <div className="qb-right">
            <div className="qb-insp-head">
                <span className="qb-item-icon" style={{ background: `${entry.color}14`, color: entry.color, width: 32, height: 32 }}><Icon size={16} /></span>
                <div className="qb-insp-title"><b>{entry.label}</b><span>{entry.desc}</span></div>
                <button className="qb-opt-more" title="Duplicar (⌘D)" onClick={onDuplicate}><Copy size={14} /></button>
                <button className="qb-opt-more" title="Excluir (Delete)" onClick={onDelete}><Trash2 size={14} /></button>
                <button className="qb-opt-more" title="Fechar (Esc)" onClick={onClose}><X size={14} /></button>
            </div>
            <div className="qb-insp-tabs">
                <button className={`qb-insp-tab ${tab === 'content' ? 'active' : ''}`} onClick={() => setTab('content')}><FileText size={13} /> Conteúdo</button>
                <button className={`qb-insp-tab ${tab === 'style' ? 'active' : ''}`} onClick={() => setTab('style')}><PaletteIcon size={13} /> Estilo</button>
                <button className={`qb-insp-tab ${tab === 'logic' ? 'active' : ''}`} onClick={() => setTab('logic')}><GitBranch size={13} /> Lógica{hasLogic && <span style={{ width: 6, height: 6, borderRadius: 3, background: '#7c3aed' }} />}</button>
            </div>
            <div className="qb-insp-body" key={block.id}>
                {tab === 'content' && <ContentTab block={block} set={set} steps={steps} stepId={stepId} config={config} onConfigChange={onConfigChange} />}
                {tab === 'style' && <StyleTab block={block} set={set} config={config} onConfigChange={onConfigChange} steps={steps} />}
                {tab === 'logic' && <LogicTab block={block} set={set} steps={steps} stepIndex={stepIndex} stepId={stepId} />}
            </div>
        </div>
    );
}
