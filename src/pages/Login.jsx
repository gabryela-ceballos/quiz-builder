// Login.jsx — Premium login/register page with animated background
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../hooks/useAuth';
import { LogIn, UserPlus, Mail, Lock, User, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';

// ─── Animated gradient orbs ───
function AnimatedBackground() {
    return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <style>{`
                @keyframes orbit1 { 0% { transform: translate(0, 0) scale(1); } 33% { transform: translate(80px, -60px) scale(1.1); } 66% { transform: translate(-40px, 40px) scale(0.95); } 100% { transform: translate(0, 0) scale(1); } }
                @keyframes orbit2 { 0% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-70px, 50px) scale(0.9); } 66% { transform: translate(60px, -30px) scale(1.05); } 100% { transform: translate(0, 0) scale(1); } }
                @keyframes orbit3 { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(50px, 60px) scale(1.15); } 100% { transform: translate(0, 0) scale(1); } }
            `}</style>
            <div style={{ position: 'absolute', top: '-15%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)', filter: 'blur(80px)', animation: 'orbit1 12s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)', filter: 'blur(80px)', animation: 'orbit2 15s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', top: '40%', left: '50%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', filter: 'blur(60px)', animation: 'orbit3 10s ease-in-out infinite' }} />
            {/* Grid pattern overlay */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>
    );
}

export default function Login() {
    const navigate = useNavigate();
    const [mode, setMode] = useState('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [transitioning, setTransitioning] = useState(false);

    const switchMode = (newMode) => {
        setTransitioning(true);
        setTimeout(() => {
            setMode(newMode);
            setError('');
            setTransitioning(false);
        }, 150);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (mode === 'register') {
                await register(name, email, password);
            } else {
                await login(email, password);
            }
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    };

    const inputStyle = {
        width: '100%', padding: '13px 14px 13px 42px', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
        color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        fontFamily: 'Inter, sans-serif',
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 30%, #1e293b 60%, #0f172a 100%)',
            position: 'relative', overflow: 'hidden',
        }}>
            <AnimatedBackground />

            <div style={{
                width: 420, padding: '44px 40px',
                background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24,
                boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
                position: 'relative', zIndex: 1,
                animation: 'fadeIn 0.5s ease',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 16,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 800, fontSize: 20, margin: '0 auto 16px',
                        boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
                        position: 'relative',
                    }}>
                        QF
                        <div style={{ position: 'absolute', inset: -2, borderRadius: 18, border: '1px solid rgba(99,102,241,0.3)', animation: 'pulseDot 3s ease infinite' }} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: 4, letterSpacing: '-0.02em' }}>QuizFlow</h1>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                        {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta grátis'}
                    </p>
                </div>

                {/* Mode toggle */}
                <div style={{
                    display: 'flex', borderRadius: 14, background: 'rgba(255,255,255,0.06)',
                    padding: 4, marginBottom: 28, gap: 3,
                }}>
                    {[{ id: 'login', label: 'Entrar', icon: LogIn }, { id: 'register', label: 'Cadastrar', icon: UserPlus }].map(m => (
                        <button key={m.id}
                            onClick={() => switchMode(m.id)}
                            style={{
                                flex: 1, padding: '11px 0', border: 'none', borderRadius: 11, cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                background: mode === m.id ? 'rgba(99,102,241,0.25)' : 'transparent',
                                color: mode === m.id ? '#a5b4fc' : 'rgba(255,255,255,0.35)',
                                transition: 'all 0.25s ease',
                                boxShadow: mode === m.id ? '0 2px 8px rgba(99,102,241,0.15)' : 'none',
                            }}>
                            <m.icon size={15} /> {m.label}
                        </button>
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        padding: '11px 16px', borderRadius: 12, marginBottom: 18,
                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)',
                        color: '#fca5a5', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 8,
                        animation: 'fadeIn 0.2s ease',
                    }}>⚠️ {error}</div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ opacity: transitioning ? 0.3 : 1, transition: 'opacity 0.15s ease' }}>
                    {mode === 'register' && (
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nome</label>
                            <div style={{ position: 'relative' }}>
                                <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)' }} />
                                <input
                                    type="text" value={name} onChange={e => setName(e.target.value)} required
                                    placeholder="Seu nome"
                                    style={inputStyle}
                                    onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)' }} />
                            <input
                                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                                placeholder="seu@email.com"
                                style={inputStyle}
                                onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: 28 }}>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Senha</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)' }} />
                            <input
                                type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                                placeholder="••••••••" minLength={4}
                                style={{ ...inputStyle, paddingRight: 46 }}
                                onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                            />
                            <button type="button" onClick={() => setShowPw(!showPw)} style={{
                                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', display: 'flex',
                                padding: 4, borderRadius: 6, transition: 'color 0.15s',
                            }}
                                onMouseOver={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                                onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
                            >
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" disabled={loading} style={{
                        width: '100%', padding: '14px 0', border: 'none', borderRadius: 14, cursor: loading ? 'wait' : 'pointer',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Inter, sans-serif',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: '0 8px 32px rgba(99,102,241,0.35)',
                        opacity: loading ? 0.7 : 1,
                        transition: 'all 0.2s ease',
                        position: 'relative', overflow: 'hidden',
                    }}
                        onMouseOver={e => !loading && (e.currentTarget.style.boxShadow = '0 12px 40px rgba(99,102,241,0.5)')}
                        onMouseOut={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.35)'}
                        onMouseDown={e => !loading && (e.currentTarget.style.transform = 'scale(0.98)')}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {loading ? (
                            <div className="loader" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#fff' }} />
                        ) : (
                            <>{mode === 'login' ? 'Entrar' : 'Criar conta'} <ArrowRight size={17} /></>
                        )}
                    </button>
                </form>

                {/* Social proof */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20, padding: '8px 0' }}>
                    <Sparkles size={12} color="rgba(255,255,255,0.25)" />
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)' }}>Plataforma de quizzes e funnels</span>
                </div>

                {/* Footer */}
                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
                    {mode === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
                    <button onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                        style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                        {mode === 'login' ? 'Cadastre-se' : 'Faça login'}
                    </button>
                </p>
            </div>
        </div>
    );
}
