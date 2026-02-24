// cloneService.js — Clone + Optimize quiz from URL
// Uses SSE (Server-Sent Events) for real-time progress

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

// ── Build Player/Builder-compatible quiz object from server response ──
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
        niche: extracted.niche || extracted.metadata?.niche || 'outro',
        metadata: {
            niche: extracted.niche || extracted.metadata?.niche || 'outro',
            subTheme: extracted.quizName || '',
            tone: 'empático',
            palette: [primary],
            emojiStyle: 'moderate',
            ...(extracted.metadata || {}),
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

// ═══ Clone via SSE stream (real-time progress) ═══
export async function cloneAndOptimize(url, niche, mode, productDescription, onProgress) {
    if (!url?.trim()) throw new Error('URL inválida');

    return new Promise((resolve, reject) => {
        const params = new URLSearchParams({ url: url.trim() });
        const evtSource = new EventSource(`${API_BASE}/api/clone-stream?${params}`);
        let quizData = null;

        evtSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'progress') {
                    if (onProgress) onProgress(data.stage, data.msg, data);
                }
                else if (data.type === 'result') {
                    quizData = data.quiz;
                }
                else if (data.type === 'error') {
                    evtSource.close();
                    reject(new Error(data.error || 'Erro ao clonar'));
                }

                // Complete = close and resolve
                if (data.stage === 'complete') {
                    evtSource.close();
                    if (quizData) {
                        resolve(buildPlayerQuiz(quizData));
                    } else {
                        reject(new Error('Nenhum dado recebido do servidor'));
                    }
                }
            } catch (e) {
                console.error('SSE parse error:', e);
            }
        };

        evtSource.onerror = (err) => {
            evtSource.close();
            // If we got quiz data before error, still resolve
            if (quizData) {
                resolve(buildPlayerQuiz(quizData));
            } else {
                reject(new Error('Conexão perdida com o servidor. Tente novamente.'));
            }
        };
    });
}

// ═══ Clone from URL (legacy, non-SSE) ═══
export async function cloneFromUrl(url, onProgress) {
    return cloneAndOptimize(url, 'outro', 'clone_only', '', onProgress);
}
