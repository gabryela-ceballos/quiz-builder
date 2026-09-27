// annotate.cjs — runs INSIDE the cloned page (via page.evaluate). Must be fully self-contained.
//
// 1. Marks every interactive element with data-qf-role = back | next | option | link | whatsapp
//    (and data-qf-href for links) so the HTML clone can keep the original behaviour.
// 2. Detects media (video providers, <video>, <audio>, Lottie, canvas charts) and marks scripts
//    that players need with data-qf-keep.
// 3. Returns an ordered outline of the page (headings, texts, images, options, inputs, buttons…)
//    used to rebuild the page with native builder blocks.

function annotatePage() {
    const MAX_NODES = 90;
    const out = { outline: [], media: [], canvases: {}, hasBack: false, links: [], title: '', percent: null };
    const root = document.querySelector('.main-content, main, [role="main"], #app, #root, #__next') || document.body;

    const cs = (el) => { try { return getComputedStyle(el); } catch { return null; } };
    const rect = (el) => el.getBoundingClientRect();
    const visible = (el) => {
        if (!el || el.nodeType !== 1) return false;
        const r = rect(el);
        if (r.width < 2 || r.height < 2) return false;
        const s = cs(el);
        if (!s || s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return false;
        return true;
    };
    const text = (el) => (el.innerText || el.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
    const abs = (u) => { try { return u ? new URL(u, location.href).href : ''; } catch { return u || ''; } };
    let seq = 0;
    const qid = (el) => { if (!el.dataset.qfId) el.dataset.qfId = `q${Date.now().toString(36)}${++seq}`; return el.dataset.qfId; };

    // Reset annotations from a previous SPA page
    document.querySelectorAll('[data-qf-role]').forEach(e => { e.removeAttribute('data-qf-role'); e.removeAttribute('data-qf-href'); e.removeAttribute('data-qf-opt'); });
    document.querySelectorAll('[data-qf-canvas]').forEach(e => e.removeAttribute('data-qf-canvas'));

    const SUBMIT_RE = /^(pr[oó]ximo|next|continuar|continue|come[cç]ar|start|enviar|submit|avan[cç]ar|ok|prosseguir|ver (meu |o )?resultado|iniciar|vamos l[aá]|quero|bora|let'?s go|get started|take (the )?quiz|siguiente|comenzar|empezar|aceptar|confirmar|weiter|continuer|seguir)\b/i;
    const SUBMIT_LOOSE = /continuar|come[cç]ar|comece|siguiente|comenzar|continuer|weiter|avan[cç]ar|pr[oó]ximo|continue|submit|enviar|next step|ver resultado|quero (meu|ver|come)/i;
    const BACK_TEXT = /^(←|‹|<|«|⟵|voltar|back|anterior|atr[aá]s|previous|prev|zur[uü]ck|retour|regresar|volver)$/i;
    const BACK_ATTR = /(voltar|back|anterior|previous|atr[aá]s|volver|regresar|go-?back|btn-?prev|prev-?btn|arrow-?left|chevron-?left)/i;
    const CHECKOUT_HOSTS = /(hotmart|kiwify|eduzz|monetizze|braip|perfectpay|ticto|cakto|lastlink|pepper|yampi|kirvano|greenn|doppus|stripe|paypal|mercadopago|pagar\.me|pagseguro|shopify|checkout|pay\.|buy\.|clickbank|digistore|payt|appmax)/i;

    const isPointer = (el) => { const s = cs(el); return !!s && s.cursor === 'pointer'; };
    const isClickable = (el) => {
        const tag = el.tagName.toLowerCase();
        if (tag === 'button' || (tag === 'a' && el.getAttribute('href') !== null) || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'option' || el.getAttribute('role') === 'radio' || el.hasAttribute('onclick')) return true;
        if (tag === 'label' && el.querySelector('input')) return true;
        return isPointer(el) && (!el.parentElement || !isPointer(el.parentElement));
    };

    // ── 1. Collect clickable candidates (outermost pointer element) ──
    const clickables = [];
    root.querySelectorAll('button, a, [role="button"], [role="option"], [role="radio"], [onclick], label, div, li, span, section, article').forEach(el => {
        if (!visible(el) || !isClickable(el)) return;
        const r = rect(el);
        if (r.height > 420 || r.width < 16) return;
        if (clickables.some(c => c.contains(el))) return;
        for (let i = clickables.length - 1; i >= 0; i--) if (el.contains(clickables[i])) clickables.splice(i, 1);
        clickables.push(el);
    });

    const signature = (el) => {
        const cls = (el.getAttribute('class') || '').split(/\s+/).filter(c => c && !/(active|selected|checked|focus|hover|chosen|is-|current)/i.test(c)).sort().join('.');
        return `${el.tagName}|${cls}`;
    };

    const roleOf = new Map();
    clickables.forEach(el => {
        const t = text(el);
        const tag = el.tagName.toLowerCase();
        const href = el.getAttribute('href') || el.closest('a')?.getAttribute('href') || '';
        const aria = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('class') || ''} ${el.id || ''}`;
        const r = rect(el);
        const iconOnly = t.replace(/[^\p{L}\p{N}]/gu, '').length <= 1 && (el.querySelector('svg, img, i') || /[←‹<«⟵]/.test(t));
        if (/wa\.me|api\.whatsapp\.com|whatsapp:\/\//i.test(href)) { roleOf.set(el, { role: 'whatsapp', href: abs(href) }); return; }
        if (BACK_TEXT.test(t) || (iconOnly && (BACK_ATTR.test(aria) || (r.left < 110 && r.top < 170 && r.width < 90))) || /history\.back|goBack|prevStep/i.test(el.getAttribute('onclick') || '')) {
            roleOf.set(el, { role: 'back' }); return;
        }
        if (href && !/^(#|javascript:)/i.test(href)) {
            const url = abs(href);
            let external = false;
            try { external = new URL(url).host !== location.host; } catch { /* ignore */ }
            if (external || CHECKOUT_HOSTS.test(url) || /checkout|comprar|carrinho|cart|order|pagamento|payment/i.test(url)) {
                roleOf.set(el, { role: 'link', href: url }); return;
            }
        }
        if ((tag === 'button' && el.type === 'submit') || SUBMIT_RE.test(t.replace(/[→►▶»>\s]+$/g, '').trim()) || (t.length < 40 && SUBMIT_LOOSE.test(t))) {
            roleOf.set(el, { role: 'next' }); return;
        }
        roleOf.set(el, { role: 'candidate', sig: signature(el), parent: el.parentElement });
    });

    // Group option candidates: same parent (or grand-parent) + same signature, 2+ members
    const groups = new Map();
    clickables.forEach(el => {
        const info = roleOf.get(el);
        if (!info || info.role !== 'candidate') return;
        const t = text(el);
        if (!t && !el.querySelector('img')) return;
        const key = `${info.sig}::${qid(el.parentElement?.parentElement || el.parentElement || root)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(el);
    });
    const optionGroups = [...groups.values()].filter(g => g.length >= 2).sort((a, b) => b.length - a.length);
    const optionSet = new Set();
    optionGroups.forEach((g, gi) => g.forEach((el, i) => { optionSet.add(el); el.setAttribute('data-qf-role', 'option'); el.setAttribute('data-qf-opt', `${gi}:${i}`); }));

    // Single leftover candidate on a page with no submit → it is the "next" button
    const leftovers = clickables.filter(el => roleOf.get(el)?.role === 'candidate' && !optionSet.has(el));
    const hasNext = clickables.some(el => roleOf.get(el)?.role === 'next');
    leftovers.forEach(el => {
        const r = rect(el);
        const t = text(el);
        if (!hasNext && leftovers.length === 1 && t && t.length < 60 && r.width > 120) roleOf.set(el, { role: 'next' });
    });

    clickables.forEach(el => {
        const info = roleOf.get(el);
        if (!info || info.role === 'candidate') return;
        el.setAttribute('data-qf-role', info.role);
        if (info.href) el.setAttribute('data-qf-href', info.href);
        if (info.role === 'back') out.hasBack = true;
        if (info.role === 'link' || info.role === 'whatsapp') out.links.push({ text: text(el).slice(0, 80), href: info.href, role: info.role });
    });

    // ── 2. Media ──
    const videoProvider = (src) => {
        if (/youtube(-nocookie)?\.com|youtu\.be/i.test(src)) return 'youtube';
        if (/vimeo\.com/i.test(src)) return 'vimeo';
        if (/wistia/i.test(src)) return 'wistia';
        if (/pandavideo/i.test(src)) return 'panda';
        if (/converteai\.net|vturb/i.test(src)) return 'vturb';
        if (/mediadelivery\.net|bunny/i.test(src)) return 'bunny';
        if (/loom\.com/i.test(src)) return 'loom';
        return '';
    };
    root.querySelectorAll('iframe').forEach(f => {
        const src = abs(f.getAttribute('src') || f.src || '');
        const provider = videoProvider(src);
        if (!provider || !visible(f)) return;
        out.media.push({ kind: 'video', provider, src, id: qid(f) });
    });
    root.querySelectorAll('vturb-smartplayer, [id^="vid_"], [id^="vid-"], [id^="smartplayer"], [class*="smartplayer"], [id^="panda-"]').forEach(el => {
        if (el.closest('[data-qf-media]')) return;
        el.setAttribute('data-qf-media', 'video');
        const scripts = [...document.querySelectorAll('script[src*="converteai"], script[src*="vturb"], script[src*="pandavideo"]')];
        scripts.forEach(s => s.setAttribute('data-qf-keep', '1'));
        const inline = [...document.querySelectorAll('script:not([src])')].filter(s => /converteai|smartplayer|pandavideo/i.test(s.textContent || ''));
        inline.forEach(s => s.setAttribute('data-qf-keep', '1'));
        const embedHtml = el.outerHTML.replace(/<div[^>]*class="[^"]*smartplayer-[^"]*"[\s\S]*$/i, '') + scripts.map(s => `<script src="${abs(s.getAttribute('src'))}" async></script>`).join('') + inline.map(s => `<script>${s.textContent}</script>`).join('');
        out.media.push({ kind: 'video', provider: /panda/i.test(embedHtml) ? 'panda' : 'vturb', embedHtml: embedHtml.slice(0, 20000), id: qid(el) });
    });
    root.querySelectorAll('video').forEach(v => {
        if (!visible(v)) return;
        const src = abs(v.currentSrc || v.getAttribute('src') || v.querySelector('source')?.getAttribute('src') || '');
        if (!src || src.startsWith('blob:')) return;
        v.setAttribute('src', src);
        out.media.push({ kind: 'video', provider: 'file', src, poster: abs(v.getAttribute('poster') || ''), id: qid(v) });
    });
    document.querySelectorAll('audio').forEach(a => {
        const src = abs(a.currentSrc || a.getAttribute('src') || a.querySelector('source')?.getAttribute('src') || '');
        if (!src || src.startsWith('blob:')) return;
        a.setAttribute('src', src);
        // Only look for an avatar/sender inside a small "message bubble", never the whole page container
        let bubble = a.closest('[class*="audio"], [class*="message"], [class*="whats"], [class*="voice"]') || a.parentElement;
        if (!bubble || bubble === root || bubble === document.body || bubble.querySelectorAll('*').length > 40) bubble = null;
        const avatarImg = bubble?.querySelector('img');
        const avatar = avatarImg && avatarImg.getBoundingClientRect().width <= 90 ? avatarImg.src : '';
        out.media.push({ kind: 'audio', src, avatar: abs(avatar), sender: (bubble?.querySelector('b, strong, [class*="name"]')?.innerText || '').trim().slice(0, 40), id: qid(a) });
    });
    root.querySelectorAll('lottie-player, dotlottie-player, [data-animation-path], [data-lottie], [data-src$=".json"]').forEach(el => {
        const src = abs(el.getAttribute('src') || el.getAttribute('data-animation-path') || el.getAttribute('data-lottie') || el.getAttribute('data-src') || '');
        if (!src) return;
        out.media.push({ kind: 'lottie', src, id: qid(el) });
        document.querySelectorAll('script[src*="lottie"]').forEach(s => s.setAttribute('data-qf-keep', '1'));
    });
    let canvasN = 0;
    root.querySelectorAll('canvas').forEach(c => {
        const r = rect(c);
        if (!visible(c) || r.width < 60 || r.height < 40) return;
        try {
            const data = c.toDataURL('image/png');
            if (data && data.length > 2000) {
                const id = `c${++canvasN}`;
                c.setAttribute('data-qf-canvas', id);
                out.canvases[id] = data;
            }
        } catch { /* tainted canvas */ }
    });

    // ── 3. Outline (document order) ──
    const consumed = new Set();
    const BLOCKISH = new Set(['block', 'flex', 'grid', 'list-item', 'table', 'flow-root', 'table-row', 'table-cell']);
    const MEDIA_TAGS = new Set(['img', 'video', 'audio', 'iframe', 'canvas', 'input', 'textarea', 'select', 'button', 'svg', 'picture', 'lottie-player', 'dotlottie-player']);
    const isBlockish = (el) => MEDIA_TAGS.has(el.tagName.toLowerCase()) || el.hasAttribute('data-qf-role') || BLOCKISH.has(cs(el)?.display || '');
    const push = (node) => { if (out.outline.length < MAX_NODES) out.outline.push(node); };
    const styleInfo = (el) => {
        const s = cs(el);
        return { size: Math.round(parseFloat(s?.fontSize) || 16), weight: parseInt(s?.fontWeight, 10) || 400, align: s?.textAlign === 'center' ? 'center' : s?.textAlign === 'right' ? 'right' : 'left', color: s?.color || '' };
    };
    const splitEmoji = (t) => {
        const m = t.match(/^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})[️‍\p{Extended_Pictographic}\p{Regional_Indicator}]*)\s*(.*)$/su);
        return m ? { emoji: m[1], text: m[2].trim() } : { emoji: '', text: t };
    };
    const nodeForMedia = (el) => out.media.find(m => m.id && el.dataset.qfId === m.id);

    const walk = (el, depth) => {
        if (!el || depth > 40 || out.outline.length >= MAX_NODES || consumed.has(el)) return;
        const tag = el.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'template', 'head', 'meta', 'link'].includes(tag)) return;
        if (!visible(el) && tag !== 'audio') return;

        const role = el.getAttribute('data-qf-role');
        if (role === 'back') { push({ k: 'back' }); return; }
        if (role === 'option') {
            const [gi] = (el.getAttribute('data-qf-opt') || '0:0').split(':');
            const group = optionGroups[Number(gi)] || [el];
            group.forEach(g => consumed.add(g));
            const rects = group.map(rect);
            const rows = new Set(rects.map(r => Math.round(r.top / 8))).size;
            const hasCheckbox = group.some(g => g.querySelector('input[type="checkbox"], [role="checkbox"]')) || /marcar v[aá]rias|mais de uma|selecione (todas|quantas)|varias|multiple|all that apply/i.test(document.body.innerText || '');
            push({
                k: 'options',
                multi: hasCheckbox,
                columns: rows < group.length ? Math.round(group.length / rows) : 1,
                items: group.map(g => {
                    const img = g.querySelector('img');
                    const t = text(g);
                    const { emoji, text: clean } = splitEmoji(t.split('\n')[0] || t);
                    const rest = t.split('\n').slice(1).join(' ').trim();
                    return { text: clean.slice(0, 160), desc: rest.slice(0, 160), emoji, image: img && rect(img).width > 24 ? abs(img.currentSrc || img.src) : '', qf: qid(g) };
                }),
            });
            return;
        }
        if (role === 'next' || role === 'link' || role === 'whatsapp') {
            consumed.add(el);
            push({ k: 'button', role, text: text(el).slice(0, 120), href: el.getAttribute('data-qf-href') || '', qf: qid(el) });
            return;
        }
        const media = el.dataset.qfId ? nodeForMedia(el) : null;
        if (media || el.hasAttribute('data-qf-media')) {
            const m = media || out.media.find(x => el.contains(document.querySelector(`[data-qf-id="${x.id}"]`)));
            if (m) push({ k: m.kind, ...m });
            return;
        }
        if (tag === 'img') {
            const r = rect(el);
            if (r.width < 24 || r.height < 24) return;
            push({ k: 'image', src: abs(el.currentSrc || el.src), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + window.scrollY), alt: el.alt || '' });
            return;
        }
        if (tag === 'canvas') {
            const id = el.getAttribute('data-qf-canvas');
            if (id) push({ k: 'chart', canvas: id, w: Math.round(rect(el).width), h: Math.round(rect(el).height) });
            return;
        }
        if (tag === 'svg') {
            const r = rect(el);
            const shapes = el.querySelectorAll('path, rect, circle, polyline, line').length;
            if (r.width > 150 && r.height > 80 && shapes > 3) push({ k: 'chart', svg: el.outerHTML.slice(0, 60000), w: Math.round(r.width), h: Math.round(r.height) });
            return;
        }
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
            const type = (el.getAttribute('type') || (tag === 'textarea' ? 'textarea' : tag === 'select' ? 'select' : 'text')).toLowerCase();
            if (['hidden', 'checkbox', 'radio', 'submit', 'button'].includes(type)) return;
            const label = el.labels?.[0]?.innerText || el.closest('label')?.innerText || '';
            if (type === 'range') {
                push({ k: 'slider', min: Number(el.min) || 0, max: Number(el.max) || 100, value: Number(el.value) || 0, label: label.trim() });
                return;
            }
            push({ k: 'input', type, name: el.name || el.id || '', placeholder: el.placeholder || '', label: label.trim().slice(0, 120), options: tag === 'select' ? [...el.options].map(o => o.text).filter(Boolean).slice(0, 30) : undefined });
            return;
        }

        const kids = [...el.children].filter(c => (visible(c) || c.tagName === 'AUDIO') && !consumed.has(c));
        const blockKids = kids.filter(isBlockish);
        if (!blockKids.length) {
            const t = text(el);
            if (!t) { kids.forEach(k => walk(k, depth + 1)); return; }
            const st = styleInfo(el);
            const isHeading = /^h[1-3]$/.test(tag) || st.size >= 22 || (st.size >= 18 && st.weight >= 700 && t.length < 140);
            if (/^\d{1,3}\s*%$/.test(t)) { out.percent = parseInt(t, 10); push({ k: 'percent', value: parseInt(t, 10) }); return; }
            if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) {
                const parts = t.split(':').map(Number);
                push({ k: 'timer', seconds: parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1] });
                return;
            }
            push({ k: isHeading ? 'heading' : 'text', text: t.slice(0, 700), ...st, tag });
            if (isHeading && !out.title) out.title = t.slice(0, 200);
            return;
        }
        // Mixed content: direct text nodes next to block children
        const direct = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean).join(' ');
        if (direct.length > 2) push({ k: 'text', text: direct.slice(0, 700), ...styleInfo(el), tag });
        kids.forEach(k => walk(k, depth + 1));
    };
    walk(root, 0);

    // Detect a height/weight ruler (custom widget, no <input type=range>)
    const bodyText = (document.body.innerText || '').toLowerCase();
    const hasRangeNode = out.outline.some(n => n.k === 'slider' || n.k === 'input');
    if (!hasRangeNode) {
        const big = [...root.querySelectorAll('span, div, p, strong, h1, h2, h3')].filter(e => visible(e) && e.children.length <= 2)
            .map(e => ({ e, t: text(e), s: parseFloat(cs(e)?.fontSize) || 0 }))
            .filter(x => /^\d{2,3}([.,]\d)?\s*(kg|cm|lb|lbs|ft|in|anos|years|años)?$/i.test(x.t) && x.s >= 24)
            .sort((a, b) => b.s - a.s)[0];
        const ticks = [...root.querySelectorAll('div')].some(d => d.children.length > 15 && [...d.children].slice(0, 20).filter(c => { const r = rect(c); return (r.width < 5 && r.height > 8) || /^\d{2,3}$/.test(text(c)); }).length > 8);
        if (big && (ticks || /arraste|deslize|drag|slide|scroll/i.test(bodyText))) {
            const value = parseFloat(big.t.replace(',', '.'));
            const unit = (big.t.match(/[a-zçñ]+$/i) || [''])[0].toLowerCase();
            const kind = /cm|ft|in/.test(unit) || /altura|height|estatura/.test(bodyText) ? 'height' : /kg|lb/.test(unit) || /peso|weight/.test(bodyText) ? 'weight' : /anos|years|años|idade|age|edad/.test(bodyText) ? 'age' : 'generic';
            const idx = out.outline.findIndex(n => (n.k === 'text' || n.k === 'heading') && n.text === big.t);
            const node = { k: 'slider', custom: true, kind, value, unit: unit || (kind === 'height' ? 'cm' : kind === 'weight' ? 'kg' : ''), goal: /meta|desej|ideal|goal|target|objetivo|alcan/.test(bodyText) };
            if (idx >= 0) out.outline.splice(idx, 1, node); else out.outline.push(node);
        }
    }
    return out;
}

module.exports = { annotatePage };
