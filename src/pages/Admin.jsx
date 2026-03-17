// Admin.jsx — Full admin dashboard with tabs
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Copy, Edit3, Eye, ChevronDown, ChevronUp, Users, BarChart3, Package, Settings, Shield, Globe, Zap, TrendingUp, UserCheck, FileText, Activity, DollarSign, Cpu, Clock } from 'lucide-react';
import { getAdminTemplates, saveAdminTemplate, deleteAdminTemplate } from '../utils/templates';
import { createBlock, BLOCK_TYPES } from '../utils/blockTypes';
import { getAdminStats, getAdminUsers, updateAdminUser, deleteAdminUser, getAiUsage, getUser, logout } from '../hooks/useAuth';

const makeStep = (name = 'Nova Etapa') => ({
    id: `stp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    blocks: []
});

export default function Admin() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');

    // Dashboard state
    const [stats, setStats] = useState(null);

    // Users state
    const [users, setUsers] = useState([]);
    const [editingUser, setEditingUser] = useState(null);

    // Templates state (preserve existing logic)
    const [templates, setTemplates] = useState([]);
    const [editing, setEditing] = useState(null);
    const [expandedStep, setExpandedStep] = useState(null);

    // AI Usage state
    const [aiUsage, setAiUsage] = useState([]);

    // Toast
    const [toast, setToast] = useState('');
    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

    const currentUser = getUser();

    // Load data based on active tab
    useEffect(() => {
        if (activeTab === 'dashboard') loadStats();
        if (activeTab === 'users') loadUsers();
        if (activeTab === 'templates') refresh();
        if (activeTab === 'ai-usage') loadAiUsage();
    }, [activeTab]);

    const loadStats = async () => {
        try { setStats(await getAdminStats()); } catch { }
    };
    const loadUsers = async () => {
        try { setUsers(await getAdminUsers()); } catch { }
    };
    const loadAiUsage = async () => {
        try { setAiUsage(await getAiUsage()); } catch { }
    };
    const refresh = () => setTemplates(getAdminTemplates());

    // Template functions (preserved from existing Admin)
    const createTemplate = () => {
        const t = {
            id: Math.random().toString(36).slice(2, 10),
            name: 'Novo Template',
            desc: 'Descrição do template',
            icon: '📋',
            color: '#6366f1',
            tags: ['geral'],
            steps: [makeStep()],
        };
        saveAdminTemplate(t);
        refresh();
        setEditing(t);
        showToast('Template criado!');
    };
    const saveEdit = () => {
        if (!editing) return;
        saveAdminTemplate(editing);
        refresh();
        showToast('Template salvo!');
    };
    const handleDeleteTemplate = (id) => {
        deleteAdminTemplate(id);
        if (editing?.id === id) setEditing(null);
        refresh();
        showToast('Template excluído');
    };
    const duplicateTemplate = (t) => {
        const d = { ...JSON.parse(JSON.stringify(t)), id: Math.random().toString(36).slice(2, 10), name: t.name + ' (cópia)' };
        saveAdminTemplate(d);
        refresh();
        showToast('Template duplicado');
    };
    const updateStep = (sIdx, key, val) => {
        setEditing(e => { const n = { ...e, steps: [...e.steps] }; n.steps[sIdx] = { ...n.steps[sIdx], [key]: val }; return n; });
    };
    const addStep = () => {
        setEditing(e => ({ ...e, steps: [...e.steps, makeStep()] }));
    };
    const removeStep = (sIdx) => {
        setEditing(e => ({ ...e, steps: e.steps.filter((_, i) => i !== sIdx) }));
    };
    const addBlockToStep = (sIdx, type) => {
        const newBlock = createBlock(type);
        setEditing(e => {
            const n = { ...e, steps: [...e.steps] };
            n.steps[sIdx] = { ...n.steps[sIdx], blocks: [...n.steps[sIdx].blocks, newBlock] };
            return n;
        });
    };
    const removeBlock = (sIdx, bIdx) => {
        setEditing(e => {
            const n = { ...e, steps: [...e.steps] };
            n.steps[sIdx] = { ...n.steps[sIdx], blocks: n.steps[sIdx].blocks.filter((_, i) => i !== bIdx) };
            return n;
        });
    };
    const updateBlock = (sIdx, bIdx, key, val) => {
        setEditing(e => {
            const n = { ...e, steps: [...e.steps] };
            const blocks = [...n.steps[sIdx].blocks];
            blocks[bIdx] = { ...blocks[bIdx], [key]: val };
            n.steps[sIdx] = { ...n.steps[sIdx], blocks };
            return n;
        });
    };

    const formatDate = (ts) => {
        if (!ts) return '—';
        return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
        { id: 'users', label: 'Usuários', icon: Users },
        { id: 'templates', label: 'Templates', icon: Package },
        { id: 'ai-usage', label: 'Uso IA', icon: Cpu },
        { id: 'settings', label: 'Configurações', icon: Settings },
    ];

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
            {/* Sidebar */}
            <div style={{
                width: 240, background: '#0f172a', color: '#fff', padding: '20px 0',
                display: 'flex', flexDirection: 'column', flexShrink: 0,
            }}>
                {/* Logo */}
                <div style={{ padding: '0 20px', marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>QF</div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>QuizFlow</div>
                            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={10} /> Admin</div>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <div style={{ flex: 1 }}>
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            padding: '10px 20px', border: 'none', cursor: 'pointer',
                            background: activeTab === tab.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                            color: activeTab === tab.id ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
                            fontSize: '0.8rem', fontWeight: activeTab === tab.id ? 600 : 500,
                            borderLeft: activeTab === tab.id ? '3px solid #6366f1' : '3px solid transparent',
                            transition: 'all 0.15s',
                        }}>
                            <tab.icon size={16} /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{currentUser?.name}</div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginBottom: 12 }}>{currentUser?.email}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => navigate('/dashboard')} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: '0.68rem', cursor: 'pointer' }}>
                            <ArrowLeft size={11} style={{ marginRight: 4 }} /> Início
                        </button>
                        <button onClick={logout} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#f87171', fontSize: '0.68rem', cursor: 'pointer' }}>
                            Sair
                        </button>
                    </div>
                </div>
            </div>

            {/* Main */}
            <div style={{ flex: 1, overflow: 'auto', padding: '28px 36px' }}>
                {/* ═══ DASHBOARD TAB ═══ */}
                {activeTab === 'dashboard' && (
                    <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <BarChart3 size={22} color="var(--primary)" /> Dashboard
                        </h2>
                        {stats ? (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
                                    {[
                                        { label: 'Usuários', value: stats.totalUsers, icon: Users, color: '#6366f1' },
                                        { label: 'Quizzes', value: stats.totalQuizzes, icon: FileText, color: '#3b82f6' },
                                        { label: 'Leads', value: stats.totalLeads, icon: UserCheck, color: '#22c55e' },
                                        { label: 'Domínios', value: stats.totalDomains, icon: Globe, color: '#f59e0b' },
                                        { label: 'Gerações IA', value: stats.aiUsage.count, icon: Zap, color: '#8b5cf6' },
                                        { label: 'Custo IA', value: `$${stats.aiUsage.cost.toFixed(2)}`, icon: DollarSign, color: '#ef4444' },
                                    ].map(kpi => (
                                        <div key={kpi.label} className="card" style={{ padding: '18px 20px', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${kpi.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <kpi.icon size={16} color={kpi.color} />
                                                </div>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{kpi.label}</span>
                                            </div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{kpi.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Recent users */}
                                <div className="card" style={{ padding: '20px 24px', border: '1px solid var(--border)' }}>
                                    <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Activity size={15} color="var(--primary)" /> Últimos cadastros
                                    </h3>
                                    <div style={{ fontSize: '0.8rem' }}>
                                        {stats.recentUsers?.map(u => (
                                            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: u.role === 'admin' ? '#6366f1' : '#e5e7eb', color: u.role === 'admin' ? '#fff' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                                                    {u.name?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <span style={{ fontWeight: 600 }}>{u.name}</span>
                                                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{u.email}</span>
                                                </div>
                                                <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 4, background: u.role === 'admin' ? 'rgba(99,102,241,0.08)' : 'rgba(0,0,0,0.04)', color: u.role === 'admin' ? '#6366f1' : 'var(--text-muted)', fontWeight: 600 }}>{u.role}</span>
                                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{formatDate(u.created_at)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="loader" /></div>
                        )}
                    </div>
                )}

                {/* ═══ USERS TAB ═══ */}
                {activeTab === 'users' && (
                    <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Users size={22} color="var(--primary)" /> Gerenciar Usuários
                        </h2>
                        <div className="card" style={{ padding: '4px 0', border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Usuário</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Role</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cadastro</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Último login</th>
                                        <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '10px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: u.role === 'admin' ? '#6366f1' : '#e5e7eb', color: u.role === 'admin' ? '#fff' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                                        {u.name?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <span style={{ fontWeight: 600 }}>{u.name}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{u.email}</td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <select value={u.role} onChange={async (e) => {
                                                    await updateAdminUser(u.id, { role: e.target.value });
                                                    loadUsers();
                                                    showToast('Role atualizado');
                                                }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.75rem', background: '#fff', cursor: 'pointer' }}>
                                                    <option value="user">user</option>
                                                    <option value="admin">admin</option>
                                                </select>
                                            </td>
                                            <td style={{ padding: '10px 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(u.created_at)}</td>
                                            <td style={{ padding: '10px 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(u.last_login)}</td>
                                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                                {u.id !== currentUser?.id && (
                                                    <button onClick={async () => {
                                                        if (!confirm(`Deletar ${u.name}?`)) return;
                                                        try { await deleteAdminUser(u.id); loadUsers(); showToast('Usuário removido'); } catch (e) { showToast(e.message); }
                                                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {users.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: '0.82rem' }}>Nenhum usuário cadastrado</div>}
                        </div>
                    </div>
                )}

                {/* ═══ TEMPLATES TAB ═══ */}
                {activeTab === 'templates' && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Package size={22} color="var(--primary)" /> Templates Globais
                            </h2>
                            <button className="btn btn-primary" onClick={createTemplate} style={{ gap: 6 }}>
                                <Plus size={14} /> Novo Template
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: editing ? '280px 1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                            {/* Template list */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {templates.map(t => (
                                    <div key={t.id} className="card" onClick={() => setEditing(t)} style={{
                                        padding: '12px 16px', cursor: 'pointer', border: editing?.id === t.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        transition: 'var(--transition)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 16 }}>{t.icon}</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{t.name}</div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t.steps?.length || 0} etapas</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button onClick={(e) => { e.stopPropagation(); duplicateTemplate(t); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Copy size={13} /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}><Trash2 size={13} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {templates.length === 0 && (
                                    <div className="card" style={{ padding: '32px 20px', textAlign: 'center', border: '1px solid var(--border)' }}>
                                        <Package size={32} color="var(--text-muted)" style={{ marginBottom: 8, opacity: 0.5 }} />
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Nenhum template</div>
                                    </div>
                                )}
                            </div>

                            {/* Template editor */}
                            {editing && (
                                <div className="card" style={{ padding: '20px 24px', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Editando: {editing.name}</h3>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-primary btn-sm" onClick={saveEdit} style={{ gap: 4 }}><Save size={13} /> Salvar</button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Fechar</button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Nome</label>
                                            <input className="input" value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Icon</label>
                                            <input className="input" value={editing.icon} onChange={e => setEditing(p => ({ ...p, icon: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Cor</label>
                                            <input type="color" value={editing.color} onChange={e => setEditing(p => ({ ...p, color: e.target.value }))} style={{ width: '100%', height: 36, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Tags (vírgula)</label>
                                            <input className="input" value={editing.tags?.join(', ')} onChange={e => setEditing(p => ({ ...p, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Descrição</label>
                                        <input className="input" value={editing.desc || ''} onChange={e => setEditing(p => ({ ...p, desc: e.target.value }))} />
                                    </div>

                                    <div style={{ marginTop: 20 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Etapas ({editing.steps?.length || 0})</span>
                                            <button className="btn btn-ghost btn-sm" onClick={addStep} style={{ gap: 4 }}><Plus size={12} /> Etapa</button>
                                        </div>
                                        {editing.steps?.map((step, sIdx) => (
                                            <div key={sIdx} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 8, background: 'var(--bg-elevated)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <button onClick={() => setExpandedStep(expandedStep === sIdx ? null : sIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                                                        {expandedStep === sIdx ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    </button>
                                                    <input className="input" value={step.name} onChange={e => updateStep(sIdx, 'name', e.target.value)} style={{ flex: 1, fontSize: '0.8rem', padding: '4px 8px' }} />
                                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{step.blocks?.length || 0} blocos</span>
                                                    <button onClick={() => removeStep(sIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}><Trash2 size={13} /></button>
                                                </div>

                                                {expandedStep === sIdx && (
                                                    <div style={{ marginTop: 10 }}>
                                                        {step.blocks?.map((block, bIdx) => (
                                                            <div key={bIdx} style={{ padding: '8px 10px', background: '#fff', borderRadius: 6, marginBottom: 6, border: '1px solid var(--border)', fontSize: '0.78rem' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                    <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>{block.type}</span>
                                                                    <input className="input" value={block.text || block.title || ''} onChange={e => updateBlock(sIdx, bIdx, block.text !== undefined ? 'text' : 'title', e.target.value)} style={{ flex: 1, fontSize: '0.78rem', padding: '3px 6px' }} />
                                                                    <button onClick={() => removeBlock(sIdx, bIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}><Trash2 size={12} /></button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                                                            {Object.keys(BLOCK_TYPES).slice(0, 8).map(type => (
                                                                <button key={type} onClick={() => addBlockToStep(sIdx, type)} style={{
                                                                    padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)',
                                                                    background: '#fff', cursor: 'pointer', fontSize: '0.65rem', color: 'var(--text-muted)',
                                                                }}>+ {type}</button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ AI USAGE TAB ═══ */}
                {activeTab === 'ai-usage' && (
                    <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Cpu size={22} color="var(--primary)" /> Uso de IA
                        </h2>
                        {aiUsage.length === 0 ? (
                            <div className="card" style={{ padding: '48px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
                                <Zap size={40} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.4 }} />
                                <h3 style={{ marginBottom: 4 }}>Sem registros de IA</h3>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Os gastos com gerações de IA aparecerão aqui conforme forem utilizados.</p>
                            </div>
                        ) : (
                            <div className="card" style={{ padding: 0, border: '1px solid var(--border)', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ação</th>
                                            <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Usuário</th>
                                            <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tokens</th>
                                            <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Custo</th>
                                            <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Data</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {aiUsage.map(row => (
                                            <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{row.action}</td>
                                                <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{row.user_name || '—'}</td>
                                                <td style={{ padding: '10px 16px', textAlign: 'right' }}>{(row.tokens_used || 0).toLocaleString()}</td>
                                                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>${(row.cost_estimate || 0).toFixed(4)}</td>
                                                <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{formatDate(row.created_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ SETTINGS TAB ═══ */}
                {activeTab === 'settings' && (
                    <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Settings size={22} color="var(--primary)" /> Configurações
                        </h2>
                        <div className="card" style={{ padding: '24px 28px', maxWidth: 600, border: '1px solid var(--border)' }}>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 6 }}>Hostname do Servidor</label>
                                <input className="input" value={typeof window !== 'undefined' ? window.location.host : ''} readOnly style={{ opacity: 0.6 }} />
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>Usado nas instruções de CNAME para domínios customizados.</p>
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 6 }}>Versão do App</label>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>QuizFlow v1.0.0</span>
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 6 }}>Banco de Dados</label>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>SQLite (quizzes.db)</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Toast */}
            {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#111', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>{toast}</div>}
        </div>
    );
}
