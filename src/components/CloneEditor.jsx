// CloneEditor.jsx — Specialized editor for cloned HTML pages
// Full-height scrollable preview with hover highlights and click selection
// Selected element info is emitted to parent for right-panel editing
import { useState, useRef, useCallback, useEffect } from 'react';
import { MousePointerClick, Plus } from 'lucide-react';

// ── Identify element type ──
function getElementType(el) {
    if (!el) return null;
    const tag = el.tagName?.toLowerCase();
    const cls = el.className?.toString?.() || '';
    const role = el.getAttribute?.('role');

    if (tag === 'style' || tag === 'script' || tag === 'link' || tag === 'meta' || tag === 'head') return null;

    // Gadget type detection (native components inserted into cloned pages)
    const gadgetType = el.getAttribute?.('data-gadget-type') || el.closest?.('[data-gadget-type]')?.getAttribute?.('data-gadget-type');
    if (gadgetType === 'progress-bar') return 'progress-bar';
    if (gadgetType === 'risk-chart') return 'risk-chart';

    // Carousel detection
    if (el.hasAttribute?.('data-carousel')) return 'carousel';

    // Chart detection: data attributes from server-side detection OR SVG/canvas
    if (el.hasAttribute?.('data-clone-chart') || el.hasAttribute?.('data-clone-type')) return 'chart';
    if (el.closest?.('[data-clone-chart]') && el.hasAttribute?.('data-clone-bar')) return 'chart';
    if (tag === 'svg' || tag === 'canvas') return 'chart';

    // Detect div-based bar charts: colored containers with percentage text
    if ((tag === 'div' || tag === 'section') && el.children?.length >= 2 && el.children?.length <= 8) {
        let coloredKids = 0;
        let hasPercent = false;
        [...el.children].forEach(ch => {
            try {
                const bg = window.getComputedStyle(ch).backgroundColor;
                if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== 'rgb(255, 255, 255)') coloredKids++;
                if (/\d+%/.test(ch.textContent?.trim())) hasPercent = true;
            } catch {}
        });
        if (coloredKids >= 2 && hasPercent) return 'chart';
    }

    if (tag === 'button' || role === 'button' ||
        cls.includes('btn') || cls.includes('cta') || cls.includes('submit') ||
        cls.includes('button')) return 'button';

    if (tag === 'a' && el.textContent?.trim()) return 'button';
    if (tag === 'img') return 'image';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'input';

    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label', 'strong', 'em', 'b', 'i', 'li'].includes(tag)) {
        if (el.textContent?.trim()) return 'text';
    }

    if (tag === 'div' || tag === 'section' || tag === 'article') {
        const text = el.textContent?.trim();
        const style = window.getComputedStyle(el);
        const hasBg = style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';
        const hasBorder = style.border && !style.border.includes('0px');
        // If it's a container with visual styling, treat as container
        if ((hasBg || hasBorder) && el.children.length > 0) return 'container';
        // If it has text and few block children, treat as text
        if (text && text.length > 0 && text.length < 500) {
            const blockChildren = el.querySelectorAll('div, section, article, main, header, footer, nav');
            if (blockChildren.length <= 2) return 'text';
        }
    }

    return null;
}

function getComputedStyles(el) {
    if (!el) return {};
    try {
        const cs = window.getComputedStyle(el);
        return {
            color: cs.color,
            fontSize: cs.fontSize,
            fontFamily: cs.fontFamily?.split(',')[0]?.replace(/["']/g, '').trim(),
            fontWeight: cs.fontWeight,
            textAlign: cs.textAlign,
            backgroundColor: cs.backgroundColor,
            borderRadius: cs.borderRadius,
            padding: cs.padding,
        };
    } catch { return {}; }
}

function findEditableElement(target, container) {
    // If inside a native gadget, select the gadget container
    const gadgetParent = target.closest?.('[data-gadget-type]');
    if (gadgetParent && container.contains(gadgetParent)) {
        const gType = gadgetParent.getAttribute('data-gadget-type');
        // Return specific types for animated gadgets so they get custom editing panels
        if (gType === 'progress-bar' || gType === 'risk-chart') {
            return { el: gadgetParent, type: gType, gadgetType: gType };
        }
        return { el: gadgetParent, type: 'gadget', gadgetType: gType };
    }
    // If inside a quiz picker, always select the picker container
    const pickerParent = target.closest?.('[data-quiz-picker]');
    if (pickerParent && container.contains(pickerParent)) {
        return { el: pickerParent, type: 'picker' };
    }
    // If inside a carousel, always select the carousel container
    const carouselParent = target.closest?.('[data-carousel]');
    if (carouselParent && container.contains(carouselParent)) {
        return { el: carouselParent, type: 'carousel' };
    }
    let el = target;
    for (let i = 0; i < 8; i++) {
        if (!el || el === container) return null;
        const type = getElementType(el);
        if (type) return { el, type };
        el = el.parentElement;
    }
    return null;
}

function getElementPath(el, container) {
    const path = [];
    let cur = el;
    while (cur && cur !== container) {
        const parent = cur.parentElement;
        if (!parent) break;
        const siblings = Array.from(parent.children).filter(c => c.tagName === cur.tagName);
        const index = siblings.indexOf(cur);
        path.unshift(`${cur.tagName.toLowerCase()}[${index}]`);
        cur = parent;
    }
    return path.join('/');
}

function findByPath(container, path) {
    if (!path || !container) return null;
    const parts = path.split('/');
    let cur = container;
    for (const part of parts) {
        const match = part.match(/^(\w+)\[(\d+)\]$/);
        if (!match) return null;
        const [, tag, idx] = match;
        const children = Array.from(cur.children).filter(c => c.tagName.toLowerCase() === tag);
        cur = children[parseInt(idx)];
        if (!cur) return null;
    }
    return cur;
}

// ── Insertable element templates ──
export const INSERTABLE_ELEMENTS = [
    { id: 'spacer', icon: '↕️', label: 'Espaço', cat: 'layout', html: '<div style="height:32px"></div>' },
    { id: 'divider', icon: '➖', label: 'Divisor', cat: 'layout', html: '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>' },
    { id: 'text', icon: '📝', label: 'Texto', cat: 'content', html: '<p style="padding:8px 16px;font-size:16px;line-height:1.6;color:inherit">Seu texto aqui</p>' },
    { id: 'button', icon: '🔘', label: 'Botão', cat: 'content', html: '<button style="display:block;width:80%;margin:12px auto;padding:14px 24px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;text-align:center">Clique aqui</button>' },
    { id: 'image', icon: '🖼️', label: 'Imagem', cat: 'content', html: '<img src="https://placehold.co/600x200/e5e7eb/999?text=Sua+imagem" style="width:100%;max-width:100%;height:auto;display:block;margin:8px 0;border-radius:8px"/>' },
    { id: 'email-field', icon: '📧', label: 'Campo Email', cat: 'form', html: '<div style="padding:8px 16px;margin:8px 0"><label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:inherit">Seu e-mail</label><input type="email" placeholder="seu@email.com" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid #d1d5db;font-size:15px;outline:none;box-sizing:border-box"/></div>' },
    { id: 'name-field', icon: '👤', label: 'Campo Nome', cat: 'form', html: '<div style="padding:8px 16px;margin:8px 0"><label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:inherit">Seu nome</label><input type="text" placeholder="Nome completo" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid #d1d5db;font-size:15px;outline:none;box-sizing:border-box"/></div>' },
    { id: 'phone-field', icon: '📱', label: 'Campo Telefone', cat: 'form', html: '<div style="padding:8px 16px;margin:8px 0"><label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:inherit">Seu WhatsApp</label><input type="tel" placeholder="(00) 00000-0000" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid #d1d5db;font-size:15px;outline:none;box-sizing:border-box"/></div>' },
    { id: 'bar-chart', icon: '📊', label: 'Gráfico Barras', cat: 'chart', html: '<div style="padding:16px;margin:10px 0"><div style="font-size:14px;font-weight:700;margin-bottom:12px;text-align:center;color:inherit">Seus Resultados</div><div style="display:flex;align-items:flex-end;gap:8px;height:120px;padding:0 10px"><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:100%;background:linear-gradient(to top,#6366f1,#818cf8);border-radius:6px 6px 0 0;height:80%"></div><span style="font-size:11px;font-weight:600">Item A</span></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:100%;background:linear-gradient(to top,#f59e0b,#fbbf24);border-radius:6px 6px 0 0;height:55%"></div><span style="font-size:11px;font-weight:600">Item B</span></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:100%;background:linear-gradient(to top,#10b981,#34d399);border-radius:6px 6px 0 0;height:90%"></div><span style="font-size:11px;font-weight:600">Item C</span></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:100%;background:linear-gradient(to top,#ef4444,#f87171);border-radius:6px 6px 0 0;height:40%"></div><span style="font-size:11px;font-weight:600">Item D</span></div></div></div>' },
    { id: 'donut-chart', icon: '🍩', label: 'Gráfico Donut', cat: 'chart', html: '<div style="padding:16px;margin:10px 0;text-align:center"><div style="font-size:14px;font-weight:700;margin-bottom:12px;color:inherit">Estatísticas</div><div style="width:120px;height:120px;border-radius:50%;background:conic-gradient(#6366f1 0% 35%,#f59e0b 35% 60%,#10b981 60% 85%,#e5e7eb 85% 100%);margin:0 auto;position:relative"><div style="position:absolute;inset:25%;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#111">87%</div></div><div style="display:flex;justify-content:center;gap:12px;margin-top:12px;font-size:11px;font-weight:600"><span>🟣 35%</span><span>🟡 25%</span><span>🟢 25%</span></div></div>' },
];

// ═══ CLONE EDITOR ═══
// ── Gadget text translations ──
const GADGET_I18N = {
    'Seu texto aqui': { en: 'Your text here', es: 'Tu texto aquí', fr: 'Votre texte ici', de: 'Ihr Text hier', it: 'Il tuo testo qui' },
    'Clique aqui': { en: 'Click here', es: 'Haz clic aquí', fr: 'Cliquez ici', de: 'Hier klicken', it: 'Clicca qui' },
    'Analisando seu perfil...': { en: 'Analyzing your profile...', es: 'Analizando tu perfil...', fr: 'Analyse de votre profil...', de: 'Ihr Profil wird analysiert...', it: 'Analisi del profilo...' },
    'Analisando...': { en: 'Analyzing...', es: 'Analizando...', fr: 'Analyse...', de: 'Analysiere...', it: 'Analisi...' },
    'Resultados': { en: 'Results', es: 'Resultados', fr: 'Résultats', de: 'Ergebnisse', it: 'Risultati' },
    'Pergunta 1?': { en: 'Question 1?', es: '¿Pregunta 1?', fr: 'Question 1?', de: 'Frage 1?', it: 'Domanda 1?' },
    'Pergunta 2?': { en: 'Question 2?', es: '¿Pregunta 2?', fr: 'Question 2?', de: 'Frage 2?', it: 'Domanda 2?' },
    'Resposta aqui.': { en: 'Answer here.', es: 'Respuesta aquí.', fr: 'Réponse ici.', de: 'Antwort hier.', it: 'Risposta qui.' },
    'Premium': { en: 'Premium', es: 'Premium', fr: 'Premium', de: 'Premium', it: 'Premium' },
    'pagamento único': { en: 'one-time payment', es: 'pago único', fr: 'paiement unique', de: 'Einmalzahlung', it: 'pagamento unico' },
    'Quero agora': { en: 'Get it now', es: 'Lo quiero ahora', fr: 'Je le veux', de: 'Jetzt kaufen', it: 'Lo voglio ora' },
    'Maria S.': { en: 'Maria S.', es: 'María S.', fr: 'Marie S.', de: 'Maria S.', it: 'Maria S.' },
    'Resultado incrível! Recomendo demais.': { en: 'Incredible result! Highly recommend.', es: '¡Resultado increíble! Lo recomiendo mucho.', fr: 'Résultat incroyable! Je recommande.', de: 'Unglaubliches Ergebnis! Sehr empfehlenswert.', it: 'Risultato incredibile! Lo consiglio.' },
    'ANTES': { en: 'BEFORE', es: 'ANTES', fr: 'AVANT', de: 'VORHER', it: 'PRIMA' },
    'DEPOIS': { en: 'AFTER', es: 'DESPUÉS', fr: 'APRÈS', de: 'NACHHER', it: 'DOPO' },
    'Seu nível de risco': { en: 'Your risk level', es: 'Tu nivel de riesgo', fr: 'Votre niveau de risque', de: 'Ihr Risikoniveau', it: 'Il tuo livello di rischio' },
    'Baixo': { en: 'Low', es: 'Bajo', fr: 'Faible', de: 'Niedrig', it: 'Basso' },
    'Aceitável': { en: 'Acceptable', es: 'Aceptable', fr: 'Acceptable', de: 'Akzeptabel', it: 'Accettabile' },
    'Normal': { en: 'Normal', es: 'Normal', fr: 'Normal', de: 'Normal', it: 'Normale' },
    'Médio': { en: 'Medium', es: 'Medio', fr: 'Moyen', de: 'Mittel', it: 'Medio' },
    'Alto': { en: 'High', es: 'Alto', fr: 'Élevé', de: 'Hoch', it: 'Alto' },
    'Você': { en: 'You', es: 'Tú', fr: 'Vous', de: 'Sie', it: 'Tu' },
};

export function translateGadgetHtml(html, lang) {
    if (!lang || lang === 'original' || lang === 'pt') return html;
    let result = html;
    for (const [pt, translations] of Object.entries(GADGET_I18N)) {
        if (translations[lang]) {
            result = result.split(pt).join(translations[lang]);
        }
    }
    return result;
}

export default function CloneEditor({ block, onBlockChange, stepName, primaryColor, onElementSelect, lang }) {
    const containerRef = useRef(null);
    const [hoverHighlight, setHoverHighlight] = useState(null);
    const [selectedPath, setSelectedPath] = useState(null);
    const [showInsert, setShowInsert] = useState(false);
    const [dropIndicatorY, setDropIndicatorY] = useState(null);
    const [showReplacePicker, setShowReplacePicker] = useState(false);
    const [selectionRect, setSelectionRect] = useState(null);
    const pc = primaryColor || '#6c63ff';

    // ── Sanitize cloned HTML: remove download triggers, prevent link navigation ──
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        // Remove download attributes from <a> tags
        container.querySelectorAll('a[download]').forEach(a => a.removeAttribute('download'));
        // Prevent <a> tags from navigating or downloading
        container.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (href && href !== '#' && !href.startsWith('javascript:')) {
                a.setAttribute('data-original-href', href);
                a.setAttribute('href', 'javascript:void(0)');
            }
        });
        // Remove potentially dangerous script tags
        container.querySelectorAll('script').forEach(s => s.remove());
    }, [block?.code]);

    // ── Insert element into HTML ──
    const insertElement = useCallback((htmlSnippet) => {
        const container = containerRef.current;
        if (!container) return;
        const clonedPage = container.querySelector('.cloned-page') || container;
        clonedPage.insertAdjacentHTML('beforeend', htmlSnippet);
        onBlockChange?.({ ...block, code: container.innerHTML, fullCode: container.innerHTML });
        setShowInsert(false);
    }, [block, onBlockChange]);

    // ── Ref for drop target element ──
    const dropTargetRef = useRef(null); // { el, position: 'beforebegin'|'afterend' }

    // ── Insert element relative to a target element ──
    const insertElementNear = useCallback((htmlSnippet) => {
        const container = containerRef.current;
        if (!container) return;
        const target = dropTargetRef.current;
        if (target?.el && container.contains(target.el)) {
            target.el.insertAdjacentHTML(target.position, htmlSnippet);
        } else {
            // Fallback: append at end
            const clonedPage = container.querySelector('.cloned-page') || container;
            clonedPage.insertAdjacentHTML('beforeend', htmlSnippet);
        }
        onBlockChange?.({ ...block, code: container.innerHTML, fullCode: container.innerHTML });
    }, [block, onBlockChange]);

    const handleClick = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        const container = containerRef.current;
        if (!container) return;

        const result = findEditableElement(e.target, container);
        if (!result) {
            setSelectedPath(null);
            onElementSelect?.(null);
            return;
        }

        const elPath = getElementPath(result.el, container);
        setSelectedPath(elPath);

        const rect = result.el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        onElementSelect?.({
            path: elPath,
            type: result.type,
            text: result.el.textContent || '',
            innerHTML: result.el.innerHTML || '',
            src: result.type === 'image' ? result.el.src : '',
            alt: result.type === 'image' ? result.el.alt : '',
            tagName: result.el.tagName?.toLowerCase(),
            styles: getComputedStyles(result.el),
            // Gadget-specific data
            gadgetType: result.el.getAttribute?.('data-gadget-type') || result.el.closest?.('[data-gadget-type]')?.getAttribute?.('data-gadget-type') || null,
            gadgetEl: result.el.closest?.('[data-gadget-type]') || (result.el.hasAttribute?.('data-gadget-type') ? result.el : null),
            rect: {
                top: rect.top - containerRect.top + container.scrollTop,
                left: rect.left - containerRect.left,
                width: rect.width,
                height: rect.height,
            },
            // ── Picker data extraction ──
            ...(result.type === 'picker' ? (() => {

                const pickerEl = result.el;
                return {
                    pickerType: pickerEl.getAttribute('data-quiz-picker'),
                    pickerMin: parseInt(pickerEl.getAttribute('data-min')) || 0,
                    pickerMax: parseInt(pickerEl.getAttribute('data-max')) || 300,
                    pickerUnit: pickerEl.getAttribute('data-unit') || '',
                    pickerDefault: parseInt(pickerEl.getAttribute('data-default')) || 0,
                    pickerVisualStyle: pickerEl.getAttribute('data-visual-style') || 'drum',
                    pickerQuestion: pickerEl.getAttribute('data-question') || '',
                    pickerPath: getElementPath(pickerEl, container),
                };
            })() : {}),
            // ── Gadget data extraction ──
            ...(result.type === 'gadget' ? {
                gadgetType: result.gadgetType || result.el.getAttribute('data-gadget-type'),
                gadgetPath: elPath,
            } : {}),
            // ── Chart data extraction ──
            // ── Carousel data extraction ──
            ...(result.type === 'carousel' ? (() => {
                const carouselEl = result.el;
                const orientation = carouselEl.getAttribute('data-orientation') || 'horizontal';
                // In horizontal mode, slides might be inside a wrapper
                const wrapper = carouselEl.querySelector('[data-carousel-wrapper]');
                const slideSource = wrapper || carouselEl;
                const slideEls = [...slideSource.children].filter(ch => ch.tagName !== 'DIV' || !ch.style?.fontStyle?.includes('italic'));
                const slides = slideEls.filter(ch => {
                    return ch.querySelector?.('img') || (ch.style?.height && parseInt(ch.style.height) > 50);
                }).map((slide, idx) => {
                    const img = slide.querySelector('img');
                    return {
                        index: idx,
                        src: img?.src || '',
                        alt: img?.alt || `Slide ${idx + 1}`,
                    };
                });
                return { orientation, slides, carouselPath: getElementPath(carouselEl, container) };
            })() : {}),
            // ── Chart data extraction ──
            ...(result.type === 'chart' ? (() => {
                const chartEl = result.el.closest?.('[data-clone-chart]') || result.el;
                const chartType = chartEl.getAttribute?.('data-clone-chart') || 'bar';
                const bars = [...chartEl.querySelectorAll('[data-clone-bar]')];
                const barData = bars.length > 0 ? bars.map((bar, idx) => {
                    const s = window.getComputedStyle(bar);
                    const percentMatch = bar.textContent?.match(/(\d+)%/);
                    const labelEl = bar.querySelector('*:last-child') || bar;
                    // Find text that isn't the percentage
                    const allText = bar.textContent?.trim() || '';
                    const labelText = allText.replace(/\d+%/g, '').trim();
                    return {
                        index: idx,
                        color: s.backgroundColor,
                        percentage: percentMatch ? parseInt(percentMatch[1]) : 0,
                        label: labelText.split('\n').filter(t => t.trim()).pop() || `Bar ${idx + 1}`,
                        width: parseFloat(s.width),
                        height: parseFloat(s.height),
                    };
                }) : [...chartEl.children].filter(ch => {
                    const bg = window.getComputedStyle(ch).backgroundColor;
                    return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== 'rgb(255, 255, 255)';
                }).map((ch, idx) => {
                    const s = window.getComputedStyle(ch);
                    const percentMatch = ch.textContent?.match(/(\d+)%/);
                    const allText = ch.textContent?.trim() || '';
                    const labelText = allText.replace(/\d+%/g, '').trim();
                    return {
                        index: idx,
                        color: s.backgroundColor,
                        percentage: percentMatch ? parseInt(percentMatch[1]) : 0,
                        label: labelText.split('\n').filter(t => t.trim()).pop() || `Bar ${idx + 1}`,
                        width: parseFloat(s.width),
                        height: parseFloat(s.height),
                    };
                });
                return { chartType, bars: barData, chartPath: getElementPath(chartEl, container) };
            })() : {}),
        });
        // Track selection rect for floating toolbar
        if (result) {
            const rect = result.el.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            setSelectionRect({
                top: rect.top - containerRect.top + container.scrollTop,
                left: rect.left - containerRect.left,
                width: rect.width,
                height: rect.height,
            });
        } else {
            setSelectionRect(null);
        }
        setShowReplacePicker(false);
    }, [onElementSelect]);

    const handleMouseMove = useCallback((e) => {
        const container = containerRef.current;
        if (!container) return;
        const result = findEditableElement(e.target, container);
        if (result) {
            const rect = result.el.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            setHoverHighlight({
                type: result.type,
                top: rect.top - containerRect.top + container.scrollTop,
                left: rect.left - containerRect.left,
                width: rect.width,
                height: rect.height,
            });
        } else {
            setHoverHighlight(null);
        }
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.querySelectorAll('[data-clone-sel]').forEach(el => {
            el.style.outline = '';
            el.style.outlineOffset = '';
            el.removeAttribute('data-clone-sel');
        });
        if (selectedPath) {
            const el = findByPath(container, selectedPath);
            if (el) {
                el.style.outline = `2px solid ${pc}`;
                el.style.outlineOffset = '3px';
                el.setAttribute('data-clone-sel', '1');
            }
        }
    }, [selectedPath, pc, block.code]);

    useEffect(() => {
        window.__cloneEditorApi = {
            updateText: (path, newText) => {
                const container = containerRef.current;
                if (!container) return;
                const el = findByPath(container, path);
                if (el) {
                    el.textContent = newText;
                    onBlockChange?.({ ...block, code: container.innerHTML, fullCode: container.innerHTML });
                }
            },
            updateImage: (path, newSrc) => {
                const container = containerRef.current;
                if (!container) return;
                const el = findByPath(container, path);
                if (el && el.tagName === 'IMG') {
                    el.src = newSrc;
                    onBlockChange?.({ ...block, code: container.innerHTML, fullCode: container.innerHTML });
                }
            },
            deleteElement: (path) => {
                const container = containerRef.current;
                if (!container) return;
                const el = findByPath(container, path);
                if (el) {
                    el.remove();
                    onBlockChange?.({ ...block, code: container.innerHTML, fullCode: container.innerHTML });
                    setSelectedPath(null);
                    onElementSelect?.(null);
                }
            },
            setButtonAction: (path, action) => {
                const container = containerRef.current;
                // Stamp data-cta-url directly on the DOM element so it's baked into saved HTML
                if (container) {
                    const el = findByPath(container, path);
                    if (el) {
                        if (action.action === 'cta' && action.ctaUrl) {
                            el.setAttribute('data-cta-url', action.ctaUrl);
                        } else {
                            el.removeAttribute('data-cta-url');
                        }
                    }
                }
                const newActions = { ...(block.buttonActions || {}), [path]: action };
                onBlockChange?.({ ...block, buttonActions: newActions, code: container?.innerHTML, fullCode: container?.innerHTML });
            },
            updateStyle: (path, cssObj) => {
                const container = containerRef.current;
                if (!container) return;
                const el = findByPath(container, path);
                if (el) {
                    Object.entries(cssObj).forEach(([prop, val]) => {
                        el.style[prop] = val;
                    });
                    onBlockChange?.({ ...block, code: container.innerHTML, fullCode: container.innerHTML });
                }
            },
            insertElement: (htmlSnippet) => insertElement(htmlSnippet),
            replaceElement: (path, htmlSnippet) => {
                const container = containerRef.current;
                if (!container) return;
                const el = findByPath(container, path);
                if (el) {
                    const isGadget = el.hasAttribute?.('data-gadget-type') || htmlSnippet.includes('data-gadget-type');
                    const origRect = el.getBoundingClientRect();
                    el.insertAdjacentHTML('afterend', htmlSnippet);
                    const newEl = el.nextElementSibling;
                    if (newEl) {
                        newEl.style.width = '100%';
                        newEl.style.boxSizing = 'border-box';
                    }
                    el.remove();
                    onBlockChange?.({ ...block, code: container.innerHTML, fullCode: container.innerHTML });
                    // Don't deselect for gadget replacements — the parent handles re-selection
                    if (!isGadget) {
                        setSelectedPath(null);
                        onElementSelect?.(null);
                    }
                }
            },
            updatePickerAttr: (path, attrs) => {
                const container = containerRef.current;
                if (!container) return;
                const el = findByPath(container, path);
                if (!el) return;
                Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
                const vs = attrs['data-visual-style'] || el.getAttribute('data-visual-style') || 'drum';
                const unit = attrs['data-unit'] || el.getAttribute('data-unit') || '';
                const def = parseInt(attrs['data-default'] || el.getAttribute('data-default')) || 70;
                const min = parseInt(attrs['data-min'] || el.getAttribute('data-min')) || 0;
                const max = parseInt(attrs['data-max'] || el.getAttribute('data-max')) || 300;
                const pType = el.getAttribute('data-quiz-picker') || 'height';
                const color = pType === 'weight' ? '#10b981' : '#6366f1';
                const question = attrs['data-question'] !== undefined ? attrs['data-question'] : (el.getAttribute('data-question') || '');
                let inner = question ? `<div style="font-size:14px;font-weight:700;color:#1a2332;margin-bottom:8px">${question}</div>` : '';
                if (vs === 'drum') {
                    inner += `<div style="position:relative;height:180px;overflow:hidden;border-radius:10px;background:linear-gradient(to bottom,rgba(0,0,0,0.06),transparent 25%,transparent 75%,rgba(0,0,0,0.06))"><div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:36px;background:${color}12;border-top:2px solid ${color};border-bottom:2px solid ${color};z-index:1"></div><div style="display:flex;flex-direction:column;align-items:center;padding-top:50px">`;
                    for (let i = def - 3; i <= def + 3; i++) {
                        const isCur = i === def;
                        inner += `<div style="height:24px;font-size:${isCur ? 20 : 14}px;font-weight:${isCur ? 800 : 400};color:${isCur ? color : '#9ca3af'}">${i}</div>`;
                    }
                    inner += `</div></div><div style="margin-top:6px;font-size:16px;font-weight:800;color:${color}">${def} ${unit}</div>`;
                } else if (vs === 'ruler') {
                    inner += `<div style="font-size:36px;font-weight:800;color:#1a2332;margin-bottom:4px;text-align:center">${def}<span style="font-size:16px;font-weight:600;color:#9ca3af;margin-left:4px">${unit}</span></div>`;
                    inner += `<div style="display:flex;align-items:flex-end;height:60px;width:100%;padding:0">`;
                    for (let i = def - 20; i <= def + 20; i++) {
                        const isMajor = i % 10 === 0, isMid = i % 5 === 0, isCur = i === def;
                        const h = isCur ? 44 : isMajor ? 36 : isMid ? 24 : 14;
                        const w = isCur ? 3 : 1.5;
                        const bg = isCur ? color : isMajor ? '#6b7280' : '#d1d5db';
                        inner += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end"><div style="width:${w}px;height:${h}px;background:${bg};border-radius:1px"></div>`;
                        if (isMajor) inner += `<div style="font-size:9px;color:#9ca3af;margin-top:2px">${i}</div>`;
                        inner += `</div>`;
                    }
                    inner += `</div><div style="font-size:11px;color:#9ca3af;margin-top:6px;text-align:center">Arraste para ajustar</div>`;
                } else if (vs === 'slider') {
                    const pct = Math.round(((def - min) / (max - min)) * 100);
                    inner += `<div style="font-size:36px;font-weight:800;color:${color};margin-bottom:16px;text-align:center">${def} <span style="font-size:16px;font-weight:600;color:#9ca3af">${unit}</span></div>`;
                    inner += `<div style="position:relative;height:10px;background:#e5e7eb;border-radius:5px;margin:0 16px"><div style="height:100%;width:${pct}%;background:${color};border-radius:5px"></div><div style="position:absolute;top:50%;left:${pct}%;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:#fff;border:3px solid ${color};box-shadow:0 2px 8px rgba(0,0,0,0.15)"></div></div>`;
                    inner += `<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:12px;color:#9ca3af;padding:0 16px"><span>${min} ${unit}</span><span>${max} ${unit}</span></div>`;
                } else if (vs === 'input') {
                    inner += `<div style="display:flex;align-items:center;justify-content:center;gap:20px;margin-top:8px"><div style="width:48px;height:48px;border-radius:14px;background:#f1f5f9;border:2px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#9ca3af">−</div><div style="text-align:center;min-width:80px"><div style="font-size:40px;font-weight:800;color:#1a2332;line-height:1">${def}</div><div style="font-size:14px;font-weight:600;color:#9ca3af;margin-top:2px">${unit}</div></div><div style="width:48px;height:48px;border-radius:14px;background:${color};display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff">+</div></div>`;
                }
                el.innerHTML = inner;
                onBlockChange?.({ ...block, code: container.innerHTML, fullCode: container.innerHTML });
                // Re-trigger element selection so the panel updates with new style
                const elPath = getElementPath(el, container);
                const rect = el.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                onElementSelect?.({
                    path: elPath,
                    type: 'picker',
                    text: el.textContent || '',
                    innerHTML: el.innerHTML || '',
                    tagName: el.tagName?.toLowerCase(),
                    styles: getComputedStyles(el),
                    rect: { top: rect.top - containerRect.top + container.scrollTop, left: rect.left - containerRect.left, width: rect.width, height: rect.height },
                    pickerType: el.getAttribute('data-quiz-picker'),
                    pickerMin: parseInt(el.getAttribute('data-min')) || 0,
                    pickerMax: parseInt(el.getAttribute('data-max')) || 300,
                    pickerUnit: el.getAttribute('data-unit') || '',
                    pickerDefault: parseInt(el.getAttribute('data-default')) || 0,
                    pickerVisualStyle: el.getAttribute('data-visual-style') || 'drum',
                    pickerQuestion: el.getAttribute('data-question') || '',
                    pickerPath: elPath,
                });
            },
            updateCarouselSlide: (carouselPath, slideIdx, newSrc) => {
                const container = containerRef.current;
                if (!container) return;
                const carousel = findByPath(container, carouselPath);
                if (!carousel) return;
                const wrapper = carousel.querySelector('[data-carousel-wrapper]');
                const slideSource = wrapper || carousel;
                const slides = [...slideSource.children].filter(ch => ch.querySelector?.('img'));
                if (slides[slideIdx]) {
                    const img = slides[slideIdx].querySelector('img');
                    if (img) {
                        img.src = newSrc;
                        onBlockChange?.({ ...block, code: container.innerHTML, fullCode: container.innerHTML });
                    }
                }
            },
            _reselectCarousel: (carouselPath) => {
                const container = containerRef.current;
                if (!container) return;
                const carousel = findByPath(container, carouselPath);
                if (!carousel) return;
                const orientation = carousel.getAttribute('data-orientation') || 'horizontal';
                const wrapper = carousel.querySelector('[data-carousel-wrapper]');
                const slideSource = wrapper || carousel;
                const slides = [...slideSource.children].filter(ch => ch.querySelector?.('img')).map((slide, idx) => {
                    const img = slide.querySelector('img');
                    return { index: idx, src: img?.src || '', alt: img?.alt || `Slide ${idx + 1}` };
                });
                const rect = carousel.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                onElementSelect?.({
                    path: carouselPath,
                    type: 'carousel',
                    text: '',
                    innerHTML: carousel.innerHTML,
                    tagName: carousel.tagName?.toLowerCase(),
                    styles: {},
                    rect: {
                        top: rect.top - containerRect.top + container.scrollTop,
                        left: rect.left - containerRect.left,
                        width: rect.width,
                        height: rect.height,
                    },
                    orientation,
                    slides,
                    carouselPath,
                });
            },
            setCarouselOrientation: (carouselPath, orientation) => {
                const container = containerRef.current;
                if (!container) return;
                const carousel = findByPath(container, carouselPath);
                if (!carousel) return;
                carousel.setAttribute('data-orientation', orientation);
                
                // Clean up any existing auto-play interval
                if (carousel._carouselInterval) { clearInterval(carousel._carouselInterval); carousel._carouselInterval = null; }
                // Remove existing dots container
                const oldDots = carousel.querySelector('[data-carousel-dots]');
                if (oldDots) oldDots.remove();
                // Unwrap slides if they were in a wrapper
                const oldWrapper = carousel.querySelector('[data-carousel-wrapper]');
                if (oldWrapper) {
                    const slides = [...oldWrapper.children];
                    oldWrapper.remove();
                    slides.forEach(s => carousel.appendChild(s));
                }
                
                if (orientation === 'horizontal') {
                    const slides = [...carousel.children].filter(ch => ch.querySelector?.('img'));
                    if (slides.length < 1) return;
                    
                    // Hide hint text
                    [...carousel.children].forEach(ch => {
                        if (ch.style?.fontStyle?.includes('italic')) ch.style.display = 'none';
                    });
                    // Hide numbering badges
                    slides.forEach(slide => {
                        slide.querySelectorAll('div').forEach(d => { if (/^\d+\/\d+$/.test((d.textContent||'').trim())) d.style.display = 'none'; });
                    });
                    
                    // Setup carousel container
                    carousel.style.cssText = 'position:relative;overflow:hidden;width:100%;padding:0;display:block;height:420px;background:#000;border-radius:12px;';
                    
                    // Create wrapper
                    const wrapper = document.createElement('div');
                    wrapper.setAttribute('data-carousel-wrapper', 'true');
                    wrapper.style.cssText = 'display:flex;flex-direction:row;transition:transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94);will-change:transform;height:100%;';
                    
                    slides.forEach(slide => {
                        slide.style.cssText = 'min-width:100%;width:100%;height:100%;flex-shrink:0;border:none;border-radius:0;margin:0;padding:0;position:relative;overflow:hidden;background:#000;';
                        const img = slide.querySelector('img');
                        if (img) { img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;'; }
                        wrapper.appendChild(slide);
                    });
                    carousel.appendChild(wrapper);
                    
                    // Create dots
                    let curSlide = 0;
                    const dotsContainer = document.createElement('div');
                    dotsContainer.setAttribute('data-carousel-dots', 'true');
                    dotsContainer.style.cssText = 'position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:10;';
                    
                    const dots = [];
                    for (let i = 0; i < slides.length; i++) {
                        const dot = document.createElement('div');
                        dot.style.cssText = `width:10px;height:10px;border-radius:50%;cursor:pointer;transition:all 0.3s;box-shadow:0 1px 4px rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.9);background:${i === 0 ? '#fff' : 'rgba(255,255,255,0.35)'};`;
                        dot.addEventListener('click', (e) => { e.stopPropagation(); goTo(i); });
                        dots.push(dot);
                        dotsContainer.appendChild(dot);
                    }
                    carousel.appendChild(dotsContainer);
                    
                    function goTo(idx) {
                        curSlide = idx;
                        wrapper.style.transform = `translateX(-${idx * 100}%)`;
                        dots.forEach((d, di) => {
                            d.style.background = di === idx ? '#fff' : 'rgba(255,255,255,0.35)';
                            d.style.transform = di === idx ? 'scale(1.3)' : 'scale(1)';
                        });
                    }
                    
                    // Auto-play
                    carousel._carouselInterval = setInterval(() => { goTo((curSlide + 1) % slides.length); }, 3500);
                    carousel.addEventListener('mouseenter', () => { if (carousel._carouselInterval) { clearInterval(carousel._carouselInterval); carousel._carouselInterval = null; } });
                    carousel.addEventListener('mouseleave', () => { carousel._carouselInterval = setInterval(() => { goTo((curSlide + 1) % slides.length); }, 3500); });
                    
                } else {
                    // Vertical mode — stacked slides for editing
                    carousel.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:8px;width:100%;height:auto;overflow:visible;';
                    [...carousel.children].filter(ch => ch.querySelector?.('img')).forEach(slide => {
                        slide.style.cssText = 'width:100%;height:200px;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;position:relative;';
                        const img = slide.querySelector('img');
                        if (img) { img.style.cssText = 'width:100%;height:100%;object-fit:cover;'; }
                        // Re-show badges
                        slide.querySelectorAll('div').forEach(d => { if (/^\d+\/\d+$/.test((d.textContent||'').trim())) d.style.display = ''; });
                    });
                    // Show hint text in vertical mode
                    [...carousel.children].forEach(ch => {
                        if (ch.style?.fontStyle?.includes('italic')) ch.style.display = '';
                    });
                }
                onBlockChange?.({ ...block, code: container.innerHTML, fullCode: container.innerHTML });
                // Re-trigger selection to refresh panel
                window.__cloneEditorApi?._reselectCarousel(carouselPath);
            },
            addCarouselSlide: (carouselPath) => {
                const container = containerRef.current;
                if (!container) return;
                const carousel = findByPath(container, carouselPath);
                if (!carousel) return;
                const wrapper = carousel.querySelector('[data-carousel-wrapper]');
                const slideSource = wrapper || carousel;
                const slideCount = [...slideSource.children].filter(ch => ch.querySelector?.('img')).length;
                const newSlide = `<div style="position:relative;width:100%;height:200px;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb"><img src="https://placehold.co/400x200/e2e8f0/475569?text=Slide+${slideCount + 1}" style="width:100%;height:100%;object-fit:cover"/><div style="position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;padding:2px 8px;border-radius:4px">${slideCount + 1}/${slideCount + 1}</div></div>`;
                if (wrapper) {
                    wrapper.insertAdjacentHTML('beforeend', newSlide);
                } else {
                    // Insert before the hint text if exists
                    const hint = [...carousel.children].find(ch => ch.style?.fontStyle?.includes('italic'));
                    if (hint) { hint.insertAdjacentHTML('beforebegin', newSlide); }
                    else { carousel.insertAdjacentHTML('beforeend', newSlide); }
                }
                onBlockChange?.({ ...block, code: container.innerHTML, fullCode: container.innerHTML });
                window.__cloneEditorApi?._reselectCarousel(carouselPath);
            },
            removeCarouselSlide: (carouselPath, slideIdx) => {
                const container = containerRef.current;
                if (!container) return;
                const carousel = findByPath(container, carouselPath);
                if (!carousel) return;
                const wrapper = carousel.querySelector('[data-carousel-wrapper]');
                const slideSource = wrapper || carousel;
                const slides = [...slideSource.children].filter(ch => ch.querySelector?.('img'));
                if (slides.length > 1 && slides[slideIdx]) {
                    slides[slideIdx].remove();
                    onBlockChange?.({ ...block, code: container.innerHTML, fullCode: container.innerHTML });
                    window.__cloneEditorApi?._reselectCarousel(carouselPath);
                }
            },
        };
        return () => { delete window.__cloneEditorApi; };
    }, [block, onBlockChange, onElementSelect, insertElement]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#f0f1f5' }}>
            {/* Toolbar */}
            <div style={{
                padding: '8px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6b7280' }}>
                    <MousePointerClick size={13} style={{ color: pc }} />
                    <span>Clique em elementos para editar →</span>
                </div>
            </div>

            {/* Preview area — constrained to mobile width */}
            <div style={{ flex: 1, overflow: 'auto', position: 'relative', display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
                    {/* Hover highlight */}
                    {hoverHighlight && (
                        <div style={{
                            position: 'absolute',
                            top: hoverHighlight.top - 2,
                            left: hoverHighlight.left - 2,
                            width: hoverHighlight.width + 4,
                            height: hoverHighlight.height + 4,
                            border: `2px dashed ${hoverHighlight.type === 'button' ? '#f59e0b' : hoverHighlight.type === 'image' ? '#10b981' : pc}`,
                            borderRadius: 6, pointerEvents: 'none', zIndex: 10,
                            transition: 'all 0.12s ease',
                        }}>
                            <div style={{
                                position: 'absolute', top: -18, left: 0,
                                background: hoverHighlight.type === 'button' ? '#f59e0b' : hoverHighlight.type === 'image' ? '#10b981' : pc,
                                color: '#fff', fontSize: 9, fontWeight: 700,
                                padding: '1px 6px', borderRadius: '3px 3px 0 0',
                                whiteSpace: 'nowrap',
                            }}>
                                {hoverHighlight.type === 'button' ? '🔘 Botão' : hoverHighlight.type === 'image' ? '🖼️ Imagem' : hoverHighlight.type === 'container' ? '📦 Container' : hoverHighlight.type === 'chart' ? '📊 Gráfico' : hoverHighlight.type === 'carousel' ? '🎠 Carrossel' : hoverHighlight.type === 'input' ? '📋 Campo' : '✏️ Texto'}
                            </div>
                        </div>
                    )}

                    {/* ── Floating toolbar on selected element ── */}
                    {selectedPath && selectionRect && (
                        <div style={{
                            position: 'absolute',
                            top: selectionRect.top - 36,
                            left: Math.max(0, selectionRect.left + selectionRect.width / 2 - 52),
                            zIndex: 30, pointerEvents: 'auto',
                        }}>
                            <div style={{
                                display: 'flex', gap: 2,
                                background: '#1f2937', borderRadius: 8,
                                padding: '4px 6px', boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                            }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowReplacePicker(!showReplacePicker); }}
                                    title="Substituir por componente"
                                    style={{
                                        background: showReplacePicker ? pc : 'transparent', border: 'none',
                                        color: '#fff', fontSize: 14, cursor: 'pointer',
                                        padding: '4px 8px', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 4,
                                    }}
                                >
                                    🔄 <span style={{ fontSize: 10, fontWeight: 600 }}>Trocar</span>
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); window.__cloneEditorApi?.deleteElement(selectedPath); setSelectionRect(null); setShowReplacePicker(false); }}
                                    title="Remover elemento"
                                    style={{
                                        background: 'transparent', border: 'none',
                                        color: '#ef4444', fontSize: 14, cursor: 'pointer',
                                        padding: '4px 8px', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 4,
                                    }}
                                >
                                    🗑️
                                </button>
                            </div>

                            {/* Replace picker popover */}
                            {showReplacePicker && (
                                <div style={{
                                    position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                                    marginBottom: 6, background: '#fff', borderRadius: 12,
                                    border: '1px solid #e5e7eb', boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
                                    padding: 8, width: 220, maxHeight: 300, overflowY: 'auto',
                                }}>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', padding: '4px 8px 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Substituir por</div>
                                    {[
                                        { id: 'carousel', icon: '🎠', label: 'Carrossel', html: '<div data-carousel style="width:100%;display:flex;flex-direction:column;gap:8px;padding:8px"><div style="position:relative;width:100%;height:200px;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb"><img src="https://placehold.co/400x200/e2e8f0/475569?text=Slide+1" style="width:100%;height:100%;object-fit:cover"/><div style="position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;padding:2px 8px;border-radius:4px">1/3</div></div><div style="position:relative;width:100%;height:200px;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb"><img src="https://placehold.co/400x200/dbeafe/1e40af?text=Slide+2" style="width:100%;height:100%;object-fit:cover"/><div style="position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;padding:2px 8px;border-radius:4px">2/3</div></div><div style="position:relative;width:100%;height:200px;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb"><img src="https://placehold.co/400x200/dcfce7/166534?text=Slide+3" style="width:100%;height:100%;object-fit:cover"/><div style="position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;padding:2px 8px;border-radius:4px">3/3</div></div><div style="text-align:center;font-size:11px;color:#9ca3af;font-style:italic">↔ No quiz, os slides passam com scroll horizontal</div></div>' },
                                        { id: 'chart', icon: '📊', label: 'Gráfico', html: '<div style="width:100%;padding:16px;box-sizing:border-box"><div style="font-size:14px;font-weight:700;margin-bottom:12px;text-align:center">Resultados</div><div style="display:flex;align-items:flex-end;gap:8px;height:120px;padding:0 10px"><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:100%;background:linear-gradient(to top,#6366f1,#818cf8);border-radius:6px 6px 0 0;height:80%"></div><span style="font-size:11px;font-weight:600">A</span></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:100%;background:linear-gradient(to top,#f59e0b,#fbbf24);border-radius:6px 6px 0 0;height:55%"></div><span style="font-size:11px;font-weight:600">B</span></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:100%;background:linear-gradient(to top,#10b981,#34d399);border-radius:6px 6px 0 0;height:90%"></div><span style="font-size:11px;font-weight:600">C</span></div></div></div>' },
                                        { id: 'text', icon: '📝', label: 'Texto', html: '<p style="padding:8px 16px;font-size:16px;line-height:1.6">Seu texto aqui</p>' },
                                        { id: 'button', icon: '🔘', label: 'Botão', html: '<div style="padding:12px 16px"><button style="display:block;width:100%;padding:14px 24px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;text-align:center">Clique aqui</button></div>' },
                                        { id: 'image', icon: '🖼️', label: 'Imagem', html: '<div style="padding:8px"><img src="https://placehold.co/400x220/e2e8f0/475569?text=Sua+imagem" style="width:100%;height:220px;object-fit:cover;display:block;border-radius:10px"/></div>' },
                                        { id: 'before-after', icon: '↔️', label: 'Antes/Depois', html: '<div style="padding:12px;display:flex;gap:8px"><div style="flex:1;text-align:center"><div style="font-size:12px;font-weight:700;color:#ef4444;margin-bottom:6px">ANTES</div><img src="https://placehold.co/180x220/fef2f2/ef4444?text=Antes" style="width:100%;height:180px;object-fit:cover;border-radius:8px"/></div><div style="flex:1;text-align:center"><div style="font-size:12px;font-weight:700;color:#10b981;margin-bottom:6px">DEPOIS</div><img src="https://placehold.co/180x220/ecfdf5/10b981?text=Depois" style="width:100%;height:180px;object-fit:cover;border-radius:8px"/></div></div>' },
                                        { id: 'faq', icon: '❓', label: 'FAQ', html: '<div style="padding:12px 16px"><details style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:8px" open><summary style="font-weight:600;font-size:14px;cursor:pointer">Pergunta 1?</summary><p style="margin-top:8px;font-size:13px;color:#64748b">Resposta aqui.</p></details><details style="border:1px solid #e5e7eb;border-radius:10px;padding:12px"><summary style="font-weight:600;font-size:14px;cursor:pointer">Pergunta 2?</summary><p style="margin-top:8px;font-size:13px;color:#64748b">Resposta aqui.</p></details></div>' },
                                        { id: 'pricing', icon: '💲', label: 'Preço', html: '<div style="padding:16px;text-align:center"><div style="border:2px solid #e5e7eb;border-radius:14px;padding:20px"><div style="font-size:12px;font-weight:700;color:#6366f1;text-transform:uppercase">Premium</div><div style="font-size:36px;font-weight:800;margin:8px 0">R$97</div><div style="font-size:12px;color:#64748b;margin-bottom:16px">pagamento único</div><button style="width:100%;padding:12px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer">Quero agora</button></div></div>' },
                                        { id: 'social', icon: '⭐', label: 'Depoimento', html: '<div style="padding:14px 16px;display:flex;gap:10px;align-items:flex-start"><div style="width:40px;height:40px;border-radius:50%;background:#e5e7eb;flex-shrink:0"></div><div><div style="font-size:13px;font-weight:700">Maria S.</div><div style="font-size:11px;color:#f59e0b;margin-bottom:2px">★★★★★</div><div style="font-size:13px;color:#4b5563">"Resultado incrível! Recomendo demais."</div></div></div>' },
                                        { id: 'progress-bar', icon: '▰', label: 'Barra Progresso', html: '<div data-gadget-type="progress-bar" style="text-align:center;padding:32px 16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px" data-pb-title>Analisando seu perfil...</div><div style="height:12px;background:#e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:8px"><div data-pb-fill style="height:100%;width:0%;background:linear-gradient(90deg,#10b981,#34d399);border-radius:6px;transition:width 0.1s linear"></div></div><div data-pb-pct style="font-size:12px;font-weight:700;color:#10b981">0%</div></div><script data-pb-anim>(function(){var f=document.querySelector("[data-pb-fill]");var p=document.querySelector("[data-pb-pct]");if(!f||!p)return;var start=Date.now();var dur=5000;var iv=setInterval(function(){var e=Date.now()-start;var pct=Math.min(100,Math.round(e/dur*100));f.style.width=pct+"%";p.textContent=pct+"%";if(pct>=100){clearInterval(iv);setTimeout(function(){window.parent.postMessage({type:"clone-advance"},"*")},600)}},50)})();</script>' },
                                        { id: 'loading', icon: '◐', label: 'Loading', html: '<div data-gadget-type="loading" style="text-align:center;padding:32px 16px"><div style="width:40px;height:40px;border:3px solid #e5e7eb;border-top-color:#6366f1;border-radius:50%;margin:0 auto 12px;animation:spin 1s linear infinite"></div><div style="font-size:14px;font-weight:600;color:#374151">Analisando...</div></div>' },
                                        { id: 'risk-chart', icon: '📉', label: 'Gráfico Risco', html: '<div data-gadget-type="risk-chart" style="padding:16px;text-align:center"><div style="font-size:14px;font-weight:700;margin-bottom:12px">Seu nível de risco</div><svg data-rc-svg viewBox="0 0 320 180" style="width:100%;max-width:380px"><defs><linearGradient id="rcG" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="#22c55e"/><stop offset="30%" stop-color="#eab308"/><stop offset="60%" stop-color="#f97316"/><stop offset="100%" stop-color="#ef4444"/></linearGradient><linearGradient id="rcGF" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="#22c55e" stop-opacity="0.35"/><stop offset="30%" stop-color="#eab308" stop-opacity="0.35"/><stop offset="60%" stop-color="#f97316" stop-opacity="0.35"/><stop offset="100%" stop-color="#ef4444" stop-opacity="0.35"/></linearGradient></defs><line x1="10" y1="150" x2="310" y2="150" stroke="#475569" stroke-width="1"/><path data-rc-area fill="url(#rcGF)" d="M10 150 L310 150 Z"/><path data-rc-line fill="none" stroke="url(#rcG)" stroke-width="3" stroke-linecap="round" d="M10 150"/><g data-rc-dots></g><g data-rc-label style="opacity:0"></g><text x="10" y="176" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="500">Baixo</text><text x="85" y="176" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="500">Aceitável</text><text x="160" y="176" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="500">Normal</text><text x="235" y="176" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="500">Médio</text><text x="310" y="176" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="500">Alto</text></svg></div><script data-rc-anim>(function(){var vals=[0.08,0.18,0.35,0.62,0.95];var W=300,H=120,pL=10,pT=30;var uIdx=3;var dur=3000;var start=Date.now();var area=document.querySelector("[data-rc-area]");var line=document.querySelector("[data-rc-line]");var dots=document.querySelector("[data-rc-dots]");var lbl=document.querySelector("[data-rc-label]");if(!area||!line)return;function anim(){var t=Math.min(1,(Date.now()-start)/dur);var pts=vals.map(function(v,i){return{x:pL+i/4*W,y:pT+H-v*t*H}});var d="M "+pts[0].x+" "+pts[0].y;for(var i=1;i<pts.length;i++){var p=pts[i-1],c=pts[i];var cx1=p.x+(c.x-p.x)*0.5;d+=" C "+cx1+" "+p.y+" "+cx1+" "+c.y+" "+c.x+" "+c.y}line.setAttribute("d",d);area.setAttribute("d",d+" L "+pts[4].x+" 150 L "+pts[0].x+" 150 Z");var dh="";for(var i=0;i<pts.length;i++){var r=i===uIdx?6:4;var f=i===uIdx?"#fff":"url(#rcG)";var s=i===uIdx?" stroke=\\"#eab308\\" stroke-width=\\"2\\"":"";dh+="<circle cx=\\""+pts[i].x+"\\" cy=\\""+pts[i].y+"\\" r=\\""+r+"\\" fill=\\""+f+"\\""+s+" opacity=\\""+(t>0.1?1:0)+"\\"/>";}dots.innerHTML=dh;if(t>0.5){lbl.style.opacity=Math.min(1,(t-0.5)*4);var ux=pts[uIdx].x,uy=pts[uIdx].y;lbl.innerHTML="<rect x=\\""+(ux-22)+"\\" y=\\""+(uy-28)+"\\" width=\\"44\\" height=\\"20\\" rx=\\"10\\" fill=\\"#eab308\\"/><text x=\\""+ux+"\\" y=\\""+(uy-15)+"\\" text-anchor=\\"middle\\" fill=\\"#fff\\" font-size=\\"10\\" font-weight=\\"700\\">Você</text>"}if(t<1){requestAnimationFrame(anim)}else{setTimeout(function(){window.parent.postMessage({type:"clone-advance"},"*")},1200)}}anim()})()</script>' },
                                    ].map(g => (
                                        <button key={g.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.__cloneEditorApi?.replaceElement(selectedPath, translateGadgetHtml(g.html, lang));
                                                setShowReplacePicker(false);
                                                setSelectionRect(null);
                                            }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                padding: '7px 8px', borderRadius: 6, width: '100%',
                                                border: 'none', background: 'transparent',
                                                fontSize: '0.73rem', fontWeight: 500, cursor: 'pointer',
                                                textAlign: 'left', color: '#374151',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <span style={{ fontSize: 16 }}>{g.icon}</span>
                                            <span>{g.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Resize handles on selected element ── */}
                    {selectedPath && selectionRect && (
                        <>
                            {/* Bottom-right corner resize */}
                            <div
                                onMouseDown={(e) => {
                                    e.stopPropagation(); e.preventDefault();
                                    const startX = e.clientX, startY = e.clientY;
                                    const startW = selectionRect.width, startH = selectionRect.height;
                                    const onMove = (ev) => {
                                        const dx = ev.clientX - startX;
                                        const dy = ev.clientY - startY;
                                        const newW = Math.max(40, Math.round(startW + dx));
                                        const newH = Math.max(20, Math.round(startH + dy));
                                        window.__cloneEditorApi?.updateStyle(selectedPath, {
                                            width: `${newW}px`, maxWidth: '100%',
                                            height: `${newH}px`, margin: '0 auto', display: 'block',
                                        });
                                        setSelectionRect(prev => ({ ...prev, width: newW, height: newH }));
                                    };
                                    const onUp = () => {
                                        document.body.style.cursor = ''; document.body.style.userSelect = '';
                                        window.removeEventListener('mousemove', onMove);
                                        window.removeEventListener('mouseup', onUp);
                                    };
                                    document.body.style.cursor = 'nwse-resize'; document.body.style.userSelect = 'none';
                                    window.addEventListener('mousemove', onMove);
                                    window.addEventListener('mouseup', onUp);
                                }}
                                style={{
                                    position: 'absolute',
                                    top: selectionRect.top + selectionRect.height - 6,
                                    left: selectionRect.left + selectionRect.width - 6,
                                    width: 14, height: 14, cursor: 'nwse-resize', zIndex: 25,
                                    background: '#fff', border: `2px solid ${pc}`, borderRadius: '0 0 4px 0',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                                }}
                            />
                            {/* Bottom-center resize (height only) */}
                            <div
                                onMouseDown={(e) => {
                                    e.stopPropagation(); e.preventDefault();
                                    const startY = e.clientY;
                                    const startH = selectionRect.height;
                                    const onMove = (ev) => {
                                        const dy = ev.clientY - startY;
                                        const newH = Math.max(20, Math.round(startH + dy));
                                        window.__cloneEditorApi?.updateStyle(selectedPath, { height: `${newH}px` });
                                        setSelectionRect(prev => ({ ...prev, height: newH }));
                                    };
                                    const onUp = () => {
                                        document.body.style.cursor = ''; document.body.style.userSelect = '';
                                        window.removeEventListener('mousemove', onMove);
                                        window.removeEventListener('mouseup', onUp);
                                    };
                                    document.body.style.cursor = 'ns-resize'; document.body.style.userSelect = 'none';
                                    window.addEventListener('mousemove', onMove);
                                    window.addEventListener('mouseup', onUp);
                                }}
                                style={{
                                    position: 'absolute',
                                    top: selectionRect.top + selectionRect.height - 3,
                                    left: selectionRect.left + selectionRect.width / 2 - 12,
                                    width: 24, height: 6, cursor: 'ns-resize', zIndex: 25,
                                    background: pc, borderRadius: 3, opacity: 0.6,
                                }}
                            />
                            {/* Right-center resize (width only) */}
                            <div
                                onMouseDown={(e) => {
                                    e.stopPropagation(); e.preventDefault();
                                    const startX = e.clientX;
                                    const startW = selectionRect.width;
                                    const onMove = (ev) => {
                                        const dx = ev.clientX - startX;
                                        const newW = Math.max(40, Math.round(startW + dx));
                                        window.__cloneEditorApi?.updateStyle(selectedPath, {
                                            width: `${newW}px`, maxWidth: '100%', margin: '0 auto', display: 'block',
                                        });
                                        setSelectionRect(prev => ({ ...prev, width: newW }));
                                    };
                                    const onUp = () => {
                                        document.body.style.cursor = ''; document.body.style.userSelect = '';
                                        window.removeEventListener('mousemove', onMove);
                                        window.removeEventListener('mouseup', onUp);
                                    };
                                    document.body.style.cursor = 'ew-resize'; document.body.style.userSelect = 'none';
                                    window.addEventListener('mousemove', onMove);
                                    window.addEventListener('mouseup', onUp);
                                }}
                                style={{
                                    position: 'absolute',
                                    top: selectionRect.top + selectionRect.height / 2 - 12,
                                    left: selectionRect.left + selectionRect.width - 3,
                                    width: 6, height: 24, cursor: 'ew-resize', zIndex: 25,
                                    background: pc, borderRadius: 3, opacity: 0.6,
                                }}
                            />
                        </>
                    )}

                    {/* Content — mobile frame */}
                    <div style={{
                        background: '#fff',
                        borderRadius: 16,
                        boxShadow: '0 2px 16px rgba(0,0,0,.08)',
                        overflow: 'hidden',
                        border: '1px solid #e5e7eb',
                    }}>
                        <div
                            ref={containerRef}
                            onClick={handleClick}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={() => setHoverHighlight(null)}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'copy';
                                const container = containerRef.current;
                                if (!container) return;
                                const mouseY = e.clientY;
                                // Only consider direct children of the cloned-page container (top-level blocks)
                                const clonedPage = container.querySelector('.cloned-page') || container;
                                const topLevelEls = Array.from(clonedPage.children).filter(el => {
                                    const r = el.getBoundingClientRect();
                                    return r.height >= 20 && r.width >= 40;
                                });
                                let bestEl = null;
                                let bestDist = Infinity;
                                for (const el of topLevelEls) {
                                    const r = el.getBoundingClientRect();
                                    const midY = r.top + r.height / 2;
                                    const dist = Math.abs(mouseY - midY);
                                    if (dist < bestDist) { bestDist = dist; bestEl = el; }
                                }
                                if (bestEl && bestDist < 200) {
                                    const r = bestEl.getBoundingClientRect();
                                    const cr = container.getBoundingClientRect();
                                    const midY = r.top + r.height / 2;
                                    const pos = mouseY < midY ? 'beforebegin' : 'afterend';
                                    const indicatorY = pos === 'beforebegin' ? r.top - cr.top : r.bottom - cr.top;
                                    dropTargetRef.current = { el: bestEl, position: pos };
                                    setDropIndicatorY(prev => Math.abs((prev || 0) - indicatorY) > 5 ? indicatorY : prev);
                                }
                            }}
                            onDragLeave={() => setDropIndicatorY(null)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDropIndicatorY(null);
                                const html = window.__draggedGadgetHtml;
                                if (html) {
                                    insertElementNear(html);
                                    window.__draggedGadgetHtml = null;
                                }
                            }}
                            dangerouslySetInnerHTML={{ __html: block.code || '' }}
                            style={{ cursor: 'pointer', position: 'relative' }}
                        />
                        {/* Drop indicator line */}
                        {dropIndicatorY !== null && (
                            <div style={{
                                position: 'absolute', left: 8, right: 8,
                                top: dropIndicatorY, height: 3,
                                background: pc, borderRadius: 2,
                                pointerEvents: 'none', zIndex: 20,
                                boxShadow: `0 0 8px ${pc}60`,
                                transition: 'top 0.1s ease',
                            }} />
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom bar */}
            <div style={{
                padding: '5px 16px', background: '#fff', borderTop: '1px solid #e5e7eb',
                fontSize: 10, color: '#9ca3af', flexShrink: 0,
            }}>
                🔗 {stepName || 'Página clonada'}
                {block.buttonActions && Object.keys(block.buttonActions).length > 0 && (
                    <span style={{ marginLeft: 8, background: '#dbeafe', color: '#2563eb', padding: '1px 6px', borderRadius: 99, fontWeight: 600 }}>
                        {Object.keys(block.buttonActions).length} ação(ões)
                    </span>
                )}
            </div>
        </div>
    );
}
