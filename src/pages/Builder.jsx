import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, Check, Copy, Eye, Search, Zap, Link, PenTool } from 'lucide-react';
import DomainSettings from '../components/DomainSettings';
import { generateQuiz, NICHES } from '../utils/quizGenerator';
import { saveQuiz, getQuiz } from '../hooks/useQuizStore';
import { cloneFromUrl } from '../utils/cloneService';

const STEPS = ['Produto', 'Configurar', 'Publicar'];

export default function Builder() {
  const navigate = useNavigate();
  // Auto-detect mode from URL params
  const urlMode = new URLSearchParams(window.location.search).get('mode');
  const [step, setStep] = useState(urlMode === 'ai' ? 0 : -1);
  const [creationMode, setCreationMode] = useState(urlMode === 'ai' ? 'ai' : '');
  const [generating, setGenerating] = useState(false);
  const [genPhase, setGenPhase] = useState('');
  const [genError, setGenError] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [published, setPublished] = useState(null);
  const [copied, setCopied] = useState(false);

  // Step 0 state
  const [product, setProduct] = useState({ name: '', description: '' });
  const [niche, setNiche] = useState('');
  const [questionCount, setQCount] = useState(15);
  const [useConditionals, setUseConditionals] = useState(false);

  // Clone state
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloning, setCloning] = useState(false);
  const [clonePhase, setClonePhase] = useState('');

  const selectMode = (mode) => {
    if (mode === 'builder') { navigate('/builder/page'); return; }
    setCreationMode(mode);
    setStep(0);
  };

  // Clone handler — clones quiz and publishes directly (no config screens)
  const handleClone = async () => {
    if (!cloneUrl.trim()) { alert('Cole a URL!'); return; }
    setCloning(true);
    setGenError('');
    try {
      let clonedQuiz;

      // ── Local quiz URL ──
      const localMatch = cloneUrl.match(/\/q\/([a-z0-9]+)/i);
      if (localMatch) {
        const quizId = localMatch[1];
        setClonePhase('📂 Clonando quiz...');
        const original = await getQuiz(quizId);
        if (!original) throw new Error('Quiz não encontrado. Verifique o link.');
        clonedQuiz = JSON.parse(JSON.stringify(original));
        clonedQuiz.id = undefined; // saveQuiz will generate new ID
        clonedQuiz.name = (clonedQuiz.name || 'Quiz') + ' (Clone)';
        clonedQuiz.createdAt = Date.now();
        clonedQuiz.updatedAt = Date.now();
      } else {
        // ── External URL: AI clone → Player format ──
        clonedQuiz = await cloneFromUrl(cloneUrl, (phase, msg) => setClonePhase(msg || phase));
      }

      // Save & publish directly — no configure screens
      setClonePhase('✅ Publicando clone...');
      const saved = await saveQuiz(clonedQuiz);
      setQuiz(clonedQuiz);
      setPublished(saved);
      setStep(2); // Go straight to "Published!" screen
    } catch (err) {
      setGenError(err.message || 'Erro ao clonar. Verifique o link.');
    } finally {
      setCloning(false);
    }
  };

  // Generate quiz via server-side AI → redirect to PageBuilder
  const handleGenerate = async () => {
    if (!product.name.trim()) { alert('Digite o nome do produto!'); return; }
    if (!niche) { alert('Selecione o nicho!'); return; }

    setGenerating(true);
    setGenError('');
    setGenPhase('analyzing');

    try {
      const apiBase = import.meta.env.DEV ? 'http://localhost:3001' : '';
      const res = await fetch(`${apiBase}/api/generate-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product.name,
          productDescription: product.description,
          niche,
          questionCount,
          useConditionals,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao gerar quiz');
      }

      const q = await res.json();

      // Navigate to PageBuilder with AI-generated data
      navigate('/builder/page', {
        state: {
          cloneData: {
            quizName: q.name || `Quiz: ${product.name}`,
            primaryColor: q.primaryColor || '#2563eb',
            niche: q.niche || niche,
            steps: q.steps || [],
            results: q.results || [],
            welcome: q.welcome,
          },
        },
      });
    } catch (err) {
      setGenError(err.message || 'Erro ao gerar quiz. Tente novamente.');
    } finally {
      setGenerating(false);
      setGenPhase('');
    }
  };

  const handlePublish = async () => {
    const saved = await saveQuiz(quiz);
    setPublished(saved);
    setStep(2);
  };

  const quizLink = published ? `${window.location.origin}/q/${published.id}` : '';
  const copyLink = () => { navigator.clipboard.writeText(quizLink); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const modeCardStyle = (active) => ({
    padding: 28, borderRadius: 16, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
    background: active ? 'rgba(37,99,235,0.06)' : '#fff',
    border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
    flex: 1, minWidth: 180, boxShadow: 'var(--shadow-sm)',
  });

  return (
    <div className="page" style={{ position: 'relative', zIndex: 1 }}>
      <div className="container" style={{ maxWidth: 760 }}>

        {/* ── Mode Selector (step -1) ── */}
        {step === -1 && (
          <div className="animate-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><ArrowLeft size={16} /> Voltar</button>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <h2 style={{ marginBottom: 8 }}>Como você quer criar seu quiz?</h2>
              <p>Escolha o modo de criação que melhor se adapta às suas necessidades.</p>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              <div style={modeCardStyle(false)} onClick={() => selectMode('ai')}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
                <Sparkles size={36} style={{ color: 'var(--primary)', marginBottom: 12 }} />
                <h3 style={{ marginBottom: 6, fontSize: '1.1rem' }}>🤖 Gerar com IA</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>Descreva seu produto e a IA cria o quiz completo automaticamente.</p>
              </div>
              <div style={modeCardStyle(false)} onClick={() => selectMode('clone')}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
                <Link size={36} style={{ color: 'var(--success)', marginBottom: 12 }} />
                <h3 style={{ marginBottom: 6, fontSize: '1.1rem' }}>🔗 Clonar de URL</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>Cole um link de quiz e recrie com nosso gerador. Edite antes de publicar.</p>
              </div>
              <div style={modeCardStyle(false)} onClick={() => selectMode('builder')}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
                <PenTool size={36} style={{ color: 'var(--warning)', marginBottom: 12 }} />
                <h3 style={{ marginBottom: 6, fontSize: '1.1rem' }}>🧱 Page Builder</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>Monte do zero com blocos arrastáveis, imagens e controle total.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Steps 0-2: AI Generator / Clone flow ── */}
        {step >= 0 && (
          <>
            {/* Nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setStep(-1); setCreationMode(''); setGenError(''); }}><ArrowLeft size={16} /> Modos</button>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
                  {STEPS.map((s, i) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
                        background: i === step ? 'var(--primary)' : i < step ? 'rgba(37,99,235,0.1)' : '#f3f4f6',
                        color: i === step ? '#fff' : i < step ? 'var(--primary)' : 'var(--text-muted)',
                        fontSize: '0.8rem', fontWeight: 600
                      }}>
                        {i < step ? <Check size={13} /> : <span style={{ width: 16, height: 16, borderRadius: '50%', background: i === step ? 'rgba(255,255,255,0.3)' : '#e5e7eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>{i + 1}</span>}
                        {s}
                      </div>
                      {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? 'rgba(37,99,235,0.3)' : 'var(--border)', margin: '0 4px' }} />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Step 0: Clone URL input OR AI product form ── */}
            {step === 0 && creationMode === 'clone' && !product.name && (
              <div className="animate-in">
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                  <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔗</div>
                  <h2 style={{ marginBottom: 8 }}>Clonar quiz de URL</h2>
                  <p>Cole o link do quiz que deseja clonar. Nosso IA vai analisar e recriar para você.</p>
                </div>
                <div className="card" style={{ padding: 28 }}>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="label">URL do quiz *</label>
                    <input className="input" style={{ fontSize: '1rem' }} placeholder="https://exemplo.com/quiz/..." value={cloneUrl} onChange={e => setCloneUrl(e.target.value)} />
                  </div>
                  {genError && <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px 16px', borderRadius: 10, marginBottom: 16, color: 'var(--danger)', fontSize: '0.85rem' }}>⚠ {genError}</div>}
                  <button className="btn btn-primary btn-full btn-lg" onClick={handleClone} disabled={cloning}>
                    {cloning ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Loader2 size={18} className="spin" />
                        {clonePhase || 'Iniciando clone...'}
                      </span>
                    ) : (
                      <>🔗 Clonar e Recriar</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 0 && (creationMode === 'ai' || (creationMode === 'clone' && product.name)) && (
              <div className="animate-in">
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                  <div style={{ fontSize: '3rem', marginBottom: 12 }}>{creationMode === 'clone' ? '✅' : '🤖'}</div>
                  <h2 style={{ marginBottom: 8 }}>{creationMode === 'clone' ? 'Quiz clonado! Revise os dados' : 'Descreva seu produto'}</h2>
                  <p>{creationMode === 'clone' ? 'Edite o que quiser antes de gerar com nossa IA.' : 'Nossa IA vai analisar seu produto, definir o tom ideal e criar um quiz completo personalizado.'}</p>
                </div>

                {/* Product info */}
                <div className="card" style={{ padding: 28, marginBottom: 20 }}>
                  <div className="form-group">
                    <label className="label">Nome do produto / serviço *</label>
                    <input className="input" style={{ fontSize: '1rem' }} placeholder="Ex: Yoga em Casa, Mentoria de Vendas, Ebook de Finanças..." value={product.name} onChange={e => setProduct(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">Descreva o produto (melhora muito o resultado!)</label>
                    <textarea className="textarea" placeholder="Ex: Programa de yoga para iniciantes praticado em casa, sem equipamentos, foco em alívio de dores, flexibilidade e bem-estar..." value={product.description} onChange={e => setProduct(p => ({ ...p, description: e.target.value }))} style={{ minHeight: 90 }} />
                  </div>
                </div>

                {/* Niche selector */}
                <div className="card" style={{ padding: 24, marginBottom: 20 }}>
                  <label className="label" style={{ marginBottom: 14 }}>Nicho do produto *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                    {NICHES.map(n => (
                      <button key={n.id} onClick={() => setNiche(n.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
                          border: niche === n.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                          background: niche === n.id ? 'rgba(37,99,235,0.06)' : '#fff',
                          color: niche === n.id ? 'var(--primary)' : 'var(--text-secondary)',
                          cursor: 'pointer', fontSize: '0.85rem', fontWeight: niche === n.id ? 600 : 400,
                          transition: 'var(--transition)',
                        }}>
                        <span style={{ fontSize: '1.1rem' }}>{n.emoji}</span>
                        {n.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question count */}
                <div className="card" style={{ padding: 24, marginBottom: 28 }}>
                  <label className="label" style={{ marginBottom: 16 }}>Número de perguntas</label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[10, 15, 20, 25].map(n => (
                      <button key={n} onClick={() => setQCount(n)}
                        className={`chip ${questionCount === n ? 'active' : ''}`}
                        style={{ fontSize: '0.95rem', padding: '8px 20px' }}>
                        {n} perguntas
                      </button>
                    ))}
                  </div>
                  <p style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>⚡ Páginas de dica são inseridas automaticamente entre seções</p>
                </div>

                {/* Conditional routing toggle */}
                <div className="card" style={{ padding: 24, marginBottom: 28 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                    <div style={{ position: 'relative', width: 44, height: 24, borderRadius: 12, background: useConditionals ? 'var(--primary)' : '#d1d5db', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 2, left: useConditionals ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                      <input type="checkbox" checked={useConditionals} onChange={e => setUseConditionals(e.target.checked)} style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>🔀 Fluxo condicional</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>A IA cria caminhos diferentes com base nas respostas do usuário (ex: homem/mulher, iniciante/avançado)</div>
                    </div>
                  </label>
                </div>

                {genError && (
                  <div style={{ padding: 14, borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)', fontSize: '0.88rem', marginBottom: 16 }}>
                    ⚠️ {genError}
                  </div>
                )}

                <button className="btn btn-primary btn-full btn-lg" onClick={handleGenerate} disabled={generating}>
                  {generating ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Loader2 size={18} className="spin" />
                      {genPhase === 'analyzing' && <><Search size={16} /> 1/5 — Analisando produto...</>}
                      {genPhase === 'structuring' && <><Zap size={16} /> 2/5 — Criando estrutura...</>}
                      {genPhase === 'questions' && <><Zap size={16} /> 3/5 — Gerando perguntas...</>}
                      {genPhase === 'results' && <><Zap size={16} /> 4/5 — Gerando resultados...</>}
                      {genPhase === 'images' && <><Zap size={16} /> 5/5 — Gerando imagens...</>}
                    </span>
                  ) : (
                    <><Sparkles size={18} /> Gerar Quiz com IA</>
                  )}
                </button>
              </div>
            )}

            {/* ── Step 1: Configure ── */}
            {step === 1 && quiz && (
              <div className="animate-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
                  <div>
                    <h2 style={{ marginBottom: 4 }}>Seu quiz foi gerado! ✨</h2>
                    <p>{quiz.questions.length} perguntas · {quiz.pages.filter(p => p.type === 'insight').length} dicas interativas · {quiz.results.length} resultados</p>
                  </div>
                  <span style={{ fontSize: '2rem' }}>{quiz.emoji}</span>
                </div>

                {/* Metadata badge */}
                {quiz.metadata && (
                  <div className="card" style={{ padding: 16, marginBottom: 16, background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.15)' }}>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.82rem' }}>
                      <span>🎯 <strong>Nicho:</strong> {quiz.metadata.niche}</span>
                      <span>🎨 <strong>Tom:</strong> {quiz.metadata.tone}</span>
                      <span>{quiz.metadata.emojiStyle === 'expressive' ? '😄' : quiz.metadata.emojiStyle === 'moderate' ? '🙂' : '😐'} <strong>Emojis:</strong> {quiz.metadata.emojiStyle}</span>
                    </div>
                  </div>
                )}

                {/* Quiz identity */}
                <div className="card" style={{ padding: 24, marginBottom: 16 }}>
                  <h3 style={{ marginBottom: 16 }}>Identidade do Quiz</h3>
                  <div className="form-group">
                    <label className="label">Título principal</label>
                    <input className="input" value={quiz.welcome.headline} onChange={e => setQuiz(q => ({ ...q, welcome: { ...q.welcome, headline: e.target.value } }))} />
                  </div>
                  <div className="form-group">
                    <label className="label">Subtítulo</label>
                    <textarea className="textarea" value={quiz.welcome.subheadline} onChange={e => setQuiz(q => ({ ...q, welcome: { ...q.welcome, subheadline: e.target.value } }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="label">Paleta de cores (sugerida pela IA)</label>
                    <div className="chip-row">
                      {(quiz.colorPalette || [quiz.primaryColor]).map((c, ci) => (
                        <div key={ci} onClick={() => setQuiz(q => ({ ...q, primaryColor: c }))}
                          style={{
                            width: 36, height: 36, borderRadius: '50%', background: c, cursor: 'pointer',
                            border: quiz.primaryColor === c ? '3px solid var(--text-primary)' : '3px solid transparent',
                            boxShadow: quiz.primaryColor === c ? `0 0 0 2px ${c}` : 'none',
                            transition: 'var(--transition)',
                          }} />
                      ))}
                      {/* Extra manual colors */}
                      {['#2563eb', '#ef4444', '#f59e0b', '#0ea5e9'].filter(c => !(quiz.colorPalette || []).includes(c)).map(c => (
                        <div key={c} onClick={() => setQuiz(q => ({ ...q, primaryColor: c }))}
                          style={{
                            width: 36, height: 36, borderRadius: '50%', background: c, cursor: 'pointer',
                            border: quiz.primaryColor === c ? '3px solid var(--text-primary)' : '3px solid transparent',
                            opacity: 0.5, transition: 'var(--transition)',
                          }} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Results */}
                <div className="card" style={{ padding: 24, marginBottom: 16 }}>
                  <h3 style={{ marginBottom: 16 }}>Resultados & Ofertas</h3>
                  {quiz.results.map((r, ri) => (
                    <div key={r.id} style={{ marginBottom: ri < quiz.results.length - 1 ? 20 : 0, paddingBottom: ri < quiz.results.length - 1 ? 20 : 0, borderBottom: ri < quiz.results.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: quiz.primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{ri + 1}</div>
                        <input className="input" style={{ flex: 1 }} value={r.name} onChange={e => { const res = [...quiz.results]; res[ri] = { ...res[ri], name: e.target.value }; setQuiz(q => ({ ...q, results: res })); }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label className="label">Texto do botão CTA</label>
                          <input className="input" value={r.cta} onChange={e => { const res = [...quiz.results]; res[ri] = { ...res[ri], cta: e.target.value }; setQuiz(q => ({ ...q, results: res })); }} />
                        </div>
                        <div>
                          <label className="label">URL da oferta</label>
                          <input className="input" type="url" placeholder="https://seusite.com/oferta" value={r.ctaUrl || ''} onChange={e => { const res = [...quiz.results]; res[ri] = { ...res[ri], ctaUrl: e.target.value }; setQuiz(q => ({ ...q, results: res })); }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Lead */}
                <div className="card" style={{ padding: 20, marginBottom: 28 }}>
                  <div className="toggle-wrapper">
                    <label className="toggle">
                      <input type="checkbox" checked={quiz.collectLead} onChange={e => setQuiz(q => ({ ...q, collectLead: e.target.checked }))} />
                      <span className="toggle-slider" />
                    </label>
                    <div>
                      <div style={{ fontWeight: 600 }}>Coletar e-mail antes do resultado</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Recomendado — captura o lead antes de revelar o perfil</div>
                    </div>
                  </div>
                </div>

                {/* Quiz preview */}
                <div className="card" style={{ padding: 20, marginBottom: 20, background: `${quiz.primaryColor}08`, border: `1px solid ${quiz.primaryColor}20` }}>
                  <h4 style={{ marginBottom: 10 }}>📋 Sua sequência de perguntas</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {quiz.pages.map((p, i) => (
                      <div key={p.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: p.type === 'insight' ? `${quiz.primaryColor}08` : p.type === 'social-proof' ? `${quiz.primaryColor}05` : '#f9fafb', borderRadius: 8, border: p.type === 'insight' ? `1px solid ${quiz.primaryColor}20` : '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{p.type === 'insight' ? '💡' : p.type === 'social-proof' ? '👥' : p.type === 'multi-select' ? '☑️' : p.type === 'statement' ? '💬' : '📝'}</span>
                        <span style={{ fontSize: '0.8rem', color: p.type === 'insight' ? quiz.primaryColor : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {p.type === 'insight' ? `Dica: ${p.title}` : p.type === 'social-proof' ? 'Social Proof' : p.text}
                        </span>
                        {p.type === 'insight' && <span className="badge badge-primary" style={{ fontSize: '0.6rem' }}>DICA</span>}
                        {p.type === 'multi-select' && <span className="badge" style={{ fontSize: '0.6rem', background: '#f3f4f6' }}>MULTI</span>}
                        {p.type === 'statement' && <span className="badge" style={{ fontSize: '0.6rem', background: '#f3f4f6' }}>LIKERT</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-ghost btn-lg" onClick={() => setStep(0)}><ArrowLeft size={18} /> Voltar</button>
                  <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={handlePublish}>🚀 Publicar Quiz</button>
                </div>
              </div>
            )}

            {/* ── Step 2: Published ── */}
            {step === 2 && published && (
              <div className="animate-in" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
                <h2 style={{ marginBottom: 8 }}>Quiz publicado!</h2>
                <p style={{ marginBottom: 32 }}>Compartilhe o link com seu público e comece a capturar leads agora.</p>
                <div style={{ display: 'flex', gap: 10, background: '#f9fafb', borderRadius: 12, padding: '12px 16px', marginBottom: 20, border: '1px solid var(--border)' }}>
                  <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quizLink}</span>
                  <button className="btn btn-primary btn-sm" onClick={copyLink}>
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost" onClick={() => navigate('/')}>← Voltar ao início</button>
                  <button className="btn btn-primary" onClick={() => window.open(`/q/${published.id}`, '_blank')}><Eye size={16} /> Ver quiz ao vivo</button>
                </div>

                {/* Domain Settings */}
                <DomainSettings quizId={published.id} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
