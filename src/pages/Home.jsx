import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreVertical, Trash2, Pencil, BarChart2, Copy, Share2, Grid, Settings, ChevronRight, Sparkles, X, Users, Mail, UserPlus, Target, FileText, Link2, Globe, ExternalLink, CheckCircle2, Clock, ChevronDown, Shield, LogOut } from 'lucide-react';
import { getQuizzes, deleteQuiz, clearAllQuizzes, getAnalytics, shareQuiz, getShares, removeShare, getSharedQuizzes, getAllDomains } from '../hooks/useQuizStore';
import { getUser, isAdmin, logout } from '../hooks/useAuth';

export default function Home() {
    const navigate = useNavigate();
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [search, setSearch] = useState('');
    const [deleteId, setDeleteId] = useState(null);
    const [menuOpen, setMenuOpen] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [homeTab, setHomeTab] = useState('mine'); // mine | shared
    const [shareModal, setShareModal] = useState(null); // quiz id or null
    const [shareEmail, setShareEmail] = useState('');
    const [shareRole, setShareRole] = useState('editor');
    const [collaborators, setCollaborators] = useState([]);
    const [sharedQuizzes, setSharedQuizzes] = useState([]);
    const [userEmail, setUserEmail] = useState(localStorage.getItem('inlead_email') || '');
    const [allDomains, setAllDomains] = useState([]);
    const [showDomains, setShowDomains] = useState(true);

    useEffect(() => {
        (async () => {
            const [q, d] = await Promise.all([getQuizzes(), getAllDomains()]);
            setQuizzes(q);
            setAllDomains(d);
            setLoading(false);
        })();
    }, []);

    // Close menu on click outside
    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e) => {
            if (!e.target.closest('.funnel-card-menu') && !e.target.closest('[data-dropdown]')) {
                setMenuOpen(null);
            }
        };
        setTimeout(() => document.addEventListener('click', handler), 0);
        return () => document.removeEventListener('click', handler);
    }, [menuOpen]);

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

    const handleDelete = async (id) => {
        await deleteQuiz(id);
        setQuizzes(await getQuizzes());
        setMenuOpen(null);
        showToast('Funil excluído!');
    };

    const copyLink = (id) => {
        const url = `${window.location.origin}/q/${id}`;
        navigator.clipboard.writeText(url).then(() => showToast('Link copiado!')).catch(() => showToast('Link: ' + url));
        setMenuOpen(null);
    };

    const filteredQuizzes = quizzes.filter(q => !search || q.name?.toLowerCase().includes(search.toLowerCase()));

    const loadCollaborators = async (qid) => {
        const shares = await getShares(qid);
        setCollaborators(shares);
    };

    const loadShared = async () => {
        if (userEmail) {
            const sq = await getSharedQuizzes(userEmail);
            setSharedQuizzes(sq);
        }
    };

    useEffect(() => { if (homeTab === 'shared') loadShared(); }, [homeTab, userEmail]);

    const handleShare = async () => {
        if (!shareEmail.trim() || !shareModal) return;
        await shareQuiz(shareModal, shareEmail.trim(), shareRole);
        setShareEmail('');
        await loadCollaborators(shareModal);
        showToast('Colaborador adicionado!');
    };

    const handleRemoveShare = async (id) => {
        await removeShare(id);
        await loadCollaborators(shareModal);
        showToast('Colaborador removido');
    };

    const formatDate = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
            <div className="loader" />
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
            {/* Top bar */}
            <div className="dashboard-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11 }}>QF</div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>QuizFlow</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{quizzes.length} funis</span>
                    {isAdmin() && (
                        <button onClick={() => navigate('/admin')} title="Admin" style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', background: 'rgba(99,102,241,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <Shield size={13} color="#6366f1" />
                        </button>
                    )}
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                        {getUser()?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <button onClick={logout} title="Sair" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                        <LogOut size={15} />
                    </button>
                </div>
            </div>

            {/* Content area */}
            <div style={{ padding: '24px 28px' }}>
                {/* Sub header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <button onClick={() => setHomeTab('mine')} style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: homeTab === 'mine' ? 600 : 500, background: 'none', border: 'none', borderBottom: homeTab === 'mine' ? '2px solid var(--text-primary)' : '2px solid transparent', cursor: 'pointer', color: homeTab === 'mine' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            Meus funis
                        </button>
                        <button onClick={() => setHomeTab('shared')} style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: homeTab === 'shared' ? 600 : 500, background: 'none', border: 'none', borderBottom: homeTab === 'shared' ? '2px solid var(--text-primary)' : '2px solid transparent', cursor: 'pointer', color: homeTab === 'shared' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Users size={13} /> Compartilhados
                        </button>
                        <button onClick={() => setHomeTab('domains')} style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: homeTab === 'domains' ? 600 : 500, background: 'none', border: 'none', borderBottom: homeTab === 'domains' ? '2px solid var(--text-primary)' : '2px solid transparent', cursor: 'pointer', color: homeTab === 'domains' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Globe size={13} /> Domínios
                        </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                className="input"
                                placeholder="Buscar funil..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ paddingLeft: 32, width: 220, fontSize: '0.8rem' }}
                            />
                        </div>
                        <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ gap: 6 }}>
                            <Plus size={16} /> Criar Funil
                        </button>
                    </div>
                </div>

                {/* Funnel Grid */}
                {homeTab === 'mine' && filteredQuizzes.length === 0 && !search && (
                    <div className="card animate-in" style={{ maxWidth: 480, margin: '60px auto', padding: '48px 32px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.6 }}><Target size={48} color="var(--text-muted)" /></div>
                        <h3 style={{ marginBottom: 8 }}>Crie seu primeiro funil</h3>
                        <p style={{ fontSize: '0.82rem', marginBottom: 24 }}>Comece criando um funil para captar leads e converter visitantes.</p>
                        <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ margin: '0 auto' }}>
                            <Plus size={16} /> Criar Funil
                        </button>
                    </div>
                )}
                {homeTab === 'mine' && (filteredQuizzes.length > 0 || search) && (
                    <div className="funnel-grid animate-in" style={{ padding: 0 }}>
                        {filteredQuizzes.map(quiz => {
                            const isPageBuilder = quiz.steps?.length > 0 || quiz.emoji === '🧱';
                            const editPath = isPageBuilder ? `/builder/page/${quiz.id}` : `/builder/${quiz.id}`;
                            return (
                                <div key={quiz.id} className="funnel-card" onClick={() => navigate(editPath)}>
                                    <div className="funnel-card-name">{quiz.name || 'Sem título'}</div>
                                    <div className="funnel-card-date">{formatDate(quiz.createdAt || Date.now())}</div>
                                    <button className="funnel-card-menu" onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === quiz.id ? null : quiz.id); }}>
                                        <MoreVertical size={14} />
                                    </button>
                                    {/* Dropdown menu */}
                                    {menuOpen === quiz.id && (
                                        <div data-dropdown style={{
                                            position: 'absolute', top: 40, right: 12, background: '#fff', border: '1px solid var(--border)',
                                            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 160, overflow: 'hidden'
                                        }} onClick={e => e.stopPropagation()}>
                                            <button onClick={() => { navigate(editPath); setMenuOpen(null); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                                <Pencil size={13} /> Editar
                                            </button>
                                            <button onClick={() => { navigate(`${editPath}?tab=leads`); setMenuOpen(null); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                                <BarChart2 size={13} /> Analytics
                                            </button>
                                            <button onClick={() => { setShareModal(quiz.id); setMenuOpen(null); loadCollaborators(quiz.id); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                                <UserPlus size={13} /> Compartilhar
                                            </button>
                                            <button onClick={() => copyLink(quiz.id)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                                <Copy size={13} /> Copiar link
                                            </button>
                                            <div style={{ height: 1, background: 'var(--border)' }} />
                                            <button onClick={() => handleDelete(quiz.id)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--danger)' }}>
                                                <Trash2 size={13} /> Excluir
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* New funnel card */}
                        <div className="funnel-card" onClick={() => setShowCreate(true)}
                            style={{ border: '1px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80, flexDirection: 'column', gap: 4 }}>
                            <Plus size={20} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Novo Funil</span>
                        </div>
                    </div>
                )}

                {/* ═══ SHARED QUIZZES TAB ═══ */}
                {homeTab === 'shared' && (
                    <div>
                        {!userEmail ? (
                            <div className="card" style={{ maxWidth: 420, margin: '40px auto', padding: '32px 28px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Mail size={40} color="var(--primary)" /></div>
                                <h3 style={{ marginBottom: 8 }}>Configure seu email</h3>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>Para ver quizzes compartilhados com você, informe seu email:</p>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input className="input" placeholder="seu@email.com" value={userEmail} onChange={e => setUserEmail(e.target.value)} style={{ flex: 1 }} />
                                    <button className="btn btn-primary" onClick={() => { localStorage.setItem('inlead_email', userEmail); loadShared(); }}>Salvar</button>
                                </div>
                            </div>
                        ) : sharedQuizzes.length === 0 ? (
                            <div className="card" style={{ maxWidth: 420, margin: '40px auto', padding: '32px 28px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Users size={40} color="var(--primary)" /></div>
                                <h3 style={{ marginBottom: 8 }}>Nenhum quiz compartilhado</h3>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8 }}>Quando alguém compartilhar um quiz com <strong>{userEmail}</strong>, ele aparecerá aqui.</p>
                                <button className="btn btn-ghost btn-sm" onClick={() => { setUserEmail(''); localStorage.removeItem('inlead_email'); }} style={{ fontSize: '0.72rem' }}>Trocar email</button>
                            </div>
                        ) : (
                            <div className="funnel-grid" style={{ padding: 0 }}>
                                {sharedQuizzes.map(quiz => {
                                    const editPath = quiz.steps?.length > 0 ? `/builder/page/${quiz.id}` : `/builder/${quiz.id}`;
                                    return (
                                        <div key={quiz.id} className="funnel-card" onClick={() => navigate(editPath)}>
                                            <div className="funnel-card-name">{quiz.name || 'Sem título'}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 6, background: quiz._sharedRole === 'editor' ? 'rgba(99,102,241,0.08)' : 'rgba(245,158,11,0.08)', color: quiz._sharedRole === 'editor' ? '#6366f1' : '#d97706', fontWeight: 600 }}>
                                                    {quiz._sharedRole === 'editor' ? 'Editor' : 'Visualizador'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Domains Tab */}
                {homeTab === 'domains' && (
                    <div>
                        {allDomains.length === 0 ? (
                            <div className="card" style={{ maxWidth: 420, margin: '40px auto', padding: '32px 28px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Globe size={40} color="var(--primary)" /></div>
                                <h3 style={{ marginBottom: 8 }}>Nenhum domínio configurado</h3>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Configure domínios personalizados na aba Domínio de cada funil.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                                {allDomains.map(d => {
                                    const quiz = quizzes.find(q => q.id === d.quiz_id);
                                    const editPath = quiz?.steps?.length > 0 ? `/builder/page/${d.quiz_id}?tab=dominio` : `/builder/${d.quiz_id}?tab=dominio`;
                                    return (
                                        <div key={d.id} className="card" style={{ padding: '14px 18px', cursor: 'pointer', transition: 'var(--transition)', border: '1px solid var(--border)' }}
                                            onClick={() => navigate(editPath)}
                                            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <Globe size={18} color="var(--primary)" />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.domain}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.quizName}</div>
                                                </div>
                                                <span style={{
                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                    fontSize: '0.65rem', fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                                                    background: d.status === 'verified' ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
                                                    color: d.status === 'verified' ? '#16a34a' : '#d97706'
                                                }}>
                                                    {d.status === 'verified' ? <><CheckCircle2 size={11} /> Verificado</> : <><Clock size={11} /> Pendente</>}
                                                </span>
                                                <ExternalLink size={13} color="var(--text-muted)" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Share Modal */}
            {shareModal && (
                <div className="modal-overlay" onClick={() => setShareModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={16} /> Compartilhar Quiz</h3>
                            <button className="modal-close" onClick={() => setShareModal(null)}>×</button>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>Convide colaboradores pelo email para editar ou visualizar este quiz.</p>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <input className="input" placeholder="email@colaborador.com" value={shareEmail} onChange={e => setShareEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleShare()} style={{ flex: 1 }} />
                            <select className="input" value={shareRole} onChange={e => setShareRole(e.target.value)} style={{ width: 120 }}>
                                <option value="editor">Editor</option>
                                <option value="viewer">Visualizador</option>
                            </select>
                            <button className="btn btn-primary btn-sm" onClick={handleShare} disabled={!shareEmail.trim()}>
                                <UserPlus size={14} /> Adicionar
                            </button>
                        </div>
                        {collaborators.length > 0 && (
                            <div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 8 }}>Colaboradores:</div>
                                {collaborators.map(c => (
                                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: '#f9fafb', marginBottom: 6 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 14, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                                            {c.shared_with.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{c.shared_with}</div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{c.role === 'editor' ? 'Editor' : 'Visualizador'}</div>
                                        </div>
                                        <button onClick={() => handleRemoveShare(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}><Trash2 size={13} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {collaborators.length === 0 && <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: '0.82rem' }}>Nenhum colaborador ainda</div>}
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Criar Funil</h3>
                            <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label className="label">Nome do funil</label>
                            <input className="input" placeholder="Ex: Quiz de Emagrecimento" id="newFunnelName" />
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label className="label">Escolha um template</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
                                {[
                                    { name: 'Em branco', icon: <FileText size={28} color="var(--text-muted)" />, mode: 'blank' },
                                    { name: 'Gerar com IA', icon: <Sparkles size={28} color="#f59e0b" />, mode: 'ai' },
                                    { name: 'Clonar URL', icon: <Link2 size={28} color="var(--primary)" />, mode: 'clone' },
                                ].map(t => (
                                    <button key={t.mode} className="card" onClick={() => {
                                        setShowCreate(false);
                                        if (t.mode === 'blank') navigate('/builder/page');
                                        else if (t.mode === 'ai') navigate('/builder?mode=ai');
                                        else navigate('/builder/page?clone=true');
                                    }} style={{
                                        padding: '20px 12px', textAlign: 'center', cursor: 'pointer', border: '1px solid var(--border)',
                                        transition: 'var(--transition)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
                                    }}>
                                        {t.icon}
                                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Click away is handled by document click below */}

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                    background: '#111', color: '#fff', padding: '10px 20px', borderRadius: 10,
                    fontSize: '0.8rem', fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                    animation: 'fadeIn 0.2s',
                }}>
                    {toast}
                </div>
            )}
        </div>
    );
}
