// quizGenerator.js — 5-step pipeline: analyze → structure → questions → results → images
// Assembles final object only after ALL steps succeed.
// Never returns empty metadata.

import { analyzeProduct, buildStructure, generateQuestions, generateResults, generateQuizImages } from './aiService';

// ── NICHE OPTIONS ──
export const NICHES = [
    { id: 'saude', label: 'Saúde & Bem-estar', emoji: '🧘' },
    { id: 'negocios', label: 'Negócios & Empreendedorismo', emoji: '💼' },
    { id: 'financas', label: 'Finanças Pessoais', emoji: '💰' },
    { id: 'relacionamentos', label: 'Relacionamentos', emoji: '💕' },
    { id: 'carreira', label: 'Carreira & Produtividade', emoji: '🚀' },
    { id: 'educacao', label: 'Educação & Cursos', emoji: '📚' },
    { id: 'beleza', label: 'Beleza & Estética', emoji: '✨' },
    { id: 'alimentacao', label: 'Alimentação & Nutrição', emoji: '🥗' },
    { id: 'fitness', label: 'Fitness & Exercícios', emoji: '💪' },
    { id: 'outro', label: 'Outro', emoji: '🔮' },
];

// ══════════════════════════════════════════════════════════
// VALIDATORS — each ensures its section is never empty/invalid
// ══════════════════════════════════════════════════════════

function validateMetadata(raw, niche) {
    if (!raw || typeof raw !== 'object') {
        throw new Error('[validateMetadata] AI retornou metadata inválido');
    }
    const m = {
        niche: typeof raw.niche === 'string' && raw.niche.trim() ? raw.niche.trim() : niche,
        subTheme: typeof raw.subTheme === 'string' && raw.subTheme.trim() ? raw.subTheme.trim() : '',
        tone: typeof raw.tone === 'string' && raw.tone.trim() ? raw.tone.trim() : 'empático',
        palette: Array.isArray(raw.palette) && raw.palette.length >= 1 ? raw.palette.filter(c => typeof c === 'string' && c.startsWith('#')).slice(0, 3) : ['#3b6b5e'],
        emojiStyle: ['minimal', 'moderate', 'expressive'].includes(raw.emojiStyle) ? raw.emojiStyle : 'moderate',
    };
    // Guarantee palette has 3 colors
    while (m.palette.length < 3) m.palette.push(m.palette[0]);
    // subTheme fallback
    if (!m.subTheme) m.subTheme = m.niche;
    return m;
}

function validatePhases(raw) {
    const phases = Array.isArray(raw?.phases) ? raw.phases : Array.isArray(raw) ? raw : [];
    if (phases.length === 0) {
        throw new Error('[validatePhases] AI retornou 0 phases');
    }
    return phases.map((phase, pi) => ({
        label: typeof phase.label === 'string' && phase.label.trim() ? phase.label.trim() : `Fase ${pi + 1}`,
        items: Array.isArray(phase.items) ? phase.items.map(normalizeItem).filter(Boolean) : [],
    }));
}

function validateQuestions(raw, phases) {
    let questions = Array.isArray(raw?.questions) ? raw.questions : Array.isArray(raw) ? raw : [];
    questions = questions.filter(q => q && ['choice', 'multi-select', 'statement', 'likert', 'image-select'].includes(q.type)).map(normalizeItem);

    // Fallback: extract from phases if AI returned empty
    if (questions.length === 0) {
        console.warn('[validateQuestions] AI retornou 0 questions, extraindo das phases');
        phases.forEach(phase => {
            phase.items.forEach(item => {
                if (['choice', 'multi-select', 'statement', 'likert', 'image-select'].includes(item.type)) {
                    questions.push(item);
                }
            });
        });
    }

    if (questions.length === 0) {
        throw new Error('[validateQuestions] Nenhuma pergunta válida encontrada');
    }
    return questions;
}

function validateResults(raw) {
    let results = Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
    results = results.map(r => ({
        id: typeof r.id === 'string' && r.id ? r.id : `r_${Math.random().toString(36).slice(2, 6)}`,
        name: typeof r.name === 'string' && r.name ? r.name : 'Resultado',
        minPct: typeof r.minPct === 'number' ? r.minPct : 0,
        maxPct: typeof r.maxPct === 'number' ? r.maxPct : 100,
        description: typeof r.description === 'string' ? r.description : '',
        cta: typeof r.cta === 'string' && r.cta ? r.cta : 'Ver resultado →',
        ctaUrl: typeof r.ctaUrl === 'string' ? r.ctaUrl : '',
    })).filter(r => r.name);

    if (results.length === 0) {
        throw new Error('[validateResults] Nenhum resultado válido retornado');
    }
    return results;
}

function normalizeItem(item) {
    if (!item || !item.type) return null;
    if (item.type === 'insight') {
        return { type: 'insight', title: item.title || '', body: item.body || '' };
    }
    if (item.type === 'social-proof') {
        return { type: 'social-proof', headline: item.headline || '', subheadline: item.subheadline || '' };
    }
    if (item.type === 'statement') {
        return {
            type: 'statement',
            text: item.text || '',
            quote: item.quote || '',
            options: Array.isArray(item.options) ? item.options : ['Discordo vivamente', 'Discordo parcialmente', 'Concordo parcialmente', 'Concordo vivamente'],
        };
    }
    if (item.type === 'likert') {
        return {
            type: 'likert',
            text: item.text || '',
            options: Array.isArray(item.options)
                ? item.options.map((o, i) => ({
                    text: typeof o === 'string' ? o : (o?.text || ''),
                    value: o?.value ?? (i + 1),
                    weight: o?.weight ?? (i + 1),
                }))
                : [{ text: 'Quase nunca', value: 1, weight: 1 }, { text: 'Raramente', value: 2, weight: 2 }, { text: 'Às vezes', value: 3, weight: 3 }, { text: 'Frequentemente', value: 4, weight: 4 }, { text: 'Sempre', value: 5, weight: 5 }],
        };
    }
    if (item.type === 'image-select') {
        return {
            type: 'image-select',
            text: item.text || '',
            options: Array.isArray(item.options)
                ? item.options.map((o, i) => ({
                    text: typeof o === 'string' ? o : (o?.text || ''),
                    image: o?.image || o?.emoji || '📷',
                    weight: o?.weight ?? (i + 1),
                }))
                : [],
        };
    }
    if (['choice', 'multi-select'].includes(item.type)) {
        return {
            type: item.type,
            text: item.text || '',
            options: Array.isArray(item.options)
                ? item.options.map(o => typeof o === 'string' ? { text: o, emoji: '' } : { text: o?.text || '', emoji: o?.emoji || '', weight: o?.weight })
                : [],
        };
    }
    return null;
}

// ══════════════════════════════════════════════════════════
// ASSEMBLER — builds Player-compatible format from standard
// ══════════════════════════════════════════════════════════

function assembleQuiz({ metadata, phases, questions, results, images }, { productName, niche, id }) {
    const nicheObj = NICHES.find(n => n.id === niche) || NICHES[NICHES.length - 1];

    // Build flat pages + sections from phases
    const pages = [];
    const sections = [];
    // Inject images into insight and social-proof pages
    let insightImgIdx = 0;
    phases.forEach((phase, pi) => {
        sections.push({ label: phase.label, startIndex: pages.length });
        phase.items.forEach((item, ii) => {
            const page = { ...item, id: `p${pi}_i${ii}`, sectionIndex: pi };
            // Inject image URLs into pages
            if (item.type === 'social-proof' && images?.socialProof) {
                page.imageUrl = images.socialProof;
            }
            if (item.type === 'insight' && images?.insights?.[insightImgIdx]) {
                page.imageUrl = images.insights[insightImgIdx];
                insightImgIdx++;
            }
            pages.push(page);
        });
    });

    return {
        id,
        name: `Quiz: ${productName}`,
        emoji: nicheObj.emoji,
        primaryColor: metadata.palette[0],
        colorPalette: metadata.palette,
        productName,
        niche,
        metadata,
        sections,
        welcome: {
            headline: `Descubra seu perfil para ${productName}`,
            subheadline: `Responda algumas perguntas e receba seu resultado personalizado para ${metadata.subTheme}.`,
            cta: 'Começar o questionário →',
        },
        pages,
        questions,
        results,
        collectLead: true,
        published: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

// ══════════════════════════════════════════════════════════
// PUBLIC — 4-step pipeline
// ══════════════════════════════════════════════════════════

export async function generateQuiz({ productName, productDescription, niche = 'outro', onProgress }) {
    const id = Math.random().toString(36).slice(2, 10);
    const desc = productDescription || '';

    // ── STEP 1: Analyze Product → metadata ──
    if (onProgress) onProgress('analyzing');
    let metadata;
    try {
        const rawMeta = await analyzeProduct(productName, desc, niche);
        metadata = validateMetadata(rawMeta, niche);
        console.log('[Step 1/4] ✅ metadata:', metadata);
    } catch (err) {
        console.error('[Step 1/4] ❌ analyzeProduct falhou:', err.message);
        throw new Error(`Falha na análise do produto: ${err.message}`);
    }

    // ── STEP 2: Build Structure → structure.phases ──
    if (onProgress) onProgress('structuring');
    let phases;
    try {
        const rawStructure = await buildStructure(productName, desc, metadata);
        phases = validatePhases(rawStructure);
        console.log(`[Step 2/4] ✅ structure: ${phases.length} phases, ${phases.reduce((s, p) => s + p.items.length, 0)} items`);
    } catch (err) {
        console.error('[Step 2/4] ❌ buildStructure falhou:', err.message);
        throw new Error(`Falha ao construir estrutura: ${err.message}`);
    }

    // ── STEP 3: Generate Questions → questions[] ──
    if (onProgress) onProgress('questions');
    let questions;
    try {
        const rawQuestions = await generateQuestions(phases);
        questions = validateQuestions(rawQuestions, phases);
        console.log(`[Step 3/4] ✅ questions: ${questions.length} perguntas`);
    } catch (err) {
        console.error('[Step 3/4] ❌ generateQuestions falhou:', err.message);
        throw new Error(`Falha ao gerar perguntas: ${err.message}`);
    }

    // ── STEP 4: Generate Results → results[] ──
    if (onProgress) onProgress('results');
    let results;
    try {
        const rawResults = await generateResults(productName, metadata, questions, phases);
        results = validateResults(rawResults);
        console.log(`[Step 4/5] ✅ results: ${results.length} perfis`);
    } catch (err) {
        console.error('[Step 4/5] ❌ generateResults falhou:', err.message);
        throw new Error(`Falha ao gerar resultados: ${err.message}`);
    }

    // ── STEP 5: Generate Images → images (non-blocking) ──
    if (onProgress) onProgress('images');
    let images = { socialProof: null, insights: [] };
    try {
        images = await generateQuizImages(metadata, phases);
        const total = (images.socialProof ? 1 : 0) + images.insights.filter(Boolean).length;
        console.log(`[Step 5/5] ✅ images: ${total} geradas`);
    } catch (err) {
        console.warn('[Step 5/5] ⚠️ generateQuizImages falhou (não-crítico):', err.message);
        // Non-blocking: quiz works without images
    }

    // ── ASSEMBLE — only after all steps succeed ──
    const quiz = assembleQuiz({ metadata, phases, questions, results, images }, { productName, niche, id });
    console.log('[Pipeline] ✅ Quiz montado com sucesso:', { id: quiz.id, pages: quiz.pages.length, questions: quiz.questions.length, results: quiz.results.length });
    return quiz;
}

// ── SCORE CALCULATOR ──
export function calculateQuizResult(quiz, answers) {
    const questions = quiz.questions || [];
    let totalScore = 0, totalPossible = 0;

    questions.forEach((q, qi) => {
        const ans = answers[qi];
        if (ans === undefined || ans === null) return;

        if (q.type === 'multi-select') {
            totalPossible += 100;
            const opts = q.options || [];
            totalScore += Array.isArray(ans) ? (ans.length / Math.max(opts.length, 1)) * 100 : 50;
        } else if (q.type === 'likert') {
            totalPossible += 100;
            const opt = (q.options || [])[ans];
            const val = opt?.value ?? (ans + 1);
            totalScore += (val / 5) * 100;
        } else if (q.type === 'image-select') {
            totalPossible += 100;
            const opt = (q.options || [])[ans];
            const w = opt?.weight ?? (ans + 1);
            const maxW = Math.max(...(q.options || []).map(o => o?.weight ?? 1), 1);
            totalScore += (w / maxW) * 100;
        } else if (q.type === 'statement') {
            totalPossible += 100;
            const n = q.options ? q.options.length : 4;
            totalScore += (ans / Math.max(n - 1, 1)) * 100;
        } else if (['choice', 'picker', 'age-choice'].includes(q.type)) {
            const n = q.options ? q.options.length : 4;
            totalPossible += 100;
            totalScore += (ans / Math.max(n - 1, 1)) * 100;
        } else {
            totalPossible += 100;
            totalScore += 50;
        }
    });

    const pct = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 50;
    const profiles = quiz.results || [];
    const matched = profiles.find(r => pct >= r.minPct && pct <= r.maxPct) || profiles[profiles.length - 1];
    return { result: matched, score: pct };
}
