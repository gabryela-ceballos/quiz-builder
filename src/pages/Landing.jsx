import { useNavigate } from 'react-router-dom';
import { Sparkles, Zap, Copy, BarChart2, Globe, Lock, ArrowRight, Check, Crown, Rocket, Star, Users, TrendingUp, Shield, Play } from 'lucide-react';
import { isLoggedIn } from '../hooks/useAuth';
import { useEffect } from 'react';

export default function Landing() {
    const navigate = useNavigate();

    useEffect(() => {
        if (isLoggedIn()) navigate('/dashboard', { replace: true });
    }, []);

    if (isLoggedIn()) return null;

    return (
        <div style={{ background: '#0a0a0f', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden' }}>
            {/* ── Navbar ── */}
            <nav style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 800, fontSize: 12,
                    }}>QF</div>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>QuizFlow</span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => navigate('/login')} style={{
                        padding: '9px 22px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
                        background: 'transparent', color: '#fff', fontSize: '0.85rem', fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s',
                    }}>Entrar</button>
                    <button onClick={() => navigate('/login')} style={{
                        padding: '9px 22px', borderRadius: 10, border: 'none',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
                        fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: '0 4px 15px rgba(99,102,241,0.4)',
                    }}>Começar grátis</button>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section style={{
                minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', padding: '120px 24px 80px', position: 'relative',
            }}>
                {/* Gradient orbs */}
                <div style={{ position: 'absolute', top: '10%', left: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px 6px 8px',
                    borderRadius: 999, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)',
                    fontSize: '0.78rem', color: '#a5b4fc', marginBottom: 28, fontWeight: 500,
                }}>
                    <Sparkles size={14} /> Powered by AI • Crie funis em minutos
                </div>

                <h1 style={{
                    fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 800, lineHeight: 1.08,
                    letterSpacing: '-0.04em', maxWidth: 800, marginBottom: 20,
                    background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 50%, #818cf8 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                    Transforme visitantes em leads com quizzes inteligentes
                </h1>

                <p style={{
                    fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: '#9ca3af', maxWidth: 580,
                    lineHeight: 1.6, marginBottom: 36,
                }}>
                    Crie funis de quiz interativos com IA, clone quizzes existentes e capture leads qualificados. Tudo em poucos cliques.
                </p>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button onClick={() => navigate('/login')} style={{
                        padding: '14px 32px', borderRadius: 14, border: 'none',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
                        fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                        boxShadow: '0 8px 30px rgba(99,102,241,0.4)', transition: 'all 0.3s',
                        display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        Criar meu primeiro quiz <ArrowRight size={18} />
                    </button>
                    <button onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })} style={{
                        padding: '14px 28px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.04)', color: '#d1d5db',
                        fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        <Play size={16} /> Ver como funciona
                    </button>
                </div>

                {/* Stats */}
                <div style={{
                    display: 'flex', gap: 48, marginTop: 60, flexWrap: 'wrap', justifyContent: 'center',
                }}>
                    {[
                        { value: '10k+', label: 'Leads capturados' },
                        { value: '500+', label: 'Quizzes criados' },
                        { value: '95%', label: 'Taxa de conclusão' },
                    ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#a5b4fc' }}>{s.value}</div>
                            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Features ── */}
            <section id="features" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: 12, letterSpacing: '-0.03em' }}>
                        Tudo que você precisa para converter
                    </h2>
                    <p style={{ color: '#9ca3af', fontSize: '1.05rem', maxWidth: 500, margin: '0 auto' }}>
                        Ferramentas poderosas para criar, publicar e otimizar seus funis de quiz
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                    {[
                        { icon: Sparkles, color: '#f59e0b', title: 'Geração com IA', desc: 'Descreva seu produto e a IA cria o quiz completo em segundos. Perguntas, resultados e design automáticos.' },
                        { icon: Copy, color: '#6366f1', title: 'Clone de URL', desc: 'Cole a URL de qualquer quiz na internet e clone instantaneamente. Edite e publique como seu.' },
                        { icon: Zap, color: '#10b981', title: 'Builder visual', desc: 'Editor drag & drop intuitivo. Adicione perguntas, resultados personalizados e capture leads facilmente.' },
                        { icon: BarChart2, color: '#3b82f6', title: 'Analytics completos', desc: 'Acompanhe visualizações, conversões, taxa de conclusão e leads em tempo real.' },
                        { icon: Globe, color: '#8b5cf6', title: 'Domínio próprio', desc: 'Conecte seu domínio personalizado e publique quizzes com sua marca profissional.' },
                        { icon: Shield, color: '#ef4444', title: 'Multi-idioma com IA', desc: 'Gere quizzes em 8 idiomas. A IA traduz tudo automaticamente: perguntas, opções e resultados.' },
                    ].map(f => {
                        const Icon = f.icon;
                        return (
                            <div key={f.title} style={{
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 20, padding: '28px 24px', transition: 'all 0.3s',
                            }}
                                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = `${f.color}40`; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                                onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'none'; }}
                            >
                                <div style={{
                                    width: 48, height: 48, borderRadius: 14,
                                    background: `${f.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: 16,
                                }}>
                                    <Icon size={22} color={f.color} />
                                </div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
                                <p style={{ fontSize: '0.88rem', color: '#9ca3af', lineHeight: 1.6 }}>{f.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── How it works ── */}
            <section style={{ padding: '80px 24px', maxWidth: 900, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: 12, letterSpacing: '-0.03em' }}>
                        3 passos. Sem complicação.
                    </h2>
                    <p style={{ color: '#9ca3af', fontSize: '1.05rem' }}>
                        Do zero ao quiz publicado em menos de 5 minutos
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {[
                        { step: '01', title: 'Descreva seu produto', desc: 'Digite o nome, nicho e descrição. A IA faz o resto ou clone um quiz existente.', color: '#6366f1' },
                        { step: '02', title: 'Personalize no builder', desc: 'Edite perguntas, resultados, cores e adicione sua identidade visual com drag & drop.', color: '#8b5cf6' },
                        { step: '03', title: 'Publique e capture leads', desc: 'Um clique para publicar. Compartilhe o link e comece a receber leads qualificados.', color: '#a78bfa' },
                    ].map(s => (
                        <div key={s.step} style={{
                            display: 'flex', gap: 24, alignItems: 'flex-start',
                            padding: '28px 32px', borderRadius: 20,
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                                background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.4rem', fontWeight: 800, color: s.color,
                            }}>{s.step}</div>
                            <div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 6 }}>{s.title}</h3>
                                <p style={{ fontSize: '0.9rem', color: '#9ca3af', lineHeight: 1.6 }}>{s.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Pricing ── */}
            <section style={{ padding: '80px 24px', maxWidth: 1000, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: 12, letterSpacing: '-0.03em' }}>
                        Planos para cada fase do seu negócio
                    </h2>
                    <p style={{ color: '#9ca3af', fontSize: '1.05rem' }}>
                        Comece grátis e escale conforme cresce
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                    {[
                        {
                            name: 'Starter', price: '29,90', color: '#6366f1', icon: Zap,
                            features: ['3 quizzes por mês', '1 geração com IA', 'Analytics básicos', 'Domínio personalizado'],
                            excluded: ['Clonagem de URL'],
                        },
                        {
                            name: 'Pro', price: '49,90', color: '#2563eb', icon: Crown, popular: true,
                            features: ['8 quizzes por mês', '3 gerações com IA', '1 clone por mês', 'Analytics avançados', 'Domínio personalizado'],
                            excluded: [],
                        },
                        {
                            name: 'Business', price: '99,90', color: '#059669', icon: Rocket,
                            features: ['15 quizzes por mês', '8 gerações com IA', '3 clones por mês', 'Analytics + leads ilimitados', 'Domínio personalizado'],
                            excluded: [],
                        },
                    ].map(plan => {
                        const Icon = plan.icon;
                        return (
                            <div key={plan.name} style={{
                                borderRadius: 20, padding: '32px 24px', position: 'relative',
                                border: plan.popular ? `2px solid ${plan.color}` : '1px solid rgba(255,255,255,0.08)',
                                background: plan.popular ? 'rgba(37,99,235,0.06)' : 'rgba(255,255,255,0.02)',
                                transform: plan.popular ? 'scale(1.03)' : 'none',
                            }}>
                                {plan.popular && (
                                    <div style={{
                                        position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                                        background: `linear-gradient(135deg, ${plan.color}, #3b82f6)`, color: '#fff',
                                        padding: '5px 18px', borderRadius: 14, fontSize: '0.72rem', fontWeight: 700,
                                    }}>⭐ MAIS POPULAR</div>
                                )}
                                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                    <div style={{
                                        width: 52, height: 52, borderRadius: 16, margin: '0 auto 12px',
                                        background: `${plan.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Icon size={24} color={plan.color} />
                                    </div>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>{plan.name}</h3>
                                    <div>
                                        <span style={{ fontSize: '2.4rem', fontWeight: 800, color: plan.color }}>R${plan.price}</span>
                                        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>/mês</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                                    {plan.features.map(f => (
                                        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}>
                                            <Check size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                                            <span style={{ color: '#d1d5db' }}>{f}</span>
                                        </div>
                                    ))}
                                    {plan.excluded.map(f => (
                                        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}>
                                            <Lock size={15} style={{ color: '#4b5563', flexShrink: 0 }} />
                                            <span style={{ color: '#6b7280' }}>{f}</span>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => navigate('/login')} style={{
                                    width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                                    background: plan.popular ? `linear-gradient(135deg, ${plan.color}, #3b82f6)` : 'rgba(255,255,255,0.08)',
                                    color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s',
                                }}>
                                    Começar agora
                                </button>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── CTA ── */}
            <section style={{
                padding: '80px 24px', textAlign: 'center', position: 'relative',
            }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: 16, letterSpacing: '-0.03em' }}>
                        Pronto para transformar visitantes em leads?
                    </h2>
                    <p style={{ color: '#9ca3af', fontSize: '1.1rem', marginBottom: 32, maxWidth: 500, margin: '0 auto 32px' }}>
                        Crie seu primeiro quiz com IA agora mesmo. É grátis para começar.
                    </p>
                    <button onClick={() => navigate('/login')} style={{
                        padding: '16px 40px', borderRadius: 14, border: 'none',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
                        fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer',
                        boxShadow: '0 8px 30px rgba(99,102,241,0.4)',
                        display: 'inline-flex', alignItems: 'center', gap: 10,
                    }}>
                        Criar conta grátis <ArrowRight size={20} />
                    </button>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer style={{
                padding: '40px 24px', borderTop: '1px solid rgba(255,255,255,0.06)',
                textAlign: 'center', color: '#6b7280', fontSize: '0.82rem',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 800, fontSize: 10,
                    }}>QF</div>
                    <span style={{ fontWeight: 600, color: '#9ca3af' }}>QuizFlow</span>
                </div>
                <p>© {new Date().getFullYear()} QuizFlow. Todos os direitos reservados.</p>
            </footer>
        </div>
    );
}
