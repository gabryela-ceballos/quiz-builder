// theme.js — design tokens for the v2 quiz renderer (shared by the editor canvas and the live player)

export function hexToRgb(hex) {
    let h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return { r: 37, g: 99, b: 235 };
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export const RADIUS = { none: 0, small: 8, medium: 14, large: 22 };
export const MAIN_WIDTH = { small: 480, medium: 560, large: 720 };

export const FONTS = ['Inter', 'Poppins', 'Montserrat', 'Outfit', 'Nunito', 'Roboto', 'Open Sans', 'Lato', 'DM Sans', 'Playfair Display'];

export const THEME_PRESETS = [
    { key: 'azul', label: 'Azul', primaryColor: '#2563eb', bgColor: '#ffffff' },
    { key: 'roxo', label: 'Roxo', primaryColor: '#7c3aed', bgColor: '#faf8ff' },
    { key: 'verde', label: 'Verde', primaryColor: '#059669', bgColor: '#f6fdf9' },
    { key: 'rosa', label: 'Rosa', primaryColor: '#db2777', bgColor: '#fff7fb' },
    { key: 'laranja', label: 'Laranja', primaryColor: '#ea580c', bgColor: '#fffaf5' },
    { key: 'escuro', label: 'Escuro', primaryColor: '#a78bfa', bgColor: '#0f1020' },
];

// Load a Google Font once per page
const loadedFonts = new Set(['Inter']);
export function ensureFont(family) {
    if (!family || loadedFonts.has(family) || typeof document === 'undefined') return;
    loadedFonts.add(family);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;500;600;700;800&display=swap`;
    document.head.appendChild(link);
}

export function buildTheme(design = {}) {
    const primary = design.primaryColor || '#2563eb';
    const { r, g, b } = hexToRgb(primary);
    const bgColor = design.bgColor || '';
    const isDark = !!bgColor && luminance(bgColor) < 0.45;
    const radius = RADIUS[design.borderRadius] ?? RADIUS.medium;
    return {
        primary,
        onPrimary: luminance(primary) > 0.6 ? '#111827' : '#ffffff',
        rgb: `${r},${g},${b}`,
        bg: bgColor || `linear-gradient(170deg, #ffffff 0%, rgba(${r},${g},${b},0.035) 60%, #f8f9fb 100%)`,
        bgImage: design.bgImage || '',
        isDark,
        card: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
        cardHover: isDark ? 'rgba(255,255,255,0.1)' : `rgba(${r},${g},${b},0.04)`,
        text: isDark ? '#f1f5f9' : '#111827',
        textSec: isDark ? '#cbd5e1' : '#4b5563',
        textMuted: isDark ? '#94a3b8' : '#9ca3af',
        border: isDark ? 'rgba(255,255,255,0.14)' : '#e5e7eb',
        inputBg: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
        radius,
        btnRadius: Math.max(radius, 10),
        font: design.fontFamily || 'Inter',
        align: design.alignment || 'center',
        mainWidth: MAIN_WIDTH[design.mainWidth] || MAIN_WIDTH.small,
        animation: design.animation || 'fade-up',
    };
}
