// PageBuilder.jsx — Inlead-style layout with sidebar, tabs, canvas, right panel
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Save, Eye, Monitor, Smartphone, ChevronUp, ChevronDown, Trash2, Plus, X, Layout, Bookmark, Settings, Share2, Play, Undo2, Redo2, Grid, MousePointerClick, CheckCircle2, Users, BarChart3, Palette, Package, GitBranch, Globe, Star, Upload, Download, Filter, TrendingDown, Mail, PlayCircle, Lightbulb, Wrench, Clipboard, ArrowRight } from 'lucide-react';
import { saveQuiz, getQuiz, getAnalytics, getLeads } from '../hooks/useQuizStore';
import { BLOCK_TYPES, CATEGORIES, createBlock } from '../utils/blockTypes';
import { getAdminTemplates, getUserTemplates, saveUserTemplate, deleteUserTemplate } from '../utils/templates';
import { cloneAndOptimize } from '../utils/cloneService';
import PhonePreview from '../components/PhonePreview';
import PropertiesPanel from '../components/PropertiesPanel';
import DomainSettings from '../components/DomainSettings';

// ═══ PRE-BUILT STEPS ═══
const READY_STEPS = [
    { id: 'welcome', icon: '🏠', name: 'Capa do Quiz', desc: 'Página inicial personalizada', color: '#6c63ff', blocks: [{ type: 'welcome', headline: '', subtitle: '', cta: 'Começar →', emoji: '🔥', imageUrl: '', imageWidth: 100, imagePosition: 'top', textAlign: 'center', bgColor: '' }] },
    { id: 'gender', icon: '👤', name: 'Sexo', desc: 'Gênero do participante', color: '#8b5cf6', blocks: [{ type: 'choice', text: 'Qual é o seu sexo?', optionLayout: 'list', options: [{ text: 'Feminino', emoji: '👩', weight: 1 }, { text: 'Masculino', emoji: '👨', weight: 2 }, { text: 'Prefiro não dizer', emoji: '🤐', weight: 0 }] }] },
    { id: 'age', icon: '🎂', name: 'Idade', desc: 'Faixa etária', color: '#3b82f6', blocks: [{ type: 'choice', text: 'Qual é a sua faixa etária?', optionLayout: 'list', options: [{ text: '18-24 anos', emoji: '🌱', weight: 1 }, { text: '25-34 anos', emoji: '💪', weight: 2 }, { text: '35-44 anos', emoji: '⭐', weight: 3 }, { text: '45-54 anos', emoji: '🌟', weight: 4 }, { text: '55+ anos', emoji: '👑', weight: 5 }] }] },
    { id: 'height', icon: '📏', name: 'Altura', desc: 'Régua de altura', color: '#06b6d4', blocks: [{ type: 'scroll-picker', text: 'Qual é a sua altura?', unit: 'cm', min: 140, max: 210, step: 1, defaultValue: 170 }] },
    { id: 'weight', icon: '⚖️', name: 'Peso', desc: 'Peso corporal', color: '#10b981', blocks: [{ type: 'number-input', text: 'Qual é o seu peso?', unit: 'kg', placeholder: 'Ex: 72', min: 30, max: 250, imageUrl: '' }] },
    { id: 'bmi', icon: '📊', name: 'Cálculo de IMC', desc: 'Calcula IMC automático', color: '#8b5cf6', blocks: [{ type: 'bmi', title: 'Seu IMC', text: 'Resultado calculado' }] },
    { id: 'goal', icon: '🎯', name: 'Objetivo', desc: 'Meta principal', color: '#f59e0b', blocks: [{ type: 'choice', text: 'Qual é o seu principal objetivo?', optionLayout: 'list', options: [{ text: 'Perder peso', emoji: '🔥', weight: 1 }, { text: 'Ganhar massa', emoji: '💪', weight: 2 }, { text: 'Melhorar saúde', emoji: '❤️', weight: 3 }] }] },
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
    const [isClone, setIsClone] = useState(false);
    const [clonedResults, setClonedResults] = useState(null);
    const [quizId, setQuizId] = useState(null);
    const [activeTab, setActiveTab] = useState(() => {
        const urlTab = new URLSearchParams(window.location.search).get('tab');
        return urlTab || 'construtor';
    }); // construtor | design | leads | fluxo | dominio
    const [leadSubTab, setLeadSubTab] = useState('respostas'); // respostas | resultados | performance
    const [showShare, setShowShare] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [showAiStepModal, setShowAiStepModal] = useState(false);
    const [aiStepPrompt, setAiStepPrompt] = useState('');
    const [aiStepLoading, setAiStepLoading] = useState(false);
    const [renamingStepIdx, setRenamingStepIdx] = useState(null);
    const [showCloneModal, setShowCloneModal] = useState(false);
    const [cloneUrl, setCloneUrl] = useState('');
    const [cloneNiche, setCloneNiche] = useState('emagrecimento');
    const [cloneMode, setCloneMode] = useState('screenshots');
    const [cloneProduct, setCloneProduct] = useState('');
    const [cloneLoading, setCloneLoading] = useState(false);
    const [cloneProgress, setCloneProgress] = useState({ stage: '', msg: '', pct: 0 });
    const [cloneError, setCloneError] = useState(null);
    const [cloneLog, setCloneLog] = useState([]);
    const [toast, setToast] = useState('');
    const [rightPanelTab, setRightPanelTab] = useState('etapa');
    const [config, setConfig] = useState({
        name: '', primaryColor: '#2563eb', bgColor: '', bgImage: '', logoUrl: '', niche: 'outro', collectLead: true,
        productDescription: '', targetAudience: '',
        welcomeHeadline: '', welcomeSub: '', welcomeCta: 'Começar →',
        // Design tab globals
        alignment: 'center', mainWidth: 'small', elementSize: 'default',
        spacing: 'small', borderRadius: 'medium',
        showLogo: true, showProgress: true, allowBack: true,
        fontFamily: 'Inter', fontSize: 'default',
        headerColor: '#111', bodyColor: '#fff',
    });

    // Analytics state for Leads tab
    const [analytics, setAnalytics] = useState(null);
    const [leads, setLeads] = useState([]);

    useEffect(() => {
        if (editId) {
            getQuiz(editId).then(q => {
                if (!q) return;
                setQuizId(q.id);
                setConfig(c => ({ ...c, name: q.name || '', primaryColor: q.primaryColor || '#2563eb', bgColor: q.bgColor || '', niche: q.niche || 'outro', collectLead: q.collectLead !== false, welcomeHeadline: q.welcome?.headline || '', welcomeSub: q.welcome?.subheadline || '', welcomeCta: q.welcome?.cta || 'Começar →' }));
                if (q.steps?.length) { setSteps(q.steps); setActiveStepIdx(0); }
                else if (q.pages?.length) {
                    const ns = q.pages.map((p, i) => {
                        if (p.type === 'compound' && p.blocks) return { id: `stp_${Date.now()}_${i}`, name: `Etapa ${i + 1}`, blocks: p.blocks };
                        return { id: `stp_${Date.now()}_${i}`, name: p.text || p.headline || `Etapa ${i + 1}`, blocks: [p] };
                    });
                    setSteps(ns); setActiveStepIdx(0);
                }
                if (q.results?.length) setClonedResults(q.results);
            });
            // Load analytics/leads
            getAnalytics(editId).then(a => setAnalytics(a));
            getLeads(editId).then(l => setLeads(l || []));
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
        } else if (!location.state) {
            setShowOnboarding(true);
        }
    }, [editId]);

    const activeStep = steps[activeStepIdx] || null;
    const selectedBlock = activeStep && selectedBlockIdx !== null ? activeStep.blocks[selectedBlockIdx] : null;
    const updateConfig = (k, v) => setConfig(c => ({ ...c, [k]: v }));
    const showToastMsg = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

    const updateBlock = (bi, nb) => setSteps(s => s.map((st, si) => si === activeStepIdx ? { ...st, blocks: st.blocks.map((b, i) => i === bi ? nb : b) } : st));
    const deleteBlock = (bi) => { setSteps(s => s.map((st, si) => si === activeStepIdx ? { ...st, blocks: st.blocks.filter((_, i) => i !== bi) } : st)); setSelectedBlockIdx(null); };

    const addBlockToStep = (type, insertAt = null) => {
        if (!steps.length) { const ns = makeStep('Etapa 1'); setSteps([ns]); setActiveStepIdx(0); }
        const nb = createBlock(type);
        setSteps(s => s.map((st, si) => {
            if (si !== (steps.length ? activeStepIdx : 0)) return st;
            const blocks = [...st.blocks]; insertAt !== null ? blocks.splice(insertAt, 0, nb) : blocks.push(nb);
            return { ...st, blocks };
        }));
        setSelectedBlockIdx(insertAt ?? (activeStep?.blocks.length || 0));
    };

    const reorderBlock = (from, to) => {
        setSteps(s => s.map((st, si) => {
            if (si !== activeStepIdx) return st;
            const blocks = [...st.blocks]; const [moved] = blocks.splice(from, 1);
            blocks.splice(to > from ? to - 1 : to, 0, moved); return { ...st, blocks };
        })); setSelectedBlockIdx(to > from ? to - 1 : to);
    };

    const moveStep = (i, dir) => { const ni = i + dir; if (ni < 0 || ni >= steps.length) return; setSteps(s => { const a = [...s];[a[i], a[ni]] = [a[ni], a[i]]; return a; }); if (activeStepIdx === i) setActiveStepIdx(ni); };
    const deleteStep = (i) => { setSteps(s => s.filter((_, j) => j !== i)); if (activeStepIdx === i) { setActiveStepIdx(Math.max(0, i - 1)); setSelectedBlockIdx(null); } else if (activeStepIdx > i) setActiveStepIdx(a => a - 1); };
    const addStep = (name = 'Nova Etapa') => { const ns = makeStep(name); setSteps(s => [...s, ns]); setActiveStepIdx(steps.length); setSelectedBlockIdx(null); };
    const renameStep = (i, name) => setSteps(s => s.map((st, si) => si === i ? { ...st, name } : st));

    const loadTemplate = (t) => {
        const tSteps = typeof t.steps === 'function' ? t.steps() : JSON.parse(JSON.stringify(t.steps || []));
        setSteps(tSteps); setConfig(c => ({ ...c, name: t.name || '', primaryColor: t.color || c.primaryColor }));
        setActiveStepIdx(0); setSelectedBlockIdx(null); setShowTemplates(false);
    };

    const saveCurrentAsTemplate = () => {
        const name = prompt('Nome do template:'); if (!name) return;
        // Deep clone steps, then strip content-specific text but keep structure
        const templateSteps = JSON.parse(JSON.stringify(steps)).map(step => ({
            ...step,
            name: step.name, // keep step name as structure reference
            blocks: step.blocks.map(block => {
                const cleaned = { ...block };
                // Strip text content but keep type/structure
                if (cleaned.text) cleaned.text = '';
                if (cleaned.headline) cleaned.headline = '';
                if (cleaned.subheadline) cleaned.subheadline = '';
                if (cleaned.description) cleaned.description = '';
                if (cleaned.label) cleaned.label = '';
                if (cleaned.placeholder) cleaned.placeholder = '';
                if (cleaned.cta) cleaned.cta = '';
                if (cleaned.options) cleaned.options = cleaned.options.map(o => ({ ...o, text: '' }));
                return cleaned;
            }),
        }));
        saveUserTemplate({ name, desc: `Template com ${steps.length} etapas`, color: config.primaryColor || '#6c63ff', tags: ['meu'], steps: templateSteps });
        showToastMsg('Template favoritado!');
    };

    const handleDropBlock = useCallback((insertIdx) => {
        if (dragFromSidebar) { addBlockToStep(dragFromSidebar, insertIdx); setDragFromSidebar(null); }
        setDragOverBlockIdx(null);
    }, [dragFromSidebar, activeStepIdx, steps]);

    const buildQuiz = () => {
        const id = quizId || editId || Math.random().toString(36).slice(2, 10);
        const nonEmptySteps = steps.filter(s => s.blocks.length > 0);
        const pages = nonEmptySteps.map((s, si) => {
            if (s.blocks.length === 1) return { ...s.blocks[0], id: `p${si}_0`, sectionIndex: 0 };
            return { id: `p${si}`, type: 'compound', sectionIndex: 0, blocks: s.blocks.map((b, bi) => ({ ...b, id: `p${si}_${bi}` })) };
        });
        const allBlocks = nonEmptySteps.flatMap(s => s.blocks);
        const dr = [{ id: 'r1', name: 'A', minPct: 0, maxPct: 40, description: 'Resultado A', cta: 'Ver →', ctaUrl: '' }, { id: 'r2', name: 'B', minPct: 41, maxPct: 70, description: 'Resultado B', cta: 'Ver →', ctaUrl: '' }, { id: 'r3', name: 'C', minPct: 71, maxPct: 100, description: 'Resultado C', cta: 'Ver →', ctaUrl: '' }];
        // Map step IDs to page indices for conditional routing
        const stepPageMap = {};
        const stepGoToMap = {}; // maps page index → step-level goToStep target
        nonEmptySteps.forEach((s, i) => {
            stepPageMap[s.id] = i;
            if (s.goToStep) stepGoToMap[i] = s.goToStep;
        });
        return { id, name: config.name || 'Meu Quiz', emoji: isClone ? '🔗' : '🧱', primaryColor: config.primaryColor, bgColor: config.bgColor, colorPalette: [config.primaryColor], productName: config.name, niche: config.niche, metadata: { niche: config.niche, subTheme: config.name, tone: 'profissional', palette: [config.primaryColor], emojiStyle: 'moderno' }, sections: [{ label: 'Quiz', startIndex: 0 }], welcome: { headline: config.welcomeHeadline || 'Descubra', subheadline: config.welcomeSub || '', cta: config.welcomeCta || 'Começar →' }, pages, questions: allBlocks.filter(b => ['choice', 'statement', 'likert', 'image-select', 'single-choice', 'yes-no'].includes(b.type)), results: clonedResults || dr, steps, stepPageMap, stepGoToMap, collectLead: config.collectLead, published: false, createdAt: Date.now(), updatedAt: Date.now() };
    };

    const handleSave = async () => {
        if (!steps.length) return;
        const result = await saveQuiz(buildQuiz());
        if (result) { setQuizId(result.id); showToastMsg('Salvo!'); }
    };

    const handlePublish = async () => {
        if (!steps.length || !steps.some(s => s.blocks.length > 0)) return showToastMsg('Adicione pelo menos 1 bloco!');
        const result = await saveQuiz(buildQuiz());
        if (result) { setSaved(result); setShowShare(true); showToastMsg('🎉 Publicado com sucesso!'); }
    };

    const quizUrl = saved ? `${window.location.origin}/q/${saved.id}` : (quizId ? `${window.location.origin}/q/${quizId}` : '');

    // ═══ Published Share Modal ═══
    if (saved && showShare) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8f8fa' }}>
            {renderTopBar()}
            <div className="modal-overlay" onClick={() => setShowShare(false)}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                    <div className="modal-header">
                        <h3 className="modal-title">Compartilhar</h3>
                        <button className="modal-close" onClick={() => setShowShare(false)}>×</button>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label className="label">Domínio</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input className="input" readOnly value={quizUrl} style={{ flex: 1, fontSize: '0.8rem' }} />
                            <button className="topbar-icon" onClick={() => { navigator.clipboard.writeText(quizUrl); showToastMsg('Link copiado!'); }} title="Copiar"><Clipboard size={14} /></button>
                        </div>
                    </div>
                    <div>
                        <label className="label">Redes sociais</label>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            {[
                                { icon: 'f', bg: '#1877F2', url: `https://www.facebook.com/sharer/sharer.php?u=${quizUrl}` },
                                { icon: '𝕏', bg: '#000', url: `https://twitter.com/intent/tweet?url=${quizUrl}` },
                                { icon: 'in', bg: '#0A66C2', url: `https://www.linkedin.com/sharing/share-offsite/?url=${quizUrl}` },
                                { icon: 'WA', bg: '#25D366', url: `https://wa.me/?text=${quizUrl}` },
                                { icon: 'P', bg: '#E60023', url: `https://pinterest.com/pin/create/button/?url=${quizUrl}` },
                                { icon: '✈', bg: '#0088cc', url: `https://t.me/share/url?url=${quizUrl}` },
                                { icon: '✉', bg: '#6b7280', url: `mailto:?body=${quizUrl}` },
                            ].map((s, i) => (
                                <button key={i} onClick={() => window.open(s.url, '_blank')} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: s.bg, transition: 'var(--transition)' }}>{s.icon}</button>
                            ))}
                        </div>
                    </div>
                    <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => window.open(`/q/${saved.id}`, '_blank')}><Eye size={14} style={{ marginRight: 4 }} /> Preview</button>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setShowShare(false); navigate('/'); }}>← Início</button>
                    </div>
                </div>
            </div>
            {renderToast()}
        </div>
    );

    function renderTopBar() {
        return (
            <div className="topbar">
                <div className="topbar-left">
                    <div onClick={() => navigate('/')} style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>QF</div>
                    <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.2 }}>{config.name || 'Sem título'}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>/ {quizId || editId || 'novo'}</div>
                    </div>
                </div>
                <div className="topbar-center">
                    {['construtor', 'templates', 'fluxo', 'design', 'leads', 'dominio'].map(tab => (
                        <button key={tab} className={`topbar-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                            {tab === 'construtor' && <><Palette size={13} style={{ marginRight: 4 }} /> </>}
                            {tab === 'templates' && <><Package size={13} style={{ marginRight: 4 }} /> </>}
                            {tab === 'fluxo' && <><GitBranch size={13} style={{ marginRight: 4 }} /> </>}
                            {tab === 'design' && <><Palette size={13} style={{ marginRight: 4 }} /> </>}
                            {tab === 'leads' && <><Users size={13} style={{ marginRight: 4 }} /> </>}
                            {tab === 'dominio' && <><Globe size={13} style={{ marginRight: 4 }} /> </>}
                            {tab === 'dominio' ? 'Domínio' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
                <div className="topbar-right">
                    <button className="topbar-icon" title="Configurações" onClick={() => setShowSettings(true)}><Settings size={15} /></button>
                    <button className="topbar-icon" title="Compartilhar" onClick={() => setShowShare(true)}><Share2 size={15} /></button>
                    <button className="topbar-icon" title="Preview" onClick={async () => { if (steps.some(s => s.blocks.length)) { const q = buildQuiz(); const s = await saveQuiz(q); if (s) window.open(`/q/${s.id}`, '_blank'); } }}><Play size={15} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                        const q = buildQuiz();
                        const tpl = { ...q, id: undefined, name: (q.name || 'Meu Quiz') + ' (Template)', emoji: '⭐', leads: undefined, analytics: undefined };
                        saveUserTemplate(tpl);
                        showToastMsg('Template salvo! Acesse pela aba Templates.');
                    }}><Star size={13} style={{ marginRight: 4 }} /> Favoritar</button>
                    <button className="btn btn-accent btn-sm" onClick={handlePublish}>Publicar</button>
                </div>
            </div>
        );
    }

    function renderToast() {
        if (!toast) return null;
        return <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#111', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', animation: 'fadeIn 0.2s' }}>{toast}</div>;
    }

    // ═══ MAIN RENDER ═══

    // ═══ ONBOARDING SCREEN ═══
    if (showOnboarding) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 16, padding: '36px 32px', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🚀</div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>Criar novo Quiz</h1>
                    <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Conte sobre seu produto para a IA criar etapas melhores</p>
                </div>
                <div className="form-group">
                    <label className="label">Nome do produto *</label>
                    <input className="input" value={config.name} placeholder="Ex: Leaply, Keto Diet, Skin Care Pro" onChange={e => updateConfig('name', e.target.value)} autoFocus />
                </div>
                <div className="form-group">
                    <label className="label">Nicho</label>
                    <select className="input" value={config.niche} onChange={e => updateConfig('niche', e.target.value)}>
                        {['saude', 'fitness', 'beleza', 'educacao', 'financas', 'tech', 'alimentacao', 'marketing', 'ecommerce', 'outro'].map(n => (
                            <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="label">Sobre o produto</label>
                    <textarea className="input" rows={3} value={config.productDescription} placeholder="Descreva brevemente o que seu produto faz, pra quem é, e qual problema resolve..." onChange={e => updateConfig('productDescription', e.target.value)}
                        style={{ resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }} />
                </div>
                <div className="form-group">
                    <label className="label">Público-alvo</label>
                    <input className="input" value={config.targetAudience} placeholder="Ex: Mulheres 25-45 que querem emagrecer" onChange={e => updateConfig('targetAudience', e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowOnboarding(false); setActiveTab('templates'); }}>Pular</button>
                    <button className="btn btn-accent" style={{ flex: 2 }} onClick={() => { setShowOnboarding(false); setActiveTab('construtor'); if (!steps.length) addStep('Etapa 1'); }}>
                        {config.name ? `Criar quiz para "${config.name}"` : 'Começar →'}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>
            {renderTopBar()}

            {/* ═══ CONSTRUTOR TAB ═══ */}
            {activeTab === 'construtor' && (
                <div className="builder-layout">
                    {/* LEFT SIDEBAR — step list + component palette side by side */}
                    <div className="builder-sidebar" style={{ display: 'flex', gap: 0, padding: 0 }}>
                        {/* Step list column */}
                        <div style={{ width: 170, minWidth: 150, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: '#fafafc' }}>
                            <div style={{ padding: '6px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)' }}>Etapas</div>
                            <div style={{ padding: '4px', flex: 1, overflowY: 'auto' }}>
                                {steps.map((step, i) => (
                                    <div key={step.id}
                                        className={`step-item ${activeStepIdx === i ? 'active' : ''}`}
                                        draggable
                                        onDragStart={e => { e.dataTransfer.setData('stepIdx', String(i)); e.dataTransfer.effectAllowed = 'move'; }}
                                        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderTop = '2px solid var(--primary)'; }}
                                        onDragLeave={e => { e.currentTarget.style.borderTop = 'none'; }}
                                        onDrop={e => {
                                            e.preventDefault(); e.currentTarget.style.borderTop = 'none';
                                            const fromIdx = parseInt(e.dataTransfer.getData('stepIdx'));
                                            if (isNaN(fromIdx) || fromIdx === i) return;
                                            setSteps(prev => {
                                                const ns = [...prev]; const [moved] = ns.splice(fromIdx, 1); ns.splice(i, 0, moved); return ns;
                                            });
                                            setActiveStepIdx(i);
                                        }}
                                        onClick={() => { setActiveStepIdx(i); setSelectedBlockIdx(null); setRenamingStepIdx(null); }}
                                        onDoubleClick={() => setRenamingStepIdx(i)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 6px', marginBottom: 1, borderRadius: 6, cursor: 'grab', borderTop: 'none' }}>
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, width: 18, textAlign: 'center', opacity: 0.4, flexShrink: 0, cursor: 'grab' }} title="Arraste para reordenar">{i + 1}</span>
                                        {renamingStepIdx === i ? (
                                            <input value={step.name} onChange={e => renameStep(i, e.target.value)} onClick={e => e.stopPropagation()}
                                                autoFocus
                                                style={{ flex: 1, background: '#fff', border: 'none', outline: 'none', color: 'inherit', fontSize: '0.73rem', fontWeight: 500, padding: '0 4px', minWidth: 0, cursor: 'text', borderRadius: 4 }}
                                                onBlur={() => setRenamingStepIdx(null)}
                                                onKeyDown={e => { if (e.key === 'Enter') setRenamingStepIdx(null); }} />
                                        ) : (
                                            <span style={{ flex: 1, fontSize: '0.73rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{step.name}</span>
                                        )}
                                        <button onClick={e => { e.stopPropagation(); if (steps.length > 1) deleteStep(i); else showToastMsg('Mantenha ao menos 1 etapa'); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 2, display: 'flex', opacity: 0, flexShrink: 0, transition: 'opacity 0.15s' }}
                                            title="Deletar etapa" onMouseOver={e => e.currentTarget.style.opacity = '1'} onMouseOut={e => e.currentTarget.style.opacity = '0'}
                                            className="step-delete-btn">
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            {/* Bottom: Add step + Modelos */}
                            <div style={{ borderTop: '1px solid var(--border)', padding: '4px' }}>
                                <button onClick={() => addStep()} style={{ width: '100%', padding: '6px 0', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>+ Em branco</button>
                                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 6px 2px', letterSpacing: '0.5px' }}>Modelos</div>
                                <div style={{ maxHeight: 140, overflowY: 'auto' }}>
                                    {READY_STEPS.map(rs => (
                                        <div key={rs.id}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', cursor: 'pointer', borderRadius: 5, fontSize: '0.7rem', color: 'var(--text-primary)', transition: 'background 0.15s' }}
                                            onMouseOver={e => e.currentTarget.style.background = '#eef2ff'}
                                            onMouseOut={e => e.currentTarget.style.background = 'none'}
                                            onClick={() => {
                                                const ns = { id: `stp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: rs.name, blocks: JSON.parse(JSON.stringify(rs.blocks)) };
                                                setSteps(s => [...s, ns]); setActiveStepIdx(steps.length); setSelectedBlockIdx(null);
                                                showToastMsg(`${rs.name} adicionado!`);
                                            }}>
                                            <span style={{ fontSize: 14 }}>{rs.icon}</span>
                                            <span style={{ fontWeight: 500 }}>{rs.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Component palette column */}
                        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
                            {CATEGORIES.map(cat => {
                                const items = BLOCK_TYPES.filter(b => b.category === cat.key);
                                if (!items.length) return null;
                                return (
                                    <div key={cat.key} className="sidebar-section">
                                        <div className="sidebar-section-title">{cat.label}</div>
                                        {items.map(bt => (
                                            <div key={bt.type} className="sidebar-item" draggable
                                                onDragStart={() => setDragFromSidebar(bt.type)}
                                                onDragEnd={() => { setDragFromSidebar(null); setDragOverBlockIdx(null); }}
                                                onClick={() => { if (!steps.length) addStep('Etapa 1'); addBlockToStep(bt.type); }}>
                                                <div className="sidebar-item-icon">{bt.icon}</div>
                                                <span>{bt.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* CENTER CANVAS */}
                    <div className="builder-canvas" onClick={(e) => { if (e.target === e.currentTarget) setSelectedBlockIdx(null); }}>
                        <PhonePreview step={activeStep} selectedBlockId={selectedBlock?.id}
                            onSelectBlock={i => setSelectedBlockIdx(i)} onDeleteBlock={i => deleteBlock(i)}
                            onBlockChange={(i, b) => updateBlock(i, b)} config={config} viewMode={viewMode}
                            onDropBlock={handleDropBlock} onDragOverBlock={setDragOverBlockIdx}
                            dragOverBlockIdx={dragFromSidebar ? dragOverBlockIdx : null} onReorderBlock={reorderBlock} />
                        {/* Bottom toolbar */}
                        <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 8px', boxShadow: 'var(--shadow-md)', zIndex: 50 }}>
                            <button className="topbar-icon" style={{ width: 28, height: 28, border: 'none' }} title="Desfazer"><Undo2 size={14} /></button>
                            <button className="topbar-icon" style={{ width: 28, height: 28, border: 'none' }} title="Refazer"><Redo2 size={14} /></button>
                            <div style={{ width: 1, background: 'var(--border)', margin: '4px 2px' }} />
                            <button className={`topbar-icon`} style={{ width: 28, height: 28, border: 'none', color: viewMode === 'mobile' ? 'var(--primary)' : undefined }} onClick={() => setViewMode('mobile')} title="Mobile"><Smartphone size={14} /></button>
                            <button className={`topbar-icon`} style={{ width: 28, height: 28, border: 'none', color: viewMode === 'desktop' ? 'var(--primary)' : undefined }} onClick={() => setViewMode('desktop')} title="Desktop"><Monitor size={14} /></button>
                            <div style={{ width: 1, background: 'var(--border)', margin: '4px 2px' }} />
                            <button
                                className="topbar-icon"
                                style={{ width: 28, height: 28, border: 'none', color: aiStepLoading ? '#94a3b8' : 'var(--primary)', position: 'relative' }}
                                title="Gerar etapa com IA (analisa etapas existentes + produto)"
                                disabled={aiStepLoading}
                                onClick={async () => {
                                    if (aiStepLoading) return;
                                    setAiStepLoading(true);
                                    showToastMsg('🤖 Gerando etapa com IA...');
                                    try {
                                        const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
                                        const existingSteps = steps.map((s, i) => ({
                                            step: i + 1,
                                            name: s.name,
                                            blocks: s.blocks.map(b => ({ type: b.type, text: b.text || b.headline || '', options: (b.options || []).map(o => o.text) }))
                                        }));
                                        const res = await fetch(`${API_BASE}/api/generate-step`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                existingSteps,
                                                productName: config.name || 'Quiz',
                                                niche: config.niche || 'outro',
                                                totalSteps: steps.length,
                                                productDescription: config.productDescription || '',
                                                targetAudience: config.targetAudience || '',
                                            }),
                                        });
                                        if (!res.ok) throw new Error('Erro ao gerar');
                                        const data = await res.json();
                                        if (data.step) {
                                            const ns = { id: `stp_ai_${Date.now()}`, name: data.step.name || `Etapa ${steps.length + 1}`, blocks: data.step.blocks || [data.step] };
                                            setSteps(s => [...s, ns]); setActiveStepIdx(steps.length);
                                            showToastMsg(`Etapa "${ns.name}" criada com IA!`);
                                        }
                                    } catch (err) {
                                        showToastMsg('Erro ao gerar: ' + (err.message || 'tente novamente'));
                                    }
                                    setAiStepLoading(false);
                                }}
                            >
                                {aiStepLoading ? (
                                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #e2e8f0', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                                ) : '🤖'}
                            </button>
                        </div>
                    </div>

                    {/* RIGHT PANEL */}
                    <div className="builder-right">
                        {selectedBlock ? (
                            <PropertiesPanel block={selectedBlock} onChange={b => selectedBlockIdx !== null && updateBlock(selectedBlockIdx, b)} config={config} onConfigChange={updateConfig} steps={steps} />
                        ) : (
                            /* Step settings / Aparência when no block selected */
                            <div style={{ padding: 16 }}>
                                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 14, gap: 0 }}>
                                    <div onClick={() => setRightPanelTab('etapa')} style={{ flex: 1, padding: '8px 0', textAlign: 'center', fontSize: '0.78rem', fontWeight: rightPanelTab === 'etapa' ? 600 : 500, borderBottom: rightPanelTab === 'etapa' ? '2px solid var(--text-primary)' : '2px solid transparent', cursor: 'pointer', color: rightPanelTab === 'etapa' ? 'var(--text-primary)' : 'var(--text-muted)' }}>Etapa</div>
                                    <div onClick={() => setRightPanelTab('aparencia')} style={{ flex: 1, padding: '8px 0', textAlign: 'center', fontSize: '0.78rem', fontWeight: rightPanelTab === 'aparencia' ? 600 : 500, borderBottom: rightPanelTab === 'aparencia' ? '2px solid var(--text-primary)' : '2px solid transparent', cursor: 'pointer', color: rightPanelTab === 'aparencia' ? 'var(--text-primary)' : 'var(--text-muted)' }}>Aparência</div>
                                </div>

                                {rightPanelTab === 'etapa' ? (
                                    <>
                                        <div className="form-group">
                                            <label className="label">Sem título</label>
                                            <input className="input" placeholder="Ex: Etapa 1" value={activeStep?.name || ''} onChange={e => activeStepIdx >= 0 && renameStep(activeStepIdx, e.target.value)} />
                                        </div>
                                        {/* Step-level routing */}
                                        <div className="form-group">
                                            <label className="label">↳ Após esta etapa, ir para:</label>
                                            <select className="input"
                                                value={activeStep?.goToStep || ''}
                                                onChange={e => {
                                                    const val = e.target.value || null;
                                                    setSteps(s => s.map((st, i) => i === activeStepIdx ? { ...st, goToStep: val } : st));
                                                }}
                                                style={{ color: activeStep?.goToStep ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.82rem' }}>
                                                <option value="">Próxima etapa (padrão)</option>
                                                {steps.map((s, si) => (
                                                    <option key={s.id} value={s.id} disabled={si === activeStepIdx}>{si + 1}. {s.name}</option>
                                                ))}
                                                <option value="__end">🏁 Finalizar quiz</option>
                                            </select>
                                            {activeStep?.goToStep && (
                                                <div style={{ fontSize: '0.65rem', color: 'var(--primary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <GitBranch size={12} style={{ display: 'inline', marginRight: 4 }} /> Rota condicional ativa
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ marginBottom: 14 }}>
                                            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 8 }}>Header</div>
                                            {[{ key: 'showLogo', label: 'Mostrar logo' }, { key: 'showProgress', label: 'Mostrar progresso' }, { key: 'allowBack', label: 'Permitir voltar' }].map(opt => (
                                                <label key={opt.key} className="toggle-wrapper" style={{ marginBottom: 8 }}>
                                                    <label className="toggle"><input type="checkbox" checked={config[opt.key] !== false} onChange={e => updateConfig(opt.key, e.target.checked)} /><span className="toggle-slider" /></label>
                                                    <span style={{ fontSize: '0.8rem' }}>{opt.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    /* ═══ APARÊNCIA TAB ═══ */
                                    <>
                                        {/* Background Color */}
                                        <div className="form-group">
                                            <label className="label">Cor de fundo</label>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <input type="color" value={config.bgColor || '#ffffff'} onChange={e => updateConfig('bgColor', e.target.value)}
                                                    style={{ width: 36, height: 36, border: '1px solid var(--border)', borderRadius: 8, padding: 2, cursor: 'pointer' }} />
                                                <input className="input" value={config.bgColor || ''} placeholder="#ffffff"
                                                    onChange={e => updateConfig('bgColor', e.target.value)}
                                                    style={{ flex: 1, fontSize: '0.75rem', fontFamily: 'monospace' }} />
                                                {config.bgColor && (
                                                    <button onClick={() => updateConfig('bgColor', '')}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.7rem' }}>✕</button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Background Image */}
                                        <div className="form-group">
                                            <label className="label">Imagem de fundo</label>
                                            {!config.bgImage ? (
                                                <div
                                                    onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => updateConfig('bgImage', ev.target.result); r.readAsDataURL(f); } }; inp.click(); }}
                                                    style={{ padding: '14px 12px', border: '2px dashed var(--border)', borderRadius: 8, textAlign: 'center', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                                                    onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#f0f5ff'; }}
                                                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'none'; }}>
                                                    <div style={{ fontSize: 20, marginBottom: 4 }}>🖼️</div>
                                                    Clique para enviar imagem
                                                </div>
                                            ) : (
                                                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                                                    <img src={config.bgImage} alt="Fundo" style={{ width: '100%', height: 80, objectFit: 'cover' }} />
                                                    <button onClick={() => updateConfig('bgImage', '')}
                                                        style={{ width: '100%', padding: '5px', background: '#fef2f2', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: '#dc2626', fontWeight: 500 }}>✕ Remover</button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Logo */}
                                        <div className="form-group">
                                            <label className="label">Logo</label>
                                            {!config.logoUrl ? (
                                                <div
                                                    onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => updateConfig('logoUrl', ev.target.result); r.readAsDataURL(f); } }; inp.click(); }}
                                                    style={{ padding: '14px 12px', border: '2px dashed var(--border)', borderRadius: 8, textAlign: 'center', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                                                    onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#f0f5ff'; }}
                                                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'none'; }}>
                                                    <div style={{ fontSize: 20, marginBottom: 4 }}>📷</div>
                                                    Clique para enviar logo
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                                                    <img src={config.logoUrl} alt="Logo" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 6 }} />
                                                    <span style={{ flex: 1, fontSize: '0.7rem', color: 'var(--text-muted)' }}>Logo carregado</span>
                                                    <button onClick={() => updateConfig('logoUrl', '')}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.7rem', fontWeight: 600 }}>✕</button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Primary Color */}
                                        <div className="form-group">
                                            <label className="label">Cor primária</label>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <input type="color" value={config.primaryColor || '#2563eb'} onChange={e => updateConfig('primaryColor', e.target.value)}
                                                    style={{ width: 36, height: 36, border: '1px solid var(--border)', borderRadius: 8, padding: 2, cursor: 'pointer' }} />
                                                <input className="input" value={config.primaryColor || ''} placeholder="#2563eb"
                                                    onChange={e => updateConfig('primaryColor', e.target.value)}
                                                    style={{ flex: 1, fontSize: '0.75rem', fontFamily: 'monospace' }} />
                                            </div>
                                        </div>

                                        {/* Font Family */}
                                        <div className="form-group">
                                            <label className="label">Fonte</label>
                                            <select className="input" value={config.fontFamily || 'Inter'} onChange={e => updateConfig('fontFamily', e.target.value)}>
                                                {['Inter', 'Roboto', 'Poppins', 'Outfit', 'Montserrat', 'Open Sans', 'Lato', 'Nunito'].map(f => (
                                                    <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Border Radius */}
                                        <div className="form-group">
                                            <label className="label">Bordas</label>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                {[{ v: 'none', l: 'Retas' }, { v: 'small', l: 'Suaves' }, { v: 'medium', l: 'Médias' }, { v: 'large', l: 'Arredondadas' }].map(opt => (
                                                    <button key={opt.v} onClick={() => updateConfig('borderRadius', opt.v)}
                                                        style={{
                                                            flex: 1, padding: '6px 4px', border: '1px solid', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                                                            borderRadius: opt.v === 'none' ? 0 : opt.v === 'small' ? 4 : opt.v === 'medium' ? 8 : 14,
                                                            borderColor: config.borderRadius === opt.v ? 'var(--primary)' : 'var(--border)',
                                                            background: config.borderRadius === opt.v ? 'rgba(37,99,235,0.06)' : '#fff',
                                                            color: config.borderRadius === opt.v ? 'var(--primary)' : 'var(--text-muted)',
                                                        }}>{opt.l}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ TEMPLATES TAB ═══ */}
            {activeTab === 'templates' && (() => {
                const adminTs = getAdminTemplates();
                const userTs = getUserTemplates();
                return (
                    <div style={{ flex: 1, overflow: 'auto', padding: '24px 40px', background: 'var(--bg-base)' }}>
                        <div style={{ maxWidth: 800, margin: '0 auto' }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Package size={18} /> Templates</h2>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>Escolha um template para começar rapidamente</p>





                            {adminTs.length > 0 && (<>
                                <div className="label" style={{ marginBottom: 8 }}>🔒 Templates globais</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                                    {adminTs.map(t => (
                                        <div key={t.id} className="card" onClick={() => { loadTemplate(t); setActiveTab('construtor'); }} style={{ padding: 14, cursor: 'pointer' }}>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{t.name}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{t.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </>)}
                            {userTs.length > 0 && (<>
                                <div className="label" style={{ marginBottom: 8 }}>📁 Meus templates</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                                    {userTs.map(t => (
                                        <div key={t.id} className="card" style={{ padding: 14, position: 'relative' }}>
                                            <div onClick={() => { loadTemplate(t); setActiveTab('construtor'); }} style={{ cursor: 'pointer' }}>
                                                <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{t.name}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{t.desc}</div>
                                            </div>
                                            <button onClick={() => { if (confirm('Deletar?')) deleteUserTemplate(t.id); }}
                                                style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 2 }}><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                </div>
                            </>)}
                            <button className="btn btn-ghost btn-full" onClick={() => { if (!steps.length) addStep('Etapa 1'); setActiveTab('construtor'); }}>✏️ Começar do zero</button>
                        </div>
                    </div>
                );
            })()}

            {/* ═══ DESIGN TAB ═══ */}
            {activeTab === 'design' && (
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', overflow: 'auto', padding: 20 }}>
                        <PhonePreview step={activeStep} selectedBlockId={null} onSelectBlock={() => { }} onDeleteBlock={() => { }} onBlockChange={() => { }} config={config} viewMode={viewMode} onDropBlock={() => { }} onDragOverBlock={() => { }} dragOverBlockIdx={null} onReorderBlock={() => { }} />
                    </div>
                    <div style={{ width: 300, background: '#fff', borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 20 }}>
                        {[
                            {
                                title: 'GERAL', fields: [
                                    { key: 'alignment', label: 'Alinhamento', type: 'select', options: ['Centralizado', 'Esquerda', 'Direita'] },
                                    { key: 'mainWidth', label: 'Largura principal', type: 'select', options: ['Pequeno', 'Médio', 'Grande', 'Cheio'] },
                                    { key: 'elementSize', label: 'Tamanho dos elementos', type: 'select', options: ['Padrão', 'Pequeno', 'Grande'] },
                                    { key: 'spacing', label: 'Espaçamento', type: 'select', options: ['Pequeno', 'Médio', 'Grande'] },
                                    { key: 'borderRadius', label: 'Bordas/Cantos', type: 'select', options: ['Nenhum', 'Pequeno', 'Médio', 'Grande'] },
                                ]
                            },
                            {
                                title: 'HEADER', fields: [
                                    { key: 'showLogo', label: 'Mostrar logo', type: 'toggle' },
                                    { key: 'showProgress', label: 'Mostrar progresso', type: 'toggle' },
                                    { key: 'allowBack', label: 'Permitir voltar', type: 'toggle' },
                                ]
                            },
                            {
                                title: 'CORES', fields: [
                                    { key: 'primaryColor', label: 'Cor primária', type: 'color' },
                                    { key: 'bgColor', label: 'Cor de fundo', type: 'color' },
                                    { key: 'headerColor', label: 'Cor do header', type: 'color' },
                                ]
                            },
                            {
                                title: 'TIPOGRAFIA', fields: [
                                    { key: 'fontFamily', label: 'Fonte', type: 'select', options: ['Inter', 'Roboto', 'Poppins', 'Outfit', 'System'] },
                                ]
                            },
                        ].map(section => (
                            <div key={section.title} style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 10 }}>{section.title}</div>
                                {section.fields.map(f => (
                                    <div key={f.key} className="form-group">
                                        {f.type === 'select' && (<><label className="label">{f.label}</label><select className="input" value={config[f.key] || ''} onChange={e => updateConfig(f.key, e.target.value)}>{f.options.map(o => <option key={o} value={o.toLowerCase()}>{o}</option>)}</select></>)}
                                        {f.type === 'toggle' && (<label className="toggle-wrapper"><label className="toggle"><input type="checkbox" checked={config[f.key] !== false} onChange={e => updateConfig(f.key, e.target.checked)} /><span className="toggle-slider" /></label><span style={{ fontSize: '0.8rem' }}>{f.label}</span></label>)}
                                        {f.type === 'color' && (<><label className="label">{f.label}</label><div style={{ display: 'flex', gap: 8 }}><input type="color" value={config[f.key] || '#2563eb'} onChange={e => updateConfig(f.key, e.target.value)} style={{ width: 36, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer' }} /><input className="input" value={config[f.key] || ''} onChange={e => updateConfig(f.key, e.target.value)} placeholder="#hex" /></div></>)}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ LEADS TAB ═══ */}
            {activeTab === 'leads' && (() => {
                const starts = analytics?.starts || 0;
                const completes = analytics?.completes || 0;
                const ctaClicks = (analytics?.events || []).filter(e => e.event === 'cta_click').length;
                const answerEvents = analytics?.answers || [];
                const convRate = starts ? ((completes / starts) * 100).toFixed(1) : '0.0';
                const leadsWithEmail = leads.filter(l => l.email);

                // Build answer distribution per question
                const answerDist = {};
                answerEvents.forEach(a => {
                    const qi = a.questionIndex;
                    if (qi === undefined) return;
                    if (!answerDist[qi]) answerDist[qi] = {};
                    const oi = a.optionIndex;
                    answerDist[qi][oi] = (answerDist[qi][oi] || 0) + 1;
                });

                // Result distribution from leads
                const resultDist = {};
                leads.forEach(l => { if (l.result) resultDist[l.result] = (resultDist[l.result] || 0) + 1; });
                const totalResults = Object.values(resultDist).reduce((a, b) => a + b, 0) || 1;
                const resultColors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

                return (
                    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                        {/* Sub-tabs + actions */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{ display: 'flex', gap: 0 }}>
                                {[{ k: 'respostas', l: 'Respostas' }, { k: 'resultados', l: 'Resultados' }, { k: 'performance', l: 'Performance' }].map(t => (
                                    <button key={t.k} onClick={() => setLeadSubTab(t.k)} style={{ padding: '8px 16px', fontSize: '0.82rem', fontWeight: leadSubTab === t.k ? 600 : 400, background: 'none', border: 'none', borderBottom: leadSubTab === t.k ? '2px solid var(--text-primary)' : '2px solid transparent', cursor: 'pointer', color: leadSubTab === t.k ? 'var(--text-primary)' : 'var(--text-muted)' }}>{t.l}</button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => {
                                    const csv = ['Nome,Email,Data,Resultado', ...leads.map(l => `${l.name || ''},${l.email || ''},${l.date || ''},${l.result || ''}`)].join('\n');
                                    const blob = new Blob([csv], { type: 'text/csv' });
                                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'leads.csv'; a.click();
                                }}><Download size={13} style={{ marginRight: 4 }} /> Exportar CSV</button>
                            </div>
                        </div>

                        {/* KPIs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
                            {[
                                { icon: <Eye size={14} color="#6366f1" />, label: 'Visitas', value: starts, sub: 'Acessaram o quiz' },
                                { icon: <Users size={14} color="#6366f1" />, label: 'Leads', value: leadsWithEmail.length, sub: 'Informaram email' },
                                { icon: <BarChart3 size={14} color="#6366f1" />, label: 'Conversão', value: convRate + '%', sub: 'Visitas → conclusão' },
                                { icon: <MousePointerClick size={14} color="#6366f1" />, label: 'Cliques CTA', value: ctaClicks, sub: 'Clicaram no botão' },
                                { icon: <CheckCircle2 size={14} color="#6366f1" />, label: 'Completos', value: completes, sub: 'Finalizaram o quiz' },
                            ].map(kpi => (
                                <div key={kpi.label} className="kpi-card">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        {kpi.icon}
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{kpi.label}</span>
                                    </div>
                                    <div className="kpi-value">{String(kpi.value).padStart(2, '0')}</div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{kpi.sub}</div>
                                </div>
                            ))}
                        </div>

                        {/* ═══ RESPOSTAS SUB-TAB ═══ */}
                        {leadSubTab === 'respostas' && (
                            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fb' }}>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>#</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>Nome</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>Email</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>Resultado</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>Data</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leads.length === 0 && (
                                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum lead ainda — os leads aparecerão quando alguém completar o quiz</td></tr>
                                        )}
                                        {leads.map((lead, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{i + 1}</td>
                                                <td style={{ padding: '10px 14px', fontSize: '0.82rem', fontWeight: 500 }}>{lead.name || '—'}</td>
                                                <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--primary)' }}>{lead.email || '—'}</td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    {lead.result ? <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.08)', color: '#6366f1', fontWeight: 600 }}>{lead.result}</span> : '—'}
                                                </td>
                                                <td style={{ padding: '10px 14px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{lead.date ? new Date(lead.date).toLocaleDateString('pt-BR') + ' ' + new Date(lead.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ═══ RESULTADOS SUB-TAB ═══ */}
                        {leadSubTab === 'resultados' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {/* Result distribution */}
                                <div className="card" style={{ padding: 20 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={15} /> Distribuição de Resultados</div>
                                    {Object.keys(resultDist).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: 20 }}>Sem dados ainda</div>}
                                    {Object.entries(resultDist).map(([name, count], i) => (
                                        <div key={name} style={{ marginBottom: 12 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>{name}</span>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{count} ({((count / totalResults) * 100).toFixed(0)}%)</span>
                                            </div>
                                            <div style={{ height: 8, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${(count / totalResults) * 100}%`, background: resultColors[i % resultColors.length], borderRadius: 4, transition: 'width 0.5s' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* CTA & funnel */}
                                <div className="card" style={{ padding: 20 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}><MousePointerClick size={15} /> Métricas de Conversão</div>
                                    {[{ label: 'Visitas → Quiz', val: starts, pct: 100 },
                                    { label: 'Quiz → Conclusão', val: completes, pct: starts ? Math.round((completes / starts) * 100) : 0 },
                                    { label: 'Conclusão → Lead', val: leadsWithEmail.length, pct: starts ? Math.round((leadsWithEmail.length / starts) * 100) : 0 },
                                    { label: 'Lead → CTA Click', val: ctaClicks, pct: starts ? Math.round((ctaClicks / starts) * 100) : 0 },
                                    ].map((f, i) => (
                                        <div key={f.label} style={{ marginBottom: 14 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>{f.label}</span>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{f.val} ({f.pct}%)</span>
                                            </div>
                                            <div style={{ height: 8, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${f.pct}%`, background: i === 3 ? '#22c55e' : `hsl(${240 - i * 30}, 70%, 60%)`, borderRadius: 4, transition: 'width 0.5s' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ═══ PERFORMANCE SUB-TAB ═══ */}
                        {leadSubTab === 'performance' && (
                            <div>
                                {/* Answer distribution per question */}
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={15} /> Distribuição de Respostas por Pergunta</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                                    {steps.filter(s => s.blocks.some(b => ['choice', 'single-choice', 'yes-no', 'likert', 'statement'].includes(b.type))).map((step, qi) => {
                                        const choiceBlock = step.blocks.find(b => ['choice', 'single-choice', 'yes-no', 'likert', 'statement'].includes(b.type));
                                        const opts = choiceBlock?.options || [];
                                        const dist = answerDist[qi] || {};
                                        const totalForQ = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
                                        const barColors = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];
                                        return (
                                            <div key={step.id} className="card" style={{ padding: 16 }}>
                                                <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 10, color: '#1a1a2e' }}>{step.name}</div>
                                                {opts.map((opt, oi) => {
                                                    const text = typeof opt === 'string' ? opt : opt.text;
                                                    const count = dist[oi] || 0;
                                                    const pct = ((count / totalForQ) * 100).toFixed(0);
                                                    return (
                                                        <div key={oi} style={{ marginBottom: 6 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                                                <span style={{ fontSize: '0.7rem', color: '#475569', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
                                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                                                            </div>
                                                            <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${pct}%`, background: barColors[oi % barColors.length], borderRadius: 3 }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                                {Object.keys(answerDist).length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: 30 }}>Sem dados de performance ainda — os dados aparecerão quando alguém responder o quiz</div>}

                                {/* Conversion funnel */}
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}><TrendingDown size={15} /> Funil de Conversão</div>
                                <div className="card" style={{ padding: 20 }}>
                                    {[{ label: 'Visitantes', val: starts, icon: <Eye size={14} color="#6366f1" /> },
                                    { label: 'Iniciaram Quiz', val: Math.max(starts, answerEvents.length > 0 ? 1 : 0), icon: <PlayCircle size={14} color="#6366f1" /> },
                                    { label: 'Completaram', val: completes, icon: <CheckCircle2 size={14} color="#22c55e" /> },
                                    { label: 'Deixaram Email', val: leadsWithEmail.length, icon: <Mail size={14} color="#6366f1" /> },
                                    { label: 'Clicaram CTA', val: ctaClicks, icon: <MousePointerClick size={14} color="#22c55e" /> },
                                    ].map((f, i, arr) => {
                                        const maxVal = arr[0].val || 1;
                                        const pct = Math.round((f.val / maxVal) * 100);
                                        return (
                                            <div key={f.label} style={{ marginBottom: i < arr.length - 1 ? 8 : 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                                    {f.icon}
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 500, flex: 1 }}>{f.label}</span>
                                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary)' }}>{f.val}</span>
                                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>{pct}%</span>
                                                </div>
                                                <div style={{ height: 10, borderRadius: 5, background: '#f1f5f9', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, #6366f1, ${i > 2 ? '#22c55e' : '#818cf8'})`, borderRadius: 5, transition: 'width 0.5s' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ═══ FLUXO TAB ═══ */}
            {activeTab === 'fluxo' && (() => {
                // Build flow analysis
                const flowNodes = steps.map((step, i) => {
                    const hasChoiceBlock = step.blocks.some(b => ['choice', 'single-choice', 'image-select', 'yes-no', 'statement'].includes(b.type));
                    const choiceBlock = step.blocks.find(b => ['choice', 'single-choice', 'image-select', 'yes-no', 'statement'].includes(b.type));
                    const options = choiceBlock?.options || [];
                    const optionRoutes = options.map((o, oi) => ({
                        text: o.text || `Opção ${oi + 1}`,
                        goToStep: o.goToStep || null,
                        targetName: o.goToStep === '__end' ? '🏁 Fim' : o.goToStep ? steps.find(s => s.id === o.goToStep)?.name || '?' : null,
                        targetIdx: o.goToStep === '__end' ? -1 : o.goToStep ? steps.findIndex(s => s.id === o.goToStep) : -2,
                    }));
                    const stepRoute = step.goToStep || null;
                    const stepTargetName = stepRoute === '__end' ? '🏁 Fim' : stepRoute ? steps.find(s => s.id === stepRoute)?.name || '?' : null;
                    const stepTargetIdx = stepRoute === '__end' ? -1 : stepRoute ? steps.findIndex(s => s.id === stepRoute) : -2;

                    // Determine default next
                    const defaultNext = i < steps.length - 1 ? i + 1 : -1; // -1 = end

                    return { step, index: i, hasChoiceBlock, optionRoutes, stepRoute, stepTargetName, stepTargetIdx, defaultNext, blockTypes: step.blocks.map(b => b.type) };
                });

                // Trace all paths to check completeness
                const tracePath = (startIdx, visited = new Set()) => {
                    if (startIdx < 0 || startIdx >= steps.length) return 'end';
                    if (visited.has(startIdx)) return 'loop';
                    visited.add(startIdx);
                    const node = flowNodes[startIdx];
                    // If step has routing
                    if (node.stepRoute) {
                        if (node.stepRoute === '__end') return 'end';
                        const targetIdx = steps.findIndex(s => s.id === node.stepRoute);
                        return tracePath(targetIdx, new Set(visited));
                    }
                    // If has choice options with routing
                    if (node.hasChoiceBlock && node.optionRoutes.some(o => o.goToStep)) {
                        const results = node.optionRoutes.map(o => {
                            if (o.goToStep === '__end') return 'end';
                            if (o.goToStep) {
                                const tIdx = steps.findIndex(s => s.id === o.goToStep);
                                return tracePath(tIdx, new Set(visited));
                            }
                            return tracePath(startIdx + 1, new Set(visited));
                        });
                        return results.every(r => r === 'end') ? 'end' : results.some(r => r === 'loop') ? 'loop' : 'incomplete';
                    }
                    // Default: go to next
                    return tracePath(startIdx + 1, new Set(visited));
                };

                const flowStatus = tracePath(0);
                const statusColor = flowStatus === 'end' ? '#22c55e' : flowStatus === 'loop' ? '#f59e0b' : '#ef4444';
                const statusText = flowStatus === 'end' ? 'Fluxo completo — todas as rotas terminam' : flowStatus === 'loop' ? 'Loop detectado — alguma rota volta pra si mesma' : 'Fluxo incompleto — alguma rota não termina';

                return (
                    <div style={{ flex: 1, overflow: 'auto', background: '#f8f9fb', padding: '24px 40px' }}>
                        <div style={{ maxWidth: 700, margin: '0 auto' }}>
                            {/* Status banner */}
                            <div style={{ padding: '10px 16px', borderRadius: 10, background: `${statusColor}10`, border: `1px solid ${statusColor}30`, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: statusColor }}>{statusText}</span>
                            </div>

                            {/* Flow nodes */}
                            {flowNodes.map((node, i) => {
                                const isActive = activeStepIdx === i;
                                const hasRouting = node.stepRoute || node.optionRoutes.some(o => o.goToStep);

                                return (
                                    <div key={node.step.id}>
                                        {/* Step card */}
                                        <div
                                            onClick={() => { setActiveStepIdx(i); setActiveTab('construtor'); }}
                                            style={{
                                                background: '#fff', borderRadius: 12, padding: '14px 18px',
                                                border: isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                cursor: 'pointer', transition: 'all 0.15s',
                                                boxShadow: hasRouting ? '0 2px 12px rgba(37,99,235,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
                                            }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: 8, background: hasRouting ? 'rgba(37,99,235,0.08)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: hasRouting ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }}>{i + 1}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a1a2e' }}>{node.step.name}</div>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                        {node.blockTypes.map((t, j) => (
                                                            <span key={j} style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>{t}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {hasRouting && <GitBranch size={14} color="#6366f1" />}
                                            </div>

                                            {/* Option-level routes */}
                                            {node.hasChoiceBlock && node.optionRoutes.length > 0 && (
                                                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                                                    {node.optionRoutes.map((route, ri) => (
                                                        <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: '0.7rem' }}>
                                                            <span style={{ color: 'var(--text-muted)', width: 14, textAlign: 'center' }}>↳</span>
                                                            <span style={{ flex: 1, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{route.text}"</span>
                                                            <span style={{ color: route.goToStep ? 'var(--primary)' : '#94a3b8', fontWeight: route.goToStep ? 600 : 400, whiteSpace: 'nowrap', fontSize: '0.65rem' }}>
                                                                → {route.goToStep ? route.targetName : 'próxima'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Step-level route */}
                                            {node.stepRoute && !node.hasChoiceBlock && (
                                                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <span>↳</span> Vai para: {node.stepTargetName}
                                                </div>
                                            )}
                                        </div>

                                        {/* Connection arrow */}
                                        {i < steps.length - 1 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0', position: 'relative' }}>
                                                {/* Main line */}
                                                <div style={{ width: 2, height: node.stepRoute || node.optionRoutes.some(o => o.goToStep) ? 20 : 20, background: node.stepRoute ? 'var(--primary)' : 'var(--border)', transition: 'all 0.15s' }} />
                                                {/* Arrow head */}
                                                <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `6px solid ${node.stepRoute ? 'var(--primary)' : 'var(--border)'}` }} />
                                                {/* Route label */}
                                                {node.stepRoute && (
                                                    <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', fontSize: '0.6rem', color: 'var(--primary)', background: 'rgba(37,99,235,0.06)', padding: '2px 8px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                        <GitBranch size={11} style={{ display: 'inline', marginRight: 2 }} /> → {node.stepTargetName}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* End marker for last step */}
                                        {i === steps.length - 1 && !node.stepRoute && (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
                                                <div style={{ width: 2, height: 16, background: '#22c55e' }} />
                                                <div style={{ padding: '6px 16px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '0.72rem', fontWeight: 600, color: '#16a34a' }}>🏁 Fim do Quiz</div>
                                            </div>
                                        )}
                                        {node.stepRoute === '__end' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
                                                <div style={{ width: 2, height: 16, background: '#22c55e' }} />
                                                <div style={{ padding: '6px 16px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '0.72rem', fontWeight: 600, color: '#16a34a' }}>🏁 Fim (rota)</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {steps.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: 40 }}>Adicione etapas para ver o fluxo</div>}
                        </div>
                    </div>
                );
            })()}

            {/* ═══ DOMÍNIO TAB ═══ */}
            {activeTab === 'dominio' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 700, margin: '0 auto' }}>
                    <DomainSettings quizId={quizId || editId} />
                </div>
            )}

            {/* Share modal */}
            {showShare && !saved && (
                <div className="modal-overlay" onClick={() => setShowShare(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Compartilhar</h3>
                            <button className="modal-close" onClick={() => setShowShare(false)}>×</button>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Publique primeiro para gerar o link de compartilhamento.</p>
                        <button className="btn btn-accent btn-full" style={{ marginTop: 16 }} onClick={handlePublish}>Publicar agora</button>
                    </div>
                </div>
            )}

            {/* Template modal */}
            {showTemplates && (() => {
                const adminTs = getAdminTemplates();
                const userTs = getUserTemplates();
                return (
                    <div className="modal-overlay" onClick={() => setShowTemplates(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '85vh', overflow: 'auto' }}>
                            <div className="modal-header">
                                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Package size={16} /> Templates & Blocos Prontos</h3>
                                <button className="modal-close" onClick={() => setShowTemplates(false)}>×</button>
                            </div>

                            {/* Pre-built steps */}
                            <div className="label" style={{ marginBottom: 8 }}>🧩 Blocos Prontos</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
                                {READY_STEPS.map(rs => (
                                    <div key={rs.id} onClick={() => {
                                        const ns = makeStep(rs.name);
                                        ns.blocks = JSON.parse(JSON.stringify(rs.blocks));
                                        setSteps(s => [...s, ns]);
                                        setActiveStepIdx(steps.length);
                                        setSelectedBlockIdx(null);
                                        setShowTemplates(false);
                                        showToastMsg(`${rs.name} adicionado!`);
                                    }} style={{ padding: 12, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', textAlign: 'center', transition: 'var(--transition)' }}
                                        onMouseOver={e => e.currentTarget.style.borderColor = rs.color}
                                        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                                        <div style={{ fontSize: 24, marginBottom: 4 }}>{rs.icon}</div>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2d3748' }}>{rs.name}</div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{rs.desc}</div>
                                    </div>
                                ))}
                            </div>

                            {adminTs.length > 0 && (<>
                                <div className="label" style={{ marginBottom: 8 }}>🔒 Templates globais</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                                    {adminTs.map(t => (
                                        <div key={t.id} className="card" onClick={() => loadTemplate(t)} style={{ padding: 14, cursor: 'pointer' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.name}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{t.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </>)}
                            {userTs.length > 0 && (<>
                                <div className="label" style={{ marginBottom: 8 }}>📁 Meus templates</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                                    {userTs.map(t => (
                                        <div key={t.id} className="card" style={{ padding: 14, position: 'relative' }}>
                                            <div onClick={() => loadTemplate(t)} style={{ cursor: 'pointer' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.name}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{t.desc}</div>
                                            </div>
                                            <button onClick={() => { if (confirm('Deletar?')) { deleteUserTemplate(t.id); setShowTemplates(false); setTimeout(() => setShowTemplates(true), 10); } }}
                                                style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 2 }}><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                </div>
                            </>)}
                            <button className="btn btn-ghost btn-full" onClick={() => { setShowTemplates(false); if (!steps.length) addStep('Etapa 1'); }}>✏️ Começar do zero</button>
                        </div>
                    </div>
                );
            })()}

            {/* AI Step Generation Modal */}
            {showAiStepModal && (
                <div className="modal-overlay" onClick={() => !aiStepLoading && setShowAiStepModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">🤖 Criar Etapa por IA</h3>
                            <button className="modal-close" onClick={() => !aiStepLoading && setShowAiStepModal(false)}>×</button>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                            Descreva a etapa que deseja criar e a IA gerará os blocos automaticamente.
                        </p>
                        <textarea
                            value={aiStepPrompt}
                            onChange={e => setAiStepPrompt(e.target.value)}
                            placeholder="Ex: Pergunta sobre hábitos alimentares com 4 opções de resposta e uma imagem motivacional"
                            style={{ width: '100%', minHeight: 100, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: '0.82rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAiStepModal(false)} disabled={aiStepLoading}>Cancelar</button>
                            <button className="btn btn-accent" style={{ flex: 1 }} disabled={!aiStepPrompt.trim() || aiStepLoading}
                                onClick={async () => {
                                    setAiStepLoading(true);
                                    try {
                                        // Try AI generation via the existing generate endpoint
                                        const prompt = aiStepPrompt.trim();
                                        // Fallback: generate a reasonable step locally
                                        const ns = makeStep(prompt.slice(0, 30));
                                        const hasQuestion = prompt.toLowerCase().includes('pergunt') || prompt.toLowerCase().includes('escolh') || prompt.toLowerCase().includes('opç');
                                        const hasImage = prompt.toLowerCase().includes('imagem') || prompt.toLowerCase().includes('foto');
                                        const hasText = prompt.toLowerCase().includes('texto') || prompt.toLowerCase().includes('descri');
                                        const blocks = [];
                                        if (hasText) blocks.push(createBlock('text'));
                                        if (hasImage) blocks.push(createBlock('image'));
                                        if (hasQuestion) {
                                            const choiceBlock = createBlock('choice');
                                            choiceBlock.text = prompt;
                                            blocks.push(choiceBlock);
                                        }
                                        if (!blocks.length) {
                                            const choiceBlock = createBlock('choice');
                                            choiceBlock.text = prompt;
                                            blocks.push(choiceBlock);
                                        }
                                        ns.blocks = blocks;
                                        setSteps(s => [...s, ns]);
                                        setActiveStepIdx(steps.length);
                                        setSelectedBlockIdx(null);
                                        showToastMsg('Etapa criada por IA!');
                                    } catch { showToastMsg('Erro ao gerar etapa'); }
                                    setAiStepLoading(false);
                                    setShowAiStepModal(false);
                                    setAiStepPrompt('');
                                }}
                            >
                                {aiStepLoading ? '⏳ Gerando...' : '🤖 Gerar Etapa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clone Modal — Screenshot-based */}
            {/* Settings Modal */}
            {showSettings && (
                <div className="modal-overlay" onClick={() => setShowSettings(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Settings size={16} /> Configurações</h3>
                            <button className="modal-close" onClick={() => setShowSettings(false)}>×</button>
                        </div>
                        <div className="form-group">
                            <label className="label">Nome do quiz</label>
                            <input className="input" value={config.name || ''} placeholder="Ex: Quiz de Emagrecimento" onChange={e => updateConfig('name', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="label">Nicho</label>
                            <select className="input" value={config.niche || 'outro'} onChange={e => updateConfig('niche', e.target.value)}>
                                {['saude', 'fitness', 'beleza', 'educacao', 'financas', 'tech', 'alimentacao', 'marketing', 'outro'].map(n => (
                                    <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 8, marginTop: 12 }}>Tela de Boas-vindas</div>
                        <div className="form-group">
                            <label className="label">Título</label>
                            <input className="input" value={config.welcomeHeadline || ''} placeholder="Ex: Descubra seu tipo" onChange={e => updateConfig('welcomeHeadline', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="label">Subtítulo</label>
                            <input className="input" value={config.welcomeSub || ''} placeholder="Ex: Responda e descubra" onChange={e => updateConfig('welcomeSub', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="label">Texto do botão</label>
                            <input className="input" value={config.welcomeCta || 'Começar →'} placeholder="Começar →" onChange={e => updateConfig('welcomeCta', e.target.value)} />
                        </div>
                        <label className="toggle-wrapper" style={{ marginTop: 8 }}>
                            <label className="toggle"><input type="checkbox" checked={config.collectLead !== false} onChange={e => updateConfig('collectLead', e.target.checked)} /><span className="toggle-slider" /></label>
                            <span style={{ fontSize: '0.8rem' }}>Coletar leads (nome, email)</span>
                        </label>
                        <button className="btn btn-accent btn-full" style={{ marginTop: 16 }} onClick={() => { setShowSettings(false); showToastMsg('Configurações salvas!'); }}>Salvar configurações</button>
                    </div>
                </div>
            )}

            {showCloneModal && (
                <div className="modal-overlay" onClick={() => !cloneLoading && setShowCloneModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Clonar Quiz</h3>
                            <button className="modal-close" onClick={() => !cloneLoading && setShowCloneModal(false)}>×</button>
                        </div>

                        {!cloneLoading ? (
                            <div style={{ overflow: 'auto', flex: 1, padding: '0 0 16px' }}>
                                {/* Tab selector */}
                                <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: '#f1f5f9', borderRadius: 10, padding: 3 }}>
                                    {[{ id: 'screenshots', label: 'Screenshots' }, { id: 'json', label: 'Importar JSON' }].map(tab => (
                                        <button key={tab.id} onClick={() => { setCloneError(null); setCloneMode(tab.id); }}
                                            style={{
                                                flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                                                background: cloneMode === tab.id ? '#fff' : 'transparent',
                                                color: cloneMode === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                                                boxShadow: cloneMode === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                            }}
                                        >{tab.label}</button>
                                    ))}
                                </div>

                                {cloneMode !== 'json' ? (
                                    <>
                                        {/* Upload area */}
                                        <div
                                            style={{
                                                border: '2px dashed var(--border)', borderRadius: 12, padding: cloneLog.length > 0 ? '12px' : '28px 20px',
                                                textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 14,
                                                background: '#fafbfc', maxHeight: cloneLog.length > 0 ? 280 : 'none', overflowY: cloneLog.length > 0 ? 'auto' : 'visible',
                                            }}
                                            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-bg)'; }}
                                            onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = '#fafbfc'; }}
                                            onDrop={e => {
                                                e.preventDefault();
                                                e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = '#fafbfc';
                                                const newFiles = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
                                                if (newFiles.length > 0) setCloneLog(prev => [...prev, ...newFiles.map(f => ({ file: f, preview: URL.createObjectURL(f), name: f.name }))]);
                                            }}
                                            onClick={() => {
                                                const inp = document.createElement('input');
                                                inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
                                                inp.onchange = (ev) => {
                                                    const newFiles = [...ev.target.files].filter(f => f.type.startsWith('image/'));
                                                    if (newFiles.length > 0) setCloneLog(prev => [...prev, ...newFiles.map(f => ({ file: f, preview: URL.createObjectURL(f), name: f.name }))]);
                                                };
                                                inp.click();
                                            }}
                                        >
                                            {cloneLog.length === 0 ? (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Upload size={36} color="var(--text-muted)" /></div>
                                                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                                                        Arraste screenshots aqui
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                        ou clique para selecionar imagens
                                                    </div>
                                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 8 }}>
                                                        Tire um print de cada etapa do quiz que deseja clonar
                                                    </div>
                                                </>
                                            ) : (
                                                /* Thumbnail grid */
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8 }} onClick={e => e.stopPropagation()}>
                                                    {cloneLog.map((item, idx) => (
                                                        <div key={idx} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', aspectRatio: '9/16', background: '#f1f5f9' }}>
                                                            <img src={item.preview} alt={`Screenshot ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            <div style={{ position: 'absolute', top: 3, left: 3, background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{idx + 1}</div>
                                                            <button onClick={(e) => { e.stopPropagation(); setCloneLog(prev => prev.filter((_, i) => i !== idx)); }}
                                                                style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                                                        </div>
                                                    ))}
                                                    {/* Add more button */}
                                                    <div
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const inp = document.createElement('input');
                                                            inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
                                                            inp.onchange = (ev) => {
                                                                const newFiles = [...ev.target.files].filter(f => f.type.startsWith('image/'));
                                                                if (newFiles.length > 0) setCloneLog(prev => [...prev, ...newFiles.map(f => ({ file: f, preview: URL.createObjectURL(f), name: f.name }))]);
                                                            };
                                                            inp.click();
                                                        }}
                                                        style={{ borderRadius: 8, border: '2px dashed #cbd5e1', aspectRatio: '9/16', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.6rem', color: '#94a3b8', gap: 2 }}
                                                    >
                                                        <span style={{ fontSize: 18 }}>+</span>
                                                        <span>Adicionar</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 14, fontSize: '0.7rem', color: '#166534' }}>
                                            <Lightbulb size={14} style={{ display: 'inline', marginRight: 4 }} /> <strong>Dica:</strong> Tire prints de cada etapa do quiz (perguntas, páginas de info, resultado). A IA vai analisar cada screenshot e recriar as etapas.
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ marginBottom: 10 }}>
                                            <label className="label">Cole o JSON do quiz</label>
                                            <textarea id="jsonImportArea" className="input"
                                                placeholder={'{\n  "pages": [\n    { "type": "choice", "text": "Pergunta?", "options": [...] }\n  ]\n}'}
                                                style={{ width: '100%', minHeight: 160, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.4 }} />
                                        </div>
                                        <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 14, fontSize: '0.7rem', color: '#166534' }}>
                                            <Lightbulb size={14} style={{ display: 'inline', marginRight: 4 }} /> <strong>Dica:</strong> Exporte o JSON do dashboard do quiz e cole aqui. Aceita vários formatos.
                                        </div>
                                    </>
                                )}

                                {cloneError && (
                                    <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, marginBottom: 14, fontSize: '0.78rem', color: '#dc2626' }}>{cloneError}</div>
                                )}

                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowCloneModal(false)}>Cancelar</button>
                                    <button className="btn btn-accent" style={{ flex: 2 }}
                                        disabled={cloneMode !== 'json' ? cloneLog.length === 0 : false}
                                        onClick={async () => {
                                            setCloneError(null);
                                            if (cloneMode === 'json') {
                                                const raw = document.getElementById('jsonImportArea')?.value?.trim();
                                                if (!raw) { setCloneError('Cole o JSON primeiro.'); return; }
                                                try {
                                                    const data = JSON.parse(raw);
                                                    let pages = [], quizName = data.name || data.quizName || data.title || 'Quiz Importado', results = data.results || [];
                                                    if (data.pages && Array.isArray(data.pages)) pages = data.pages;
                                                    else if (data.steps && Array.isArray(data.steps)) {
                                                        const ns = data.steps.map((s, i) => ({ id: `stp_j_${Date.now()}_${i}`, name: s.name || `Etapa ${i + 1}`, blocks: s.blocks || [s] }));
                                                        setSteps(ns); setActiveStepIdx(0); setSelectedBlockIdx(null);
                                                        setConfig(c => ({ ...c, name: quizName }));
                                                        if (results.length) setClonedResults(results);
                                                        showToastMsg(`${ns.length} etapas importadas!`);
                                                        setShowCloneModal(false); return;
                                                    }
                                                    else if (data.screens && Array.isArray(data.screens)) {
                                                        pages = data.screens.map(s => {
                                                            const comps = s.components || s.layers || [];
                                                            const textC = comps.find(c => c.type === 'text' || c.type === 'title');
                                                            const optC = comps.find(c => c.type === 'options' || c.type === 'buttons');
                                                            return { type: optC ? 'choice' : 'insight', text: textC?.content || s.name || '', options: optC?.items?.map((o, j) => ({ text: o.text || '', weight: j + 1 })) || [] };
                                                        });
                                                    }
                                                    else if (Array.isArray(data)) {
                                                        pages = data.map(item => ({ type: item.type || 'choice', text: item.question || item.text || '', options: (item.options || item.answers || []).map((o, j) => ({ text: typeof o === 'string' ? o : (o.text || ''), weight: j + 1 })) }));
                                                    }
                                                    if (!pages.length) { setCloneError('Formato não reconhecido.'); return; }
                                                    const ns = pages.map((p, i) => ({ id: `stp_j_${Date.now()}_${i}`, name: (p.text || '').slice(0, 25) || `Etapa ${i + 1}`, blocks: [p] }));
                                                    setSteps(ns); setActiveStepIdx(0); setSelectedBlockIdx(null);
                                                    setConfig(c => ({ ...c, name: quizName, primaryColor: data.primaryColor || c.primaryColor }));
                                                    if (results.length) setClonedResults(results);
                                                    showToastMsg(`${ns.length} etapas importadas!`);
                                                    setShowCloneModal(false);
                                                } catch (e) { setCloneError('JSON inválido: ' + e.message); }
                                                return;
                                            }

                                            // Screenshot mode
                                            if (cloneLog.length === 0) { setCloneError('Adicione pelo menos 1 screenshot.'); return; }
                                            setCloneLoading(true);
                                            setCloneProgress({ stage: 'uploading', msg: `Enviando ${cloneLog.length} screenshots...`, pct: 5 });
                                            let success = false;
                                            try {
                                                const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
                                                const formData = new FormData();
                                                for (const item of cloneLog) {
                                                    formData.append('screenshots', item.file);
                                                }
                                                const res = await fetch(`${API_BASE}/api/clone-screenshots`, {
                                                    method: 'POST',
                                                    body: formData,
                                                });
                                                if (!res.ok) {
                                                    const errData = await res.json().catch(() => ({}));
                                                    throw new Error(errData.error || `Erro ${res.status}`);
                                                }
                                                const result = await res.json();
                                                const pages = result.pages || [];
                                                if (pages.length > 0) {
                                                    const ns = pages.map((p, i) => ({
                                                        id: `stp_ss_${Date.now()}_${i}`,
                                                        name: (p.text || '').replace(/\n/g, ' ').slice(0, 25) || `Etapa ${i + 1}`,
                                                        blocks: [{
                                                            type: p.type || 'choice',
                                                            text: p.text || '',
                                                            options: (p.options || []).map((o, j) => ({
                                                                text: o.text || '', emoji: o.emoji || '', weight: j + 1
                                                            })),
                                                        }]
                                                    }));
                                                    setSteps(ns); setActiveStepIdx(0); setSelectedBlockIdx(null);
                                                    setConfig(c => ({ ...c, name: 'Quiz Clonado' }));
                                                    showToastMsg(`${ns.length} etapas extraídas dos screenshots!`);
                                                    success = true;
                                                } else {
                                                    setCloneError('Nenhuma etapa extraída. Tente com screenshots mais claros.');
                                                }
                                            } catch (err) {
                                                setCloneError(err.message || 'Erro ao processar screenshots.');
                                            }
                                            setCloneLoading(false);
                                            if (success) { setCloneLog([]); setShowCloneModal(false); }
                                        }}
                                    >
                                        {cloneMode === 'json' ? 'Importar JSON' : `Analisar ${cloneLog.length} Screenshot${cloneLog.length !== 1 ? 's' : ''}`}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Loading state */
                            <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                                <div style={{ position: 'relative', width: 70, height: 70, margin: '0 auto 16px' }}>
                                    <div style={{ width: 70, height: 70, borderRadius: '50%', border: '4px solid #e2e8f0', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🔍</div>
                                </div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                                    {cloneProgress.msg || 'Analisando screenshots...'}
                                </div>
                                <div style={{ width: '80%', margin: '0 auto', height: 5, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--primary), #10b981)', borderRadius: 5, transition: 'width 0.5s ease', width: `${cloneProgress.pct || 10}%` }} />
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 10 }}>
                                    A IA está analisando cada screenshot • ~5s por imagem
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {renderToast()}
        </div>
    );
}
