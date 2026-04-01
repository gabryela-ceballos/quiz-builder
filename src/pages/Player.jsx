import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Check, Loader2 } from 'lucide-react';
import { getQuiz, saveLead, recordEvent } from '../hooks/useQuizStore';
import { calculateQuizResult } from '../utils/quizGenerator';

// ═══ COLOR UTILITIES ═══
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function buildTheme(quiz) {
  const primary = quiz.primaryColor || '#3b6b5e';
  const palette = quiz.colorPalette || [primary];
  const secondary = palette[1] || primary;
  const { r, g, b } = hexToRgb(primary);
  const { r: r2, g: g2, b: b2 } = hexToRgb(secondary);
  const onP = luminance(primary) > 0.55 ? '#1a2332' : '#ffffff';
  const customBg = quiz.bgColor;
  const isDarkBg = customBg && luminance(customBg) < 0.45;
  return {
    primary, secondary, onPrimary: onP,
    rgb: `${r},${g},${b}`, rgb2: `${r2},${g2},${b2}`,
    bg: customBg ? customBg : `linear-gradient(160deg, #ffffff 0%, rgba(${r},${g},${b},0.04) 50%, #f8f9fb 100%)`,
    heroBg: `linear-gradient(135deg, rgba(${r},${g},${b},0.08) 0%, rgba(${r2},${g2},${b2},0.03) 100%)`,
    insightBg: `linear-gradient(135deg, rgba(${r},${g},${b},0.05) 0%, rgba(${r2},${g2},${b2},0.02) 100%)`,
    statBg: `rgba(${r},${g},${b},0.06)`,
    card: isDarkBg ? 'rgba(255,255,255,0.08)' : '#ffffff',
    text: isDarkBg ? '#f1f5f9' : '#1a2332',
    textSec: isDarkBg ? '#cbd5e1' : '#4a5568',
    textMuted: isDarkBg ? '#94a3b8' : '#718096',
    border: isDarkBg ? 'rgba(255,255,255,0.12)' : '#e2e8f0',
  };
}

// ═══ NICHE DATA ═══
const NE = {
  saude: { hero: '🌿', phases: ['💭', '🩺', '🔍', '🌱'], result: '🌿', particle: '🍃' },
  negocios: { hero: '🚀', phases: ['💭', '📊', '🔍', '🎯'], result: '💼', particle: '⭐' },
  financas: { hero: '💰', phases: ['💭', '💸', '📊', '💎'], result: '📈', particle: '💎' },
  relacionamentos: { hero: '❤️', phases: ['💭', '💔', '🔍', '💌'], result: '💕', particle: '💗' },
  carreira: { hero: '⭐', phases: ['💭', '🏃', '🔍', '🚀'], result: '🏆', particle: '✨' },
  educacao: { hero: '📚', phases: ['💭', '📝', '🔍', '🎓'], result: '🎓', particle: '📖' },
  beleza: { hero: '✨', phases: ['💭', '🌸', '🔍', '💫'], result: '✨', particle: '🌸' },
  alimentacao: { hero: '🥗', phases: ['💭', '🍎', '🔍', '💪'], result: '🥗', particle: '🍃' },
  fitness: { hero: '💪', phases: ['💭', '🔥', '🔍', '⚡'], result: '🏋️', particle: '🔥' },
  outro: { hero: '🔮', phases: ['💭', '🔍', '🧩', '✨'], result: '🌟', particle: '✨' },
};
function getNicheEmojis(niche) { return NE[niche] || NE.outro; }

// ═══ RICH TEXT PARSER ═══
function parseRichText(text) {
  if (!text) return [];
  return text.split('\n\n').map(block => {
    const t = block.trim();
    if (!t) return null;
    const lines = t.split('\n');
    if (lines.length > 1 && lines.every(l => l.trim().match(/^[•\-✓✔]/))) {
      return { type: 'list', items: lines.map(l => l.replace(/^[•\-✓✔]\s*/, '').trim()) };
    }
    if (t.match(/\d+%/)) return { type: 'stat', text: t };
    if ((t.startsWith('*') && t.endsWith('*')) || (t.startsWith('_') && t.endsWith('_'))) {
      return { type: 'emphasis', text: t.replace(/^[*_]+|[*_]+$/g, '') };
    }
    return { type: 'text', text: t };
  }).filter(Boolean);
}
function Md({ children }) {
  if (!children) return null;
  return <>{String(children).split(/(\*\*[^*]+\*\*)/).map((p, i) =>
    p.startsWith('**') ? <strong key={i}>{p.replace(/\*\*/g, '')}</strong> : p
  )}</>;
}

// ═══ PARTICLES (result animation) ═══
// ═══ TIMER COMPONENT ═══
function TimerBlock({ duration, title, T, onDone }) {
  const [secs, setSecs] = useState(duration || 300);
  useEffect(() => {
    if (secs <= 0) { if (onDone) onDone(); return; }
    const t = setTimeout(() => setSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: T.textSec, marginBottom: 12 }}>{title || 'Tempo restante'}</h3>
      <div style={{ fontSize: '3rem', fontWeight: 800, color: T.primary, fontVariantNumeric: 'tabular-nums', marginBottom: 20, letterSpacing: 2 }}>{mm}:{ss}</div>
      <button style={{ width: '100%', maxWidth: 360, padding: '16px 0', borderRadius: 16, border: 'none', background: T.primary, color: T.onPrimary || '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: `0 4px 16px rgba(${T.rgb},.25)` }} onClick={onDone}>Continuar</button>
    </div>
  );
}

// ═══ LOADING COMPONENT ═══
function LoadingBlock({ title, items, T, onDone }) {
  const [step, setStep] = useState(0);
  const allItems = items || [];
  useEffect(() => {
    if (allItems.length === 0) { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }
    if (step >= allItems.length) { const t = setTimeout(onDone, 800); return () => clearTimeout(t); }
    const t = setTimeout(() => setStep(s => s + 1), 1200);
    return () => clearTimeout(t);
  }, [step, allItems.length]);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: `3px solid ${T.border}`, borderTopColor: T.primary, animation: 'spin 1s linear infinite', marginBottom: 20 }} />
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: T.text, marginBottom: 12 }}>{title || 'Processando...'}</h3>
      {allItems.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, opacity: i < step ? 1 : 0.3, transition: 'opacity 0.4s' }}>
          <span style={{ color: i < step ? '#10b981' : T.textMuted }}>{i < step ? '✓' : '○'}</span>
          <span style={{ fontSize: '0.85rem', color: i < step ? T.text : T.textMuted }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

// ═══ PROGRESS BAR BLOCK (animated 0→100% with checklist) ═══
function ProgressBarBlock({ title, items, duration, T, onDone }) {
  const [pct, setPct] = useState(0);
  const [currentItem, setCurrentItem] = useState(0);
  const allItems = items || [];
  const totalDuration = (duration || 5) * 1000; // ms

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.round((elapsed / totalDuration) * 100));
      setPct(progress);
      // Update current checklist item based on progress
      if (allItems.length > 0) {
        const itemIdx = Math.min(allItems.length - 1, Math.floor((progress / 100) * allItems.length));
        setCurrentItem(itemIdx);
      }
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(onDone, 600);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [totalDuration, allItems.length]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: T.text, marginBottom: 20, textAlign: 'center' }}>{title || 'Analisando...'}</h3>
      
      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 360, marginBottom: 8 }}>
        <div style={{ height: 14, background: T.border || '#e5e7eb', borderRadius: 7, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            height: '100%', width: `${pct}%`, borderRadius: 7,
            background: `linear-gradient(90deg, ${T.primary}, ${T.primary}cc)`,
            transition: 'width 0.15s ease-out',
            boxShadow: `0 0 8px ${T.primary}40`,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: T.primary }}>{pct}%</span>
        </div>
      </div>
      
      {/* Checklist items */}
      {allItems.length > 0 && (
        <div style={{ width: '100%', maxWidth: 360, marginTop: 12 }}>
          {allItems.map((item, i) => {
            const done = i < currentItem || (i === currentItem && pct >= 100);
            const active = i === currentItem && pct < 100;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '6px 0',
                opacity: done ? 1 : active ? 1 : 0.35,
                transition: 'opacity 0.4s, transform 0.3s',
                transform: active ? 'translateX(4px)' : 'none',
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, transition: 'all 0.3s',
                  background: done ? T.primary : active ? `${T.primary}20` : T.border,
                  color: done ? '#fff' : active ? T.primary : T.textMuted,
                  border: active ? `2px solid ${T.primary}` : '2px solid transparent',
                }}>
                  {done ? '✓' : active ? (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', border: `2px solid ${T.primary}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', display: 'block' }} />
                  ) : '○'}
                </span>
                <span style={{ fontSize: '0.88rem', color: done ? T.text : active ? T.text : T.textMuted, fontWeight: active ? 600 : 400 }}>{item}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ RISK CHART BLOCK (animated area chart) ═══
function RiskChartBlock({ title, labels, userPosition, duration, T, onDone }) {
  const [progress, setProgress] = useState(0);
  const allLabels = labels || ['Baixo', 'Aceitável', 'Normal', 'Médio', 'Alto'];
  const userIdx = Math.min((userPosition || 3) - 1, allLabels.length - 1);
  const totalDuration = (duration || 3) * 1000;

  // Curve points (exponential-ish rise)
  const curveValues = [0.08, 0.18, 0.35, 0.62, 0.95];
  const W = 320, H = 180, padL = 10, padR = 10, padT = 30, padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / totalDuration);
      setProgress(p);
      if (p >= 1) { clearInterval(iv); setTimeout(onDone, 1200); }
    }, 30);
    return () => clearInterval(iv);
  }, [totalDuration]);

  // Build path with animation
  const points = curveValues.map((v, i) => ({
    x: padL + (i / (curveValues.length - 1)) * chartW,
    y: padT + chartH - (v * progress * chartH),
  }));

  const pathD = points.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cpx1 = prev.x + (p.x - prev.x) * 0.5;
    const cpx2 = prev.x + (p.x - prev.x) * 0.5;
    return `${d} C ${cpx1} ${prev.y} ${cpx2} ${p.y} ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padT + chartH} L ${points[0].x} ${padT + chartH} Z`;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: T.text, marginBottom: 16, textAlign: 'center' }}>{title || 'Seu nível de risco'}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 380 }}>
        <defs>
          <linearGradient id="riskGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="30%" stopColor="#eab308" />
            <stop offset="60%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="riskGradFill" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
            <stop offset="30%" stopColor="#eab308" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#f97316" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {allLabels.map((_, i) => {
          const x = padL + (i / (allLabels.length - 1)) * chartW;
          return <line key={i} x1={x} y1={padT} x2={x} y2={padT + chartH} stroke={T.border || '#334155'} strokeWidth="0.5" strokeDasharray="3,3" />;
        })}
        <line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH} stroke={T.border || '#475569'} strokeWidth="1" />
        {/* Animated area */}
        <path d={areaD} fill="url(#riskGradFill)" />
        {/* Animated line */}
        <path d={pathD} fill="none" stroke="url(#riskGrad)" strokeWidth="3" strokeLinecap="round" />
        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === userIdx ? 6 : 4}
            fill={i === userIdx ? '#fff' : 'url(#riskGrad)'} stroke={i === userIdx ? T.primary : 'none'} strokeWidth={i === userIdx ? 2 : 0}
            style={{ opacity: progress > 0.1 ? 1 : 0, transition: 'opacity 0.3s' }}
          />
        ))}
        {/* User label */}
        {progress > 0.5 && (
          <g style={{ opacity: Math.min(1, (progress - 0.5) * 4) }}>
            <rect x={points[userIdx].x - 22} y={points[userIdx].y - 28} width="44" height="20" rx="10" fill={T.primary} />
            <text x={points[userIdx].x} y={points[userIdx].y - 15} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">Você</text>
          </g>
        )}
        {/* X-axis labels */}
        {allLabels.map((label, i) => (
          <text key={i} x={padL + (i / (allLabels.length - 1)) * chartW} y={H - 6} textAnchor="middle"
            fill={T.textMuted || '#94a3b8'} fontSize="9" fontWeight="500">{label}</text>
        ))}
      </svg>
    </div>
  );
}

// ═══ SCROLL PICKER BLOCK (drum roller) ═══
function ScrollPickerBlock({ page, T, onDone }) {
  const min = page.min || 140;
  const max = page.max || 210;
  const unit = page.unit || 'cm';
  const visualStyle = page.visualStyle || 'drum';
  const [value, setValue] = useState(page.defaultValue || Math.round((min + max) / 2));
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const lastY = useRef(0);
  const lastX = useRef(0);

  const items = [];
  for (let i = min; i <= max; i += (page.step || 1)) items.push(i);

  // Drum: vertical scroll
  const handleWheel = (e) => {
    e.preventDefault();
    setValue(v => Math.max(min, Math.min(max, v + (e.deltaY > 0 ? 1 : -1))));
  };

  const handlePointerDown = (e) => { isDragging.current = true; lastY.current = e.clientY; lastX.current = e.clientX; };
  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    if (visualStyle === 'ruler') {
      const dx = lastX.current - e.clientX;
      if (Math.abs(dx) > 8) {
        setValue(v => Math.max(min, Math.min(max, v + (dx > 0 ? 1 : -1))));
        lastX.current = e.clientX;
      }
    } else {
      const dy = lastY.current - e.clientY;
      if (Math.abs(dy) > 12) {
        setValue(v => Math.max(min, Math.min(max, v + (dy > 0 ? 1 : -1))));
        lastY.current = e.clientY;
      }
    }
  };
  const handlePointerUp = () => { isDragging.current = false; };

  useEffect(() => {
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => { document.removeEventListener('pointermove', handlePointerMove); document.removeEventListener('pointerup', handlePointerUp); };
  }, []);

  const continueBtn = (
    <button style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: T.primary, color: T.onPrimary || '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginTop: 'auto', marginBottom: 24, boxShadow: `0 4px 16px rgba(${T.rgb},.25)` }}
      onClick={() => onDone(value)}>
      Continuar
    </button>
  );

  // ── RULER STYLE ──
  if (visualStyle === 'ruler') {
    const ticks = [];
    for (let i = value - 20; i <= value + 20; i++) { if (i >= min && i <= max) ticks.push(i); }
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.3rem', textAlign: 'center', marginBottom: 16, color: T.text }}>{page.text}</h2>
        <div style={{ fontSize: '2.8rem', fontWeight: 800, color: T.text, marginBottom: 4, letterSpacing: '-1px' }}>
          {value}<span style={{ fontSize: '1.2rem', fontWeight: 600, color: T.textMuted, marginLeft: 4 }}>{unit}</span>
        </div>
        <div ref={containerRef} onWheel={handleWheel} onPointerDown={handlePointerDown}
          style={{ position: 'relative', width: '100%', height: 100, overflow: 'hidden', touchAction: 'none', cursor: 'grab', userSelect: 'none', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: 60, gap: 0 }}>
            {ticks.map(t => {
              const isMajor = t % 10 === 0;
              const isMid = t % 5 === 0;
              const isCurrent = t === value;
              return (
                <div key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: isMajor ? 10 : 6, flexShrink: 0 }}>
                  <div style={{ width: isCurrent ? 3 : 1.5, height: isMajor ? 40 : isMid ? 28 : 16, background: isCurrent ? T.text : `rgba(${T.rgb},.2)`, borderRadius: 1, transition: 'height 0.1s' }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
            {ticks.filter(t => t % 10 === 0).map(t => (
              <div key={t} style={{ width: 60, textAlign: 'center', fontSize: 12, color: t === value ? T.text : T.textMuted, fontWeight: t === value ? 700 : 400 }}>{t}</div>
            ))}
          </div>
          {/* Center indicator */}
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: T.text }}>
            <div style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: `10px solid ${T.text}` }} />
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: T.textMuted, marginBottom: 24 }}>Arraste para ajustar</div>
        {continueBtn}
      </div>
    );
  }

  // ── SLIDER STYLE ──
  if (visualStyle === 'slider') {
    const pct = ((value - min) / (max - min)) * 100;
    const sliderRef = useRef(null);
    const handleSliderClick = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      setValue(Math.round(min + x * (max - min)));
    };
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.3rem', textAlign: 'center', marginBottom: 24, color: T.text }}>{page.text}</h2>
        <div style={{ fontSize: '2.8rem', fontWeight: 800, color: T.primary, marginBottom: 32 }}>
          {value} <span style={{ fontSize: '1rem', fontWeight: 600, color: T.textSec }}>{unit}</span>
        </div>
        <div ref={sliderRef} onClick={handleSliderClick}
          style={{ position: 'relative', width: '100%', maxWidth: 300, height: 10, background: `rgba(${T.rgb},.1)`, borderRadius: 5, cursor: 'pointer', margin: '0 auto' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: T.primary, borderRadius: 5, transition: 'width 0.15s' }} />
          <div style={{ position: 'absolute', top: '50%', left: `${pct}%`, transform: 'translate(-50%, -50%)', width: 28, height: 28, borderRadius: '50%', background: '#fff', border: `3px solid ${T.primary}`, boxShadow: `0 2px 10px rgba(${T.rgb},.3)`, transition: 'left 0.15s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 300, margin: '12px auto 0', fontSize: '0.85rem', color: T.textMuted }}>
          <span>{min} {unit}</span><span>{max} {unit}</span>
        </div>
        <div style={{ flex: 1 }} />
        {continueBtn}
      </div>
    );
  }

  // ── INPUT STYLE ──
  if (visualStyle === 'input') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.3rem', textAlign: 'center', marginBottom: 32, color: T.text }}>{page.text}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
          <button onClick={() => setValue(v => Math.max(min, v - 1))}
            style={{ width: 56, height: 56, borderRadius: 16, background: `rgba(${T.rgb},.06)`, border: `2px solid rgba(${T.rgb},.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: T.textMuted, cursor: 'pointer' }}>−</button>
          <div style={{ textAlign: 'center', minWidth: 120 }}>
            <div style={{ fontSize: '3.2rem', fontWeight: 800, color: T.text, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: T.textMuted, marginTop: 4 }}>{unit}</div>
          </div>
          <button onClick={() => setValue(v => Math.min(max, v + 1))}
            style={{ width: 56, height: 56, borderRadius: 16, background: T.primary, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: T.onPrimary || '#fff', cursor: 'pointer', boxShadow: `0 4px 12px rgba(${T.rgb},.25)` }}>+</button>
        </div>
        <div style={{ flex: 1 }} />
        {continueBtn}
      </div>
    );
  }

  // ── DRUM STYLE (default) ──
  const visible = [];
  for (let i = value - 4; i <= value + 4; i++) {
    if (i >= min && i <= max) visible.push(i);
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2 style={{ fontWeight: 700, fontSize: '1.3rem', textAlign: 'center', marginBottom: 24, color: T.text }}>{page.text}</h2>

      <div ref={containerRef} onWheel={handleWheel} onPointerDown={handlePointerDown}
        style={{ position: 'relative', width: '100%', maxWidth: 200, height: 260, overflow: 'hidden', borderRadius: 20, background: `linear-gradient(to bottom, ${T.card}, rgba(${T.rgb},.03), ${T.card})`, touchAction: 'none', cursor: 'grab', userSelect: 'none' }}>
        {/* Highlight band */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 44, background: `rgba(${T.rgb},.08)`, borderTop: `2px solid ${T.primary}`, borderBottom: `2px solid ${T.primary}`, zIndex: 1, pointerEvents: 'none' }} />
        {/* Numbers */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 0 }}>
          {visible.map(v => {
            const dist = Math.abs(v - value);
            return (
              <div key={v} onClick={() => setValue(v)} style={{
                height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: dist === 0 ? '1.5rem' : dist === 1 ? '1.1rem' : '0.9rem',
                fontWeight: dist === 0 ? 800 : dist === 1 ? 600 : 400,
                color: dist === 0 ? T.primary : dist <= 1 ? T.text : T.textMuted,
                opacity: dist > 3 ? 0.2 : dist > 2 ? 0.4 : 1,
                transition: 'all 0.15s', cursor: 'pointer',
              }}>
                {v}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: '1.4rem', fontWeight: 800, color: T.primary }}>
        {value} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: T.textSec }}>{unit}</span>
      </div>

      {continueBtn}
    </div>
  );
}

// ═══ NUMBER INPUT BLOCK ═══
function NumberInputBlock({ page, T, onDone }) {
  const [value, setValue] = useState('');
  const unit = page.unit || 'kg';
  const valid = value && Number(value) >= (page.min || 0) && Number(value) <= (page.max || 999);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2 style={{ fontWeight: 700, fontSize: '1.3rem', textAlign: 'center', marginBottom: 20, color: T.text }}>{page.text}</h2>

      {page.imageUrl ? (
        <img src={page.imageUrl} alt="" style={{ width: 100, height: 100, objectFit: 'contain', marginBottom: 16 }} />
      ) : (
        <div style={{ fontSize: 64, marginBottom: 16, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.08))' }}>⚖️</div>
      )}

      <div style={{ position: 'relative', width: '100%', maxWidth: 220, marginBottom: 24 }}>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={page.placeholder || 'Ex: 72'}
          style={{
            width: '100%', padding: '18px 55px 18px 20px', borderRadius: 18,
            border: `2.5px solid ${value ? T.primary : T.border}`,
            fontSize: '1.5rem', fontWeight: 700, textAlign: 'center',
            outline: 'none', color: T.text, background: T.card,
            boxShadow: value ? `0 4px 16px rgba(${T.rgb},.12)` : 'none',
            transition: 'all 0.2s',
          }}
          autoFocus
        />
        <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', fontWeight: 700, color: T.primary, background: `rgba(${T.rgb},.08)`, padding: '4px 10px', borderRadius: 8 }}>{unit}</span>
      </div>

      <button
        disabled={!valid}
        onClick={() => { if (valid) onDone(Number(value)); }}
        style={{
          width: '100%', padding: '16px 0', borderRadius: 16, border: 'none',
          background: valid ? T.primary : `rgba(${T.rgb},.35)`,
          color: T.onPrimary || '#fff', fontWeight: 700, fontSize: '1rem',
          cursor: valid ? 'pointer' : 'default', marginTop: 'auto', marginBottom: 24,
          boxShadow: valid ? `0 4px 16px rgba(${T.rgb},.25)` : 'none',
          transition: 'all .25s',
        }}>
        Continuar
      </button>
    </div>
  );
}

// ═══ BMI BLOCK ═══
function BMIBlock({ page, pages, answers, T, onDone }) {
  const [phase, setPhase] = useState('calculating');
  const [bmi, setBmi] = useState(null);
  const [heightVal, setHeightVal] = useState(170);
  const [weightVal, setWeightVal] = useState(70);

  useEffect(() => {
    let height = null, weight = null;
    pages.forEach((p, i) => {
      if (answers[i] === undefined) return;
      const checkBlock = (b) => {
        const bType = b.type || '';
        const bText = (b.text || b.title || '').toLowerCase();
        const bUnit = (b.unit || '').toLowerCase();
        // Height detection
        if ((bType === 'scroll-picker' || bType === 'number-input') && (bUnit === 'cm' || bText.includes('altura') || bText.includes('height'))) height = answers[i];
        // Weight detection
        if ((bType === 'weight-picker' || bType === 'number-input') && (bUnit === 'kg' || bText.includes('peso') || bText.includes('weight'))) weight = answers[i];
      };
      // Check page-level type (for single-block pages)
      if (p.type === 'scroll-picker' || p.type === 'number-input' || p.type === 'weight-picker') checkBlock(p);
      if (p.blocks) p.blocks.forEach(checkBlock);
    });

    // Also check from picker stored data
    if (!height && typeof window !== 'undefined') {
      const storedH = sessionStorage.getItem('quiz_picker_height');
      if (storedH) height = parseFloat(storedH);
    }
    if (!weight && typeof window !== 'undefined') {
      const storedW = sessionStorage.getItem('quiz_picker_weight');
      if (storedW) weight = parseFloat(storedW);
    }

    if (!height) height = 170;
    if (!weight) weight = 70;
    setHeightVal(height);
    setWeightVal(weight);

    const calculated = weight / ((height / 100) ** 2);
    setBmi(Math.round(calculated * 10) / 10);
    setTimeout(() => setPhase('result'), 2200);
  }, []);

  if (phase === 'calculating') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes pulseRing { 0% { transform:scale(0.8); opacity:1; } 100% { transform:scale(1.4); opacity:0; } }`}</style>
        <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 24 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${T.primary}30`, animation: 'pulseRing 1.5s ease infinite' }} />
          <div style={{ width: 80, height: 80, borderRadius: '50%', border: `4px solid ${T.border}`, borderTopColor: T.primary, animation: 'spin 1s linear infinite' }} />
        </div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: T.text, marginBottom: 8 }}>Calculando seu IMC...</h3>
        <p style={{ color: T.textSec, fontSize: '0.85rem' }}>Analisando altura e peso</p>
      </div>
    );
  }

  const zones = [
    { label: 'Abaixo do peso', range: '< 18.5', min: 0, max: 18.5, color: '#3b82f6', emoji: '🔵' },
    { label: 'Peso normal', range: '18.5 – 24.9', min: 18.5, max: 25, color: '#22c55e', emoji: '🟢' },
    { label: 'Sobrepeso', range: '25.0 – 29.9', min: 25, max: 30, color: '#f59e0b', emoji: '🟡' },
    { label: 'Obesidade', range: '≥ 30', min: 30, max: 45, color: '#ef4444', emoji: '🔴' },
  ];
  const currentZone = zones.find(z => bmi >= z.min && bmi < z.max) || zones[zones.length - 1];
  const pct = Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100));

  const zoneTexts = {
    'Abaixo do peso': 'Seu IMC indica que você está abaixo do peso ideal. Isso pode afetar sua energia, imunidade e bem-estar geral. Uma alimentação adequada pode ajudar.',
    'Peso normal': 'Parabéns! Você está dentro do peso ideal. Manter um peso saudável reduz o risco de problemas cardíacos e melhora a qualidade de vida.',
    'Sobrepeso': 'Seu IMC indica sobrepeso, o que pode aumentar o risco de problemas de saúde. Pequenas mudanças nos hábitos podem fazer grande diferença.',
    'Obesidade': 'Seu IMC indica obesidade, condição que requer atenção especial. É importante buscar orientação para melhorar sua qualidade de vida.',
  };

  // Body type analysis based on BMI
  const getBodyType = () => {
    if (bmi < 18.5) return { type: 'Ectomorfo', desc: 'Corpo magro, dificuldade em ganhar peso e massa muscular' };
    if (bmi < 22) return { type: 'Ectomorfo com Mesomorfo', desc: 'Corpo magro com tendência atlética, perde peso facilmente' };
    if (bmi < 25) return { type: 'Mesomorfo', desc: 'Corpo atlético, facilidade para ganhar massa muscular' };
    if (bmi < 28) return { type: 'Mesomorfo com Endomorfo', desc: 'Corpo robusto, ganha massa mas retém gordura' };
    return { type: 'Endomorfo', desc: 'Corpo largo, tendência a acumular gordura facilmente' };
  };

  const getMetabolism = () => {
    if (bmi < 20) return { label: 'Metabolismo Acelerado', desc: 'Queima calorias rapidamente e pode ter dificuldade em ganhar peso' };
    if (bmi < 25) return { label: 'Metabolismo Normal', desc: 'Queima calorias de forma equilibrada, mantém peso com facilidade' };
    if (bmi < 30) return { label: 'Metabolismo Moderado', desc: 'Perde peso facilmente com exercícios, mas pode ganhar peso rápido' };
    return { label: 'Metabolismo Lento', desc: 'Queima menos calorias em repouso e precisa de mais atividade física' };
  };

  const bodyType = getBodyType();
  const metabolism = getMetabolism();
  const idealWeight = Math.round(((22 * (heightVal / 100) ** 2)) * 100) / 100;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes bmiSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bmiPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes bmiPointer { from { left: 0%; } }
      `}</style>

      {/* BMI Value */}
      <div style={{ textAlign: 'center', marginBottom: 16, animation: 'bmiSlideUp 0.6s ease both' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: T.text, margin: '0 0 8px' }}>{page.title || 'Seu IMC'}</h2>
        <div style={{ fontSize: '3rem', fontWeight: 800, color: currentZone.color, lineHeight: 1, animation: 'bmiPulse 2s ease infinite' }}>{bmi}</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 16px', borderRadius: 20, background: `${currentZone.color}15`, border: `1px solid ${currentZone.color}30` }}>
          <span>{currentZone.emoji}</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: currentZone.color }}>{currentZone.label}</span>
        </div>
      </div>

      {/* Gradient Gauge */}
      <div style={{ marginBottom: 20, animation: 'bmiSlideUp 0.6s ease 0.2s both' }}>
        <div style={{ height: 14, borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(90deg, #3b82f6 0%, #22c55e 30%, #f59e0b 60%, #ef4444 100%)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.08)' }} />
        <div style={{ position: 'relative', height: 20, marginTop: -3 }}>
          <div style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', transition: 'left 1.2s ease', animation: 'bmiPointer 1.2s ease both' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', border: `3px solid ${currentZone.color}`, boxShadow: '0 2px 6px rgba(0,0,0,.2)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: '0.58rem', color: T.textSec }}>
          <span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span>
        </div>
      </div>

      {/* Classification Card */}
      <div style={{ background: `${currentZone.color}08`, borderRadius: 14, padding: '14px 16px', border: `1px solid ${currentZone.color}20`, marginBottom: 16, animation: 'bmiSlideUp 0.6s ease 0.3s both' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: currentZone.color, marginBottom: 4 }}>
          📋 Entre {currentZone.range} – {currentZone.label}
        </div>
        <p style={{ fontSize: '0.82rem', lineHeight: 1.6, color: T.textSec, margin: 0 }}>{zoneTexts[currentZone.label]}</p>
      </div>

      {/* Body Profile Section */}
      <div style={{ marginBottom: 16, animation: 'bmiSlideUp 0.6s ease 0.4s both' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: T.text, marginBottom: 14 }}>Informe do seu perfil:</h3>
        <div style={{ display: 'flex', gap: 16 }}>
          {/* Profile Info */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Body Type */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${T.primary}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🧬</div>
              <div>
                <div style={{ fontSize: '0.7rem', color: T.textSec, fontWeight: 500 }}>Tipo de corpo</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: T.text }}>{bodyType.type}</div>
              </div>
            </div>
            {/* Metabolism */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${T.primary}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🔥</div>
              <div>
                <div style={{ fontSize: '0.7rem', color: T.textSec, fontWeight: 500 }}>{metabolism.label}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{metabolism.desc}</div>
              </div>
            </div>
          </div>
          {/* Body silhouette */}
          <div style={{ width: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 70, opacity: 0.8 }}>
            🧍
          </div>
        </div>
      </div>

      {/* Personal Data Card */}
      <div style={{ background: T.card, borderRadius: 14, padding: '14px 16px', border: `1px solid ${T.border}`, marginBottom: 16, animation: 'bmiSlideUp 0.6s ease 0.5s both' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: T.text }}>Seu Peso:</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: T.primary }}>{weightVal} kg</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: T.text }}>Sua Altura:</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: T.primary }}>{heightVal} cm</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: T.text }}>Peso Ideal:</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#22c55e' }}>{idealWeight} kg</span>
          </div>
        </div>
      </div>

      <button style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: T.primary, color: T.onPrimary || '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: `0 4px 16px rgba(${T.rgb},.25)`, marginTop: 'auto' }}
        onClick={onDone}>Continuar</button>
    </div>
  );
}

// ═══ AI RESULT BLOCK (Conversion-focused) ═══
function AIResultBlock({ page, quiz, answers, pages, T }) {
  const [phase, setPhase] = useState('analyzing');
  const [diagnosis, setDiagnosis] = useState(null);
  const [urgencyMin, setUrgencyMin] = useState(14);
  const [urgencySec, setUrgencySec] = useState(59);

  useEffect(() => {
    generateDiagnosis();
    const timer = setInterval(() => {
      setUrgencySec(s => {
        if (s <= 0) { setUrgencyMin(m => Math.max(0, m - 1)); return 59; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const generateDiagnosis = async () => {
    const answeredQuestions = [];
    pages.forEach((p, i) => {
      if (answers[i] !== undefined) {
        const q = p.text || p.title || p.content || '';
        const opts = p.options || (p.blocks || []).flatMap(b => b.options || []);
        let answer = '';
        if (typeof answers[i] === 'number' && opts[answers[i]]) {
          const opt = opts[answers[i]];
          answer = typeof opt === 'string' ? opt : opt.text || '';
        } else if (Array.isArray(answers[i])) {
          answer = answers[i].map(idx => opts[idx]?.text || opts[idx] || '').join(', ');
        } else {
          answer = String(answers[i]);
        }
        if (q) answeredQuestions.push({ question: q, answer });
      }
    });

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey || answeredQuestions.length === 0) {
      setDiagnosis({
        headline: 'Identificamos um padrão importante nas suas respostas',
        body: 'Com base no que você respondeu, seu perfil indica oportunidades reais de melhoria. A boa notícia? Existe um método comprovado que já ajudou milhares de pessoas na mesma situação.',
      });
      setTimeout(() => setPhase('result'), 2500);
      return;
    }

    try {
      const prompt = `Você é um copywriter especialista em conversão. Analise as respostas do quiz e gere um diagnóstico CURTO e PERSUASIVO que faça a pessoa querer clicar no botão de compra.

RESPOSTAS DO QUIZ:
${answeredQuestions.map((q, i) => `${i + 1}. ${q.question}\n   → ${q.answer}`).join('\n')}

${page.productContext ? `CONTEXTO DO PRODUTO: ${page.productContext}` : ''}
${page.productName ? `PRODUTO OFERECIDO: ${page.productName}` : ''}

REGRAS:
1. Seja BREVE — máximo 3 frases no body
2. Primeira frase: diagnóstico direto baseado nas respostas
3. Segunda frase: consequência de não agir (urgência)
4. Terceira frase: ponte para a solução (sem revelar demais)
5. Tom empático mas urgente
6. NUNCA diga que está tudo bem

Retorne JSON:
{
  "headline": "Frase impactante de 1 linha (máx 10 palavras)",
  "body": "3 frases curtas e diretas. Diagnóstico + urgência + solução."
}

Retorne APENAS o JSON, sem markdown.`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          max_tokens: 400,
        }),
      });

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      const json = JSON.parse(content.replace(/```json?\n?|\n?```/g, '').trim());
      setDiagnosis(json);
    } catch (err) {
      console.error('AI diagnosis error:', err);
      setDiagnosis({
        headline: 'Seu perfil precisa de atenção agora',
        body: 'Suas respostas revelam padrões que, se não corrigidos, tendem a piorar. A boa notícia é que existe um caminho validado para reverter isso rapidamente.',
      });
    }
    setTimeout(() => setPhase('result'), 2800);
  };

  if (phase === 'analyzing') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid ${T.border}`, borderTopColor: T.primary, animation: 'spin 1s linear infinite', marginBottom: 20 }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: T.text, marginBottom: 8 }}>Analisando suas respostas...</h3>
        <p style={{ color: T.textSec, fontSize: '0.85rem' }}>Gerando seu diagnóstico personalizado</p>
      </div>
    );
  }

  if (!diagnosis) return null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 0' }}>
      {/* Result ready badge */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 30, background: `rgba(${T.rgb},.08)`, border: `1px solid rgba(${T.rgb},.15)`, marginBottom: 16 }}>
          <span style={{ fontSize: 16 }}>✅</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: T.primary }}>Diagnóstico Pronto</span>
        </div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: T.text, lineHeight: 1.3, maxWidth: 340, margin: '0 auto' }}>{diagnosis.headline}</h2>
      </div>

      {/* Short persuasive body */}
      <div style={{ background: T.card, borderRadius: 16, padding: '20px 18px', border: `1px solid ${T.border}`, marginBottom: 24 }}>
        <p style={{ fontSize: '0.92rem', lineHeight: 1.75, color: T.textSec, margin: 0 }}>{diagnosis.body}</p>
      </div>

      {/* CTA — Hero */}
      <button
        onClick={() => { if (page.salesUrl) window.open(page.salesUrl, '_blank'); }}
        style={{
          width: '100%', padding: '20px 24px', borderRadius: 16, border: 'none',
          background: `linear-gradient(135deg, ${T.primary}, ${T.secondary || T.primary})`,
          color: T.onPrimary || '#fff', fontWeight: 800, fontSize: '1.1rem',
          cursor: 'pointer', boxShadow: `0 8px 28px rgba(${T.rgb},.35)`,
          animation: 'pulse 2s infinite', letterSpacing: '.02em',
        }}>
        {page.cta || '🔥 QUERO MINHA SOLUÇÃO AGORA →'}
      </button>

      {/* Trust + Urgency */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: T.textMuted }}>
          <span>🔒</span>
          <span>Garantia incondicional de 7 dias</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: '#fef2f2', border: '1px solid #fecaca' }}>
          <span style={{ fontSize: 14 }}>⏰</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dc2626' }}>Oferta expira em {urgencyMin}:{String(urgencySec).padStart(2, '0')}</span>
        </div>
      </div>

      {/* Mini Social Proof */}
      <div style={{ marginTop: 20, textAlign: 'center', padding: '14px 16px', borderRadius: 14, background: `rgba(${T.rgb},.04)`, border: `1px solid rgba(${T.rgb},.08)` }}>
        <div style={{ fontSize: '0.82rem', color: '#f59e0b', marginBottom: 4 }}>⭐⭐⭐⭐⭐ <span style={{ color: T.text, fontWeight: 700 }}>4.9/5</span></div>
        <p style={{ fontSize: '0.8rem', color: T.textSec, margin: 0, fontStyle: 'italic' }}>"Mudou completamente minha rotina. Recomendo demais!"</p>
        <p style={{ fontSize: '0.7rem', color: T.textMuted, margin: '4px 0 0' }}>— Maria S., verificada</p>
      </div>
    </div>
  );
}

function Particles({ emoji, rgb, count = 10 }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="qp-particle" style={{
          position: 'absolute', fontSize: `${10 + Math.random() * 14}px`,
          left: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 4}s`,
          animationDuration: `${4 + Math.random() * 5}s`,
        }}>{emoji}</span>
      ))}
    </div>
  );
}

// ═══ ANIMATION STYLES ═══
const CSS = `
@keyframes qp-float{0%{transform:translateY(100vh) scale(.6) rotate(0);opacity:0}10%{opacity:.2}85%{opacity:.05}100%{transform:translateY(-60px) scale(1) rotate(200deg);opacity:0}}
@keyframes qp-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes qp-glow{0%,100%{box-shadow:0 4px 20px rgba(var(--qp-rgb),.25)}50%{box-shadow:0 8px 35px rgba(var(--qp-rgb),.45)}}
@keyframes qp-pop{0%{transform:scale(1)}40%{transform:scale(.96)}100%{transform:scale(1)}}
@keyframes qp-check{0%{transform:scale(0) rotate(-45deg)}60%{transform:scale(1.2) rotate(5deg)}100%{transform:scale(1) rotate(0)}}
@keyframes qp-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.qp-particle{animation:qp-float infinite linear}
.qp-result-emoji{animation:qp-pulse 2.5s ease-in-out infinite}
.qp-cta{animation:qp-glow 2s ease-in-out infinite}
.qp-option-pop{animation:qp-pop .25s ease}
.qp-check-anim{animation:qp-check .3s cubic-bezier(.34,1.56,.64,1)}
.qp-progress-fill{transition:width .5s cubic-bezier(.4,0,.2,1)}
.qp-shimmer{background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.4) 50%,transparent 100%);background-size:200% 100%;animation:qp-shimmer 1.5s infinite}
@keyframes pulse{0%,100%{transform:scale(1);box-shadow:0 6px 20px rgba(var(--qp-rgb),.3)}50%{transform:scale(1.02);box-shadow:0 8px 28px rgba(var(--qp-rgb),.45)}}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.cloned-page{max-width:100%!important;overflow-x:hidden!important;box-sizing:border-box!important}
.cloned-page *{max-width:100%!important;box-sizing:border-box!important}
.cloned-page img{height:auto!important;max-width:100%!important}
.cloned-page video,.cloned-page iframe{max-width:100%!important;height:auto!important}
@media(max-width:520px){.cloned-page{padding:0!important;margin:0!important;width:100%!important;font-size:inherit!important}}
`;

const pageAnim = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.35, ease: 'easeOut' } };

// ═══ CLONED PAGE BLOCK — iframe-based for full JS execution ═══
function ClonedPageBlock({ html, fullCode, onAdvance, btnStyle, buttonActions, pixelCode, clonePageType, quizId, pageIndex, setAnswers }) {
  const iframeRef = useRef(null);
  const htmlRef = useRef(null);
  const isMultiSelect = clonePageType === 'multi-select';
  const [hasSelection, setHasSelection] = useState(false);

  // Listen for postMessage from iframe to advance
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'clone-advance') {
        // Record answer from cloned page
        if (e.data.answer) {
          recordEvent(quizId || '', 'answer', { questionIndex: pageIndex, value: e.data.answer, source: 'clone' });
          if (setAnswers) setAnswers(prev => ({ ...prev, [pageIndex]: e.data.answer }));
        } else {
          recordEvent(quizId || '', 'answer', { questionIndex: pageIndex, value: 'advanced', source: 'clone' });
        }
        onAdvance();
      }
      if (e.data?.type === 'clone-selection') {
        setHasSelection(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onAdvance]);

  // If we have fullCode, render in iframe for full JS execution
  if (fullCode) {
    // Inject a navigation bridge that uses postMessage to communicate with parent
    const playerBridge = `<script data-player-bridge>
(function() {
  var advanced = false;
  var pageType = ${JSON.stringify(clonePageType || 'choice')};
  var isMultiSelect = pageType === 'multi-select';
  var btnActions = ${JSON.stringify(buttonActions || {})};
  var submitRe = /continuar|continue|next|enviar|submit|avan|come|pr.ximo|siguiente|seguir|empezar|iniciar|start/i;
  
  function doAdvance(answerText) {
    if (advanced) return;
    advanced = true;
    window.parent.postMessage({ type: 'clone-advance', answer: answerText || '' }, '*');
    setTimeout(function() { advanced = false; }, 2000);
  }
  
  function isSubmitButton(el) {
    var tag = el.tagName ? el.tagName.toLowerCase() : '';
    var cls = (el.className || '').toString().toLowerCase();
    var text = (el.textContent || '').trim();
    var role = (el.getAttribute && el.getAttribute('role') || '').toLowerCase();
    // Must have submit-like text AND be a button/CTA-like element
    if (submitRe.test(text) && text.length < 80) {
      if (tag === 'button' || tag === 'a') return true;
      if (cls.includes('btn') || cls.includes('cta') || cls.includes('submit') || cls.includes('action') || cls.includes('next')) return true;
      if (role === 'button') return true;
    }
    // Explicit CTA/submit classes with very short text (button feel)
    if ((cls.includes('cta') || cls.includes('submit')) && text.length < 60 && text.length > 1) return true;
    return false;
  }
  
  function isOptionElement(el) {
    var tag = el.tagName ? el.tagName.toLowerCase() : '';
    var cls = (el.className || '').toString().toLowerCase();
    var text = (el.textContent || '').trim();
    var role = (el.getAttribute && el.getAttribute('role') || '').toLowerCase();
    if (text.length < 2 || text.length > 300) return false;
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return false;
    // Direct tag check
    if (tag === 'button') return true;
    // Role check
    if (role === 'button' || role === 'option' || role === 'radio' || role === 'listitem') return true;
    // Class pattern check (very broad)
    if (cls.includes('option') || cls.includes('choice') || cls.includes('card') || cls.includes('answer') || 
        cls.includes('cursor-pointer') || cls.includes('quiz') || cls.includes('opt') || cls.includes('select') ||
        cls.includes('radio') || cls.includes('check') || cls.includes('item') || cls.includes('variant') ||
        cls.includes('clickable') || cls.includes('hover') || cls.includes('btn') || cls.includes('cta')) return true;
    // data-* attribute check
    if (el.getAttribute) {
      var attrs = el.attributes || [];
      for (var i = 0; i < attrs.length; i++) {
        var name = attrs[i].name.toLowerCase();
        if (name.startsWith('data-') && (name.includes('option') || name.includes('answer') || name.includes('choice') || name.includes('value') || name.includes('click') || name.includes('action'))) return true;
      }
    }
    // Style check: if element has cursor:pointer, it's interactive
    try {
      var cStyle = window.getComputedStyle(el);
      if (cStyle && cStyle.cursor === 'pointer') return true;
    } catch(e) {}
    // Parent group check
    var parent = el.parentElement;
    if (parent) {
      var pCls = (parent.className || '').toString().toLowerCase();
      var pTag = parent.tagName ? parent.tagName.toLowerCase() : '';
      if ((pCls.includes('group') || pCls.includes('list') || pCls.includes('options') || pCls.includes('grid') || pCls.includes('stack') || pTag === 'ul' || pTag === 'ol') && (tag === 'div' || tag === 'li' || tag === 'label')) return true;
    }
    return false;
  }
  
  function findOptionAncestor(el) {
    var node = el;
    var depth = 0;
    while (node && node !== document.body && depth < 10) {
      if (isOptionElement(node)) return node;
      node = node.parentElement;
      depth++;
    }
    return null;
  }
  
  // Also find any clickable ancestor (a, button, or cursor:pointer)
  function findClickableAncestor(el) {
    var node = el;
    var depth = 0;
    while (node && node !== document.body && depth < 8) {
      var tag = node.tagName ? node.tagName.toLowerCase() : '';
      if (tag === 'a' || tag === 'button') return node;
      try {
        var st = window.getComputedStyle(node);
        if (st && st.cursor === 'pointer' && node.offsetHeight > 20) return node;
      } catch(e) {}
      node = node.parentElement;
      depth++;
    }
    return null;
  }
  
  function toggleMultiSelect(card) {
    var sel = card.classList.contains('active');
    if (sel) {
      card.classList.remove('active');
      card.style.borderColor = '';
      card.style.boxShadow = '';
    } else {
      card.classList.add('active');
      card.style.borderColor = '#333';
      card.style.boxShadow = '0 0 0 1px #333';
    }
    card.querySelectorAll('svg').forEach(function(svg) {
      svg.style.opacity = sel ? '0' : '1';
    });
    var grp = card.closest('[class*="group"]');
    if (grp && grp !== card) {
      if (sel) grp.classList.remove('active');
      else grp.classList.add('active');
    }
    var cb = card.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = !sel;
    window.parent.postMessage({ type: 'clone-selection' }, '*');
  }
  
  // Stamp data-cta-url attributes on buttons that have CTA actions
  function resolvePath(root, path) {
    if (!path || !root) return null;
    var parts = path.split('/');
    var cur = root;
    for (var i = 0; i < parts.length; i++) {
      var m = parts[i].match(/^(\w+)\[(\d+)\]$/);
      if (!m) return null;
      var tag = m[1], idx = parseInt(m[2]);
      var children = [];
      for (var j = 0; j < cur.children.length; j++) {
        if (cur.children[j].tagName && cur.children[j].tagName.toLowerCase() === tag) children.push(cur.children[j]);
      }
      cur = children[idx];
      if (!cur) return null;
    }
    return cur;
  }
  
  // Collect all CTA URLs from btnActions
  var ctaUrls = [];
  for (var k in btnActions) {
    if (btnActions[k] && btnActions[k].action === 'cta' && btnActions[k].ctaUrl) {
      ctaUrls.push({ path: k, url: btnActions[k].ctaUrl });
    }
  }
  
  function stampCTAUrls() {
    if (ctaUrls.length === 0) return;
    ctaUrls.forEach(function(entry) {
      // Try multiple roots: body first, then .cloned-page
      var el = resolvePath(document.body, entry.path);
      if (!el) el = resolvePath(document.querySelector('.cloned-page'), entry.path);
      if (el) {
        el.setAttribute('data-cta-url', entry.url);
      } else {
        // Fallback: stamp ALL submit-like buttons with the CTA URL
        var allBtns = document.querySelectorAll('button, a, [role="button"]');
        for (var i = 0; i < allBtns.length; i++) {
          if (isSubmitButton(allBtns[i]) && !allBtns[i].getAttribute('data-cta-url')) {
            allBtns[i].setAttribute('data-cta-url', entry.url);
          }
        }
      }
    });
    // Also check for any elements already having data-cta-url from editor
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stampCTAUrls);
  else stampCTAUrls();
  
  document.addEventListener('click', function(e) {
    var target = e.target;
    var node = target;
    // Pre-check: walk up to find any ancestor with data-cta-url (always takes priority)
    var ctaNode = target;
    while (ctaNode && ctaNode !== document.body) {
      var cta = ctaNode.getAttribute && ctaNode.getAttribute('data-cta-url');
      if (cta) {
        e.preventDefault();
        e.stopPropagation();
        ctaNode.style.transform = 'scale(0.97)';
        ctaNode.style.opacity = '0.7';
        setTimeout(function() { window.top.location.href = cta; }, 200);
        return;
      }
      ctaNode = ctaNode.parentElement;
    }
    // Fallback CTA check: if we have CTA URLs and clicked a submit-like button, redirect
    if (ctaUrls.length > 0) {
      var btnNode = target;
      while (btnNode && btnNode !== document.body) {
        if (isSubmitButton(btnNode)) {
          e.preventDefault();
          e.stopPropagation();
          btnNode.style.transform = 'scale(0.97)';
          btnNode.style.opacity = '0.7';
          var url = ctaUrls[0].url;
          setTimeout(function() { window.top.location.href = url; }, 200);
          return;
        }
        btnNode = btnNode.parentElement;
      }
    }
    // First pass: check for submit buttons
    while (node && node !== document.body) {
      var tag = node.tagName ? node.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (isSubmitButton(node)) {
        e.preventDefault();
        e.stopPropagation();
        // Check if this button has a CTA url action
        var ctaUrl = node.getAttribute('data-cta-url');
        if (ctaUrl) {
          node.style.transform = 'scale(0.97)';
          node.style.opacity = '0.7';
          setTimeout(function() { window.top.location.href = ctaUrl; }, 200);
          return;
        }
        node.style.transform = 'scale(0.97)';
        node.style.opacity = '0.7';
        setTimeout(function() { doAdvance((node.textContent || '').trim().substring(0, 200)); }, 300);
        return;
      }
      node = node.parentElement;
    }
    // Second pass: check for option cards (always, regardless of pageType)
    var card = findOptionAncestor(target);
    if (card && !isSubmitButton(card)) {
      if (isMultiSelect) {
        e.preventDefault();
        e.stopPropagation();
        toggleMultiSelect(card);
      } else {
        e.preventDefault();
        e.stopPropagation();
        card.style.transform = 'scale(0.97)';
        card.style.opacity = '0.7';
        setTimeout(function() { doAdvance((card.textContent || '').trim().substring(0, 200)); }, 400);
      }
      return;
    }
    // Third pass: fallback — find any clickable ancestor (a, button, cursor:pointer)
    // Skip this fallback for multi-select pages (user needs to toggle, not advance)
    if (!isMultiSelect) {
      var clickable = findClickableAncestor(target);
      if (clickable) {
        var cTag = clickable.tagName ? clickable.tagName.toLowerCase() : '';
        var cText = (clickable.textContent || '').trim();
        // Don't advance for external links or navigation links
        if (cTag === 'a') {
          var href = (clickable.getAttribute('href') || '');
          if (href && href !== '#' && !href.startsWith('javascript') && href.startsWith('http')) return; // let real external links work
        }
        if (cText.length > 1 && cText.length < 200) {
          e.preventDefault();
          e.stopPropagation();
          // Check for CTA url on clickable element
          var ctaUrl2 = clickable.getAttribute('data-cta-url');
          if (ctaUrl2) {
            clickable.style.transform = 'scale(0.97)';
            clickable.style.opacity = '0.7';
            setTimeout(function() { window.top.location.href = ctaUrl2; }, 200);
            return;
          }
          clickable.style.transform = 'scale(0.97)';
          clickable.style.opacity = '0.7';
          setTimeout(function() { doAdvance((clickable.textContent || '').trim().substring(0, 200)); }, 400);
          return;
        }
      }
    }
  }, true);
  
  document.addEventListener('submit', function(e) { e.preventDefault(); doAdvance(); }, true);
  var origPush = history.pushState;
  var origReplace = history.replaceState;
  history.pushState = function() { origPush.apply(this, arguments); doAdvance(); };
  history.replaceState = function() { origReplace.apply(this, arguments); doAdvance(); };
  window.addEventListener('popstate', function() { doAdvance(); });
})();
</script>`;
    
    // Remove old nav bridge and inject new player bridge
    let iframeDoc = fullCode;
    
    // ═══ SANITIZE BROKEN STYLE ATTRIBUTES ═══
    // Cloned pages often have broken HTML where double quotes inside style values
    // (e.g. font-family:"Inter", sans-serif) break attribute parsing.
    // Fix: replace style="..." content to escape inner quotes properly.
    iframeDoc = iframeDoc.replace(/style\s*=\s*"([^"]*)"/gi, function(match, inner) {
      // If the inner content looks truncated or broken (very short for a style), skip
      if (inner.length < 2) return match;
      return 'style="' + inner + '"';
    });
    // More aggressive fix: find broken patterns like style="font-family:X, " attr="" 
    // and reconstruct them by merging orphaned attributes back into the style
    iframeDoc = iframeDoc.replace(/style="([^"]*)"(\s+(?:sans|serif|monospace|cursive|fantasy|system-ui|Arial|Helvetica|Inter|Roboto|Poppins|Montserrat|Open|Lato|Nunito|Outfit|Raleway|Oswald|Playfair)[^"]*="[^"]*")+/gi, function(match, styleContent) {
      // Extract the orphaned font parts and reconstruct
      const orphanedParts = match.slice(match.indexOf('"', 7) + 1);
      // Clean up: remove fake attribute patterns
      const cleanedParts = orphanedParts.replace(/\s*\w+="[^"]*"/g, '').replace(/[="]/g, '').trim();
      const fixedStyle = styleContent + (cleanedParts ? ', ' + cleanedParts : '');
      return 'style="' + fixedStyle + '"';
    });
    // Nuclear fix: convert all style attributes to use single quotes for font-family values
    iframeDoc = iframeDoc.replace(/style="([^"]*)"/gi, function(match, content) {
      // Replace font-family double quotes with single quotes inside style values
      const fixed = content.replace(/font-family\s*:\s*([^;]*)/gi, function(fMatch, fValue) {
        return 'font-family:' + fValue.replace(/"/g, "'");
      });
      return 'style="' + fixed + '"';
    });
    // Fix any remaining broken attributes caused by style quote escaping
    // Pattern: orphaned attributes like sans="" serif","="" that aren't real attributes
    iframeDoc = iframeDoc.replace(/\s+(sans|serif|monospace|cursive|fantasy)(?:-serif)?="[^"]*"/gi, '');
    // Strip ALL external scripts (prevents Next.js hydration crash)
    iframeDoc = iframeDoc.replace(/<script[^>]+src=["'][^"']*["'][^>]*><\/script>/gi, '');
    iframeDoc = iframeDoc.replace(/<script[^>]+src=["'][^"']*["'][^>]*>\s*<\/script>/gi, '');
    // Remove inline scripts (except our bridge which we'll add)
    iframeDoc = iframeDoc.replace(/<script(?![^>]*(?:data-player-bridge|data-widget-fix|data-pb-anim|data-rc-anim))[^>]*>[\s\S]*?<\/script>/gi, '');
    // Remove Next.js __NEXT_DATA__ script
    iframeDoc = iframeDoc.replace(/<script id="__NEXT_DATA__"[^>]*>[\s\S]*?<\/script>/gi, '');
    
    // Inject widget interactivity script (ruler/slider, toggles, etc.)
    const widgetScript = `<script data-widget-fix>
(function() {
  // ═══ RULER / SLIDER DRAG ═══
  // Find ruler/scale containers (the ones with tick marks and numbers)
  function initRulers() {
    // Look for scroll containers with ruler-like content
    var containers = document.querySelectorAll('[class*="scroll"], [class*="slider"], [class*="ruler"], [class*="picker"], [class*="range"]');
    if (containers.length === 0) {
      // Fallback: find containers with multiple small tick-mark children
      document.querySelectorAll('div').forEach(function(div) {
        var children = div.children;
        if (children.length > 10) {
          var tickCount = 0;
          for (var i = 0; i < Math.min(children.length, 30); i++) {
            var ch = children[i];
            var w = ch.offsetWidth;
            var h = ch.offsetHeight;
            if ((w < 5 && h > 10) || (h < 5 && w > 10)) tickCount++;
          }
          if (tickCount > 5) containers = [div];
        }
      });
    }
    
    containers.forEach(function(container) {
      var dragging = false, startX = 0, scrollStart = 0;
      
      container.style.overflow = 'auto';
      container.style.cursor = 'grab';
      container.style.userSelect = 'none';
      container.style.webkitUserSelect = 'none';
      container.style.scrollbarWidth = 'none';
      
      function onStart(x) {
        dragging = true;
        startX = x;
        scrollStart = container.scrollLeft;
        container.style.cursor = 'grabbing';
      }
      function onMove(x) {
        if (!dragging) return;
        var delta = startX - x;
        container.scrollLeft = scrollStart + delta;
        updateValueDisplay(container);
      }
      function onEnd() {
        dragging = false;
        container.style.cursor = 'grab';
        updateValueDisplay(container);
      }
      
      container.addEventListener('mousedown', function(e) { onStart(e.clientX); e.preventDefault(); });
      document.addEventListener('mousemove', function(e) { onMove(e.clientX); });
      document.addEventListener('mouseup', onEnd);
      container.addEventListener('touchstart', function(e) { onStart(e.touches[0].clientX); }, {passive: true});
      document.addEventListener('touchmove', function(e) { onMove(e.touches[0].clientX); }, {passive: true});
      document.addEventListener('touchend', onEnd);
    });
  }
  
  // Update the large number display based on scroll position
  function updateValueDisplay(container) {
    // Find number elements nearby
    var parent = container.parentElement;
    if (!parent) return;
    
    // Get visible number labels in the ruler
    var numbers = [];
    container.querySelectorAll('div, span').forEach(function(el) {
      var num = parseInt(el.textContent);
      if (!isNaN(num) && num > 10 && num < 500 && el.children.length === 0) {
        numbers.push({ el: el, value: num, left: el.offsetLeft });
      }
    });
    
    if (numbers.length < 2) return;
    numbers.sort(function(a,b) { return a.left - b.left; });
    
    // Find which number is closest to center
    var centerX = container.scrollLeft + container.clientWidth / 2;
    var closest = numbers[0];
    var minDist = Infinity;
    numbers.forEach(function(n) {
      var dist = Math.abs(n.left - centerX);
      if (dist < minDist) { minDist = dist; closest = n; }
    });
    
    // Update the big number display
    var bigNumbers = parent.parentElement ? parent.parentElement.querySelectorAll('div, span, h2, h3') : [];
    bigNumbers.forEach(function(el) {
      var fontSize = parseFloat(getComputedStyle(el).fontSize || 0);
      if (fontSize > 28 && el.children.length <= 2) {
        var numText = el.textContent.match(/\\d+/);
        if (numText && parseInt(numText[0]) > 10 && parseInt(numText[0]) < 500) {
          el.childNodes.forEach(function(node) {
            if (node.nodeType === 3 && /\\d+/.test(node.textContent)) {
              node.textContent = node.textContent.replace(/\\d+/, closest.value);
            }
          });
        }
      }
    });
  }
  
  // ═══ TOGGLE BUTTONS (cm/pol, kg/lb) ═══
  function initToggles() {
    var toggleGroups = document.querySelectorAll('[class*="toggle"], [class*="tab"], [class*="switch"]');
    if (toggleGroups.length === 0) {
      // Fallback: find adjacent buttons/spans that look like unit toggles
      document.querySelectorAll('button, [role="button"]').forEach(function(btn) {
        var text = btn.textContent.trim().toLowerCase();
        if (['cm', 'pol', 'kg', 'lb', 'in', 'ft'].includes(text)) {
          btn.style.cursor = 'pointer';
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Toggle active state
            var siblings = btn.parentElement ? btn.parentElement.children : [];
            for (var i = 0; i < siblings.length; i++) {
              siblings[i].style.fontWeight = '';
              siblings[i].style.opacity = '0.5';
            }
            btn.style.fontWeight = '700';
            btn.style.opacity = '1';
          });
        }
      });
    }
  }
  
  // ═══ QUIZ PICKERS (data-quiz-picker elements) ═══
  function initPickers() {
    var pickers = document.querySelectorAll('[data-quiz-picker]');
    pickers.forEach(function(el) {
      if (el.dataset.pickerInit) return;
      el.dataset.pickerInit = '1';
      var min = parseInt(el.getAttribute('data-min')) || 0;
      var max = parseInt(el.getAttribute('data-max')) || 300;
      var unit = el.getAttribute('data-unit') || '';
      var def = parseInt(el.getAttribute('data-default')) || Math.round((min+max)/2);
      var vs = el.getAttribute('data-visual-style') || 'drum';
      var pType = el.getAttribute('data-quiz-picker');
      var color = pType === 'weight' ? '#10b981' : '#6366f1';
      var value = def;
      var question = el.getAttribute('data-question') || '';

      function render() {
        el.setAttribute('data-picker-value', value);
        var html = question ? '<div style="font-size:14px;font-weight:700;color:#1a2332;margin-bottom:8px">' + question + '</div>' : '';
        if (vs === 'drum') {
          html += '<div style="position:relative;height:220px;overflow:hidden;border-radius:10px;background:linear-gradient(to bottom,rgba(0,0,0,0.08),transparent 25%,transparent 75%,rgba(0,0,0,0.08));touch-action:none;cursor:grab;user-select:none" data-drum="1">';
          html += '<div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:40px;background:' + color + '12;border-top:2px solid ' + color + ';border-bottom:2px solid ' + color + ';z-index:1;pointer-events:none"></div>';
          html += '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%">';
          for (var i = value - 4; i <= value + 4; i++) {
            if (i < min || i > max) { html += '<div style="height:24px"></div>'; continue; }
            var d = Math.abs(i - value);
            var fs = d === 0 ? 22 : d === 1 ? 16 : 14;
            var fw = d === 0 ? 800 : d === 1 ? 600 : 400;
            var c = d === 0 ? color : d <= 1 ? '#4b5563' : '#9ca3af';
            var op = d > 3 ? 0.2 : d > 2 ? 0.4 : 1;
            html += '<div style="height:24px;font-size:' + fs + 'px;font-weight:' + fw + ';color:' + c + ';opacity:' + op + ';transition:all 0.1s">' + i + '</div>';
          }
          html += '</div></div>';
          html += '<div style="margin-top:10px;font-size:18px;font-weight:800;color:' + color + '">' + value + ' ' + unit + '</div>';
        } else if (vs === 'ruler') {
          html += '<div style="font-size:36px;font-weight:800;color:#1a2332;margin-bottom:4px">' + value + '<span style="font-size:16px;font-weight:600;color:#9ca3af;margin-left:4px">' + unit + '</span></div>';
          html += '<div style="position:relative;height:70px;touch-action:none;cursor:grab;user-select:none" data-drum="1"><div style="display:flex;align-items:flex-end;justify-content:center;height:50px">';
          for (var j = value - 15; j <= value + 15; j++) {
            if (j < min || j > max) continue;
            var mj = j % 10 === 0, md = j % 5 === 0, cr = j === value;
            html += '<div style="display:flex;flex-direction:column;align-items:center;width:' + (mj ? 8 : 5) + 'px;flex-shrink:0"><div style="width:' + (cr ? 3 : 1.5) + 'px;height:' + (mj ? 36 : md ? 24 : 14) + 'px;background:' + (cr ? '#1a2332' : '#d1d5db') + ';border-radius:1px"></div></div>';
          }
          html += '</div><div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%)"><div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:8px solid #1a2332"></div></div></div>';
          html += '<div style="font-size:11px;color:#9ca3af;margin-top:6px">Arraste para ajustar</div>';
        } else if (vs === 'slider') {
          var pct = ((value - min) / (max - min)) * 100;
          html += '<div style="font-size:36px;font-weight:800;color:' + color + ';margin-bottom:20px">' + value + ' <span style="font-size:16px;font-weight:600;color:#9ca3af">' + unit + '</span></div>';
          html += '<div data-slider="1" style="position:relative;height:10px;background:#e5e7eb;border-radius:5px;margin:0 12px;cursor:pointer;touch-action:none">';
          html += '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:5px"></div>';
          html += '<div style="position:absolute;top:50%;left:' + pct + '%;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:#fff;border:3px solid ' + color + ';box-shadow:0 2px 10px rgba(0,0,0,0.15)"></div>';
          html += '</div>';
          html += '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:#9ca3af;padding:0 12px"><span>' + min + ' ' + unit + '</span><span>' + max + ' ' + unit + '</span></div>';
        } else if (vs === 'input') {
          html += '<div style="display:flex;align-items:center;justify-content:center;gap:20px;margin-top:8px">';
          html += '<div data-minus="1" style="width:52px;height:52px;border-radius:14px;background:#f1f5f9;border:2px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#9ca3af;cursor:pointer;user-select:none">−</div>';
          html += '<div style="text-align:center;min-width:100px"><div style="font-size:42px;font-weight:800;color:#1a2332;line-height:1">' + value + '</div><div style="font-size:14px;font-weight:600;color:#9ca3af;margin-top:4px">' + unit + '</div></div>';
          html += '<div data-plus="1" style="width:52px;height:52px;border-radius:14px;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;cursor:pointer;user-select:none;box-shadow:0 4px 12px rgba(0,0,0,0.15)">+</div>';
          html += '</div>';
        }
        el.innerHTML = html;
        bindEvents();
      }

      function bindEvents() {
        // Drum / ruler drag
        var drum = el.querySelector('[data-drum]');
        if (drum) {
          var dragging = false, startY = 0, startX = 0;
          drum.addEventListener('pointerdown', function(e) { dragging = true; startY = e.clientY; startX = e.clientX; e.preventDefault(); });
          document.addEventListener('pointermove', function(e) {
            if (!dragging) return;
            if (vs === 'ruler') {
              var dx = startX - e.clientX;
              if (Math.abs(dx) > 8) { value = Math.max(min, Math.min(max, value + (dx > 0 ? 1 : -1))); startX = e.clientX; render(); }
            } else {
              var dy = startY - e.clientY;
              if (Math.abs(dy) > 12) { value = Math.max(min, Math.min(max, value + (dy > 0 ? 1 : -1))); startY = e.clientY; render(); }
            }
          });
          document.addEventListener('pointerup', function() { dragging = false; });
          drum.addEventListener('wheel', function(e) { e.preventDefault(); value = Math.max(min, Math.min(max, value + (e.deltaY > 0 ? 1 : -1))); render(); });
        }
        // Slider click/drag
        var slider = el.querySelector('[data-slider]');
        if (slider) {
          function sliderUpdate(e) {
            var rect = slider.getBoundingClientRect();
            var x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            value = Math.round(min + x * (max - min));
            render();
          }
          var sdrag = false;
          slider.addEventListener('pointerdown', function(e) { sdrag = true; sliderUpdate(e); e.preventDefault(); });
          document.addEventListener('pointermove', function(e) { if (sdrag) sliderUpdate(e); });
          document.addEventListener('pointerup', function() { sdrag = false; });
        }
        // Input +/- buttons
        var minus = el.querySelector('[data-minus]');
        var plus = el.querySelector('[data-plus]');
        if (minus) minus.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); value = Math.max(min, value - 1); render(); });
        if (plus) plus.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); value = Math.min(max, value + 1); render(); });
      }

      render();
    });
  }
  
  // Init after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { initRulers(); initToggles(); initPickers(); });
  } else {
    setTimeout(function() { initRulers(); initToggles(); initPickers(); }, 100);
  }
})();
</script>`;

    const carouselScript = `<script data-carousel-enhance>
(function() {
  function initCarousels() {
    document.querySelectorAll('div, section').forEach(function(el) {
      if (el.hasAttribute('data-carousel') || el.dataset.enhanced) return;
      var cs = window.getComputedStyle(el);
      var hasScroll = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
      var snapType = (cs.scrollSnapType || '') + (cs.webkitScrollSnapType || '');
      if (!hasScroll && snapType.indexOf('x') < 0) return;
      var imgs = el.querySelectorAll('img');
      if (imgs.length >= 2 && el.scrollWidth > el.clientWidth * 1.3) {
        el.setAttribute('data-carousel', 'true');
        el.setAttribute('data-orientation', 'horizontal');
      }
    });
    var carousels = document.querySelectorAll('[data-carousel]');
    carousels.forEach(function(carousel) {
      if (carousel.dataset.enhanced) return;
      carousel.dataset.enhanced = 'true';
      var allChildren = Array.from(carousel.children);
      var slides = allChildren.filter(function(ch) { return ch.querySelector && ch.querySelector('img'); });
      if (slides.length < 2) {
        var directImgs = Array.from(carousel.querySelectorAll('img'));
        if (directImgs.length >= 2) {
          slides = directImgs.map(function(img) { var w = document.createElement('div'); w.appendChild(img.cloneNode(true)); return w; });
          while (carousel.firstChild) carousel.removeChild(carousel.firstChild);
          slides.forEach(function(s) { carousel.appendChild(s); });
        }
      }
      if (slides.length < 1) return;
      allChildren.forEach(function(ch) {
        if (ch.style && ch.style.fontStyle && ch.style.fontStyle.indexOf('italic') >= 0) ch.remove();
        var badges = ch.querySelectorAll ? ch.querySelectorAll('div') : [];
        for (var b = 0; b < badges.length; b++) { var t = (badges[b].textContent || '').trim(); if (/^[0-9]+\\/[0-9]+$/.test(t)) badges[b].remove(); }
      });
      var par = carousel.parentElement;
      if (par) {
        par.querySelectorAll('[class*=dot],[class*=pag],[class*=indicator],[class*=bullet],[class*=swiper]').forEach(function(d) { if (!carousel.contains(d)) d.style.display = 'none'; });
        Array.from(par.children).forEach(function(sib) { if (sib === carousel) return; if (sib.querySelectorAll('img').length === 0 && (sib.textContent||'').trim().length < 5 && sib.offsetHeight < 50) sib.style.display = 'none'; });
      }
      var firstImg = slides[0].querySelector('img');
      var cw = carousel.offsetWidth || (par ? par.offsetWidth : 400);
      var h = 280;
      if (firstImg && firstImg.naturalWidth > 0 && firstImg.naturalHeight > 0) { h = Math.round(cw * (firstImg.naturalHeight / firstImg.naturalWidth)); }
      else if (firstImg && firstImg.offsetHeight > 50) { h = firstImg.offsetHeight; }
      h = Math.max(200, Math.min(600, h));
      var isHoriz = (carousel.getAttribute('data-orientation') || 'horizontal') !== 'vertical';
      carousel.style.cssText = 'position:relative;overflow:hidden;width:100%;padding:0;display:block;height:'+h+'px;border-radius:0;background:#000;';
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;transition:transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94);will-change:transform;height:100%;flex-direction:'+(isHoriz?'row':'column')+';';
      slides.forEach(function(slide) {
        slide.style.cssText = 'min-width:100%;width:100%;height:100%;flex-shrink:0;border:none;border-radius:0;margin:0;padding:0;position:relative;overflow:hidden;background:#000;';
        var img = slide.querySelector('img'); if (img) img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
        wrapper.appendChild(slide);
      });
      while (carousel.firstChild) carousel.removeChild(carousel.firstChild);
      carousel.appendChild(wrapper);
      var dotsC = document.createElement('div');
      dotsC.style.cssText = 'position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:10;';
      var cur = 0, dots = [];
      for (var i = 0; i < slides.length; i++) { (function(idx) {
        var dot = document.createElement('button');
        dot.style.cssText = 'width:10px;height:10px;border-radius:50%;border:2px solid rgba(255,255,255,0.9);background:'+(idx===0?'#fff':'rgba(255,255,255,0.35)')+';cursor:pointer;padding:0;transition:all 0.3s;box-shadow:0 1px 4px rgba(0,0,0,0.3);outline:none;';
        dot.onclick = function(e) { e.preventDefault(); e.stopPropagation(); goTo(idx); };
        dots.push(dot); dotsC.appendChild(dot);
      })(i); }
      carousel.appendChild(dotsC);
      function goTo(idx) { cur = idx; wrapper.style.transform = (isHoriz?'translateX':'translateY')+'(-'+(idx*100)+'%)'; dots.forEach(function(d,di) { d.style.background = di===idx?'#fff':'rgba(255,255,255,0.35)'; d.style.transform = di===idx?'scale(1.3)':'scale(1)'; }); }
      var ap = setInterval(function() { goTo((cur+1)%slides.length); }, 3500);
      carousel.onmouseenter = function() { clearInterval(ap); };
      carousel.onmouseleave = function() { ap = setInterval(function() { goTo((cur+1)%slides.length); }, 3500); };
      var sx = 0;
      carousel.addEventListener('touchstart', function(e) { sx = e.touches[0].clientX; }, {passive:true});
      carousel.addEventListener('touchend', function(e) { var d = sx - e.changedTouches[0].clientX; if (Math.abs(d)>50) { if (d>0&&cur<slides.length-1) goTo(cur+1); else if (d<0&&cur>0) goTo(cur-1); } }, {passive:true});
    });
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function() { setTimeout(initCarousels, 300); }); }
  else { setTimeout(initCarousels, 300); }
  window.addEventListener('load', function() { setTimeout(initCarousels, 200); });
})();
</script>`;
    // Inject widget script + carousel script + player bridge before </body>
    // Inject widget script + carousel script + player bridge before </body>
    if (iframeDoc.includes('</body>')) {
        iframeDoc = iframeDoc.replace('</body>', widgetScript + carouselScript + playerBridge + '</body>');
    } else {
        // fullCode might be body-only content (from CloneEditor edits)
        iframeDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${iframeDoc}${widgetScript}${carouselScript}${playerBridge}</body></html>`;
    }
    
    // Add sandbox attributes to allow scripts but block navigation
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', position: 'relative' }}>
        <iframe
          ref={iframeRef}
          srcDoc={iframeDoc}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
          style={{
            flex: 1,
            width: '100%',
            border: 'none',
            minHeight: '100vh',
            background: '#fff',
          }}
          title="Quiz Page"
        />
        {pixelCode && <div dangerouslySetInnerHTML={{ __html: pixelCode }} style={{ display: 'none' }} />}
        
        {/* Floating submit button for multi-select pages — only if iframe doesn't have its own */}
        {isMultiSelect && hasSelection && !(fullCode && />(Continuar|Continue|Next|Submit|Enviar|Avançar|Siguiente|Suivant|Weiter)\s*[^<]*</i.test(fullCode)) && (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            padding: '12px 20px 20px',
            background: 'linear-gradient(transparent, rgba(255,255,255,0.95) 30%)',
            zIndex: 100,
          }}>
            <button
              onClick={onAdvance}
              style={{
                ...btnStyle,
                width: '100%',
                maxWidth: 520,
                margin: '0 auto',
                display: 'block',
                animation: 'pulse 2s infinite',
              }}
            >
              Continuar →
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Fallback: old dangerouslySetInnerHTML approach (no fullCode) ──
  useEffect(() => {
    if (!htmlRef.current) return;
    const container = htmlRef.current;
    container.querySelectorAll('input[type="range"]').forEach(range => {
      const oninput = range.getAttribute('oninput');
      if (oninput) {
        range.addEventListener('input', () => { try { new Function(oninput).call(range); } catch {} });
      }
    });
  }, [html]);

  useEffect(() => {
    if (!htmlRef.current) return;
    const container = htmlRef.current;
    const isSubmitText = (text) => /continuar|continue|next|enviar|submit|avançar|começar|start|prosseguir/i.test(text);
    const handleClick = (e) => {
      let target = e.target;
      if (['input', 'textarea', 'select'].includes(target.tagName?.toLowerCase())) return;
      for (let i = 0; i < 12; i++) {
        if (!target || target === container) break;
        const tag = target.tagName?.toLowerCase();
        const cls = (target.className?.toString?.() || '').toLowerCase();
        const text = (target.textContent || '').trim();
        let isClickable = tag === 'button' || tag === 'a' || cls.includes('btn') || cls.includes('button') || cls.includes('option') || cls.includes('choice');
        if (!isClickable) { try { if (window.getComputedStyle(target).cursor === 'pointer') isClickable = true; } catch {} }
        if (isClickable) {
          e.preventDefault(); e.stopPropagation();
          target.style.transform = 'scale(0.97)'; target.style.opacity = '0.7';
          setTimeout(() => { if (target) { target.style.transform = ''; target.style.opacity = ''; } onAdvance(); }, 250);
          return;
        }
        target = target.parentElement;
      }
    };
    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [html, onAdvance]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', width: '100%' }}>
      <div ref={htmlRef} style={{ flex: 1, width: '100%', maxWidth: '100%', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: html }} />
      {pixelCode && <div dangerouslySetInnerHTML={{ __html: pixelCode }} style={{ display: 'none' }} />}
    </div>
  );
}

// ═══ MAIN COMPONENT ═══
export default function Player({ domainQuizId }) {
  const params = useParams();
  const id = domainQuizId || params.id;
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [screen, setScreen] = useState('welcome');
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [multiSelect, setMultiSelect] = useState([]);
  const [leadData, setLeadData] = useState({ name: '', email: '' });
  const [result, setResult] = useState(null);
  const [optionAnim, setOptionAnim] = useState(null);

  useEffect(() => { getQuiz(id).then(q => { if (!q) setNotFound(true); else { setQuiz(q); recordEvent(q.id, 'view'); const hasClone = q.pages?.some(p => p.type === 'html-script'); if (hasClone) { setScreen('playing'); recordEvent(q.id, 'start'); } } }); }, [id]);

  const T = useMemo(() => quiz ? buildTheme(quiz) : null, [quiz]);
  const ne = useMemo(() => quiz ? getNicheEmojis(quiz.niche) : NE.outro, [quiz]);

  if (notFound) return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ fontSize: 48 }}>😕</div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a2332', margin: 0 }}>Quiz não encontrado</h2>
      <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Este quiz não existe ou foi removido.</p>
    </div>
  );

  if (!quiz || !T) return <div style={{ background: '#f5f7fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={32} className="spin" style={{ color: '#3b6b5e' }} /></div>;

  const pages = quiz.pages || [];
  const sections = quiz.sections || [];
  const currentPage = pages[pageIndex];

  const getSectionInfo = () => {
    if (!currentPage) return { label: '', sectionIdx: 0, progress: 0, total: sections.length };
    const si = currentPage.sectionIndex ?? 0;
    const label = sections[si]?.label || '';
    const sectionPages = pages.filter(p => p.sectionIndex === si && p.type !== 'social-proof');
    const cur = sectionPages.indexOf(currentPage);
    return { label, sectionIdx: si, progress: sectionPages.length > 0 ? (cur + 1) / sectionPages.length : 0, total: sections.length };
  };

  const isPageBuilder = !!quiz.steps;
  const stepPageMap = quiz.stepPageMap || {};
  const stepGoToMap = quiz.stepGoToMap || {};

  const advancePage = (targetStepId) => {
    // Priority: option-level goToStep → step-level goToStep → next page
    const effectiveTarget = targetStepId || stepGoToMap[pageIndex] || null;

    // Conditional routing: if target is set, jump to that step
    if (effectiveTarget === '__end') {
      if (isPageBuilder) {
        // Auto-save lead with accumulated answers
        const as2 = {}; pages.forEach((p, pi) => { if (answers[pi] !== undefined) { as2[p.stepName || p.title || `Etapa ${pi+1}`] = answers[pi]; } });
        if (Object.keys(as2).length > 0) saveLead(quiz.id, { answers: as2, date: new Date().toISOString(), source: 'auto' });
        setScreen('done'); recordEvent(quiz.id, 'complete');
      }
      else if (quiz.collectLead) setScreen('lead');
      else finishQuiz();
      return;
    }
    if (effectiveTarget && stepPageMap[effectiveTarget] !== undefined) {
      setPageIndex(stepPageMap[effectiveTarget]); setMultiSelect([]); setOptionAnim(null);
      return;
    }
    // Default: go to next page
    const next = pageIndex + 1;
    if (next >= pages.length) {
      if (isPageBuilder) {
        const as3 = {}; pages.forEach((p, pi) => { if (answers[pi] !== undefined) { as3[p.stepName || p.title || `Etapa ${pi+1}`] = answers[pi]; } });
        if (Object.keys(as3).length > 0) saveLead(quiz.id, { answers: as3, date: new Date().toISOString(), source: 'auto' });
        setScreen('done'); recordEvent(quiz.id, 'complete');
      }
      else if (quiz.collectLead) setScreen('lead');
      else finishQuiz();
    }
    else { setPageIndex(next); setMultiSelect([]); setOptionAnim(null); }
  };

  const finishQuiz = () => {
    setScreen('calculating');
    recordEvent(quiz.id, 'complete');
    const questionAnswers = {};
    let qi = 0;
    pages.forEach((p, pi) => { if (p.type !== 'insight' && p.type !== 'social-proof') { if (answers[pi] !== undefined) questionAnswers[qi] = answers[pi]; qi++; } });
    // Auto-save lead with accumulated answers from all pages (including clones)
    const answerSummary = {};
    pages.forEach((p, pi) => {
      if (answers[pi] !== undefined) {
        const label = p.stepName || p.title || p.text || `Etapa ${pi + 1}`;
        answerSummary[label] = answers[pi];
      }
    });
    if (Object.keys(answerSummary).length > 0) {
      saveLead(quiz.id, { answers: answerSummary, date: new Date().toISOString(), source: 'auto' });
    }
    setTimeout(() => { setResult(calculateQuizResult(quiz, questionAnswers)); setScreen('result'); }, 2800);
  };

  const handleChoice = (idx) => {
    setOptionAnim(idx);
    setAnswers(a => ({ ...a, [pageIndex]: idx }));
    recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, optionIndex: idx });
    // Check for conditional routing on selected option
    const opts = getOptions();
    const selectedOpt = opts[idx];
    const goTo = selectedOpt?.goToStep || null;
    setTimeout(() => advancePage(goTo), 400);
  };
  const handleMultiToggle = (idx) => setMultiSelect(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  const handleMultiSubmit = () => { if (!multiSelect.length) return; setAnswers(a => ({ ...a, [pageIndex]: multiSelect })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, optionIndex: multiSelect[0] || 0 }); advancePage(); };
  const handleLeadSubmit = (e) => { e.preventDefault(); saveLead(quiz.id, { ...leadData, answers, result: result?.result?.name || '', date: new Date().toISOString() }); finishQuiz(); };
  const handleCTA = () => { recordEvent(quiz.id, 'cta_click'); const url = result?.result?.ctaUrl; if (url) window.location.href = url; };
  const goBack = () => { if (pageIndex > 0) { setPageIndex(pageIndex - 1); setMultiSelect([]); setOptionAnim(null); } };

  const getOptions = () => (currentPage?.options || []).map(o => typeof o === 'string' ? { text: o, emoji: '' } : o);

  // ── STYLES ──
  const S = {
    container: { background: T.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter','Segoe UI',sans-serif", color: T.text, position: 'relative' },
    inner: { maxWidth: 520, width: '100%', margin: '0 auto', padding: '0 20px', flex: 1, display: 'flex', flexDirection: 'column' },
    btn: (disabled) => ({ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: disabled ? `rgba(${T.rgb},.35)` : T.primary, color: T.onPrimary, fontWeight: 700, fontSize: '1rem', cursor: disabled ? 'default' : 'pointer', marginTop: 'auto', marginBottom: 24, transition: 'all .25s', boxShadow: disabled ? 'none' : `0 4px 16px rgba(${T.rgb},.25)` }),
    optionCard: (selected) => ({ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: selected ? `rgba(${T.rgb},.08)` : T.card, border: `1.5px solid ${selected ? T.primary : T.border}`, borderRadius: 16, cursor: 'pointer', marginBottom: 10, transition: 'all .2s', fontSize: '0.95rem', color: T.text, fontWeight: 500, boxShadow: selected ? `0 2px 12px rgba(${T.rgb},.12)` : '0 1px 3px rgba(0,0,0,.04)' }),
    checkbox: (c) => ({ width: 22, height: 22, borderRadius: 6, border: `2px solid ${c ? T.primary : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: c ? T.primary : 'transparent', transition: 'all .2s' }),
  };

  // ── WELCOME ──
  const findWelcome = () => {
    for (let i = 0; i < Math.min(2, pages.length); i++) {
      const p = pages[i];
      if (p?.type === 'welcome' && (p.headline || p.emoji || p.imageUrl)) return { block: p, skipTo: i + 1 };
      if (p?.type === 'compound' && p.blocks) {
        const wb = p.blocks.find(b => b.type === 'welcome');
        if (wb && (wb.headline || wb.emoji || wb.imageUrl)) return { block: wb, skipTo: i + 1 };
      }
    }
    // Fallback: use page 0 if welcome type (even if empty)
    if (pages[0]?.type === 'welcome') return { block: pages[0], skipTo: 1 };
    return { block: null, skipTo: 0 };
  };
  const { block: welcomeBlock, skipTo: welcomeSkipTo } = findWelcome();
  const startQuiz = () => { setScreen('playing'); setPageIndex(welcomeSkipTo); recordEvent(quiz.id, 'start'); };

  if (screen === 'welcome') return (
    <div style={S.container}>
      <style>{CSS.replace(/var\(--qp-rgb\)/g, T.rgb)}</style>
      <div style={{ ...S.inner, justifyContent: 'center', textAlign: welcomeBlock?.textAlign || 'center', padding: '40px 20px', background: welcomeBlock?.bgColor || 'transparent' }}>
        <motion.div {...pageAnim} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {welcomeBlock ? (<>
            {/* Custom welcome from block */}
            {welcomeBlock.imageUrl && welcomeBlock.imagePosition === 'top' && (
              <img src={welcomeBlock.imageUrl} alt="" style={{ width: `${welcomeBlock.imageWidth || 100}%`, height: welcomeBlock.imageHeightPx || 200, objectFit: 'cover', borderRadius: 20 }} />
            )}
            {welcomeBlock.emoji && <div style={{ fontSize: 56, marginBottom: 4, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.1))' }}>{welcomeBlock.emoji}</div>}
            {welcomeBlock.headline && <h1 style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.3, marginBottom: 4, color: T.text, maxWidth: 340 }}>{welcomeBlock.headline}</h1>}
            {welcomeBlock.subtitle && <p style={{ color: T.textSec, fontSize: '0.92rem', lineHeight: 1.6, maxWidth: 340 }}>{welcomeBlock.subtitle}</p>}
            {welcomeBlock.imageUrl && welcomeBlock.imagePosition === 'center' && (
              <img src={welcomeBlock.imageUrl} alt="" style={{ width: `${welcomeBlock.imageWidth || 100}%`, height: welcomeBlock.imageHeightPx || 200, objectFit: 'cover', borderRadius: 20 }} />
            )}
            <button className="qp-cta" onClick={startQuiz} style={{ ...S.btn(false), maxWidth: 400, margin: '12px auto 0' }}>
              {welcomeBlock.cta || 'Começar →'}
            </button>
            {welcomeBlock.imageUrl && welcomeBlock.imagePosition === 'bottom' && (
              <img src={welcomeBlock.imageUrl} alt="" style={{ width: `${welcomeBlock.imageWidth || 100}%`, height: welcomeBlock.imageHeightPx || 200, objectFit: 'cover', borderRadius: 20 }} />
            )}
          </>) : (<>
            {/* Default welcome (AI quizzes) */}
            <div style={{ background: T.heroBg, borderRadius: 24, padding: '40px 24px 32px', marginBottom: 28, position: 'relative', overflow: 'hidden', width: '100%' }}>
              <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 120, opacity: 0.08, transform: 'rotate(-15deg)' }}>{ne.hero}</div>
              <div style={{ fontSize: 56, marginBottom: 12, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.1))' }}>{ne.hero}</div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.3, marginBottom: 8, color: T.text }}>{quiz.welcome?.headline}</h1>
              <p style={{ color: T.textSec, fontSize: '0.92rem', lineHeight: 1.6 }}>{quiz.welcome?.subheadline}</p>
            </div>
            <button className="qp-cta" onClick={startQuiz} style={{ ...S.btn(false), maxWidth: 400, margin: '0 auto' }}>
              {quiz.welcome?.cta || 'Começar →'}
            </button>
            <p style={{ color: T.textMuted, fontSize: '0.78rem', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>⏱ Leva apenas 2-3 minutos</p>
          </>)}
        </motion.div>
      </div>
    </div>
  );

  // ── LEAD ──
  if (screen === 'lead') return (
    <div style={S.container}>
      <style>{CSS.replace(/var\(--qp-rgb\)/g, T.rgb)}</style>
      <div style={{ ...S.inner, justifyContent: 'center', padding: '40px 20px' }}>
        <motion.div {...pageAnim}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: T.text, marginBottom: 6 }}>Quase lá!</h2>
            <p style={{ color: T.textSec }}>Insira seus dados para ver seu resultado personalizado</p>
          </div>
          <form onSubmit={handleLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input value={leadData.name} onChange={e => setLeadData({ ...leadData, name: e.target.value })} placeholder="Seu nome" required style={{ padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${T.border}`, background: T.card, fontSize: '0.95rem', color: T.text, outline: 'none' }} />
            <input value={leadData.email} onChange={e => setLeadData({ ...leadData, email: e.target.value })} placeholder="Seu e-mail" type="email" required style={{ padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${T.border}`, background: T.card, fontSize: '0.95rem', color: T.text, outline: 'none' }} />
            <button type="submit" style={S.btn(!leadData.name || !leadData.email)}>Ver meu resultado →</button>
          </form>
        </motion.div>
      </div>
    </div>
  );

  // ── DONE (PageBuilder quizzes — no score/result) ──
  if (screen === 'done') return (
    <div style={S.container}>
      <style>{CSS.replace(/var\(--qp-rgb\)/g, T.rgb)}</style>
      <div style={{ ...S.inner, justifyContent: 'center', alignItems: 'center', padding: '40px 20px' }}>
        <motion.div {...pageAnim} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: T.text, marginBottom: 8 }}>Quiz Concluído!</h2>
          <p style={{ color: T.textSec, fontSize: '0.9rem', marginBottom: 24, maxWidth: 320 }}>Obrigado por participar. Suas respostas foram registradas.</p>
          <button style={{ ...S.btn(false), maxWidth: 300 }} onClick={() => { setPageIndex(0); setScreen('welcome'); setAnswers({}); }}>
            🔄 Refazer Quiz
          </button>
        </motion.div>
      </div>
    </div>
  );

  // ── CALCULATING ──
  if (screen === 'calculating') return (
    <div style={S.container}>
      <style>{CSS.replace(/var\(--qp-rgb\)/g, T.rgb)}</style>
      <div style={{ ...S.inner, justifyContent: 'center', alignItems: 'center', padding: '40px 20px' }}>
        <motion.div {...pageAnim} style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', border: `3px solid ${T.border}`, borderTopColor: T.primary, animation: 'spin 1s linear infinite', margin: '0 auto 24px' }} />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: T.text, marginBottom: 8 }}>Analisando suas respostas...</h2>
          <p style={{ color: T.textSec, fontSize: '0.88rem' }}>Preparando seu diagnóstico personalizado</p>
        </motion.div>
      </div>
    </div>
  );

  // ── RESULT (Conversion-focused) ──
  if (screen === 'result' && result) {
    const r = result.result;
    // Extract first 2-3 sentences from description for a short persuasive text
    const shortDesc = (r?.description || '').split(/[.!?]\s+/).filter(Boolean).slice(0, 3).join('. ').trim();
    const descText = shortDesc ? shortDesc + '.' : r?.description || '';
    return (
      <div style={{ ...S.container }}>
        <style>{CSS.replace(/var\(--qp-rgb\)/g, T.rgb)}</style>
        <div style={{ ...S.inner, justifyContent: 'center', padding: '40px 20px' }}>
          <motion.div {...pageAnim}>
            {/* Result ready badge */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 30, background: `rgba(${T.rgb},.08)`, border: `1px solid rgba(${T.rgb},.15)`, marginBottom: 16 }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: T.primary }}>Resultado Pronto</span>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: T.text, lineHeight: 1.3, marginBottom: 4 }}>{r?.name}</h2>
            </div>

            {/* Short persuasive description */}
            <div style={{ background: T.card, borderRadius: 16, padding: '20px 18px', marginBottom: 24, border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: '0.92rem', lineHeight: 1.75, color: T.textSec, margin: 0 }}>{descText}</p>
            </div>

            {/* CTA — Hero */}
            <button className="qp-cta" onClick={handleCTA} style={{
              width: '100%', maxWidth: 420, margin: '0 auto', display: 'block',
              padding: '20px 24px', borderRadius: 16, border: 'none',
              background: `linear-gradient(135deg, ${T.primary}, ${T.secondary || T.primary})`,
              color: T.onPrimary || '#fff', fontWeight: 800, fontSize: '1.1rem',
              cursor: 'pointer', boxShadow: `0 8px 28px rgba(${T.rgb},.35)`,
              letterSpacing: '.02em',
            }}>
              {r?.cta || '🔥 QUERO ACESSAR AGORA →'}
            </button>

            {/* Trust + Urgency */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: T.textMuted }}>
                <span>🔒</span>
                <span>Garantia incondicional de 7 dias</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: '#fef2f2', border: '1px solid #fecaca' }}>
                <span style={{ fontSize: 14 }}>⏰</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dc2626' }}>Vagas limitadas — garanta a sua</span>
              </div>
            </div>

            {/* Mini Social Proof */}
            <div style={{ marginTop: 20, textAlign: 'center', padding: '14px 16px', borderRadius: 14, background: `rgba(${T.rgb},.04)`, border: `1px solid rgba(${T.rgb},.08)` }}>
              <div style={{ fontSize: '0.82rem', color: '#f59e0b', marginBottom: 4 }}>⭐⭐⭐⭐⭐ <span style={{ color: T.text, fontWeight: 700 }}>4.9/5</span></div>
              <p style={{ fontSize: '0.8rem', color: T.textSec, margin: 0, fontStyle: 'italic' }}>"Mudou completamente minha rotina. Recomendo demais!"</p>
              <p style={{ fontSize: '0.7rem', color: T.textMuted, margin: '4px 0 0' }}>— Maria S., verificada</p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── PLAYING ──
  if (!currentPage) return null;
  const { label, sectionIdx, progress, total } = getSectionInfo();
  const isInsight = currentPage.type === 'insight';
  const isSP = currentPage.type === 'social-proof';
  const isMulti = currentPage.type === 'multi-select';
  const isStatement = currentPage.type === 'statement';
  const isLikert = currentPage.type === 'likert';
  const isImageSelect = currentPage.type === 'image-select';
  const isChoice = ['choice', 'picker', 'age-choice', 'single-choice'].includes(currentPage.type);
  const isVideoResponse = currentPage.type === 'video-response';
  const phaseEmoji = ne.phases[sectionIdx] || '💭';

  return (
    <div style={S.container}>
      <style>{CSS.replace(/var\(--qp-rgb\)/g, T.rgb)}</style>
      <div style={S.inner}>
        {/* Header — hide for cloned pages */}
        {currentPage.type !== 'html-script' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '16px 0 6px' }}>
          {pageIndex > 0 && <button style={{ position: 'absolute', left: 0, background: 'none', border: 'none', cursor: 'pointer', color: T.text, padding: 8 }} onClick={goBack}><ChevronLeft size={24} /></button>}
          {quiz.companyName && (
            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: T.text, letterSpacing: '.01em' }}>
              {quiz.companyName}
            </span>
          )}
        </div>
        )}

        {/* Progress bar — hide for cloned pages, insights, social proof */}
        {!isInsight && !isSP && currentPage.type !== 'html-script' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ height: 5, borderRadius: 3, background: `rgba(${T.rgb},.12)`, overflow: 'hidden' }}>
              <div className="qp-progress-fill" style={{ height: '100%', width: `${((pageIndex + 1) / pages.length) * 100}%`, background: T.primary, borderRadius: 3, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <AnimatePresence mode="wait">
            <motion.div key={pageIndex} {...pageAnim} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

              {/* ── INSIGHT ── */}
              {isInsight && (() => {
                const blocks = parseRichText(currentPage.body);
                const hasImg = !!currentPage.imageUrl;
                return (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Title */}
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, lineHeight: 1.3, color: T.text, textAlign: 'center', marginBottom: 16 }}>{currentPage.title}</h2>
                    {/* AI-generated image or CSS fallback */}
                    {hasImg ? (
                      <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
                        <img src={currentPage.imageUrl} alt={currentPage.title} style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
                      </div>
                    ) : (
                      <div style={{ background: T.insightBg, borderRadius: 16, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(${T.rgb},.03) 20px, rgba(${T.rgb},.03) 40px)` }} />
                        <span style={{ fontSize: 56, opacity: 0.6 }}>{ne.hero}</span>
                      </div>
                    )}
                    {/* Rich content */}
                    <div style={{ flex: 1, padding: '0 2px' }}>
                      {blocks.map((block, i) => {
                        if (block.type === 'list') return (
                          <ul key={i} style={{ listStyle: 'none', padding: 0, margin: '14px 0' }}>
                            {block.items.map((item, j) => (
                              <li key={j} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10, fontSize: '0.9rem', color: T.textSec }}>
                                <span style={{ color: T.primary, fontWeight: 700 }}>✓</span>
                                <span><Md>{item}</Md></span>
                              </li>
                            ))}
                          </ul>
                        );
                        if (block.type === 'stat') return (
                          <div key={i} style={{ background: T.statBg, borderRadius: 12, padding: '14px 16px', margin: '14px 0', borderLeft: `4px solid ${T.primary}` }}>
                            <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: 0, color: T.text }}><Md>{block.text}</Md></p>
                          </div>
                        );
                        if (block.type === 'emphasis') return <p key={i} style={{ fontStyle: 'italic', color: T.textMuted, fontSize: '0.88rem', margin: '14px 0', textAlign: 'center' }}>{block.text}</p>;
                        return <p key={i} style={{ fontSize: '0.93rem', lineHeight: 1.7, color: T.textSec, margin: '10px 0' }}><Md>{block.text}</Md></p>;
                      })}
                      {blocks.length === 0 && currentPage.body && (
                        <p style={{ fontSize: '0.93rem', lineHeight: 1.7, color: T.textSec }}>{currentPage.body.split('\n\n').map((para, i) => <span key={i}>{i > 0 && <><br /><br /></>}<Md>{para}</Md></span>)}</p>
                      )}
                    </div>
                    <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                  </div>
                );
              })()}

              {/* ── SOCIAL PROOF ── */}
              {isSP && (() => {
                const hasImg = !!currentPage.imageUrl;
                return (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    {/* Headline */}
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: T.primary, lineHeight: 1.2, marginBottom: 6, marginTop: 16 }}>{currentPage.headline}</h2>
                    <p style={{ fontWeight: 600, color: T.primary, fontSize: '1rem', opacity: 0.8, marginBottom: 24 }}>{currentPage.subheadline}</p>
                    {/* AI-generated image or fallback */}
                    {hasImg ? (
                      <div style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 24, width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
                        <img src={currentPage.imageUrl} alt="Social proof" style={{ width: '100%', height: 'auto', display: 'block' }} />
                      </div>
                    ) : (
                      <div style={{ fontSize: 64, marginBottom: 24 }}>👥</div>
                    )}
                    <button style={{ ...S.btn(false), maxWidth: 360 }} onClick={advancePage}>Continuar</button>
                  </div>
                );
              })()}

              {/* ── MULTI-SELECT ── */}
              {isMulti && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h2 style={{ fontWeight: 700, fontSize: '1.3rem', lineHeight: 1.3, textAlign: 'center', marginBottom: 22, color: T.text }}>{currentPage.text}</h2>
                  <div style={{ flex: 1 }}>
                    {getOptions().map((opt, i) => {
                      const checked = multiSelect.includes(i);
                      return (
                        <div key={i} className={checked ? 'qp-option-pop' : ''} style={S.optionCard(checked)} onClick={() => handleMultiToggle(i)}>
                          {opt.emoji && <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{opt.emoji}</span>}
                          <span style={{ flex: 1 }}>{opt.text}</span>
                          <div style={S.checkbox(checked)}>
                            {checked && <span className="qp-check-anim"><Check size={14} color="#fff" strokeWidth={3} /></span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button style={S.btn(multiSelect.length === 0)} onClick={handleMultiSubmit} disabled={multiSelect.length === 0}>Continuar</button>
                </div>
              )}

              {/* ── STATEMENT ── */}
              {isStatement && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h2 style={{ fontWeight: 700, fontSize: '1.3rem', lineHeight: 1.3, textAlign: 'center', marginBottom: 10, color: T.text }}>{currentPage.text}</h2>
                  {currentPage.quote && <p style={{ fontStyle: 'italic', textAlign: 'center', color: T.textSec, fontSize: '0.93rem', marginBottom: 22 }}>"{currentPage.quote}"</p>}
                  <div style={{ flex: 1 }}>
                    {(currentPage.options || []).map((opt, i) => (
                      <div key={i} className={optionAnim === i ? 'qp-option-pop' : ''} style={S.optionCard(optionAnim === i)} onClick={() => handleChoice(i)}>
                        <span style={{ flex: 1 }}>{typeof opt === 'string' ? opt : opt.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── CHOICE ── */}
              {isChoice && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h2 style={{ fontWeight: 700, fontSize: '1.3rem', lineHeight: 1.3, textAlign: 'center', marginBottom: 22, color: T.text }}>{currentPage.text}</h2>
                  <div style={{ flex: 1 }}>
                    {getOptions().map((opt, i) => (
                      <div key={i} className={optionAnim === i ? 'qp-option-pop' : ''} style={S.optionCard(optionAnim === i)} onClick={() => handleChoice(i)}>
                        {opt.emoji && <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{opt.emoji}</span>}
                        <span style={{ flex: 1 }}>{opt.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── LIKERT (scale) ── */}
              {isLikert && (() => {
                const opts = currentPage.options || [];
                const count = opts.length || 5;
                const selectedIdx = optionAnim;
                const curVal = selectedIdx ?? Math.floor((count - 1) / 2);
                const pct = count > 1 ? (curVal / (count - 1)) * 100 : 50;
                const sliderId = `qp-lk-${pageIndex}`;
                const sliderCSS = `
#${sliderId}{-webkit-appearance:none;width:100%;height:8px;border-radius:4px;outline:none;cursor:pointer;background:linear-gradient(to right,${T.primary} 0%,${T.primary} ${pct}%,${T.border} ${pct}%,${T.border} 100%)}
#${sliderId}::-webkit-slider-thumb{-webkit-appearance:none;width:30px;height:30px;border-radius:50%;background:#fff;border:3px solid ${T.primary};box-shadow:0 2px 10px rgba(${T.rgb},0.25);cursor:grab}
#${sliderId}::-webkit-slider-thumb:active{cursor:grabbing;box-shadow:0 3px 14px rgba(${T.rgb},0.35)}
#${sliderId}::-moz-range-thumb{width:30px;height:30px;border-radius:50%;background:#fff;border:3px solid ${T.primary};box-shadow:0 2px 10px rgba(${T.rgb},0.25);cursor:grab}
#${sliderId}::-moz-range-track{height:8px;border-radius:4px;background:${T.border}}
#${sliderId}::-moz-range-progress{height:8px;border-radius:4px;background:${T.primary}}`;
                return (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <style>{sliderCSS}</style>
                    <h2 style={{ fontWeight: 700, fontSize: '1.3rem', lineHeight: 1.3, textAlign: 'center', marginBottom: 32, color: T.text }}>{currentPage.text}</h2>
                    <div style={{ padding: '0 10px', marginBottom: 24 }}>
                      <input id={sliderId} type="range" min={0} max={count - 1} step={1} value={curVal}
                        onChange={e => {
                          const v = Number(e.target.value);
                          setOptionAnim(v);
                        }}
                        onMouseUp={() => { if (optionAnim != null) handleChoice(optionAnim); }}
                        onTouchEnd={() => { if (optionAnim != null) handleChoice(optionAnim); }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                        <span style={{ fontSize: '0.7rem', color: T.textMuted }}>{opts[0]?.text}</span>
                        <span style={{ fontSize: '0.7rem', color: T.textMuted }}>{opts[count - 1]?.text}</span>
                      </div>
                      {opts[curVal] && (
                        <div style={{ textAlign: 'center', marginTop: 8 }}>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: T.primary }}>{opts[curVal].text}</span>
                        </div>
                      )}
                    </div>
                    <p style={{ textAlign: 'center', fontSize: '0.72rem', color: T.textMuted }}>
                      Arraste para selecionar
                    </p>
                  </div>
                );
              })()}

              {/* ── IMAGE-SELECT ── */}
              {isImageSelect && (() => {
                const opts = currentPage.options || [];
                return (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontWeight: 700, fontSize: '1.3rem', lineHeight: 1.3, textAlign: 'center', marginBottom: 22, color: T.text }}>{currentPage.text}</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, flex: 1 }}>
                      {opts.map((opt, i) => {
                        const selected = optionAnim === i;
                        return (
                          <div key={i}
                            className={selected ? 'qp-option-pop' : ''}
                            onClick={() => handleChoice(i)}
                            style={{
                              borderRadius: 18, overflow: 'hidden', cursor: 'pointer',
                              border: selected ? `2.5px solid ${T.primary}` : `1.5px solid ${T.border}`,
                              background: T.card, transition: 'all .25s',
                              boxShadow: selected ? `0 4px 16px rgba(${T.rgb},.2)` : '0 1px 4px rgba(0,0,0,.04)',
                              transform: selected ? 'scale(1.02)' : 'scale(1)',
                            }}>
                            {/* Visual area */}
                            <div style={{
                              height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: selected
                                ? `linear-gradient(135deg, rgba(${T.rgb},.15), rgba(${T.rgb},.06))`
                                : `linear-gradient(135deg, rgba(${T.rgb},.06), rgba(${T.rgb},.02))`,
                              transition: 'all .3s',
                            }}>
                              <span style={{ fontSize: 44, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.08))' }}>{opt.image || '📷'}</span>
                            </div>
                            {/* Text */}
                            <div style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: '0.85rem', fontWeight: selected ? 700 : 500,
                                color: selected ? T.primary : T.text,
                              }}>{opt.text}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ── PAGEBUILDER BLOCK TYPES (text, button, image, video, compound, etc.) ── */}
              {/* ── VIDEO-RESPONSE ── */}
              {isVideoResponse && (() => {
                const opts = currentPage.options || [];
                return (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontWeight: 700, fontSize: '1.3rem', lineHeight: 1.3, textAlign: 'center', marginBottom: 16, color: T.text }}>{currentPage.text}</h2>
                    {currentPage.videoUrl ? (
                      <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 16, overflow: 'hidden', marginBottom: 16, background: '#000' }}>
                        <iframe src={currentPage.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen />
                      </div>
                    ) : (
                      <div style={{ height: 200, background: '#1a1a2e', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 48, marginBottom: 16 }}>🎬</div>
                    )}
                    {currentPage.desc && <p style={{ color: T.textSec, fontSize: '0.88rem', textAlign: 'center', marginBottom: 16 }}>{currentPage.desc}</p>}
                    <div style={{ flex: 1 }}>
                      {opts.map((opt, i) => (
                        <div key={i} className={optionAnim === i ? 'qp-option-pop' : ''} style={S.optionCard(optionAnim === i)} onClick={() => handleChoice(i)}>
                          <span style={{ flex: 1 }}>{typeof opt === 'string' ? opt : opt.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {!isInsight && !isSP && !isMulti && !isStatement && !isChoice && !isLikert && !isImageSelect && !isVideoResponse && (() => {
                const p = currentPage;
                const type = p.type;

                // ── Compound page (multi-block step) ──
                if (type === 'compound' && p.blocks) {
                  const hasInteractive = p.blocks.some(b => ['choice', 'capture', 'likert', 'result', 'scroll-picker', 'number-input'].includes(b.type));
                  const renderBlock = (b, i) => {
                    const bType = b.type;
                    if (bType === 'text') {
                      const v = b.variant || 'body';
                      const sz = v === 'headline' ? '1.6rem' : v === 'subheadline' ? '1.2rem' : v === 'caption' ? '0.8rem' : '1rem';
                      const fw = (v === 'headline' || v === 'subheadline') ? 800 : b.bold ? 700 : 400;
                      return <div key={i} style={{ fontSize: sz, fontWeight: fw, lineHeight: 1.6, color: b.textColor || T.text, textAlign: b.align || 'left', fontStyle: b.italic ? 'italic' : 'normal', textDecoration: b.underline ? 'underline' : 'none', whiteSpace: 'pre-wrap', marginBottom: 12 }}>{b.imageUrl && <img src={b.imageUrl} alt="" style={{ width: '100%', borderRadius: 16, marginBottom: 12, maxHeight: 220, objectFit: 'cover' }} />}{b.content || ''}</div>;
                    }
                    if (bType === 'button') return <button key={i} style={{ ...S.btn(false), marginBottom: 12 }} onClick={() => { if (b.url) window.open(b.url, '_blank'); else advancePage(); }}>{b.text || 'Continuar →'}</button>;
                    if (bType === 'image') return <div key={i} style={{ marginBottom: 12 }}>{b.imageUrl ? <img src={b.imageUrl} alt={b.alt || ''} style={{ width: '100%', borderRadius: 16, maxHeight: 280, objectFit: 'cover' }} /> : <div style={{ height: 180, background: T.insightBg, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🖼️</div>}{b.caption && <p style={{ textAlign: 'center', fontSize: '0.85rem', color: T.textSec, marginTop: 6 }}>{b.caption}</p>}</div>;
                    if (bType === 'video') return <div key={i} style={{ marginBottom: 12 }}>{b.videoUrl ? <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 16, overflow: 'hidden', background: '#000' }}><iframe src={b.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen /></div> : <div style={{ height: 180, background: '#1a1a2e', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 48 }}>🎬</div>}</div>;
                    if (bType === 'social-proof') return <div key={i} style={{ textAlign: 'center', marginBottom: 12 }}><div style={{ fontSize: '1.8rem', fontWeight: 800, color: T.primary }}>{b.headline}</div><p style={{ color: T.primary, opacity: 0.8, fontSize: '0.9rem' }}>{b.subheadline}</p></div>;
                    if (bType === 'testimonial') return <div key={i} style={{ background: T.card, borderRadius: 16, padding: '16px 14px', border: `1px solid ${T.border}`, marginBottom: 12 }}><div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>{Array.from({ length: b.rating || 5 }, (_, j) => <span key={j} style={{ fontSize: 14 }}>⭐</span>)}</div><p style={{ fontSize: '0.9rem', color: T.textSec, fontStyle: 'italic', margin: '0 0 8px' }}>"{b.text}"</p><span style={{ fontWeight: 700, fontSize: '0.8rem', color: T.text }}>{b.name}</span></div>;
                    if (bType === 'alert') { const colors = { danger: '#ef4444', warning: '#f59e0b', success: '#10b981', info: T.primary }; const c = colors[b.alertType] || T.primary; return <div key={i} style={{ background: `${c}10`, border: `1px solid ${c}30`, borderRadius: 14, padding: '16px 14px', marginBottom: 12, textAlign: 'center' }}>{b.emoji && <div style={{ fontSize: 28, marginBottom: 6 }}>{b.emoji}</div>}<h3 style={{ fontSize: '1rem', fontWeight: 700, color: c, marginBottom: 4 }}>{b.title}</h3><p style={{ color: T.textSec, fontSize: '0.85rem', margin: 0 }}>{b.text}</p></div>; }
                    if (bType === 'timer') return <TimerBlock key={i} duration={b.duration} title={b.title} T={T} onDone={advancePage} />;
                    if (bType === 'price') return <div key={i} style={{ background: T.card, borderRadius: 18, padding: '20px 16px', border: `1px solid ${T.border}`, marginBottom: 12, textAlign: 'center' }}><h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>{b.title}</h3>{b.originalPrice && <div style={{ fontSize: '0.85rem', color: T.textMuted, textDecoration: 'line-through' }}>{b.originalPrice}</div>}<div style={{ fontSize: '1.8rem', fontWeight: 800, color: T.primary }}>{b.price}</div>{b.discount && <span style={{ padding: '3px 10px', borderRadius: 6, background: `rgba(${T.rgb},.1)`, color: T.primary, fontSize: '0.75rem', fontWeight: 700 }}>{b.discount}</span>}{(b.features || []).length > 0 && <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', textAlign: 'left' }}>{b.features.map((f, fi) => <li key={fi} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0', fontSize: '0.85rem', color: T.textSec }}><span style={{ color: T.primary }}>✓</span>{f}</li>)}</ul>}</div>;
                    if (bType === 'arguments') return <div key={i} style={{ marginBottom: 12 }}><h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 10 }}>{b.title}</h3><ul style={{ listStyle: 'none', padding: 0 }}>{(b.items || []).map((item, ii) => <li key={ii} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${T.border}`, fontSize: '0.9rem', color: T.textSec }}><span style={{ fontSize: 16 }}>{b.emoji || '✅'}</span>{item}</li>)}</ul></div>;
                    if (bType === 'loading') return <LoadingBlock key={i} title={b.title} items={b.items} T={T} onDone={advancePage} />;
                    if (bType === 'progress-bar') return <ProgressBarBlock key={i} title={b.title} items={b.items} duration={b.duration} T={T} onDone={advancePage} />;
                    if (bType === 'risk-chart') return <RiskChartBlock key={i} title={b.title} labels={b.labels} userPosition={b.userPosition} duration={b.duration} T={T} onDone={advancePage} />;
                    if (bType === 'yes-no') return <div key={i} style={{ marginBottom: 12 }}><h3 style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', marginBottom: 16, color: T.text }}>{b.text}</h3><div style={{ display: 'flex', gap: 12 }}>{[{ label: b.yesLabel || 'Sim', emoji: b.yesEmoji || '✅', val: 'yes' }, { label: b.noLabel || 'Não', emoji: b.noEmoji || '🚫', val: 'no' }].map((opt, oi) => <div key={oi} style={{ flex: 1, padding: '18px 12px', borderRadius: 16, border: `2px solid ${answers[pageIndex] === opt.val ? T.primary : T.border}`, background: answers[pageIndex] === opt.val ? `rgba(${T.rgb},.06)` : T.card, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }} onClick={() => { setAnswers(a => ({ ...a, [pageIndex]: opt.val })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, value: opt.val }); setTimeout(advancePage, 400); }}><div style={{ fontSize: '2rem', marginBottom: 6 }}>{opt.emoji}</div><div style={{ fontWeight: 600, fontSize: '0.95rem', color: T.text }}>{opt.label}</div></div>)}</div></div>;
                    if (bType === 'before-after') return <div key={i} style={{ marginBottom: 12 }}><h3 style={{ fontSize: '1rem', fontWeight: 700, textAlign: 'center', marginBottom: 12, color: T.text }}>{b.title}</h3><div style={{ display: 'flex', gap: 12 }}>{[{ label: b.beforeLabel || 'Antes', img: b.beforeImage, color: '#ef4444' }, { label: b.afterLabel || 'Depois', img: b.afterImage, color: '#22c55e' }].map((side, si) => <div key={si} style={{ flex: 1, borderRadius: 14, overflow: 'hidden', border: `2px solid ${side.color}20`, background: T.card }}>{side.img ? <img src={side.img} alt={side.label} style={{ width: '100%', height: 120, objectFit: 'cover' }} /> : <div style={{ width: '100%', height: 120, background: `${side.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>{si === 0 ? '😔' : '😊'}</div>}<div style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: '0.82rem', color: side.color, background: `${side.color}08` }}>{side.label}</div></div>)}</div></div>;
                    if (bType === 'insight') return <div key={i} style={{ background: `rgba(${T.rgb},.04)`, borderRadius: 16, padding: '16px 14px', border: `1px solid rgba(${T.rgb},.1)`, marginBottom: 12 }}><h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: T.primary, marginBottom: 6 }}>{b.title || '💡 Dica'}</h4><p style={{ fontSize: '0.88rem', color: T.textSec, margin: 0, lineHeight: 1.6 }}>{b.body}</p></div>;
                    if (bType === 'choice') return <div key={i} style={{ marginBottom: 12 }}><h3 style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', marginBottom: 12, color: T.text }}>{b.text}</h3>{(b.options || []).map((opt, oi) => <div key={oi} style={S.optionCard(false)} onClick={() => { setAnswers(a => ({ ...a, [pageIndex]: oi })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, optionIndex: oi }); setTimeout(advancePage, 400); }}>{typeof opt === 'string' ? opt : <><span style={{ fontSize: '1.3rem' }}>{opt.emoji}</span><span style={{ flex: 1 }}>{opt.text}</span></>}</div>)}</div>;
                    if (bType === 'likert') return (() => { const opts = b.options || []; const selected = answers[pageIndex]; return <div key={i} style={{ marginBottom: 12 }}><h3 style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', marginBottom: 12, color: T.text }}>{b.text}</h3>{opts.map((o, oi) => <div key={oi} style={{ ...S.optionCard(selected === oi), marginBottom: 6 }} onClick={() => { setAnswers(a => ({ ...a, [pageIndex]: oi })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, value: o.value }); setTimeout(advancePage, 400); }}><span style={{ flex: 1 }}>{o.text}</span></div>)}</div>; })();
                    if (bType === 'statement') return <div key={i} style={{ marginBottom: 12 }}><div style={{ background: `rgba(${T.rgb},.04)`, borderRadius: 16, padding: '16px 14px', border: `1px solid rgba(${T.rgb},.1)`, marginBottom: 14, textAlign: 'center' }}><p style={{ fontStyle: 'italic', fontSize: '1rem', color: T.text, margin: 0, lineHeight: 1.6 }}>"{b.quote}"</p></div><h3 style={{ fontSize: '1rem', fontWeight: 700, textAlign: 'center', marginBottom: 10, color: T.text }}>{b.text}</h3>{(b.options || []).map((o, oi) => <div key={oi} style={{ ...S.optionCard(answers[pageIndex] === oi), marginBottom: 6 }} onClick={() => { setAnswers(a => ({ ...a, [pageIndex]: oi })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, optionIndex: oi }); setTimeout(advancePage, 400); }}><span style={{ flex: 1 }}>{typeof o === 'string' ? o : o.text}</span></div>)}</div>;
                    if (bType === 'capture') return <div key={i} style={{ marginBottom: 12 }}><h3 style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>{b.title}</h3>{b.subtitle && <p style={{ textAlign: 'center', color: T.textSec, fontSize: '0.85rem', marginBottom: 14 }}>{b.subtitle}</p>}<form onSubmit={e => { e.preventDefault(); saveLead(quiz.id, { ...leadData, answers, date: new Date().toISOString() }); recordEvent(quiz.id, 'complete'); advancePage(); }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{(b.fields || ['name', 'email']).includes('name') && <input style={{ padding: '12px 16px', borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: '0.9rem', outline: 'none' }} placeholder="Seu nome" value={leadData.name} onChange={e => setLeadData(d => ({ ...d, name: e.target.value }))} />}{(b.fields || ['name', 'email']).includes('email') && <input type="email" required style={{ padding: '12px 16px', borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: '0.9rem', outline: 'none' }} placeholder="Seu email" value={leadData.email} onChange={e => setLeadData(d => ({ ...d, email: e.target.value }))} />}<button type="submit" style={S.btn(!leadData.email)}>{b.buttonText || 'Continuar →'}</button></form></div>;
                    if (bType === 'bmi') return <BMIBlock key={i} page={b} pages={pages} answers={answers} T={T} onDone={advancePage} />;
                    if (bType === 'scroll-picker') return <ScrollPickerBlock key={i} page={b} T={T} onDone={(val) => { setAnswers(a => ({ ...a, [pageIndex]: val })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, value: val }); advancePage(); }} />;
                    if (bType === 'number-input') return <NumberInputBlock key={i} page={b} T={T} onDone={(val) => { setAnswers(a => ({ ...a, [pageIndex]: val })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, value: val }); advancePage(); }} />;
                    if (bType === 'result') return <AIResultBlock key={i} page={b} quiz={quiz} answers={answers} pages={pages} T={T} />;
                    if (bType === 'video-response') return <div key={i} style={{ marginBottom: 12 }}><h3 style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', marginBottom: 12, color: T.text }}>{b.text}</h3>{b.videoUrl ? <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 16, overflow: 'hidden', marginBottom: 12, background: '#000' }}><iframe src={b.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen /></div> : <div style={{ height: 180, background: '#1a1a2e', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 48, marginBottom: 12 }}>🎬</div>}{(b.options || []).map((opt, oi) => <div key={oi} style={S.optionCard(false)} onClick={() => { setAnswers(a => ({ ...a, [pageIndex]: oi })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, optionIndex: oi }); setTimeout(advancePage, 400); }}><span style={{ flex: 1 }}>{typeof opt === 'string' ? opt : opt.text}</span></div>)}</div>;
                    if (bType === 'audio') return <div key={i} style={{ marginBottom: 12 }}>{b.senderName && <p style={{ fontWeight: 600, fontSize: '0.85rem', color: T.text, marginBottom: 6 }}>{b.senderName}</p>}{b.audioUrl ? <audio controls style={{ width: '100%', borderRadius: 12 }} src={b.audioUrl} /> : <div style={{ height: 60, background: T.insightBg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: T.textMuted }}>🔊 Áudio não configurado</div>}</div>;
                    if (bType === 'logo') return <div key={i} style={{ textAlign: 'center', marginBottom: 12 }}>{b.imageUrl ? <img src={b.imageUrl} alt={b.alt || 'Logo'} style={{ maxWidth: b.maxWidth || 120, height: 'auto' }} /> : <div style={{ fontSize: 32, color: T.textMuted }}>◎</div>}</div>;
                    if (bType === 'spacer') return <div key={i} style={{ height: b.height || 40 }} />;
                    if (bType === 'welcome') return <div key={i} style={{ textAlign: b.textAlign || 'center', marginBottom: 12 }}>{b.imageUrl && b.imagePosition === 'top' && <img src={b.imageUrl} alt="" style={{ width: `${b.imageWidth || 100}%`, height: b.imageHeightPx || 200, objectFit: 'cover', borderRadius: 16, marginBottom: 12 }} />}{b.emoji && <div style={{ fontSize: 48, marginBottom: 8 }}>{b.emoji}</div>}{b.headline && <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: T.text, marginBottom: 6 }}>{b.headline}</h2>}{b.subtitle && <p style={{ color: T.textSec, fontSize: '0.9rem' }}>{b.subtitle}</p>}{b.imageUrl && b.imagePosition !== 'top' && <img src={b.imageUrl} alt="" style={{ width: `${b.imageWidth || 100}%`, height: b.imageHeightPx || 200, objectFit: 'cover', borderRadius: 16, marginTop: 12 }} />}</div>;
                    if (bType === 'notification') return <div key={i} style={{ background: T.card, borderRadius: 14, padding: '14px 16px', border: `1px solid ${T.border}`, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}><span style={{ fontSize: 24 }}>{b.icon || '🔔'}</span><div><div style={{ fontWeight: 700, fontSize: '0.9rem', color: T.text }}>{b.title}</div><div style={{ fontSize: '0.82rem', color: T.textSec }}>{b.text}</div></div></div>;
                    if (bType === 'level') return <div key={i} style={{ marginBottom: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontWeight: 700, fontSize: '0.9rem', color: T.text }}>{b.title}</span><span style={{ fontWeight: 700, fontSize: '0.85rem', color: b.color || T.primary }}>{b.label}</span></div><div style={{ height: 10, borderRadius: 5, background: T.border }}><div style={{ height: '100%', width: `${((b.value || 0) / (b.maxValue || 5)) * 100}%`, borderRadius: 5, background: b.color || T.primary, transition: 'width 0.5s' }} /></div></div>;
                    if (bType === 'faq') return <div key={i} style={{ marginBottom: 12 }}>{b.title && <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 10, color: T.text }}>{b.title}</h3>}{(b.items || []).map((item, fi) => <details key={fi} style={{ borderBottom: `1px solid ${T.border}`, padding: '10px 0' }}><summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: T.text }}>{item.q}</summary><p style={{ fontSize: '0.85rem', color: T.textSec, margin: '8px 0 0', lineHeight: 1.6 }}>{item.a}</p></details>)}</div>;
                    if (bType === 'carousel') return <div key={i} style={{ marginBottom: 12 }}>{b.title && <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 10, color: T.text }}>{b.title}</h3>}<div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>{(b.slides || []).map((slide, si) => <div key={si} style={{ minWidth: 200, flex: '0 0 auto', borderRadius: 14, overflow: 'hidden', border: `1px solid ${T.border}`, background: T.card }}>{slide.image && <img src={slide.image} alt="" style={{ width: '100%', height: 120, objectFit: 'cover' }} />}<div style={{ padding: '10px 12px', fontSize: '0.85rem', color: T.text }}>{slide.text}</div></div>)}</div></div>;
                    if (bType === 'single-choice') return <div key={i} style={{ marginBottom: 12 }}><h3 style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', marginBottom: 12, color: T.text }}>{b.text}</h3>{(b.options || []).map((opt, oi) => <div key={oi} style={S.optionCard(false)} onClick={() => { setAnswers(a => ({ ...a, [pageIndex]: oi })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, optionIndex: oi }); setTimeout(advancePage, 400); }}><span style={{ flex: 1 }}>{typeof opt === 'string' ? opt : opt.text}</span></div>)}</div>;
                    if (bType === 'weight-picker') return <ScrollPickerBlock key={i} page={b} T={T} onDone={(val) => { setAnswers(a => ({ ...a, [pageIndex]: val })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, value: val }); advancePage(); }} />;
                    if (bType === 'email-input' || bType === 'phone-input' || bType === 'textarea-input' || bType === 'date-input') { const inputType = bType === 'email-input' ? 'email' : bType === 'phone-input' ? 'tel' : bType === 'date-input' ? 'date' : 'text'; return <div key={i} style={{ marginBottom: 12 }}><h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 10, color: T.text }}>{b.text}</h3>{bType === 'textarea-input' ? <textarea style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: '0.9rem', outline: 'none', minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }} placeholder={b.placeholder} onChange={e => setLeadData(d => ({ ...d, [bType]: e.target.value }))} /> : <input type={inputType} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} placeholder={b.placeholder} onChange={e => setLeadData(d => ({ ...d, [bType]: e.target.value }))} />}</div>; }
                    if (bType === 'html-script') return <div key={i} style={{ marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: b.code || '' }} />;
                    if (bType === 'metrics') return <div key={i} style={{ background: T.card, borderRadius: 16, padding: '18px 16px', border: `1px solid ${T.border}`, marginBottom: 12, textAlign: 'center' }}><h3 style={{ fontSize: '1rem', fontWeight: 700, color: T.text, marginBottom: 4 }}>{b.title}</h3><p style={{ fontSize: '0.85rem', color: T.textSec }}>{b.text}</p></div>;
                    return <div key={i} style={{ marginBottom: 12, color: T.textSec, fontSize: '0.9rem' }}>{b.text || b.content || b.title || ''}</div>;
                  };
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {p.blocks.map((b, i) => renderBlock(b, i))}
                      {!hasInteractive && <button style={S.btn(false)} onClick={advancePage}>Continuar</button>}
                    </div>
                  );
                }

                // Text block
                if (type === 'text') {
                  const v = p.variant || 'body';
                  const sz = v === 'headline' ? '1.6rem' : v === 'subheadline' ? '1.2rem' : v === 'caption' ? '0.8rem' : '1rem';
                  const fw = (v === 'headline' || v === 'subheadline') ? 800 : p.bold ? 700 : 400;
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {p.imageUrl && <img src={p.imageUrl} alt="" style={{ width: '100%', borderRadius: 16, marginBottom: 16, maxHeight: 220, objectFit: 'cover' }} />}
                      <div style={{ fontSize: sz, fontWeight: fw, lineHeight: 1.6, color: p.textColor || T.text, textAlign: p.align || 'left', fontStyle: p.italic ? 'italic' : 'normal', textDecoration: p.underline ? 'underline' : 'none', whiteSpace: 'pre-wrap', flex: 1 }}>
                        {p.content || ''}
                      </div>
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // Button block
                if (type === 'button') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <button style={{ ...S.btn(false), maxWidth: 400 }} onClick={() => { if (p.url) window.open(p.url, '_blank'); else advancePage(); }}>
                        {p.text || 'Continuar →'}
                      </button>
                    </div>
                  );
                }

                // Image block
                if (type === 'image') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {p.imageUrl ? <img src={p.imageUrl} alt={p.alt || ''} style={{ width: '100%', borderRadius: 16, maxHeight: 300, objectFit: 'cover', marginBottom: 12 }} /> : <div style={{ width: '100%', height: 200, background: T.insightBg, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, marginBottom: 12 }}>🖼️</div>}
                      {p.caption && <p style={{ textAlign: 'center', fontSize: '0.85rem', color: T.textSec }}>{p.caption}</p>}
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // Video block
                if (type === 'video') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {p.videoUrl ? <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 16, overflow: 'hidden', marginBottom: 16, background: '#000' }}><iframe src={p.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen /></div> : <div style={{ height: 200, background: '#1a1a2e', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 48, marginBottom: 16 }}>🎬</div>}
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // Capture (lead form)
                if (type === 'capture') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, textAlign: 'center', marginBottom: 8, color: T.text }}>{p.title || 'Quase lá!'}</h2>
                      {p.subtitle && <p style={{ textAlign: 'center', color: T.textSec, fontSize: '0.9rem', marginBottom: 20 }}>{p.subtitle}</p>}
                      <form onSubmit={(e) => { e.preventDefault(); saveLead(quiz.id, { ...leadData, answers, date: new Date().toISOString() }); recordEvent(quiz.id, 'complete'); advancePage(); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(p.fields || ['name', 'email']).includes('name') && <input style={{ padding: '14px 18px', borderRadius: 14, border: `1.5px solid ${T.border}`, fontSize: '0.95rem', outline: 'none' }} placeholder="Seu nome" value={leadData.name} onChange={e => setLeadData(d => ({ ...d, name: e.target.value }))} />}
                        {(p.fields || ['name', 'email']).includes('email') && <input type="email" style={{ padding: '14px 18px', borderRadius: 14, border: `1.5px solid ${T.border}`, fontSize: '0.95rem', outline: 'none' }} placeholder="Seu email" value={leadData.email} onChange={e => setLeadData(d => ({ ...d, email: e.target.value }))} required />}
                        <button type="submit" style={S.btn(!leadData.email)}>{p.buttonText || 'Continuar →'}</button>
                      </form>
                    </div>
                  );
                }

                // Alert block
                if (type === 'alert') {
                  const colors = { danger: '#ef4444', warning: '#f59e0b', success: '#10b981', info: T.primary };
                  const c = colors[p.alertType] || T.primary;
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ background: `${c}10`, border: `1px solid ${c}30`, borderRadius: 16, padding: '20px 18px', marginBottom: 16, textAlign: 'center' }}>
                        {p.emoji && <div style={{ fontSize: 32, marginBottom: 8 }}>{p.emoji}</div>}
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: c, marginBottom: 6 }}>{p.title}</h3>
                        <p style={{ color: T.textSec, fontSize: '0.9rem', margin: 0 }}>{p.text}</p>
                      </div>
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // Timer block
                if (type === 'timer') {
                  return <TimerBlock duration={p.duration} title={p.title} T={T} onDone={advancePage} />;
                }

                // Loading block
                if (type === 'loading') {
                  return <LoadingBlock title={p.title} items={p.items} T={T} onDone={advancePage} />;
                }

                // Progress bar block
                if (type === 'progress-bar') {
                  return <ProgressBarBlock title={p.title} items={p.items} duration={p.duration} T={T} onDone={advancePage} />;
                }

                // Risk chart block
                if (type === 'risk-chart') {
                  return <RiskChartBlock title={p.title} labels={p.labels} userPosition={p.userPosition} duration={p.duration} T={T} onDone={advancePage} />;
                }

                // Price block
                if (type === 'price') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ background: T.card, borderRadius: 20, padding: '24px 20px', border: `1px solid ${T.border}`, boxShadow: '0 4px 20px rgba(0,0,0,.06)', marginBottom: 16 }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, textAlign: 'center', marginBottom: 12, color: T.text }}>{p.title}</h3>
                        {p.originalPrice && <div style={{ textAlign: 'center', fontSize: '0.9rem', color: T.textMuted, textDecoration: 'line-through' }}>{p.originalPrice}</div>}
                        <div style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 800, color: T.primary, margin: '4px 0' }}>{p.price}</div>
                        {p.discount && <div style={{ textAlign: 'center', padding: '4px 12px', borderRadius: 8, background: `rgba(${T.rgb},.1)`, color: T.primary, fontSize: '0.8rem', fontWeight: 700, display: 'inline-block', margin: '8px auto' }}>{p.discount}</div>}
                        {(p.features || []).length > 0 && <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>{p.features.map((f, i) => <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', fontSize: '0.88rem', color: T.textSec }}><span style={{ color: T.primary }}>✓</span>{f}</li>)}</ul>}
                      </div>
                      <button style={S.btn(false)} onClick={() => { recordEvent(quiz.id, 'cta_click'); if (p.ctaUrl) window.open(p.ctaUrl, '_blank'); else advancePage(); }}>{p.cta || 'Continuar'}</button>
                    </div>
                  );
                }

                // Testimonial block
                if (type === 'testimonial') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ background: T.card, borderRadius: 20, padding: '20px 18px', border: `1px solid ${T.border}`, marginBottom: 16 }}>
                        <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>{Array.from({ length: p.rating || 5 }, (_, i) => <span key={i} style={{ fontSize: 16 }}>⭐</span>)}</div>
                        <p style={{ fontSize: '0.95rem', color: T.textSec, fontStyle: 'italic', lineHeight: 1.6, margin: '0 0 12px' }}>"{p.text}"</p>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: T.text }}>{p.name}</span>
                      </div>
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // Arguments block
                if (type === 'arguments') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 16, color: T.text }}>{p.title}</h3>
                      <ul style={{ listStyle: 'none', padding: 0, flex: 1 }}>{(p.items || []).map((item, i) => <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${T.border}`, fontSize: '0.95rem', color: T.textSec }}><span style={{ fontSize: 18 }}>{p.emoji || '✅'}</span>{item}</li>)}</ul>
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // Chart block (animated bar visualization)
                if (type === 'chart') {
                  const chartColor = p.chartColor || T.primary;
                  const chartData = p.data || [];
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <style>{`
                        @keyframes chartBarGrow { from { width: 0%; } }
                        @keyframes chartValueFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
                      `}</style>
                      {p.title && <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16, color: T.text }}>{p.title}</h3>}
                      <div style={{ flex: 1 }}>{chartData.map((d, i) => (
                        <div key={i} style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 5 }}>
                            <span style={{ color: T.text, fontWeight: 500 }}>{d.label}</span>
                            <span style={{ color: chartColor, fontWeight: 700, animation: `chartValueFade 0.6s ease ${0.3 + i * 0.2}s both` }}>{d.value}%</span>
                          </div>
                          <div style={{ height: 10, borderRadius: 5, background: T.border, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${d.value}%`,
                              borderRadius: 5,
                              background: `linear-gradient(90deg, ${chartColor}, ${chartColor}cc)`,
                              animation: `chartBarGrow 1.2s cubic-bezier(0.25,0.46,0.45,0.94) ${i * 0.2}s both`,
                            }} />
                          </div>
                        </div>
                      ))}</div>
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // BMI block
                if (type === 'bmi') {
                  return <BMIBlock page={p} pages={pages} answers={answers} T={T} onDone={advancePage} />;
                }

                // Scroll picker block (drum roller)
                if (type === 'scroll-picker') {
                  return <ScrollPickerBlock page={p} T={T} onDone={(val) => { setAnswers(a => ({ ...a, [pageIndex]: val })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, value: val }); advancePage(); }} />;
                }

                // Number input block
                if (type === 'number-input') {
                  return <NumberInputBlock page={p} T={T} onDone={(val) => { setAnswers(a => ({ ...a, [pageIndex]: val })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, value: val }); advancePage(); }} />;
                }

                // Result block (AI diagnosis)
                if (type === 'result') {
                  return <AIResultBlock page={p} quiz={quiz} answers={answers} pages={pages} T={T} />;
                }

                // Fallback for any unknown type — also handle yes-no and before-after as standalone
                if (type === 'yes-no') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, textAlign: 'center', marginBottom: 24, color: T.text, lineHeight: 1.5 }}>{p.text}</h2>
                      <div style={{ display: 'flex', gap: 14, flex: 1, alignItems: 'center' }}>
                        {[{ label: p.yesLabel || 'Sim', emoji: p.yesEmoji || '✅', val: 'yes' }, { label: p.noLabel || 'Não', emoji: p.noEmoji || '🚫', val: 'no' }].map((opt, oi) => (
                          <div key={oi} style={{ flex: 1, padding: '24px 16px', borderRadius: 18, border: `2px solid ${answers[pageIndex] === opt.val ? T.primary : T.border}`, background: answers[pageIndex] === opt.val ? `rgba(${T.rgb},.06)` : T.card, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}
                            onClick={() => { setAnswers(a => ({ ...a, [pageIndex]: opt.val })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, value: opt.val }); setTimeout(advancePage, 400); }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{opt.emoji}</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: T.text }}>{opt.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (type === 'before-after') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, textAlign: 'center', marginBottom: 16, color: T.text }}>{p.title}</h2>
                      <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                        {[{ label: p.beforeLabel || 'Antes', img: p.beforeImage, color: '#ef4444' }, { label: p.afterLabel || 'Depois', img: p.afterImage, color: '#22c55e' }].map((side, si) => (
                          <div key={si} style={{ flex: 1, borderRadius: 16, overflow: 'hidden', border: `2px solid ${side.color}20`, background: T.card, boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
                            {side.img ? <img src={side.img} alt={side.label} style={{ width: '100%', height: 150, objectFit: 'cover' }} /> : <div style={{ width: '100%', height: 150, background: `${side.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>{si === 0 ? '😔' : '😊'}</div>}
                            <div style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: '0.88rem', color: side.color, background: `${side.color}08` }}>{side.label}</div>
                          </div>
                        ))}
                      </div>
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // Audio block
                if (type === 'audio') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {p.senderName && <p style={{ fontWeight: 600, fontSize: '0.95rem', color: T.text, marginBottom: 10 }}>{p.senderName}</p>}
                      {p.audioUrl ? <audio controls style={{ width: '100%', borderRadius: 12, marginBottom: 16 }} src={p.audioUrl} /> : <div style={{ height: 80, background: T.insightBg, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: T.textMuted, marginBottom: 16 }}>🔊 Áudio não configurado</div>}
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // Logo block
                if (type === 'logo') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      {p.imageUrl ? <img src={p.imageUrl} alt={p.alt || 'Logo'} style={{ maxWidth: p.maxWidth || 120, height: 'auto', marginBottom: 16 }} /> : <div style={{ fontSize: 48, color: T.textMuted, marginBottom: 16 }}>◎</div>}
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // Spacer block
                if (type === 'spacer') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ height: p.height || 40 }} />
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // Notification block
                if (type === 'notification') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ background: T.card, borderRadius: 16, padding: '18px 20px', border: `1px solid ${T.border}`, display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.1)', marginBottom: 16 }}>
                        <span style={{ fontSize: 28 }}>{p.icon || '🔔'}</span>
                        <div><div style={{ fontWeight: 700, fontSize: '0.95rem', color: T.text }}>{p.title}</div><div style={{ fontSize: '0.85rem', color: T.textSec, marginTop: 2 }}>{p.text}</div></div>
                      </div>
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // Level block
                if (type === 'level') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontWeight: 700, fontSize: '1rem', color: T.text }}>{p.title}</span><span style={{ fontWeight: 700, fontSize: '0.9rem', color: p.color || T.primary }}>{p.label}</span></div>
                        <div style={{ height: 12, borderRadius: 6, background: T.border }}><div style={{ height: '100%', width: `${((p.value || 0) / (p.maxValue || 5)) * 100}%`, borderRadius: 6, background: p.color || T.primary, transition: 'width 0.5s' }} /></div>
                      </div>
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // FAQ block
                if (type === 'faq') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {p.title && <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 16, color: T.text }}>{p.title}</h2>}
                      <div style={{ flex: 1 }}>{(p.items || []).map((item, i) => <details key={i} style={{ borderBottom: `1px solid ${T.border}`, padding: '12px 0' }}><summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', color: T.text }}>{item.q}</summary><p style={{ fontSize: '0.88rem', color: T.textSec, margin: '8px 0 0', lineHeight: 1.6 }}>{item.a}</p></details>)}</div>
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // Carousel block
                if (type === 'carousel') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {p.title && <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 16, color: T.text }}>{p.title}</h2>}
                      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 10, flex: 1 }}>{(p.slides || []).map((slide, i) => <div key={i} style={{ minWidth: 220, flex: '0 0 auto', borderRadius: 16, overflow: 'hidden', border: `1px solid ${T.border}`, background: T.card }}>{slide.image && <img src={slide.image} alt="" style={{ width: '100%', height: 140, objectFit: 'cover' }} />}<div style={{ padding: '12px 14px', fontSize: '0.9rem', color: T.text }}>{slide.text}</div></div>)}</div>
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // Weight picker
                if (type === 'weight-picker') {
                  return <ScrollPickerBlock page={p} T={T} onDone={(val) => { setAnswers(a => ({ ...a, [pageIndex]: val })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, value: val }); advancePage(); }} />;
                }

                // Form input types
                if (['email-input', 'phone-input', 'textarea-input', 'date-input'].includes(type)) {
                  const inputType = type === 'email-input' ? 'email' : type === 'phone-input' ? 'tel' : type === 'date-input' ? 'date' : 'text';
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, textAlign: 'center', marginBottom: 16, color: T.text }}>{p.text}</h2>
                      {type === 'textarea-input' ? (
                        <textarea style={{ width: '100%', padding: '14px 18px', borderRadius: 14, border: `1.5px solid ${T.border}`, fontSize: '0.95rem', outline: 'none', minHeight: 100, resize: 'vertical', boxSizing: 'border-box', background: T.card, color: T.text }} placeholder={p.placeholder} onChange={e => setLeadData(d => ({ ...d, [type]: e.target.value }))} />
                      ) : (
                        <input type={inputType} style={{ width: '100%', padding: '14px 18px', borderRadius: 14, border: `1.5px solid ${T.border}`, fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', background: T.card, color: T.text }} placeholder={p.placeholder} onChange={e => setLeadData(d => ({ ...d, [type]: e.target.value }))} />
                      )}
                      <button style={{ ...S.btn(false), marginTop: 16 }} onClick={() => { recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, value: leadData[type] || '' }); advancePage(); }}>Continuar</button>
                    </div>
                  );
                }

                // Metrics block
                if (type === 'metrics') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ background: T.card, borderRadius: 20, padding: '24px 20px', border: `1px solid ${T.border}`, marginBottom: 16, textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: T.text, marginBottom: 6 }}>{p.title}</h2>
                        <p style={{ fontSize: '0.9rem', color: T.textSec }}>{p.text}</p>
                      </div>
                      <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                    </div>
                  );
                }

                // HTML/Script block — cloned pages with full HTML
                if (type === 'html-script') {
                  return <ClonedPageBlock html={p.code || ''} fullCode={p.fullCode || ''} onAdvance={advancePage} btnStyle={S.btn(false)} buttonActions={p.buttonActions} pixelCode={p.pixelCode} clonePageType={p.clonePageType} quizId={quiz?.id} pageIndex={pageIndex} setAnswers={setAnswers} />;
                }

                // Fallback for truly unknown types
                return (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: T.textSec, fontSize: '0.9rem' }}>{p.text || p.content || p.title || ''}</p>
                    <button style={S.btn(false)} onClick={advancePage}>Continuar</button>
                  </div>
                );
              })()}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
