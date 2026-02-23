import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { getQuiz, getLeads, getAnalytics } from '../hooks/useQuizStore';

export default function Dashboard() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [quiz, setQuiz] = useState(null);
    const [leads, setLeads] = useState([]);
    const [raw, setRaw] = useState(null);

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9ca3af' }}>Carregando...</div>
    );

    const starts = raw.starts || 0;
    const completes = raw.completes || 0;
    const answers = raw.answers || [];
    const events = raw.events || [];
    const completionPct = starts > 0 ? Math.round(completes / starts * 100) : 0;
    const ctaClicks = events.filter(e => e.event === 'cta_click').length;
    const pc = quiz.primaryColor || '#2563eb';
    const totalSteps = quiz.steps?.length || quiz.pages?.length || 0;

    // ── Build chart data: count per pageIndex ──
    const answeredPages = {};
    answers.forEach(a => {
        const qi = a.questionIndex ?? a.data?.questionIndex;
        if (qi !== undefined) answeredPages[qi] = (answeredPages[qi] || 0) + 1;
    });

    // Chart points: start + each step that has data + finish
    const chartPoints = [];
    chartPoints.push({ label: 'Início', value: starts });
    for (let i = 0; i < totalSteps; i++) {
        if (answeredPages[i] !== undefined) {
            const stepName = getStepLabel(quiz, i);
            chartPoints.push({ label: stepName, value: answeredPages[i] });
        }
    }
    chartPoints.push({ label: 'Fim', value: completes });

    const maxVal = Math.max(...chartPoints.map(p => p.value), 1);

    // Stopped before half
    const halfIdx = Math.floor(totalSteps / 2);
    const pastHalf = Object.entries(answeredPages).filter(([idx]) => Number(idx) >= halfIdx).reduce((m, [, c]) => Math.max(m, c), 0);
    const stoppedBefore = Math.max(0, starts - pastHalf);

    const exportCSV = () => {
        if (!leads.length) return alert('Sem leads.');
        const rows = [['Nome', 'Email', 'Data'], ...leads.map(l => [l.name || '', l.email || '', l.date ? new Date(l.date).toLocaleDateString('pt-BR') : ''])];
        const b = new Blob([rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' });
        Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: `leads.csv` }).click();
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '40px 20px' }}>
            <div style={{ maxWidth: 640, margin: '0 auto' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
                    <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}>
                        <ArrowLeft size={16} />
                    </button>
                    <h1 style={{ flex: 1, fontSize: '1.2rem', fontWeight: 800, color: '#111' }}>{quiz.name}</h1>
                </div>

                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                    <KPI value={starts} label="Visualizações" color={pc} />
                    <KPI value={`${completionPct}%`} label="Completaram" color="#10b981" />
                    <KPI value={leads.length} label="Leads" color="#8b5cf6" />
                    <KPI value={ctaClicks} label="Cliques no CTA" color="#f59e0b" />
                </div>

                {/* Line Chart */}
                <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', border: '1px solid #e5e7eb', marginBottom: 20 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 20, color: '#111' }}>📊 Retenção por Etapa</div>

                    {starts === 0 ? (
                        <p style={{ textAlign: 'center', color: '#9ca3af', padding: '24px 0', fontSize: '0.85rem' }}>Compartilhe o quiz para ver dados</p>
                    ) : (
                        <>
                            <LineChart points={chartPoints} maxVal={maxVal} color={pc} />

                            {/* Insight */}
                            <div style={{ marginTop: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.6 }}>
                                {completionPct >= 60 && '🎉 Ótima taxa! A maioria finaliza o quiz.'}
                                {completionPct >= 30 && completionPct < 60 && `⚡ ${completionPct}% completam. Boa retenção.`}
                                {completionPct > 0 && completionPct < 30 && `⚠️ Apenas ${completionPct}% completam. Considere encurtar.`}
                                {completionPct === 0 && stoppedBefore > 0 && `⚠️ ${stoppedBefore} de ${starts} pararam antes da metade.`}
                                {completionPct === 0 && stoppedBefore === 0 && '📢 Ninguém finalizou ainda.'}
                            </div>
                        </>
                    )}
                </div>

                {/* Leads */}
                <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111' }}>👥 Leads ({leads.length})</div>
                        {leads.length > 0 && (
                            <button onClick={exportCSV} style={{ all: 'unset', cursor: 'pointer', fontSize: '0.72rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                                <Download size={11} /> CSV
                            </button>
                        )}
                    </div>
                    {leads.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#9ca3af', padding: '16px 0', fontSize: '0.82rem' }}>Nenhum lead ainda</p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <th style={{ textAlign: 'left', padding: '8px 0', color: '#9ca3af', fontWeight: 600 }}>Nome</th>
                                    <th style={{ textAlign: 'left', padding: '8px 0', color: '#9ca3af', fontWeight: 600 }}>Email</th>
                                    <th style={{ textAlign: 'right', padding: '8px 0', color: '#9ca3af', fontWeight: 600 }}>Data</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leads.map((l, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '10px 0', fontWeight: 600, color: '#111' }}>{l.name || '—'}</td>
                                        <td style={{ padding: '10px 0', color: '#6b7280' }}>{l.email || '—'}</td>
                                        <td style={{ padding: '10px 0', color: '#9ca3af', textAlign: 'right' }}>{l.date ? new Date(l.date).toLocaleDateString('pt-BR') : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Helpers ──

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

function KPI({ value, label, color }) {
    return (
        <div style={{ background: '#fff', borderRadius: 14, padding: '18px 14px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 6 }}>{label}</div>
        </div>
    );
}

// ── SVG Line Chart Component ──

function LineChart({ points, maxVal, color }) {
    const W = 560;
    const H = 200;
    const padL = 40;
    const padR = 20;
    const padT = 20;
    const padB = 50;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const n = points.length;
    if (n < 2) return null;

    // Y axis: nice round max
    const niceMax = Math.ceil(maxVal / 5) * 5 || 5;
    const yTicks = [];
    const tickCount = Math.min(5, niceMax);
    for (let i = 0; i <= tickCount; i++) {
        yTicks.push(Math.round(niceMax / tickCount * i));
    }

    const getX = (i) => padL + (i / (n - 1)) * chartW;
    const getY = (val) => padT + chartH - (val / niceMax) * chartH;

    // Build line path
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.value).toFixed(1)}`).join(' ');

    // Build area path (fill under line)
    const areaPath = linePath + ` L ${getX(n - 1).toFixed(1)} ${(padT + chartH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padT + chartH).toFixed(1)} Z`;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
            {/* Grid lines */}
            {yTicks.map(t => (
                <g key={t}>
                    <line x1={padL} y1={getY(t)} x2={W - padR} y2={getY(t)} stroke="#f0f0f0" strokeWidth="1" />
                    <text x={padL - 6} y={getY(t) + 4} textAnchor="end" fontSize="10" fill="#b0b0b0">{t}</text>
                </g>
            ))}

            {/* Area fill */}
            <path d={areaPath} fill={`${color}15`} />

            {/* Line */}
            <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

            {/* Dots + labels */}
            {points.map((p, i) => (
                <g key={i}>
                    {/* Dot */}
                    <circle cx={getX(i)} cy={getY(p.value)} r="4" fill="#fff" stroke={color} strokeWidth="2.5" />

                    {/* Value above dot */}
                    <text x={getX(i)} y={getY(p.value) - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#374151">{p.value}</text>

                    {/* X label */}
                    <text
                        x={getX(i)}
                        y={padT + chartH + 14}
                        textAnchor="end"
                        fontSize="9"
                        fill="#9ca3af"
                        transform={`rotate(-35, ${getX(i)}, ${padT + chartH + 14})`}
                    >{p.label}</text>
                </g>
            ))}

            {/* Y axis label */}
            <text x={4} y={padT + chartH / 2} textAnchor="middle" fontSize="9" fill="#b0b0b0" transform={`rotate(-90, 10, ${padT + chartH / 2})`}>Pessoas</text>
        </svg>
    );
}
