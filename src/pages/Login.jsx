// Login.jsx — Premium login/register page
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../hooks/useAuth';
import { LogIn, UserPlus, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();
    const [mode, setMode] = useState('login'); // login | register
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
            navigate('/');
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Decorative blobs */}
            <div style={{ position: 'absolute', top: -120, right: -120, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', filter: 'blur(60px)' }} />
            <div style={{ position: 'absolute', bottom: -100, left: -100, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)', filter: 'blur(60px)' }} />

            <div style={{
                width: 400,
                padding: '40px 36px',
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20,
                boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
                position: 'relative',
                zIndex: 1,
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 800, fontSize: 18, margin: '0 auto 14px',
                        boxShadow: '0 8px 30px rgba(99,102,241,0.3)',
                    }}>QF</div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>QuizFlow</h1>
                    <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
                        {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}
                    </p>
                </div>

                {/* Mode toggle */}
                <div style={{
                    display: 'flex', borderRadius: 12, background: 'rgba(255,255,255,0.06)',
                    padding: 3, marginBottom: 24, gap: 2,
                }}>
                    {[{ id: 'login', label: 'Entrar', icon: LogIn }, { id: 'register', label: 'Cadastrar', icon: UserPlus }].map(m => (
                        <button key={m.id}
                            onClick={() => { setMode(m.id); setError(''); }}
                            style={{
                                flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, cursor: 'pointer',
                                fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                background: mode === m.id ? 'rgba(99,102,241,0.2)' : 'transparent',
                                color: mode === m.id ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                                transition: 'all 0.2s',
                            }}>
                            <m.icon size={14} /> {m.label}
                        </button>
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        padding: '10px 14px', borderRadius: 10, marginBottom: 16,
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                        color: '#fca5a5', fontSize: '0.78rem',
                    }}>{error}</div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    {mode === 'register' && (
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nome</label>
                            <div style={{ position: 'relative' }}>
                                <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                                <input
                                    type="text" value={name} onChange={e => setName(e.target.value)} required
                                    placeholder="Seu nome"
                                    style={{
                                        width: '100%', padding: '12px 12px 12px 38px', borderRadius: 10,
                                        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                                        color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
                                        transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                />
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                            <input
                                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                                placeholder="seu@email.com"
                                style={{
                                    width: '100%', padding: '12px 12px 12px 38px', borderRadius: 10,
                                    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                                    color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Senha</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                            <input
                                type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                                placeholder="••••••••" minLength={4}
                                style={{
                                    width: '100%', padding: '12px 42px 12px 38px', borderRadius: 10,
                                    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                                    color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                            />
                            <button type="button" onClick={() => setShowPw(!showPw)} style={{
                                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex',
                            }}>
                                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" disabled={loading} style={{
                        width: '100%', padding: '13px 0', border: 'none', borderRadius: 12, cursor: loading ? 'wait' : 'pointer',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff', fontWeight: 700, fontSize: '0.88rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: '0 8px 30px rgba(99,102,241,0.3)',
                        opacity: loading ? 0.7 : 1,
                        transition: 'opacity 0.2s, transform 0.1s',
                    }}
                        onMouseDown={e => !loading && (e.currentTarget.style.transform = 'scale(0.98)')}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {loading ? 'Carregando...' : (
                            <>{mode === 'login' ? 'Entrar' : 'Criar conta'} <ArrowRight size={16} /></>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginTop: 24 }}>
                    {mode === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
                    <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                        style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem' }}>
                        {mode === 'login' ? 'Cadastre-se' : 'Faça login'}
                    </button>
                </p>
            </div>
        </div>
    );
}
