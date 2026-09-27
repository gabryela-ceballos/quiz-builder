// ui.jsx — small form primitives for the v2 inspector
import { useState, useRef, useEffect } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { compressAndStore } from '../utils/imageStore';
import { DEFAULT_VARS, normalizeAction } from '../blocks/logic';

export function Section({ title, right, children }) {
    return (
        <div className="qb-sec">
            {title && <div className="qb-sec-title"><span>{title}</span>{right}</div>}
            {children}
        </div>
    );
}

export function Field({ label, hint, children }) {
    return (
        <div className="qb-field">
            {label && <label className="qb-label">{label}</label>}
            {children}
            {hint && <div className="qb-hint">{hint}</div>}
        </div>
    );
}

export function Seg({ value, options, onChange }) {
    return (
        <div className="qb-seg">
            {options.map(o => (
                <button key={String(o.value)} type="button" className={value === o.value ? 'active' : ''} title={o.title || o.label} onClick={() => onChange(o.value)}>
                    {o.icon}{o.label}
                </button>
            ))}
        </div>
    );
}

export function Switch({ label, checked, onChange, hint }) {
    return (
        <div>
            <label className="qb-switch">
                <span>{label}</span>
                <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
                <i />
            </label>
            {hint && <div className="qb-hint" style={{ marginTop: -2, marginBottom: 4 }}>{hint}</div>}
        </div>
    );
}

// Text input/textarea with variable chips that insert {{var}} at the caret
export function TextWithVars({ value, onChange, multiline, placeholder, vars = [], rows = 3 }) {
    const ref = useRef(null);
    const insert = key => {
        const el = ref.current;
        const token = `{{${key}}}`;
        const v = value || '';
        if (!el) { onChange(v + token); return; }
        const s = el.selectionStart ?? v.length, e = el.selectionEnd ?? v.length;
        const next = v.slice(0, s) + token + v.slice(e);
        onChange(next);
        requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length); });
    };
    const all = [...DEFAULT_VARS, ...vars.filter(v => !DEFAULT_VARS.some(d => d.key === v.key))];
    return (
        <div>
            {multiline
                ? <textarea ref={ref} className="qb-ta" rows={rows} value={value || ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
                : <input ref={ref} className="qb-in" value={value || ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />}
            <div className="qb-varbar">
                {all.slice(0, 8).map(v => <button key={v.key} type="button" className="qb-var" title={`Inserir ${v.label}`} onClick={() => insert(v.key)}>{`{{${v.key}}}`}</button>)}
            </div>
        </div>
    );
}

export function ImageField({ value, onChange, label = 'Enviar imagem', height = 90 }) {
    const [busy, setBusy] = useState(false);
    const pick = () => {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.onchange = async e => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try { const { dataUrl } = await compressAndStore(f); onChange(dataUrl); } catch { /* ignore */ }
            setBusy(false);
        };
        inp.click();
    };
    if (value) {
        return (
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <img src={value} alt="" style={{ width: '100%', height, objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                    <button type="button" className="qb-btn" style={{ padding: '4px 8px' }} onClick={pick}>Trocar</button>
                    <button type="button" className="qb-btn danger" style={{ padding: '4px 6px' }} onClick={() => onChange('')}><X size={12} /></button>
                </div>
            </div>
        );
    }
    return (
        <div className="qb-upload" onClick={pick}>
            <ImagePlus size={18} style={{ marginBottom: 4 }} /><div>{busy ? 'Enviando…' : label}</div>
            <div style={{ marginTop: 6 }}>
                <input className="qb-in" placeholder="ou cole uma URL" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') onChange(e.currentTarget.value.trim()); }} onBlur={e => e.target.value.trim() && onChange(e.target.value.trim())} style={{ fontSize: '.7rem' }} />
            </div>
        </div>
    );
}

const EMOJIS = ['✅', '❌', '👍', '👎', '🔥', '⭐', '💪', '❤️', '😊', '😍', '🤔', '😴', '🎯', '🚀', '💰', '💎', '🌱', '🌟', '👩', '👨', '🏃', '🥗', '💧', '⏰', '📈', '🧠', '✨', '🎉', '👀', '🙌'];

export function EmojiInput({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);
    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <div className="qb-row">
                <button type="button" className="qb-btn" style={{ width: 38, padding: 0, height: 34, fontSize: 17 }} onClick={() => setOpen(o => !o)}>{value || '＋'}</button>
                <input className="qb-in" value={value || ''} placeholder="Emoji" onChange={e => onChange(e.target.value)} style={{ width: 70 }} />
                {value && <button type="button" className="qb-opt-more" onClick={() => onChange('')} title="Remover"><X size={13} /></button>}
            </div>
            {open && (
                <div className="qb-menu" style={{ left: 0, right: 'auto', width: 230, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2 }}>
                    {EMOJIS.map(e => <button key={e} type="button" className="qb-menu-item" style={{ textAlign: 'center', fontSize: 18, padding: 5 }} onClick={() => { onChange(e); setOpen(false); }}>{e}</button>)}
                </div>
            )}
        </div>
    );
}

// Action picker: next / goto / url / whatsapp / end
export function ActionPicker({ value, onChange, steps = [], currentStepId, defaultLabel = 'Próxima etapa (padrão)' }) {
    const a = normalizeAction(value) || { type: 'next' };
    const set = patch => onChange({ ...a, ...patch });
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <select className="qb-sel" value={a.type} onChange={e => {
                const t = e.target.value;
                if (t === 'next') onChange(null);
                else if (t === 'goto') onChange({ type: 'goto', stepId: steps.find(s => s.id !== currentStepId)?.id || '' });
                else onChange({ type: t, url: a.url || '', newTab: t === 'url' ? a.newTab ?? false : undefined, phone: a.phone || '', message: a.message || '' });
            }}>
                <option value="next">➡️ {defaultLabel}</option>
                <option value="goto">🔀 Ir para uma etapa…</option>
                <option value="url">🔗 Abrir link</option>
                <option value="whatsapp">💬 Abrir WhatsApp</option>
                <option value="end">🏁 Finalizar quiz</option>
            </select>
            {a.type === 'goto' && (
                <select className="qb-sel" value={a.stepId || ''} onChange={e => set({ stepId: e.target.value })}>
                    {steps.map((s, i) => <option key={s.id} value={s.id} disabled={s.id === currentStepId}>{i + 1}. {s.name}</option>)}
                </select>
            )}
            {a.type === 'url' && (<>
                <input className="qb-in" value={a.url || ''} placeholder="https://… (aceita {{email}})" onChange={e => set({ url: e.target.value })} />
                <Switch label="Abrir em nova aba" checked={a.newTab} onChange={v => set({ newTab: v })} />
            </>)}
            {a.type === 'whatsapp' && (<>
                <input className="qb-in" value={a.phone || ''} placeholder="Número com DDD (ex: 5511999999999)" onChange={e => set({ phone: e.target.value })} />
                <textarea className="qb-ta" rows={2} value={a.message || ''} placeholder="Mensagem (ex: Oi! Meu nome é {{nome}})" onChange={e => set({ message: e.target.value })} />
            </>)}
        </div>
    );
}
