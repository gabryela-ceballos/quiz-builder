// Palette.jsx — searchable component palette + ready-made steps
import { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { PALETTE_CATEGORIES, searchPalette } from '../blocks/registry';
import { STEP_TEMPLATES, STEP_TEMPLATE_CATEGORIES } from '../blocks/presets';

export default function Palette({ onAdd, onDragStartItem, onDragEndItem, onAddStep, tab: tabProp, setTab: setTabProp }) {
    const [tabState, setTabState] = useState('blocks');
    const tab = tabProp || tabState;
    const setTab = setTabProp || setTabState;
    const [q, setQ] = useState('');
    const [closed, setClosed] = useState({});
    const results = searchPalette(q);
    const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const tpls = q ? STEP_TEMPLATES.filter(t => norm(`${t.name} ${t.desc} ${t.cat}`).includes(norm(q))) : STEP_TEMPLATES;

    return (
        <div className="qb-palette">
            <div className="qb-tabs">
                <button className={`qb-tab ${tab === 'blocks' ? 'active' : ''}`} onClick={() => setTab('blocks')}>Blocos</button>
                <button className={`qb-tab ${tab === 'steps' ? 'active' : ''}`} onClick={() => setTab('steps')}>Etapas prontas</button>
            </div>
            <div className="qb-search">
                <Search size={14} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder={tab === 'blocks' ? 'Buscar bloco…' : 'Buscar etapa…'} />
            </div>
            <div className="qb-palette-body">
                {tab === 'blocks' && PALETTE_CATEGORIES.map(cat => {
                    const items = results.filter(p => p.cat === cat.key);
                    if (!items.length) return null;
                    const isClosed = !q && closed[cat.key];
                    return (
                        <div key={cat.key} className={`qb-cat ${isClosed ? 'closed' : ''}`}>
                            <button className="qb-cat-head" onClick={() => setClosed(c => ({ ...c, [cat.key]: !c[cat.key] }))}>
                                {cat.label} <ChevronDown size={14} />
                            </button>
                            {!isClosed && (
                                <div className="qb-grid">
                                    {items.map(entry => {
                                        const Icon = entry.icon;
                                        return (
                                            <button key={entry.key} className="qb-item" draggable title={`${entry.label} — clique ou arraste`}
                                                onDragStart={e => { e.dataTransfer.setData('qb-palette', entry.key); e.dataTransfer.effectAllowed = 'copy'; onDragStartItem?.(entry); }}
                                                onDragEnd={() => onDragEndItem?.()}
                                                onClick={() => onAdd(entry)}>
                                                <span className="qb-item-icon" style={{ background: `${entry.color}14`, color: entry.color }}><Icon size={16} strokeWidth={2.2} /></span>
                                                <span>
                                                    <div className="qb-item-label">{entry.label}</div>
                                                    <div className="qb-item-desc">{entry.desc}</div>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
                {tab === 'blocks' && !results.length && <div style={{ fontSize: '.75rem', color: '#9ca3af', textAlign: 'center', padding: 20 }}>Nenhum bloco encontrado</div>}

                {tab === 'steps' && STEP_TEMPLATE_CATEGORIES.map(cat => {
                    const items = tpls.filter(t => t.cat === cat);
                    if (!items.length) return null;
                    return (
                        <div key={cat} className="qb-cat">
                            <div className="qb-cat-head" style={{ cursor: 'default' }}>{cat}</div>
                            {items.map(t => (
                                <button key={t.key} className="qb-tpl" onClick={() => onAddStep(t.key)} title="Adicionar etapa depois da atual">
                                    <span className="qb-tpl-emoji">{t.icon}</span>
                                    <span style={{ minWidth: 0 }}>
                                        <div className="qb-item-label">{t.name}</div>
                                        <div className="qb-item-desc">{t.desc}</div>
                                    </span>
                                </button>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
