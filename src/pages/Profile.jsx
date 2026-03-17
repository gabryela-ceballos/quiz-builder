import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Camera, Mail, User, Lock, Eye, EyeOff } from 'lucide-react';
import { getUser } from '../hooks/useAuth';

export default function Profile() {
    const navigate = useNavigate();
    const user = getUser();
    const [name, setName] = useState(user?.name || '');
    const [email] = useState(user?.email || '');
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');

    const API = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';
    const token = localStorage.getItem('inlead_token');

    const handleSave = async () => {
        setSaving(true);
        try {
            // Update name
            const res = await fetch(`${API}/auth/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name }),
            });
            if (!res.ok) throw new Error('Erro ao salvar');

            // Update password if provided
            if (newPw) {
                if (newPw !== confirmPw) { setToast('❌ Senhas não conferem'); setSaving(false); return; }
                if (newPw.length < 6) { setToast('❌ Senha mínima: 6 caracteres'); setSaving(false); return; }
                const pwRes = await fetch(`${API}/auth/password`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
                });
                if (!pwRes.ok) { const e = await pwRes.json(); throw new Error(e.error || 'Erro ao trocar senha'); }
            }

            // Update local storage
            const u = { ...user, name };
            localStorage.setItem('inlead_user', JSON.stringify(u));
            setToast('✅ Perfil atualizado!');
            setCurrentPw(''); setNewPw(''); setConfirmPw('');
        } catch (err) {
            setToast(`❌ ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t); } }, [toast]);

    const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' }) : '—';

    return (
        <div className="page" style={{ position: 'relative', zIndex: 1 }}>
            <div className="container" style={{ maxWidth: 640, paddingTop: 28 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ marginBottom: 24 }}>
                    <ArrowLeft size={16} /> Voltar
                </button>

                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6 }}>Meu Perfil</h1>
                <p style={{ color: '#6b7280', fontSize: '0.88rem', marginBottom: 28 }}>Gerencie suas informações pessoais</p>

                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 32 }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: 20,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 28, fontWeight: 700, flexShrink: 0,
                    }}>
                        {name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{name || 'Usuário'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Membro desde {memberSince}</div>
                        <div style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600, marginTop: 2 }}>
                            {user?.role === 'admin' ? '🛡️ Administrador' : '👤 Usuário'}
                        </div>
                    </div>
                </div>

                {/* Name + Email */}
                <div style={{
                    background: '#fff', borderRadius: 16, padding: '24px 28px', marginBottom: 20,
                    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <User size={16} color="#6366f1" /> Informações
                    </h3>
                    <div className="form-group">
                        <label className="label">Nome</label>
                        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" style={{ borderRadius: 10 }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="label">E-mail</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input className="input" value={email} disabled style={{ borderRadius: 10, opacity: 0.6 }} />
                            <Mail size={16} style={{ color: '#9ca3af', flexShrink: 0 }} />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>O e-mail não pode ser alterado</span>
                    </div>
                </div>

                {/* Password */}
                <div style={{
                    background: '#fff', borderRadius: 16, padding: '24px 28px', marginBottom: 24,
                    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Lock size={16} color="#6366f1" /> Alterar Senha
                    </h3>
                    <div className="form-group">
                        <label className="label">Senha atual</label>
                        <div style={{ position: 'relative' }}>
                            <input className="input" type={showPw ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" style={{ borderRadius: 10, paddingRight: 40 }} />
                            <button onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="label">Nova senha</label>
                            <input className="input" type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ borderRadius: 10 }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="label">Confirmar</label>
                            <input className="input" type={showPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repita a senha" style={{ borderRadius: 10 }} />
                        </div>
                    </div>
                </div>

                <button className="btn btn-accent btn-lg btn-full" onClick={handleSave} disabled={saving} style={{ borderRadius: 12, marginBottom: 16 }}>
                    {saving ? 'Salvando...' : <><Save size={16} /> Salvar alterações</>}
                </button>

                {toast && <div className="toast" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, animation: 'slideUp 0.2s ease' }}>{toast}</div>}
            </div>
        </div>
    );
}
