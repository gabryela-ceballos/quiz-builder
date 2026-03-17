// ClonePropertiesPanel.jsx — Clean, minimal editing panel
import React, { useState } from 'react';

function rgbToHex(rgb) {
    if (!rgb) return '#000000';
    const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    return m ? `#${[m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('')}` : '#000000';
}

const FONTS = ['Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Lato', 'Outfit', 'Arial', 'Georgia'];

export default function ClonePropertiesPanel({ el, step, config, onBlockChange }) {
    if (!el) return null;
    const pc = config?.primaryColor || '#6c63ff';
    const api = window.__cloneEditorApi;
    const styles = el.styles || {};
    const updateStyle = (css) => api?.updateStyle(el.path, css);

    // ── Section wrapper ──
    const Section = ({ title, children, defaultOpen = true }) => {
        const [open, setOpen] = useState(defaultOpen);
        return (
            <div style={{ marginBottom: 8 }}>
                <button onClick={() => setOpen(!open)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '8px 0', background: 'none', border: 'none',
                    fontSize: '0.72rem', fontWeight: 700, color: '#4b5563',
                    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.4px',
                }}>
                    <span>{title}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{open ? '▲' : '▼'}</span>
                </button>
                {open && <div style={{ paddingTop: 4 }}>{children}</div>}
            </div>
        );
    };

    // ── Compact row helper ──
    const Row = ({ label, children }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#6b7280', whiteSpace: 'nowrap' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{children}</div>
        </div>
    );

    return (
        <div className="clone-props-panel" style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: 'calc(100vh - 200px)', boxSizing: 'border-box' }}>
            {/* Force dark text on ALL form controls */}
            <style>{`
                .clone-props-panel input:not([type="color"]):not([type="file"]):not([type="range"]),
                .clone-props-panel textarea,
                .clone-props-panel select {
                    color: #111 !important;
                    background: #fff !important;
                }
                .clone-props-panel input::placeholder,
                .clone-props-panel textarea::placeholder {
                    color: #9ca3af !important;
                }
                .clone-props-panel button {
                    color: inherit;
                }
                .clone-props-panel .section-label {
                    color: #374151 !important;
                }
            `}</style>

            {/* ── PICKER EDITING ── */}
            {el.type === 'picker' && (
                <>
                    <Section title="Estilo Visual" defaultOpen={true}>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                            {[
                                { id: 'drum', label: 'Roleta', icon: '🎰' },
                                { id: 'ruler', label: 'Régua', icon: '📏' },
                                { id: 'slider', label: 'Slider', icon: '🎚️' },
                                { id: 'input', label: 'Input', icon: '🔢' },
                            ].map(v => (
                                <div key={v.id} onClick={() => api?.updatePickerAttr(el.pickerPath || el.path, { 'data-visual-style': v.id })}
                                    style={{
                                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                                        padding: '8px 2px', borderRadius: 8, cursor: 'pointer', fontSize: 9, fontWeight: 600,
                                        background: (el.pickerVisualStyle || 'drum') === v.id ? `${pc}15` : '#f9fafb',
                                        border: `2px solid ${(el.pickerVisualStyle || 'drum') === v.id ? pc : '#e5e7eb'}`,
                                        color: (el.pickerVisualStyle || 'drum') === v.id ? pc : '#6b7280',
                                        transition: 'all 0.15s',
                                    }}>
                                    <span style={{ fontSize: 18 }}>{v.icon}</span>
                                    {v.label}
                                </div>
                            ))}
                        </div>
                    </Section>
                    <Section title="Configuração" defaultOpen={true}>
                        <Row label="Título (opcional)">
                            <input
                                defaultValue={el.pickerQuestion || ''}
                                onChange={e => api?.updatePickerAttr(el.pickerPath || el.path, { 'data-question': e.target.value })}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: '0.75rem' }}
                                placeholder="Ex: Qual é a sua altura?"
                            />
                        </Row>
                        <Row label="Unidade">
                            <input
                                defaultValue={el.pickerUnit || ''}
                                onChange={e => api?.updatePickerAttr(el.pickerPath || el.path, { 'data-unit': e.target.value })}
                                style={{ width: 60, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: '0.75rem', textAlign: 'center' }}
                                placeholder="cm"
                            />
                        </Row>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <Row label="Mín">
                                <input type="number"
                                    defaultValue={el.pickerMin || 0}
                                    onChange={e => api?.updatePickerAttr(el.pickerPath || el.path, { 'data-min': e.target.value })}
                                    style={{ width: 55, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: '0.75rem', textAlign: 'center' }}
                                />
                            </Row>
                            <Row label="Máx">
                                <input type="number"
                                    defaultValue={el.pickerMax || 300}
                                    onChange={e => api?.updatePickerAttr(el.pickerPath || el.path, { 'data-max': e.target.value })}
                                    style={{ width: 55, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: '0.75rem', textAlign: 'center' }}
                                />
                            </Row>
                        </div>
                        <Row label="Valor padrão">
                            <input type="number"
                                defaultValue={el.pickerDefault || 70}
                                onChange={e => api?.updatePickerAttr(el.pickerPath || el.path, { 'data-default': e.target.value })}
                                style={{ width: 70, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: '0.75rem', textAlign: 'center' }}
                            />
                        </Row>
                    </Section>
                </>
            )}

            {/* ── TEXT / BUTTON CONTENT ── */}
            {(el.type === 'text' || el.type === 'button') && (
                <>
                    <Section title="Conteúdo" defaultOpen={true}>
                        <textarea
                            defaultValue={el.text || ''}
                            onChange={e => api?.updateText(el.path, e.target.value)}
                            style={{
                                width: '100%', minHeight: el.type === 'button' ? 44 : 70,
                                padding: '8px 10px', borderRadius: 8,
                                border: '1px solid #e5e7eb', fontSize: '0.8rem',
                                lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit',
                                outline: 'none', boxSizing: 'border-box',
                            }}
                            onFocus={e => { e.target.style.borderColor = pc; }}
                            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; }}
                            placeholder="Texto..."
                        />
                    </Section>

                    <Section title="Estilo" defaultOpen={true}>
                        {/* Color + Background in one row */}
                        <Row label="Cor">
                            <input type="color" defaultValue={rgbToHex(styles.color)}
                                onChange={e => updateStyle({ color: e.target.value })}
                                style={{ width: 28, height: 28, border: '2px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', padding: 0 }}
                            />
                            {el.type === 'button' && (
                                <>
                                    <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>|</span>
                                    <input type="color" defaultValue={rgbToHex(styles.backgroundColor)}
                                        onChange={e => updateStyle({ backgroundColor: e.target.value })}
                                        style={{ width: 28, height: 28, border: '2px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', padding: 0 }}
                                        title="Cor de fundo"
                                    />
                                </>
                            )}
                        </Row>

                        {/* Font size */}
                        <Row label="Tamanho">
                            <input type="range" min="10" max="48"
                                defaultValue={parseInt(styles.fontSize) || 16}
                                onChange={e => updateStyle({ fontSize: e.target.value + 'px' })}
                                style={{ width: 100, accentColor: pc }}
                            />
                            <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontFamily: 'monospace', minWidth: 28 }}>
                                {parseInt(styles.fontSize) || 16}
                            </span>
                        </Row>

                        {/* Font */}
                        <Row label="Fonte">
                            <select defaultValue={(styles.fontFamily || 'Inter').replace(/['"]/g, '').split(',')[0].trim()}
                                onChange={e => updateStyle({ fontFamily: e.target.value })}
                                style={{ width: 130, padding: '4px 6px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: '0.72rem', outline: 'none' }}
                            >
                                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </Row>

                        {/* Alignment + Bold bar */}
                        <div style={{ display: 'flex', gap: 3 }}>
                            {[{ v: 'left', l: '◀' }, { v: 'center', l: '●' }, { v: 'right', l: '▶' }].map(a => (
                                <button key={a.v}
                                    onClick={() => updateStyle({ textAlign: a.v })}
                                    style={{
                                        flex: 1, padding: '5px 0', borderRadius: 5,
                                        border: styles.textAlign === a.v ? `2px solid ${pc}` : '1px solid #e5e7eb',
                                        background: styles.textAlign === a.v ? `${pc}12` : '#fff',
                                        fontSize: '0.65rem', cursor: 'pointer',
                                    }}
                                >{a.l}</button>
                            ))}
                            <button
                                onClick={() => updateStyle({ fontWeight: (styles.fontWeight === '700' || styles.fontWeight === 'bold') ? '400' : '700' })}
                                style={{
                                    flex: 1, padding: '5px 0', borderRadius: 5,
                                    border: (styles.fontWeight === '700' || styles.fontWeight === 'bold') ? `2px solid ${pc}` : '1px solid #e5e7eb',
                                    background: (styles.fontWeight === '700' || styles.fontWeight === 'bold') ? `${pc}12` : '#fff',
                                    fontSize: '0.72rem', cursor: 'pointer', fontWeight: 800,
                                }}
                            >B</button>
                        </div>
                    </Section>
                </>
            )}

            {/* ── BUTTON ACTION ── */}
            {el.type === 'button' && (
                <Section title="🔗 Ao clicar" defaultOpen={true}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                        {[
                            { action: 'next', label: '➡️ Próxima etapa', desc: 'Avança para a próxima página' },
                            { action: 'cta', label: '🌐 Abrir link', desc: 'Abre uma URL externa' },
                            { action: 'none', label: '🚫 Nada', desc: 'Sem ação ao clicar' },
                        ].map(a => {
                            const current = step?.blocks?.[0]?.buttonActions?.[el.path]?.action || 'next';
                            const isActive = current === a.action;
                            return (
                                <button key={a.action}
                                    onClick={() => api?.setButtonAction(el.path, { action: a.action, ...(a.action === 'cta' ? { ctaUrl: step?.blocks?.[0]?.buttonActions?.[el.path]?.ctaUrl || '' } : {}) })}
                                    title={a.desc}
                                    style={{
                                        flex: 1, padding: '8px 4px', borderRadius: 8,
                                        border: isActive ? `2px solid ${pc}` : '1px solid #e5e7eb',
                                        background: isActive ? `${pc}15` : '#fff',
                                        fontSize: '0.68rem', fontWeight: isActive ? 700 : 500,
                                        cursor: 'pointer', textAlign: 'center',
                                        color: isActive ? pc : '#6b7280',
                                        transition: 'all 0.15s',
                                    }}
                                >{a.label}</button>
                            );
                        })}
                    </div>

                    {step?.blocks?.[0]?.buttonActions?.[el.path]?.action === 'cta' && (
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                fontSize: '0.68rem', fontWeight: 600, color: '#374151',
                                marginBottom: 4,
                            }}>URL de destino</div>
                            <div style={{ position: 'relative' }}>
                                <span style={{
                                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                                    fontSize: 14, opacity: 0.4, pointerEvents: 'none',
                                }}>🔗</span>
                                <input
                                    defaultValue={step.blocks[0].buttonActions?.[el.path]?.ctaUrl || ''}
                                    onBlur={e => api?.setButtonAction(el.path, { action: 'cta', ctaUrl: e.target.value })}
                                    placeholder="https://seusite.com/oferta"
                                    style={{
                                        width: '100%', padding: '10px 10px 10px 32px', borderRadius: 8,
                                        border: `2px solid ${pc}40`, fontSize: '0.78rem',
                                        outline: 'none', boxSizing: 'border-box',
                                        background: '#fff', color: '#111',
                                        fontFamily: 'monospace',
                                    }}
                                    onFocus={e => { e.target.style.borderColor = pc; }}
                                />
                            </div>
                            <div style={{ fontSize: '0.6rem', color: '#9ca3af', marginTop: 4 }}>
                                Abre em nova aba ao clicar no botão
                            </div>
                        </div>
                    )}

                    {(!step?.blocks?.[0]?.buttonActions?.[el.path]?.action || step?.blocks?.[0]?.buttonActions?.[el.path]?.action === 'next') && (
                        <div style={{
                            fontSize: '0.65rem', color: '#6b7280', padding: '6px 10px',
                            background: '#f9fafb', borderRadius: 6, border: '1px solid #f3f4f6',
                        }}>
                            ➡️ Clique avança para a próxima etapa do quiz
                        </div>
                    )}
                </Section>
            )}

            {/* ── IMAGE ── */}
            {el.type === 'image' && (
                <Section title="Imagem" defaultOpen={true}>
                    {el.src && <img src={el.src} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 8, maxHeight: 120, objectFit: 'cover', border: '1px solid #e5e7eb' }} />}
                    <label style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        padding: '12px 10px', borderRadius: 8, border: '2px dashed #e5e7eb',
                        background: '#f9fafb', cursor: 'pointer', textAlign: 'center',
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = pc; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
                    >
                        <span style={{ fontSize: 18 }}>📤</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Upload imagem</span>
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const formData = new FormData();
                                formData.append('image', file);
                                const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
                                try {
                                    const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
                                    const data = await res.json();
                                    if (data.url) api?.updateImage(el.path, `${API_BASE}${data.url}`);
                                } catch (err) { console.error('Upload failed:', err); }
                            }}
                        />
                    </label>
                    <Row label="Bordas">
                        <input type="range" min="0" max="30" defaultValue={parseInt(styles.borderRadius) || 0}
                            onChange={e => updateStyle({ borderRadius: e.target.value + 'px' })}
                            style={{ width: 100, accentColor: pc }}
                        />
                    </Row>
                </Section>
            )}

            {/* ── CONTAINER ── */}
            {el.type === 'container' && (
                <Section title="Container" defaultOpen={true}>
                    <Row label="Fundo">
                        <input type="color" defaultValue={rgbToHex(styles.backgroundColor)}
                            onChange={e => updateStyle({ backgroundColor: e.target.value })}
                            style={{ width: 28, height: 28, border: '2px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', padding: 0 }}
                        />
                    </Row>
                    <Row label="Bordas">
                        <input type="range" min="0" max="30" defaultValue={parseInt(styles.borderRadius) || 0}
                            onChange={e => updateStyle({ borderRadius: e.target.value + 'px' })}
                            style={{ width: 100, accentColor: pc }}
                        />
                    </Row>
                    <Row label="Padding">
                        <input type="range" min="0" max="60" defaultValue={parseInt(styles.padding) || 0}
                            onChange={e => updateStyle({ padding: e.target.value + 'px' })}
                            style={{ width: 100, accentColor: pc }}
                        />
                    </Row>
                </Section>
            )}

            {/* ── INPUT ── */}
            {el.type === 'input' && (
                <Section title="Campo" defaultOpen={true}>
                    <input
                        defaultValue={el.text || ''}
                        onChange={e => api?.updateText(el.path, e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: '0.78rem', outline: 'none', boxSizing: 'border-box' }}
                        placeholder="Placeholder..."
                    />
                </Section>
            )}

            {/* ── CAROUSEL ── */}
            {el.type === 'carousel' && (
                <>
                    <Section title="🎠 Carrossel" defaultOpen={true}>
                        {/* Orientation badge */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 12px', borderRadius: 8,
                            background: 'linear-gradient(135deg, #fef3c7, #fef9c3)',
                            border: '1px solid #fcd34d',
                            marginBottom: 12,
                        }}>
                            <span style={{ fontSize: 18 }}>🎠</span>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e' }}>
                                    Carrossel • {el.slides?.length || 0} slides
                                </div>
                                <div style={{ fontSize: '0.65rem', color: '#b45309' }}>
                                    {el.orientation === 'vertical' ? 'Vertical (rola para baixo)' : 'Horizontal (desliza para o lado)'}
                                </div>
                            </div>
                        </div>

                        {/* Orientation toggle */}
                        <Row label="Direção">
                            <div style={{ display: 'flex', gap: 2, background: '#f3f4f6', borderRadius: 6, padding: 2 }}>
                                <button
                                    onClick={() => api?.setCarouselOrientation(el.carouselPath || el.path, 'horizontal')}
                                    style={{
                                        padding: '4px 10px', borderRadius: 5, border: 'none',
                                        background: (el.orientation || 'horizontal') === 'horizontal' ? pc : 'transparent',
                                        color: (el.orientation || 'horizontal') === 'horizontal' ? '#fff' : '#6b7280',
                                        fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer',
                                    }}
                                >↔ Horizontal</button>
                                <button
                                    onClick={() => api?.setCarouselOrientation(el.carouselPath || el.path, 'vertical')}
                                    style={{
                                        padding: '4px 10px', borderRadius: 5, border: 'none',
                                        background: el.orientation === 'vertical' ? pc : 'transparent',
                                        color: el.orientation === 'vertical' ? '#fff' : '#6b7280',
                                        fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer',
                                    }}
                                >↕ Vertical</button>
                            </div>
                        </Row>
                    </Section>

                    {/* Per-slide editing */}
                    {el.slides && el.slides.length > 0 && (
                        <Section title="Slides" defaultOpen={true}>
                            {el.slides.map((slide, idx) => (
                                <div key={idx} style={{
                                    padding: '8px', borderRadius: 10,
                                    border: '1px solid #e5e7eb', marginBottom: 8,
                                    background: '#fafafa',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4b5563' }}>
                                            Slide {idx + 1}
                                        </div>
                                        {el.slides.length > 1 && (
                                            <button
                                                onClick={() => api?.removeCarouselSlide(el.carouselPath || el.path, idx)}
                                                style={{
                                                    background: 'none', border: 'none', color: '#ef4444',
                                                    fontSize: '0.65rem', cursor: 'pointer', fontWeight: 600,
                                                }}
                                            >✕ Remover</button>
                                        )}
                                    </div>

                                    {/* Thumbnail */}
                                    {slide.src && (
                                        <img src={slide.src} alt="" style={{
                                            width: '100%', height: 80, objectFit: 'cover',
                                            borderRadius: 6, marginBottom: 6, border: '1px solid #e5e7eb',
                                        }} />
                                    )}

                                    {/* Upload */}
                                    <label style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                        padding: '6px 8px', borderRadius: 6, border: '1px dashed #d1d5db',
                                        background: '#fff', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 500,
                                        color: '#6b7280', transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = pc; e.currentTarget.style.color = pc; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280'; }}
                                    >
                                        📤 Trocar imagem
                                        <input type="file" accept="image/*" style={{ display: 'none' }}
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const formData = new FormData();
                                                formData.append('image', file);
                                                const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
                                                try {
                                                    const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
                                                    const data = await res.json();
                                                    if (data.url) api?.updateCarouselSlide(el.carouselPath || el.path, idx, `${API_BASE}${data.url}`);
                                                } catch (err) { console.error('Upload failed:', err); }
                                            }}
                                        />
                                    </label>
                                </div>
                            ))}

                            {/* Add slide */}
                            <button
                                onClick={() => api?.addCarouselSlide(el.carouselPath || el.path)}
                                style={{
                                    width: '100%', padding: '8px', borderRadius: 8,
                                    border: `1px dashed ${pc}`, background: `${pc}08`,
                                    color: pc, fontSize: '0.72rem', fontWeight: 600,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', gap: 4,
                                }}
                            >
                                + Adicionar slide
                            </button>
                        </Section>
                    )}
                </>
            )}

            {/* ── CHART ── */}
            {el.type === 'chart' && (
                <>
                    <Section title="📊 Gráfico" defaultOpen={true}>
                        {/* Chart type badge */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 12px', borderRadius: 8,
                            background: 'linear-gradient(135deg, #eff6ff, #eef2ff)',
                            border: '1px solid #c7d2fe',
                            marginBottom: 12,
                        }}>
                            <span style={{ fontSize: 18 }}>📊</span>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4338ca' }}>
                                    Gráfico de {el.chartType === 'progress' ? 'Progresso' : 'Barras'}
                                </div>
                                <div style={{ fontSize: '0.65rem', color: '#6366f1' }}>
                                    {el.bars?.length || 0} barras detectadas
                                </div>
                            </div>
                        </div>

                        {/* Animation toggle */}
                        <Row label="Animação">
                            <button
                                onClick={() => {
                                    const container = document.querySelector('.cloned-page');
                                    if (!container) return;
                                    const chartEl = container.querySelector(`[data-clone-chart]`);
                                    if (chartEl) {
                                        const bars = chartEl.querySelectorAll('[data-clone-bar]');
                                        bars.forEach(bar => {
                                            if (bar.style.animation) {
                                                bar.style.animation = '';
                                            } else {
                                                bar.style.animation = 'chartBarGrow 1s ease-out forwards';
                                            }
                                        });
                                    }
                                }}
                                style={{
                                    padding: '4px 12px', borderRadius: 6,
                                    border: `1px solid ${pc}`, background: `${pc}10`,
                                    fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', color: pc,
                                }}
                            >▶ Replay</button>
                        </Row>
                    </Section>

                    {/* Per-bar editing */}
                    {el.bars && el.bars.length > 0 && (
                        <Section title="Barras" defaultOpen={true}>
                            {el.bars.map((bar, idx) => (
                                <div key={idx} style={{
                                    padding: '10px', borderRadius: 10,
                                    background: `${bar.color || '#f3f4f6'}15`,
                                    border: '1px solid #e5e7eb',
                                    marginBottom: 8,
                                }}>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4b5563', marginBottom: 6 }}>
                                        Barra {idx + 1}
                                    </div>
                                    
                                    {/* Color */}
                                    <Row label="Cor">
                                        <input type="color" 
                                            defaultValue={rgbToHex(bar.color)}
                                            onChange={e => {
                                                const container = document.querySelector('.cloned-page');
                                                if (!container) return;
                                                const bars = container.querySelectorAll('[data-clone-bar]');
                                                if (bars[idx]) {
                                                    bars[idx].style.backgroundColor = e.target.value;
                                                    onBlockChange?.({ ...step?.blocks?.[0], code: container.parentElement?.innerHTML });
                                                }
                                            }}
                                            style={{ width: 28, height: 28, border: '2px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', padding: 0 }}
                                        />
                                    </Row>

                                    {/* Percentage */}
                                    <Row label="Valor">
                                        <input type="number" 
                                            defaultValue={bar.percentage}
                                            min="0" max="100"
                                            onChange={e => {
                                                const container = document.querySelector('.cloned-page');
                                                if (!container) return;
                                                const bars = container.querySelectorAll('[data-clone-bar]');
                                                if (bars[idx]) {
                                                    const percentEl = [...bars[idx].querySelectorAll('*')].find(el => /\d+%/.test(el.textContent?.trim()));
                                                    if (percentEl) {
                                                        percentEl.textContent = e.target.value + '%';
                                                        onBlockChange?.({ ...step?.blocks?.[0], code: container.parentElement?.innerHTML });
                                                    }
                                                }
                                            }}
                                            style={{ width: 60, padding: '4px 6px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: '0.72rem', textAlign: 'center' }}
                                        />
                                        <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>%</span>
                                    </Row>

                                    {/* Label */}
                                    <div style={{ marginTop: 4 }}>
                                        <input 
                                            defaultValue={bar.label}
                                            onChange={e => {
                                                // Update the label text in the bar element
                                                const container = document.querySelector('.cloned-page');
                                                if (!container) return;
                                                const bars = container.querySelectorAll('[data-clone-bar]');
                                                if (bars[idx]) {
                                                    const labels = bars[idx].querySelectorAll('p, span, div');
                                                    const labelEl = [...labels].filter(l => !(/\d+%/.test(l.textContent?.trim()))).pop();
                                                    if (labelEl) {
                                                        labelEl.textContent = e.target.value;
                                                        onBlockChange?.({ ...step?.blocks?.[0], code: container.parentElement?.innerHTML });
                                                    }
                                                }
                                            }}
                                            placeholder="Texto da barra..."
                                            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: '0.72rem', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </Section>
                    )}
                </>
            )}

            {/* ── PROGRESS BAR GADGET ── */}
            {(el.type === 'progress-bar' || el.gadgetType === 'progress-bar') && (
                <>
                    <Section title="▰ Barra Progresso" defaultOpen={true}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 12px', borderRadius: 8,
                            background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                            border: '1px solid #a7f3d0', marginBottom: 12,
                        }}>
                            <span style={{ fontSize: 18 }}>▰</span>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46' }}>Barra de Progresso</div>
                                <div style={{ fontSize: '0.65rem', color: '#059669' }}>Animação 0→100% + auto-avançar</div>
                            </div>
                        </div>

                        <Row label="Título">
                            <input
                                defaultValue={(() => {
                                    const container = document.querySelector('.cloned-page');
                                    if (!container) return 'Analisando seu perfil...';
                                    const t = container.querySelector('[data-pb-title]');
                                    return t?.textContent || 'Analisando seu perfil...';
                                })()}
                                onInput={e => {
                                    const container = document.querySelector('.cloned-page');
                                    const t = container?.querySelector('[data-pb-title]');
                                    if (t) t.textContent = e.target.value;
                                }}
                                onBlur={() => {
                                    const container = document.querySelector('.cloned-page');
                                    if (container) onBlockChange?.({ ...step?.blocks?.[0], code: container.parentElement?.innerHTML });
                                }}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.75rem', boxSizing: 'border-box', color: '#111', background: '#fff' }}
                                placeholder="Título da barra..."
                            />
                        </Row>

                        <Row label="Duração">
                            <input type="number"
                                defaultValue={5}
                                min={1} max={30}
                                onBlur={e => {
                                    const container = document.querySelector('.cloned-page');
                                    if (!container) return;
                                    const script = container.querySelector('[data-pb-anim]');
                                    if (script) {
                                        const newDur = parseInt(e.target.value) * 1000;
                                        script.textContent = script.textContent.replace(/dur=\d+/, `dur=${newDur}`);
                                        onBlockChange?.({ ...step?.blocks?.[0], code: container.parentElement?.innerHTML });
                                    }
                                }}
                                style={{ width: 55, padding: '4px 6px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.72rem', textAlign: 'center', color: '#111', background: '#fff' }}
                            />
                            <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>seg</span>
                        </Row>
                    </Section>
                </>
            )}

            {/* ── RISK CHART GADGET ── */}
            {(el.type === 'risk-chart' || el.gadgetType === 'risk-chart') && (
                <>
                    <Section title="📉 Gráfico Risco" defaultOpen={true}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 12px', borderRadius: 8,
                            background: 'linear-gradient(135deg, #fef2f2, #fecaca)',
                            border: '1px solid #fca5a5', marginBottom: 12,
                        }}>
                            <span style={{ fontSize: 18 }}>📉</span>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b' }}>Gráfico de Risco</div>
                                <div style={{ fontSize: '0.65rem', color: '#dc2626' }}>Curva animada + auto-avançar</div>
                            </div>
                        </div>

                        <Row label="Título">
                            <input
                                defaultValue={(() => {
                                    const container = document.querySelector('.cloned-page');
                                    if (!container) return 'Seu nível de risco';
                                    const gadget = container.querySelector('[data-gadget-type="risk-chart"]');
                                    const t = gadget?.querySelector('div[style*="font-weight"]');
                                    return t?.textContent || 'Seu nível de risco';
                                })()}
                                onInput={e => {
                                    const container = document.querySelector('.cloned-page');
                                    const gadget = container?.querySelector('[data-gadget-type="risk-chart"]');
                                    const t = gadget?.querySelector('div[style*="font-weight"]');
                                    if (t) t.textContent = e.target.value;
                                }}
                                onBlur={() => {
                                    const container = document.querySelector('.cloned-page');
                                    if (container) onBlockChange?.({ ...step?.blocks?.[0], code: container.parentElement?.innerHTML });
                                }}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.75rem', boxSizing: 'border-box', color: '#111', background: '#fff' }}
                                placeholder="Título do gráfico..."
                            />
                        </Row>

                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#374151', marginBottom: 6, marginTop: 4 }}>Legendas do eixo</div>
                        {['Baixo', 'Aceitável', 'Normal', 'Médio', 'Alto'].map((defaultLabel, idx) => (
                            <div key={idx} style={{ marginBottom: 4 }}>
                                <input
                                    defaultValue={(() => {
                                        const container = document.querySelector('.cloned-page');
                                        if (!container) return defaultLabel;
                                        const svg = container.querySelector('[data-rc-svg]');
                                        if (!svg) return defaultLabel;
                                        const texts = svg.querySelectorAll('text[y="176"]');
                                        return texts[idx]?.textContent || defaultLabel;
                                    })()}
                                    onInput={e => {
                                        const container = document.querySelector('.cloned-page');
                                        const svg = container?.querySelector('[data-rc-svg]');
                                        if (!svg) return;
                                        const texts = svg.querySelectorAll('text[y="176"]');
                                        if (texts[idx]) texts[idx].textContent = e.target.value;
                                    }}
                                    onBlur={() => {
                                        const container = document.querySelector('.cloned-page');
                                        if (container) onBlockChange?.({ ...step?.blocks?.[0], code: container.parentElement?.innerHTML });
                                    }}
                                    style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.72rem', boxSizing: 'border-box', color: '#111', background: '#fff' }}
                                    placeholder={`Label ${idx + 1}`}
                                />
                            </div>
                        ))}

                        <Row label="Label usuário">
                            <input
                                defaultValue={(() => {
                                    const container = document.querySelector('.cloned-page');
                                    if (!container) return 'Você';
                                    const script = container.querySelector('[data-rc-anim]');
                                    if (!script) return 'Você';
                                    const match = script.textContent.match(/font-weight.*?>(.*?)<\/text>/);
                                    return match?.[1] || 'Você';
                                })()}
                                onBlur={e => {
                                    const container = document.querySelector('.cloned-page');
                                    if (!container) return;
                                    const script = container.querySelector('[data-rc-anim]');
                                    if (script) {
                                        script.textContent = script.textContent.replace(/>[\w\u00C0-\u024F]+<\/text>/, `>${e.target.value}</text>`);
                                        onBlockChange?.({ ...step?.blocks?.[0], code: container.parentElement?.innerHTML });
                                    }
                                }}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.75rem', boxSizing: 'border-box', color: '#111', background: '#fff' }}
                                placeholder="Ex: You, Tú, Você..."
                            />
                        </Row>

                        <Row label="Duração">
                            <input type="number"
                                defaultValue={3}
                                min={1} max={15}
                                onBlur={e => {
                                    const container = document.querySelector('.cloned-page');
                                    if (!container) return;
                                    const script = container.querySelector('[data-rc-anim]');
                                    if (script) {
                                        const newDur = parseInt(e.target.value) * 1000;
                                        script.textContent = script.textContent.replace(/dur=\d+/, `dur=${newDur}`);
                                        onBlockChange?.({ ...step?.blocks?.[0], code: container.parentElement?.innerHTML });
                                    }
                                }}
                                style={{ width: 55, padding: '4px 6px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.72rem', textAlign: 'center', color: '#111', background: '#fff' }}
                            />
                            <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>seg</span>
                        </Row>
                    </Section>
                </>
            )}
        </div>
    );
}
