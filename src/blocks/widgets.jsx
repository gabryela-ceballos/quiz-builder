// widgets.jsx — animated/interactive quiz widgets shared by the Player and the v2 block renderer
import { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

// ═══ PARTICLES (result animation) ═══
// ═══ TIMER COMPONENT ═══
export function TimerBlock({ duration, title, T, onDone }) {
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
export function LoadingBlock({ title, items, T, onDone }) {
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
export function ProgressBarBlock({ title, items, duration, T, onDone }) {
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
export function RiskChartBlock({ title, labels, userPosition, duration, T, onDone }) {
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
export function ScrollPickerBlock({ page, T, onDone }) {
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
export function NumberInputBlock({ page, T, onDone }) {
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
export function BMIBlock({ page, pages, answers, T, onDone }) {
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
export function AIResultBlock({ page, quiz, answers, pages, T }) {
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

    if (answeredQuestions.length === 0) {
      setDiagnosis({
        headline: 'Identificamos um padrão importante nas suas respostas',
        body: 'Com base no que você respondeu, seu perfil indica oportunidades reais de melhoria. A boa notícia? Existe um método comprovado que já ajudou milhares de pessoas na mesma situação.',
      });
      setTimeout(() => setPhase('result'), 2500);
      return;
    }

    try {
      const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
      const res = await fetch(`${API_BASE}/api/ai/diagnosis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answeredQuestions, productContext: page.productContext || '', productName: page.productName || '' }),
      });
      const json = await res.json();
      if (!res.ok || !json.headline) throw new Error(json.error || 'diagnosis failed');
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

export function Particles({ emoji, rgb, count = 10 }) {
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
export const CSS = `
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

export const pageAnim = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.35, ease: 'easeOut' } };

