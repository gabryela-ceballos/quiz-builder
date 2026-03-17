// useAuth.js — Authentication hook
const API = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';

function getToken() {
    return localStorage.getItem('inlead_token');
}

function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function register(name, email, password) {
    const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar');
    localStorage.setItem('inlead_token', data.token);
    localStorage.setItem('inlead_user', JSON.stringify(data.user));
    return data;
}

export async function login(email, password) {
    const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao logar');
    localStorage.setItem('inlead_token', data.token);
    localStorage.setItem('inlead_user', JSON.stringify(data.user));
    return data;
}

export function logout() {
    localStorage.removeItem('inlead_token');
    localStorage.removeItem('inlead_user');
    window.location.href = '/login';
}

export function getUser() {
    try { return JSON.parse(localStorage.getItem('inlead_user')); } catch { return null; }
}

export function isLoggedIn() {
    return !!getToken();
}

export function isAdmin() {
    const user = getUser();
    return user?.role === 'admin';
}

export async function verifyToken() {
    const token = getToken();
    if (!token) return null;
    try {
        const res = await fetch(`${API}/auth/me`, { headers: authHeaders() });
        if (!res.ok) { logout(); return null; }
        const user = await res.json();
        localStorage.setItem('inlead_user', JSON.stringify(user));
        return user;
    } catch { return null; }
}

// Admin API calls
export async function getAdminStats() {
    const res = await fetch(`${API}/admin/stats`, { headers: authHeaders() });
    return await res.json();
}

export async function getAdminUsers() {
    const res = await fetch(`${API}/admin/users`, { headers: authHeaders() });
    return await res.json();
}

export async function updateAdminUser(id, data) {
    await fetch(`${API}/admin/users/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data),
    });
}

export async function deleteAdminUser(id) {
    const res = await fetch(`${API}/admin/users/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
}

export async function getAiUsage() {
    const res = await fetch(`${API}/admin/ai-usage`, { headers: authHeaders() });
    return await res.json();
}

// ── Subscription helpers ──
export async function getSubscription() {
    const res = await fetch(`${API}/subscription`, { headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
}

export async function getPlans() {
    const res = await fetch(`${API}/plans`);
    return await res.json();
}

export async function checkQuota(action) {
    const res = await fetch(`${API}/subscription/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ action }),
    });
    return await res.json();
}

export async function consumeQuota(action) {
    const res = await fetch(`${API}/subscription/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ action }),
    });
    return await res.json();
}
