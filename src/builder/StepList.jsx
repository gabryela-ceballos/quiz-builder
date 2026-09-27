// StepList.jsx — steps rail: select, rename, duplicate, delete, drag to reorder
import { useState } from 'react';
import { Copy, Trash2, Plus, LayoutTemplate, GitBranch, Globe } from 'lucide-react';
import { paletteByType } from '../blocks/registry';
import { normalizeAction } from '../blocks/logic';

function stepHasLogic(step) {
    if (normalizeAction(step.exitAction) || step.goToStep) return true;
    return (step.blocks || []).some(b => b.showIf?.blockId || normalizeAction(b.action)?.type === 'goto'
        || (b.options || []).some(o => normalizeAction(o?.action) || o?.goToStep));
}

function isCloneStep(step) {
    return step.blocks?.[0]?.type === 'html-script' && !!(step.blocks[0].fullCode || step.blocks[0].clonePageType);
}

export default function StepList({ steps, activeIdx, onSelect, onRename, onDuplicate, onDelete, onMove, onAdd, onOpenTemplates }) {
    const [renaming, setRenaming] = useState(null);
    const [dragFrom, setDragFrom] = useState(null);
    const [dropAt, setDropAt] = useState(null);

    return (
        <div className="qb-steps">
            <div className="qb-panel-head">
                <span>Etapas · {steps.length}</span>
                <button className="qb-tb-btn" style={{ height: 24, minWidth: 24, padding: 0 }} title="Nova etapa em branco" onClick={onAdd}><Plus size={15} /></button>
            </div>
            <div className="qb-steps-list" onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropAt(null); }}>
                {steps.map((step, i) => {
                    const main = (step.blocks || []).find(b => !['spacer', 'logo', 'text'].includes(b.type)) || step.blocks?.[0];
                    const clone = isCloneStep(step);
                    const entry = clone ? { icon: Globe, color: '#0891b2' } : main ? paletteByType(main.type, main) : null;
                    const Icon = entry?.icon;
                    const n = step.blocks?.length || 0;
                    return (
                        <div key={step.id}
                            className={`qb-step ${activeIdx === i ? 'active' : ''} ${dropAt === i && dragFrom !== null && dragFrom !== i ? 'drop-above' : ''}`}
                            draggable={renaming !== i}
                            onDragStart={e => { e.dataTransfer.setData('qb-step', String(i)); e.dataTransfer.effectAllowed = 'move'; setDragFrom(i); }}
                            onDragEnd={() => { setDragFrom(null); setDropAt(null); }}
                            onDragOver={e => { if (dragFrom === null) return; e.preventDefault(); setDropAt(i); }}
                            onDrop={e => {
                                e.preventDefault();
                                const from = Number(e.dataTransfer.getData('qb-step'));
                                if (!Number.isNaN(from) && from !== i) onMove(from, i);
                                setDragFrom(null); setDropAt(null);
                            }}
                            onClick={() => onSelect(i)}
                            onDoubleClick={() => setRenaming(i)}
                            title="Clique para editar · duplo clique para renomear · arraste para reordenar">
                            <span className="qb-step-num">{i + 1}</span>
                            <span className="qb-step-icon" style={{ background: entry ? `${entry.color}14` : '#f3f4f6', color: entry?.color || '#9ca3af' }}>
                                {Icon ? <Icon size={14} strokeWidth={2.2} /> : <Plus size={13} />}
                            </span>
                            {renaming === i ? (
                                <input className="qb-step-rename" autoFocus defaultValue={step.name}
                                    onClick={e => e.stopPropagation()}
                                    onBlur={e => { onRename(i, e.target.value.trim() || step.name); setRenaming(null); }}
                                    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null); }} />
                            ) : (
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="qb-step-name">{step.name || `Etapa ${i + 1}`}</div>
                                    <div className="qb-step-sub">{step.clone ? `Clonada · ${step.clone.mode === 'html' ? 'HTML fiel' : `${n} bloco${n > 1 ? 's' : ''}`}` : clone ? 'Página clonada' : n === 0 ? 'Vazia' : `${n} bloco${n > 1 ? 's' : ''}`}</div>
                                </div>
                            )}
                            {renaming !== i && stepHasLogic(step) && <span className="qb-badge logic" title="Tem lógica condicional"><GitBranch size={9} /></span>}
                            {renaming !== i && (
                                <div className="qb-step-actions">
                                    <button title="Duplicar etapa" onClick={e => { e.stopPropagation(); onDuplicate(i); }}><Copy size={12} /></button>
                                    <button className="danger" title="Excluir etapa" onClick={e => { e.stopPropagation(); onDelete(i); }}><Trash2 size={12} /></button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="qb-steps-foot">
                <button className="qb-btn block" onClick={onAdd}><Plus size={14} /> Nova etapa</button>
                <button className="qb-btn block" onClick={onOpenTemplates}><LayoutTemplate size={14} /> Etapas prontas</button>
            </div>
        </div>
    );
}
