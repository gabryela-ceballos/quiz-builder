// EditorCanvas.jsx — WYSIWYG canvas: the real quiz renderer wrapped with selection, toolbars and insert points
import { useState, useCallback } from 'react';
import { ArrowUp, ArrowDown, Copy, Trash2, GripVertical, Plus, GitBranch, LayoutTemplate } from 'lucide-react';
import StepView, { QuizFrame } from '../blocks/StepView';
import { paletteByType, PALETTE } from '../blocks/registry';
import QuickInsert from './QuickInsert';

const EMPTY_SUGGESTIONS = ['choice', 'heading', 'text-input', 'image', 'capture', 'button'];

export default function EditorCanvas({
    step, steps, stepIndex, design, T, viewMode, selectedId, onSelect, onEditBlock,
    onInsert, onMoveBlock, onDuplicateBlock, onDeleteBlock, onOpenStepSettings, onOpenTemplates, draggingPalette,
}) {
    const [dropIndex, setDropIndex] = useState(null);
    const [dragBlock, setDragBlock] = useState(null);
    const [pop, setPop] = useState(null); // { index, x, y }
    const blocks = step?.blocks || [];

    const closePop = useCallback(() => setPop(null), []);

    const openInsert = (index, e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        const x = Math.min(Math.max(r.left + r.width / 2 - 150, 8), window.innerWidth - 310);
        const y = r.bottom + 330 > window.innerHeight ? Math.max(r.top - 380, 8) : r.bottom + 6;
        setPop({ index, x, y });
    };

    const handleDrop = (e, index) => {
        e.preventDefault();
        e.stopPropagation();
        const paletteKey = e.dataTransfer.getData('qb-palette');
        const from = e.dataTransfer.getData('qb-block');
        if (paletteKey) {
            const entry = PALETTE.find(p => p.key === paletteKey);
            if (entry) onInsert(entry, index);
        } else if (from !== '') {
            const f = Number(from);
            if (!Number.isNaN(f)) onMoveBlock(f, index > f ? index - 1 : index);
        }
        setDropIndex(null);
        setDragBlock(null);
    };

    const dragOverBlock = (e, i) => {
        const hasPayload = draggingPalette || dragBlock !== null || e.dataTransfer.types.includes('qb-palette') || e.dataTransfer.types.includes('qb-block');
        if (!hasPayload) return;
        e.preventDefault();
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        setDropIndex(e.clientY < r.top + r.height / 2 ? i : i + 1);
    };

    const insertZone = (index, pos) => (
        <div className={`qb-insert ${pop?.index === index ? 'open' : ''} ${dropIndex === index ? 'drop' : ''}`}
            style={{ position: 'absolute', left: 0, right: 0, [pos]: -11 }}>
            <div className="qb-insert-zone" onClick={e => e.stopPropagation()} />
            <button className="qb-insert-btn" title="Adicionar bloco aqui" onClick={e => openInsert(index, e)}><Plus size={14} strokeWidth={3} /></button>
        </div>
    );

    const renderBlock = (block, i, node) => {
        const entry = paletteByType(block.type, block);
        const Icon = entry.icon;
        const selected = selectedId === block.id;
        return (
            <div
                className={`qb-block ${selected ? 'selected' : ''} ${dragBlock === i ? 'dragging' : ''} ${block.showIf?.blockId ? 'hidden-cond' : ''}`}
                onClick={e => { e.stopPropagation(); onSelect(block.id); }}
                onDragOver={e => dragOverBlock(e, i)}
                onDrop={e => handleDrop(e, dropIndex ?? i)}
            >
                <div className="qb-block-hit" />
                {insertZone(i, 'top')}
                {i === blocks.length - 1 && insertZone(blocks.length, 'bottom')}
                <div className="qb-block-label"><Icon size={12} /> {entry.label}</div>
                <div className="qb-block-tools" onClick={e => e.stopPropagation()}>
                    <button className="grip" title="Arrastar" draggable
                        onDragStart={e => {
                            e.dataTransfer.setData('qb-block', String(i));
                            e.dataTransfer.effectAllowed = 'move';
                            const el = e.currentTarget.closest('.qb-block');
                            if (el) e.dataTransfer.setDragImage(el, 24, 24);
                            setDragBlock(i);
                        }}
                        onDragEnd={() => { setDragBlock(null); setDropIndex(null); }}>
                        <GripVertical size={14} />
                    </button>
                    <button title="Mover para cima (Alt+↑)" disabled={i === 0} onClick={() => onMoveBlock(i, i - 1)}><ArrowUp size={14} /></button>
                    <button title="Mover para baixo (Alt+↓)" disabled={i === blocks.length - 1} onClick={() => onMoveBlock(i, i + 1)}><ArrowDown size={14} /></button>
                    <button title="Duplicar (⌘D)" onClick={() => onDuplicateBlock(block.id)}><Copy size={14} /></button>
                    <button className="danger" title="Excluir (Delete)" onClick={() => onDeleteBlock(block.id)}><Trash2 size={14} /></button>
                </div>
                {block.showIf?.blockId && <span className="qb-cond-chip"><GitBranch size={9} style={{ verticalAlign: -1 }} /> Condicional</span>}
                {node}
            </div>
        );
    };

    return (
        <div className="qb-canvas" onClick={() => onSelect(null)} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropIndex(null); }}>
            <div className={`qb-device ${viewMode}`} onClick={e => e.stopPropagation()}>
                <div className="qb-device-bar">
                    {viewMode === 'mobile' ? <div className="qb-notch" /> : <><span className="qb-dot" style={{ background: '#f87171' }} /><span className="qb-dot" style={{ background: '#fbbf24' }} /><span className="qb-dot" style={{ background: '#34d399' }} /></>}
                </div>
                <div className="qb-device-scroll" onClick={() => onSelect(null)}>
                    <QuizFrame T={T} design={design} step={step} index={stepIndex} total={steps.length} canBack={stepIndex > 0} onBack={() => { }} minHeight={viewMode === 'mobile' ? 714 : 586}>
                        {!step ? (
                            <div className="qb-empty"><div className="qb-empty-title">Nenhuma etapa</div><div className="qb-empty-sub">Crie uma etapa para começar.</div></div>
                        ) : blocks.length === 0 ? (
                            <div className={`qb-empty ${dropIndex === 0 ? 'drop' : ''}`}
                                onDragOver={e => { e.preventDefault(); setDropIndex(0); }}
                                onDrop={e => handleDrop(e, 0)}
                                onClick={e => e.stopPropagation()}>
                                <div className="qb-empty-title">Etapa vazia</div>
                                <div className="qb-empty-sub">Arraste um bloco da esquerda ou comece por aqui:</div>
                                <div className="qb-empty-grid">
                                    {EMPTY_SUGGESTIONS.map(k => {
                                        const entry = PALETTE.find(p => p.key === k);
                                        const Icon = entry.icon;
                                        return (
                                            <button key={k} onClick={() => onInsert(entry, 0)}>
                                                <span className="qb-item-icon" style={{ background: `${entry.color}14`, color: entry.color, width: 26, height: 26 }}><Icon size={14} /></span>
                                                {entry.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button className="qb-btn" style={{ marginTop: 12 }} onClick={onOpenTemplates}><LayoutTemplate size={14} /> Usar uma etapa pronta</button>
                            </div>
                        ) : (
                            <StepView step={step} T={T} design={design} mode="edit" steps={steps}
                                renderBlock={renderBlock} selectedId={selectedId} onEditBlock={onEditBlock}
                                onContinueClick={onOpenStepSettings} />
                        )}
                    </QuizFrame>
                </div>
            </div>
            {pop && (
                <QuickInsert style={{ position: 'fixed', left: pop.x, top: pop.y }} onClose={closePop}
                    onPick={entry => { onInsert(entry, pop.index); setPop(null); }} />
            )}
        </div>
    );
}
