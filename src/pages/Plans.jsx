import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Zap, Rocket, Check, Lock, BarChart2 } from 'lucide-react';
import { getSubscription } from '../hooks/useAuth';

const PLANS = [
    {
        id: 'starter', name: 'Starter', price: 29.90, color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #818cf8)',
        features: [
            { text: '3 quizzes por mês', included: true },
            { text: '1 geração com IA', included: true },
            { text: 'Clonagem de URL', included: false },
            { text: 'Domínio personalizado', included: true },
            { text: 'Analytics básicos', included: true },
        ],
        icon: Zap, limits: { quiz: 3, ai: 1, clone: 0 },
    },
    {
        id: 'pro', name: 'Pro', price: 49.90, color: '#2563eb', gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)', popular: true,
        features: [
            { text: '8 quizzes por mês', included: true },
            { text: '3 gerações com IA', included: true },
            { text: '1 clone por mês', included: true },
            { text: 'Domínio personalizado', included: true },
            { text: 'Analytics avançados', included: true },
        ],
        icon: Crown, limits: { quiz: 8, ai: 3, clone: 1 },
    },
    {
        id: 'business', name: 'Business', price: 99.90, color: '#059669', gradient: 'linear-gradient(135deg, #059669, #10b981)',
        features: [
            { text: '15 quizzes por mês', included: true },
            { text: '8 gerações com IA', included: true },
            { text: '3 clones por mês', included: true },
            { text: 'Domínio personalizado', included: true },
            { text: 'Analytics + leads ilimitados', included: true },
        ],
        icon: Rocket, limits: { quiz: 15, ai: 8, clone: 3 },
    },
];

export default function Plans() {
    const navigate = useNavigate();
    const [sub, setSub] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const s = await getSubscription();
            setSub(s);
            setLoading(false);
        })();
    }, []);

    const usageBar = (label, used, max, color) => {
        const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
        return (
            <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 5, fontWeight: 500 }}>
                    <span>{label}</span>
                    <span style={{ color: pct >= 100 ? '#ef4444' : '#6b7280' }}>{used}/{max}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: pct >= 100 ? '#ef4444' : color, transition: 'width 0.5s ease' }} />
                </div>
            </div>
        );
    };

    return (
        <div className="page" style={{ position: 'relative', zIndex: 1 }}>
            <div className="container" style={{ maxWidth: 900 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><ArrowLeft size={16} /> Voltar</button>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8 }}>Escolha seu plano</h1>
                    <p style={{ color: '#6b7280', fontSize: '1rem' }}>Desbloqueie mais criações, IA e clonagem para escalar seus funis</p>
                </div>

                {/* Usage summary */}
                {sub && !sub.isAdmin && (
                    <div style={{
                        background: '#fff', borderRadius: 16, padding: '24px 28px', marginBottom: 32,
                        border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                            <BarChart2 size={18} style={{ color: '#6366f1' }} />
                            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Uso deste mês</h3>
                            <span style={{
                                marginLeft: 'auto', padding: '4px 14px', borderRadius: 20, fontSize: '0.72rem',
                                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                                background: PLANS.find(p => p.id === sub.plan)?.gradient || '#6366f1',
                                color: '#fff',
                            }}>
                                {PLANS.find(p => p.id === sub.plan)?.name || sub.plan}
                            </span>
                        </div>
                        {usageBar('Quizzes criados', sub.quiz_count, sub.limits.quiz, '#6366f1')}
                        {usageBar('Gerações com IA', sub.ai_count, sub.limits.ai, '#f59e0b')}
                        {usageBar('Clonagens', sub.clone_count, sub.limits.clone, '#10b981')}
                    </div>
                )}

                {/* Plan cards */}
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {PLANS.map(plan => {
                        const isCurrent = sub?.plan === plan.id;
                        const Icon = plan.icon;
                        return (
                            <div key={plan.id} style={{
                                flex: '1 1 260px', maxWidth: 300, borderRadius: 20, padding: '32px 24px',
                                border: plan.popular ? `2px solid ${plan.color}` : '1px solid #e5e7eb',
                                background: '#fff', position: 'relative', transition: 'all 0.3s',
                                boxShadow: plan.popular ? `0 8px 30px ${plan.color}20` : '0 1px 3px rgba(0,0,0,0.06)',
                                transform: plan.popular ? 'scale(1.03)' : 'none',
                            }}>
                                {plan.popular && (
                                    <div style={{
                                        position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                                        background: plan.gradient, color: '#fff', padding: '5px 18px', borderRadius: 14,
                                        fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.5px',
                                    }}>⭐ MAIS POPULAR</div>
                                )}
                                {isCurrent && (
                                    <div style={{
                                        position: 'absolute', top: 14, right: 14,
                                        background: '#10b981', color: '#fff', padding: '3px 10px', borderRadius: 8,
                                        fontSize: '0.65rem', fontWeight: 700,
                                    }}>✓ ATUAL</div>
                                )}

                                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                    <div style={{
                                        width: 56, height: 56, borderRadius: 16, background: plan.gradient,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 14px',
                                    }}>
                                        <Icon size={26} color="#fff" />
                                    </div>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>{plan.name}</h3>
                                    <div>
                                        <span style={{ fontSize: '2.2rem', fontWeight: 800, color: plan.color }}>
                                            R${plan.price.toFixed(2).replace('.', ',')}
                                        </span>
                                        <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>/mês</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                                    {plan.features.map((f, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}>
                                            {f.included
                                                ? <Check size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                                                : <Lock size={16} style={{ color: '#d1d5db', flexShrink: 0 }} />
                                            }
                                            <span style={{ color: f.included ? '#374151' : '#9ca3af' }}>{f.text}</span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    disabled={isCurrent}
                                    onClick={() => {
                                        alert(`Plano ${plan.name} selecionado! Integração de pagamento em breve.`);
                                    }}
                                    style={{
                                        width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                                        background: isCurrent ? '#f3f4f6' : plan.gradient,
                                        color: isCurrent ? '#9ca3af' : '#fff',
                                        fontWeight: 700, fontSize: '0.9rem',
                                        cursor: isCurrent ? 'default' : 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {isCurrent ? '✓ Plano atual' : 'Escolher plano'}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <p style={{ textAlign: 'center', marginTop: 32, fontSize: '0.82rem', color: '#9ca3af' }}>
                    Os planos são renovados mensalmente. Você pode trocar ou cancelar a qualquer momento.
                </p>
            </div>
        </div>
    );
}
