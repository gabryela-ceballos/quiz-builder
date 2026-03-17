import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreVertical, Trash2, Pencil, BarChart2, Copy, Users, Mail, UserPlus, Target, FileText, Link2, Globe, ExternalLink, CheckCircle2, Clock, Shield, LogOut, Sparkles, Eye, TrendingUp, MousePointerClick, X, ChevronRight, Zap, CheckSquare, Square } from 'lucide-react';
import { getQuizzes, deleteQuiz, getAnalytics, shareQuiz, getShares, removeShare, getSharedQuizzes, getAllDomains } from '../hooks/useQuizStore';
import { getUser, isAdmin, logout, checkQuota, getSubscription } from '../hooks/useAuth';
import UpgradeModal from '../components/UpgradeModal';

// ─── Animated Counter Component ───
function AnimatedStat({ value, label, icon: Icon, gradient, delay = 0 }) {
    const [count, setCount] = useState(0);
    const numVal = typeof value === 'number' ? value : parseInt(value) || 0;

    useEffect(() => {
        if (numVal === 0) return;
        const duration = 800;
        const steps = 30;
        const increment = numVal / steps;
        let current = 0;
        const timer = setTimeout(() => {
            const interval = setInterval(() => {
                current += increment;
                if (current >= numVal) { setCount(numVal); clearInterval(interval); }
                else setCount(Math.floor(current));
            }, duration / steps);
            return () => clearInterval(interval);
        }, delay);
        return () => clearTimeout(timer);
    }, [numVal, delay]);

    return (
        <div className="stat-card-premium stagger-in" style={{ '--stat-gradient': gradient }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: gradient, borderRadius: '14px 14px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <div className="count-up" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                        {typeof value === 'string' ? value : count}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>{label}</div>
                </div>
                <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: gradient, opacity: 0.12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                }}>
                    <Icon size={20} style={{ position: 'absolute', color: gradient.includes('f59e0b') ? '#f59e0b' : gradient.includes('10b981') ? '#10b981' : gradient.includes('8b5cf6') ? '#8b5cf6' : '#6366f1' }} />
                </div>
            </div>
        </div>
    );
}

// ─── Quiz Card Component ───
function QuizCard({ quiz, onEdit, onMenu, menuOpen, onCloseMenu, onDelete, onCopyLink, onShare, onAnalytics, index, isSelected, onToggleSelect }) {
    const navigate = useNavigate();
    const editPath = `/builder/page/${quiz.id}`;
    const [stats, setStats] = useState(null);

    useEffect(() => {
        getAnalytics(quiz.id).then(a => setStats(a)).catch(() => {});
    }, [quiz.id]);

    const starts = stats?.starts || 0;
    const leads = stats?.leads || 0;
    const completes = stats?.completes || 0;
    const convRate = starts > 0 ? Math.round(completes / starts * 100) : 0;
    const stepsCount = quiz.steps?.length || quiz.pages?.length || 0;

    const formatDate = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return 'agora';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d atrás`;
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    };

    return (
        <div className="stagger-in" style={{ animationDelay: `${index * 0.05}s` }}>
            <div style={{
                background: '#fff', border: isSelected ? '2px solid #6366f1' : '1px solid var(--border)', borderRadius: 16,
                cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative',
                overflow: 'hidden',
            }}
                onClick={() => navigate(editPath)}
                onMouseOver={e => { if (!isSelected) { e.currentTarget.style.borderColor = '#d1d5db'; } e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--border)'; } e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
            >
                {/* Selection checkbox */}
                <button
                    onClick={e => { e.stopPropagation(); onToggleSelect?.(quiz.id); }}
                    style={{
                        position: 'absolute', top: 10, left: 10, zIndex: 10,
                        width: 24, height: 24, borderRadius: 6, border: 'none',
                        background: isSelected ? '#6366f1' : 'rgba(255,255,255,0.9)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.15s',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                        opacity: isSelected ? 1 : 0,
                    }}
                    className="quiz-select-btn"
                >
                    {isSelected ? <CheckSquare size={14} color="#fff" /> : <Square size={14} color="#9ca3af" />}
                </button>
                {/* Top gradient accent */}
                <div style={{ height: 3, background: quiz.primaryColor ? `linear-gradient(90deg, ${quiz.primaryColor}, ${quiz.primaryColor}88)` : 'var(--gradient-brand)' }} />

                <div style={{ padding: '16px 18px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {quiz.name || 'Sem título'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{formatDate(quiz.updatedAt || quiz.createdAt)}</span>
                                {stepsCount > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{stepsCount} etapas</span>}
                            </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); onMenu(quiz.id); }}
                            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid transparent', borderRadius: 8, background: 'none', cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.15s', flexShrink: 0 }}
                            onMouseOver={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                            onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; }}
                        >
                            <MoreVertical size={14} />
                        </button>
                    </div>

                    {/* Mini stats */}
                    <div style={{ display: 'flex', gap: 12, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Eye size={12} color="var(--text-muted)" />
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{starts}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Users size={12} color="var(--text-muted)" />
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{leads}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <TrendingUp size={12} color={convRate >= 30 ? '#10b981' : 'var(--text-muted)'} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: convRate >= 30 ? '#10b981' : 'var(--text-secondary)' }}>{convRate}%</span>
                        </div>
                        {starts > 0 && (
                            <div style={{ marginLeft: 'auto' }}>
                                <div className="pulse-dot" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Dropdown menu */}
                {menuOpen && (
                    <div data-dropdown style={{
                        position: 'absolute', top: 48, right: 12, background: '#fff', border: '1px solid var(--border)',
                        borderRadius: 12, boxShadow: '0 12px 36px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 170, overflow: 'hidden',
                        animation: 'fadeIn 0.15s ease',
                    }} onClick={e => e.stopPropagation()}>
                        {[
                            { icon: Pencil, label: 'Editar', action: () => { navigate(editPath); onCloseMenu(); } },
                            { icon: BarChart2, label: 'Analytics', action: () => { navigate(`${editPath}?tab=leads`); onCloseMenu(); } },
                            { icon: UserPlus, label: 'Compartilhar', action: () => { onShare(quiz.id); onCloseMenu(); } },
                            { icon: Copy, label: 'Copiar link', action: () => { onCopyLink(quiz.id); onCloseMenu(); } },
                        ].map((item, i) => (
                            <button key={i} onClick={item.action}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)', transition: 'background 0.1s' }}
                                onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
                                onMouseOut={e => e.currentTarget.style.background = 'none'}
                            >
                                <item.icon size={14} color="var(--text-muted)" /> {item.label}
                            </button>
                        ))}
                        <div style={{ height: 1, background: 'var(--border)' }} />
                        <button onClick={() => onDelete(quiz.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--danger)', transition: 'background 0.1s' }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.04)'}
                            onMouseOut={e => e.currentTarget.style.background = 'none'}
                        >
                            <Trash2 size={14} /> Excluir
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Home() {
    const navigate = useNavigate();
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('info');
    const [search, setSearch] = useState('');
    const [menuOpen, setMenuOpen] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [homeTab, setHomeTab] = useState('mine');
    const [shareModal, setShareModal] = useState(null);
    const [shareEmail, setShareEmail] = useState('');
    const [shareRole, setShareRole] = useState('editor');
    const [collaborators, setCollaborators] = useState([]);
    const [sharedQuizzes, setSharedQuizzes] = useState([]);
    const [userEmail, setUserEmail] = useState(localStorage.getItem('inlead_email') || '');
    const [allDomains, setAllDomains] = useState([]);
    const [globalStats, setGlobalStats] = useState({ views: 0, leads: 0, convRate: '0%' });
    const [newFunnelName, setNewFunnelName] = useState('');
    const [selectedQuizzes, setSelectedQuizzes] = useState(new Set());
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [upgradeAction, setUpgradeAction] = useState('');
    const [upgradePlan, setUpgradePlan] = useState('starter');
    const [showUserMenu, setShowUserMenu] = useState(false);

    useEffect(() => {
        (async () => {
            const [q, d] = await Promise.all([getQuizzes(), getAllDomains()]);
            setQuizzes(q);
            setAllDomains(d);
            setLoading(false);

            // Load global stats
            if (q.length > 0) {
                try {
                    const allAnalytics = await Promise.all(q.map(quiz => getAnalytics(quiz.id)));
                    const totalViews = allAnalytics.reduce((sum, a) => sum + (a.starts || 0), 0);
                    const totalCompletes = allAnalytics.reduce((sum, a) => sum + (a.completes || 0), 0);
                    const totalLeads = allAnalytics.reduce((sum, a) => sum + (a.leads || 0), 0);
                    const rate = totalViews > 0 ? `${Math.round(totalCompletes / totalViews * 100)}%` : '0%';
                    setGlobalStats({ views: totalViews, leads: totalLeads, convRate: rate });
                } catch {}
            }
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

    const showToast = (msg, type = 'info') => { setToast(msg); setToastType(type); setTimeout(() => setToast(''), 2500); };

    const handleDelete = async (id) => {
        await deleteQuiz(id);
        setQuizzes(await getQuizzes());
        setMenuOpen(null);
        selectedQuizzes.delete(id);
        setSelectedQuizzes(new Set(selectedQuizzes));
        showToast('Funil excluído!', 'info');
    };

    const handleBulkDelete = async () => {
        if (selectedQuizzes.size === 0) return;
        const count = selectedQuizzes.size;
        for (const id of selectedQuizzes) {
            await deleteQuiz(id);
        }
        setSelectedQuizzes(new Set());
        setQuizzes(await getQuizzes());
        showToast(`${count} funis excluídos!`, 'info');
    };

    const toggleSelect = (id) => {
        const next = new Set(selectedQuizzes);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedQuizzes(next);
    };

    const toggleSelectAll = () => {
        if (selectedQuizzes.size === filteredQuizzes.length) {
            setSelectedQuizzes(new Set());
        } else {
            setSelectedQuizzes(new Set(filteredQuizzes.map(q => q.id)));
        }
    };

    const copyLink = (id) => {
        const url = `${window.location.origin}/q/${id}`;
        navigator.clipboard.writeText(url).then(() => showToast('✓ Link copiado!', 'success')).catch(() => showToast('Link: ' + url));
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
        showToast('Colaborador adicionado!', 'success');
    };

    const handleRemoveShare = async (id) => {
        await removeShare(id);
        await loadCollaborators(shareModal);
        showToast('Colaborador removido', 'info');
    };

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
            <div className="loader" />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Carregando seus funis...</span>
        </div>
    );

    const tabs = [
        { id: 'mine', label: 'Meus funis', icon: null, count: quizzes.length },
        { id: 'shared', label: 'Compartilhados', icon: Users, count: null },
        { id: 'domains', label: 'Domínios', icon: Globe, count: allDomains.length },
    ];

    const formatDate = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
            {/* ═══ Top bar ═══ */}
            <div style={{
                height: 56, background: '#fff', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', padding: '0 24px',
                position: 'sticky', top: 0, zIndex: 100,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 800, fontSize: 12,
                        boxShadow: '0 2px 8px rgba(99,102,241,0.25)'
                    }}>QF</div>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>QuizFlow</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                    {isAdmin() && (
                        <button onClick={() => navigate('/admin')} title="Admin"
                            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)', background: 'rgba(99,102,241,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}
                            onMouseOut={e => e.currentTarget.style.background = 'rgba(99,102,241,0.06)'}
                        >
                            <Shield size={14} color="#6366f1" />
                        </button>
                    )}
                    <button onClick={() => setShowUserMenu(!showUserMenu)} style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                        boxShadow: showUserMenu ? '0 0 0 3px rgba(99,102,241,0.3)' : 'none',
                        transition: 'box-shadow 0.2s',
                    }}>
                        {getUser()?.name?.[0]?.toUpperCase() || '?'}
                    </button>

                    {/* ── User Dropdown Menu ── */}
                    {showUserMenu && (
                        <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setShowUserMenu(false)} />
                            <div style={{
                                position: 'absolute', top: 44, right: 0, zIndex: 200,
                                background: '#fff', borderRadius: 14, width: 260,
                                boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                                overflow: 'hidden', animation: 'slideDown 0.15s ease',
                            }}>
                                {/* User info header */}
                                <div style={{ padding: '16px 18px', borderBottom: '1px solid #f3f4f6', background: 'linear-gradient(135deg, rgba(99,102,241,0.04), rgba(139,92,246,0.04))' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 12,
                                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 15, fontWeight: 700, flexShrink: 0,
                                        }}>
                                            {getUser()?.name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div style={{ overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {getUser()?.name || 'Usuário'}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {getUser()?.email || ''}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Menu items */}
                                <div style={{ padding: '6px 0' }}>
                                    {[
                                        { label: 'Meu Perfil', icon: '👤', to: '/perfil' },
                                        { label: 'Meu Plano', icon: '💎', to: '/planos', badge: true },
                                        { label: 'Configurações', icon: '⚙️', to: '/configuracoes' },
                                    ].map(item => (
                                        <button key={item.label} onClick={() => { setShowUserMenu(false); navigate(item.to); }}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                                padding: '10px 18px', border: 'none', background: 'none',
                                                cursor: 'pointer', fontSize: '0.85rem', color: '#374151',
                                                transition: 'background 0.1s', textAlign: 'left',
                                            }}
                                            onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
                                            onMouseOut={e => e.currentTarget.style.background = 'none'}
                                        >
                                            <span style={{ fontSize: '1rem', width: 22, textAlign: 'center' }}>{item.icon}</span>
                                            <span style={{ flex: 1 }}>{item.label}</span>
                                            {item.badge && (
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: 6, fontSize: '0.62rem',
                                                    fontWeight: 700, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                    color: '#fff', textTransform: 'uppercase',
                                                }}>Starter</span>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Divider + Logout */}
                                <div style={{ borderTop: '1px solid #f3f4f6', padding: '6px 0' }}>
                                    <button onClick={() => { setShowUserMenu(false); logout(); }}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '10px 18px', border: 'none', background: 'none',
                                            cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444',
                                            transition: 'background 0.1s', textAlign: 'left',
                                        }}
                                        onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.04)'}
                                        onMouseOut={e => e.currentTarget.style.background = 'none'}
                                    >
                                        <span style={{ fontSize: '1rem', width: 22, textAlign: 'center' }}>🚪</span>
                                        <span>Sair</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ═══ Content ═══ */}
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 28px' }}>

                {/* ── Stats Overview ── */}
                {quizzes.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
                        <AnimatedStat value={quizzes.length} label="Total de Funis" icon={Target} gradient="linear-gradient(135deg, #6366f1, #8b5cf6)" delay={0} />
                        <AnimatedStat value={globalStats.views} label="Visualizações" icon={Eye} gradient="linear-gradient(135deg, #3b82f6, #06b6d4)" delay={100} />
                        <AnimatedStat value={globalStats.leads} label="Leads Captados" icon={Users} gradient="linear-gradient(135deg, #10b981, #059669)" delay={200} />
                        <AnimatedStat value={globalStats.convRate} label="Taxa de Conversão" icon={TrendingUp} gradient="linear-gradient(135deg, #f59e0b, #ef4444)" delay={300} />
                    </div>
                )}

                {/* ── Sub header: Tabs + Actions ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#f3f4f6', borderRadius: 10, padding: 3 }}>
                        {tabs.map(t => (
                            <button key={t.id} onClick={() => setHomeTab(t.id)} style={{
                                padding: '7px 16px', fontSize: '0.8rem', fontWeight: homeTab === t.id ? 600 : 500,
                                background: homeTab === t.id ? '#fff' : 'transparent',
                                border: 'none', borderRadius: 8, cursor: 'pointer',
                                color: homeTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                                boxShadow: homeTab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s',
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                {t.icon && <t.icon size={13} />}
                                {t.label}
                                {t.count !== null && t.count > 0 && (
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: homeTab === t.id ? '#6366f1' : 'var(--text-muted)', background: homeTab === t.id ? 'rgba(99,102,241,0.08)' : 'rgba(0,0,0,0.04)', padding: '1px 6px', borderRadius: 6 }}>
                                        {t.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                className="input"
                                placeholder="Buscar funil..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ paddingLeft: 32, width: 200, fontSize: '0.8rem', borderRadius: 10 }}
                            />
                        </div>
                        <button className="btn btn-primary" onClick={() => setShowCreate(true)}
                            style={{ gap: 6, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 10, boxShadow: '0 2px 8px rgba(99,102,241,0.25)' }}>
                            <Plus size={16} /> Criar Funil
                        </button>
                    </div>
                </div>

                {/* ═══ MY QUIZZES TAB ═══ */}
                {homeTab === 'mine' && filteredQuizzes.length === 0 && !search && (
                    <div className="animate-in" style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: 24, margin: '0 auto 20px',
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Sparkles size={36} color="#6366f1" />
                        </div>
                        <h2 style={{ marginBottom: 8, fontSize: '1.3rem' }}>Crie seu primeiro funil</h2>
                        <p style={{ fontSize: '0.88rem', marginBottom: 28, lineHeight: 1.6 }}>Comece criando um quiz para captar leads, engajar visitantes e converter mais.</p>
                        <button className="btn btn-primary" onClick={() => setShowCreate(true)}
                            style={{ margin: '0 auto', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 12, padding: '12px 28px', fontSize: '0.88rem', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}>
                            <Plus size={18} /> Criar meu primeiro funil
                        </button>
                    </div>
                )}

                {homeTab === 'mine' && (filteredQuizzes.length > 0 || search) && (
                    <>
                    {/* Select All bar */}
                    {filteredQuizzes.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <button onClick={toggleSelectAll}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '5px 12px', borderRadius: 8,
                                    border: '1px solid #e5e7eb', background: selectedQuizzes.size === filteredQuizzes.length && filteredQuizzes.length > 0 ? '#6366f1' : '#fff',
                                    color: selectedQuizzes.size === filteredQuizzes.length && filteredQuizzes.length > 0 ? '#fff' : '#6b7280',
                                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {selectedQuizzes.size === filteredQuizzes.length && filteredQuizzes.length > 0 ? <CheckSquare size={14} /> : <Square size={14} />}
                                {selectedQuizzes.size === filteredQuizzes.length && filteredQuizzes.length > 0 ? 'Desmarcar todos' : 'Selecionar todos'}
                            </button>
                            {selectedQuizzes.size > 0 && (
                                <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600 }}>
                                    {selectedQuizzes.size} selecionado{selectedQuizzes.size > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                        {filteredQuizzes.map((quiz, i) => (
                            <QuizCard
                                key={quiz.id}
                                quiz={quiz}
                                index={i}
                                isSelected={selectedQuizzes.has(quiz.id)}
                                onToggleSelect={toggleSelect}
                                menuOpen={menuOpen === quiz.id}
                                onMenu={(id) => setMenuOpen(menuOpen === id ? null : id)}
                                onCloseMenu={() => setMenuOpen(null)}
                                onDelete={handleDelete}
                                onCopyLink={copyLink}
                                onShare={(id) => { setShareModal(id); loadCollaborators(id); }}
                                onAnalytics={(id) => navigate(`/builder/page/${id}?tab=leads`)}
                            />
                        ))}

                        {/* New funnel card */}
                        <div className="stagger-in" style={{ animationDelay: `${filteredQuizzes.length * 0.05}s` }}>
                            <div onClick={() => setShowCreate(true)} style={{
                                border: '2px dashed #d1d5db', borderRadius: 16,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                minHeight: 140, flexDirection: 'column', gap: 8, cursor: 'pointer',
                                transition: 'all 0.2s', background: 'transparent',
                            }}
                                onMouseOver={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = 'rgba(99,102,241,0.02)'; }}
                                onMouseOut={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Plus size={20} color="#6366f1" />
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Novo Funil</span>
                            </div>
                        </div>
                    </div>
                    </>
                )}

                {/* ═══ Bulk Action Bar ═══ */}
                {selectedQuizzes.size > 0 && (
                    <div style={{
                        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                        background: '#1f2937', color: '#fff', borderRadius: 14,
                        padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16,
                        boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 200,
                        animation: 'fadeIn 0.2s ease',
                    }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            {selectedQuizzes.size} funil{selectedQuizzes.size > 1 ? 's' : ''} selecionado{selectedQuizzes.size > 1 ? 's' : ''}
                        </span>
                        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
                        <button onClick={handleBulkDelete}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '8px 16px', borderRadius: 8,
                                border: 'none', background: '#ef4444', color: '#fff',
                                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                transition: 'background 0.15s',
                            }}
                            onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
                            onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
                        >
                            <Trash2 size={14} /> Excluir
                        </button>
                        <button onClick={() => setSelectedQuizzes(new Set())}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 28, height: 28, borderRadius: 8,
                                border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff',
                                cursor: 'pointer', transition: 'background 0.15s',
                            }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* ═══ SHARED QUIZZES TAB ═══ */}
                {homeTab === 'shared' && (
                    <div>
                        {!userEmail ? (
                            <div className="card animate-in" style={{ maxWidth: 420, margin: '40px auto', padding: '36px 28px', textAlign: 'center', borderRadius: 16 }}>
                                <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px', background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Mail size={28} color="var(--primary)" />
                                </div>
                                <h3 style={{ marginBottom: 8 }}>Configure seu email</h3>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>Para ver quizzes compartilhados com você, informe seu email:</p>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input className="input" placeholder="seu@email.com" value={userEmail} onChange={e => setUserEmail(e.target.value)} style={{ flex: 1, borderRadius: 10 }} />
                                    <button className="btn btn-primary" onClick={() => { localStorage.setItem('inlead_email', userEmail); loadShared(); }} style={{ borderRadius: 10 }}>Salvar</button>
                                </div>
                            </div>
                        ) : sharedQuizzes.length === 0 ? (
                            <div className="card animate-in" style={{ maxWidth: 420, margin: '40px auto', padding: '36px 28px', textAlign: 'center', borderRadius: 16 }}>
                                <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Users size={28} color="#6366f1" />
                                </div>
                                <h3 style={{ marginBottom: 8 }}>Nenhum quiz compartilhado</h3>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>Quando alguém compartilhar um quiz com <strong>{userEmail}</strong>, ele aparecerá aqui.</p>
                                <button className="btn btn-ghost btn-sm" onClick={() => { setUserEmail(''); localStorage.removeItem('inlead_email'); }} style={{ fontSize: '0.72rem', borderRadius: 8 }}>Trocar email</button>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                                {sharedQuizzes.map((quiz, i) => {
                                    const editPath = `/builder/page/${quiz.id}`;
                                    return (
                                        <div key={quiz.id} className="stagger-in" style={{ animationDelay: `${i * 0.05}s` }}>
                                            <div style={{
                                                background: '#fff', border: '1px solid var(--border)', borderRadius: 16,
                                                padding: '16px 18px', cursor: 'pointer', transition: 'all 0.2s',
                                            }}
                                                onClick={() => navigate(editPath)}
                                                onMouseOver={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; }}
                                                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                                            >
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>{quiz.name || 'Sem título'}</div>
                                                <span style={{ fontSize: '0.68rem', padding: '3px 10px', borderRadius: 6, fontWeight: 600, background: quiz._sharedRole === 'editor' ? 'rgba(99,102,241,0.08)' : 'rgba(245,158,11,0.08)', color: quiz._sharedRole === 'editor' ? '#6366f1' : '#d97706' }}>
                                                    {quiz._sharedRole === 'editor' ? '✏️ Editor' : '👁 Visualizador'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ DOMAINS TAB ═══ */}
                {homeTab === 'domains' && (
                    <div>
                        {allDomains.length === 0 ? (
                            <div className="card animate-in" style={{ maxWidth: 420, margin: '40px auto', padding: '36px 28px', textAlign: 'center', borderRadius: 16 }}>
                                <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px', background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Globe size={28} color="var(--primary)" />
                                </div>
                                <h3 style={{ marginBottom: 8 }}>Nenhum domínio configurado</h3>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Configure domínios personalizados na aba Domínio de cada funil.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                                {allDomains.map((d, i) => {
                                    const editPath = `/builder/page/${d.quiz_id}?tab=dominio`;
                                    return (
                                        <div key={d.id} className="stagger-in" style={{ animationDelay: `${i * 0.05}s` }}>
                                            <div style={{
                                                background: '#fff', border: '1px solid var(--border)', borderRadius: 14,
                                                padding: '14px 18px', cursor: 'pointer', transition: 'all 0.2s',
                                            }}
                                                onClick={() => navigate(editPath)}
                                                onMouseOver={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <Globe size={18} color="#6366f1" />
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
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* ═══ Share Modal ═══ */}
            {shareModal && (
                <div className="modal-overlay" onClick={() => setShareModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, borderRadius: 20 }}>
                        <div className="modal-header">
                            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Users size={16} color="#6366f1" />
                                </div>
                                Compartilhar Quiz
                            </h3>
                            <button className="modal-close" onClick={() => setShareModal(null)}>×</button>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>Convide colaboradores pelo email para editar ou visualizar este quiz.</p>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <input className="input" placeholder="email@colaborador.com" value={shareEmail} onChange={e => setShareEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleShare()} style={{ flex: 1, borderRadius: 10 }} />
                            <select className="input" value={shareRole} onChange={e => setShareRole(e.target.value)} style={{ width: 120, borderRadius: 10 }}>
                                <option value="editor">Editor</option>
                                <option value="viewer">Visualizador</option>
                            </select>
                            <button className="btn btn-primary btn-sm" onClick={handleShare} disabled={!shareEmail.trim()} style={{ borderRadius: 10 }}>
                                <UserPlus size={14} /> Adicionar
                            </button>
                        </div>
                        {collaborators.length > 0 && (
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Colaboradores</div>
                                {collaborators.map(c => (
                                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#f9fafb', marginBottom: 6 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                                            {c.shared_with.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.shared_with}</div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{c.role === 'editor' ? '✏️ Editor' : '👁 Visualizador'}</div>
                                        </div>
                                        <button onClick={() => handleRemoveShare(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 6, borderRadius: 8, transition: 'background 0.15s' }}
                                            onMouseOver={e => e.currentTarget.style.background = 'rgba(220,38,38,0.06)'}
                                            onMouseOut={e => e.currentTarget.style.background = 'none'}
                                        ><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {collaborators.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.82rem' }}>Nenhum colaborador ainda</div>}
                    </div>
                </div>
            )}

            {/* ═══ Create Modal ═══ */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540, borderRadius: 20 }}>
                        <div className="modal-header">
                            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Zap size={16} color="#6366f1" />
                                </div>
                                Criar Funil
                            </h3>
                            <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label className="label">Nome do funil <span style={{ color: '#ef4444' }}>*</span></label>
                            <input className="input" placeholder="Ex: Quiz de Emagrecimento" value={newFunnelName} onChange={e => setNewFunnelName(e.target.value)} required style={{ borderRadius: 10, borderColor: !newFunnelName.trim() ? '#fca5a5' : undefined }} />
                            {!newFunnelName.trim() && <span style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: 4, display: 'block' }}>Obrigatório — será o nome do seu funil</span>}
                        </div>

                        <div style={{ marginBottom: 8 }}>
                            <label className="label">Escolha como começar</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10 }}>
                                {[
                                    { name: 'Em branco', desc: 'Comece do zero', icon: <FileText size={24} color="var(--text-muted)" />, mode: 'blank', border: 'var(--border)' },
                                    { name: 'Gerar com IA', desc: 'Automático', icon: <Sparkles size={24} color="#f59e0b" />, mode: 'ai', border: 'rgba(245,158,11,0.3)' },
                                    { name: 'Clonar URL', desc: 'Copie um quiz', icon: <Link2 size={24} color="#6366f1" />, mode: 'clone', border: 'rgba(99,102,241,0.3)' },
                                ].map(t => (
                                    <button key={t.mode} disabled={!newFunnelName.trim()} onClick={async () => {
                                        if (!newFunnelName.trim()) return;
                                        // Check quota before navigating
                                        const actionMap = { blank: 'quiz', ai: 'ai', clone: 'clone' };
                                        const quotaAction = actionMap[t.mode];
                                        try {
                                            const check = await checkQuota(quotaAction);
                                            if (!check.allowed) {
                                                setShowCreate(false);
                                                setUpgradeAction(quotaAction);
                                                setUpgradePlan(check.plan);
                                                setShowUpgrade(true);
                                                return;
                                            }
                                        } catch (e) { /* proceed if check fails */ }
                                        const nameParam = newFunnelName ? `&name=${encodeURIComponent(newFunnelName)}` : '';
                                        setShowCreate(false);
                                        if (t.mode === 'blank') navigate(`/builder/page?${nameParam.replace('&', '')}`);
                                        else if (t.mode === 'ai') navigate(`/builder?mode=ai${nameParam}`);
                                        else navigate(`/builder/page?clone=true${nameParam}`);
                                    }} style={{
                                        padding: '20px 14px', textAlign: 'center', cursor: newFunnelName.trim() ? 'pointer' : 'not-allowed',
                                        border: `1px solid ${t.border}`, borderRadius: 14,
                                        transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                        background: '#fff', opacity: newFunnelName.trim() ? 1 : 0.45,
                                    }}
                                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; }}
                                        onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                                    >
                                        <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {t.icon}
                                        </div>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.name}</span>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Upgrade Modal ═══ */}
            <UpgradeModal
                isOpen={showUpgrade}
                onClose={() => setShowUpgrade(false)}
                blockedAction={upgradeAction}
                currentPlan={upgradePlan}
                onSelectPlan={async (planId) => {
                    // For now, just close — real payment integration later
                    alert(`Plano ${planId} selecionado! Integração de pagamento em breve.`);
                    setShowUpgrade(false);
                }}
            />

            {/* ═══ Toast ═══ */}
            {toast && (
                <div className={`toast toast-${toastType}`}>
                    {toast}
                </div>
            )}
        </div>
    );
}
