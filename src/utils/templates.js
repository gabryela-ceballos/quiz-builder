// templates.js — Template store: admin (global) + user (personal) templates
// Stored in localStorage, admin templates visible to everyone

const ADMIN_KEY = 'qb_admin_templates';
const USER_KEY = 'qb_user_templates';

// ── Admin templates (created in /admin, visible to all) ──
export function getAdminTemplates() {
    try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || '[]'); }
    catch { return []; }
}

export function saveAdminTemplate(template) {
    const templates = getAdminTemplates();
    const normalized = {
        ...template,
        id: template.id || Math.random().toString(36).slice(2, 10),
        updatedAt: Date.now(),
        createdAt: template.createdAt || Date.now(),
        isAdmin: true,
    };
    const idx = templates.findIndex(t => t.id === normalized.id);
    if (idx >= 0) templates[idx] = normalized;
    else templates.push(normalized);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(templates));
    return normalized;
}

export function deleteAdminTemplate(id) {
    const templates = getAdminTemplates().filter(t => t.id !== id);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(templates));
}

// ── User templates (saved by user, visible only to them) ──
export function getUserTemplates() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || '[]'); }
    catch { return []; }
}

export function saveUserTemplate(template) {
    const templates = getUserTemplates();
    const normalized = {
        ...template,
        id: template.id || Math.random().toString(36).slice(2, 10),
        updatedAt: Date.now(),
        createdAt: template.createdAt || Date.now(),
        isAdmin: false,
    };
    const idx = templates.findIndex(t => t.id === normalized.id);
    if (idx >= 0) templates[idx] = normalized;
    else templates.push(normalized);
    localStorage.setItem(USER_KEY, JSON.stringify(templates));
    return normalized;
}

export function deleteUserTemplate(id) {
    const templates = getUserTemplates().filter(t => t.id !== id);
    localStorage.setItem(USER_KEY, JSON.stringify(templates));
}

// ── Get all templates (admin first, then user) ──
export function getAllTemplates() {
    return [...getAdminTemplates(), ...getUserTemplates()];
}
