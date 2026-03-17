import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Eye, Users, TrendingUp, MousePointerClick, Search, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { getQuiz, getLeads, getAnalytics } from '../hooks/useQuizStore';
import DomainSettings from '../components/DomainSettings';

export default function Dashboard() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [quiz, setQuiz] = useState(null);
    const [leads, setLeads] = useState([]);
    const [raw, setRaw] = useState(null);
    const [searchLead, setSearchLead] = useState('');
    const [leadPage, setLeadPage] = useState(0);
    const LEADS_PER_PAGE = 10;

    useEffect(() => {
        (async () => {
            const q = await getQuiz(id);
            if (!q) { navigate('/'); return; }
            setQuiz(q);
            setLeads(await getLeads(id));
            setRaw(await getAnalytics(id));
        })();
    }, [id]);

    if (!quiz || !raw) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
            <div className="loader" />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Carregando analytics...</span>
        </div>
    );

    const starts = raw.starts || 0;
    const completes = raw.completes || 0;
    const answers = raw.answers || [];
    const events = raw.events || [];
    const completionPct = starts > 0 ? Math.round(completes / starts * 100) : 0;
    const ctaClicks = events.filter(e => e.event === 'cta_click').length;
    const pc = quiz.primaryColor || '#6366f1';
    const totalSteps = quiz.steps?.length || quiz.pages?.length || 0;

    // Build chart data
    const answeredPages = {};
    answers.forEach(a => {
        const qi = a.questionIndex ?? a.data?.questionIndex;
        if (qi !== undefined) answeredPages[qi] = (answeredPages[qi] || 0) + 1;
    });

    const chartPoints = [];
    chartPoints.push({ label: 'Início', value: starts });
    for (let i = 0; i < totalSteps; i++) {
        if (answeredPages[i] !== undefined) {
            chartPoints.push({ label: getStepLabel(quiz, i), value: answeredPages[i] });
        }
    }
    chartPoints.push({ label: 'Fim', value: completes });

    const maxVal = Math.max(...chartPoints.map(p => p.value), 1);
    const halfIdx = Math.floor(totalSteps / 2);
    const pastHalf = Object.entries(answeredPages).filter(([idx]) => Number(idx) >= halfIdx).reduce((m, [, c]) => Math.max(m, c), 0);
    const stoppedBefore = Math.max(0, starts - pastHalf);

    // Leads filtering and pagination
    const filteredLeads = leads.filter(l => !searchLead || (l.name || '').toLowerCase().includes(searchLead.toLowerCase()) || (l.email || '').toLowerCase().includes(searchLead.toLowerCase()));
    const totalLeadPages = Math.ceil(filteredLeads.length / LEADS_PER_PAGE);
    const pagedLeads = filteredLeads.slice(leadPage * LEADS_PER_PAGE, (leadPage + 1) * LEADS_PER_PAGE);

    const exportCSV = () => {
        if (!leads.length) return;
        const rows = [['Nome', 'Email', 'Data'], ...leads.map(l => [l.name || '', l.email || '', l.date ? new Date(l.date).toLocaleDateString('pt-BR') : ''])];
        const b = new Blob([rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' });
        Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: `leads-${quiz.name || 'quiz'}.csv` }).click();
    };

    // Insight text
    const getInsight = () => {
        if (starts === 0) return { emoji: '📢', text: 'Compartilhe o link do quiz para começar a receber dados.' };
        if (completionPct >= 60) return { emoji: '🎉', text: `Ótima taxa de ${completionPct}%! A maioria finaliza o quiz.` };
        if (completionPct >= 30) return { emoji: '⚡', text: `${completionPct}% completam o quiz. Boa retenção.` };
        if (completionPct > 0) return { emoji: '⚠️', text: `Apenas ${completionPct}% completam. Considere encurtar o quiz.` };
        if (stoppedBefore > 0) return { emoji: '⚠️', text: `${stoppedBefore} de ${starts} pararam antes da metade.` };
        return { emoji: '📊', text: 'Ninguém finalizou ainda. Continue compartilhando!' };
    };

    const insight = getInsight();

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
            {/* Top bar */}
            <div style={{
                height: 56, background: '#fff', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', padding: '0 24px', position: 'sticky', top: 0, zIndex: 100,
            }}>
                <button onClick={() => navigate('/')} style={{
                    background: 'none', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer',
                    color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                    fontSize: '0.8rem', fontWeight: 500, transition: 'all 0.15s',
                }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'none'; }}
                >
                    <ArrowLeft size={15} /> Voltar
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{quiz.name}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 8 }}>Analytics</span>
                </div>
                <div style={{ width: 80 }} />
            </div>

            <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px' }}>

                {/* ═══ KPIs ═══ */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                    <KPICard value={starts} label="Visualizações" icon={Eye} color="#6366f1" gradient="linear-gradient(135deg, #6366f1, #818cf8)" delay={0} />
                    <KPICard value={`${completionPct}%`} label="Completaram" icon={TrendingUp} color="#10b981" gradient="linear-gradient(135deg, #10b981, #34d399)" delay={100} />
                    <KPICard value={leads.length} label="Leads" icon={Users} color="#8b5cf6" gradient="linear-gradient(135deg, #8b5cf6, #a78bfa)" delay={200} />
                    <KPICard value={ctaClicks} label="Cliques CTA" icon={MousePointerClick} color="#f59e0b" gradient="linear-gradient(135deg, #f59e0b, #fbbf24)" delay={300} />
                </div>

                {/* ═══ Retention Chart ═══ */}
                <div className="stagger-in" style={{ background: '#fff', borderRadius: 18, padding: '24px 28px', border: '1px solid var(--border)', marginBottom: 20, animationDelay: '0.1s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Activity size={16} color="#6366f1" />
                            </div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Retenção por Etapa</span>
                        </div>
                    </div>

                    {starts === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px', background: 'rgba(99,102,241,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Activity size={24} color="var(--text-muted)" />
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Compartilhe o quiz para ver dados</p>
                        </div>
                    ) : (
                        <>
                            <LineChart points={chartPoints} maxVal={maxVal} color={pc} />
                            {/* Insight pill */}
                            <div style={{
                                marginTop: 16, padding: '10px 16px', borderRadius: 12,
                                background: 'linear-gradient(135deg, rgba(99,102,241,0.04), rgba(139,92,246,0.04))',
                                border: '1px solid rgba(99,102,241,0.08)',
                                fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6,
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <span style={{ fontSize: '1.1rem' }}>{insight.emoji}</span>
                                {insight.text}
                            </div>
                        </>
                    )}
                </div>

                {/* ═══ Leads Table ═══ */}
                <div className="stagger-in" style={{ background: '#fff', borderRadius: 18, padding: '24px 28px', border: '1px solid var(--border)', animationDelay: '0.2s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Users size={16} color="#8b5cf6" />
                            </div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Leads</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8b5cf6', background: 'rgba(139,92,246,0.08)', padding: '2px 8px', borderRadius: 6 }}>{leads.length}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {leads.length > 5 && (
                                <div style={{ position: 'relative' }}>
                                    <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input className="input" placeholder="Buscar lead..." value={searchLead} onChange={e => { setSearchLead(e.target.value); setLeadPage(0); }} style={{ paddingLeft: 28, width: 160, fontSize: '0.75rem', height: 32, borderRadius: 8 }} />
                                </div>
                            )}
                            {leads.length > 0 && (
                                <button onClick={exportCSV} style={{
                                    display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                                    border: '1px solid var(--border)', borderRadius: 8, background: 'none',
                                    cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-secondary)',
                                    fontWeight: 600, transition: 'all 0.15s',
                                }}
                                    onMouseOver={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                                    onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                                >
                                    <Download size={12} /> CSV
                                </button>
                            )}
                        </div>
                    </div>

                    {leads.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px 0' }}>
                            <div style={{ width: 48, height: 48, borderRadius: 14, margin: '0 auto 10px', background: 'rgba(139,92,246,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Users size={20} color="var(--text-muted)" />
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Nenhum lead ainda</p>
                        </div>
                    ) : (
                        <>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Lead</th>
                                        <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Email</th>
                                        <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedLeads.map((l, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f5f5f7', transition: 'background 0.1s' }}
                                            onMouseOver={e => e.currentTarget.style.background = '#fafafa'}
                                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={{ padding: '12px 0' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{
                                                        width: 32, height: 32, borderRadius: 10,
                                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
                                                    }}>
                                                        {(l.name || '?')[0].toUpperCase()}
                                                    </div>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.name || '—'}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 0', color: 'var(--text-secondary)' }}>{l.email || '—'}</td>
                                            <td style={{ padding: '12px 0', color: 'var(--text-muted)', textAlign: 'right', fontSize: '0.75rem' }}>
                                                {l.date ? new Date(l.date).toLocaleDateString('pt-BR') : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Pagination */}
                            {totalLeadPages > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                                    <button onClick={() => setLeadPage(p => Math.max(0, p - 1))} disabled={leadPage === 0}
                                        style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: leadPage === 0 ? 'default' : 'pointer', opacity: leadPage === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center' }}>
                                        <ChevronLeft size={14} />
                                    </button>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{leadPage + 1} / {totalLeadPages}</span>
                                    <button onClick={() => setLeadPage(p => Math.min(totalLeadPages - 1, p + 1))} disabled={leadPage >= totalLeadPages - 1}
                                        style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: leadPage >= totalLeadPages - 1 ? 'default' : 'pointer', opacity: leadPage >= totalLeadPages - 1 ? 0.3 : 1, display: 'flex', alignItems: 'center' }}>
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Domain Settings */}
                <div style={{ marginTop: 20 }}>
                    <DomainSettings quizId={id} />
                </div>
            </div>
        </div>
    );
}

// ─── Helpers ───

function getStepLabel(quiz, pageIdx) {
    const steps = quiz.steps || [];
    if (steps[pageIdx]) {
        const s = steps[pageIdx];
        const t = s.blocks?.[0]?.type;
        if (t === 'welcome') return 'Capa';
        if (t === 'capture') return 'Captura';
        if (t === 'insight') return 'Insight';
        if (t === 'social-proof') return 'Social';
        const name = s.name || s.blocks?.[0]?.text || '';
        if (name.length > 12) return name.slice(0, 10) + '…';
        return name || `Q${pageIdx}`;
    }
    return `Q${pageIdx}`;
}

// ─── KPI Card ───
function KPICard({ value, label, icon: Icon, color, gradient, delay }) {
    const [count, setCount] = useState(0);
    const numVal = typeof value === 'number' ? value : parseInt(value) || 0;

    useEffect(() => {
        if (numVal === 0) return;
        const duration = 600;
        const steps = 20;
        const inc = numVal / steps;
        let current = 0;
        const timer = setTimeout(() => {
            const interval = setInterval(() => {
                current += inc;
                if (current >= numVal) { setCount(numVal); clearInterval(interval); }
                else setCount(Math.floor(current));
            }, duration / steps);
        }, delay);
        return () => clearTimeout(timer);
    }, [numVal, delay]);

    return (
        <div className="stagger-in" style={{
            background: '#fff', borderRadius: 16, padding: '18px 16px', textAlign: 'center',
            border: '1px solid var(--border)', position: 'relative', overflow: 'hidden',
            transition: 'all 0.2s',
        }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
        >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: gradient }} />
            <div style={{ width: 36, height: 36, borderRadius: 10, margin: '0 auto 8px', background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={color} />
            </div>
            <div className="count-up" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                {typeof value === 'string' ? value : count}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>{label}</div>
        </div>
    );
}

// ─── SVG Line Chart ───

function LineChart({ points, maxVal, color }) {
    const W = 620;
    const H = 220;
    const padL = 44;
    const padR = 20;
    const padT = 24;
    const padB = 55;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const n = points.length;
    if (n < 2) return null;

    const niceMax = Math.ceil(maxVal / 5) * 5 || 5;
    const yTicks = [];
    const tickCount = Math.min(5, niceMax);
    for (let i = 0; i <= tickCount; i++) {
        yTicks.push(Math.round(niceMax / tickCount * i));
    }

    const getX = (i) => padL + (i / (n - 1)) * chartW;
    const getY = (val) => padT + chartH - (val / niceMax) * chartH;

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.value).toFixed(1)}`).join(' ');
    const areaPath = linePath + ` L ${getX(n - 1).toFixed(1)} ${(padT + chartH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padT + chartH).toFixed(1)} Z`;

    const gradientId = 'chartGrad_' + color.replace('#', '');

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
            <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.01" />
                </linearGradient>
            </defs>

            {/* Grid lines */}
            {yTicks.map(t => (
                <g key={t}>
                    <line x1={padL} y1={getY(t)} x2={W - padR} y2={getY(t)} stroke="#f0f0f0" strokeWidth="1" />
                    <text x={padL - 8} y={getY(t) + 4} textAnchor="end" fontSize="10" fill="#b0b0b0" fontFamily="Inter">{t}</text>
                </g>
            ))}

            {/* Gradient area fill */}
            <path d={areaPath} fill={`url(#${gradientId})`} />

            {/* Line with smooth curve */}
            <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
                <animate attributeName="stroke-dashoffset" from="1000" to="0" dur="1s" fill="freeze" />
                <animate attributeName="stroke-dasharray" from="1000" to="1000" dur="0.01s" fill="freeze" />
            </path>

            {/* Dots + labels */}
            {points.map((p, i) => (
                <g key={i}>
                    {/* Outer glow */}
                    <circle cx={getX(i)} cy={getY(p.value)} r="8" fill={color} opacity="0.1">
                        <animate attributeName="opacity" from="0" to="0.1" dur="0.3s" begin={`${0.3 + i * 0.1}s`} fill="freeze" />
                    </circle>
                    {/* Dot */}
                    <circle cx={getX(i)} cy={getY(p.value)} r="4.5" fill="#fff" stroke={color} strokeWidth="2.5">
                        <animate attributeName="r" from="0" to="4.5" dur="0.3s" begin={`${0.3 + i * 0.1}s`} fill="freeze" />
                    </circle>

                    {/* Value above dot */}
                    <text x={getX(i)} y={getY(p.value) - 12} textAnchor="middle" fontSize="10" fontWeight="700" fill="#374151" fontFamily="Inter">
                        {p.value}
                    </text>

                    {/* X label */}
                    <text
                        x={getX(i)}
                        y={padT + chartH + 16}
                        textAnchor="end"
                        fontSize="9"
                        fill="#9ca3af"
                        fontFamily="Inter"
                        transform={`rotate(-35, ${getX(i)}, ${padT + chartH + 16})`}
                    >{p.label}</text>
                </g>
            ))}
        </svg>
    );
}
