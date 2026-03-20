// cloneService.js — Clone + Optimize quiz from URL
// Uses Job-based polling (survives standby, disconnect, browser refresh)

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

// ── Build Player/Builder-compatible quiz object from server response ──
function buildPlayerQuiz(extracted) {
    const pages = (extracted.pages || []).map((p, i) => {
        const page = { ...p, id: `p_clone_${i}`, sectionIndex: 0 };
        // Preserve visual properties from AI analysis
        if (p.bgColor) page.bgColor = p.bgColor;
        if (p.textColor) page.textColor = p.textColor;
        if (p.optionLayout) page.optionLayout = p.optionLayout;
        if (p.imageUrl) page.imageUrl = p.imageUrl;
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
        clonedCSS: extracted.clonedCSS || null,
        questions,
        results,
        collectLead: extracted.collectLead ?? true,
        published: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

// ═══ Clone via Job-based polling (survives standby/disconnect) ═══
export async function cloneAndOptimize(url, niche, mode, productDescription, onProgress, cloneLang) {
    if (!url?.trim()) throw new Error('URL inválida');

    // 1. Start the clone job on the server
    const startRes = await fetch(`${API_BASE}/api/clone-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), lang: (cloneLang && cloneLang !== 'original') ? cloneLang : null }),
    });

    if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({ error: 'Erro ao iniciar clone' }));
        throw new Error(err.error || 'Erro ao iniciar clone');
    }

    const { jobId } = await startRes.json();
    let lastSeen = 0;

    // 2. Poll for status every 2 seconds until done
    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const statusRes = await fetch(`${API_BASE}/api/clone-status/${jobId}?lastSeen=${lastSeen}`);

                if (!statusRes.ok) {
                    // Retry on network errors (e.g., waking from standby)
                    setTimeout(poll, 3000);
                    return;
                }

                const data = await statusRes.json();

                // Show new progress messages
                if (data.progress && data.progress.length > 0) {
                    for (const p of data.progress) {
                        if (p.stage !== 'heartbeat' && onProgress) {
                            onProgress(p.stage, p.msg, p);
                        }
                    }
                }
                lastSeen = data.progressCount;

                // Check if done
                if (data.status === 'done' && data.result) {
                    resolve(buildPlayerQuiz(data.result));
                    return;
                }

                // Check if error
                if (data.status === 'error') {
                    reject(new Error(data.error || 'Erro ao clonar'));
                    return;
                }

                // Still running, poll again
                setTimeout(poll, 2000);

            } catch (err) {
                // Network error (standby, disconnect, etc.) — just retry
                console.warn('[Clone] Poll error, retrying...', err.message);
                setTimeout(poll, 3000);
            }
        };

        // Start polling
        poll();
    });
}

// ═══ Clone from URL (shortcut) ═══
export async function cloneFromUrl(url, onProgress) {
    return cloneAndOptimize(url, 'outro', 'clone_only', '', onProgress);
}
