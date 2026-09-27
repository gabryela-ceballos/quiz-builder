// BlockView.jsx — renders one block for both the builder canvas (mode 'edit') and the published quiz (mode 'live')
import { useState, useEffect, useRef } from 'react';
import { Check, Star, Heart, ChevronDown, Play } from 'lucide-react';
import { ALERT_TYPES } from '../utils/blockTypes';
import { BlockRenderer as LegacyBlockRenderer } from '../components/PhonePreview';
import { LoadingBlock, ProgressBarBlock, RiskChartBlock, ScrollPickerBlock, NumberInputBlock, BMIBlock, AIResultBlock } from './widgets';
import {
    getOptions, isMultiSelect, choiceAnswer, valueAnswer, optionAction, buttonAction, interpolate, formatPhone,
    computeScore, pickOutcome, isAnswerValid,
} from './logic';

const noop = () => { };

// ── Text helpers ──
function RichText({ text, vars, mode }) {
    if (!text) return null;
    const src = mode === 'live' ? interpolate(text, vars) : text;
    // **bold** and {{var}} highlighting (edit mode)
    const parts = String(src).split(/(\*\*[^*]+\*\*|\{\{=[^}]+\}\}|\{\{\s*[\w.-]+\s*\}\})/g);
    return <>{parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('{{=')) {
            const expr = p.slice(3, -2).trim();
            const label = /^data\(/.test(expr) ? '📅 data calculada' : /imc\(/.test(expr) ? 'ƒ IMC' : `ƒ ${expr.replace(/^(virgula|round)\((.*?)(,\s*\d+)?\)$/, '$2').slice(0, 26)}`;
            return <span key={i} className="qv-var" title={expr}>{label}</span>;
        }
        if (p.startsWith('{{')) return <span key={i} className="qv-var">{p.replace(/[{}\s]/g, '')}</span>;
        return <span key={i}>{p}</span>;
    })}</>;
}

// Inline-editable text: plain display in live mode, contentEditable on the canvas when the block is selected
export function Editable({ value, onChange, editable, as: Tag = 'div', style, placeholder, multiline, vars, mode, className }) {
    const ref = useRef(null);
    const focused = useRef(false);
    useEffect(() => {
        if (editable && ref.current && !focused.current && ref.current.innerText !== (value || '')) ref.current.innerText = value || '';
    }, [value, editable]);
    if (!editable) {
        if (!value && mode === 'live') return null;
        return (
            <Tag key="view" style={style} className={className}>
                {value ? <RichText text={value} vars={vars} mode={mode} /> : <span style={{ opacity: 0.4 }}>{placeholder}</span>}
            </Tag>
        );
    }
    return (
        <Tag
            key="edit"
            ref={ref}
            className={`qv-editable ${className || ''}`}
            contentEditable="plaintext-only"
            suppressContentEditableWarning
            spellCheck={false}
            data-placeholder={placeholder}
            style={{ ...style, whiteSpace: 'pre-wrap' }}
            onFocus={() => { focused.current = true; }}
            onBlur={e => { focused.current = false; onChange(e.currentTarget.innerText.replace(/\n$/, '')); }}
            onInput={e => onChange(e.currentTarget.innerText)}
            onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter' && !multiline) { e.preventDefault(); e.currentTarget.blur(); }
                if (e.key === 'Escape') e.currentTarget.blur();
            }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
        />
    );
}

// ── Shared pieces ──
function QuestionHeader({ block, T, ctx, align }) {
    const ed = ctx.editable;
    const a = align || block.align || T.align;
    return (
        <div style={{ textAlign: a, marginBottom: 18 }}>
            <Editable as="h2" value={block.text} onChange={v => ctx.onEdit({ text: v })} editable={ed} vars={ctx.vars} mode={ctx.mode}
                placeholder="Escreva a pergunta" multiline
                style={{ fontSize: block.fontSize || 21, fontWeight: 700, lineHeight: 1.3, color: T.text, margin: 0, letterSpacing: '-0.01em' }} />
            {(block.desc || ed) && (
                <Editable as="p" value={block.desc} onChange={v => ctx.onEdit({ desc: v })} editable={ed} vars={ctx.vars} mode={ctx.mode}
                    placeholder="Descrição (opcional)" multiline
                    style={{ fontSize: 15, color: T.textSec, margin: '8px 0 0', lineHeight: 1.5 }} />
            )}
        </div>
    );
}

function primaryBtnStyle(T, disabled, extra = {}) {
    return {
        width: '100%', padding: '16px 20px', borderRadius: T.btnRadius, border: 'none',
        background: disabled ? `rgba(${T.rgb},.35)` : T.primary, color: T.onPrimary,
        fontWeight: 700, fontSize: 16, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
        boxShadow: disabled ? 'none' : `0 6px 18px rgba(${T.rgb},.28)`, ...extra,
    };
}

export function ContinueButton({ T, label, disabled, onClick, mode }) {
    return (
        <button type="button" className="qv-btn" disabled={disabled && mode === 'live'} onClick={onClick}
            style={primaryBtnStyle(T, disabled && mode === 'live', { marginTop: 8 })}>
            {label || 'Continuar'}
        </button>
    );
}

function inputStyle(T) {
    return {
        width: '100%', padding: '15px 16px', borderRadius: Math.min(T.radius, 14), border: `1.5px solid ${T.border}`,
        background: T.inputBg, color: T.text, fontSize: 16, fontFamily: 'inherit',
    };
}

function Placeholder({ T, icon, label, height = 160 }) {
    return (
        <div style={{ height, borderRadius: T.radius, background: `rgba(${T.rgb},.06)`, border: `1.5px dashed rgba(${T.rgb},.25)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: T.textMuted, fontSize: 13 }}>
            <span style={{ fontSize: 26 }}>{icon}</span>{label}
        </div>
    );
}

function embedUrl(url) {
    if (!url) return '';
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`;
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
    return url;
}

// ── Options (choice / single-choice / image-select / yes-no / statement / video-response) ──
function OptionsBlock({ block, T, ctx }) {
    const opts = getOptions(block);
    const multi = isMultiSelect(block);
    const layout = block.type === 'image-select' ? (block.optionLayout || 'image-text')
        : block.type === 'single-choice' ? 'list'
            : block.type === 'yes-no' ? 'horizontal'
                : block.type === 'statement' ? 'grid' : (block.optionLayout || 'list');
    const selected = ctx.answer?.ids || [];
    const [otherText, setOtherText] = useState(ctx.answer?.other || '');
    const showIndicator = block.type === 'single-choice' || multi || block.showIndicator;
    const letters = !!block.showLetters;

    const pick = (opt) => {
        if (ctx.mode !== 'live') return;
        if (navigator.vibrate) try { navigator.vibrate(8); } catch { /* ignore */ }
        if (multi) {
            let ids = selected.includes(opt.id) ? selected.filter(x => x !== opt.id) : [...selected, opt.id];
            if (opt.exclusive && !selected.includes(opt.id)) ids = [opt.id];
            else if (!opt.exclusive) ids = ids.filter(id => !opts.find(o => o.id === id)?.exclusive);
            const max = Number(block.maxSelect) || 0;
            if (max && ids.length > max) return;
            ctx.setAnswer(choiceAnswer(block, ids, otherText));
            return;
        }
        ctx.setAnswer(choiceAnswer(block, [opt.id], otherText));
        if (ctx.autoAdvance && !opt.isOther) {
            setTimeout(() => ctx.act(optionAction(opt) || { type: 'next' }), 380);
        }
    };

    const editOpt = (i, patch) => {
        const list = [...(block.options || [])];
        list[i] = { ...(typeof list[i] === 'string' ? { text: list[i] } : list[i]), ...patch };
        ctx.onEdit({ options: list });
    };

    const cols = layout === 'grid' || layout === 'image-text' ? 2 : layout === 'horizontal' ? Math.min(opts.length, 4) || 1 : 1;
    const isCard = layout === 'grid' || layout === 'image-text' || layout === 'horizontal';

    return (
        <div>
            {block.type === 'statement' && block.quote && (
                <div style={{ padding: 16, borderRadius: T.radius, borderLeft: `4px solid ${T.primary}`, background: `rgba(${T.rgb},.05)`, marginBottom: 16, fontStyle: 'italic', color: T.textSec, fontSize: 15, lineHeight: 1.5 }}>
                    “{interpolate(block.quote, ctx.vars)}”
                </div>
            )}
            {block.type === 'video-response' && (
                <div style={{ marginBottom: 14 }}>
                    {block.videoUrl ? (
                        <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: T.radius, overflow: 'hidden', background: '#000' }}>
                            <iframe src={embedUrl(block.videoUrl)} title="video" allow="autoplay; encrypted-media" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, pointerEvents: ctx.mode === 'live' ? 'auto' : 'none' }} />
                        </div>
                    ) : <Placeholder T={T} icon="🎬" label="Cole o link do vídeo" height={180} />}
                </div>
            )}
            <QuestionHeader block={block} T={T} ctx={ctx} />
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 10 }}>
                {opts.map((opt, i) => {
                    const sel = selected.includes(opt.id);
                    const img = opt.image && /^(data:|https?:|\/)/.test(opt.image) ? opt.image : '';
                    const emojiOrIcon = !img && (opt.emoji || (opt.image && !img ? opt.image : ''));
                    const border = sel ? T.primary : T.border;
                    const bg = sel ? `rgba(${T.rgb},.08)` : T.card;
                    const indicator = showIndicator && (
                        <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: multi ? 6 : '50%', border: `2px solid ${sel ? T.primary : T.border}`, background: sel ? T.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
                            {sel && <Check size={14} color={T.onPrimary} strokeWidth={3} className="qv-check" />}
                        </span>
                    );
                    const label = (
                        <Editable value={opt.text} onChange={v => editOpt(i, { text: v })} editable={ctx.editable && block.type !== 'yes-no'} vars={ctx.vars} mode={ctx.mode}
                            placeholder={`Opção ${i + 1}`} as="span"
                            style={{ fontSize: isCard ? 15 : 16, fontWeight: 600, color: T.text, lineHeight: 1.35 }} />
                    );
                    if (layout === 'image-text') {
                        return (
                            <div key={opt.id} className={`qv-opt ${sel ? 'qv-sel' : ''}`} onClick={() => pick(opt)}
                                style={{ borderRadius: T.radius, border: `2px solid ${border}`, background: bg, overflow: 'hidden', cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                {img ? <img src={img} alt="" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }} />
                                    : <div style={{ aspectRatio: '4 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, background: `linear-gradient(135deg, rgba(${T.rgb},.10), rgba(${T.rgb},.03))` }}>{emojiOrIcon || '🖼️'}</div>}
                                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                                    {label}{indicator}
                                </div>
                            </div>
                        );
                    }
                    if (isCard) {
                        return (
                            <div key={opt.id} className={`qv-opt ${sel ? 'qv-sel' : ''}`} onClick={() => pick(opt)}
                                style={{ borderRadius: T.radius, border: `2px solid ${border}`, background: bg, padding: '18px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', minHeight: layout === 'grid' ? 110 : 90, position: 'relative' }}>
                                {img ? <img src={img} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 12 }} /> : emojiOrIcon ? <span style={{ fontSize: 34, lineHeight: 1 }}>{emojiOrIcon}</span> : null}
                                {label}
                                {showIndicator && <span style={{ position: 'absolute', top: 8, right: 8 }}>{indicator}</span>}
                            </div>
                        );
                    }
                    return (
                        <div key={opt.id} className={`qv-opt ${sel ? 'qv-sel' : ''}`} onClick={() => pick(opt)}
                            style={{ borderRadius: T.radius, border: `2px solid ${border}`, background: bg, padding: layout === 'icon-text' ? '12px 14px' : '15px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                            {letters && <span style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 7, border: `1.5px solid ${sel ? T.primary : T.border}`, background: sel ? T.primary : 'transparent', color: sel ? T.onPrimary : T.textSec, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{String.fromCharCode(65 + i)}</span>}
                            {img ? <img src={img} alt="" style={{ width: layout === 'icon-text' ? 48 : 40, height: layout === 'icon-text' ? 48 : 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                                : emojiOrIcon ? <span style={{ fontSize: layout === 'icon-text' ? 28 : 22, width: layout === 'icon-text' ? 48 : 'auto', height: layout === 'icon-text' ? 48 : 'auto', borderRadius: 12, background: layout === 'icon-text' ? `rgba(${T.rgb},.08)` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{emojiOrIcon}</span> : null}
                            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                {label}
                                {opt.desc && <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>{interpolate(opt.desc, ctx.vars)}</div>}
                            </div>
                            {indicator}
                        </div>
                    );
                })}
            </div>
            {opts.some(o => o.isOther && selected.includes(o.id)) && (
                <input className="qv-input" autoFocus value={otherText} placeholder="Qual?"
                    onChange={e => { setOtherText(e.target.value); ctx.setAnswer(choiceAnswer(block, selected, e.target.value)); }}
                    style={{ ...inputStyle(T), marginTop: 10 }} />
            )}
            {multi && (block.minSelect || block.maxSelect) ? (
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8, textAlign: 'center' }}>
                    {block.minSelect && block.maxSelect ? `Escolha de ${block.minSelect} a ${block.maxSelect}` : block.minSelect ? `Escolha pelo menos ${block.minSelect}` : `Escolha até ${block.maxSelect}`}
                </div>
            ) : null}
        </div>
    );
}

// ── Rating (stars / hearts / emojis) ──
const RATING_EMOJIS = ['😡', '😕', '😐', '🙂', '😍'];
function RatingBlock({ block, T, ctx }) {
    const max = Math.min(Math.max(Number(block.max) || 5, 3), 10);
    const value = ctx.answer?.value || 0;
    const [hover, setHover] = useState(0);
    const shown = hover || value;
    const icon = block.icon || 'star';
    const set = (v) => {
        if (ctx.mode !== 'live') return;
        ctx.setAnswer(valueAnswer(v, `/ ${max}`));
        if (ctx.autoAdvance) setTimeout(() => ctx.act({ type: 'next' }), 420);
    };
    return (
        <div>
            <QuestionHeader block={block} T={T} ctx={ctx} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: icon === 'emoji' ? 10 : 6 }} onMouseLeave={() => setHover(0)}>
                {Array.from({ length: icon === 'emoji' ? 5 : max }, (_, i) => i + 1).map(n => {
                    const on = n <= shown;
                    if (icon === 'emoji') {
                        return (
                            <button key={n} type="button" className="qv-star" onClick={() => set(n)} onMouseEnter={() => ctx.mode === 'live' && setHover(n)}
                                style={{ fontSize: 34, background: value === n ? `rgba(${T.rgb},.12)` : 'none', border: 'none', borderRadius: 14, padding: 6, cursor: 'pointer', filter: shown && n !== shown ? 'grayscale(.8) opacity(.55)' : 'none' }}>
                                {RATING_EMOJIS[n - 1]}
                            </button>
                        );
                    }
                    const Icon = icon === 'heart' ? Heart : Star;
                    const color = icon === 'heart' ? '#ef4444' : '#f59e0b';
                    return (
                        <button key={n} type="button" className="qv-star" onClick={() => set(n)} onMouseEnter={() => ctx.mode === 'live' && setHover(n)}
                            style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer' }}>
                            <Icon size={max > 7 ? 26 : 38} color={on ? color : T.border} fill={on ? color : 'transparent'} strokeWidth={1.6} />
                        </button>
                    );
                })}
            </div>
            {(block.minLabel || block.maxLabel) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: T.textMuted }}>
                    <span>{block.minLabel}</span><span>{block.maxLabel}</span>
                </div>
            )}
        </div>
    );
}

// ── NPS 0-10 ──
function npsColor(n) { return n <= 6 ? '#ef4444' : n <= 8 ? '#f59e0b' : '#10b981'; }
function NpsBlock({ block, T, ctx }) {
    const value = ctx.answer?.value;
    const set = (n) => {
        if (ctx.mode !== 'live') return;
        ctx.setAnswer(valueAnswer(n));
        if (ctx.autoAdvance) setTimeout(() => ctx.act({ type: 'next' }), 420);
    };
    return (
        <div>
            <QuestionHeader block={block} T={T} ctx={ctx} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, minmax(0, 1fr))', gap: 4 }}>
                {Array.from({ length: 11 }, (_, n) => {
                    const sel = value === n;
                    const c = block.colored ? npsColor(n) : T.primary;
                    return (
                        <button key={n} type="button" className="qv-nps" onClick={() => set(n)}
                            style={{ aspectRatio: '1 / 1.25', borderRadius: 8, border: `1.5px solid ${sel ? c : T.border}`, background: sel ? c : T.card, color: sel ? '#fff' : T.text, fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                            {n}
                        </button>
                    );
                })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: T.textMuted }}>
                <span>{block.minLabel || 'Nada provável'}</span><span>{block.maxLabel || 'Muito provável'}</span>
            </div>
        </div>
    );
}

// ── Slider ──
function SliderBlock({ block, T, ctx }) {
    const min = Number(block.min ?? 0), max = Number(block.max ?? 10), step = Number(block.step) || 1;
    const def = block.defaultValue ?? Math.round((min + max) / 2);
    const value = ctx.answer?.value ?? def;
    const { setAnswer, mode } = ctx;
    useEffect(() => {
        if (mode === 'live' && ctx.answer === undefined) setAnswer(valueAnswer(def, block.unit));
    }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
    const pct = max > min ? ((value - min) / (max - min)) * 100 : 50;
    return (
        <div>
            <QuestionHeader block={block} T={T} ctx={ctx} />
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 44, fontWeight: 800, color: T.primary, letterSpacing: '-0.02em' }}>{value}</span>
                {block.unit && <span style={{ fontSize: 18, fontWeight: 700, color: T.textSec, marginLeft: 4 }}>{block.unit}</span>}
            </div>
            <input type="range" className="qv-range" min={min} max={max} step={step} value={value}
                onChange={e => mode === 'live' && setAnswer(valueAnswer(Number(e.target.value), block.unit))}
                style={{ background: `linear-gradient(to right, ${T.primary} ${pct}%, ${T.border} ${pct}%)` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: T.textMuted }}>
                <span>{block.minLabel || `${min}${block.unit ? ` ${block.unit}` : ''}`}</span>
                <span>{block.maxLabel || `${max}${block.unit ? ` ${block.unit}` : ''}`}</span>
            </div>
        </div>
    );
}

// ── Single inputs ──
function InputBlock({ block, T, ctx }) {
    const [touched, setTouched] = useState(false);
    const value = ctx.answer?.value ?? '';
    const type = block.type === 'email-input' ? 'email' : block.type === 'phone-input' ? 'tel' : block.type === 'date-input' ? 'date' : 'text';
    const set = (v) => {
        if (ctx.mode !== 'live') return;
        const val = block.type === 'phone-input' ? formatPhone(v) : v;
        ctx.setAnswer(valueAnswer(val));
    };
    const invalid = touched && value && !isAnswerValid(block, ctx.answer);
    const common = {
        className: 'qv-input', value, placeholder: block.placeholder || '', readOnly: ctx.mode !== 'live',
        onChange: e => set(e.target.value), onBlur: () => setTouched(true),
        onKeyDown: e => { if (e.key === 'Enter' && block.type !== 'textarea-input' && ctx.onSubmit) ctx.onSubmit(); },
        style: { ...inputStyle(T), borderColor: invalid ? '#ef4444' : T.border, pointerEvents: ctx.mode === 'live' ? 'auto' : 'none' },
    };
    return (
        <div>
            <Editable as="label" value={block.text} onChange={v => ctx.onEdit({ text: v })} editable={ctx.editable} vars={ctx.vars} mode={ctx.mode}
                placeholder="Rótulo do campo" style={{ display: 'block', fontSize: block.fontSize || 18, fontWeight: 700, color: T.text, marginBottom: 12, textAlign: block.align || T.align, lineHeight: 1.3 }} />
            {block.type === 'textarea-input'
                ? <textarea {...common} rows={4} maxLength={block.maxLength || 1000} style={{ ...common.style, resize: 'vertical', minHeight: 110 }} />
                : <input {...common} type={type} inputMode={type === 'tel' ? 'tel' : type === 'email' ? 'email' : undefined} autoComplete={type === 'email' ? 'email' : type === 'tel' ? 'tel' : block.varName === 'nome' ? 'given-name' : 'on'} />}
            {invalid && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>{block.type === 'email-input' ? 'Digite um e-mail válido' : block.type === 'phone-input' ? 'Digite um telefone com DDD' : 'Campo inválido'}</div>}
        </div>
    );
}

// ── Lead capture form ──
function CaptureBlock({ block, T, ctx }) {
    const fields = block.fields?.length ? block.fields : ['name', 'email'];
    const [form, setForm] = useState(ctx.answer?.value || {});
    const [tried, setTried] = useState(false);
    const [consent, setConsent] = useState(false);
    const meta = { name: { label: 'Nome', ph: 'Seu nome', type: 'text', ac: 'name' }, email: { label: 'E-mail', ph: 'seu@email.com', type: 'email', ac: 'email' }, phone: { label: 'WhatsApp', ph: '(11) 99999-9999', type: 'tel', ac: 'tel' } };
    const errors = {
        name: !String(form.name || '').trim(),
        email: !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(form.email || '').trim()),
        phone: String(form.phone || '').replace(/\D/g, '').length < 10,
    };
    const ok = fields.every(f => !errors[f]) && (!block.consentText || consent);
    const submit = () => {
        if (ctx.mode !== 'live') return;
        setTried(true);
        if (!ok) return;
        const text = fields.map(f => form[f]).filter(Boolean).join(' · ');
        ctx.setAnswer({ value: form, text });
        ctx.onLead?.({ name: form.name, email: form.email, phone: form.phone });
        ctx.act(block.action || { type: 'next' });
    };
    return (
        <div style={{ textAlign: block.align || T.align }}>
            <Editable as="h2" value={block.title} onChange={v => ctx.onEdit({ title: v })} editable={ctx.editable} vars={ctx.vars} mode={ctx.mode}
                placeholder="Título" multiline style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: '0 0 6px', lineHeight: 1.3 }} />
            <Editable as="p" value={block.subtitle} onChange={v => ctx.onEdit({ subtitle: v })} editable={ctx.editable} vars={ctx.vars} mode={ctx.mode}
                placeholder="Subtítulo" multiline style={{ fontSize: 15, color: T.textSec, margin: '0 0 18px', lineHeight: 1.5 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
                {fields.map(f => (
                    <div key={f}>
                        <input className="qv-input" type={meta[f]?.type} autoComplete={meta[f]?.ac} placeholder={meta[f]?.ph} readOnly={ctx.mode !== 'live'}
                            value={form[f] || ''} onChange={e => setForm(s => ({ ...s, [f]: f === 'phone' ? formatPhone(e.target.value) : e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && submit()}
                            style={{ ...inputStyle(T), borderColor: tried && errors[f] ? '#ef4444' : T.border, pointerEvents: ctx.mode === 'live' ? 'auto' : 'none' }} />
                        {tried && errors[f] && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{f === 'email' ? 'E-mail inválido' : f === 'phone' ? 'Informe o WhatsApp com DDD' : 'Informe seu nome'}</div>}
                    </div>
                ))}
                {block.consentText && (
                    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: T.textSec, cursor: 'pointer', lineHeight: 1.4 }}>
                        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 2, accentColor: T.primary }} />
                        {block.consentText}
                    </label>
                )}
            </div>
            <button type="button" className="qv-btn" onClick={submit} style={primaryBtnStyle(T, false, { marginTop: 14 })}>
                <Editable as="span" value={block.buttonText} onChange={v => ctx.onEdit({ buttonText: v })} editable={ctx.editable} vars={ctx.vars} mode={ctx.mode} placeholder="Continuar" />
            </button>
            <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 10 }}>🔒 Seus dados estão seguros</div>
        </div>
    );
}

// ── Timer (inline countdown) ──
function TimerView({ block, T, ctx }) {
    const total = Number(block.duration) || 300;
    const [left, setLeft] = useState(total);
    const { mode, act } = ctx;
    useEffect(() => {
        if (mode !== 'live') return undefined;
        if (left <= 0) {
            if (block.autoAdvance) act({ type: 'next' });
            return undefined;
        }
        const t = setTimeout(() => setLeft(l => l - 1), 1000);
        return () => clearTimeout(t);
    }, [left, mode]); // eslint-disable-line react-hooks/exhaustive-deps
    const shown = mode === 'live' ? left : total;
    const mm = String(Math.floor(shown / 60)).padStart(2, '0');
    const ss = String(shown % 60).padStart(2, '0');
    const fmt = block.timerFormat || 'digital';
    const title = <div style={{ fontSize: 14, color: T.textSec, marginBottom: 10, fontWeight: 600 }}>{interpolate(block.title, ctx.vars)}</div>;
    if (fmt === 'progress') {
        return (
            <div>
                {title}
                <div style={{ height: 10, background: `rgba(${T.rgb},.12)`, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(shown / total) * 100}%`, background: T.primary, borderRadius: 99, transition: 'width 1s linear' }} />
                </div>
                <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 700, color: T.primary, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</div>
            </div>
        );
    }
    if (fmt === 'circular') {
        const r = 44, c = 2 * Math.PI * r;
        return (
            <div style={{ textAlign: 'center' }}>
                {title}
                <svg width="112" height="112" viewBox="0 0 112 112">
                    <circle cx="56" cy="56" r={r} fill="none" stroke={`rgba(${T.rgb},.14)`} strokeWidth="8" />
                    <circle cx="56" cy="56" r={r} fill="none" stroke={T.primary} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown / total)} transform="rotate(-90 56 56)" style={{ transition: 'stroke-dashoffset 1s linear' }} />
                    <text x="56" y="62" textAnchor="middle" fontSize="22" fontWeight="800" fill={T.primary} style={{ fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</text>
                </svg>
            </div>
        );
    }
    return (
        <div style={{ textAlign: 'center' }}>
            {title}
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                {[[mm, 'min'], [ss, 'seg']].map(([v, l], i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ minWidth: 66, padding: '10px 8px', borderRadius: 14, background: `rgba(${T.rgb},.08)`, border: `2px solid ${T.primary}`, fontSize: 30, fontWeight: 800, color: T.primary, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                        <span style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{l}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Score-based outcome ──
function OutcomeBlock({ block, T, ctx }) {
    const score = ctx.mode === 'live' ? computeScore(ctx.steps, ctx.answers) : null;
    const outcomes = block.outcomes || [];
    const previewIdx = Math.min(block._previewIdx || 0, Math.max(outcomes.length - 1, 0));
    const o = ctx.mode === 'live' ? pickOutcome(block, score) : outcomes[previewIdx];
    if (!o) return <Placeholder T={T} icon="🏆" label="Adicione resultados no painel" />;
    const cta = () => {
        if (ctx.mode !== 'live') return;
        ctx.act(o.ctaUrl ? { type: 'url', url: o.ctaUrl, newTab: false } : { type: 'next' });
    };
    return (
        <div style={{ textAlign: 'center' }}>
            {block.title && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, background: `rgba(${T.rgb},.08)`, color: T.primary, fontWeight: 700, fontSize: 13, marginBottom: 14 }}>✅ {interpolate(block.title, ctx.vars)}</div>}
            {o.image ? <img src={o.image} alt="" style={{ width: '100%', borderRadius: T.radius, marginBottom: 14, maxHeight: 220, objectFit: 'cover' }} />
                : o.emoji ? <div style={{ fontSize: 60, marginBottom: 8 }}>{o.emoji}</div> : null}
            <h2 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: '0 0 10px', letterSpacing: '-0.02em' }}>{interpolate(o.title, ctx.vars)}</h2>
            <p style={{ fontSize: 15.5, color: T.textSec, lineHeight: 1.6, margin: '0 0 18px', whiteSpace: 'pre-wrap' }}>{interpolate(o.text, ctx.vars)}</p>
            {o.ctaText && <button type="button" className="qv-btn qv-anim-glow" onClick={cta} style={primaryBtnStyle(T, false)}>{interpolate(o.ctaText, ctx.vars)}</button>}
            {ctx.mode === 'edit' && outcomes.length > 1 && (
                <div style={{ marginTop: 10, fontSize: 11, color: T.textMuted }}>Prévia: resultado {previewIdx + 1} de {outcomes.length} ({o.min}–{o.max === '' || o.max === undefined ? '∞' : o.max} pts)</div>
            )}
        </div>
    );
}

// ── HTML block (runs scripts in the live quiz) ──
function HtmlBlock({ block, ctx }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ctx.mode !== 'live' || !ref.current) return;
        ref.current.querySelectorAll('script').forEach(old => {
            const s = document.createElement('script');
            [...old.attributes].forEach(a => s.setAttribute(a.name, a.value));
            s.textContent = old.textContent;
            old.replaceWith(s);
        });
    }, [block.code, ctx.mode]);
    if (ctx.mode === 'edit' && !/<(?!script|!--)[a-z]/i.test(block.code || '')) {
        return <div style={{ padding: 14, borderRadius: 10, background: '#0f172a', color: '#94a3b8', fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'hidden' }}>{block.code || '</> HTML personalizado'}</div>;
    }
    return <div ref={ref} className="qv-html" dangerouslySetInnerHTML={{ __html: block.code || '' }} />;
}

// ── Embed code (Vturb, Panda, any player snippet) — scripts run in both modes ──
function EmbedHtml({ html }) {
    const ref = useRef(null);
    useEffect(() => {
        if (!ref.current) return;
        ref.current.innerHTML = html || '';
        ref.current.querySelectorAll('script').forEach(old => {
            const sc = document.createElement('script');
            [...old.attributes].forEach(a => sc.setAttribute(a.name, a.value));
            sc.textContent = old.textContent;
            old.replaceWith(sc);
        });
    }, [html]);
    return <div ref={ref} style={{ width: '100%' }} />;
}

// ── Lottie animation (web component loaded on demand) ──
let lottieLoading = null;
function ensureLottie() {
    if (typeof window === 'undefined' || window.customElements?.get('lottie-player')) return Promise.resolve();
    if (!lottieLoading) {
        lottieLoading = new Promise(resolve => {
            const sc = document.createElement('script');
            sc.src = 'https://cdn.jsdelivr.net/npm/@lottiefiles/lottie-player@2.0.8/dist/lottie-player.js';
            sc.onload = resolve; sc.onerror = resolve;
            document.head.appendChild(sc);
        });
    }
    return lottieLoading;
}
function LottieView({ block, T }) {
    const [ready, setReady] = useState(typeof window !== 'undefined' && !!window.customElements?.get('lottie-player'));
    useEffect(() => { if (!ready) ensureLottie().then(() => setReady(true)); }, [ready]);
    if (!block.src) return <Placeholder T={T} icon="✨" label="Cole a URL da animação Lottie (.json)" height={block.height || 200} />;
    const h = block.height || 220;
    return (
        <div style={{ display: 'flex', justifyContent: 'center' }}
            dangerouslySetInnerHTML={{ __html: ready ? `<lottie-player src="${String(block.src).replace(/"/g, '&quot;')}" background="transparent" speed="1" style="width:100%;max-width:420px;height:${h}px" ${block.loop === false ? '' : 'loop'} autoplay></lottie-player>` : `<div style="height:${h}px"></div>` }} />
    );
}

// ── Projection chart: current value → goal, animated ──
function ProjectionChart({ block, T, ctx }) {
    const live = ctx.mode === 'live';
    const num = (v, fb) => { const n = parseFloat(String(interpolate(String(v ?? ''), ctx.vars) || '').replace(',', '.')); return Number.isFinite(n) ? n : fb; };
    const from = live ? num(block.from, 80) : num(block.from, NaN) || 80;
    const to = live ? num(block.to, 68) : num(block.to, NaN) || 68;
    const unit = block.unit || '';
    const endLabel = interpolate(block.endLabel || 'Meta', ctx.vars) || 'Meta';
    const startLabel = interpolate(block.startLabel || 'Hoje', ctx.vars);
    const W = 320, H = 170, pad = 24;
    const hi = Math.max(from, to), lo = Math.min(from, to);
    const span = Math.max(hi - lo, 1);
    const y = (v) => pad + (1 - (v - lo) / span) * (H - pad * 2 - 10) + 5;
    const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => { const e = 1 - Math.pow(1 - t, 1.6); return { x: pad + t * (W - pad * 2), y: y(from + (to - from) * e) }; });
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], c = pts[i]; const cx = (p.x + c.x) / 2; d += ` C ${cx} ${p.y} ${cx} ${c.y} ${c.x} ${c.y}`; }
    const area = `${d} L ${pts[pts.length - 1].x} ${H - 8} L ${pts[0].x} ${H - 8} Z`;
    const good = block.color || '#10b981', bad = block.startColor || '#ef4444';
    const gid = `pg_${block.id}`;
    const fmt = (v) => `${Math.round(v * 10) / 10}`.replace('.', ',');
    return (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '16px 12px 10px' }}>
            {block.title && <div style={{ fontWeight: 800, fontSize: 17, color: T.text, textAlign: 'center', marginBottom: 8 }}>{interpolate(block.title, ctx.vars)}</div>}
            <svg viewBox={`0 0 ${W} ${H + 24}`} style={{ width: '100%', display: 'block', overflow: 'visible' }}>
                <defs>
                    <linearGradient id={`${gid}_l`} x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor={bad} /><stop offset="100%" stopColor={good} /></linearGradient>
                    <linearGradient id={`${gid}_a`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={good} stopOpacity=".22" /><stop offset="100%" stopColor={good} stopOpacity="0" /></linearGradient>
                </defs>
                {[0.25, 0.5, 0.75].map(f => <line key={f} x1={pad} x2={W - pad} y1={pad + f * (H - pad * 2)} y2={pad + f * (H - pad * 2)} stroke={T.border} strokeDasharray="3 4" />)}
                <path d={area} fill={`url(#${gid}_a)`} style={live ? { animation: 'qv-fade 1.2s ease .6s both' } : undefined} />
                <path d={d} fill="none" stroke={`url(#${gid}_l)`} strokeWidth="4" strokeLinecap="round" pathLength="1"
                    style={live ? { strokeDasharray: 1, strokeDashoffset: 1, animation: 'qv-draw 1.6s ease forwards' } : undefined} />
                <circle cx={pts[0].x} cy={pts[0].y} r="6" fill="#fff" stroke={bad} strokeWidth="3" />
                <circle cx={pts[4].x} cy={pts[4].y} r="7" fill={good} stroke="#fff" strokeWidth="3" style={live ? { animation: 'qv-zoom .4s ease 1.5s both' } : undefined} />
                <g style={live ? { animation: 'qv-fade .4s ease .2s both' } : undefined}>
                    <rect x={pts[0].x - 4} y={pts[0].y - 34} rx="8" width="64" height="24" fill={bad} />
                    <text x={pts[0].x + 28} y={pts[0].y - 17} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">{fmt(from)} {unit}</text>
                </g>
                <g style={live ? { animation: 'qv-fade .4s ease 1.6s both' } : undefined}>
                    <rect x={pts[4].x - 60} y={pts[4].y - 38} rx="8" width="64" height="24" fill={good} />
                    <text x={pts[4].x - 28} y={pts[4].y - 21} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">{fmt(to)} {unit}</text>
                    {block.badge && <text x={pts[4].x - 28} y={pts[4].y - 44} textAnchor="middle" fill={good} fontSize="11" fontWeight="800">{interpolate(block.badge, ctx.vars)}</text>}
                </g>
                <text x={pad} y={H + 18} fill={T.textMuted} fontSize="12" fontWeight="600">{startLabel}</text>
                <text x={W - pad} y={H + 18} textAnchor="end" fill={T.textMuted} fontSize="12" fontWeight="600">{endLabel}</text>
            </svg>
            {!live && <div style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', marginTop: 4 }}>Prévia com valores de exemplo — no quiz usa as respostas da pessoa</div>}
        </div>
    );
}

// ═══ Main renderer ═══
export default function BlockView({ block, T, ctx }) {
    if (!block) return null;
    const ed = ctx.editable;
    const vars = ctx.vars;
    const mode = ctx.mode;
    const edit = ctx.onEdit || noop;

    switch (block.type) {
        case 'choice':
        case 'single-choice':
        case 'image-select':
        case 'yes-no':
        case 'statement':
        case 'video-response':
            return <OptionsBlock block={block} T={T} ctx={ctx} />;

        case 'likert': {
            const opts = getOptions(block);
            return <OptionsBlock block={{ ...block, type: 'choice', optionLayout: opts.length > 4 ? 'list' : 'horizontal' }} T={T} ctx={ctx} />;
        }

        case 'rating': return <RatingBlock block={block} T={T} ctx={ctx} />;
        case 'nps': return <NpsBlock block={block} T={T} ctx={ctx} />;
        case 'slider': return <SliderBlock block={block} T={T} ctx={ctx} />;

        case 'text-input':
        case 'email-input':
        case 'phone-input':
        case 'textarea-input':
        case 'date-input':
            return <InputBlock block={block} T={T} ctx={ctx} />;

        case 'capture': return <CaptureBlock block={block} T={T} ctx={ctx} />;

        case 'number-input':
            return <NumberInputBlock key={mode} page={{ ...block, text: interpolate(block.text, vars) }} T={T} onDone={mode === 'live' ? (v => { ctx.setAnswer(valueAnswer(v, block.unit)); ctx.act({ type: 'next' }); }) : noop} />;
        case 'scroll-picker':
        case 'weight-picker':
            return <ScrollPickerBlock key={mode} page={{ ...block, text: interpolate(block.text, vars), visualStyle: block.visualStyle || (block.type === 'weight-picker' ? 'ruler' : block.visualStyle) }} T={T} onDone={mode === 'live' ? (v => { ctx.setAnswer(valueAnswer(v, block.unit)); ctx.act({ type: 'next' }); }) : noop} />;

        case 'text': {
            const v = block.variant || 'body';
            const size = v === 'headline' ? 28 : v === 'subheadline' ? 20 : v === 'caption' ? 13 : 16;
            const weight = v === 'headline' ? 800 : v === 'subheadline' ? 700 : block.bold ? 700 : 400;
            return (
                <div>
                    {block.imageUrl && <img src={block.imageUrl} alt="" style={{ width: '100%', borderRadius: T.radius, marginBottom: 12, maxHeight: 220, objectFit: 'cover' }} />}
                    <Editable value={block.content} onChange={val => edit({ content: val })} editable={ed} vars={vars} mode={mode} multiline
                        placeholder={v === 'headline' ? 'Título' : 'Escreva seu texto…'}
                        style={{
                            fontSize: block.fontSizePx || size, fontWeight: weight, lineHeight: v === 'headline' ? 1.2 : 1.6, letterSpacing: v === 'headline' ? '-0.02em' : 0,
                            color: block.textColor || (v === 'caption' ? T.textMuted : v === 'body' ? T.textSec : T.text),
                            textAlign: block.align || T.align, fontStyle: block.italic ? 'italic' : 'normal',
                            textDecoration: block.underline ? 'underline' : 'none', whiteSpace: 'pre-wrap', margin: 0,
                        }} />
                </div>
            );
        }

        case 'image':
            return (
                <div style={{ textAlign: 'center' }}>
                    {block.imageUrl
                        ? <img src={block.imageUrl} alt={block.alt || ''} style={{ width: '100%', borderRadius: block.rounded !== false ? T.radius : 0, maxHeight: block.height || 'none', objectFit: 'cover', display: 'block' }} />
                        : <Placeholder T={T} icon="🖼️" label="Envie uma imagem no painel" />}
                    {block.caption && <p style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>{interpolate(block.caption, vars)}</p>}
                </div>
            );

        case 'video':
            if (block.embedHtml) return <EmbedHtml html={block.embedHtml} />;
            return block.videoUrl ? (
                <div>
                    <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: T.radius, overflow: 'hidden', background: '#000' }}>
                        {/\.(mp4|webm|mov)(\?|$)/i.test(block.videoUrl)
                            ? <video src={block.videoUrl} controls playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                            : <iframe src={embedUrl(block.videoUrl)} title="video" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, pointerEvents: mode === 'live' ? 'auto' : 'none' }} />}
                    </div>
                    {block.caption && <p style={{ fontSize: 13, color: T.textMuted, marginTop: 8, textAlign: 'center' }}>{interpolate(block.caption, vars)}</p>}
                </div>
            ) : <Placeholder T={T} icon={<Play size={26} />} label="Cole o link do YouTube ou Vturb" height={190} />;

        case 'audio':
            return (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, borderRadius: 18, background: T.isDark ? 'rgba(255,255,255,.06)' : '#f0fdf4', border: `1px solid ${T.isDark ? T.border : '#dcfce7'}` }}>
                    {block.imageUrl ? <img src={block.imageUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                        : <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#25d366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{(block.senderName || 'A')[0]}</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {block.senderName && <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>{block.senderName}</div>}
                        {block.audioUrl ? <audio src={block.audioUrl} controls style={{ width: '100%', height: 34 }} />
                            : <div style={{ height: 30, borderRadius: 99, background: 'repeating-linear-gradient(90deg, #86efac 0 3px, transparent 3px 6px)', opacity: 0.8 }} />}
                    </div>
                </div>
            );

        case 'button': {
            const anim = block.animation && block.animation !== 'none' ? `qv-anim-${block.animation}` : '';
            const style = block.style || 'primary';
            const s = style === 'outline'
                ? { ...primaryBtnStyle(T, false), background: 'transparent', color: T.primary, border: `2px solid ${T.primary}`, boxShadow: 'none' }
                : style === 'ghost' ? { ...primaryBtnStyle(T, false), background: `rgba(${T.rgb},.08)`, color: T.primary, boxShadow: 'none' }
                    : { ...primaryBtnStyle(T, false), ...(block.buttonColor ? { background: block.buttonColor } : {}), ...(block.buttonTextColor ? { color: block.buttonTextColor } : {}) };
            const size = block.size === 'sm' ? { padding: '11px 18px', fontSize: 14, width: 'auto' } : block.size === 'md' ? { padding: '14px 28px', width: 'auto' } : {};
            return (
                <div style={{ textAlign: 'center' }}>
                    <button type="button" className={`qv-btn ${anim}`} style={{ ...s, ...size }} onClick={() => mode === 'live' && ctx.act(buttonAction(block))}>
                        <Editable as="span" value={block.text} onChange={v => edit({ text: v })} editable={ed} vars={vars} mode={mode} placeholder="Continuar" />
                    </button>
                    {block.subtext && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>{interpolate(block.subtext, vars)}</div>}
                </div>
            );
        }

        case 'welcome': {
            const img = block.imageUrl && <img src={block.imageUrl} alt="" style={{ width: `${block.imageWidth || 100}%`, maxHeight: block.imageHeightPx || 240, objectFit: 'cover', borderRadius: T.radius, margin: '0 auto', display: 'block' }} />;
            return (
                <div style={{ textAlign: block.textAlign || 'center', display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
                    {block.imagePosition !== 'center' && block.imagePosition !== 'bottom' && img}
                    {block.emoji && <div style={{ fontSize: 54, lineHeight: 1 }}>{block.emoji}</div>}
                    <Editable as="h1" value={block.headline} onChange={v => edit({ headline: v })} editable={ed} vars={vars} mode={mode} multiline
                        placeholder="Título da capa" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', color: T.text, margin: 0 }} />
                    {(block.subtitle || ed) && <Editable as="p" value={block.subtitle} onChange={v => edit({ subtitle: v })} editable={ed} vars={vars} mode={mode} multiline
                        placeholder="Subtítulo" style={{ fontSize: 16, lineHeight: 1.55, color: T.textSec, margin: 0 }} />}
                    {block.imagePosition === 'center' && img}
                    <button type="button" className="qv-btn qv-anim-glow" style={primaryBtnStyle(T, false, { marginTop: 8 })} onClick={() => mode === 'live' && ctx.act(block.action || { type: 'next' })}>
                        <Editable as="span" value={block.cta} onChange={v => edit({ cta: v })} editable={ed} vars={vars} mode={mode} placeholder="Começar →" />
                    </button>
                    {block.note !== '' && <div style={{ fontSize: 12.5, color: T.textMuted }}>{block.note || '⏱ Leva menos de 2 minutos'}</div>}
                    {block.imagePosition === 'bottom' && img}
                </div>
            );
        }

        case 'logo':
            return (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {block.imageUrl ? <img src={block.imageUrl} alt={block.alt || 'Logo'} style={{ maxWidth: block.maxWidth || 120, height: 'auto' }} />
                        : <div style={{ padding: '8px 18px', borderRadius: 10, border: `1.5px dashed ${T.border}`, color: T.textMuted, fontSize: 13, fontWeight: 600 }}>Sua logo</div>}
                </div>
            );

        case 'spacer': return <div style={{ height: block.height || 40 }} />;

        case 'testimonial':
            return (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 16, boxShadow: T.isDark ? 'none' : '0 2px 10px rgba(0,0,0,.04)' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                        {block.avatar ? <img src={block.avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                            : <div style={{ width: 40, height: 40, borderRadius: '50%', background: `rgba(${T.rgb},.14)`, color: T.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{(block.name || 'C')[0]}</div>}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{block.name || 'Cliente'}</div>
                            <div style={{ display: 'flex', gap: 1 }}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} color="#f59e0b" fill={i < (block.rating ?? 5) ? '#f59e0b' : 'transparent'} />)}</div>
                        </div>
                        {block.verified !== false && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Verificado</span>}
                    </div>
                    <p style={{ fontSize: 14.5, color: T.textSec, lineHeight: 1.55, margin: 0 }}>“{interpolate(block.text, vars)}”</p>
                </div>
            );

        case 'social-proof':
            return (
                <div style={{ textAlign: 'center', padding: '6px 0' }}>
                    {block.emoji && <div style={{ fontSize: 28, marginBottom: 4 }}>{block.emoji}</div>}
                    <div style={{ fontSize: 34, fontWeight: 800, color: T.primary, letterSpacing: '-0.02em' }}>{block.headline}</div>
                    <div style={{ fontSize: 14.5, color: T.textSec }}>{interpolate(block.subheadline, vars)}</div>
                </div>
            );

        case 'arguments':
            return (
                <div>
                    {block.title && <h3 style={{ fontSize: 19, fontWeight: 800, color: T.text, margin: '0 0 12px', textAlign: block.align || T.align }}>{interpolate(block.title, vars)}</h3>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(block.items || []).map((it, i) => (
                            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: Math.min(T.radius, 12), background: `rgba(${T.rgb},.05)` }}>
                                <span style={{ fontSize: 16, lineHeight: 1.4 }}>{block.emoji || '✅'}</span>
                                <span style={{ fontSize: 15, color: T.text, lineHeight: 1.45 }}>{interpolate(it, vars)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );

        case 'before-after':
            return (
                <div>
                    {block.title && <h3 style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', color: T.text, margin: '0 0 12px' }}>{interpolate(block.title, vars)}</h3>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[['beforeImage', 'beforeLabel', 'Antes', '#ef4444'], ['afterImage', 'afterLabel', 'Depois', '#10b981']].map(([imgK, lblK, def, c]) => (
                            <div key={imgK} style={{ textAlign: 'center' }}>
                                {block[imgK] ? <img src={block[imgK]} alt="" style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: T.radius }} />
                                    : <div style={{ aspectRatio: '3 / 4', borderRadius: T.radius, background: `${c}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🖼️</div>}
                                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: c, textTransform: 'uppercase', letterSpacing: '.04em' }}>{block[lblK] || def}</div>
                            </div>
                        ))}
                    </div>
                </div>
            );

        case 'carousel':
            return (
                <div>
                    {block.title && <h3 style={{ fontSize: 18, fontWeight: 800, color: T.text, margin: '0 0 10px' }}>{interpolate(block.title, vars)}</h3>}
                    <div className="qv-carousel" style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 4 }}>
                        {(block.slides || []).map((s, i) => (
                            <div key={i} style={{ minWidth: '78%', scrollSnapAlign: 'start', borderRadius: T.radius, overflow: 'hidden', border: `1px solid ${T.border}`, background: T.card }}>
                                {s.image ? <img src={s.image} alt="" style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }} />
                                    : <div style={{ aspectRatio: '16 / 10', background: `rgba(${T.rgb},.08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🖼️</div>}
                                {s.text && <div style={{ padding: '10px 12px', fontSize: 14, fontWeight: 600, color: T.text }}>{interpolate(s.text, vars)}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            );

        case 'faq':
            return (
                <div>
                    {block.title && <h3 style={{ fontSize: 18, fontWeight: 800, color: T.text, margin: '0 0 10px' }}>{interpolate(block.title, vars)}</h3>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(block.items || []).map((it, i) => (
                            <details key={i} className="qv-faq" style={{ border: `1px solid ${T.border}`, borderRadius: Math.min(T.radius, 12), background: T.card, padding: '12px 14px' }}>
                                <summary style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: 700, fontSize: 14.5, color: T.text }}>
                                    {it.q}<ChevronDown size={18} className="qv-faq-chev" style={{ flexShrink: 0, color: T.textMuted }} />
                                </summary>
                                <p style={{ margin: '8px 0 0', fontSize: 14, color: T.textSec, lineHeight: 1.55 }}>{it.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            );

        case 'price': {
            const click = () => mode === 'live' && ctx.act(block.ctaUrl ? { type: 'url', url: block.ctaUrl, newTab: false } : (block.action || { type: 'next' }));
            return (
                <div style={{ textAlign: 'center', border: `2px solid ${T.primary}`, borderRadius: T.radius + 4, padding: '20px 16px', background: T.card, position: 'relative', boxShadow: `0 10px 30px rgba(${T.rgb},.14)` }}>
                    {block.discount && <span style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', padding: '4px 14px', borderRadius: 99, background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 12.5, whiteSpace: 'nowrap' }}>{block.discount}</span>}
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.textSec, marginBottom: 6 }}>{interpolate(block.title, vars)}</div>
                    {block.originalPrice && <div style={{ fontSize: 15, color: T.textMuted, textDecoration: 'line-through' }}>de {block.originalPrice}</div>}
                    <div style={{ fontSize: 40, fontWeight: 900, color: T.text, letterSpacing: '-0.03em', margin: '2px 0 4px' }}>{block.price}</div>
                    {block.installments && <div style={{ fontSize: 13, color: T.textSec, marginBottom: 6 }}>{block.installments}</div>}
                    {(block.features || []).length > 0 && (
                        <div style={{ textAlign: 'left', margin: '12px 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {block.features.map((f, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: 14, color: T.textSec }}><Check size={16} color="#16a34a" strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} />{f}</div>)}
                        </div>
                    )}
                    <button type="button" className="qv-btn qv-anim-pulse" onClick={click} style={primaryBtnStyle(T, false, { background: block.ctaColor || '#16a34a', color: '#fff', boxShadow: '0 8px 22px rgba(22,163,74,.3)' })}>{block.cta || 'Comprar agora →'}</button>
                    <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 10 }}>🔒 Compra 100% segura · Garantia de 7 dias</div>
                </div>
            );
        }

        case 'alert': {
            const at = ALERT_TYPES.find(a => a.key === block.alertType) || ALERT_TYPES[0];
            const c = block.customColor || at.color;
            return (
                <div style={{ padding: '14px 16px', borderRadius: Math.min(T.radius, 14), background: T.isDark ? `${c}22` : `${c}12`, border: `1.5px solid ${c}40`, display: 'flex', gap: 10 }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: c, marginBottom: 2 }}>{interpolate(block.title, vars)}</div>
                        {block.text && <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.5 }}>{interpolate(block.text, vars)}</div>}
                    </div>
                </div>
            );
        }

        case 'insight':
            return (
                <div style={{ borderRadius: T.radius, padding: 18, background: `linear-gradient(135deg, rgba(${T.rgb},.08), rgba(${T.rgb},.02))`, border: `1px solid rgba(${T.rgb},.15)` }}>
                    {block.imageUrl && <img src={block.imageUrl} alt="" style={{ width: '100%', borderRadius: Math.min(T.radius, 12), marginBottom: 12, maxHeight: 180, objectFit: 'cover' }} />}
                    <div style={{ fontWeight: 800, fontSize: 17, color: T.text, marginBottom: 6 }}>💡 {interpolate(block.title, vars)}</div>
                    <div style={{ fontSize: 15, color: T.textSec, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}><RichText text={block.body} vars={vars} mode={mode} /></div>
                </div>
            );

        case 'notification':
            return (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 16, background: T.card, border: `1px solid ${T.border}`, boxShadow: '0 8px 24px rgba(0,0,0,.08)', animation: mode === 'live' ? 'qv-toast-in .5s ease both' : 'none' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: `rgba(${T.rgb},.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{block.icon || '🔔'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{interpolate(block.title, vars)}</div>
                        <div style={{ fontSize: 13, color: T.textSec }}>{interpolate(block.text, vars)}</div>
                    </div>
                    <span style={{ fontSize: 11, color: T.textMuted }}>agora</span>
                </div>
            );

        case 'timer': return <TimerView block={block} T={T} ctx={ctx} />;

        case 'loading':
            return <LoadingBlock key={mode} title={interpolate(block.title, vars)} items={block.items} T={T} onDone={mode === 'live' ? () => ctx.act({ type: 'next' }) : noop} />;
        case 'progress-bar':
            return <ProgressBarBlock key={mode} title={interpolate(block.title, vars)} items={block.items} duration={block.duration} T={T} onDone={mode === 'live' ? () => ctx.act({ type: 'next' }) : noop} />;
        case 'risk-chart':
            return <RiskChartBlock key={mode} title={interpolate(block.title, vars)} labels={block.labels} userPosition={block.userPosition} duration={block.duration} T={T} onDone={mode === 'live' ? () => ctx.act({ type: 'next' }) : noop} />;
        case 'bmi':
            return <BMIBlock key={mode} page={block} pages={ctx.legacy?.pages || []} answers={ctx.legacy?.answers || []} T={T} onDone={mode === 'live' ? () => ctx.act({ type: 'next' }) : noop} />;

        case 'level': {
            const pct = Math.max(0, Math.min(100, ((Number(block.value) || 0) / (Number(block.maxValue) || 5)) * 100));
            const c = block.color || T.primary;
            return (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 14.5, color: T.text }}>{interpolate(block.title, vars)}</span>
                        <span style={{ fontWeight: 700, fontSize: 13.5, color: c }}>{block.label}</span>
                    </div>
                    <div style={{ height: 12, borderRadius: 99, background: `rgba(${T.rgb},.1)`, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: `linear-gradient(90deg, ${c}aa, ${c})`, transition: 'width 1s ease' }} />
                    </div>
                </div>
            );
        }

        case 'outcome': return <OutcomeBlock block={block} T={T} ctx={ctx} />;
        case 'lottie': return <LottieView block={block} T={T} />;
        case 'projection': return <ProjectionChart block={block} T={T} ctx={ctx} />;

        case 'result':
            if (mode === 'live') return <AIResultBlock page={block} quiz={null} answers={ctx.legacy?.answers || []} pages={ctx.legacy?.pages || []} T={T} />;
            return (
                <div style={{ textAlign: 'center', borderRadius: T.radius, padding: 20, background: `linear-gradient(135deg, rgba(${T.rgb},.08), rgba(${T.rgb},.02))`, border: `1px solid rgba(${T.rgb},.15)` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.primary, marginBottom: 8 }}>✨ {block.title || 'Seu Diagnóstico Personalizado'}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 6 }}>Texto gerado pela IA</div>
                    <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.5, marginBottom: 14 }}>No quiz publicado, a IA escreve um diagnóstico curto com base nas respostas da pessoa.</div>
                    <button type="button" style={primaryBtnStyle(T, false)}>{block.cta || 'Ver minha solução →'}</button>
                </div>
            );

        case 'html-script': return <HtmlBlock block={block} ctx={ctx} />;

        default:
            return <LegacyBlockRenderer block={block} pc={T.primary} />;
    }
}
