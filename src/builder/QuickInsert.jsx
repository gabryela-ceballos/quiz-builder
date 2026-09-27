// QuickInsert.jsx — "+" popover with fuzzy search and keyboard navigation
import { useState, useEffect, useRef } from 'react';
import { PALETTE_CATEGORIES, searchPalette } from '../blocks/registry';

export default function QuickInsert({ onPick, onClose, style }) {
    const [q, setQ] = useState('');
    const [active, setActive] = useState(0);
    const ref = useRef(null);
    const items = searchPalette(q);
    const ordered = PALETTE_CATEGORIES.flatMap(c => items.filter(i => i.cat === c.key));

    useEffect(() => {
        const onDown = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        setTimeout(() => document.addEventListener('mousedown', onDown), 0);
        return () => document.removeEventListener('mousedown', onDown);
    }, [onClose]);

    useEffect(() => {
        ref.current?.querySelector('.qb-pop-item.active')?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    const onKey = e => {
        e.stopPropagation();
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, ordered.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
        if (e.key === 'Enter' && ordered[active]) { e.preventDefault(); onPick(ordered[active]); }
        if (e.key === 'Escape') onClose();
    };

    const indexOf = entry => ordered.indexOf(entry);
    return (
        <div className="qb-pop" ref={ref} style={style} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
            <input autoFocus value={q} placeholder="Buscar bloco… (ex: nome, estrela, vídeo)" onChange={e => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey} />
            <div className="qb-pop-list">
                {PALETTE_CATEGORIES.map(cat => {
                    const list = items.filter(i => i.cat === cat.key);
                    if (!list.length) return null;
                    return (
                        <div key={cat.key}>
                            <div className="qb-pop-cat">{cat.label}</div>
                            {list.map(entry => {
                                const idx = indexOf(entry);
                                const Icon = entry.icon;
                                return (
                                    <button key={entry.key} className={`qb-pop-item ${idx === active ? 'active' : ''}`} onMouseEnter={() => setActive(idx)} onClick={() => onPick(entry)}>
                                        <span className="qb-item-icon" style={{ background: `${entry.color}14`, color: entry.color }}><Icon size={15} /></span>
                                        <div><b>{entry.label}</b><span>{entry.desc}</span></div>
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
                {!ordered.length && <div style={{ padding: 16, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Nada encontrado</div>}
            </div>
        </div>
    );
}
