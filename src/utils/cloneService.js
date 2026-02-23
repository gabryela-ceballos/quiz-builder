// cloneService.js — Calls server-side Puppeteer to scrape quiz page-by-page
// Then normalizes into Player-compatible format

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

// ── Build Player-compatible quiz object from server response ──
function buildPlayerQuiz(extracted) {
    const pages = (extracted.pages || []).map((p, i) => {
        const page = { ...p, id: `p_clone_${i}`, sectionIndex: 0 };
        if (page.options) {
            page.options = page.options.map((o, j) => {
                if (typeof o === 'string') return { text: o, emoji: '', weight: j + 1 };
                return {
                    text: o.text || '', emoji: o.emoji || '', weight: o.weight ?? (j + 1),
                    value: o.value, image: o.image || '',
                };
            });
        }
        return page;
    });

    const questions = pages.filter(p =>
        ['choice', 'multi-select', 'likert', 'statement', 'image-select'].includes(p.type)
    );

    const results = (extracted.results || []).map((r, i) => ({
        id: r.id || `r${i + 1}`,
        name: r.name || `Resultado ${i + 1}`,
        description: r.description || '',
        cta: r.cta || 'Ver resultado →',
        ctaUrl: r.ctaUrl || '',
        minPct: r.minPct ?? (i * 34),
        maxPct: r.maxPct ?? ((i + 1) * 33),
    }));

    const primary = extracted.primaryColor || '#2563eb';

    return {
        id: Math.random().toString(36).slice(2, 10),
        name: extracted.quizName || 'Quiz Clonado',
        emoji: '🔗',
        primaryColor: primary,
        colorPalette: [primary],
        niche: extracted.niche || 'outro',
        metadata: {
            niche: extracted.niche || 'outro',
            subTheme: extracted.quizName || '',
            tone: 'empático',
            palette: [primary],
            emojiStyle: 'moderate',
        },
        sections: [{ label: 'Quiz Clonado', startIndex: 0 }],
        welcome: extracted.welcome || { headline: extracted.quizName || 'Quiz', subheadline: '', cta: 'Começar →' },
        pages,
        questions,
        results,
        collectLead: extracted.collectLead ?? true,
        published: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

// ═══ MAIN EXPORT ═══
export async function cloneFromUrl(url, onProgress) {
    if (!url?.trim()) throw new Error('URL inválida');

    if (onProgress) onProgress('fetching', '🌐 Conectando ao servidor...');

    // Call the server-side Puppeteer scraping endpoint
    if (onProgress) onProgress('scraping', '🔍 Abrindo quiz no navegador...');

    const res = await fetch(`${API_BASE}/api/clone-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao clonar quiz');
    }

    if (onProgress) onProgress('building', '🧱 Montando quiz...');
    const extracted = await res.json();
    console.log(`[Clone] Server returned: ${extracted.pages?.length || 0} pages`);

    if (!extracted.pages?.length) {
        throw new Error('Não foi possível extrair páginas do quiz. Verifique se o link é válido.');
    }

    if (onProgress) onProgress('done', '✅ Quiz clonado com sucesso!');
    return buildPlayerQuiz(extracted);
}
