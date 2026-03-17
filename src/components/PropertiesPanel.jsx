// PropertiesPanel.jsx — Right panel: edit selected block with rich options
import { useState } from 'react';
import { Plus, Trash2, Upload, MousePointer, Image as ImageIcon } from 'lucide-react';
import { BLOCK_TYPES, OPTION_LAYOUTS, CHART_TYPES, ALERT_STYLES, ALERT_TYPES, BUTTON_ANIMATIONS, TIMER_FORMATS, INSIGHT_STYLES } from '../utils/blockTypes';
import { compressAndStore } from '../utils/imageStore';

const S = {
    section: { marginBottom: 16 },
    sTitle: { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 6 },
    input: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: '#f9fafb', color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' },
    textarea: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: '#f9fafb', color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none', minHeight: 70, resize: 'vertical', boxSizing: 'border-box', transition: 'border-color 0.15s' },
    optRow: { display: 'flex', gap: 4, alignItems: 'center', marginBottom: 5 },
    smallBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' },
    addBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 6, border: '1px dashed #d1d5db', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', width: '100%', justifyContent: 'center' },
    tab: (a) => ({ flex: 1, padding: '7px 0', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', borderBottom: a ? '2px solid var(--primary)' : '2px solid transparent', color: a ? 'var(--text-primary)' : 'var(--text-muted)' }),
    select: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: '#f9fafb', color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' },
    chip: (a, c) => ({ padding: '5px 8px', borderRadius: 6, border: `1px solid ${a ? (c || 'var(--primary)') : 'var(--border)'}`, background: a ? `${c || 'var(--primary)'}0a` : '#f9fafb', cursor: 'pointer', textAlign: 'center', fontSize: '0.7rem', color: a ? (c || 'var(--primary)') : 'var(--text-muted)', transition: 'all 0.15s', flex: 1 }),
};

export default function PropertiesPanel({ block, onChange, config, onConfigChange, steps = [] }) {
    const [tab, setTab] = useState('component');
    if (!block) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}><MousePointer size={28} style={{ marginBottom: 8, opacity: 0.3 }} /><p style={{ fontSize: '0.8rem' }}>Selecione um bloco</p></div>;

    const td = BLOCK_TYPES.find(t => t.type === block.type) || {};
    const u = (k, v) => onChange({ ...block, [k]: v });
    const uOpt = (i, k, v) => { const o = [...(block.options || [])]; o[i] = { ...o[i], [k]: v }; u('options', o); };
    const addOpt = () => { const o = [...(block.options || [])]; o.push({ text: '', emoji: '😊', weight: o.length + 1 }); u('options', o); };
    const rmOpt = (i) => u('options', (block.options || []).filter((_, j) => j !== i));
    const uItem = (i, v) => { const it = [...(block.items || [])]; it[i] = v; u('items', it); };
    const addItem = (def = 'Novo item') => u('items', [...(block.items || []), def]);
    const rmItem = (i) => u('items', (block.items || []).filter((_, j) => j !== i));
    const uData = (i, k, v) => { const d = [...(block.data || [])]; d[i] = { ...d[i], [k]: v }; u('data', d); };
    const handleImg = async (e, idx) => { const f = e.target.files?.[0]; if (!f) return; try { const { dataUrl } = await compressAndStore(f); idx !== undefined ? uOpt(idx, 'image', dataUrl) : u('imageUrl', dataUrl); } catch { } };

    return (
        <div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
                <div style={S.tab(tab === 'component')} onClick={() => setTab('component')}>Componente</div>
                <div style={S.tab(tab === 'style')} onClick={() => setTab('style')}>Estilo</div>
            </div>
            <div style={{ padding: '0 12px 12px', overflowY: 'auto', maxHeight: 'calc(100vh - 160px)' }}>
                {tab === 'component' && (<>
                    {/* Badge + Width selector */}
                    <div style={{ ...S.section, marginBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: `${td.color}0a`, border: `1px solid ${td.color}22`, flex: 1 }}><span style={{ fontSize: 14 }}>{td.icon}</span><span style={{ fontSize: '0.78rem', fontWeight: 600, color: td.color }}>{td.label}</span></div>
                        </div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 6 }}>LARGURA</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {[25, 50, 75, 100].map(w => {
                                const active = (block.widthPct || 100) === w;
                                return (
                                    <button key={w} onClick={() => u('widthPct', w)} style={{
                                        flex: 1, padding: '6px 0', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                                        border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                                        background: active ? 'rgba(37,99,235,0.08)' : '#f9fafb',
                                        color: active ? 'var(--primary)' : 'var(--text-muted)',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, transition: 'all 0.15s',
                                    }} title={`${w}% da largura`}>
                                        <div style={{ width: '80%', height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ width: `${w}%`, height: '100%', background: active ? 'var(--primary)' : '#9ca3af', borderRadius: 2, transition: 'width 0.15s' }} />
                                        </div>
                                        {w}%
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* CHOICE: layout + multi + question + options */}
                    {['choice', 'single-choice'].includes(block.type) && (<>
                        <div style={S.section}><div style={S.sTitle}>Layout</div><div style={{ display: 'flex', gap: 4 }}>{OPTION_LAYOUTS.map(l => <div key={l.key} style={S.chip(block.optionLayout === l.key)} onClick={() => u('optionLayout', l.key)}>{l.icon}<br />{l.label}</div>)}</div></div>
                        <div style={S.section}><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}><input type="checkbox" checked={block.multiSelect || false} onChange={e => u('multiSelect', e.target.checked)} style={{ accentColor: 'var(--primary)' }} />Multi-seleção</label></div>
                        <div style={S.section}><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}><input type="checkbox" checked={block.required !== false} onChange={e => u('required', e.target.checked)} style={{ accentColor: 'var(--primary)' }} />Obrigatório</label></div>
                    </>)}

                    {/* Question text */}
                    {['choice', 'image-select', 'likert', 'statement', 'single-choice', 'yes-no', 'scroll-picker', 'weight-picker', 'number-input', 'email-input', 'phone-input', 'textarea-input', 'date-input', 'video-response'].includes(block.type) && <div style={S.section}><div style={S.sTitle}>Pergunta</div><textarea style={S.textarea} value={block.text || ''} onChange={e => u('text', e.target.value)} /></div>}
                    {['choice', 'image-select', 'single-choice', 'yes-no'].includes(block.type) && <div style={S.section}><div style={S.sTitle}>Descrição</div><textarea style={{ ...S.textarea, minHeight: 40 }} value={block.desc || ''} onChange={e => u('desc', e.target.value)} placeholder="Texto de ajuda opcional" /></div>}
                    {block.type === 'statement' && <div style={S.section}><div style={S.sTitle}>Citação</div><textarea style={S.textarea} value={block.quote || ''} onChange={e => u('quote', e.target.value)} /></div>}

                    {/* Options for choice/image-select */}
                    {['choice', 'image-select', 'single-choice'].includes(block.type) && (
                        <div style={S.section}><div style={S.sTitle}>Opções ({(block.options || []).length})</div>
                            {(block.options || []).map((o, i) => (
                                <div key={i} style={{ marginBottom: 6 }}>
                                    <div style={{ ...S.optRow, alignItems: 'center' }}>
                                        {o.image && typeof o.image === 'string' && o.image.startsWith('data:') ? (
                                            <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
                                                <img src={o.image} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                                                <button onClick={() => uOpt(i, 'image', '')} style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'var(--danger)', color: '#fff', border: 'none', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
                                            </div>
                                        ) : (
                                            <label style={{ width: 36, height: 36, borderRadius: 8, border: '1px dashed #d1d5db', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'border-color 0.15s' }} title="Upload imagem">
                                                {o.emoji ? <span style={{ fontSize: 16 }}>{o.emoji}</span> : <ImageIcon size={14} style={{ color: 'var(--text-muted)' }} />}
                                                <input type="file" accept="image/*" hidden onChange={e => handleImg(e, i)} />
                                            </label>
                                        )}
                                        <input style={{ ...S.input, flex: 1 }} value={o.text} onChange={e => uOpt(i, 'text', e.target.value)} placeholder={`Opção ${i + 1}`} />
                                        <input style={{ ...S.input, width: 40 }} value={o.points || ''} onChange={e => uOpt(i, 'points', Number(e.target.value))} placeholder="Pts" title="Pontos" type="number" />
                                        <button style={S.smallBtn} onClick={() => rmOpt(i)}><Trash2 size={12} /></button>
                                    </div>
                                    {/* Conditional routing */}
                                    {steps.length > 1 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, paddingLeft: 44 }}>
                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>↳ Ir para:</span>
                                            <select style={{ ...S.input, fontSize: '0.65rem', padding: '3px 4px', flex: 1, color: o.goToStep ? 'var(--primary)' : 'var(--text-muted)' }}
                                                value={o.goToStep || ''}
                                                onChange={e => uOpt(i, 'goToStep', e.target.value || null)}>
                                                <option value="">Próxima etapa</option>
                                                {steps.map((s, si) => (
                                                    <option key={s.id} value={s.id}>{si + 1}. {s.name}</option>
                                                ))}
                                                <option value="__end">Finalizar quiz</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <button style={S.addBtn} onClick={addOpt}><Plus size={12} /> Opção</button>
                        </div>
                    )}

                    {/* Likert */}
                    {block.type === 'likert' && <div style={S.section}><div style={S.sTitle}>Escala</div>{(block.options || []).map((o, i) => <div key={i} style={S.optRow}><span style={{ width: 16, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{i + 1}</span><input style={{ ...S.input, flex: 1 }} value={o.text} onChange={e => uOpt(i, 'text', e.target.value)} /></div>)}</div>}

                    {/* Capture */}
                    {block.type === 'capture' && (<>
                        <div style={S.section}><div style={S.sTitle}>Título</div><input style={S.input} value={block.title || ''} onChange={e => u('title', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Subtítulo</div><input style={S.input} value={block.subtitle || ''} onChange={e => u('subtitle', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Campos</div>{['name', 'email', 'phone'].map(f => <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}><input type="checkbox" checked={(block.fields || []).includes(f)} onChange={e => { const fs = e.target.checked ? [...(block.fields || []), f] : (block.fields || []).filter(x => x !== f); u('fields', fs); }} style={{ accentColor: 'var(--primary)' }} />{f === 'name' ? 'Nome' : f === 'email' ? 'E-mail' : 'Telefone'}</label>)}</div>
                        <div style={S.section}><div style={S.sTitle}>Botão</div><input style={S.input} value={block.buttonText || ''} onChange={e => u('buttonText', e.target.value)} /></div>
                    </>)}

                    {/* Text — rich formatting */}
                    {block.type === 'text' && (<>
                        <div style={S.section}><div style={S.sTitle}>Conteúdo</div><textarea style={{ ...S.textarea, minHeight: 100 }} value={block.content || ''} onChange={e => u('content', e.target.value)} /></div>

                        {/* Variant: headline, subheadline, body, caption */}
                        <div style={S.section}>
                            <div style={S.sTitle}>Tipo</div>
                            <div style={{ display: 'flex', gap: 4 }}>
                                {[
                                    { id: 'headline', label: 'Título', preview: 'H1' },
                                    { id: 'subheadline', label: 'Sub', preview: 'H2' },
                                    { id: 'body', label: 'Corpo', preview: 'P' },
                                    { id: 'caption', label: 'Legenda', preview: 'Sm' },
                                ].map(v => (
                                    <div key={v.id} style={{
                                        ...S.chip((block.variant || 'body') === v.id),
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 4px',
                                    }} onClick={() => u('variant', v.id)}>
                                        <span style={{ fontSize: v.id === 'headline' ? 16 : v.id === 'subheadline' ? 13 : v.id === 'body' ? 11 : 9, fontWeight: v.id === 'headline' || v.id === 'subheadline' ? 700 : 400 }}>{v.preview}</span>
                                        <span style={{ fontSize: 9 }}>{v.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Formatting toolbar: Bold, Italic, Underline */}
                        <div style={S.section}>
                            <div style={S.sTitle}>Formatação</div>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => u('bold', !block.bold)} style={{
                                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                                    border: `1.5px solid ${block.bold ? 'var(--primary)' : 'var(--border)'}`,
                                    background: block.bold ? 'rgba(37,99,235,0.08)' : '#f9fafb',
                                    color: block.bold ? 'var(--primary)' : 'var(--text-muted)',
                                    fontWeight: 700, fontSize: 14,
                                }}>B</button>
                                <button onClick={() => u('italic', !block.italic)} style={{
                                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                                    border: `1.5px solid ${block.italic ? 'var(--primary)' : 'var(--border)'}`,
                                    background: block.italic ? 'rgba(37,99,235,0.08)' : '#f9fafb',
                                    color: block.italic ? 'var(--primary)' : 'var(--text-muted)',
                                    fontStyle: 'italic', fontWeight: 600, fontSize: 14,
                                }}>I</button>
                                <button onClick={() => u('underline', !block.underline)} style={{
                                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                                    border: `1.5px solid ${block.underline ? 'var(--primary)' : 'var(--border)'}`,
                                    background: block.underline ? 'rgba(37,99,235,0.08)' : '#f9fafb',
                                    color: block.underline ? 'var(--primary)' : 'var(--text-muted)',
                                    textDecoration: 'underline', fontWeight: 600, fontSize: 14,
                                }}>U</button>
                            </div>
                        </div>

                        {/* Text color */}
                        <div style={S.section}>
                            <div style={S.sTitle}>Cor do texto</div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                {['#1a2332', '#4a5568', '#2563eb', '#dc2626', '#059669', '#7c3aed', '#ea580c'].map(c => (
                                    <div key={c} onClick={() => u('textColor', c)} style={{
                                        width: 24, height: 24, borderRadius: 6, background: c, cursor: 'pointer',
                                        border: (block.textColor || '#1a2332') === c ? '2px solid var(--primary)' : '2px solid transparent',
                                        boxShadow: (block.textColor || '#1a2332') === c ? '0 0 0 2px rgba(37,99,235,0.3)' : 'none',
                                        transition: 'all 0.15s',
                                    }} />
                                ))}
                                <input type="color" value={block.textColor || '#1a2332'} onChange={e => u('textColor', e.target.value)}
                                    style={{ width: 24, height: 24, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 4 }} />
                            </div>
                        </div>

                        {/* Alignment */}
                        <div style={S.section}><div style={S.sTitle}>Alinhamento</div><div style={{ display: 'flex', gap: 4 }}>{['left', 'center', 'right'].map(a => <div key={a} style={S.chip(block.align === a)} onClick={() => u('align', a)}>{a === 'left' ? '◁' : a === 'center' ? '☰' : '▷'}</div>)}</div></div>

                        {/* Image */}
                        <div style={S.section}>
                            <div style={S.sTitle}>📷 Adicionar imagem</div>
                            <label style={S.addBtn}><Upload size={12} /> Upload imagem<input type="file" accept="image/*" hidden onChange={e => handleImg(e)} /></label>
                            {block.imageUrl && <div style={{ position: 'relative', marginTop: 6 }}><img src={block.imageUrl} alt="" style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 6 }} /><button onClick={() => u('imageUrl', '')} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 5px', fontSize: 10, cursor: 'pointer' }}>✕</button></div>}
                        </div>
                    </>)}

                    {/* Image — with resize */}
                    {block.type === 'image' && (<>
                        <div style={S.section}><div style={S.sTitle}>Imagem</div><label style={S.addBtn}><Upload size={12} /> Upload<input type="file" accept="image/*" hidden onChange={e => handleImg(e)} /></label>{block.imageUrl && <img src={block.imageUrl} alt="" style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} />}</div>
                        <div style={S.section}><div style={S.sTitle}>Legenda</div><input style={S.input} value={block.caption || ''} onChange={e => u('caption', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Altura ({block.height || 220}px)</div><input type="range" min={80} max={400} step={10} value={block.height || 220} onChange={e => u('height', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} /><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}><span>80px</span><span>400px</span></div></div>
                        <div style={S.section}><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}><input type="checkbox" checked={block.rounded !== false} onChange={e => u('rounded', e.target.checked)} style={{ accentColor: 'var(--primary)' }} />Bordas arredondadas</label></div>
                    </>)}

                    {/* Video */}
                    {block.type === 'video' && (<><div style={S.section}><div style={S.sTitle}>URL do vídeo</div><input style={S.input} value={block.videoUrl || ''} onChange={e => u('videoUrl', e.target.value)} placeholder="YouTube ou Vturb" /><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>Suporta YouTube e Vturb</div></div></>)}

                    {/* Button */}
                    {block.type === 'button' && (<>
                        <div style={S.section}><div style={S.sTitle}>Texto</div><input style={S.input} value={block.text || ''} onChange={e => u('text', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>URL</div><input style={S.input} value={block.url || ''} onChange={e => u('url', e.target.value)} placeholder="https://" /></div>
                        <div style={S.section}><div style={S.sTitle}>Estilo</div><div style={{ display: 'flex', gap: 4 }}>{['primary', 'outline'].map(s => <div key={s} style={S.chip(block.style === s)} onClick={() => u('style', s)}>{s === 'primary' ? 'Sólido' : 'Contorno'}</div>)}</div></div>
                        <div style={S.section}><div style={S.sTitle}>Tamanho</div><div style={{ display: 'flex', gap: 4 }}>{['sm', 'md', 'lg'].map(s => <div key={s} style={S.chip(block.size === s)} onClick={() => u('size', s)}>{s.toUpperCase()}</div>)}</div></div>
                        <div style={S.section}><div style={S.sTitle}>Animação</div><div style={{ display: 'flex', gap: 4 }}>{BUTTON_ANIMATIONS.map(a => <div key={a.key} style={S.chip(block.animation === a.key)} onClick={() => u('animation', a.key)}>{a.label}</div>)}</div></div>
                    </>)}

                    {/* Insight */}
                    {block.type === 'insight' && (<>
                        <div style={S.section}><div style={S.sTitle}>Estilo</div><div style={{ display: 'flex', gap: 4 }}>{INSIGHT_STYLES.map(s => <div key={s.key} style={S.chip(block.insightStyle === s.key)} onClick={() => u('insightStyle', s.key)}>{s.label}</div>)}</div></div>
                        <div style={S.section}><div style={S.sTitle}>Título</div><input style={S.input} value={block.title || ''} onChange={e => u('title', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Corpo</div><textarea style={{ ...S.textarea, minHeight: 100 }} value={block.body || ''} onChange={e => u('body', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Imagem</div><label style={S.addBtn}><Upload size={12} /> Upload<input type="file" accept="image/*" hidden onChange={e => handleImg(e)} /></label>{block.imageUrl && <img src={block.imageUrl} alt="" style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} />}</div>
                    </>)}

                    {/* Social Proof */}
                    {block.type === 'social-proof' && (<>
                        <div style={S.section}><div style={S.sTitle}>Emoji</div><input style={{ ...S.input, width: 50 }} value={block.emoji || ''} onChange={e => u('emoji', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Headline</div><input style={S.input} value={block.headline || ''} onChange={e => u('headline', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Sub</div><input style={S.input} value={block.subheadline || ''} onChange={e => u('subheadline', e.target.value)} /></div>
                    </>)}

                    {/* Testimonial */}
                    {block.type === 'testimonial' && (<>
                        <div style={S.section}><div style={S.sTitle}>Nome</div><input style={S.input} value={block.name || ''} onChange={e => u('name', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Depoimento</div><textarea style={S.textarea} value={block.text || ''} onChange={e => u('text', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Estrelas</div><div style={{ display: 'flex', gap: 2 }}>{[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: 18, cursor: 'pointer', opacity: n <= (block.rating || 5) ? 1 : 0.3 }} onClick={() => u('rating', n)}>⭐</span>)}</div></div>
                    </>)}

                    {/* Arguments */}
                    {block.type === 'arguments' && (<>
                        <div style={S.section}><div style={S.sTitle}>Título</div><input style={S.input} value={block.title || ''} onChange={e => u('title', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Emoji do check</div><input style={{ ...S.input, width: 50 }} value={block.emoji || ''} onChange={e => u('emoji', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Itens</div>
                            {(block.items || []).map((it, i) => <div key={i} style={S.optRow}><input style={{ ...S.input, flex: 1 }} value={it} onChange={e => uItem(i, e.target.value)} /><button style={S.smallBtn} onClick={() => rmItem(i)}><Trash2 size={12} /></button></div>)}
                            <button style={S.addBtn} onClick={() => addItem('Novo benefício')}><Plus size={12} /> Adicionar</button>
                        </div>
                    </>)}

                    {/* Alert — RICH */}
                    {block.type === 'alert' && (<>
                        <div style={S.section}><div style={S.sTitle}>Tipo</div><div style={{ display: 'flex', gap: 4 }}>{ALERT_TYPES.map(a => <div key={a.key} style={S.chip(block.alertType === a.key, a.color)} onClick={() => u('alertType', a.key)}>{a.icon} {a.label}</div>)}</div></div>
                        <div style={S.section}><div style={S.sTitle}>Estilo</div><div style={{ display: 'flex', gap: 4 }}>{ALERT_STYLES.map(s => <div key={s.key} style={S.chip(block.alertStyle === s.key)} onClick={() => u('alertStyle', s.key)}>{s.label}</div>)}</div></div>
                        <div style={S.section}><div style={S.sTitle}>Emoji</div><input style={{ ...S.input, width: 50 }} value={block.emoji || ''} onChange={e => u('emoji', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Headline</div><input style={S.input} value={block.title || ''} onChange={e => u('title', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Texto</div><textarea style={S.textarea} value={block.text || ''} onChange={e => u('text', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Cor custom (opcional)</div><div style={{ display: 'flex', gap: 6 }}><input type="color" value={block.customColor || '#e74c3c'} onChange={e => u('customColor', e.target.value)} style={{ width: 30, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer' }} /><input style={{ ...S.input, flex: 1 }} value={block.customColor || ''} onChange={e => u('customColor', e.target.value)} placeholder="Usar padrão" /></div></div>
                    </>)}

                    {/* Timer — RICH */}
                    {block.type === 'timer' && (<>
                        <div style={S.section}><div style={S.sTitle}>Formato</div><div style={{ display: 'flex', gap: 4 }}>{TIMER_FORMATS.map(f => <div key={f.key} style={S.chip(block.timerFormat === f.key)} onClick={() => u('timerFormat', f.key)}>{f.label}</div>)}</div></div>
                        <div style={S.section}><div style={S.sTitle}>Título</div><input style={S.input} value={block.title || ''} onChange={e => u('title', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Duração (seg)</div><input type="number" style={S.input} value={block.duration || 300} onChange={e => u('duration', Number(e.target.value))} /></div>
                    </>)}

                    {/* Loading */}
                    {block.type === 'loading' && (<>
                        <div style={S.section}><div style={S.sTitle}>Título</div><input style={S.input} value={block.title || ''} onChange={e => u('title', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Etapas</div>
                            {(block.items || []).map((it, i) => <div key={i} style={S.optRow}><input style={{ ...S.input, flex: 1 }} value={it} onChange={e => uItem(i, e.target.value)} /><button style={S.smallBtn} onClick={() => rmItem(i)}><Trash2 size={12} /></button></div>)}
                            <button style={S.addBtn} onClick={() => addItem('Nova etapa...')}><Plus size={12} /> Adicionar</button>
                        </div>
                    </>)}

                    {/* Price — RICH */}
                    {block.type === 'price' && (<>
                        <div style={S.section}><div style={S.sTitle}>Título</div><input style={S.input} value={block.title || ''} onChange={e => u('title', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Preço original</div><input style={S.input} value={block.originalPrice || ''} onChange={e => u('originalPrice', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Preço final</div><input style={S.input} value={block.price || ''} onChange={e => u('price', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Desconto</div><input style={S.input} value={block.discount || ''} onChange={e => u('discount', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>CTA</div><input style={S.input} value={block.cta || ''} onChange={e => u('cta', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>URL CTA</div><input style={S.input} value={block.ctaUrl || ''} onChange={e => u('ctaUrl', e.target.value)} placeholder="https://" /></div>
                        <div style={S.section}><div style={S.sTitle}>Features</div>
                            {(block.features || []).map((f, i) => <div key={i} style={S.optRow}><input style={{ ...S.input, flex: 1 }} value={f} onChange={e => { const fs = [...(block.features || [])]; fs[i] = e.target.value; u('features', fs); }} /><button style={S.smallBtn} onClick={() => u('features', (block.features || []).filter((_, j) => j !== i))}><Trash2 size={12} /></button></div>)}
                            <button style={S.addBtn} onClick={() => u('features', [...(block.features || []), 'Novo benefit'])}><Plus size={12} /> Adicionar</button>
                        </div>
                    </>)}

                    {/* Chart — RICH */}
                    {block.type === 'chart' && (<>
                        <div style={S.section}><div style={S.sTitle}>Tipo de gráfico</div><div style={{ display: 'flex', gap: 4 }}>{CHART_TYPES.map(c => <div key={c.key} style={S.chip(block.chartType === c.key)} onClick={() => u('chartType', c.key)}>{c.icon}<br />{c.label}</div>)}</div></div>
                        <div style={S.section}><div style={S.sTitle}>Cor</div><div style={{ display: 'flex', gap: 6 }}><input type="color" value={block.chartColor || config.primaryColor} onChange={e => u('chartColor', e.target.value)} style={{ width: 30, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer' }} /><input style={{ ...S.input, flex: 1 }} value={block.chartColor || ''} onChange={e => u('chartColor', e.target.value)} placeholder="Usar cor primária" /></div></div>
                        <div style={S.section}><div style={S.sTitle}>Título</div><input style={S.input} value={block.title || ''} onChange={e => u('title', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Dados</div>
                            {(block.data || []).map((d, i) => <div key={i} style={S.optRow}><input style={{ ...S.input, flex: 2 }} value={d.label} onChange={e => uData(i, 'label', e.target.value)} /><input type="number" style={{ ...S.input, width: 50 }} value={d.value} onChange={e => uData(i, 'value', Number(e.target.value))} /><button style={S.smallBtn} onClick={() => u('data', (block.data || []).filter((_, j) => j !== i))}><Trash2 size={12} /></button></div>)}
                            <button style={S.addBtn} onClick={() => u('data', [...(block.data || []), { label: 'Novo', value: 50 }])}><Plus size={12} /> Adicionar</button>
                        </div>
                    </>)}

                    {/* Result — AI diagnosis */}
                    {block.type === 'result' && (<>
                        <div style={{ padding: '8px 10px', background: '#fff7ed', borderRadius: 10, marginBottom: 12, border: '1px solid #fed7aa' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ea580c', marginBottom: 2 }}>🏆 Bloco de Resultado</div>
                            <div style={{ fontSize: '0.63rem', color: '#9a3412' }}>Quando o usuário chegar aqui, a IA vai analisar as respostas e gerar um diagnóstico persuasivo</div>
                        </div>
                        <div style={S.section}><div style={S.sTitle}>Título</div><input style={S.input} value={block.title || ''} onChange={e => u('title', e.target.value)} placeholder="Seu Diagnóstico Personalizado" /></div>
                        <div style={S.section}><div style={S.sTitle}>Nome do produto</div><input style={S.input} value={block.productName || ''} onChange={e => u('productName', e.target.value)} placeholder="Ex: Método XYZ" /></div>
                        <div style={S.section}><div style={S.sTitle}>Contexto do produto (p/ IA)</div><textarea style={{ ...S.textarea, minHeight: 80 }} value={block.productContext || ''} onChange={e => u('productContext', e.target.value)} placeholder="Descreva o produto/nicho para a IA gerar um resultado personalizado. Ex: 'Curso de emagrecimento saudável para mulheres 30+ que querem perder peso sem dietas restritivas'" /></div>
                        <div style={S.section}><div style={S.sTitle}>Texto do CTA</div><input style={S.input} value={block.cta || ''} onChange={e => u('cta', e.target.value)} placeholder="🔥 Ver minha solução →" /></div>
                        <div style={S.section}><div style={S.sTitle}>URL de venda</div><input style={S.input} value={block.salesUrl || ''} onChange={e => u('salesUrl', e.target.value)} placeholder="https://seu-produto.com/checkout" /></div>
                    </>)}

                    {/* Scroll Picker */}
                    {block.type === 'scroll-picker' && (<>
                        <div style={S.section}><div style={S.sTitle}>Estilo Visual</div>
                            <div style={{ display: 'flex', gap: 4 }}>
                                {[
                                    { id: 'drum', label: 'Roleta', icon: '🎰' },
                                    { id: 'ruler', label: 'Régua', icon: '📏' },
                                    { id: 'slider', label: 'Slider', icon: '🎚️' },
                                    { id: 'input', label: 'Input', icon: '🔢' },
                                ].map(v => (
                                    <div key={v.id} style={{ ...S.chip((block.visualStyle || 'drum') === v.id), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 4px' }} onClick={() => u('visualStyle', v.id)}>
                                        <span style={{ fontSize: 16 }}>{v.icon}</span>
                                        <span style={{ fontSize: 9 }}>{v.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={S.section}><div style={S.sTitle}>Pergunta</div><input style={S.input} value={block.text || ''} onChange={e => u('text', e.target.value)} placeholder="Qual é a sua altura?" /></div>
                        <div style={S.section}><div style={S.sTitle}>Unidade</div><input style={S.input} value={block.unit || ''} onChange={e => u('unit', e.target.value)} placeholder="cm" /></div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <div style={{ ...S.section, flex: 1 }}><div style={S.sTitle}>Mín</div><input type="number" style={S.input} value={block.min || 140} onChange={e => u('min', Number(e.target.value))} /></div>
                            <div style={{ ...S.section, flex: 1 }}><div style={S.sTitle}>Máx</div><input type="number" style={S.input} value={block.max || 210} onChange={e => u('max', Number(e.target.value))} /></div>
                        </div>
                        <div style={S.section}><div style={S.sTitle}>Valor padrão</div><input type="number" style={S.input} value={block.defaultValue || 170} onChange={e => u('defaultValue', Number(e.target.value))} /></div>
                    </>)}

                    {/* Number Input */}
                    {block.type === 'number-input' && (<>
                        <div style={S.section}><div style={S.sTitle}>Pergunta</div><input style={S.input} value={block.text || ''} onChange={e => u('text', e.target.value)} placeholder="Qual é o seu peso?" /></div>
                        <div style={S.section}><div style={S.sTitle}>Unidade</div><input style={S.input} value={block.unit || ''} onChange={e => u('unit', e.target.value)} placeholder="kg" /></div>
                        <div style={S.section}><div style={S.sTitle}>Placeholder</div><input style={S.input} value={block.placeholder || ''} onChange={e => u('placeholder', e.target.value)} placeholder="Ex: 72" /></div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <div style={{ ...S.section, flex: 1 }}><div style={S.sTitle}>Mín</div><input type="number" style={S.input} value={block.min || 0} onChange={e => u('min', Number(e.target.value))} /></div>
                            <div style={{ ...S.section, flex: 1 }}><div style={S.sTitle}>Máx</div><input type="number" style={S.input} value={block.max || 300} onChange={e => u('max', Number(e.target.value))} /></div>
                        </div>
                    </>)}

                    {/* Yes/No */}
                    {block.type === 'yes-no' && (<>
                        <div style={S.section}><div style={S.sTitle}>Label Sim</div><div style={{ display: 'flex', gap: 6 }}><input style={{ ...S.input, width: 40 }} value={block.yesEmoji || ''} onChange={e => u('yesEmoji', e.target.value)} /><input style={{ ...S.input, flex: 1 }} value={block.yesLabel || ''} onChange={e => u('yesLabel', e.target.value)} /></div></div>
                        <div style={S.section}><div style={S.sTitle}>Label Não</div><div style={{ display: 'flex', gap: 6 }}><input style={{ ...S.input, width: 40 }} value={block.noEmoji || ''} onChange={e => u('noEmoji', e.target.value)} /><input style={{ ...S.input, flex: 1 }} value={block.noLabel || ''} onChange={e => u('noLabel', e.target.value)} /></div></div>
                    </>)}

                    {/* Email Input */}
                    {block.type === 'email-input' && (<>
                        <div style={S.section}><div style={S.sTitle}>Placeholder</div><input style={S.input} value={block.placeholder || ''} onChange={e => u('placeholder', e.target.value)} /></div>
                        <div style={S.section}><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}><input type="checkbox" checked={block.required !== false} onChange={e => u('required', e.target.checked)} style={{ accentColor: 'var(--primary)' }} />Obrigatório</label></div>
                    </>)}

                    {/* Phone Input */}
                    {block.type === 'phone-input' && (<>
                        <div style={S.section}><div style={S.sTitle}>Placeholder</div><input style={S.input} value={block.placeholder || ''} onChange={e => u('placeholder', e.target.value)} /></div>
                        <div style={S.section}><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}><input type="checkbox" checked={block.required !== false} onChange={e => u('required', e.target.checked)} style={{ accentColor: 'var(--primary)' }} />Obrigatório</label></div>
                    </>)}

                    {/* Textarea Input */}
                    {block.type === 'textarea-input' && (<>
                        <div style={S.section}><div style={S.sTitle}>Placeholder</div><input style={S.input} value={block.placeholder || ''} onChange={e => u('placeholder', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Max caracteres</div><input type="number" style={S.input} value={block.maxLength || 500} onChange={e => u('maxLength', Number(e.target.value))} /></div>
                        <div style={S.section}><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}><input type="checkbox" checked={block.required !== false} onChange={e => u('required', e.target.checked)} style={{ accentColor: 'var(--primary)' }} />Obrigatório</label></div>
                    </>)}

                    {/* Date Input */}
                    {block.type === 'date-input' && (<>
                        <div style={S.section}><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}><input type="checkbox" checked={block.required !== false} onChange={e => u('required', e.target.checked)} style={{ accentColor: 'var(--primary)' }} />Obrigatório</label></div>
                    </>)}

                    {/* Weight Picker */}
                    {block.type === 'weight-picker' && (<>
                        <div style={S.section}><div style={S.sTitle}>Estilo Visual</div>
                            <div style={{ display: 'flex', gap: 4 }}>
                                {[
                                    { id: 'drum', label: 'Roleta', icon: '🎰' },
                                    { id: 'ruler', label: 'Régua', icon: '📏' },
                                    { id: 'slider', label: 'Slider', icon: '🎚️' },
                                    { id: 'input', label: 'Input', icon: '🔢' },
                                ].map(v => (
                                    <div key={v.id} style={{ ...S.chip((block.visualStyle || 'drum') === v.id), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 4px' }} onClick={() => u('visualStyle', v.id)}>
                                        <span style={{ fontSize: 16 }}>{v.icon}</span>
                                        <span style={{ fontSize: 9 }}>{v.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={S.section}><div style={S.sTitle}>Unidade</div><input style={S.input} value={block.unit || ''} onChange={e => u('unit', e.target.value)} placeholder="kg" /></div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <div style={{ ...S.section, flex: 1 }}><div style={S.sTitle}>Mín</div><input type="number" style={S.input} value={block.min || 30} onChange={e => u('min', Number(e.target.value))} /></div>
                            <div style={{ ...S.section, flex: 1 }}><div style={S.sTitle}>Máx</div><input type="number" style={S.input} value={block.max || 200} onChange={e => u('max', Number(e.target.value))} /></div>
                        </div>
                        <div style={S.section}><div style={S.sTitle}>Valor padrão</div><input type="number" style={S.input} value={block.defaultValue || 70} onChange={e => u('defaultValue', Number(e.target.value))} /></div>
                    </>)}

                    {/* Audio */}
                    {block.type === 'audio' && (<>
                        <div style={S.section}><div style={S.sTitle}>Áudio</div>
                            <input style={S.input} value={block.audioUrl || ''} onChange={e => u('audioUrl', e.target.value)} placeholder="https://... ou faça upload" />
                            <label style={{ ...S.addBtn, marginTop: 6 }}><Upload size={12} /> Upload áudio<input type="file" accept="audio/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = ev => u('audioUrl', ev.target.result); reader.readAsDataURL(f); }} /></label>
                        </div>
                        <div style={S.section}><div style={S.sTitle}>Nome do remetente</div><input style={S.input} value={block.senderName || ''} onChange={e => u('senderName', e.target.value)} placeholder="Ex: Dr. João" /></div>
                        <div style={S.section}><div style={S.sTitle}>Imagem</div><label style={S.addBtn}><Upload size={12} /> Upload<input type="file" accept="image/*" hidden onChange={e => handleImg(e)} /></label>{block.imageUrl && <img src={block.imageUrl} alt="" style={{ width: '100%', height: 50, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} />}</div>
                    </>)}

                    {/* Video Response */}
                    {block.type === 'video-response' && (<>
                        <div style={S.section}><div style={S.sTitle}>URL do vídeo</div><input style={S.input} value={block.videoUrl || ''} onChange={e => u('videoUrl', e.target.value)} placeholder="YouTube ou Vturb" /><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>Suporta YouTube e Vturb</div></div>
                        <div style={S.section}><div style={S.sTitle}>Opções ({(block.options || []).length})</div>
                            {(block.options || []).map((opt, i) => (
                                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', width: 16, textAlign: 'center' }}>{opt.value || String.fromCharCode(65 + i)}</span>
                                    <input style={{ ...S.input, flex: 1 }} value={opt.text || ''} onChange={e => { const opts = [...(block.options || [])]; opts[i] = { ...opts[i], text: e.target.value }; u('options', opts); }} />
                                    <button style={S.smallBtn} onClick={() => u('options', (block.options || []).filter((_, j) => j !== i))}><Trash2 size={12} /></button>
                                </div>
                            ))}
                            <button style={S.addBtn} onClick={() => u('options', [...(block.options || []), { text: '', value: String.fromCharCode(65 + (block.options || []).length) }])}><Plus size={12} /> Opção</button>
                        </div>
                    </>)}

                    {/* Notification */}
                    {block.type === 'notification' && (<>
                        <div style={S.section}><div style={S.sTitle}>Título</div><input style={S.input} value={block.title || ''} onChange={e => u('title', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Texto</div><textarea style={S.textarea} value={block.text || ''} onChange={e => u('text', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Ícone</div><input style={{ ...S.input, width: 50 }} value={block.icon || ''} onChange={e => u('icon', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Duração (seg)</div><input type="number" style={S.input} value={block.duration || 5} onChange={e => u('duration', Number(e.target.value))} /></div>
                    </>)}

                    {/* Level */}
                    {block.type === 'level' && (<>
                        <div style={S.section}><div style={S.sTitle}>Título</div><input style={S.input} value={block.title || ''} onChange={e => u('title', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Label</div><input style={S.input} value={block.label || ''} onChange={e => u('label', e.target.value)} /></div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <div style={{ ...S.section, flex: 1 }}><div style={S.sTitle}>Valor</div><input type="number" style={S.input} value={block.value || 3} onChange={e => u('value', Number(e.target.value))} /></div>
                            <div style={{ ...S.section, flex: 1 }}><div style={S.sTitle}>Máximo</div><input type="number" style={S.input} value={block.maxValue || 5} onChange={e => u('maxValue', Number(e.target.value))} /></div>
                        </div>
                        <div style={S.section}><div style={S.sTitle}>Cor</div><div style={{ display: 'flex', gap: 6 }}><input type="color" value={block.color || '#f59e0b'} onChange={e => u('color', e.target.value)} style={{ width: 30, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer' }} /><input style={{ ...S.input, flex: 1 }} value={block.color || ''} onChange={e => u('color', e.target.value)} /></div></div>
                    </>)}

                    {/* FAQ */}
                    {block.type === 'faq' && (<>
                        <div style={S.section}><div style={S.sTitle}>Título</div><input style={S.input} value={block.title || ''} onChange={e => u('title', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Itens ({(block.items || []).length})</div>
                            {(block.items || []).map((item, i) => (
                                <div key={i} style={{ marginBottom: 8, padding: 8, background: '#f9fafb', borderRadius: 8, border: '1px solid var(--border)' }}>
                                    <input style={{ ...S.input, marginBottom: 4 }} value={item.q || ''} onChange={e => { const its = [...(block.items || [])]; its[i] = { ...its[i], q: e.target.value }; u('items', its); }} placeholder="Pergunta" />
                                    <textarea style={{ ...S.textarea, minHeight: 40 }} value={item.a || ''} onChange={e => { const its = [...(block.items || [])]; its[i] = { ...its[i], a: e.target.value }; u('items', its); }} placeholder="Resposta" />
                                    <button style={{ ...S.smallBtn, marginTop: 4 }} onClick={() => u('items', (block.items || []).filter((_, j) => j !== i))}><Trash2 size={12} /> Remover</button>
                                </div>
                            ))}
                            <button style={S.addBtn} onClick={() => u('items', [...(block.items || []), { q: '', a: '' }])}><Plus size={12} /> Adicionar</button>
                        </div>
                    </>)}

                    {/* Before/After */}
                    {block.type === 'before-after' && (<>
                        <div style={S.section}><div style={S.sTitle}>Título</div><input style={S.input} value={block.title || ''} onChange={e => u('title', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Label Antes</div><input style={S.input} value={block.beforeLabel || ''} onChange={e => u('beforeLabel', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Imagem Antes</div><label style={S.addBtn}><Upload size={12} /> Upload<input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) { const { dataUrl } = await compressAndStore(f); u('beforeImage', dataUrl); } }} /></label>{block.beforeImage && <img src={block.beforeImage} alt="" style={{ width: '100%', height: 50, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} />}</div>
                        <div style={S.section}><div style={S.sTitle}>Label Depois</div><input style={S.input} value={block.afterLabel || ''} onChange={e => u('afterLabel', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Imagem Depois</div><label style={S.addBtn}><Upload size={12} /> Upload<input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) { const { dataUrl } = await compressAndStore(f); u('afterImage', dataUrl); } }} /></label>{block.afterImage && <img src={block.afterImage} alt="" style={{ width: '100%', height: 50, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} />}</div>
                    </>)}

                    {/* Carousel */}
                    {block.type === 'carousel' && (<>
                        <div style={S.section}><div style={S.sTitle}>Slides ({(block.slides || []).length})</div>
                            {(block.slides || []).map((slide, i) => (
                                <div key={i} style={{ marginBottom: 8, padding: 8, background: '#f9fafb', borderRadius: 8, border: '1px solid var(--border)' }}>
                                    <input style={{ ...S.input, marginBottom: 4 }} value={slide.text || ''} onChange={e => { const ss = [...(block.slides || [])]; ss[i] = { ...ss[i], text: e.target.value }; u('slides', ss); }} placeholder={`Slide ${i + 1}`} />
                                    <label style={S.addBtn}><Upload size={12} /> Imagem<input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) { const { dataUrl } = await compressAndStore(f); const ss = [...(block.slides || [])]; ss[i] = { ...ss[i], image: dataUrl }; u('slides', ss); } }} /></label>
                                    {slide.image && <img src={slide.image} alt="" style={{ width: '100%', height: 50, objectFit: 'cover', borderRadius: 6, marginTop: 4 }} />}
                                    <button style={{ ...S.smallBtn, marginTop: 4 }} onClick={() => u('slides', (block.slides || []).filter((_, j) => j !== i))}><Trash2 size={12} /></button>
                                </div>
                            ))}
                            <button style={S.addBtn} onClick={() => u('slides', [...(block.slides || []), { text: '', image: '' }])}><Plus size={12} /> Slide</button>
                        </div>
                    </>)}

                    {/* Spacer */}
                    {block.type === 'spacer' && (<>
                        <div style={S.section}><div style={S.sTitle}>Altura ({block.height || 40}px)</div><input type="range" min={8} max={120} step={4} value={block.height || 40} onChange={e => u('height', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} /></div>
                    </>)}

                    {/* Logo */}
                    {block.type === 'logo' && (<>
                        <div style={S.section}>
                            <div style={S.sTitle}>Imagem do Logo</div>
                            {block.imageUrl && <img src={block.imageUrl.startsWith('/') ? `${import.meta.env.DEV ? 'http://localhost:3001' : ''}${block.imageUrl}` : block.imageUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: 80, objectFit: 'contain', marginBottom: 6, borderRadius: 6 }} />}
                            <input type="file" accept="image/*" style={{ marginTop: 6, fontSize: 11 }} onChange={async e => { const f = e.target.files[0]; if (f) { const { uploadImage } = await import('../hooks/useQuizStore'); const url = await uploadImage(f); if (url) u('imageUrl', url); } }} />
                        </div>
                        <div style={S.section}><div style={S.sTitle}>Largura máxima ({block.maxWidth || 120}px)</div><input type="range" min={40} max={300} step={10} value={block.maxWidth || 120} onChange={e => u('maxWidth', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} /></div>
                        <div style={S.section}>
                            <div style={S.sTitle}>Posição</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {['top', 'bottom'].map(pos => (
                                    <button key={pos} onClick={() => u('position', pos)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: `1px solid ${block.position === pos ? 'var(--primary)' : 'var(--border)'}`, background: block.position === pos ? 'rgba(99,102,241,0.06)' : '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: block.position === pos ? 600 : 400, color: block.position === pos ? 'var(--primary)' : 'var(--text-secondary)' }}>
                                        {pos === 'top' ? 'Topo' : 'Rodapé'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={S.section}><div style={S.sTitle}>Texto alternativo</div><input style={S.input} value={block.alt || ''} onChange={e => u('alt', e.target.value)} placeholder="Logo da empresa" /></div>
                    </>)}

                    {/* HTML/Script — Visual Preview + Code Editor */}
                    {block.type === 'html-script' && (<>
                        <div style={{ padding: '8px 10px', background: '#eef2ff', borderRadius: 10, marginBottom: 12, border: '1px solid #c7d2fe' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4f46e5', marginBottom: 2 }}>🔗 Página Clonada</div>
                            <div style={{ fontSize: '0.63rem', color: '#6366f1' }}>Esta página foi clonada de uma URL externa</div>
                        </div>
                        {/* Preview */}
                        <div style={S.section}>
                            <div style={S.sTitle}>Preview</div>
                            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#fff' }}>
                                {block.code ? (
                                    <iframe
                                        srcDoc={block.code}
                                        title="Preview"
                                        sandbox="allow-same-origin"
                                        style={{ width: '100%', height: 240, border: 'none', background: '#fff' }}
                                        scrolling="auto"
                                    />
                                ) : (
                                    <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', fontSize: 13 }}>Sem conteúdo</div>
                                )}
                            </div>
                        </div>
                        {/* Code Editor (collapsed by default) */}
                        <div style={S.section}>
                            <details>
                                <summary style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>✏️ Editar código HTML</summary>
                                <textarea style={{ ...S.textarea, minHeight: 160, fontFamily: 'monospace', fontSize: '0.72rem', marginTop: 8, lineHeight: 1.5 }} value={block.code || ''} onChange={e => u('code', e.target.value)} placeholder="<div>...</div>" />
                            </details>
                        </div>
                    </>)}

                    {/* Metrics */}
                    {block.type === 'metrics' && (<>
                        <div style={S.section}>
                            <div style={S.sTitle}>Tipo de métrica</div>
                            <select style={S.input} value={block.metricType || 'tmb'} onChange={e => u('metricType', e.target.value)}>
                                <option value="tmb">🔥 TMB — Taxa Metabólica Basal</option>
                                <option value="geb">⚡ GEB — Gasto Energético Basal</option>
                                <option value="iag">📊 IAG — Índice de Adiposidade</option>
                                <option value="pesoIdeal">⚖️ Peso Ideal</option>
                                <option value="custom">📐 Personalizada</option>
                            </select>
                        </div>
                        <div style={S.section}><div style={S.sTitle}>Título</div><input style={S.input} value={block.title || ''} onChange={e => u('title', e.target.value)} /></div>
                        <div style={S.section}><div style={S.sTitle}>Descrição</div><textarea style={S.textarea} value={block.text || ''} onChange={e => u('text', e.target.value)} /></div>
                    </>)}

                    {/* Welcome block content */}
                    {block.type === 'welcome' && (<>
                        <div style={{ padding: '8px 10px', background: '#eef2ff', borderRadius: 10, marginBottom: 12, border: '1px solid #c7d2fe' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4f46e5', marginBottom: 2 }}>🏠 Capa do Quiz</div>
                            <div style={{ fontSize: '0.63rem', color: '#6366f1' }}>Tela inicial que o usuário vê antes de começar</div>
                        </div>
                        <div style={S.section}><div style={S.sTitle}>Emoji</div><input style={S.input} value={block.emoji || ''} onChange={e => u('emoji', e.target.value)} placeholder="Ex: 🔥 ou 💪" /></div>
                        <div style={S.section}><div style={S.sTitle}>Headline</div><textarea style={{ ...S.textarea, minHeight: 50 }} value={block.headline || ''} onChange={e => u('headline', e.target.value)} placeholder="Descubra seu perfil ideal!" /></div>
                        <div style={S.section}><div style={S.sTitle}>Subtítulo</div><textarea style={{ ...S.textarea, minHeight: 40 }} value={block.subtitle || ''} onChange={e => u('subtitle', e.target.value)} placeholder="Responda em 2 min e descubra" /></div>
                        <div style={S.section}><div style={S.sTitle}>Texto do botão</div><input style={S.input} value={block.cta || ''} onChange={e => u('cta', e.target.value)} placeholder="Começar →" /></div>
                        <div style={S.section}>
                            <div style={S.sTitle}>Imagem de fundo</div>
                            <input style={S.input} value={block.imageUrl || ''} onChange={e => u('imageUrl', e.target.value)} placeholder="URL da imagem..." />
                            <input type="file" accept="image/*" style={{ marginTop: 6, fontSize: 11 }} onChange={async e => { const f = e.target.files[0]; if (f) { const { uploadImage } = await import('../hooks/useQuizStore'); const url = await uploadImage(f); if (url) u('imageUrl', url); } }} />
                        </div>
                    </>)}
                </>)}

                {tab === 'style' && (<>
                    {/* ── Per-block styling ── */}
                    <div style={{ padding: '8px 10px', background: '#f0f4ff', borderRadius: 10, marginBottom: 14, border: '1px solid #d4dff7' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>🎨 Estilo do bloco</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Personalize a aparência deste bloco específico</div>
                    </div>

                    {/* Background */}
                    <div style={S.section}>
                        <div style={S.sTitle}>Fundo</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {[
                                { id: 'none', label: 'Nenhum', bg: 'transparent', border: '1px dashed #d1d5db' },
                                { id: '#f8fafc', label: 'Cinza', bg: '#f8fafc', border: '1px solid #e2e8f0' },
                                { id: '#eff6ff', label: 'Azul', bg: '#eff6ff', border: '1px solid #bfdbfe' },
                                { id: '#f0fdf4', label: 'Verde', bg: '#f0fdf4', border: '1px solid #bbf7d0' },
                                { id: '#fef2f2', label: 'Vermelho', bg: '#fef2f2', border: '1px solid #fecaca' },
                                { id: '#faf5ff', label: 'Roxo', bg: '#faf5ff', border: '1px solid #e9d5ff' },
                                { id: '#fffbeb', label: 'Amarelo', bg: '#fffbeb', border: '1px solid #fde68a' },
                            ].map(c => (
                                <div key={c.id} onClick={() => u('bgColor', c.id === 'none' ? '' : c.id)} style={{
                                    width: 32, height: 32, borderRadius: 8, background: c.bg, cursor: 'pointer',
                                    border: (block.bgColor || '') === (c.id === 'none' ? '' : c.id) ? '2px solid var(--primary)' : c.border,
                                    boxShadow: (block.bgColor || '') === (c.id === 'none' ? '' : c.id) ? '0 0 0 2px rgba(37,99,235,0.2)' : 'none',
                                    transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }} title={c.label}>
                                    {c.id === 'none' && <span style={{ fontSize: 10, color: '#aaa' }}>∅</span>}
                                </div>
                            ))}
                            <input type="color" value={block.bgColor || '#ffffff'} onChange={e => u('bgColor', e.target.value)}
                                style={{ width: 32, height: 32, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 8 }} title="Cor custom" />
                        </div>
                    </div>

                    {/* Padding */}
                    <div style={S.section}>
                        <div style={S.sTitle}>Espaçamento interno ({block.padding || 0}px)</div>
                        <input type="range" min={0} max={40} step={4} value={block.padding || 0} onChange={e => u('padding', Number(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--primary)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            <span>0</span><span>20</span><span>40</span>
                        </div>
                    </div>

                    {/* Margin */}
                    <div style={S.section}>
                        <div style={S.sTitle}>Margem ({block.margin || 0}px)</div>
                        <input type="range" min={0} max={32} step={4} value={block.margin || 0} onChange={e => u('margin', Number(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--primary)' }} />
                    </div>

                    {/* Border Radius */}
                    <div style={S.section}>
                        <div style={S.sTitle}>Bordas</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {[
                                { val: 0, label: 'Reto', icon: '▢' },
                                { val: 8, label: 'Leve', icon: '◻' },
                                { val: 16, label: 'Médio', icon: '⬜' },
                                { val: 24, label: 'Arred.', icon: '⏹' },
                                { val: 999, label: 'Pílula', icon: '💊' },
                            ].map(r => (
                                <div key={r.val} style={S.chip((block.borderRadius ?? 0) === r.val)} onClick={() => u('borderRadius', r.val)}>
                                    <span style={{ fontSize: 12 }}>{r.icon}</span><br /><span style={{ fontSize: 9 }}>{r.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Border */}
                    <div style={S.section}>
                        <div style={S.sTitle}>Contorno</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {[
                                { id: 'none', label: 'Nenhum' },
                                { id: 'solid', label: 'Sólido' },
                                { id: 'dashed', label: 'Traçado' },
                            ].map(b => (
                                <div key={b.id} style={S.chip((block.borderStyle || 'none') === b.id)} onClick={() => u('borderStyle', b.id)}>
                                    {b.label}
                                </div>
                            ))}
                        </div>
                        {block.borderStyle && block.borderStyle !== 'none' && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                                <input type="color" value={block.borderColor || '#e2e8f0'} onChange={e => u('borderColor', e.target.value)}
                                    style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 4 }} />
                                <input type="range" min={1} max={4} value={block.borderWidth || 1} onChange={e => u('borderWidth', Number(e.target.value))}
                                    style={{ flex: 1, accentColor: 'var(--primary)' }} />
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', minWidth: 24 }}>{block.borderWidth || 1}px</span>
                            </div>
                        )}
                    </div>

                    {/* Shadow */}
                    <div style={S.section}>
                        <div style={S.sTitle}>Sombra</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {[
                                { id: 'none', label: 'Nenhuma', val: 'none' },
                                { id: 'sm', label: 'Leve', val: '0 1px 3px rgba(0,0,0,0.08)' },
                                { id: 'md', label: 'Média', val: '0 4px 12px rgba(0,0,0,0.1)' },
                                { id: 'lg', label: 'Forte', val: '0 8px 24px rgba(0,0,0,0.15)' },
                            ].map(s => (
                                <div key={s.id} style={S.chip((block.shadow || 'none') === s.id)} onClick={() => u('shadow', s.id)}>
                                    {s.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Opacity */}
                    <div style={S.section}>
                        <div style={S.sTitle}>Opacidade ({block.opacity ?? 100}%)</div>
                        <input type="range" min={20} max={100} step={5} value={block.opacity ?? 100} onChange={e => u('opacity', Number(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--primary)' }} />
                    </div>

                    {/* Welcome block styling only */}
                    {block.type === 'welcome' && (<>
                        {block.imageUrl && (<>
                            <div style={S.section}><div style={S.sTitle}>Largura da imagem (%)</div><input type="range" min={20} max={100} value={block.imageWidth || 100} onChange={e => u('imageWidth', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{block.imageWidth || 100}%</span></div>
                            <div style={S.section}><div style={S.sTitle}>Altura da imagem (px)</div><input type="range" min={80} max={400} value={block.imageHeightPx || 200} onChange={e => u('imageHeightPx', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{block.imageHeightPx || 200}px</span></div>
                            <div style={S.section}><div style={S.sTitle}>Posição da imagem</div><div style={{ display: 'flex', gap: 4 }}>{['top', 'center', 'bottom'].map(p => <button key={p} onClick={() => u('imagePosition', p)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: block.imagePosition === p ? '2px solid var(--primary)' : '1px solid var(--border)', background: block.imagePosition === p ? 'rgba(37,99,235,0.06)' : '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: block.imagePosition === p ? 'var(--primary)' : 'var(--text-secondary)' }}>{p === 'top' ? '⬆️ Topo' : p === 'center' ? '↔️ Meio' : '⬇️ Baixo'}</button>)}</div></div>
                        </>)}
                        <div style={S.section}><div style={S.sTitle}>Alinhamento do texto</div><div style={{ display: 'flex', gap: 4 }}>{['left', 'center', 'right'].map(a => <button key={a} onClick={() => u('textAlign', a)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: block.textAlign === a ? '2px solid var(--primary)' : '1px solid var(--border)', background: block.textAlign === a ? 'rgba(37,99,235,0.06)' : '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: block.textAlign === a ? 'var(--primary)' : 'var(--text-secondary)' }}>{a === 'left' ? '⬅️' : a === 'center' ? '↔️' : '➡️'}</button>)}</div></div>
                        <div style={S.section}><div style={S.sTitle}>Cor de fundo</div><div style={{ display: 'flex', gap: 6 }}><input type="color" value={block.bgColor || '#ffffff'} onChange={e => u('bgColor', e.target.value)} style={{ width: 30, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer' }} /><input style={{ ...S.input, flex: 1 }} value={block.bgColor || ''} onChange={e => u('bgColor', e.target.value)} placeholder="Automático" /></div></div>
                    </>)}

                    {/* Global settings */}
                    <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0', paddingTop: 16 }}>
                        <div style={S.section}><div style={S.sTitle}>Cor primária</div><div style={{ display: 'flex', gap: 6 }}><input type="color" value={config.primaryColor} onChange={e => onConfigChange('primaryColor', e.target.value)} style={{ width: 30, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer' }} /><input style={{ ...S.input, flex: 1 }} value={config.primaryColor} onChange={e => onConfigChange('primaryColor', e.target.value)} /></div></div>
                        <div style={S.section}><div style={S.sTitle}>Cor de fundo</div><div style={{ display: 'flex', gap: 6 }}><input type="color" value={config.bgColor || '#0f172a'} onChange={e => onConfigChange('bgColor', e.target.value)} style={{ width: 30, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer' }} /><input style={{ ...S.input, flex: 1 }} value={config.bgColor || ''} onChange={e => onConfigChange('bgColor', e.target.value)} placeholder="#0f172a" /></div></div>
                    </div>
                </>)}
            </div>
        </div>
    );
}
