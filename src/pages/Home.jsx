import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BarChart2, Share2, Pencil, Trash2, Zap, ChevronRight } from 'lucide-react';
import { getQuizzes, deleteQuiz, clearAllQuizzes, getAnalytics } from '../hooks/useQuizStore';

export default function Home() {
    const navigate = useNavigate();
    const [quizzes, setQuizzes] = useState([]);
    const [analyticsMap, setAnalyticsMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [deleteId, setDeleteId] = useState(null); // quiz id to confirm delete

    useEffect(() => {
        (async () => {
            const q = await getQuizzes();
            setQuizzes(q);
            const aMap = {};
            await Promise.all(q.map(async quiz => {
                const a = await getAnalytics(quiz.id);
                aMap[quiz.id] = a;
            }));
            setAnalyticsMap(aMap);
            setLoading(false);
        })();
    }, []);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    };

    const handleDelete = (id, e) => {
        e.stopPropagation();
        e.preventDefault();
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (deleteId) {
            await deleteQuiz(deleteId);
            setQuizzes(await getQuizzes());
            setDeleteId(null);
            showToast('Quiz excluído!');
        }
    };

    const handleClearAll = async () => {
        setDeleteId('__all__');
    };

    const confirmClearAll = async () => {
        await clearAllQuizzes();
        setQuizzes([]);
        setDeleteId(null);
        showToast('Tudo limpo!');
    };

    const copyLink = (id, e) => {
        e.stopPropagation();
        e.preventDefault();
        const url = `${window.location.origin}/q/${id}`;
        navigator.clipboard.writeText(url).then(() => {
            showToast('✅ Link copiado!');
        }).catch(() => {
            showToast('Link: ' + url);
        });
    };

    if (loading) return (
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
                <div>Carregando...</div>
            </div>
        </div>
    );

    return (
        <div className="page" style={{ position: 'relative', zIndex: 1 }}>
            <div className="container">
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff' }}>⚡</div>
                            <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>QuizFlow</span>
                        </div>
                        <h1>Seus <span style={{ color: 'var(--primary)' }}>Quizzes</span></h1>
                        <p style={{ marginTop: 8 }}>Crie quizzes interativos e converta visitantes em clientes</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {quizzes.length > 0 && (
                            <button className="btn btn-ghost btn-lg" onClick={handleClearAll} style={{ gap: 8, color: '#ef4444', borderColor: '#fecaca' }}>
                                <Trash2 size={16} /> Limpar Tudo
                            </button>
                        )}
                        <button className="btn btn-primary btn-lg" onClick={() => navigate('/builder')} style={{ gap: 10 }}>
                            <Plus size={20} /> Novo Quiz
                        </button>
                    </div>
                </div>

                {/* Quiz list */}
                {quizzes.length === 0 ? (
                    <div className="card animate-in" style={{ maxWidth: 560, margin: '0 auto', padding: '60px 40px', textAlign: 'center' }}>
                        <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎯</div>
                        <h2 style={{ marginBottom: 12 }}>Crie seu primeiro quiz</h2>
                        <p style={{ marginBottom: 32 }}>Escolha um tema, personalize as perguntas e compartilhe o link. Em menos de 5 minutos seu quiz está no ar.</p>
                        <button className="btn btn-primary btn-lg" onClick={() => navigate('/builder')} style={{ margin: '0 auto' }}>
                            <Plus size={18} /> Criar meu primeiro quiz
                            <ChevronRight size={18} />
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                        {quizzes.map(quiz => {
                            const isPageBuilder = quiz.steps?.length > 0 || quiz.emoji === '🧱';
                            const editPath = isPageBuilder ? `/builder/page/${quiz.id}` : `/builder/${quiz.id}`;
                            return (
                                <div key={quiz.id} className="card animate-in" style={{ overflow: 'hidden' }}>
                                    {/* Color bar */}
                                    <div style={{ height: 3, background: quiz.primaryColor || 'var(--primary)' }} />
                                    <div className="card-body">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                <span style={{ fontSize: '2rem' }}>{quiz.emoji || '📊'}</span>
                                                <div>
                                                    <h3 style={{ marginBottom: 2 }}>{quiz.name}</h3>
                                                    <span className="badge badge-primary">{quiz.steps?.length || quiz.pages?.length || quiz.questions?.length || 0} etapas</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        {(() => {
                                            const a = analyticsMap[quiz.id] || {};
                                            const starts = a.starts || 0;
                                            const leads = a.completes || 0;
                                            const conv = starts > 0 ? Math.round(leads / starts * 100) : 0;
                                            return (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                                                    {[
                                                        { label: 'Inícios', value: starts },
                                                        { label: 'Leads', value: leads },
                                                        { label: 'Conversão', value: `${conv}%` },
                                                    ].map(s => (
                                                        <div key={s.label} style={{ textAlign: 'center', padding: '10px', background: '#f9fafb', borderRadius: 10, border: '1px solid var(--border)' }}>
                                                            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}

                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={e => { e.stopPropagation(); navigate(editPath); }}>
                                                <Pencil size={14} /> Editar
                                            </button>
                                            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={e => { e.stopPropagation(); navigate(`/dashboard/${quiz.id}`); }}>
                                                <BarChart2 size={14} /> Analytics
                                            </button>
                                            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); e.preventDefault(); copyLink(quiz.id, e); }}>
                                                <Share2 size={14} /> Link
                                            </button>
                                            <button className="btn btn-danger btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDelete(quiz.id, e); }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* New quiz card */}
                        <div className="card animate-in" style={{ cursor: 'pointer', border: '1px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}
                            onClick={() => navigate('/builder')}>
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Plus size={32} style={{ marginBottom: 8, color: 'var(--primary)' }} />
                                <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Novo Quiz</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Feature highlights */}
                {quizzes.length === 0 && (
                    <div style={{ marginTop: 64 }}>
                        <h3 style={{ textAlign: 'center', marginBottom: 32, color: 'var(--text-secondary)' }}>Tudo que você precisa para vender com quizzes</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                            {[
                                { icon: '🎯', title: '8 Nichos Prontos', desc: 'Temas pré-carregados com 20 perguntas cada' },
                                { icon: '⚡', title: 'Resultado Dinâmico', desc: 'Perfis personalizados calculados automaticamente' },
                                { icon: '📧', title: 'Captura de Lead', desc: 'Nome e e-mail antes de revelar o resultado' },
                                { icon: '📊', title: 'Analytics Completo', desc: 'Métricas, heatmap de respostas e exportação' },
                            ].map(f => (
                                <div key={f.title} className="card" style={{ padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: 10 }}>{f.icon}</div>
                                    <h4 style={{ marginBottom: 6 }}>{f.title}</h4>
                                    <p style={{ fontSize: '0.85rem' }}>{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                    background: '#111', color: '#fff', padding: '12px 24px', borderRadius: 12,
                    fontSize: '0.85rem', fontWeight: 600, zIndex: 9999,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.25)', animation: 'fadeIn 0.2s',
                }}>
                    {toast}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999,
                }} onClick={() => setDeleteId(null)}>
                    <div style={{
                        background: '#fff', borderRadius: 16, padding: '28px 32px', maxWidth: 380, width: '90%',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: 12 }}>🗑️</div>
                        <h3 style={{ textAlign: 'center', marginBottom: 8, fontSize: '1rem' }}>
                            {deleteId === '__all__' ? 'Apagar todos os quizzes?' : 'Excluir este quiz?'}
                        </h3>
                        <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#6b7280', marginBottom: 20 }}>
                            {deleteId === '__all__' ? 'Todos os quizzes, leads e analytics serão perdidos.' : 'Essa ação não pode ser desfeita.'}
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setDeleteId(null)} style={{
                                flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #d1d5db',
                                background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                            }}>Cancelar</button>
                            <button onClick={deleteId === '__all__' ? confirmClearAll : confirmDelete} style={{
                                flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                                background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                            }}>Excluir</button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
