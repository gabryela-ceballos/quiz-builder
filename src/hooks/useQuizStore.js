const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
const API = `${API_BASE}/api`;

// ── Quizzes ──────────────────────────────────────────
export async function getQuizzes() {
    try {
        const res = await fetch(`${API}/quizzes`);
        return await res.json();
    } catch (_) { return []; }
}

export async function getQuiz(id) {
    try {
        const res = await fetch(`${API}/quizzes/${id}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (_) { return null; }
}

export async function saveQuiz(quiz) {
    try {
        const res = await fetch(`${API}/quizzes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(quiz),
        });
        return await res.json();
    } catch (e) {
        console.error('Erro ao salvar quiz:', e);
        alert('❌ Erro ao salvar quiz. Verifique se o servidor está rodando (node server.js).');
        return null;
    }
}

export async function deleteQuiz(id) {
    try {
        await fetch(`${API}/quizzes/${id}`, { method: 'DELETE' });
    } catch (_) { }
}

export async function clearAllQuizzes() {
    try {
        await fetch(`${API}/quizzes`, { method: 'DELETE' });
    } catch (_) { }
}

// ── Image Upload ──
export async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    try {
        const res = await fetch(`${API}/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        return `${API_BASE}${data.url}`;
    } catch (e) {
        console.error('Erro no upload:', e);
        return null;
    }
}

// ── Leads ─────────────────────────────────────────────
export async function saveLead(quizId, leadData) {
    try {
        await fetch(`${API}/leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quizId, ...leadData }),
        });
    } catch (_) { }
}

export async function getLeads(quizId) {
    try {
        const res = await fetch(`${API}/leads/${quizId}`);
        return await res.json();
    } catch (_) { return []; }
}

// ── Analytics ─────────────────────────────────────────
export async function recordEvent(quizId, event, data = {}) {
    try {
        await fetch(`${API}/analytics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quizId, event, data }),
        });
    } catch (_) { }
}

export async function getAnalytics(quizId) {
    try {
        const res = await fetch(`${API}/analytics/${quizId}`);
        return await res.json();
    } catch (_) { return { starts: 0, completes: 0, conversionRate: 0, events: [], answers: [] }; }
}
