const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
const API = `${API_BASE}/api`;

function authHeaders() {
    const token = localStorage.getItem('inlead_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Quizzes ──────────────────────────────────────────
export async function getQuizzes() {
    try {
        const res = await fetch(`${API}/quizzes`, { headers: authHeaders() });
        if (res.status === 401) {
            localStorage.removeItem('inlead_token');
            localStorage.removeItem('inlead_user');
            window.location.href = '/login';
            return [];
        }
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
        console.log('[saveQuiz] Sending POST to', `${API}/quizzes`, 'with quiz.id:', quiz.id);
        const res = await fetch(`${API}/quizzes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(quiz),
        });
        const data = await res.json();
        console.log('[saveQuiz] Response status:', res.status, 'data.id:', data?.id, 'data.error:', data?.error);
        if (!res.ok) {
            console.error('[saveQuiz] Server error:', data);
            alert(`❌ Erro ao salvar: ${data?.error || res.statusText}`);
            return null;
        }
        return data;
    } catch (e) {
        console.error('Erro ao salvar quiz:', e);
        alert('❌ Erro ao salvar quiz. Verifique se o servidor está rodando (node server.js).');
        return null;
    }
}

export async function deleteQuiz(id) {
    try {
        await fetch(`${API}/quizzes/${id}`, { method: 'DELETE', headers: authHeaders() });
    } catch (_) { }
}

export async function clearAllQuizzes() {
    try {
        await fetch(`${API}/quizzes`, { method: 'DELETE', headers: authHeaders() });
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

// ── Shares / Collaboration ─────────────────────────────
export async function shareQuiz(quizId, email, role = 'editor') {
    try {
        const res = await fetch(`${API}/shares`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quizId, sharedWith: email, role }),
        });
        return await res.json();
    } catch (e) { return { error: e.message }; }
}

export async function getShares(quizId) {
    try {
        const res = await fetch(`${API}/shares/${quizId}`);
        return await res.json();
    } catch (_) { return []; }
}

export async function removeShare(id) {
    try { await fetch(`${API}/shares/${id}`, { method: 'DELETE' }); } catch (_) { }
}

export async function getSharedQuizzes(email) {
    try {
        const res = await fetch(`${API}/shared-quizzes/${encodeURIComponent(email)}`);
        return await res.json();
    } catch (_) { return []; }
}

// ── Custom Domains ───────────────────────────────────
export async function getAllDomains() {
    try {
        const res = await fetch(`${API}/domains-all`);
        return await res.json();
    } catch (_) { return []; }
}

export async function getDomains(quizId) {
    try {
        const res = await fetch(`${API}/domains/${quizId}`);
        return await res.json();
    } catch (_) { return []; }
}

export async function addDomain(quizId, domain) {
    try {
        const res = await fetch(`${API}/domains`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quizId, domain }),
        });
        return await res.json();
    } catch (e) {
        console.error('Erro ao adicionar domínio:', e);
        return { error: 'Erro de conexão' };
    }
}

export async function removeDomain(id) {
    try {
        await fetch(`${API}/domains/${id}`, { method: 'DELETE' });
    } catch (_) { }
}

export async function verifyDomain(id) {
    try {
        const res = await fetch(`${API}/domains/${id}/verify`, { method: 'POST' });
        return await res.json();
    } catch (e) {
        return { status: 'error', message: 'Erro de conexão' };
    }
}

export async function syncDomainDns(id) {
    try {
        const res = await fetch(`${API}/domains/${id}/sync`, { method: 'POST' });
        return await res.json();
    } catch (e) {
        return { ok: false, dnsRecords: null };
    }
}

export async function getServerInfo() {
    try {
        const res = await fetch(`${API}/server-info`);
        return await res.json();
    } catch (_) { return { hostname: 'seu-servidor.com' }; }
}
