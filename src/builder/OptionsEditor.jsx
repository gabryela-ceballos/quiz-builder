// OptionsEditor.jsx — option list with presets, paste-a-list, reorder, media, points, "Other" and per-option actions
import { useState, useRef, useEffect } from 'react';
import { GripVertical, Plus, Trash2, SlidersHorizontal, Sparkles, ClipboardPaste, ImagePlus } from 'lucide-react';
import { OPTION_PRESETS, presetOptions } from '../blocks/presets';
import { getOptions, newOptionId, describeAction, optionAction, isMultiSelect } from '../blocks/logic';
import { compressAndStore } from '../utils/imageStore';
import { ActionPicker, EmojiInput, Switch, Field } from './ui';

function PresetMenu({ onPick }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);
    const groups = [...new Set(OPTION_PRESETS.map(p => p.group))];
    return (
        <div className="qb-presets" ref={ref}>
            <button type="button" className="qb-chip action" onClick={() => setOpen(o => !o)}><Sparkles size={11} /> Opções prontas</button>
            {open && (
                <div className="qb-menu">
                    {groups.map(g => (
                        <div key={g}>
                            <div className="qb-menu-group">{g}</div>
                            {OPTION_PRESETS.filter(p => p.group === g).map(p => (
                                <button key={p.key} type="button" className="qb-menu-item" onClick={() => { onPick(p); setOpen(false); }}>
                                    {p.label}
                                    <small>{p.items.map(i => (Array.isArray(i) ? `${i[0]} ${i[1]}` : i)).join(' · ')}</small>
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function OptionsEditor({ block, onChange, steps, stepId }) {
    const options = getOptions(block);
    const [open, setOpen] = useState(null);
    const [drag, setDrag] = useState(null);
    const [over, setOver] = useState(null);
    const [paste, setPaste] = useState(null);
    const multi = isMultiSelect(block);

    const setOptions = list => onChange({ options: list });
    const upd = (i, patch) => setOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
    const remove = i => setOptions(options.filter((_, j) => j !== i));
    const add = (extra = {}) => setOptions([...options, { id: newOptionId(), text: extra.isOther ? 'Outro' : `Opção ${options.length + 1}`, emoji: '', points: options.length + 1, ...extra }]);
    const move = (from, to) => {
        if (from === to) return;
        const list = [...options];
        const [m] = list.splice(from, 1);
        list.splice(to > from ? to - 1 : to, 0, m);
        setOptions(list);
    };
    const pickImage = i => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = async e => { const f = e.target.files?.[0]; if (!f) return; try { const { dataUrl } = await compressAndStore(f); upd(i, { image: dataUrl }); } catch { /* ignore */ } };
        inp.click();
    };

    return (
        <div>
            <div className="qb-sec-title">
                <span>Opções ({options.length})</span>
                <span style={{ display: 'flex', gap: 4 }}>
                    <button type="button" className="qb-chip" title="Colar uma lista (uma opção por linha)" onClick={() => setPaste(paste === null ? options.map(o => o.text).join('\n') : null)}><ClipboardPaste size={11} /> Colar lista</button>
                    <PresetMenu onPick={p => setOptions(presetOptions(p))} />
                </span>
            </div>

            {paste !== null && (
                <div className="qb-card">
                    <textarea className="qb-ta" rows={5} autoFocus value={paste} onChange={e => setPaste(e.target.value)} placeholder={'Uma opção por linha\nEx:\n🔥 Perder peso\n💪 Ganhar massa'} />
                    <div className="qb-row" style={{ marginTop: 6, justifyContent: 'flex-end' }}>
                        <button type="button" className="qb-btn" onClick={() => setPaste(null)}>Cancelar</button>
                        <button type="button" className="qb-btn primary" onClick={() => {
                            const lines = paste.split('\n').map(l => l.trim()).filter(Boolean);
                            setOptions(lines.map((l, i) => {
                                const m = l.match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*(.*)$/u);
                                const prev = options[i];
                                return { ...(prev || {}), id: prev?.id || newOptionId(), text: m ? m[2] : l, emoji: m ? m[1] : (prev?.emoji || ''), points: prev?.points ?? i + 1 };
                            }));
                            setPaste(null);
                        }}>Aplicar</button>
                    </div>
                </div>
            )}

            <div onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}>
                {options.map((o, i) => {
                    const act = optionAction(o);
                    const isOpen = open === o.id;
                    const img = o.image && /^(data:|https?:|\/)/.test(o.image);
                    return (
                        <div key={o.id} className={`qb-opt ${over === i && drag !== null && drag !== i ? 'drop-above' : ''}`}
                            onDragOver={e => { if (drag === null) return; e.preventDefault(); setOver(i); }}
                            onDrop={e => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); setOver(null); }}>
                            <div className="qb-opt-row">
                                <span className="qb-opt-grip" draggable onDragStart={e => { e.dataTransfer.setData('text/plain', ''); setDrag(i); }} onDragEnd={() => { setDrag(null); setOver(null); }}><GripVertical size={14} /></span>
                                <span className="qb-opt-media" title="Emoji ou imagem" onClick={() => setOpen(isOpen ? null : o.id)}>
                                    {img ? <img src={o.image} alt="" /> : (o.emoji || (o.image && !img ? o.image : '') || <ImagePlus size={13} color="#9ca3af" />)}
                                </span>
                                <input className="qb-opt-text" value={o.text || ''} placeholder={`Opção ${i + 1}`} onChange={e => upd(i, { text: e.target.value })}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
                                <button type="button" className={`qb-opt-more ${isOpen ? 'on' : ''}`} title="Mais opções" onClick={() => setOpen(isOpen ? null : o.id)}><SlidersHorizontal size={13} /></button>
                                <button type="button" className="qb-opt-more" title="Remover" onClick={() => remove(i)}><Trash2 size={13} /></button>
                            </div>
                            {!isOpen && (act || o.points || o.isOther || o.exclusive) ? (
                                <div className="qb-opt-foot">
                                    {!!o.points && <button type="button" className="qb-chip pts" onClick={() => setOpen(o.id)}>{o.points} pt{o.points > 1 ? 's' : ''}</button>}
                                    {act && <button type="button" className="qb-chip action" onClick={() => setOpen(o.id)}>↳ {describeAction(act, steps)}</button>}
                                    {o.isOther && <span className="qb-chip">campo “Outro”</span>}
                                    {o.exclusive && <span className="qb-chip">exclusiva</span>}
                                </div>
                            ) : null}
                            {isOpen && (
                                <div className="qb-opt-detail">
                                    <div className="qb-row" style={{ alignItems: 'flex-start' }}>
                                        <Field label="Emoji"><EmojiInput value={o.emoji} onChange={v => upd(i, { emoji: v })} /></Field>
                                        <Field label="Pontos"><input className="qb-in" type="number" style={{ width: 70 }} value={o.points ?? ''} onChange={e => upd(i, { points: e.target.value === '' ? '' : Number(e.target.value) })} /></Field>
                                    </div>
                                    <Field label="Imagem">
                                        <div className="qb-row">
                                            <button type="button" className="qb-btn" onClick={() => pickImage(i)}><ImagePlus size={13} /> {img ? 'Trocar' : 'Enviar'}</button>
                                            {img && <button type="button" className="qb-btn danger" onClick={() => upd(i, { image: '' })}>Remover</button>}
                                        </div>
                                    </Field>
                                    <Field label="Descrição (opcional)"><input className="qb-in" value={o.desc || ''} placeholder="Texto menor abaixo da opção" onChange={e => upd(i, { desc: e.target.value })} /></Field>
                                    <Field label="Ao escolher esta opção" hint={multi ? 'Em múltipla escolha a ação vale ao clicar em Continuar.' : null}>
                                        <ActionPicker value={o.action || o.goToStep} steps={steps} currentStepId={stepId} defaultLabel="Seguir o fluxo da etapa"
                                            onChange={a => upd(i, { action: a, goToStep: undefined })} />
                                    </Field>
                                    <Switch label="Abre campo “Outro”" checked={o.isOther} onChange={v => upd(i, { isOther: v })} />
                                    {multi && <Switch label="Exclusiva (desmarca as outras)" checked={o.exclusive} onChange={v => upd(i, { exclusive: v })} hint="Ex: “Nenhuma das anteriores”" />}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="qb-row" style={{ marginTop: 4 }}>
                <button type="button" className="qb-btn dashed" onClick={() => add()}><Plus size={13} /> Opção</button>
                {!options.some(o => o.isOther) && <button type="button" className="qb-btn dashed" style={{ width: 'auto' }} onClick={() => add({ isOther: true, emoji: '✏️' })}>+ Outro</button>}
            </div>
        </div>
    );
}
