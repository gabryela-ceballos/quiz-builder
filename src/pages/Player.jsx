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

// ═══ SCROLL PICKER BLOCK (drum roller) ═══
function ScrollPickerBlock({ page, T, onDone }) {
  const min = page.min || 140;
  const max = page.max || 210;
  const unit = page.unit || 'cm';
  const [value, setValue] = useState(page.defaultValue || Math.round((min + max) / 2));
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const lastY = useRef(0);

  const items = [];
  for (let i = min; i <= max; i += (page.step || 1)) items.push(i);

  const handleWheel = (e) => {
    e.preventDefault();
    setValue(v => Math.max(min, Math.min(max, v + (e.deltaY > 0 ? 1 : -1))));
  };

  const handlePointerDown = (e) => { isDragging.current = true; lastY.current = e.clientY; };
  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const dy = lastY.current - e.clientY;
    if (Math.abs(dy) > 12) {
      setValue(v => Math.max(min, Math.min(max, v + (dy > 0 ? 1 : -1))));
      lastY.current = e.clientY;
    }
  };
  const handlePointerUp = () => { isDragging.current = false; };

  useEffect(() => {
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => { document.removeEventListener('pointermove', handlePointerMove); document.removeEventListener('pointerup', handlePointerUp); };
  }, []);

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

      <button style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: T.primary, color: T.onPrimary || '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginTop: 'auto', marginBottom: 24, boxShadow: `0 4px 16px rgba(${T.rgb},.25)` }}
        onClick={() => onDone(value)}>
        Continuar
      </button>
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

  useEffect(() => {
    // Find height and weight from previous answers
    let height = null, weight = null;
    pages.forEach((p, i) => {
      if (answers[i] === undefined) return;
      const checkBlock = (b) => {
        if (b.type === 'scroll-picker' && (b.unit === 'cm' || (b.text || '').toLowerCase().includes('altura'))) height = answers[i];
        if (b.type === 'number-input' && (b.unit === 'kg' || (b.text || '').toLowerCase().includes('peso'))) weight = answers[i];
      };
      if (p.type === 'scroll-picker' || p.type === 'number-input') checkBlock(p);
      if (p.blocks) p.blocks.forEach(checkBlock);
    });

    // Fallback if not found
    if (!height) height = 170;
    if (!weight) weight = 70;

    const calculated = weight / ((height / 100) ** 2);
    setBmi(Math.round(calculated * 10) / 10);
    setTimeout(() => setPhase('result'), 2200);
  }, []);

  if (phase === 'calculating') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid ${T.border}`, borderTopColor: T.primary, animation: 'spin 1s linear infinite', marginBottom: 20 }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: T.text, marginBottom: 8 }}>Calculando seu IMC...</h3>
        <p style={{ color: T.textSec, fontSize: '0.85rem' }}>Analisando altura e peso</p>
      </div>
    );
  }

  const zones = [
    { label: 'Abaixo do peso', min: 0, max: 18.5, color: '#3b82f6', emoji: '🔵' },
    { label: 'Peso normal', min: 18.5, max: 25, color: '#22c55e', emoji: '🟢' },
    { label: 'Sobrepeso', min: 25, max: 30, color: '#f59e0b', emoji: '🟡' },
    { label: 'Obesidade', min: 30, max: 45, color: '#ef4444', emoji: '🔴' },
  ];
  const currentZone = zones.find(z => bmi >= z.min && bmi < z.max) || zones[zones.length - 1];
  const pct = Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100));

  const texts = {
    'Abaixo do peso': 'Seu IMC indica que você está abaixo do peso ideal. Isso pode afetar sua energia, imunidade e bem-estar. Uma alimentação adequada e acompanhamento profissional podem ajudar.',
    'Peso normal': 'Seu IMC está na faixa considerada saudável. No entanto, manter esse equilíbrio requer atenção contínua à alimentação e atividade física.',
    'Sobrepeso': 'Seu IMC indica sobrepeso, o que pode aumentar o risco de problemas de saúde como diabetes e hipertensão. Pequenas mudanças nos hábitos podem fazer grande diferença.',
    'Obesidade': 'Seu IMC indica obesidade, condição que requer atenção especial. É importante buscar orientação para melhorar sua qualidade de vida e prevenir complicações.',
  };

  // Bar chart data
  const chartBars = [
    { label: 'Seu IMC', value: bmi, color: currentZone.color },
    { label: 'Ideal mín', value: 18.5, color: '#22c55e' },
    { label: 'Ideal máx', value: 25, color: '#22c55e' },
  ];
  const chartMax = Math.max(bmi, 35);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* BMI Value */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: T.text, margin: '0 0 8px' }}>{page.title || 'Seu IMC'}</h2>
        <div style={{ fontSize: '2.8rem', fontWeight: 800, color: currentZone.color, lineHeight: 1 }}>{bmi}</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 14px', borderRadius: 20, background: `${currentZone.color}15`, border: `1px solid ${currentZone.color}30` }}>
          <span>{currentZone.emoji}</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: currentZone.color }}>{currentZone.label}</span>
        </div>
      </div>

      {/* Gauge */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', height: 14, borderRadius: 10, overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.08)' }}>
          {zones.map((z, i) => <div key={i} style={{ flex: 1, background: z.color, opacity: z === currentZone ? 1 : 0.5 }} />)}
        </div>
        <div style={{ position: 'relative', height: 16, marginTop: -4 }}>
          <div style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', transition: 'left 0.8s ease' }}>
            <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: `8px solid ${currentZone.color}`, margin: '0 auto' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          {zones.map((z, i) => <span key={i} style={{ fontSize: '0.6rem', color: z.color, fontWeight: 600 }}>{z.label}</span>)}
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ background: T.card, borderRadius: 16, padding: '14px 14px 10px', border: `1px solid ${T.border}`, marginBottom: 16 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: T.text, marginBottom: 10 }}>Comparação</div>
        {chartBars.map((bar, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '0.7rem', width: 60, color: T.textSec, flexShrink: 0 }}>{bar.label}</span>
            <div style={{ flex: 1, height: 18, borderRadius: 6, background: `${T.border}50`, overflow: 'hidden', position: 'relative' }}>
              <div style={{ height: '100%', width: `${(bar.value / chartMax) * 100}%`, background: bar.color, borderRadius: 6, transition: 'width 1s ease', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#fff' }}>{bar.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Text */}
      <div style={{ background: `${currentZone.color}08`, borderRadius: 14, padding: '14px 14px', border: `1px solid ${currentZone.color}20`, marginBottom: 16 }}>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.7, color: T.textSec, margin: 0 }}>{texts[currentZone.label]}</p>
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
`;

const pageAnim = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.35, ease: 'easeOut' } };

// ═══ MAIN COMPONENT ═══
export default function Player() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [screen, setScreen] = useState('welcome');
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [multiSelect, setMultiSelect] = useState([]);
  const [leadData, setLeadData] = useState({ name: '', email: '' });
  const [result, setResult] = useState(null);
  const [optionAnim, setOptionAnim] = useState(null);

  useEffect(() => { getQuiz(id).then(q => { if (!q) navigate('/'); else setQuiz(q); }); }, [id]);

  const T = useMemo(() => quiz ? buildTheme(quiz) : null, [quiz]);
  const ne = useMemo(() => quiz ? getNicheEmojis(quiz.niche) : NE.outro, [quiz]);

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
      if (isPageBuilder) { setScreen('done'); recordEvent(quiz.id, 'complete'); }
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
      if (isPageBuilder) { setScreen('done'); recordEvent(quiz.id, 'complete'); }
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
  const handleCTA = () => { recordEvent(quiz.id, 'cta_click'); const url = result?.result?.ctaUrl; if (url) window.open(url, '_blank'); };
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
  const welcomeBlock = pages[0]?.type === 'welcome' ? pages[0] : (pages[0]?.type === 'compound' && pages[0]?.blocks?.[0]?.type === 'welcome' ? pages[0].blocks[0] : null);
  const startQuiz = () => { setScreen('playing'); setPageIndex(welcomeBlock ? 1 : 0); recordEvent(quiz.id, 'start'); };

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
  const isChoice = ['choice', 'picker', 'age-choice'].includes(currentPage.type);
  const phaseEmoji = ne.phases[sectionIdx] || '💭';

  return (
    <div style={S.container}>
      <style>{CSS.replace(/var\(--qp-rgb\)/g, T.rgb)}</style>
      <div style={S.inner}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '16px 0 6px' }}>
          {pageIndex > 0 && <button style={{ position: 'absolute', left: 0, background: 'none', border: 'none', cursor: 'pointer', color: T.text, padding: 8 }} onClick={goBack}><ChevronLeft size={24} /></button>}
          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: T.text, letterSpacing: '.01em' }}>
            {isInsight || isSP ? (quiz.name?.replace('Quiz: ', '') || 'Quiz') : `${phaseEmoji} ${label}`}
          </span>
        </div>

        {/* Phase indicator + Progress */}
        {!isInsight && !isSP && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: '0.72rem', color: T.textMuted, textAlign: 'center', marginBottom: 8, fontWeight: 500 }}>
              Fase {sectionIdx + 1} de {total} — {label}
            </p>
            <div style={{ display: 'flex', gap: 5 }}>
              {sections.map((_, si) => {
                const done = si < sectionIdx;
                const active = si === sectionIdx;
                return (
                  <div key={si} style={{ flex: 1, height: 5, borderRadius: 3, background: done ? T.primary : `rgba(${T.rgb},.12)`, position: 'relative', overflow: 'hidden', transition: 'background .4s' }}>
                    {active && <div className="qp-progress-fill" style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progress * 100}%`, background: T.primary, borderRadius: 3 }} />}
                  </div>
                );
              })}
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
              {!isInsight && !isSP && !isMulti && !isStatement && !isChoice && !isLikert && !isImageSelect && (() => {
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
                    if (bType === 'choice') return <div key={i} style={{ marginBottom: 12 }}><h3 style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', marginBottom: 12, color: T.text }}>{b.text}</h3>{(b.options || []).map((opt, oi) => <div key={oi} style={S.optionCard(false)} onClick={() => { setAnswers(a => ({ ...a, [pageIndex]: oi })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, optionIndex: oi }); setTimeout(advancePage, 400); }}>{typeof opt === 'string' ? opt : <><span style={{ fontSize: '1.3rem' }}>{opt.emoji}</span><span style={{ flex: 1 }}>{opt.text}</span></>}</div>)}</div>;
                    if (bType === 'capture') return <div key={i} style={{ marginBottom: 12 }}><h3 style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>{b.title}</h3>{b.subtitle && <p style={{ textAlign: 'center', color: T.textSec, fontSize: '0.85rem', marginBottom: 14 }}>{b.subtitle}</p>}<form onSubmit={e => { e.preventDefault(); saveLead(quiz.id, { ...leadData, date: new Date().toISOString() }); advancePage(); }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{(b.fields || ['name', 'email']).includes('name') && <input style={{ padding: '12px 16px', borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: '0.9rem', outline: 'none' }} placeholder="Seu nome" value={leadData.name} onChange={e => setLeadData(d => ({ ...d, name: e.target.value }))} />}{(b.fields || ['name', 'email']).includes('email') && <input type="email" required style={{ padding: '12px 16px', borderRadius: 12, border: `1.5px solid ${T.border}`, fontSize: '0.9rem', outline: 'none' }} placeholder="Seu email" value={leadData.email} onChange={e => setLeadData(d => ({ ...d, email: e.target.value }))} />}<button type="submit" style={S.btn(!leadData.email)}>{b.buttonText || 'Continuar →'}</button></form></div>;
                    if (bType === 'bmi') return <BMIBlock key={i} page={b} pages={pages} answers={answers} T={T} onDone={advancePage} />;
                    if (bType === 'scroll-picker') return <ScrollPickerBlock key={i} page={b} T={T} onDone={(val) => { setAnswers(a => ({ ...a, [pageIndex]: val })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, value: val }); advancePage(); }} />;
                    if (bType === 'number-input') return <NumberInputBlock key={i} page={b} T={T} onDone={(val) => { setAnswers(a => ({ ...a, [pageIndex]: val })); recordEvent(quiz.id, 'answer', { questionIndex: pageIndex, value: val }); advancePage(); }} />;
                    if (bType === 'result') return <AIResultBlock key={i} page={b} quiz={quiz} answers={answers} pages={pages} T={T} />;
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
                      <form onSubmit={(e) => { e.preventDefault(); saveLead(quiz.id, { ...leadData, date: new Date().toISOString() }); advancePage(); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                      <button style={S.btn(false)} onClick={() => { if (p.ctaUrl) window.open(p.ctaUrl, '_blank'); else advancePage(); }}>{p.cta || 'Continuar'}</button>
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

                // Chart block (simple bar visualization)
                if (type === 'chart') {
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {p.title && <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16, color: T.text }}>{p.title}</h3>}
                      <div style={{ flex: 1 }}>{(p.data || []).map((d, i) => <div key={i} style={{ marginBottom: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}><span style={{ color: T.text }}>{d.label}</span><span style={{ color: T.primary, fontWeight: 600 }}>{d.value}%</span></div><div style={{ height: 8, borderRadius: 4, background: T.border }}><div style={{ height: '100%', width: `${d.value}%`, borderRadius: 4, background: p.chartColor || T.primary, transition: 'width 0.5s' }} /></div></div>)}</div>
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

                // Fallback for any unknown type
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
