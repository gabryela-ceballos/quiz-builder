// convert.cjs — turns the outline captured by annotate.cjs into native builder blocks (server side)

const rid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const NOISE_RE = [
    /^(passo|etapa|step|pergunta|question|paso)?\s*\d+\s*(\/|de|of)\s*\d+$/i,
    /©|todos os direitos|all rights reserved|pol[ií]tica de privacidade|privacy policy|termos de uso|terms of (use|service)|t[eé]rminos|derechos reservados/i,
    /^(pular|skip|fechar|close)$/i,
];
const isNoise = (t) => !t || NOISE_RE.some(r => r.test(t.trim()));

function inputSemantics(str) {
    const s = (str || '').toLowerCase();
    if (/e-?mail|correo/.test(s)) return { type: 'email-input', varName: 'email' };
    if (/whats|telefone|celular|phone|tel\b|móvil|movil/.test(s)) return { type: 'phone-input', varName: 'telefone' };
    if (/(peso|weight).{0,20}(meta|desej|ideal|goal|target|alcan)|(meta|desej|ideal|goal|target).{0,20}(peso|weight)/.test(s)) return { type: 'number-input', varName: 'peso_meta', unit: 'kg', min: 30, max: 250 };
    if (/peso|weight|\bkg\b/.test(s)) return { type: 'number-input', varName: 'peso', unit: 'kg', min: 30, max: 250 };
    if (/altura|height|estatura|\bcm\b/.test(s)) return { type: 'number-input', varName: 'altura', unit: 'cm', min: 120, max: 230 };
    if (/idade|age\b|edad|anos|years/.test(s)) return { type: 'number-input', varName: 'idade', unit: 'anos', min: 12, max: 100 };
    if (/nome|name|nombre/.test(s)) return { type: 'text-input', varName: 'nome' };
    return { type: 'text-input', varName: '' };
}

function parseWhatsApp(href) {
    try {
        const u = new URL(href);
        const phone = (u.pathname.replace(/\D/g, '') || u.searchParams.get('phone') || '').replace(/\D/g, '');
        return { type: 'whatsapp', phone, message: u.searchParams.get('text') || '' };
    } catch { return { type: 'whatsapp', phone: '', message: '' }; }
}

function buttonActionFor(node) {
    if (node.role === 'link' && node.href) return { type: 'url', url: node.href, newTab: false };
    if (node.role === 'whatsapp' && node.href) return parseWhatsApp(node.href);
    return null;
}

const LIST_MARK = /^([✓✔✅☑•▪◦➜→►▶\-–—]|\p{Extended_Pictographic})\s*/u;

/**
 * page: { outline, pageType, media, canvases, links, hasBack, title }
 * returns { name, blocks, step: {...stepProps}, report: {converted: [], notes: []}, logoUrl }
 */
function convertPage(page, index = 0) {
    const report = { converted: [], notes: [] };
    const stepProps = {};
    let logoUrl = '';
    let nodes = (page.outline || []).filter(n => n && n.k !== 'back');
    const type = page.pageType || 'insight';

    // Logo: small image at the very top
    const firstImg = nodes.findIndex(n => n.k === 'image');
    if (firstImg >= 0 && firstImg <= 2 && nodes[firstImg].h < 90 && nodes[firstImg].w < 280 && (nodes[firstImg].top ?? 0) < 180) {
        logoUrl = nodes[firstImg].src;
        nodes.splice(firstImg, 1);
        report.converted.push('Logo movida para o topo do quiz');
    }
    // Header noise (step counters, legal footer)
    nodes = nodes.filter(n => !((n.k === 'text' || n.k === 'heading') && isNoise(n.text)));
    const hasOptions = nodes.some(n => n.k === 'options');
    const hasInputs = nodes.some(n => n.k === 'input' || n.k === 'slider');
    // A "37%" next to a question is the quiz's own progress indicator, not content
    if (type !== 'loading' && (hasOptions || hasInputs)) nodes = nodes.filter(n => n.k !== 'percent');

    const blocks = [];
    const used = new Set();
    const take = (n) => used.add(n);

    // ── Loading / analysis page ──
    const isLoading = type === 'loading' || (nodes.some(n => n.k === 'percent') && !hasOptions && !hasInputs);
    if (isLoading) {
        const texts = nodes.filter(n => n.k === 'heading' || n.k === 'text');
        const title = texts[0]?.text || 'Analisando suas respostas...';
        const items = texts.slice(1).map(t => t.text).filter(t => t.length < 80).slice(0, 6);
        blocks.push({ id: rid('blk'), type: 'progress-bar', title, items: items.length ? items : ['Analisando respostas...', 'Calculando resultado...', 'Preparando seu plano...'], duration: 5 });
        texts.forEach(take);
        nodes.filter(n => n.k === 'percent').forEach(take);
        stepProps.hideProgress = true;
        report.converted.push('Tela de carregamento → Barra de análise animada');
    }

    // ── Welcome / cover ──
    const nextBtn = nodes.find(n => n.k === 'button' && n.role === 'next');
    const firstHeading = nodes.find(n => n.k === 'heading');
    const isWelcome = !isLoading && !hasOptions && !hasInputs && nextBtn && firstHeading && (type === 'welcome' || index === 0);
    if (isWelcome) {
        const hi = nodes.indexOf(firstHeading);
        const sub = nodes.slice(hi + 1).find(n => n.k === 'text' && !used.has(n));
        const img = nodes.find(n => n.k === 'image' && n.w > 160);
        const imgBefore = img && nodes.indexOf(img) < hi;
        blocks.push({
            id: rid('blk'), type: 'welcome', emoji: '', headline: firstHeading.text, subtitle: sub?.text || '',
            cta: nextBtn.text || 'Começar →', note: '', imageUrl: img?.src || '', imagePosition: imgBefore ? 'top' : 'center', textAlign: firstHeading.align === 'left' ? 'left' : 'center',
        });
        [firstHeading, sub, img, nextBtn].filter(Boolean).forEach(take);
        stepProps.hideProgress = true;
        report.converted.push('Capa → bloco Capa editável');
    }

    // ── Question with options ──
    const optNode = nodes.find(n => n.k === 'options' && !used.has(n));
    let questionBlock = null;
    if (optNode) {
        const oi = nodes.indexOf(optNode);
        const before = nodes.slice(0, oi).filter(n => !used.has(n) && (n.k === 'heading' || n.k === 'text'));
        const qNode = [...before].reverse().find(n => n.k === 'heading') || before[before.length - 1];
        const descNodes = qNode ? before.slice(before.indexOf(qNode) + 1).filter(n => n.k === 'text' && n.text.length < 200) : [];
        const multi = optNode.multi || type === 'multi-select';
        const withImages = optNode.items.filter(it => it.image).length >= Math.ceil(optNode.items.length / 2);
        const layout = withImages ? (optNode.columns >= 2 ? 'image-text' : 'icon-text') : optNode.columns >= 2 ? 'grid' : 'list';
        questionBlock = {
            id: rid('blk'), type: 'choice', text: qNode?.text || '', desc: descNodes.map(d => d.text).join(' '),
            optionLayout: layout, multiSelect: multi, autoAdvance: !multi, required: true,
            options: optNode.items.map((it, i) => ({ id: rid('o'), text: it.text || `Opção ${i + 1}`, emoji: it.emoji || '', image: it.image || '', desc: it.desc || '', points: i + 1, _qf: it.qf })),
        };
        if (qNode) take(qNode);
        descNodes.forEach(take);
        take(optNode);
        report.converted.push(`Pergunta com ${optNode.items.length} opções${multi ? ' (múltipla escolha)' : ''} → bloco nativo`);
    }

    // ── Inputs ──
    const inputNodes = nodes.filter(n => n.k === 'input' && !used.has(n));
    const semantics = inputNodes.map(n => ({ n, sem: inputSemantics(`${n.name} ${n.placeholder} ${n.label} ${n.type}`) }));
    const contactFields = semantics.filter(s => ['email-input', 'phone-input'].includes(s.sem.type) || s.sem.varName === 'nome');
    let captureBlock = null;
    if (contactFields.length >= 2) {
        const hi = nodes.indexOf(contactFields[0].n);
        const before = nodes.slice(0, hi).filter(n => !used.has(n) && (n.k === 'heading' || n.k === 'text'));
        const title = [...before].reverse().find(n => n.k === 'heading') || before[0];
        const subtitle = title ? before.slice(before.indexOf(title) + 1).find(n => n.k === 'text') : null;
        const fields = [];
        contactFields.forEach(({ n, sem }) => {
            fields.push(sem.type === 'email-input' ? 'email' : sem.type === 'phone-input' ? 'phone' : 'name');
            take(n);
        });
        const submit = nodes.find(n => n.k === 'button' && n.role === 'next' && !used.has(n));
        captureBlock = { id: rid('blk'), type: 'capture', title: title?.text || 'Quase lá!', subtitle: subtitle?.text || '', fields: [...new Set(fields)], buttonText: submit?.text || 'Continuar →' };
        [title, subtitle, submit].filter(Boolean).forEach(take);
        report.converted.push(`Formulário (${fields.join(', ')}) → Formulário de lead`);
    }

    const pendingHeadingFor = (n) => {
        const i = nodes.indexOf(n);
        return [...nodes.slice(0, i)].reverse().find(x => !used.has(x) && (x.k === 'heading' || x.k === 'text'));
    };

    // ── Walk remaining nodes in order ──
    let continueLabel = '';
    let pendingList = [];
    const flushList = () => {
        if (pendingList.length >= 2) {
            const mark = (pendingList[0].text.match(LIST_MARK) || ['', '✅'])[1] || '✅';
            blocks.push({ id: rid('blk'), type: 'arguments', title: '', emoji: mark.length <= 2 ? mark : '✅', items: pendingList.map(n => n.text.replace(LIST_MARK, '').trim()) });
            report.converted.push(`Lista com ${pendingList.length} itens → Benefícios`);
        } else pendingList.forEach(n => blocks.push(textBlock(n)));
        pendingList = [];
    };
    const textBlock = (n) => {
        const variant = n.k === 'heading' ? (n.size >= 24 ? 'headline' : 'subheadline') : n.size <= 13 ? 'caption' : 'body';
        return { id: rid('blk'), type: 'text', variant, content: n.text, align: n.align || 'center', bold: n.k !== 'heading' && n.weight >= 600 };
    };

    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (used.has(n)) {
            if (n === optNode && questionBlock) { flushList(); blocks.push(questionBlock); }
            if (captureBlock && n === contactFields[0]?.n) { flushList(); blocks.push(captureBlock); }
            continue;
        }
        if ((n.k === 'text') && LIST_MARK.test(n.text) && n.text.length < 160) { pendingList.push(n); continue; }
        flushList();

        switch (n.k) {
            case 'heading':
            case 'text': {
                // Testimonial: quoted text followed by a short name
                const next = nodes[i + 1];
                const quoted = /^["“”'«].{30,}/.test(n.text) || (n.text.length > 60 && /[★⭐]/.test(next?.text || ''));
                if (quoted && next && (next.k === 'text' || next.k === 'heading') && next.text.length < 40) {
                    blocks.push({ id: rid('blk'), type: 'testimonial', name: next.text.replace(/[★⭐]+/g, '').replace(/^[-–—]\s*/, '').trim() || 'Cliente', text: n.text.replace(/^["“”'«]|["“”'»]$/g, ''), rating: 5 });
                    used.add(next);
                    report.converted.push('Depoimento → bloco Depoimento');
                    break;
                }
                const prev = blocks[blocks.length - 1];
                if (n.k === 'text' && prev?.type === 'text' && prev.variant === 'body' && n.size > 13 && n.size < 20 && (prev.content + n.text).length < 700 && !prev._fromHeading) {
                    prev.content = `${prev.content}\n\n${n.text}`;
                } else blocks.push(textBlock(n));
                break;
            }
            case 'image':
                blocks.push({ id: rid('blk'), type: 'image', imageUrl: n.src, alt: n.alt || '', rounded: true });
                break;
            case 'chart':
                blocks.push({ id: rid('blk'), type: 'image', imageUrl: n.canvas ? `canvas:${n.canvas}` : `svg:${i}`, _svg: n.svg || undefined, alt: 'Gráfico', rounded: true, _chart: true });
                report.notes.push('Gráfico copiado como imagem — se ele depende das respostas, veja “Conteúdo dinâmico”.');
                break;
            case 'video':
                blocks.push({ id: rid('blk'), type: 'video', videoUrl: n.src || '', embedHtml: n.embedHtml || '', provider: n.provider || '' });
                report.converted.push(`Vídeo (${n.provider || 'arquivo'}) → bloco Vídeo editável`);
                break;
            case 'audio':
                blocks.push({ id: rid('blk'), type: 'audio', audioUrl: n.src, imageUrl: n.avatar || '', senderName: n.sender || '' });
                report.converted.push('Áudio → bloco Áudio editável');
                break;
            case 'lottie':
                blocks.push({ id: rid('blk'), type: 'lottie', src: n.src, loop: true, height: 220 });
                report.converted.push('Animação Lottie → bloco Animação');
                break;
            case 'timer':
                blocks.push({ id: rid('blk'), type: 'timer', duration: n.seconds || 600, title: 'Oferta expira em:', timerFormat: 'digital', autoAdvance: false });
                report.converted.push('Contador → bloco Timer');
                break;
            case 'slider': {
                const h = pendingHeadingFor(n);
                if (h) { used.add(h); const bi = blocks.findIndex(b => b.content === h.text); if (bi >= 0) blocks.splice(bi, 1); }
                const text = h?.text || '';
                if (n.kind === 'height') blocks.push({ id: rid('blk'), type: 'scroll-picker', text: text || 'Qual é a sua altura?', unit: n.unit || 'cm', min: 120, max: 220, step: 1, defaultValue: Math.round(n.value) || 170, varName: 'altura' });
                else if (n.kind === 'weight') blocks.push({ id: rid('blk'), type: 'weight-picker', text: text || 'Qual é o seu peso?', unit: n.unit || 'kg', min: 30, max: 220, step: 1, defaultValue: Math.round(n.value) || 70, varName: n.goal ? 'peso_meta' : 'peso' });
                else if (n.kind === 'age') blocks.push({ id: rid('blk'), type: 'slider', text: text || 'Qual é a sua idade?', min: 16, max: 90, step: 1, defaultValue: Math.round(n.value) || 30, unit: 'anos', varName: 'idade' });
                else blocks.push({ id: rid('blk'), type: 'slider', text, min: n.min ?? 0, max: n.max ?? 100, step: 1, defaultValue: n.value ?? 50, unit: n.unit || '' });
                report.converted.push('Régua/slider → bloco nativo com valor salvo em variável');
                break;
            }
            case 'input': {
                // The <label> text was also walked as a loose text node: drop it, the field shows it
                const labelText = (n.label || '').trim();
                if (labelText) {
                    for (let bi = blocks.length - 1; bi >= 0; bi--) if (blocks[bi].type === 'text' && labelText.startsWith(blocks[bi].content.trim())) { blocks.splice(bi, 1); break; }
                }
                const sem = inputSemantics(`${n.name} ${n.placeholder} ${n.label} ${n.type}`);
                // Prefer the page question (heading) as the field title; keep the label as example text
                const prevTexts = nodes.slice(0, i).filter(x => (x.k === 'heading' || x.k === 'text') && x.text.trim() !== labelText.split('\n')[0].trim());
                const h = [...prevTexts].reverse().find(x => x.k === 'heading' && !nodes.slice(nodes.indexOf(x) + 1, i).some(y => y.k === 'input' || y.k === 'options'));
                const label = h?.text || labelText.split('\n')[0] || '';
                if (h) { used.add(h); const bi = blocks.findIndex(b => b.type === 'text' && b.content === h.text); if (bi >= 0) blocks.splice(bi, 1); }
                if (!n.placeholder && h && labelText) n.placeholder = labelText.split('\n')[0];
                if (n.type === 'select' && n.options?.length) {
                    blocks.push({ id: rid('blk'), type: 'single-choice', text: label, desc: '', autoAdvance: false, required: true, options: n.options.map((t, oi) => ({ id: rid('o'), text: t, points: oi + 1 })) });
                } else if (n.type === 'textarea') {
                    blocks.push({ id: rid('blk'), type: 'textarea-input', text: label || 'Conte mais', placeholder: n.placeholder || '', required: false });
                } else if (n.type === 'date') {
                    blocks.push({ id: rid('blk'), type: 'date-input', text: label || 'Data' });
                } else if (sem.type === 'number-input') {
                    blocks.push({ id: rid('blk'), type: 'number-input', text: label, placeholder: n.placeholder || '', unit: sem.unit, min: sem.min, max: sem.max, varName: sem.varName });
                } else {
                    blocks.push({ id: rid('blk'), type: sem.type, text: label, placeholder: n.placeholder || '', varName: sem.varName || undefined, required: true });
                }
                report.converted.push(`Campo “${(label || n.placeholder || n.type).slice(0, 30)}” → bloco nativo`);
                break;
            }
            case 'button': {
                const action = buttonActionFor(n);
                if (action) {
                    blocks.push({ id: rid('blk'), type: 'button', text: n.text || 'Continuar', action, animation: action.type === 'url' ? 'pulse' : 'none', size: 'lg', style: 'primary' });
                    report.converted.push(action.type === 'url' ? `Botão “${n.text.slice(0, 24)}” → abre ${action.url.replace(/^https?:\/\//, '').slice(0, 30)}` : `Botão “${n.text.slice(0, 24)}” → WhatsApp`);
                    break;
                }
                // next button
                const selfAdvancing = blocks.some(b => ['scroll-picker', 'weight-picker', 'number-input', 'capture', 'welcome', 'progress-bar'].includes(b.type))
                    || (questionBlock && !questionBlock.multiSelect && !nodes.some(x => x.k === 'input' && !used.has(x)));
                if (selfAdvancing) break;
                const answerable = questionBlock || blocks.some(b => /-input$|^slider$|^single-choice$/.test(b.type));
                if (answerable) continueLabel = n.text;
                else blocks.push({ id: rid('blk'), type: 'button', text: n.text || 'Continuar', size: 'lg', style: 'primary' });
                break;
            }
            case 'percent':
                break;
            default:
                break;
        }
    }
    flushList();
    if (questionBlock && !blocks.includes(questionBlock)) blocks.push(questionBlock);
    if (captureBlock && !blocks.includes(captureBlock)) blocks.push(captureBlock);

    // Media found in the page but not placed (hidden <audio>, players outside the main container)
    (page.media || []).forEach(m => {
        const placed = blocks.some(b => (m.src && (b.videoUrl === m.src || b.audioUrl === m.src || b.src === m.src)) || (m.embedHtml && b.embedHtml === m.embedHtml));
        if (placed) return;
        if (m.kind === 'audio') blocks.unshift({ id: rid('blk'), type: 'audio', audioUrl: m.src, imageUrl: m.avatar || '', senderName: m.sender || '' });
        if (m.kind === 'video') blocks.unshift({ id: rid('blk'), type: 'video', videoUrl: m.src || '', embedHtml: m.embedHtml || '', provider: m.provider || '' });
        if (m.kind === 'lottie') {
            const ai = blocks.findIndex(b => b.type === 'button');
            const lb = { id: rid('blk'), type: 'lottie', src: m.src, loop: true, height: 200 };
            if (ai >= 0) blocks.splice(ai, 0, lb); else blocks.push(lb);
            report.converted.push('Animação Lottie → bloco Animação');
        }
    });

    if (continueLabel) { stepProps.continueLabel = continueLabel; stepProps.continueButton = 'always'; }
    if (!blocks.length) report.notes.push('Nada foi reconhecido nesta página — use o modo HTML fiel.');

    const name = (questionBlock?.text || blocks.find(b => b.type === 'welcome')?.headline || page.title || blocks.find(b => b.type === 'text')?.content || `Etapa ${index + 1}`)
        .replace(/\s+/g, ' ').slice(0, 30);

    // Confidence: share of the page's text that ended up in blocks
    const pageText = (page.outline || []).filter(n => n.text && !(n.k === 'button' && n.role === 'next')).map(n => n.text).join(' ');
    const blockText = JSON.stringify(blocks);
    const words = pageText.split(/\s+/).filter(w => w.length > 3);
    const covered = words.filter(w => blockText.includes(w)).length;
    const confidence = words.length ? Math.round((covered / words.length) * 100) : (blocks.length ? 80 : 0);

    return { name, blocks, step: stepProps, report, logoUrl, confidence };
}

// ── Apply "dynamic content" findings to converted blocks ──
function applyDynamic(blocks, findings) {
    if (!findings?.length) return blocks;
    const fields = ['content', 'text', 'title', 'headline', 'subtitle', 'desc', 'body', 'label', 'subheadline'];
    const out = blocks.map(b => {
        const nb = { ...b };
        findings.forEach(f => {
            if (!f.expr || !f.original) return;
            fields.forEach(k => {
                if (typeof nb[k] === 'string' && nb[k].includes(f.original)) nb[k] = nb[k].split(f.original).join(f.expr);
            });
            if (Array.isArray(nb.items)) nb.items = nb.items.map(it => (typeof it === 'string' && it.includes(f.original) ? it.split(f.original).join(f.expr) : it));
        });
        return nb;
    });
    // A chart on a page that shows current weight → goal weight becomes a live projection chart
    const hasWeight = findings.some(f => /peso\b/.test(f.expr || ''));
    const hasGoal = findings.some(f => /peso_meta/.test(f.expr || ''));
    const dateFinding = findings.find(f => /data\(/.test(f.expr || ''));
    if (hasWeight && hasGoal) {
        const ci = out.findIndex(b => b._chart);
        const dateExpr = dateFinding ? ((dateFinding.expr.match(/\{\{=\s*data\([^}]*\)\s*\}\}/) || [])[0] || '') : '';
        const proj = { id: rid('blk'), type: 'projection', title: '', from: '{{peso}}', to: '{{peso_meta}}', unit: 'kg', startLabel: 'Hoje', endLabel: dateExpr || 'Meta', badge: 'Meta' };
        if (ci >= 0) out.splice(ci, 1, proj); else out.push(proj);
    }
    return out;
}

// ── Optional AI refinement (never allowed to invent text or URLs) ──
const AI_TYPES = ['text', 'image', 'video', 'audio', 'button', 'choice', 'single-choice', 'yes-no', 'rating', 'nps', 'slider', 'text-input', 'email-input', 'phone-input',
    'textarea-input', 'date-input', 'number-input', 'scroll-picker', 'weight-picker', 'capture', 'welcome', 'testimonial', 'social-proof', 'arguments', 'before-after',
    'faq', 'price', 'alert', 'insight', 'timer', 'progress-bar', 'loading', 'level', 'spacer', 'lottie', 'projection', 'outcome'];

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function validateRefined(original, refined, pageText) {
    if (!Array.isArray(refined) || !refined.length) return null;
    const allowedUrls = new Set((JSON.stringify(original).match(/(https?:\/\/|\/uploads\/|canvas:|svg:|data:)[^"\s]+/g) || []));
    const corpus = norm(pageText + ' ' + JSON.stringify(original));
    const ENUM_KEYS = new Set(['type', 'variant', 'align', 'optionLayout', 'style', 'size', 'animation', 'icon', 'timerFormat', 'alertType', 'alertStyle', 'priceStyle', 'insightStyle', 'id', '_qf', 'provider', 'textAlign', 'imagePosition', 'unit', 'varName', 'emoji', 'yesEmoji', 'noEmoji']);
    let ok = true;
    const check = (v, key) => {
        if (!ok) return;
        if (typeof v === 'string') {
            if (!v || ENUM_KEYS.has(key)) return;
            if (/^(https?:\/\/|\/uploads\/|canvas:|svg:|data:)/.test(v)) { if (!allowedUrls.has(v)) ok = false; return; }
            if (/\{\{/.test(v)) return;
            const n = norm(v);
            if (n.length > 3 && !corpus.includes(n) && !n.split(' ').every(w => w.length < 3 || corpus.includes(w))) ok = false;
        } else if (Array.isArray(v)) v.forEach(x => check(x, key));
        else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => check(x, k));
    };
    refined.forEach(b => { if (!b || !AI_TYPES.includes(b.type)) ok = false; else check(b, ''); });
    if (!ok) return null;
    return refined.map(b => ({ ...b, id: b.id && String(b.id).startsWith('blk_') ? b.id : rid('blk'), options: Array.isArray(b.options) ? b.options.map((o, i) => (typeof o === 'object' ? { ...o, id: o.id || rid('o'), points: o.points ?? i + 1 } : { id: rid('o'), text: String(o), points: i + 1 })) : b.options }));
}

async function refineWithAI(page, converted, { callOpenAI, screenshotB64 } = {}) {
    if (!callOpenAI || !converted.blocks.length) return null;
    const pageText = (page.outline || []).filter(n => n.text).map(n => n.text).join('\n').slice(0, 5000);
    const prompt = `Você converte uma página de quiz clonada em blocos de um construtor. Recebe os blocos gerados por heurística e o texto da página. Melhore a estrutura SEM inventar nada.

TIPOS PERMITIDOS: ${AI_TYPES.join(', ')}.
Campos principais: text{variant:headline|subheadline|body|caption, content, align}, choice{text, desc, optionLayout:list|grid|image-text|icon-text, multiSelect, options:[{id,text,emoji,image,desc,points,_qf}]}, testimonial{name,text,rating}, arguments{title,emoji,items[]}, faq{title,items:[{q,a}]}, price{title,originalPrice,price,discount,features[],cta,ctaUrl}, social-proof{headline,subheadline,emoji}, alert{title,text,alertType:warning|danger|success|info}, insight{title,body}, button{text,action}, welcome{headline,subtitle,cta,imageUrl}.

REGRAS:
- Use SOMENTE textos que existem na página (pode juntar, separar e limpar espaços). Nunca crie textos novos, nunca traduza.
- Nunca invente URLs: mantenha exatamente as que já estão nos blocos.
- Mantenha ids, "_qf", "action", "varName" e a ordem visual.
- Transforme em blocos ricos quando óbvio: depoimentos → testimonial, perguntas e respostas → faq, preço/oferta → price, listas → arguments, números grandes de prova social → social-proof.
- Se um emoji estiver no início do texto de uma opção, mova para "emoji".
- Não duplique a pergunta como texto solto se ela já é o "text" de um choice.

TIPO DA PÁGINA: ${page.pageType}
TEXTO DA PÁGINA:
${pageText}

BLOCOS ATUAIS:
${JSON.stringify(converted.blocks).slice(0, 12000)}

Responda JSON: {"blocks": [...]}`;
    try {
        const res = await Promise.race([
            callOpenAI(prompt, { temperature: 0.1, maxTokens: 3500, imageB64: screenshotB64 }),
            new Promise(r => setTimeout(() => r(null), 30000)),
        ]);
        return validateRefined(converted.blocks, res?.blocks, pageText);
    } catch {
        return null;
    }
}

module.exports = { convertPage, applyDynamic, refineWithAI, inputSemantics };
