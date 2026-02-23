// PhonePreview.jsx — Canvas with drag-reorder, resize handles, composable blocks
import { useState, useRef, useCallback, useEffect } from 'react';
import { GripVertical, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { BLOCK_TYPES, ALERT_TYPES } from '../utils/blockTypes';

// ── Individual block renderer ──
function BlockRenderer({ block, pc }) {
    const layout = block.optionLayout || 'list';
    if (!block) return null;

    const renderOption = (opt, i) => {
        const isGrid = layout === 'grid' || layout === 'horizontal';
        const isImg = layout === 'image-text';
        const hasUploadedImg = opt.image && typeof opt.image === 'string' && opt.image.startsWith('data:');
        // If option has an uploaded image, force card-style rendering
        const showAsCard = hasUploadedImg || isImg;
        return (
            <div key={i} style={{
                padding: showAsCard ? 0 : '14px 18px', borderRadius: 14, overflow: 'hidden',
                border: `2px solid ${i === 0 ? pc : '#e2e8f0'}`, marginBottom: isGrid ? 0 : 10,
                display: 'flex', alignItems: 'center', gap: showAsCard ? 0 : 12,
                background: i === 0 ? `${pc}0d` : '#fff', flexDirection: showAsCard ? 'column' : 'row',
                textAlign: showAsCard ? 'center' : 'left', cursor: 'pointer', transition: 'all 0.15s',
            }}>
                {hasUploadedImg
                    ? <img src={opt.image} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                    : opt.image ? <span style={{ fontSize: isImg ? 28 : 20 }}>{opt.image}</span>
                        : opt.emoji ? <span style={{ fontSize: 20, ...(showAsCard ? { marginTop: 12 } : {}) }}>{opt.emoji}</span> : null}
                <span style={{ fontSize: 15, fontWeight: 500, color: '#2d3748', padding: showAsCard ? '10px 12px' : 0 }}>{opt.text || `Opção ${i + 1}`}</span>
            </div>
        );
    };

    switch (block.type) {
        case 'choice': return (<div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, lineHeight: 1.35 }}>{block.text || 'Pergunta?'}</h2>
            <div style={{ display: layout === 'grid' ? 'grid' : layout === 'horizontal' ? 'grid' : 'flex', gridTemplateColumns: layout === 'grid' ? '1fr 1fr' : `repeat(${Math.min((block.options || []).length, 3)}, 1fr)`, gap: layout === 'grid' || layout === 'horizontal' ? 10 : 0, flexDirection: 'column' }}>
                {(block.options || []).map((o, i) => renderOption(o, i))}
            </div>
        </div>);

        case 'image-select': return (<div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, lineHeight: 1.35 }}>{block.text || 'Pergunta?'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(block.options || []).map((o, i) => renderOption(o, i))}
            </div>
        </div>);

        case 'likert': return (<LikertSliderPreview block={block} pc={pc} />);

        case 'statement': return (<div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{block.text || 'Afirmação'}</h2>
            {block.quote && <div style={{ padding: 16, background: '#f7fafc', borderRadius: 14, borderLeft: `4px solid ${pc}`, marginBottom: 16, fontSize: 15, color: '#4a5568', fontStyle: 'italic', lineHeight: 1.5 }}>"{block.quote}"</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(block.options || []).map((o, i) => <div key={i} style={{ padding: '12px 8px', borderRadius: 12, border: '2px solid #e2e8f0', textAlign: 'center', fontSize: 13, fontWeight: 500, color: '#4a5568', cursor: 'pointer' }}>{typeof o === 'string' ? o : o.text}</div>)}
            </div>
        </div>);

        case 'capture': return (<div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{block.title || 'Quase lá!'}</h2>
            <p style={{ fontSize: 15, color: '#718096', marginBottom: 20 }}>{block.subtitle || ''}</p>
            {(block.fields || []).map(f => <div key={f} style={{ marginBottom: 12 }}><div style={{ fontSize: 13, color: '#718096', marginBottom: 4, fontWeight: 500 }}>{f === 'name' ? 'Nome' : f === 'email' ? 'E-mail' : 'Telefone'}</div><div style={{ padding: '14px 16px', borderRadius: 12, border: '2px solid #e2e8f0', background: '#f7fafc', color: '#a0aec0', fontSize: 15 }}>{f === 'name' ? 'Seu nome...' : f === 'email' ? 'seuemail@ex.com' : '(11) 99999-...'}</div></div>)}
            <button style={{ width: '100%', padding: '16px 0', borderRadius: 14, border: 'none', background: pc, color: '#fff', fontWeight: 700, fontSize: 16, marginTop: 8 }}>{block.buttonText || 'Continuar →'}</button>
        </div>);

        case 'text': {
            const v = block.variant || 'body';
            const sz = v === 'headline' ? 26 : v === 'subheadline' ? 20 : v === 'caption' ? 13 : 16;
            const fw = (v === 'headline' || v === 'subheadline') ? 700 : block.bold ? 700 : 400;
            const lh = v === 'headline' ? 1.25 : v === 'subheadline' ? 1.35 : 1.7;
            return (
                <div style={{
                    fontSize: sz, lineHeight: lh, whiteSpace: 'pre-wrap',
                    color: block.textColor || '#2d3748',
                    textAlign: block.align || 'left',
                    fontWeight: fw,
                    fontStyle: block.italic ? 'italic' : 'normal',
                    textDecoration: block.underline ? 'underline' : 'none',
                }}>
                    {block.imageUrl && <img src={block.imageUrl} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 12, maxHeight: 180, objectFit: 'cover' }} />}
                    {block.content || (v === 'headline' ? 'Título' : v === 'subheadline' ? 'Subtítulo' : v === 'caption' ? 'Legenda...' : 'Texto...')}
                </div>
            );
        }

        case 'image': return (<div style={{ textAlign: 'center' }}>
            {block.imageUrl ? <img src={block.imageUrl} alt={block.alt || ''} style={{ width: '100%', borderRadius: block.rounded !== false ? 14 : 0, maxHeight: block.height || 220, objectFit: 'cover' }} /> : <div style={{ width: '100%', height: block.height || 180, background: 'linear-gradient(135deg, #f0f0f5, #e8e8ed)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', fontSize: 40 }}>🖼️</div>}
            {block.caption && <p style={{ fontSize: 13, color: '#718096', marginTop: 8 }}>{block.caption}</p>}
        </div>);

        case 'video': return (<div>
            {block.videoUrl ? <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 14, overflow: 'hidden', background: '#000' }}><iframe src={block.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen /></div> : <div style={{ width: '100%', height: 200, background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 40, flexDirection: 'column', gap: 8 }}>🎬<span style={{ fontSize: 13, color: '#888' }}>Cole a URL do vídeo</span></div>}
        </div>);

        case 'button': {
            const anim = block.animation === 'pulse' ? 'pulse 2s infinite' : block.animation === 'glow' ? 'glow 2s infinite' : 'none';
            return (<div style={{ textAlign: 'center', padding: '10px 0' }}>
                <button style={{ padding: block.size === 'sm' ? '10px 24px' : block.size === 'lg' ? '18px 0' : '14px 36px', borderRadius: 14, border: block.style === 'outline' ? `2px solid ${pc}` : 'none', background: block.style === 'outline' ? 'transparent' : pc, color: block.style === 'outline' ? pc : '#fff', fontWeight: 700, fontSize: block.size === 'sm' ? 14 : 17, cursor: 'pointer', animation: anim, width: block.size === 'lg' ? '100%' : 'auto' }}>{block.text || 'Clique →'}</button>
            </div>);
        }

        case 'insight': {
            const s = block.insightStyle || 'card';
            return (<div style={{ background: s === 'fullscreen' ? `linear-gradient(135deg, ${pc}15, ${pc}30)` : '#f7fafc', borderRadius: 16, padding: s === 'minimal' ? '14px 0' : 20, border: s === 'card' ? '1px solid #e2e8f0' : 'none' }}>
                {s !== 'minimal' && block.imageUrl && <img src={block.imageUrl} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 12, marginBottom: 12 }} />}
                {s !== 'minimal' && !block.imageUrl && <div style={{ textAlign: 'center', fontSize: 32, marginBottom: 10 }}>💡</div>}
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{block.title || 'Insight'}</h3>
                <p style={{ fontSize: 15, color: '#4a5568', lineHeight: 1.6 }}>{block.body || 'Texto...'}</p>
            </div>);
        }

        case 'social-proof': return (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{block.emoji || '👥'}</div>
                <h2 style={{ fontSize: 38, fontWeight: 800, color: pc, marginBottom: 6 }}>{block.headline || '+10.000'}</h2>
                <p style={{ fontSize: 16, color: '#4a5568', lineHeight: 1.4 }}>{block.subheadline || 'pessoas participaram'}</p>
            </div>
        );

        case 'testimonial': return (
            <div style={{ background: '#f7fafc', borderRadius: 16, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 18, color: '#f1c40f', marginBottom: 8 }}>{'⭐'.repeat(block.rating || 5)}</div>
                <p style={{ fontSize: 16, color: '#2d3748', fontStyle: 'italic', marginBottom: 10, lineHeight: 1.5 }}>"{block.text || 'Depoimento...'}"</p>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#4a5568' }}>— {block.name || 'Cliente'}</div>
            </div>
        );

        case 'arguments': return (<div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>{block.title || 'Benefícios'}</h2>
            {(block.items || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #edf2f7' }}>
                    <span style={{ color: pc, fontSize: 16, flexShrink: 0 }}>{block.emoji || '✅'}</span>
                    <span style={{ fontSize: 15, color: '#2d3748' }}>{item}</span>
                </div>
            ))}
        </div>);

        case 'alert': {
            const at = ALERT_TYPES.find(a => a.key === block.alertType) || ALERT_TYPES[0];
            const s = block.alertStyle || 'banner';
            const c = block.customColor || at.color;
            const bg = block.customColor ? `${block.customColor}15` : at.bg;
            return (
                <div style={{ padding: s === 'floating' ? '14px 18px' : '16px 18px', borderRadius: s === 'floating' ? 24 : s === 'card' ? 16 : 10, background: bg, border: `2px solid ${c}33`, boxShadow: s === 'floating' ? '0 4px 24px rgba(0,0,0,0.08)' : 'none' }}>
                    <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4, color: c }}>{block.emoji || at.icon} {block.title || 'Atenção!'}</div>
                    <p style={{ fontSize: 14, color: '#555', lineHeight: 1.5 }}>{block.text || 'Texto'}</p>
                </div>
            );
        }

        case 'timer': {
            const fmt = block.timerFormat || 'digital';
            const mins = String(Math.floor((block.duration || 300) / 60)).padStart(2, '0');
            const secs = String((block.duration || 300) % 60).padStart(2, '0');
            if (fmt === 'circular') return (
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <p style={{ fontSize: 14, color: '#718096', marginBottom: 12 }}>{block.title || 'Timer'}</p>
                    <div style={{ width: 100, height: 100, borderRadius: '50%', border: `5px solid ${pc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: 28, fontWeight: 800, color: pc }}>{mins}:{secs}</div>
                </div>
            );
            if (fmt === 'progress') return (
                <div style={{ padding: '10px 0' }}>
                    <p style={{ fontSize: 14, color: '#718096', marginBottom: 8 }}>{block.title || 'Timer'}</p>
                    <div style={{ height: 10, background: '#e2e8f0', borderRadius: 5 }}><div style={{ height: '100%', width: '60%', background: pc, borderRadius: 5 }} /></div>
                    <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 600, color: pc, marginTop: 6 }}>{mins}:{secs}</div>
                </div>
            );
            return (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <p style={{ fontSize: 14, color: '#718096', marginBottom: 10 }}>{block.title || 'Timer'}</p>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        {[mins, secs].map((v, i) => (
                            <div key={i} style={{ width: 64, height: 64, borderRadius: 14, background: `${pc}0d`, border: `2px solid ${pc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: pc }}>{v}</div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
                        <span style={{ width: 64, textAlign: 'center', fontSize: 11, color: '#718096' }}>min</span>
                        <span style={{ width: 64, textAlign: 'center', fontSize: 11, color: '#718096' }}>seg</span>
                    </div>
                </div>
            );
        }

        case 'loading': return (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ width: 56, height: 56, border: `4px solid ${pc}22`, borderTopColor: pc, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{block.title || 'Analisando...'}</h2>
                {(block.items || []).map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
                        <span style={{ color: i < 2 ? '#2ecc71' : '#ccc', fontSize: 14 }}>{i < 2 ? '✓' : '○'}</span>
                        <span style={{ fontSize: 15, color: i < 2 ? '#2d3748' : '#a0aec0' }}>{item}</span>
                    </div>
                ))}
            </div>
        );

        case 'price': return (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{block.title || 'Oferta'}</h2>
                {block.discount && <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 24, background: '#e74c3c', color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{block.discount}</span>}
                {block.originalPrice && <div style={{ fontSize: 17, color: '#a0aec0', textDecoration: 'line-through', marginBottom: 4 }}>{block.originalPrice}</div>}
                <div style={{ fontSize: 40, fontWeight: 800, color: pc, marginBottom: 12 }}>{block.price || 'R$ 0'}</div>
                {(block.features || []).length > 0 && <div style={{ textAlign: 'left', marginBottom: 14, padding: '0 12px' }}>
                    {block.features.map((f, i) => <div key={i} style={{ fontSize: 14, color: '#4a5568', padding: '4px 0', display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ color: '#2ecc71', fontWeight: 700 }}>✓</span>{f}</div>)}
                </div>}
                <button style={{ width: '100%', padding: '16px 0', borderRadius: 14, border: 'none', background: pc, color: '#fff', fontWeight: 700, fontSize: 17 }}>{block.cta || 'Comprar →'}</button>
            </div>
        );

        case 'chart': {
            const ct = block.chartType || 'bar';
            const cc = block.chartColor || pc;
            // Randomize values ±15% to look like personalized results
            const rawData = block.data || [];
            const data = rawData.map(d => {
                const variance = d.value * 0.15;
                const rand = d.value + (Math.random() * 2 - 1) * variance;
                return { ...d, value: Math.round(Math.max(1, Math.min(99, rand))) };
            });
            const maxVal = Math.max(...data.map(d => d.value), 1);
            if (ct === 'pie' || ct === 'donut') {
                const total = data.reduce((s, d) => s + d.value, 0) || 1;
                let cum = 0;
                const stops = data.map((d, i) => { const st = (cum / total) * 100; cum += d.value; return `hsl(${(i * 360 / data.length) % 360}, 60%, 55%) ${st}% ${(cum / total) * 100}%`; });
                return (<div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{block.title || 'Dados'}</h2>
                    <div style={{ width: 140, height: 140, borderRadius: '50%', background: `conic-gradient(${stops.join(', ')})`, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {ct === 'donut' && <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                        {data.map((d, i) => <span key={i} style={{ fontSize: 13, color: '#4a5568', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: `hsl(${(i * 360 / data.length) % 360}, 60%, 55%)` }} />{d.label}</span>)}
                    </div>
                </div>);
            }
            if (ct === 'line') return (<div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{block.title || 'Dados'}</h2>
                <svg viewBox="0 0 200 100" style={{ width: '100%' }}>
                    <polyline fill="none" stroke={cc} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={data.map((d, i) => `${(i / Math.max(data.length - 1, 1)) * 190 + 5},${95 - (d.value / maxVal) * 85}`).join(' ')} />
                    {data.map((d, i) => <circle key={i} cx={(i / Math.max(data.length - 1, 1)) * 190 + 5} cy={95 - (d.value / maxVal) * 85} r="4" fill={cc} />)}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 4px 0' }}>{data.map((d, i) => <span key={i} style={{ fontSize: 12, color: '#718096' }}>{d.label}</span>)}</div>
            </div>);
            if (ct === 'radial') return (<div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{block.title || 'Dados'}</h2>
                {data.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <svg viewBox="0 0 36 36" style={{ width: 48, height: 48, flexShrink: 0 }}><circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="3" /><circle cx="18" cy="18" r="15.5" fill="none" stroke={cc} strokeWidth="3" strokeDasharray={`${d.value} ${100 - d.value}`} strokeDashoffset="25" strokeLinecap="round" /></svg>
                        <div><div style={{ fontSize: 14, fontWeight: 600, color: '#2d3748' }}>{d.label}</div><div style={{ fontSize: 12, color: cc }}>{d.value}%</div></div>
                    </div>
                ))}
            </div>);
            return (<div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{block.title || 'Dados'}</h2>
                {data.map((d, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}><span style={{ color: '#4a5568' }}>{d.label}</span><span style={{ fontWeight: 600, color: cc }}>{d.value}%</span></div>
                        <div style={{ height: 10, background: '#e2e8f0', borderRadius: 5 }}><div style={{ height: '100%', width: `${d.value}%`, background: cc, borderRadius: 5, transition: 'width 0.3s' }} /></div>
                    </div>
                ))}
            </div>);
        }

        case 'result': return (
            <div style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#1a2332' }}>{block.title || 'Seu Diagnóstico'}</h3>
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>A IA vai analisar as respostas e gerar um diagnóstico personalizado aqui</p>
                {block.productName && <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>Produto: {block.productName}</p>}
                <button style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', background: pc, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{block.cta || '🔥 Ver minha solução →'}</button>
            </div>
        );

        case 'welcome': {
            const ta = block.textAlign || 'center';
            const imgPos = block.imagePosition || 'top';
            const renderImg = () => block.imageUrl ? <img src={block.imageUrl} alt="" style={{ width: `${block.imageWidth || 100}%`, height: block.imageHeightPx || 200, objectFit: 'cover', borderRadius: 16, margin: '0 auto', display: 'block' }} /> : null;
            return (
                <div style={{ textAlign: ta, padding: 8, background: block.bgColor || 'transparent', borderRadius: 16, minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: imgPos === 'bottom' ? 'flex-start' : imgPos === 'top' ? 'flex-end' : 'center', gap: 8 }}>
                    {imgPos === 'top' && renderImg()}
                    {block.emoji && <div style={{ fontSize: 36 }}>{block.emoji}</div>}
                    {block.headline && <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a2332', lineHeight: 1.3, margin: 0 }}>{block.headline}</h2>}
                    {block.subtitle && <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>{block.subtitle}</p>}
                    {imgPos === 'center' && renderImg()}
                    <button style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: pc, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: `0 4px 16px ${pc}40`, marginTop: 8 }}>{block.cta || 'Começar →'}</button>
                    {imgPos === 'bottom' && renderImg()}
                </div>
            );
        }

        case 'bmi': {
            const zones = [
                { label: 'Abaixo', color: '#3b82f6', min: 0, max: 18.5 },
                { label: 'Normal', color: '#22c55e', min: 18.5, max: 25 },
                { label: 'Sobrepeso', color: '#f59e0b', min: 25, max: 30 },
                { label: 'Obeso', color: '#ef4444', min: 30, max: 45 },
            ];
            const sampleBmi = 24.5;
            const pct = Math.min(100, Math.max(0, ((sampleBmi - 15) / 25) * 100));
            return (
                <div style={{ textAlign: 'center', padding: 8 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: '#1a2332' }}>{block.title || 'Seu IMC'}</h3>
                    <div style={{ fontSize: 32, fontWeight: 800, color: pc, marginBottom: 4 }}>{sampleBmi}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>Normal</div>
                    <div style={{ display: 'flex', height: 10, borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
                        {zones.map((z, i) => <div key={i} style={{ flex: 1, background: z.color }} />)}
                    </div>
                    <div style={{ position: 'relative', height: 8 }}>
                        <div style={{ position: 'absolute', left: `${pct}%`, top: -14, transform: 'translateX(-50%)', width: 8, height: 8, borderRadius: '50%', background: pc, border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                        {zones.map((z, i) => <span key={i} style={{ fontSize: 9, color: z.color, fontWeight: 600 }}>{z.label}</span>)}
                    </div>
                    <p style={{ fontSize: 11, color: '#6b7280', marginTop: 10, lineHeight: 1.5 }}>Calculado com base nas respostas de altura e peso</p>
                </div>
            );
        }

        case 'scroll-picker': {
            const val = block.defaultValue || 170;
            const unit = block.unit || 'cm';
            return (
                <div style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#1a2332' }}>{block.text}</h3>
                    <div style={{ position: 'relative', height: 160, overflow: 'hidden', borderRadius: 16, background: 'linear-gradient(to bottom, rgba(0,0,0,0.06), transparent 30%, transparent 70%, rgba(0,0,0,0.06))' }}>
                        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 40, background: `${pc}12`, borderTop: `2px solid ${pc}`, borderBottom: `2px solid ${pc}`, zIndex: 1 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 50 }}>
                            {[val - 3, val - 2, val - 1, val, val + 1, val + 2, val + 3].map((v, i) => (
                                <div key={i} style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: v === val ? 22 : 16, fontWeight: v === val ? 800 : 400, color: v === val ? pc : '#9ca3af', transition: 'all 0.2s', opacity: Math.abs(v - val) > 2 ? 0.3 : 1 }}>
                                    {v}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: pc }}>{val} {unit}</div>
                </div>
            );
        }

        case 'number-input': return (
            <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#1a2332' }}>{block.text}</h3>
                <div style={{ fontSize: 52, marginBottom: 12 }}>⚖️</div>
                <div style={{ position: 'relative', maxWidth: 200, margin: '0 auto' }}>
                    <input type="number" placeholder={block.placeholder || 'Ex: 72'} style={{ width: '100%', padding: '14px 50px 14px 18px', borderRadius: 14, border: `2px solid ${pc}30`, fontSize: 20, fontWeight: 700, textAlign: 'center', outline: 'none', color: '#1a2332', background: '#f9fafb' }} readOnly />
                    <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 700, color: pc }}>{block.unit || 'kg'}</span>
                </div>
            </div>
        );

        default: return <div style={{ color: '#888', fontSize: 14 }}>Bloco: {block.type}</div>;
    }
}

// ── Likert Slider Preview ──
function LikertSliderPreview({ block, pc }) {
    const [val, setVal] = useState(2);
    const opts = block.options || [];
    const count = opts.length || 5;
    const pct = count > 1 ? (val / (count - 1)) * 100 : 50;
    const sliderId = `lk-${block.id || 'prev'}`;
    const sliderCSS = `
#${sliderId}{-webkit-appearance:none;width:100%;height:8px;border-radius:4px;outline:none;cursor:pointer;background:linear-gradient(to right,${pc} 0%,${pc} ${pct}%,#e5e7eb ${pct}%,#e5e7eb 100%);transition:background 0.15s}
#${sliderId}::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:#fff;border:3px solid ${pc};box-shadow:0 2px 8px rgba(0,0,0,0.18);cursor:grab;transition:box-shadow 0.2s}
#${sliderId}::-webkit-slider-thumb:active{cursor:grabbing;box-shadow:0 2px 12px rgba(0,0,0,0.25)}
#${sliderId}::-moz-range-thumb{width:26px;height:26px;border-radius:50%;background:#fff;border:3px solid ${pc};box-shadow:0 2px 8px rgba(0,0,0,0.18);cursor:grab}
#${sliderId}::-moz-range-track{height:8px;border-radius:4px;background:#e5e7eb}
#${sliderId}::-moz-range-progress{height:8px;border-radius:4px;background:${pc}}`;
    return (
        <div>
            <style>{sliderCSS}</style>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, lineHeight: 1.35 }}>{block.text || 'Pergunta?'}</h2>
            <div style={{ padding: '0 4px', marginBottom: 4 }}>
                <input id={sliderId} type="range" min={0} max={count - 1} step={1} value={val}
                    onChange={e => setVal(Number(e.target.value))} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{opts[0]?.text}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{opts[count - 1]?.text}</span>
                </div>
                {opts[val] && (
                    <div style={{ textAlign: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: pc }}>{opts[val].text}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══ Main canvas component ═══
export default function PhonePreview({ step, selectedBlockId, onSelectBlock, onDeleteBlock, onBlockChange, config, viewMode, onDropBlock, onDragOverBlock, dragOverBlockIdx, onReorderBlock }) {
    const pc = config.primaryColor || '#6c63ff';
    const blocks = step?.blocks || [];
    const [dragIdx, setDragIdx] = useState(null);
    const [hoverIdx, setHoverIdx] = useState(null);
    const [resizingIdx, setResizingIdx] = useState(null);
    const canvasRef = useRef(null);

    // ── Block resize via drag ──
    useEffect(() => {
        if (resizingIdx === null) return;
        const onMove = (e) => {
            if (resizingIdx === null || !canvasRef.current) return;
            const canvasRect = canvasRef.current.getBoundingClientRect();
            const canvasW = canvasRect.width - 56; // subtract padding
            const mouseX = e.clientX - canvasRect.left - 28; // subtract left padding
            const pct = Math.round(Math.max(25, Math.min(100, (mouseX / canvasW) * 100)));
            // Snap to 25% increments
            const snapped = Math.round(pct / 25) * 25;
            onBlockChange?.(resizingIdx, { ...blocks[resizingIdx], widthPct: snapped });
        };
        const onUp = () => { setResizingIdx(null); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [resizingIdx, blocks, onBlockChange]);

    if (!step) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#444', fontSize: 14, flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 40 }}>📱</span>
            <span>Selecione ou crie uma etapa</span>
        </div>
    );

    const handleBlockDragStart = (e, i) => { e.dataTransfer.setData('block-reorder', String(i)); setDragIdx(i); };
    const handleBlockDragEnd = () => { setDragIdx(null); setHoverIdx(null); };
    const handleBlockDragOver = (e, i) => { e.preventDefault(); e.stopPropagation(); setHoverIdx(i); onDragOverBlock?.(i); };
    const handleBlockDrop = (e, i) => {
        e.preventDefault(); e.stopPropagation();
        const fromStr = e.dataTransfer.getData('block-reorder');
        if (fromStr !== '') { onReorderBlock?.(Number(fromStr), i); }
        else { onDropBlock?.(i); }
        setDragIdx(null); setHoverIdx(null);
    };

    const w = viewMode === 'mobile' ? 390 : 520;
    const frameH = viewMode === 'mobile' ? 720 : 560;

    return (
        <div style={{
            width: w, minHeight: frameH,
            background: config?.bgColor || '#fff', borderRadius: viewMode === 'mobile' ? 44 : 16,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
            fontFamily: "'Inter', -apple-system, sans-serif", color: '#1a2332',
            position: 'relative',
        }}>
            {/* Notch */}
            {viewMode === 'mobile' && (
                <div style={{ height: 50, background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '44px 44px 0 0' }}>
                    <div style={{ width: 90, height: 28, background: '#1a1a1a', borderRadius: 24 }} />
                </div>
            )}
            {/* Progress bar */}
            <div style={{ height: 5, background: '#e8edf2', margin: viewMode === 'mobile' ? '14px 28px 0' : '14px 20px 0', borderRadius: 3 }}>
                <div style={{ height: '100%', width: '40%', background: pc, borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            {/* Blocks area */}
            <div ref={canvasRef} style={{ padding: viewMode === 'mobile' ? '20px 28px 32px' : '16px 24px 24px', minHeight: 300 }}
                onDragOver={e => { e.preventDefault(); onDragOverBlock?.(blocks.length); }}
                onDrop={e => { e.preventDefault(); const fromStr = e.dataTransfer.getData('block-reorder'); if (!fromStr) onDropBlock?.(blocks.length); }}>

                {blocks.length === 0 && (
                    <div style={{ padding: '50px 16px', textAlign: 'center', border: '2px dashed #d1d5db', borderRadius: 16, color: '#9ca3af', fontSize: 15, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <Plus size={24} />
                        Arraste componentes aqui
                    </div>
                )}

                {/* Flowing grid: blocks wrap based on their widthPct */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {blocks.map((block, idx) => {
                        const w = block.widthPct || 100;
                        const isSelected = selectedBlockId === block.id;
                        const isDropTarget = (hoverIdx === idx || dragOverBlockIdx === idx) && dragIdx !== idx;
                        return (
                            <div key={block.id} style={{ width: `calc(${w}% - ${w < 100 ? 4 : 0}px)`, transition: resizingIdx === idx ? 'none' : 'width 0.2s ease', flexShrink: 0 }}>
                                {isDropTarget && <div style={{ height: 4, background: pc, borderRadius: 2, margin: '4px 0' }} />}
                                <div
                                    draggable={resizingIdx === null}
                                    onDragStart={e => handleBlockDragStart(e, idx)}
                                    onDragEnd={handleBlockDragEnd}
                                    onDragOver={e => handleBlockDragOver(e, idx)}
                                    onDrop={e => handleBlockDrop(e, idx)}
                                    onClick={() => onSelectBlock?.(idx)}
                                    style={{
                                        position: 'relative', padding: 4, borderRadius: 14,
                                        outline: isSelected ? `2px solid ${pc}` : '2px solid transparent',
                                        background: isSelected ? `${pc}06` : 'transparent',
                                        transition: 'all 0.15s', cursor: 'pointer',
                                        opacity: dragIdx === idx ? 0.4 : 1,
                                    }}>
                                    {/* Action buttons */}
                                    {isSelected && (
                                        <div style={{ position: 'absolute', top: -6, right: -6, display: 'flex', gap: 2, zIndex: 5 }}>
                                            <div style={{ ...actionBtn, cursor: 'grab' }} title="Arrastar"><GripVertical size={12} /></div>
                                            <div style={actionBtn} onClick={e => { e.stopPropagation(); onDeleteBlock?.(idx); }} title="Remover"><Trash2 size={12} /></div>
                                        </div>
                                    )}
                                    {/* Width badge */}
                                    {isSelected && w < 100 && (
                                        <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', background: pc, color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, zIndex: 5 }}>
                                            {w}%
                                        </div>
                                    )}
                                    <div style={{
                                        background: block.bgColor || 'transparent',
                                        padding: block.padding || 0,
                                        margin: block.margin || 0,
                                        borderRadius: block.borderRadius === 999 ? 999 : (block.borderRadius || 0),
                                        border: block.borderStyle && block.borderStyle !== 'none' ? `${block.borderWidth || 1}px ${block.borderStyle} ${block.borderColor || '#e2e8f0'}` : 'none',
                                        boxShadow: block.shadow === 'sm' ? '0 1px 3px rgba(0,0,0,0.08)' : block.shadow === 'md' ? '0 4px 12px rgba(0,0,0,0.1)' : block.shadow === 'lg' ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
                                        opacity: (block.opacity ?? 100) / 100,
                                        transition: 'all 0.2s',
                                    }}>
                                        <BlockRenderer block={block} pc={pc} />
                                    </div>
                                    {/* Right-edge resize handle */}
                                    {isSelected && (
                                        <div
                                            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setResizingIdx(idx); }}
                                            style={{
                                                position: 'absolute', top: 8, bottom: 8, right: -4, width: 8,
                                                cursor: 'ew-resize', borderRadius: 4, zIndex: 6,
                                                background: pc, opacity: 0.6,
                                                transition: 'opacity 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {(hoverIdx === blocks.length || dragOverBlockIdx === blocks.length) && blocks.length > 0 && <div style={{ height: 4, background: pc, borderRadius: 2, margin: '4px 0' }} />}
            </div>
        </div>
    );
}

const actionBtn = { width: 24, height: 24, borderRadius: 6, background: '#fff', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
