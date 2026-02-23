// PageBuilder.jsx — Fixed layout with wider sidebar, proper canvas, block reorder
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Eye, Monitor, Smartphone, ChevronUp, ChevronDown, Trash2, Plus, X, Layout, GripVertical, Bookmark } from 'lucide-react';
import { saveQuiz, getQuiz } from '../hooks/useQuizStore';
import { BLOCK_TYPES, CATEGORIES, createBlock } from '../utils/blockTypes';
import { getAdminTemplates, getUserTemplates, saveUserTemplate, deleteUserTemplate } from '../utils/templates';
import PhonePreview from '../components/PhonePreview';
import PropertiesPanel from '../components/PropertiesPanel';

// ═══ PRE-BUILT STEPS ═══
const READY_STEPS = [
    {
        id: 'welcome', icon: '🏠', name: 'Capa do Quiz', desc: 'Página inicial personalizada', color: '#6c63ff',
        blocks: [{ type: 'welcome', headline: '', subtitle: '', cta: 'Começar →', emoji: '🔥', imageUrl: '', imageWidth: 100, imagePosition: 'top', textAlign: 'center', bgColor: '' }]
    },
    {
        id: 'gender', icon: '👤', name: 'Sexo', desc: 'Gênero do participante', color: '#8b5cf6',
        blocks: [{ type: 'choice', text: 'Qual é o seu sexo?', optionLayout: 'list', options: [{ text: 'Feminino', emoji: '👩', weight: 1 }, { text: 'Masculino', emoji: '👨', weight: 2 }, { text: 'Prefiro não dizer', emoji: '🤐', weight: 0 }] }]
    },
    {
        id: 'age', icon: '🎂', name: 'Idade', desc: 'Faixa etária', color: '#3b82f6',
        blocks: [{ type: 'choice', text: 'Qual é a sua faixa etária?', optionLayout: 'list', options: [{ text: '18-24 anos', emoji: '🌱', weight: 1 }, { text: '25-34 anos', emoji: '💪', weight: 2 }, { text: '35-44 anos', emoji: '⭐', weight: 3 }, { text: '45-54 anos', emoji: '🌟', weight: 4 }, { text: '55+ anos', emoji: '👑', weight: 5 }] }]
    },
    {
        id: 'height', icon: '📏', name: 'Altura', desc: 'Roleta de altura (cm)', color: '#06b6d4',
        blocks: [{ type: 'scroll-picker', text: 'Qual é a sua altura?', unit: 'cm', min: 140, max: 210, step: 1, defaultValue: 170 }]
    },
    {
        id: 'weight', icon: '⚖️', name: 'Peso', desc: 'Digita o peso', color: '#10b981',
        blocks: [{ type: 'number-input', text: 'Qual é o seu peso?', unit: 'kg', placeholder: 'Ex: 72', min: 30, max: 250, imageUrl: '' }]
    },
    {
        id: 'bmi', icon: '📊', name: 'Cálculo de IMC', desc: 'Calcula IMC automático', color: '#8b5cf6',
        blocks: [{ type: 'bmi', title: 'Seu IMC', text: 'Resultado calculado com base nas suas respostas' }]
    },
    {
        id: 'goal', icon: '🎯', name: 'Objetivo', desc: 'Meta principal', color: '#f59e0b',
        blocks: [{ type: 'choice', text: 'Qual é o seu principal objetivo?', optionLayout: 'list', options: [{ text: 'Perder peso', emoji: '🔥', weight: 1 }, { text: 'Ganhar massa muscular', emoji: '💪', weight: 2 }, { text: 'Melhorar a saúde', emoji: '❤️', weight: 3 }, { text: 'Ter mais energia', emoji: '⚡', weight: 4 }, { text: 'Viver melhor', emoji: '🌟', weight: 5 }] }]
    },
    {
        id: 'activity', icon: '🏃', name: 'Atividade Física', desc: 'Nível de atividade', color: '#ef4444',
        blocks: [{ type: 'likert', text: 'Qual o seu nível de atividade física atualmente?', options: [{ text: 'Sedentário', value: 1, weight: 1 }, { text: 'Pouco ativo', value: 2, weight: 2 }, { text: 'Moderado', value: 3, weight: 3 }, { text: 'Ativo', value: 4, weight: 4 }, { text: 'Muito ativo', value: 5, weight: 5 }] }]
    },
    {
        id: 'diet', icon: '🥗', name: 'Alimentação', desc: 'Hábitos alimentares', color: '#22c55e',
        blocks: [{ type: 'choice', text: 'Como você descreveria sua alimentação?', optionLayout: 'list', options: [{ text: 'Muito desregulada', emoji: '🍔', weight: 1 }, { text: 'Poderia melhorar', emoji: '🤷', weight: 2 }, { text: 'Razoavelmente saudável', emoji: '🥗', weight: 3 }, { text: 'Bem equilibrada', emoji: '✅', weight: 4 }] }]
    },
    {
        id: 'sleep', icon: '😴', name: 'Sono', desc: 'Qualidade do sono', color: '#6366f1',
        blocks: [{ type: 'likert', text: 'Como está a qualidade do seu sono?', options: [{ text: '😰 Péssimo', value: 1, weight: 1 }, { text: '😩 Ruim', value: 2, weight: 2 }, { text: '😐 Regular', value: 3, weight: 3 }, { text: '😊 Bom', value: 4, weight: 4 }, { text: '😴 Excelente', value: 5, weight: 5 }] }]
    },
    {
        id: 'stress', icon: '🧠', name: 'Estresse', desc: 'Nível de estresse', color: '#ec4899',
        blocks: [{ type: 'likert', text: 'De 1 a 5, qual é o seu nível de estresse diário?', options: [{ text: 'Bem tranquilo', value: 1, weight: 1 }, { text: 'Controlável', value: 2, weight: 2 }, { text: 'Moderado', value: 3, weight: 3 }, { text: 'Alto', value: 4, weight: 4 }, { text: 'Extremo', value: 5, weight: 5 }] }]
    },
    {
        id: 'water', icon: '💧', name: 'Hidratação', desc: 'Consumo de água', color: '#0ea5e9',
        blocks: [{ type: 'likert', text: 'Quantos copos de água você bebe por dia?', options: [{ text: '🥤 1-2 copos', value: 1, weight: 1 }, { text: '🥤🥤 3-4 copos', value: 2, weight: 2 }, { text: '🥤🥤🥤 5-6 copos', value: 3, weight: 3 }, { text: '💧💧💧💧 7-8 copos', value: 4, weight: 4 }, { text: '🌊🌊🌊🌊🌊 8+ copos', value: 5, weight: 5 }] }]
    },
    {
        id: 'exercise_freq', icon: '🏋️', name: 'Frequência de Treino', desc: 'Quantas vezes treina', color: '#f97316',
        blocks: [{ type: 'choice', text: 'Com que frequência você se exercita?', optionLayout: 'list', options: [{ text: 'Não me exercito', emoji: '🛋️', weight: 1 }, { text: '1-2x por semana', emoji: '🚶', weight: 2 }, { text: '3-4x por semana', emoji: '🏃', weight: 3 }, { text: '5+ vezes por semana', emoji: '💪', weight: 4 }] }]
    },
    {
        id: 'motivation', icon: '🔥', name: 'Motivação', desc: 'Disposição para mudar', color: '#dc2626',
        blocks: [{ type: 'statement', text: 'Estou pronto(a) para fazer mudanças na minha vida hoje?', quote: 'A mudança começa quando você decide agir', options: ['Ainda não tenho certeza', 'Preciso de ajuda para começar', 'Estou quase decidido(a)', 'Totalmente decidido(a)!'] }]
    },
];

function makeStep(name = 'Nova Etapa') {
    return { id: `stp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, blocks: [] };
}

export default function PageBuilder() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id: editId } = useParams();
    const [steps, setSteps] = useState([]);
    const [activeStepIdx, setActiveStepIdx] = useState(0);
    const [selectedBlockIdx, setSelectedBlockIdx] = useState(null);
    const [viewMode, setViewMode] = useState('mobile');
    const [saved, setSaved] = useState(null);
    const [dragFromSidebar, setDragFromSidebar] = useState(null);
    const [dragOverBlockIdx, setDragOverBlockIdx] = useState(null);
    const [showTemplates, setShowTemplates] = useState(false);
    const [sidebarTab, setSidebarTab] = useState('blocks'); // 'blocks' | 'steps'
    const [isClone, setIsClone] = useState(false);
    const [clonedResults, setClonedResults] = useState(null);
    const [quizId, setQuizId] = useState(null);
    const [config, setConfig] = useState({ name: '', primaryColor: '#2563eb', bgColor: '', niche: 'outro', collectLead: true, welcomeHeadline: '', welcomeSub: '', welcomeCta: 'Começar →' });

    // ── Resizable sidebars ──
    const [leftW, setLeftW] = useState(260);
    const [rightW, setRightW] = useState(300);
    const resizing = useRef(null);
    const onResizeStart = useCallback((side) => (e) => {
        e.preventDefault();
        resizing.current = { side, startX: e.clientX, startW: side === 'left' ? leftW : rightW };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [leftW, rightW]);
    useEffect(() => {
        const onMove = (e) => {
            if (!resizing.current) return;
            const { side, startX, startW } = resizing.current;
            const delta = e.clientX - startX;
            if (side === 'left') setLeftW(Math.max(180, Math.min(450, startW + delta)));
            else setRightW(Math.max(200, Math.min(500, startW - delta)));
        };
        const onUp = () => { resizing.current = null; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, []);

    useEffect(() => {
        // Load existing quiz for editing
        if (editId) {
            getQuiz(editId).then(q => {
                if (!q) return;
                setQuizId(q.id);
                setConfig(c => ({
                    ...c,
                    name: q.name || '',
                    primaryColor: q.primaryColor || '#2563eb',
                    bgColor: q.bgColor || '',
                    niche: q.niche || 'outro',
                    collectLead: q.collectLead !== false,
                    welcomeHeadline: q.welcome?.headline || '',
                    welcomeSub: q.welcome?.subheadline || '',
                    welcomeCta: q.welcome?.cta || 'Começar →',
                }));
                if (q.steps?.length) {
                    setSteps(q.steps);
                    setActiveStepIdx(0);
                } else if (q.pages?.length) {
                    // Reconstruct steps from pages
                    const ns = q.pages.map((p, i) => {
                        if (p.type === 'compound' && p.blocks) {
                            return { id: `stp_${Date.now()}_${i}`, name: `Etapa ${i + 1}`, blocks: p.blocks };
                        }
                        return { id: `stp_${Date.now()}_${i}`, name: p.text || p.headline || `Etapa ${i + 1}`, blocks: [p] };
                    });
                    setSteps(ns);
                    setActiveStepIdx(0);
                }
                if (q.results?.length) setClonedResults(q.results);
            });
            return;
        }

        const cd = location.state?.cloneData;
        if (cd) {
            setIsClone(true);
            setConfig(c => ({ ...c, name: cd.quizName || '', primaryColor: cd.primaryColor || '#2563eb', niche: cd.niche || 'outro', welcomeHeadline: cd.welcome?.headline || '', welcomeSub: cd.welcome?.subheadline || '', welcomeCta: cd.welcome?.cta || 'Começar →' }));
            if (cd.steps?.length) { setSteps(cd.steps); setActiveStepIdx(0); }
            else if (cd.blocks?.length) {
                const ns = cd.blocks.map((b, i) => ({ id: `stp_${Date.now()}_${i}`, name: b.text || b.title || `Etapa ${i + 1}`, blocks: [b] }));
                setSteps(ns); setActiveStepIdx(0);
            }
            if (cd.results?.length) setClonedResults(cd.results);
        } else if (!location.state) setShowTemplates(true);
    }, [editId]);

    const activeStep = steps[activeStepIdx] || null;
    const selectedBlock = activeStep && selectedBlockIdx !== null ? activeStep.blocks[selectedBlockIdx] : null;
    const updateConfig = (k, v) => setConfig(c => ({ ...c, [k]: v }));

    const updateBlock = (bi, nb) => setSteps(s => s.map((st, si) => si === activeStepIdx ? { ...st, blocks: st.blocks.map((b, i) => i === bi ? nb : b) } : st));
    const deleteBlock = (bi) => { setSteps(s => s.map((st, si) => si === activeStepIdx ? { ...st, blocks: st.blocks.filter((_, i) => i !== bi) } : st)); setSelectedBlockIdx(null); };

    const addBlockToStep = (type, insertAt = null) => {
        if (!steps.length) { const ns = makeStep('Etapa 1'); setSteps([ns]); setActiveStepIdx(0); }
        const nb = createBlock(type);
        setSteps(s => s.map((st, si) => {
            if (si !== (steps.length ? activeStepIdx : 0)) return st;
            const blocks = [...st.blocks];
            insertAt !== null ? blocks.splice(insertAt, 0, nb) : blocks.push(nb);
            return { ...st, blocks };
        }));
        setSelectedBlockIdx(insertAt ?? (activeStep?.blocks.length || 0));
    };

    const reorderBlock = (from, to) => {
        setSteps(s => s.map((st, si) => {
            if (si !== activeStepIdx) return st;
            const blocks = [...st.blocks]; const [moved] = blocks.splice(from, 1);
            blocks.splice(to > from ? to - 1 : to, 0, moved);
            return { ...st, blocks };
        }));
        setSelectedBlockIdx(to > from ? to - 1 : to);
    };

    const moveStep = (i, dir) => { const ni = i + dir; if (ni < 0 || ni >= steps.length) return; setSteps(s => { const a = [...s];[a[i], a[ni]] = [a[ni], a[i]]; return a; }); if (activeStepIdx === i) setActiveStepIdx(ni); };
    const deleteStep = (i) => { setSteps(s => s.filter((_, j) => j !== i)); if (activeStepIdx === i) { setActiveStepIdx(Math.max(0, i - 1)); setSelectedBlockIdx(null); } else if (activeStepIdx > i) setActiveStepIdx(a => a - 1); };
    const addStep = (name = 'Nova Etapa') => { const ns = makeStep(name); setSteps(s => [...s, ns]); setActiveStepIdx(steps.length); setSelectedBlockIdx(null); };
    const renameStep = (i, name) => setSteps(s => s.map((st, si) => si === i ? { ...st, name } : st));

    const loadTemplate = (t) => {
        // Templates from store have steps as data, not functions
        const tSteps = typeof t.steps === 'function' ? t.steps() : JSON.parse(JSON.stringify(t.steps || []));
        setSteps(tSteps);
        setConfig(c => ({ ...c, name: t.name || '', primaryColor: t.color || c.primaryColor }));
        setActiveStepIdx(0); setSelectedBlockIdx(null); setShowTemplates(false);
    };

    const saveCurrentAsTemplate = () => {
        const name = prompt('Nome do template:');
        if (!name) return;
        saveUserTemplate({
            name,
            desc: `Template com ${steps.length} etapas`,
            color: config.primaryColor || '#6c63ff',
            tags: ['meu'],
            steps: JSON.parse(JSON.stringify(steps)),
        });
        alert('✅ Template salvo!');
    };

    const handleDropBlock = useCallback((insertIdx) => {
        if (dragFromSidebar) { addBlockToStep(dragFromSidebar, insertIdx); setDragFromSidebar(null); }
        setDragOverBlockIdx(null);
    }, [dragFromSidebar, activeStepIdx, steps]);

    const buildQuiz = () => {
        const id = quizId || editId || Math.random().toString(36).slice(2, 10);
        // Filter out empty steps, then each step = 1 page
        const nonEmptySteps = steps.filter(s => s.blocks.length > 0);
        const pages = nonEmptySteps.map((s, si) => {
            if (s.blocks.length === 1) {
                return { ...s.blocks[0], id: `p${si}_0`, sectionIndex: 0 };
            }
            // Compound page: multiple blocks in one screen
            return { id: `p${si}`, type: 'compound', sectionIndex: 0, blocks: s.blocks.map((b, bi) => ({ ...b, id: `p${si}_${bi}` })) };
        });
        const allBlocks = nonEmptySteps.flatMap(s => s.blocks);
        const dr = [{ id: 'r1', name: 'A', minPct: 0, maxPct: 40, description: 'Resultado A', cta: 'Ver →', ctaUrl: '' }, { id: 'r2', name: 'B', minPct: 41, maxPct: 70, description: 'Resultado B', cta: 'Ver →', ctaUrl: '' }, { id: 'r3', name: 'C', minPct: 71, maxPct: 100, description: 'Resultado C', cta: 'Ver →', ctaUrl: '' }];
        return { id, name: config.name || 'Meu Quiz', emoji: isClone ? '🔗' : '🧱', primaryColor: config.primaryColor, bgColor: config.bgColor, colorPalette: [config.primaryColor], productName: config.name, niche: config.niche, metadata: { niche: config.niche, subTheme: config.name, tone: 'profissional', palette: [config.primaryColor], emojiStyle: 'moderno' }, sections: [{ label: 'Quiz', startIndex: 0 }], welcome: { headline: config.welcomeHeadline || 'Descubra', subheadline: config.welcomeSub || '', cta: config.welcomeCta || 'Começar →' }, pages, questions: allBlocks.filter(b => ['choice', 'statement', 'likert', 'image-select'].includes(b.type)), results: clonedResults || dr, steps, collectLead: config.collectLead, published: false, createdAt: Date.now(), updatedAt: Date.now() };
    };
    const handlePublish = async () => {
        if (!steps.length || !steps.some(s => s.blocks.length > 0)) return alert('Adicione pelo menos 1 bloco!');
        const result = await saveQuiz(buildQuiz());
        if (result) setSaved(result);
    };

    // ═══ Published ═══
    if (saved) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', color: 'var(--text-primary)', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: 400 }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
                <h2 style={{ marginBottom: 8, fontSize: 22 }}>Quiz publicado!</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>Seu quiz está pronto</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/q/${saved.id}`)}>📋 Copiar link</button>
                    <button className="btn btn-ghost" onClick={() => window.open(`/q/${saved.id}`, '_blank')}>👁️ Preview</button>
                    <button className="btn btn-ghost" onClick={() => navigate('/')}>← Início</button>
                </div>
            </div>
        </div>
    );

    // ═══ MAIN ═══
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f9fafb', color: 'var(--text-primary)', overflow: 'hidden' }}>

            {/* ═══ TOP BAR ═══ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0, minHeight: 44 }}>
                <button onClick={() => navigate('/builder')} style={iconBtn}><ArrowLeft size={16} /></button>
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{isClone ? '🔗' : '🧱'} {config.name || 'Page Builder'}</span>
                <button onClick={() => addStep()} style={{ ...chipBtn, background: '#f0fdf4', color: '#059669', borderColor: '#bbf7d0' }} title="Adicionar nova etapa"><Plus size={13} /> Etapa</button>
                <button onClick={() => setShowTemplates(true)} style={chipBtn}><Layout size={13} /> Templates</button>
                <div style={{ display: 'flex', gap: 2 }}>
                    <button style={viewBtn(viewMode === 'desktop')} onClick={() => setViewMode('desktop')}><Monitor size={13} /></button>
                    <button style={viewBtn(viewMode === 'mobile')} onClick={() => setViewMode('mobile')}><Smartphone size={13} /></button>
                </div>
                <button style={chipBtn} onClick={async () => { if (steps.some(s => s.blocks.length)) { const q = buildQuiz(); const s = await saveQuiz(q); if (s) window.open(`/q/${s.id}`, '_blank'); } }}><Eye size={13} /> Preview</button>
                {steps.length > 0 && <button style={{ ...chipBtn, color: '#059669', borderColor: '#bbf7d0' }} onClick={saveCurrentAsTemplate} title="Salvar como template"><Bookmark size={13} /></button>}
                <button style={{ ...chipBtn, background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }} onClick={handlePublish}><Save size={13} /> Publicar</button>
            </div>

            {/* ═══ BODY ═══ */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* ── LEFT SIDEBAR ── */}
                <div style={{ width: leftW, background: '#fff', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>

                    {/* Sidebar tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                        <div style={tabStyle(sidebarTab === 'blocks')} onClick={() => setSidebarTab('blocks')}>Componentes</div>
                        <div style={tabStyle(sidebarTab === 'ready')} onClick={() => setSidebarTab('ready')}>Prontos</div>
                        <div style={tabStyle(sidebarTab === 'steps')} onClick={() => setSidebarTab('steps')}>Etapas ({steps.length})</div>
                    </div>

                    {/* Blocks library */}
                    {sidebarTab === 'blocks' && (
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                            {CATEGORIES.map(cat => (
                                <div key={cat.key} style={{ marginBottom: 6 }}>
                                    <div style={{ padding: '6px 16px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{cat.label}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: '0 8px' }}>
                                        {BLOCK_TYPES.filter(b => b.category === cat.key).map(bt => (
                                            <div key={bt.type}
                                                draggable
                                                onDragStart={() => setDragFromSidebar(bt.type)}
                                                onDragEnd={() => { setDragFromSidebar(null); setDragOverBlockIdx(null); }}
                                                onClick={() => { if (!steps.length) addStep('Etapa 1'); addBlockToStep(bt.type); }}
                                                style={{
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                                                    padding: '10px 4px', cursor: 'grab', borderRadius: 10,
                                                    background: '#f9fafb', border: '1px solid #f3f4f6',
                                                    transition: 'all 0.15s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#f3f4f6'; }}>
                                                <span style={{ fontSize: 20 }}>{bt.icon}</span>
                                                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'center', lineHeight: 1.2 }}>{bt.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Ready-made steps */}
                    {sidebarTab === 'ready' && (
                        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                            <div style={{ padding: '4px 6px 10px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                ⚡ Clique para adicionar uma etapa pronta ao quiz
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {READY_STEPS.map(rs => (
                                    <div key={rs.id}
                                        onClick={() => {
                                            const id = `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                                            const newBlocks = rs.blocks.map(b => ({ ...b, id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }));
                                            const ns = { id, name: rs.name, blocks: newBlocks };
                                            setSteps(s => [...s, ns]);
                                            setActiveStepIdx(steps.length);
                                            setSelectedBlockIdx(null);
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px',
                                            borderRadius: 10, cursor: 'pointer', border: '1px solid #f3f4f6',
                                            background: '#fff', transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = rs.color; e.currentTarget.style.boxShadow = `0 2px 8px ${rs.color}18`; e.currentTarget.style.background = `${rs.color}06`; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#f3f4f6'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#fff'; }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${rs.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                                            {rs.icon}
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{rs.name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 1 }}>{rs.desc}</div>
                                        </div>
                                        <div style={{ fontSize: 14, color: rs.color, flexShrink: 0 }}>+</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Steps list */}
                    {sidebarTab === 'steps' && (
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                            {steps.map((step, i) => (
                                <div key={step.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 10px', marginBottom: 4, cursor: 'pointer', borderRadius: 10,
                                        background: activeStepIdx === i ? 'rgba(37,99,235,0.06)' : '#fff',
                                        border: activeStepIdx === i ? '1px solid rgba(37,99,235,0.2)' : '1px solid transparent',
                                        transition: 'all 0.15s',
                                    }}
                                    onClick={() => { setActiveStepIdx(i); setSelectedBlockIdx(null); }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, width: 20, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <input value={step.name} onChange={e => renameStep(i, e.target.value)} onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'none', border: 'none', outline: 'none', color: activeStepIdx === i ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 500, padding: 0 }} />
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{step.blocks.length} bloco{step.blocks.length !== 1 ? 's' : ''}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                        <button onClick={e => { e.stopPropagation(); moveStep(i, -1); }} style={microBtn} disabled={!i}><ChevronUp size={11} /></button>
                                        <button onClick={e => { e.stopPropagation(); moveStep(i, 1); }} style={microBtn} disabled={i === steps.length - 1}><ChevronDown size={11} /></button>
                                        <button onClick={e => { e.stopPropagation(); deleteStep(i); }} style={{ ...microBtn, color: 'var(--danger)' }}><Trash2 size={11} /></button>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => addStep()} style={{ width: '100%', padding: '12px 0', marginTop: 6, borderRadius: 10, border: '1px dashed #d1d5db', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Plus size={14} /> Nova etapa</button>
                        </div>
                    )}
                </div>

                {/* ── LEFT RESIZE HANDLE ── */}
                <div onMouseDown={onResizeStart('left')} style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0, transition: 'background 0.15s', position: 'relative', zIndex: 10 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--primary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />

                {/* ── CENTER CANVAS ── */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'auto', padding: '24px 16px', background: '#f3f4f6' }}>
                    <PhonePreview
                        step={activeStep}
                        selectedBlockId={selectedBlock?.id}
                        onSelectBlock={i => setSelectedBlockIdx(i)}
                        onDeleteBlock={i => deleteBlock(i)}
                        onBlockChange={(i, b) => updateBlock(i, b)}
                        config={config}
                        viewMode={viewMode}
                        onDropBlock={handleDropBlock}
                        onDragOverBlock={setDragOverBlockIdx}
                        dragOverBlockIdx={dragFromSidebar ? dragOverBlockIdx : null}
                        onReorderBlock={reorderBlock}
                    />
                </div>

                {/* ── RIGHT RESIZE HANDLE ── */}
                <div onMouseDown={onResizeStart('right')} style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0, transition: 'background 0.15s', position: 'relative', zIndex: 10 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--primary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />

                {/* ── RIGHT PANEL ── */}
                <div style={{ width: rightW, background: '#fff', borderLeft: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                    {selectedBlock && (
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bloco selecionado</span>
                            <button onClick={() => deleteBlock(selectedBlockIdx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Trash2 size={12} /> Remover</button>
                        </div>
                    )}
                    <PropertiesPanel
                        block={selectedBlock}
                        onChange={b => selectedBlockIdx !== null && updateBlock(selectedBlockIdx, b)}
                        config={config}
                        onConfigChange={updateConfig}
                    />
                </div>
            </div>

            {/* ═══ TEMPLATE MODAL ═══ */}
            {showTemplates && (() => {
                const adminTs = getAdminTemplates();
                const userTs = getUserTemplates();
                const hasAny = adminTs.length > 0 || userTs.length > 0;
                return (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }} onClick={() => setShowTemplates(false)}>
                        <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 660, width: '92%', maxHeight: '80vh', overflow: 'auto', border: '1px solid var(--border)', boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>📦 Templates</h2>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {steps.length > 0 && <button onClick={() => { saveCurrentAsTemplate(); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#059669' }}><Bookmark size={13} /> Salvar atual</button>}
                                    <button onClick={() => setShowTemplates(false)} style={iconBtn}><X size={18} /></button>
                                </div>
                            </div>

                            {!hasAny && (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                                    <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Nenhum template ainda</p>
                                    <p style={{ fontSize: 13, marginBottom: 16 }}>Crie um quiz e salve como template, ou acesse <strong>/admin</strong> para criar templates globais.</p>
                                </div>
                            )}

                            {/* Admin templates */}
                            {adminTs.length > 0 && (<>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>🔒 Templates globais</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                                    {adminTs.map(t => (
                                        <div key={t.id} onClick={() => loadTemplate(t)} style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s', background: '#fff' }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = t.color || '#6c63ff'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: 4, background: t.color || '#6c63ff' }} />
                                                <span style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</span>
                                            </div>
                                            <p style={{ fontSize: 12, color: '#6b7280', margin: 0, marginBottom: 8, lineHeight: 1.5 }}>{t.desc}</p>
                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                {(t.tags || []).map(tag => <span key={tag} style={{ padding: '2px 7px', borderRadius: 5, background: `${t.color || '#6c63ff'}12`, color: t.color || '#6c63ff', fontSize: 10, fontWeight: 600 }}>{tag}</span>)}
                                                <span style={{ padding: '2px 7px', borderRadius: 5, background: '#f3f4f6', color: '#6b7280', fontSize: 10 }}>{t.steps?.length || 0} etapas</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>)}

                            {/* User templates */}
                            {userTs.length > 0 && (<>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>📁 Meus templates</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                                    {userTs.map(t => (
                                        <div key={t.id} style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', transition: 'all 0.2s', background: '#fff', position: 'relative' }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = t.color || '#6c63ff'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}>
                                            <div onClick={() => loadTemplate(t)} style={{ cursor: 'pointer' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: 4, background: t.color || '#6c63ff' }} />
                                                    <span style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</span>
                                                </div>
                                                <p style={{ fontSize: 12, color: '#6b7280', margin: 0, marginBottom: 8, lineHeight: 1.5 }}>{t.desc}</p>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    {(t.tags || []).map(tag => <span key={tag} style={{ padding: '2px 7px', borderRadius: 5, background: `${t.color || '#6c63ff'}12`, color: t.color || '#6c63ff', fontSize: 10, fontWeight: 600 }}>{tag}</span>)}
                                                    <span style={{ padding: '2px 7px', borderRadius: 5, background: '#f3f4f6', color: '#6b7280', fontSize: 10 }}>{t.steps?.length || 0} etapas</span>
                                                </div>
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); if (confirm('Deletar este template?')) { deleteUserTemplate(t.id); setShowTemplates(false); setTimeout(() => setShowTemplates(true), 10); } }}
                                                style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 2, transition: 'color 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}>
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </>)}

                            <button onClick={() => { setShowTemplates(false); if (!steps.length) addStep('Etapa 1'); }} style={{ width: '100%', padding: '13px 0', marginTop: 8, borderRadius: 12, border: '1px dashed #d1d5db', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, transition: 'all 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = '#9ca3af'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = '#d1d5db'}>
                                ✏️ Começar do zero
                            </button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

// ═══ Styles ═══
const iconBtn = { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 6, borderRadius: 6 };
const chipBtn = { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, transition: 'all 0.15s' };
const viewBtn = (a) => ({ padding: '6px 10px', borderRadius: 8, border: `1px solid ${a ? 'var(--primary)' : 'var(--border)'}`, background: a ? 'rgba(37,99,235,0.06)' : 'transparent', cursor: 'pointer', color: a ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', transition: 'all 0.15s' });
const microBtn = { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' };
const tabStyle = (a) => ({ flex: 1, padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottom: a ? '2px solid var(--primary)' : '2px solid transparent', color: a ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.15s' });
