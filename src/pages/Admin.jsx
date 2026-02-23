// Admin.jsx — Admin panel to create/edit global templates
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Copy, Edit3, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { getAdminTemplates, saveAdminTemplate, deleteAdminTemplate } from '../utils/templates';
import { createBlock, BLOCK_TYPES } from '../utils/blockTypes';

function makeStep(name = 'Nova Etapa') {
    return { id: `stp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, blocks: [] };
}

export default function Admin() {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [editing, setEditing] = useState(null); // template being edited
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => { setTemplates(getAdminTemplates()); }, []);

    const refresh = () => setTemplates(getAdminTemplates());

    // Create new template
    const createTemplate = () => {
        const t = saveAdminTemplate({
            name: 'Novo Template',
            desc: 'Descrição do template',
            color: '#6c63ff',
            tags: [],
            steps: [makeStep('Etapa 1')],
        });
        setEditing(t);
        refresh();
    };

    // Save current editing template
    const saveEdit = () => {
        if (!editing) return;
        saveAdminTemplate(editing);
        setEditing(null);
        refresh();
    };

    // Delete template
    const handleDelete = (id) => {
        if (!confirm('Deletar este template?')) return;
        deleteAdminTemplate(id);
        if (editing?.id === id) setEditing(null);
        refresh();
    };

    // Duplicate template
    const duplicateTemplate = (t) => {
        const dup = { ...JSON.parse(JSON.stringify(t)), id: undefined, name: t.name + ' (Cópia)', createdAt: undefined };
        saveAdminTemplate(dup);
        refresh();
    };

    // Edit helpers
    const updateStep = (sIdx, key, val) => {
        const steps = [...editing.steps];
        steps[sIdx] = { ...steps[sIdx], [key]: val };
        setEditing({ ...editing, steps });
    };

    const addStep = () => {
        setEditing({ ...editing, steps: [...editing.steps, makeStep(`Etapa ${editing.steps.length + 1}`)] });
    };

    const removeStep = (sIdx) => {
        setEditing({ ...editing, steps: editing.steps.filter((_, i) => i !== sIdx) });
    };

    const addBlockToStep = (sIdx, type) => {
        const steps = [...editing.steps];
        const block = createBlock(type);
        steps[sIdx] = { ...steps[sIdx], blocks: [...steps[sIdx].blocks, { ...block, id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }] };
        setEditing({ ...editing, steps });
    };

    const removeBlock = (sIdx, bIdx) => {
        const steps = [...editing.steps];
        steps[sIdx] = { ...steps[sIdx], blocks: steps[sIdx].blocks.filter((_, i) => i !== bIdx) };
        setEditing({ ...editing, steps });
    };

    const updateBlock = (sIdx, bIdx, key, val) => {
        const steps = [...editing.steps];
        const blocks = [...steps[sIdx].blocks];
        blocks[bIdx] = { ...blocks[bIdx], [key]: val };
        steps[sIdx] = { ...steps[sIdx], blocks };
        setEditing({ ...editing, steps });
    };

    const updateTag = (val) => {
        const tags = val.split(',').map(t => t.trim()).filter(Boolean);
        setEditing({ ...editing, tags });
    };

    // ═══ EDITING VIEW ═══
    if (editing) return (
        <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', sans-serif" }}>
            <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
                <button onClick={() => { if (confirm('Descartar alterações?')) setEditing(null); }} style={iconBtn}><ArrowLeft size={16} /></button>
                <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>✏️ Editando: {editing.name}</span>
                <button onClick={saveEdit} style={{ ...chipBtn, background: '#059669', color: '#fff', borderColor: '#059669' }}><Save size={13} /> Salvar Template</button>
            </div>

            <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
                {/* Meta */}
                <div style={card}>
                    <h3 style={cardTitle}>Informações</h3>
                    <div style={fieldRow}>
                        <label style={fieldLabel}>Nome</label>
                        <input style={fieldInput} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                    </div>
                    <div style={fieldRow}>
                        <label style={fieldLabel}>Descrição</label>
                        <textarea style={{ ...fieldInput, minHeight: 60, resize: 'vertical' }} value={editing.desc} onChange={e => setEditing({ ...editing, desc: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ ...fieldRow, flex: 1 }}>
                            <label style={fieldLabel}>Cor</label>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input type="color" value={editing.color} onChange={e => setEditing({ ...editing, color: e.target.value })} style={{ width: 36, height: 32, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
                                <input style={{ ...fieldInput, flex: 1 }} value={editing.color} onChange={e => setEditing({ ...editing, color: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ ...fieldRow, flex: 1 }}>
                            <label style={fieldLabel}>Tags (separadas por vírgula)</label>
                            <input style={fieldInput} value={(editing.tags || []).join(', ')} onChange={e => updateTag(e.target.value)} placeholder="ex: vendas, quiz, leads" />
                        </div>
                    </div>
                </div>

                {/* Steps */}
                <div style={{ ...card, marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ ...cardTitle, margin: 0 }}>Etapas ({editing.steps.length})</h3>
                        <button onClick={addStep} style={{ ...chipBtn, background: '#f0fdf4', color: '#059669', borderColor: '#bbf7d0' }}><Plus size={13} /> Etapa</button>
                    </div>

                    {editing.steps.map((step, sIdx) => (
                        <div key={step.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
                            {/* Step header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f9fafb', cursor: 'pointer' }}
                                onClick={() => setExpandedId(expandedId === `${editing.id}-${sIdx}` ? null : `${editing.id}-${sIdx}`)}>
                                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{sIdx + 1}</span>
                                <input style={{ ...fieldInput, flex: 1, padding: '4px 8px', fontSize: 13 }} value={step.name} onChange={e => updateStep(sIdx, 'name', e.target.value)} onClick={e => e.stopPropagation()} />
                                <span style={{ fontSize: 11, color: '#9ca3af' }}>{step.blocks.length} blocos</span>
                                {expandedId === `${editing.id}-${sIdx}` ? <ChevronUp size={14} color="#9ca3af" /> : <ChevronDown size={14} color="#9ca3af" />}
                                <button onClick={e => { e.stopPropagation(); removeStep(sIdx); }} style={{ ...iconBtnSm, color: '#ef4444' }}><Trash2 size={12} /></button>
                            </div>

                            {/* Step blocks (expanded) */}
                            {expandedId === `${editing.id}-${sIdx}` && (
                                <div style={{ padding: '10px 14px', borderTop: '1px solid #e5e7eb' }}>
                                    {step.blocks.map((block, bIdx) => {
                                        const bt = BLOCK_TYPES.find(b => b.type === block.type) || {};
                                        return (
                                            <div key={block.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 6, background: '#fff' }}>
                                                <span style={{ fontSize: 14 }}>{bt.icon}</span>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: bt.color, flex: 1 }}>{bt.label}</span>
                                                {block.text && <span style={{ fontSize: 11, color: '#9ca3af', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.text}</span>}
                                                {block.content && <span style={{ fontSize: 11, color: '#9ca3af', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.content}</span>}
                                                <button onClick={() => removeBlock(sIdx, bIdx)} style={{ ...iconBtnSm, color: '#ef4444' }}><Trash2 size={11} /></button>
                                            </div>
                                        );
                                    })}
                                    {/* Add block */}
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                                        {BLOCK_TYPES.map(bt => (
                                            <button key={bt.type} onClick={() => addBlockToStep(sIdx, bt.type)}
                                                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, color: '#6b7280', transition: 'all 0.15s' }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = bt.color; e.currentTarget.style.color = bt.color; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280'; }}>
                                                <span style={{ fontSize: 11 }}>{bt.icon}</span> {bt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    // ═══ TEMPLATE LIST ═══
    return (
        <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: "'Inter', sans-serif" }}>
            <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
                <button onClick={() => navigate('/')} style={iconBtn}><ArrowLeft size={16} /></button>
                <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>🔒 Admin — Templates Globais</span>
                <button onClick={createTemplate} style={{ ...chipBtn, background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }}><Plus size={13} /> Novo Template</button>
            </div>

            <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
                {templates.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
                        <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nenhum template global</p>
                        <p style={{ fontSize: 14, marginBottom: 20 }}>Crie templates que ficarão disponíveis para todos os usuários</p>
                        <button onClick={createTemplate} style={{ ...chipBtn, background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)', padding: '10px 24px', fontSize: 14 }}><Plus size={14} /> Criar Template</button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                        {templates.map(t => (
                            <div key={t.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 18, transition: 'all 0.2s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: 4, background: t.color, marginTop: 6, flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
                                        <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>{t.desc}</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                                    {(t.tags || []).map(tag => <span key={tag} style={{ padding: '2px 8px', borderRadius: 6, background: `${t.color}12`, color: t.color, fontSize: 10, fontWeight: 600 }}>{tag}</span>)}
                                    <span style={{ padding: '2px 8px', borderRadius: 6, background: '#f3f4f6', color: '#6b7280', fontSize: 10 }}>{t.steps?.length || 0} etapas</span>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => setEditing(JSON.parse(JSON.stringify(t)))} style={{ ...chipBtn, flex: 1 }}><Edit3 size={12} /> Editar</button>
                                    <button onClick={() => duplicateTemplate(t)} style={chipBtn}><Copy size={12} /></button>
                                    <button onClick={() => handleDelete(t.id)} style={{ ...chipBtn, color: '#ef4444', borderColor: '#fecaca' }}><Trash2 size={12} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Shared styles
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', padding: 4 };
const iconBtnSm = { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 };
const chipBtn = { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151', transition: 'all 0.15s' };
const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 18 };
const cardTitle = { fontSize: 14, fontWeight: 700, marginBottom: 14, color: '#1f2937' };
const fieldRow = { marginBottom: 12 };
const fieldLabel = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };
const fieldInput = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
