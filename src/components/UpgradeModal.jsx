import { useState } from 'react';
import { X, Crown, Zap, Rocket, Check, Lock } from 'lucide-react';

const PLANS = [
    {
        id: 'starter', name: 'Starter', price: 29.90, color: '#6366f1',
        features: [
            { text: '3 quizzes/mês', included: true },
            { text: '1 geração IA/mês', included: true },
            { text: 'Clonagem de URL', included: false },
        ],
        icon: Zap,
    },
    {
        id: 'pro', name: 'Pro', price: 49.90, color: '#2563eb', popular: true,
        features: [
            { text: '8 quizzes/mês', included: true },
            { text: '3 gerações IA/mês', included: true },
            { text: '1 clone/mês', included: true },
        ],
        icon: Crown,
    },
    {
        id: 'business', name: 'Business', price: 99.90, color: '#059669',
        features: [
            { text: '15 quizzes/mês', included: true },
            { text: '8 gerações IA/mês', included: true },
            { text: '3 clones/mês', included: true },
        ],
        icon: Rocket,
    },
];

const ACTION_LABELS = {
    quiz: 'criação de quiz',
    ai: 'geração com IA',
    clone: 'clonagem de URL',
};

export default function UpgradeModal({ isOpen, onClose, blockedAction, currentPlan, onSelectPlan }) {
    const [loading, setLoading] = useState('');

    if (!isOpen) return null;

    const handleSelect = async (planId) => {
        if (planId === currentPlan) return;
        setLoading(planId);
        try {
            if (onSelectPlan) await onSelectPlan(planId);
        } finally {
            setLoading('');
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: 20, padding: '36px 32px', maxWidth: 780, width: '95%',
                boxShadow: '0 25px 60px rgba(0,0,0,0.25)', position: 'relative',
            }} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: 16, right: 16, background: 'none', border: 'none',
                    cursor: 'pointer', color: '#9ca3af', padding: 4,
                }}>
                    <X size={20} />
                </button>

                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔒</div>
                    <h2 style={{ marginBottom: 6, fontSize: '1.4rem' }}>Limite atingido</h2>
                    {blockedAction && (
                        <p style={{ color: '#6b7280', fontSize: '0.92rem' }}>
                            Você atingiu o limite de <strong>{ACTION_LABELS[blockedAction] || blockedAction}</strong> do seu plano.
                            Faça upgrade para continuar!
                        </p>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {PLANS.map(plan => {
                        const isCurrent = plan.id === currentPlan;
                        const Icon = plan.icon;
                        return (
                            <div key={plan.id} style={{
                                flex: '1 1 220px', maxWidth: 240, borderRadius: 16, padding: '24px 20px',
                                border: plan.popular ? `2px solid ${plan.color}` : '1px solid #e5e7eb',
                                background: isCurrent ? `${plan.color}08` : '#fff',
                                position: 'relative', transition: 'all 0.2s',
                                boxShadow: plan.popular ? `0 4px 20px ${plan.color}20` : 'none',
                            }}>
                                {plan.popular && (
                                    <div style={{
                                        position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                                        background: plan.color, color: '#fff', padding: '3px 14px', borderRadius: 12,
                                        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px',
                                    }}>MAIS POPULAR</div>
                                )}
                                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                    <Icon size={28} style={{ color: plan.color, marginBottom: 8 }} />
                                    <h3 style={{ fontSize: '1.1rem', marginBottom: 4 }}>{plan.name}</h3>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: plan.color }}>
                                        R${plan.price.toFixed(2).replace('.', ',')}
                                        <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9ca3af' }}>/mês</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                                    {plan.features.map((f, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                                            {f.included
                                                ? <Check size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                                                : <Lock size={14} style={{ color: '#d1d5db', flexShrink: 0 }} />
                                            }
                                            <span style={{ color: f.included ? '#374151' : '#9ca3af' }}>{f.text}</span>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => handleSelect(plan.id)}
                                    disabled={isCurrent || loading === plan.id}
                                    style={{
                                        width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
                                        background: isCurrent ? '#f3f4f6' : plan.color,
                                        color: isCurrent ? '#9ca3af' : '#fff',
                                        fontWeight: 600, fontSize: '0.85rem', cursor: isCurrent ? 'default' : 'pointer',
                                        transition: 'all 0.2s',
                                        opacity: loading === plan.id ? 0.6 : 1,
                                    }}
                                >
                                    {isCurrent ? '✓ Plano atual' : loading === plan.id ? 'Ativando...' : 'Escolher plano'}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.78rem', color: '#9ca3af' }}>
                    Os planos são renovados mensalmente. Você pode trocar a qualquer momento.
                </p>
            </div>
        </div>
    );
}
