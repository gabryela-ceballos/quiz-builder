import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Globe, Palette, Shield, Save, Moon, Sun } from 'lucide-react';
import { getUser } from '../hooks/useAuth';

export default function Settings() {
    const navigate = useNavigate();
    const user = getUser();
    const [notifyEmail, setNotifyEmail] = useState(true);
    const [notifyLeads, setNotifyLeads] = useState(true);
    const [language, setLanguage] = useState('pt');
    const [timezone, setTimezone] = useState('America/Sao_Paulo');
    const [toast, setToast] = useState('');

    useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t); } }, [toast]);

    const handleSave = () => {
        // Save settings to localStorage for now
        localStorage.setItem('inlead_settings', JSON.stringify({ notifyEmail, notifyLeads, language, timezone }));
        setToast('✅ Configurações salvas!');
    };

    const Toggle = ({ checked, onChange }) => (
        <label className="toggle">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
            <span className="toggle-slider" />
        </label>
    );

    return (
        <div className="page" style={{ position: 'relative', zIndex: 1 }}>
            <div className="container" style={{ maxWidth: 640, paddingTop: 28 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')} style={{ marginBottom: 24 }}>
                    <ArrowLeft size={16} /> Voltar
                </button>

                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6 }}>Configurações</h1>
                <p style={{ color: '#6b7280', fontSize: '0.88rem', marginBottom: 28 }}>Personalize sua experiência no QuizFlow</p>

                {/* Notifications */}
                <div style={{
                    background: '#fff', borderRadius: 16, padding: '24px 28px', marginBottom: 20,
                    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Bell size={16} color="#6366f1" /> Notificações
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Notificações por e-mail</div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Receba atualizações sobre seus funis</div>
                        </div>
                        <Toggle checked={notifyEmail} onChange={setNotifyEmail} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Alertas de novos leads</div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Saiba quando um lead preencher o quiz</div>
                        </div>
                        <Toggle checked={notifyLeads} onChange={setNotifyLeads} />
                    </div>
                </div>

                {/* Regional */}
                <div style={{
                    background: '#fff', borderRadius: 16, padding: '24px 28px', marginBottom: 20,
                    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Globe size={16} color="#6366f1" /> Regional
                    </h3>
                    <div className="form-group">
                        <label className="label">Idioma da plataforma</label>
                        <select className="select" value={language} onChange={e => setLanguage(e.target.value)} style={{ borderRadius: 10 }}>
                            <option value="pt">🇧🇷 Português (Brasil)</option>
                            <option value="en">🇺🇸 English</option>
                            <option value="es">🇪🇸 Español</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="label">Fuso horário</label>
                        <select className="select" value={timezone} onChange={e => setTimezone(e.target.value)} style={{ borderRadius: 10 }}>
                            <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                            <option value="America/New_York">Nova York (GMT-5)</option>
                            <option value="Europe/London">Londres (GMT+0)</option>
                            <option value="Europe/Paris">Paris (GMT+1)</option>
                            <option value="Asia/Tokyo">Tóquio (GMT+9)</option>
                        </select>
                    </div>
                </div>

                {/* Account info */}
                <div style={{
                    background: '#fff', borderRadius: 16, padding: '24px 28px', marginBottom: 24,
                    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Shield size={16} color="#6366f1" /> Conta
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>ID da conta</span>
                            <span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>#{user?.id || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Função</span>
                            <span style={{ fontWeight: 600, color: user?.role === 'admin' ? '#6366f1' : '#374151' }}>
                                {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Membro desde</span>
                            <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '—'}</span>
                        </div>
                    </div>
                </div>

                <button className="btn btn-accent btn-lg btn-full" onClick={handleSave} style={{ borderRadius: 12, marginBottom: 16 }}>
                    <Save size={16} /> Salvar configurações
                </button>

                {/* Danger zone */}
                <div style={{
                    background: 'rgba(239,68,68,0.03)', borderRadius: 16, padding: '20px 28px', marginBottom: 40,
                    border: '1px solid rgba(239,68,68,0.15)',
                }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>⚠️ Zona de perigo</h3>
                    <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: 12 }}>Ações irreversíveis que afetam sua conta</p>
                    <button className="btn btn-danger btn-sm" onClick={() => {
                        if (confirm('Tem certeza? Todos os seus dados serão perdidos permanentemente.')) {
                            alert('Função desabilitada por segurança. Contate o suporte para excluir sua conta.');
                        }
                    }}>
                        Excluir minha conta
                    </button>
                </div>

                {toast && <div className="toast" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, animation: 'slideUp 0.2s ease' }}>{toast}</div>}
            </div>
        </div>
    );
}
