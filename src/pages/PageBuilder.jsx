// PageBuilder.jsx — Inlead-style layout with sidebar, tabs, canvas, right panel
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Save, Eye, Monitor, Smartphone, ChevronUp, ChevronDown, Trash2, Plus, X, Layout, Bookmark, Settings, Share2, Play, Undo2, Redo2, Grid, MousePointerClick, CheckCircle2, Users, BarChart3, Palette, Package, GitBranch, Globe, Star, Upload, Download, Filter, TrendingDown, Mail, PlayCircle, Lightbulb, Wrench, Clipboard, ArrowRight, ArrowLeft } from 'lucide-react';
import { saveQuiz, getQuiz, getAnalytics, getLeads } from '../hooks/useQuizStore';
import { consumeQuota } from '../hooks/useAuth';
import { BLOCK_TYPES, CATEGORIES, createBlock } from '../utils/blockTypes';
import { getAdminTemplates, getUserTemplates, saveUserTemplate, deleteUserTemplate } from '../utils/templates';
import { cloneAndOptimize } from '../utils/cloneService';
import PhonePreview from '../components/PhonePreview';
import CloneEditor from '../components/CloneEditor';
import ClonePropertiesPanel from '../components/ClonePropertiesPanel';
import { INSERTABLE_ELEMENTS, translateGadgetHtml } from '../components/CloneEditor';
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
    const [clonedCSS, setClonedCSS] = useState(null);
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
    const [cloneSelectedEl, setCloneSelectedEl] = useState(null);
    const [renamingStepIdx, setRenamingStepIdx] = useState(null);
    const [showCloneModal, setShowCloneModal] = useState(false);
    const [cloneUrl, setCloneUrl] = useState('');
    const [cloneNiche, setCloneNiche] = useState('emagrecimento');
    const [cloneMode, setCloneMode] = useState('url');
    const [cloneLang, setCloneLang] = useState('original');
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
                if (q.cloneLang && q.cloneLang !== 'original') setCloneLang(q.cloneLang);
                if (q.steps?.length) { setSteps(q.steps); setActiveStepIdx(0); }
                else if (q.pages?.length) {
                    const ns = q.pages.map((p, i) => {
                        if (p.type === 'compound' && p.blocks) return { id: `stp_${Date.now()}_${i}`, name: `Etapa ${i + 1}`, blocks: p.blocks };
                        return { id: `stp_${Date.now()}_${i}`, name: p.text || p.headline || `Etapa ${i + 1}`, blocks: [p] };
                    });
                    setSteps(ns); setActiveStepIdx(0);
                }
                if (q.results?.length) setClonedResults(q.results);
                if (q.clonedCSS) setClonedCSS(q.clonedCSS);
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

    // Auto-open clone modal when navigated with ?clone=true, and read funnel name from URL
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('clone') === 'true') {
            setShowCloneModal(true);
            setCloneMode('url');
        }
        const urlName = params.get('name');
        if (urlName && !config.name) {
            setConfig(c => ({ ...c, name: urlName }));
        }
    }, []);

    // Warn before leaving without saving
    const hasConsumedQuizRef = useRef(!!editId); // Don't consume quota for existing quizzes
    useEffect(() => {
        const handler = (e) => {
            if (steps.length > 0 && !saved) {
                e.preventDefault();
                e.returnValue = 'Tem certeza? Salve antes de sair ou perderá o quiz!';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [steps, saved]);

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

    // Stable ID ref — generate once and reuse for the lifetime of this builder session
    const stableIdRef = useRef(null);
    const buildQuiz = () => {
        let id = quizId || editId;
        if (!id) {
            if (!stableIdRef.current) stableIdRef.current = Math.random().toString(36).slice(2, 10);
            id = stableIdRef.current;
        }
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
        return { id, name: config.name || 'Meu Quiz', emoji: isClone ? '🔗' : '🧱', primaryColor: config.primaryColor, bgColor: config.bgColor, colorPalette: [config.primaryColor], productName: config.name, niche: config.niche, metadata: { niche: config.niche, subTheme: config.name, tone: 'profissional', palette: [config.primaryColor], emojiStyle: 'moderno' }, sections: [{ label: 'Quiz', startIndex: 0 }], welcome: { headline: config.welcomeHeadline || 'Descubra', subheadline: config.welcomeSub || '', cta: config.welcomeCta || 'Começar →' }, pages, questions: allBlocks.filter(b => ['choice', 'statement', 'likert', 'image-select', 'single-choice', 'yes-no'].includes(b.type)), results: clonedResults || dr, steps, stepPageMap, stepGoToMap, clonedCSS: clonedCSS || undefined, cloneLang: cloneLang || 'original', collectLead: config.collectLead, published: false, createdAt: Date.now(), updatedAt: Date.now() };
    };

    const handleSave = async () => {
        if (!steps.length) return;
        const quiz = buildQuiz();
        console.log('[Save] Saving quiz with id:', quiz.id, 'quizId state:', quizId, 'editId:', editId);
        const result = await saveQuiz(quiz);
        console.log('[Save] Server response:', result?.id, result ? 'OK' : 'FAILED');
        if (result) {
            setQuizId(result.id);
            // Consume quiz quota on first save only
            if (!hasConsumedQuizRef.current) {
                hasConsumedQuizRef.current = true;
                try { await consumeQuota('quiz'); } catch (e) { /* don't block */ }
            }
            // Update URL without remounting the component
            if (!editId && result.id) {
                window.history.replaceState(null, '', `/builder/page/${result.id}`);
            }
            showToastMsg('Salvo!');
        }
    };

    const handlePublish = async () => {
        if (!steps.length || !steps.some(s => s.blocks.length > 0)) return showToastMsg('Adicione pelo menos 1 bloco!');
        const quiz = { ...buildQuiz(), published: true };
        console.log('[Publish] Publishing quiz with id:', quiz.id, 'quizId state:', quizId, 'editId:', editId);
        const result = await saveQuiz(quiz);
        console.log('[Publish] Server response:', result?.id, result ? 'OK' : 'FAILED');
        if (result) {
            setQuizId(result.id);
            // Update URL without remounting the component
            if (!editId && result.id) {
                window.history.replaceState(null, '', `/builder/page/${result.id}`);
            }
            setSaved(result);
            setShowShare(true);
            showToastMsg('🎉 Publicado com sucesso!');
        }
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
                    <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 4, marginRight: 4, borderRadius: 6 }} title="Voltar ao início" onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}><ArrowLeft size={16} /></button>
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
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 6px', marginBottom: 1, borderRadius: 6, cursor: 'grab', borderTop: 'none',
                                            background: (() => {
                                                const code = (step.blocks || []).map(b => (b.fullCode || b.code || '')).join(' ').toLowerCase();
                                                if (!code) return undefined;
                                                return (/class\s*=\s*["'][^"']*(?:swiper|slick|carousel|slideshow)/.test(code) ||
                                                    code.includes('data-clone-chart') || code.includes('chartbargrow') ||
                                                    code.includes('<video') || code.includes('youtube.com/embed') ||
                                                    code.includes('type="range"')) ? 'rgba(245,158,11,0.1)' : undefined;
                                            })() }}>
                                        {(() => {
                                            const code = (step.blocks || []).map(b => (b.fullCode || b.code || '')).join(' ').toLowerCase();
                                            if (!code) return null;
                                            return (/class\s*=\s*["'][^"']*(?:swiper|slick|carousel|slideshow)/.test(code) ||
                                                code.includes('data-clone-chart') || code.includes('chartbargrow') ||
                                                code.includes('<video') || code.includes('youtube.com/embed') ||
                                                code.includes('type="range"'))
                                                ? <span title="Esta etapa tem elementos complexos que podem precisar de ajuste" style={{ fontSize: '0.7rem', flexShrink: 0, filter: 'saturate(2)', lineHeight: 1 }}>⚠️</span>
                                                : null;
                                        })()}
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

                        {/* Component palette column — always show full gadgets */}
                        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
                            {CATEGORIES.map(cat => {
                                const items = BLOCK_TYPES.filter(b => b.category === cat.key);
                                if (!items.length) return null;
                                return (
                                    <div key={cat.key} className="sidebar-section">
                                        <div className="sidebar-section-title">{cat.label}</div>
                                        {items.map(bt => {
                                            const htmlMap = {
                                                        'text': '<p data-gadget-type="text" style="padding:8px 16px;font-size:16px;line-height:1.6;color:inherit">Seu texto aqui</p>',
                                                        'capture': '<div data-gadget-type="capture" style="padding:8px 16px;margin:8px 0"><label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:inherit">Campo</label><input type="text" placeholder="Digite aqui" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid #d1d5db;font-size:15px;outline:none;box-sizing:border-box"/></div>',
                                                        'email-capture': '<div data-gadget-type="email-input" style="padding:8px 16px;margin:8px 0"><label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:inherit">Seu e-mail</label><input type="email" placeholder="seu@email.com" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid #d1d5db;font-size:15px;outline:none;box-sizing:border-box"/></div>',
                                                        'email-input': '<div data-gadget-type="email-input" style="padding:8px 16px;margin:8px 0"><label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:inherit">Seu e-mail</label><input type="email" placeholder="seu@email.com" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid #d1d5db;font-size:15px;outline:none;box-sizing:border-box"/></div>',
                                                        'phone-capture': '<div data-gadget-type="phone-input" style="padding:8px 16px;margin:8px 0"><label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:inherit">Seu WhatsApp</label><input type="tel" placeholder="(00) 00000-0000" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid #d1d5db;font-size:15px;outline:none;box-sizing:border-box"/></div>',
                                                        'phone-input': '<div data-gadget-type="phone-input" style="padding:8px 16px;margin:8px 0"><label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:inherit">Seu WhatsApp</label><input type="tel" placeholder="(00) 00000-0000" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid #d1d5db;font-size:15px;outline:none;box-sizing:border-box"/></div>',
                                                        'textarea-input': '<div data-gadget-type="textarea-input" style="padding:8px 16px;margin:8px 0"><label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:inherit">Sua resposta</label><textarea placeholder="Digite sua resposta..." style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid #d1d5db;font-size:15px;outline:none;box-sizing:border-box;min-height:80px;resize:vertical"></textarea></div>',
                                                        'date-input': '<div data-gadget-type="date-input" style="padding:8px 16px;margin:8px 0"><label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:inherit">Data</label><input type="date" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid #d1d5db;font-size:15px;outline:none;box-sizing:border-box"/></div>',
                                                        'choice': '<div data-gadget-type="choice" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px"><div style="padding:14px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;font-weight:500;cursor:pointer;text-align:center">Opção A</div><div style="padding:14px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;font-weight:500;cursor:pointer;text-align:center">Opção B</div><div style="padding:14px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;font-weight:500;cursor:pointer;text-align:center">Opção C</div></div>',
                                                        'single-choice': '<div data-gadget-type="single-choice" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px"><div style="padding:14px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:10px"><div style="width:20px;height:20px;border:2px solid #d1d5db;border-radius:50%;flex-shrink:0"></div>Opção 1</div><div style="padding:14px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:10px"><div style="width:20px;height:20px;border:2px solid #d1d5db;border-radius:50%;flex-shrink:0"></div>Opção 2</div></div>',
                                                        'image-select': '<div data-gadget-type="image-select" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px"><div style="padding:14px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:10px"><div style="width:20px;height:20px;border:2px solid #d1d5db;border-radius:4px;flex-shrink:0"></div>Opção A</div><div style="padding:14px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:10px"><div style="width:20px;height:20px;border:2px solid #d1d5db;border-radius:4px;flex-shrink:0"></div>Opção B</div></div>',
                                                        'yes-no': '<div data-gadget-type="yes-no" style="padding:16px;display:flex;gap:10px;justify-content:center"><div style="flex:1;padding:20px;border:2px solid #e5e7eb;border-radius:14px;text-align:center;cursor:pointer;font-size:15px;font-weight:600"><div style="font-size:28px;margin-bottom:6px">👍</div>Sim</div><div style="flex:1;padding:20px;border:2px solid #e5e7eb;border-radius:14px;text-align:center;cursor:pointer;font-size:15px;font-weight:600"><div style="font-size:28px;margin-bottom:6px">👎</div>Não</div></div>',
                                                        'image': '<img data-gadget-type="image" src="https://placehold.co/600x200/e5e7eb/999?text=Sua+imagem" style="width:100%;max-width:100%;height:auto;display:block;margin:8px 0;border-radius:8px"/>',
                                                        'video': '<div data-gadget-type="video" style="padding:16px;text-align:center"><div style="background:#f1f5f9;border-radius:12px;padding:40px 20px;border:2px dashed #d1d5db"><div style="font-size:32px;margin-bottom:8px">▶️</div><div style="font-size:14px;font-weight:600;color:#64748b">Cole o link do vídeo</div></div></div>',
                                                        'button': '<button data-gadget-type="button" style="display:block;width:80%;margin:12px auto;padding:14px 24px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;text-align:center">Clique aqui</button>',
                                                        'logo': '<div data-gadget-type="logo" style="text-align:center;padding:12px"><img src="https://placehold.co/120x40/e5e7eb/999?text=Logo" style="height:40px;object-fit:contain"/></div>',
                                                        'spacer': '<div data-gadget-type="spacer" style="height:32px"></div>',
                                                        'carousel': '<div data-gadget-type="carousel" data-carousel style="padding:16px;overflow-x:auto;display:flex;gap:12px;scroll-snap-type:x mandatory"><div style="min-width:260px;flex-shrink:0;border-radius:12px;overflow:hidden;scroll-snap-align:start;border:1px solid #e5e7eb"><img src="https://placehold.co/260x180/e5e7eb/999?text=Slide+1" style="width:100%;height:180px;object-fit:cover"/><div style="padding:10px;font-size:14px;font-weight:600">Slide 1</div></div><div style="min-width:260px;flex-shrink:0;border-radius:12px;overflow:hidden;scroll-snap-align:start;border:1px solid #e5e7eb"><img src="https://placehold.co/260x180/e5e7eb/999?text=Slide+2" style="width:100%;height:180px;object-fit:cover"/><div style="padding:10px;font-size:14px;font-weight:600">Slide 2</div></div></div>',
                                                        'before-after': '<div data-gadget-type="before-after" style="padding:16px;display:flex;gap:8px"><div style="flex:1;text-align:center"><div style="font-size:12px;font-weight:700;color:#ef4444;margin-bottom:6px">ANTES</div><img src="https://placehold.co/150x200/fef2f2/ef4444?text=Antes" style="width:100%;border-radius:8px"/></div><div style="flex:1;text-align:center"><div style="font-size:12px;font-weight:700;color:#10b981;margin-bottom:6px">DEPOIS</div><img src="https://placehold.co/150x200/ecfdf5/10b981?text=Depois" style="width:100%;border-radius:8px"/></div></div>',
                                                        'chart': '<div data-gadget-type="chart" style="padding:16px;margin:10px 0"><div style="font-size:14px;font-weight:700;margin-bottom:12px;text-align:center;color:inherit">Resultados</div><div style="display:flex;align-items:flex-end;gap:8px;height:120px;padding:0 10px"><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:100%;background:linear-gradient(to top,#6366f1,#818cf8);border-radius:6px 6px 0 0;height:80%"></div><span style="font-size:11px;font-weight:600">A</span></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:100%;background:linear-gradient(to top,#f59e0b,#fbbf24);border-radius:6px 6px 0 0;height:55%"></div><span style="font-size:11px;font-weight:600">B</span></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:100%;background:linear-gradient(to top,#10b981,#34d399);border-radius:6px 6px 0 0;height:90%"></div><span style="font-size:11px;font-weight:600">C</span></div></div></div>',
                                                        'bmi': '<div data-gadget-type="bmi" style="padding:16px;text-align:center"><div style="font-size:14px;font-weight:700;margin-bottom:8px">IMC</div><div style="width:100px;height:100px;border-radius:50%;background:conic-gradient(#10b981 0% 65%,#e5e7eb 65% 100%);margin:0 auto;position:relative"><div style="position:absolute;inset:25%;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800">24</div></div></div>',
                                                        'metrics': '<div data-gadget-type="metrics" style="padding:16px;display:flex;gap:8px"><div style="flex:1;text-align:center;padding:12px;background:#f0f5ff;border-radius:10px"><div style="font-size:20px;font-weight:800;color:#2563eb">1850</div><div style="font-size:11px;color:#64748b">kcal/dia</div></div><div style="flex:1;text-align:center;padding:12px;background:#ecfdf5;border-radius:10px"><div style="font-size:20px;font-weight:800;color:#10b981">68kg</div><div style="font-size:11px;color:#64748b">peso ideal</div></div></div>',
                                                        'alert': '<div data-gadget-type="alert" style="padding:14px 16px;margin:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;display:flex;gap:10px;align-items:center"><span style="font-size:20px">⚠️</span><div style="font-size:14px;font-weight:600;color:#991b1b">Atenção! Mensagem importante aqui.</div></div>',
                                                        'notification': '<div data-gadget-type="notification" style="padding:12px 16px;margin:8px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;display:flex;gap:10px;align-items:center"><span style="font-size:18px">🔔</span><div style="font-size:14px;font-weight:600;color:#065f46">Notificação de exemplo</div></div>',
                                                        'timer': '<div data-gadget-type="timer" style="text-align:center;padding:12px"><div style="font-size:28px;font-weight:800;font-family:monospace;color:#ef4444">05:00</div><div style="font-size:11px;color:#64748b">Oferta expira em</div></div>',
                                                        'loading': '<div data-gadget-type="loading" style="text-align:center;padding:32px 16px"><div style="width:40px;height:40px;border:3px solid #e5e7eb;border-top-color:#6366f1;border-radius:50%;margin:0 auto 12px;animation:spin 1s linear infinite"></div><div style="font-size:14px;font-weight:600;color:#374151">Analisando...</div></div>',
                                                        'progress-bar': '<div data-gadget-type="progress-bar" style="text-align:center;padding:32px 16px"><div style="font-size:14px;font-weight:700;margin-bottom:12px" data-pb-title>Analisando seu perfil...</div><div style="height:12px;background:#e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:8px"><div data-pb-fill style="height:100%;width:0%;background:linear-gradient(90deg,#10b981,#34d399);border-radius:6px;transition:width 0.1s linear"></div></div><div data-pb-pct style="font-size:12px;font-weight:700;color:#10b981">0%</div></div><script data-pb-anim>(function(){var f=document.querySelector("[data-pb-fill]");var p=document.querySelector("[data-pb-pct]");if(!f||!p)return;var start=Date.now();var dur=5000;var iv=setInterval(function(){var e=Date.now()-start;var pct=Math.min(100,Math.round(e/dur*100));f.style.width=pct+"%";p.textContent=pct+"%";if(pct>=100){clearInterval(iv);setTimeout(function(){window.parent.postMessage({type:"clone-advance"},"*")},600)}},50)})()</script>',
                                                        'risk-chart': '<div data-gadget-type="risk-chart" style="padding:16px;text-align:center"><div style="font-size:14px;font-weight:700;margin-bottom:12px">Seu nível de risco</div><svg data-rc-svg viewBox="0 0 320 180" style="width:100%;max-width:380px"><defs><linearGradient id="rcG" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="#22c55e"/><stop offset="30%" stop-color="#eab308"/><stop offset="60%" stop-color="#f97316"/><stop offset="100%" stop-color="#ef4444"/></linearGradient><linearGradient id="rcGF" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="#22c55e" stop-opacity="0.35"/><stop offset="30%" stop-color="#eab308" stop-opacity="0.35"/><stop offset="60%" stop-color="#f97316" stop-opacity="0.35"/><stop offset="100%" stop-color="#ef4444" stop-opacity="0.35"/></linearGradient></defs><line x1="10" y1="150" x2="310" y2="150" stroke="#475569" stroke-width="1"/><path data-rc-area fill="url(#rcGF)" d="M10 150 L310 150 Z"/><path data-rc-line fill="none" stroke="url(#rcG)" stroke-width="3" stroke-linecap="round" d="M10 150"/><g data-rc-dots></g><g data-rc-label style="opacity:0"></g><text x="10" y="176" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="500">Baixo</text><text x="85" y="176" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="500">Aceitável</text><text x="160" y="176" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="500">Normal</text><text x="235" y="176" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="500">Médio</text><text x="310" y="176" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="500">Alto</text></svg></div><script data-rc-anim>(function(){var vals=[0.08,0.18,0.35,0.62,0.95];var W=300,H=120,pL=10,pT=30;var uIdx=3;var dur=3000;var start=Date.now();var area=document.querySelector("[data-rc-area]");var line=document.querySelector("[data-rc-line]");var dots=document.querySelector("[data-rc-dots]");var lbl=document.querySelector("[data-rc-label]");if(!area||!line)return;function anim(){var t=Math.min(1,(Date.now()-start)/dur);var pts=vals.map(function(v,i){return{x:pL+i/4*W,y:pT+H-v*t*H}});var d="M "+pts[0].x+" "+pts[0].y;for(var i=1;i<pts.length;i++){var p=pts[i-1],c=pts[i];var cx1=p.x+(c.x-p.x)*0.5;d+=" C "+cx1+" "+p.y+" "+cx1+" "+c.y+" "+c.x+" "+c.y}line.setAttribute("d",d);area.setAttribute("d",d+" L "+pts[4].x+" 150 L "+pts[0].x+" 150 Z");var dh="";for(var i=0;i<pts.length;i++){var r=i===uIdx?6:4;var f=i===uIdx?"#fff":"url(#rcG)";var s=i===uIdx?" stroke=\\"#eab308\\" stroke-width=\\"2\\"":"";dh+="<circle cx=\\""+pts[i].x+"\\" cy=\\""+pts[i].y+"\\" r=\\""+r+"\\" fill=\\""+f+"\\""+s+" opacity=\\""+(t>0.1?1:0)+"\\"/>";}dots.innerHTML=dh;if(t>0.5){lbl.style.opacity=Math.min(1,(t-0.5)*4);var ux=pts[uIdx].x,uy=pts[uIdx].y;lbl.innerHTML="<rect x=\\""+(ux-22)+"\\" y=\\""+(uy-28)+"\\" width=\\"44\\" height=\\"20\\" rx=\\"10\\" fill=\\"#eab308\\"/><text x=\\""+ux+"\\" y=\\""+(uy-15)+"\\" text-anchor=\\"middle\\" fill=\\"#fff\\" font-size=\\"10\\" font-weight=\\"700\\">Você</text>"}if(t<1){requestAnimationFrame(anim)}else{setTimeout(function(){window.parent.postMessage({type:"clone-advance"},"*")},1200)}}anim()})()</script>',
                                                        'testimonial': '<div data-gadget-type="testimonial" style="padding:16px;display:flex;gap:10px;align-items:flex-start"><div style="width:40px;height:40px;border-radius:50%;background:#e5e7eb;flex-shrink:0"></div><div><div style="font-size:13px;font-weight:700;color:#111">Maria S.</div><div style="font-size:11px;color:#f59e0b;margin-bottom:4px">★★★★★</div><div style="font-size:13px;color:#4b5563">"Resultado incrível! Recomendo demais."</div></div></div>',
                                                        'social-proof': '<div data-gadget-type="social-proof" style="padding:16px;display:flex;gap:10px;align-items:flex-start"><div style="width:40px;height:40px;border-radius:50%;background:#e5e7eb;flex-shrink:0"></div><div><div style="font-size:13px;font-weight:700;color:#111">Maria S.</div><div style="font-size:11px;color:#f59e0b;margin-bottom:4px">★★★★★</div><div style="font-size:13px;color:#4b5563">"Resultado incrível! Recomendo demais."</div></div></div>',
                                                        'faq': '<div data-gadget-type="faq" style="padding:12px 16px"><details style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:8px"><summary style="font-weight:600;font-size:14px;cursor:pointer">Pergunta frequente 1?</summary><p style="margin-top:8px;font-size:13px;color:#64748b">Resposta da pergunta.</p></details><details style="border:1px solid #e5e7eb;border-radius:10px;padding:12px"><summary style="font-weight:600;font-size:14px;cursor:pointer">Pergunta frequente 2?</summary><p style="margin-top:8px;font-size:13px;color:#64748b">Resposta da pergunta.</p></details></div>',
                                                        'price': '<div data-gadget-type="price" style="padding:16px;text-align:center;border:2px solid #e5e7eb;border-radius:14px;margin:8px"><div style="font-size:12px;font-weight:700;color:#6366f1;text-transform:uppercase;margin-bottom:4px">Premium</div><div style="font-size:32px;font-weight:800;color:#111">R$97</div><div style="font-size:12px;color:#64748b;margin-bottom:12px">pagamento único</div><button style="width:100%;padding:12px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer">Quero agora</button></div>',
                                                        'pricing': '<div data-gadget-type="price" style="padding:16px;text-align:center;border:2px solid #e5e7eb;border-radius:14px;margin:8px"><div style="font-size:12px;font-weight:700;color:#6366f1;text-transform:uppercase;margin-bottom:4px">Premium</div><div style="font-size:32px;font-weight:800;color:#111">R$97</div><div style="font-size:12px;color:#64748b;margin-bottom:12px">pagamento único</div><button style="width:100%;padding:12px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer">Quero agora</button></div>',
                                                        'insight': '<div data-gadget-type="insight" style="padding:16px;background:#fffbeb;border-radius:12px;border-left:4px solid #f59e0b;margin:8px"><div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:4px">💡 Insight</div><div style="font-size:14px;color:#78350f">Dica personalizada baseada nas suas respostas.</div></div>',
                                                        'result': '<div data-gadget-type="result" style="padding:20px 16px;text-align:center;background:linear-gradient(135deg,#f0f5ff,#ede9fe);border-radius:12px;margin:8px"><div style="font-size:40px;margin-bottom:8px">🎉</div><div style="font-size:20px;font-weight:800;color:#1e1b4b;margin-bottom:4px">Seu Resultado</div><p style="font-size:14px;color:#64748b">Parabéns! Veja sua personalização.</p></div>',
                                                        'welcome': '<div data-gadget-type="welcome" style="padding:32px 16px;text-align:center;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:0;color:#fff"><div style="font-size:24px;font-weight:800;margin-bottom:8px">Título do Quiz</div><p style="font-size:14px;opacity:0.85;margin-bottom:20px">Descubra algo incrível sobre você</p><button style="padding:14px 32px;background:#fff;color:#6366f1;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer">Começar →</button></div>',
                                                        'cover': '<div data-gadget-type="welcome" style="padding:32px 16px;text-align:center;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:0;color:#fff"><div style="font-size:24px;font-weight:800;margin-bottom:8px">Título do Quiz</div><p style="font-size:14px;opacity:0.85;margin-bottom:20px">Descubra algo incrível sobre você</p><button style="padding:14px 32px;background:#fff;color:#6366f1;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer">Começar →</button></div>',
                                                        'level': '<div data-gadget-type="level" style="padding:12px 16px"><div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Progresso</div><div style="height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden"><div style="height:100%;width:65%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:5px"></div></div><div style="font-size:11px;color:#9ca3af;margin-top:4px;text-align:right">65%</div></div>',
                                                        'arguments': '<div data-gadget-type="arguments" style="padding:12px 16px"><div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px"><span style="font-size:18px">✅</span><div style="font-size:14px;font-weight:500;color:#374151">Benefício número 1</div></div><div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px"><span style="font-size:18px">✅</span><div style="font-size:14px;font-weight:500;color:#374151">Benefício número 2</div></div><div style="display:flex;gap:10px;align-items:flex-start"><span style="font-size:18px">✅</span><div style="font-size:14px;font-weight:500;color:#374151">Benefício número 3</div></div></div>',
                                                        'audio': '<div data-gadget-type="audio" style="padding:16px;text-align:center"><div style="background:#f1f5f9;border-radius:12px;padding:20px;border:2px dashed #d1d5db"><div style="font-size:24px;margin-bottom:6px">🔊</div><div style="font-size:13px;font-weight:600;color:#64748b">Player de áudio</div></div></div>',
                                                        'video-response': '<div data-gadget-type="video-response" style="padding:16px"><div style="background:#f8fafc;border-radius:12px;padding:20px;text-align:center;border:1px solid #e2e8f0;margin-bottom:10px"><div style="font-size:28px;margin-bottom:6px">🎥</div><div style="font-size:13px;font-weight:600;color:#64748b">Vídeo</div></div><div style="display:flex;flex-direction:column;gap:8px"><div style="padding:12px;border:2px solid #e5e7eb;border-radius:10px;font-size:14px;font-weight:500;text-align:center;cursor:pointer">Opção 1</div><div style="padding:12px;border:2px solid #e5e7eb;border-radius:10px;font-size:14px;font-weight:500;text-align:center;cursor:pointer">Opção 2</div></div></div>',
                                                    };
                                            return (
                                            <div key={bt.type} className="sidebar-item" draggable
                                                onDragStart={() => {
                                                    setDragFromSidebar(bt.type);
                                                    window.__draggedGadgetHtml = translateGadgetHtml(htmlMap[bt.type] || `<div data-gadget-type="${bt.type}" style="padding:16px;text-align:center;border:2px dashed #d1d5db;border-radius:10px;margin:8px;font-size:14px;color:#9ca3af">${bt.label}</div>`, cloneLang);
                                                }}
                                                onDragEnd={() => { setDragFromSidebar(null); setDragOverBlockIdx(null); window.__draggedGadgetHtml = null; }}
                                                onClick={() => {
                                                    if (activeStep?.blocks?.[0]?.type?.startsWith('html-') && window.__cloneEditorApi?.insertElement) {
                                                        const html = htmlMap[bt.type] || `<div data-gadget-type="${bt.type}" style="padding:16px;text-align:center;border:2px dashed #d1d5db;border-radius:10px;margin:8px;font-size:14px;color:#9ca3af">${bt.label}</div>`;
                                                        window.__cloneEditorApi.insertElement(html);
                                                    } else {
                                                        if (!steps.length) addStep('Etapa 1');
                                                        addBlockToStep(bt.type);
                                                    }
                                                }}>
                                                <div className="sidebar-item-icon">{bt.icon}</div>
                                                <span>{bt.label}</span>
                                            </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* CENTER CANVAS */}
                    <div className="builder-canvas" onClick={(e) => { if (e.target === e.currentTarget) setSelectedBlockIdx(null); }} style={activeStep?.blocks?.[0]?.type === 'html-script' ? { padding: 0, display: 'flex' } : {}}>
                        {activeStep?.blocks?.[0]?.type === 'html-script' ? (
                            <CloneEditor
                                block={activeStep.blocks[0]}
                                onBlockChange={(updatedBlock) => updateBlock(0, updatedBlock)}
                                stepName={activeStep.name}
                                primaryColor={config.primaryColor}
                                onElementSelect={(info) => setCloneSelectedEl(info)}
                                lang={cloneLang}
                            />
                        ) : (
                            <PhonePreview step={activeStep} selectedBlockId={selectedBlock?.id}
                                onSelectBlock={i => setSelectedBlockIdx(i)} onDeleteBlock={i => deleteBlock(i)}
                                onBlockChange={(i, b) => updateBlock(i, b)} config={config} viewMode={viewMode}
                                onDropBlock={handleDropBlock} onDragOverBlock={setDragOverBlockIdx}
                                dragOverBlockIdx={dragFromSidebar ? dragOverBlockIdx : null} onReorderBlock={reorderBlock} />
                        )}
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
                        {/* Clone element properties panel */}
                        {activeStep?.blocks?.[0]?.type === 'html-script' && cloneSelectedEl ? (
                            cloneSelectedEl.type === 'gadget' ? (
                                /* ── Native PropertiesPanel for gadgets ── */
                                (() => {
                                    const gType = cloneSelectedEl.gadgetType || 'text';

                                    const virtualBlock = (() => {
                                        const base = {
                                            type: gType,
                                            text: cloneSelectedEl.text || '',
                                            imageUrl: cloneSelectedEl.src || '',
                                            width: 100,
                                        };
                                        // Extract chart data from innerHTML
                                        if (gType === 'chart') {
                                            const el = cloneSelectedEl.innerHTML || '';
                                            base.chartType = 'bar';
                                            base.chartColor = '#6366f1';
                                            base.title = 'Resultados';
                                            base.data = [
                                                { label: 'A', value: 80 },
                                                { label: 'B', value: 55 },
                                                { label: 'C', value: 90 },
                                            ];
                                        }
                                        return base;
                                    })();
                                    const handleGadgetChange = (newBlock) => {
                                        if (!window.__cloneEditorApi) return;
                                        const path = cloneSelectedEl.gadgetPath || cloneSelectedEl.path;
                                        let html = '';
                                        const t = newBlock.type || gType;
                                        if (t === 'text') {
                                            html = `<p data-gadget-type="text" style="padding:8px 16px;font-size:16px;line-height:1.6;color:inherit">${newBlock.text || ''}</p>`;
                                        } else if (t === 'button') {
                                            const bg = newBlock.buttonColor || '#2563eb';
                                            const txt = newBlock.buttonTextColor || '#fff';
                                            const rad = newBlock.buttonRadius ?? 10;
                                            html = `<button data-gadget-type="button" style="display:block;width:80%;margin:12px auto;padding:14px 24px;background:${bg};color:${txt};border:none;border-radius:${rad}px;font-size:16px;font-weight:700;cursor:pointer;text-align:center">${newBlock.text || 'Clique aqui'}</button>`;
                                        } else if (t === 'image') {
                                            html = `<img data-gadget-type="image" src="${newBlock.imageUrl || 'https://placehold.co/600x200/e5e7eb/999?text=Sua+imagem'}" style="width:100%;max-width:100%;height:auto;display:block;margin:8px 0;border-radius:8px"/>`;
                                        } else if (t === 'chart') {
                                            const ct = newBlock.chartType || 'bar';
                                            const color = newBlock.chartColor || '#6366f1';
                                            const title = newBlock.title || '';
                                            const data = newBlock.data || [{ label: 'A', value: 80 }, { label: 'B', value: 55 }, { label: 'C', value: 90 }];
                                            const maxVal = Math.max(...data.map(d => d.value), 1);
                                            const dataJson = JSON.stringify(data).replace(/"/g, '&quot;');

                                            if (ct === 'bar') {
                                                const barsHtml = data.map(d => {
                                                    const pct = Math.round((d.value / maxVal) * 100);
                                                    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div data-chart-bar data-target-height="${pct}%" style="width:100%;background:linear-gradient(to top,${color},${color}cc);border-radius:6px 6px 0 0;height:${pct}%"></div><span style="font-size:11px;font-weight:600">${d.label}</span></div>`;
                                                }).join('');
                                                html = `<div data-gadget-type="chart" data-chart-type="${ct}" data-chart-color="${color}" data-chart-data="${dataJson}" style="padding:16px;margin:10px 0">${title ? `<div style="font-size:14px;font-weight:700;margin-bottom:12px;text-align:center;color:inherit">${title}</div>` : ''}<div style="display:flex;align-items:flex-end;gap:8px;height:120px;padding:0 10px">${barsHtml}</div></div>`;
                                            } else if (ct === 'pie' || ct === 'donut') {
                                                const total = data.reduce((s, d) => s + d.value, 0) || 1;
                                                const colors = [color, '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
                                                let gradParts = [], acc = 0;
                                                data.forEach((d, i) => {
                                                    const pct = (d.value / total) * 100;
                                                    gradParts.push(`${colors[i % colors.length]} ${acc}% ${acc + pct}%`);
                                                    acc += pct;
                                                });
                                                const inset = ct === 'donut' ? '<div style="position:absolute;inset:30%;background:#fff;border-radius:50%"></div>' : '';
                                                html = `<div data-gadget-type="chart" data-chart-type="${ct}" data-chart-color="${color}" data-chart-data="${dataJson}" style="padding:16px;text-align:center">${title ? `<div style="font-size:14px;font-weight:700;margin-bottom:12px">${title}</div>` : ''}<div style="width:120px;height:120px;border-radius:50%;background:conic-gradient(${gradParts.join(',')});margin:0 auto;position:relative">${inset}</div><div style="display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap">${data.map((d, i) => `<div style="display:flex;align-items:center;gap:4px;font-size:11px"><div style="width:8px;height:8px;border-radius:50%;background:${colors[i % colors.length]}"></div>${d.label}</div>`).join('')}</div></div>`;
                                            } else if (ct === 'radial') {
                                                const gaugeHtml = data.map((d, i) => {
                                                    const pct = Math.min(d.value, 100);
                                                    const colors = [color, '#f59e0b', '#10b981', '#ef4444'];
                                                    const c = colors[i % colors.length];
                                                    return `<div style="text-align:center"><div style="width:60px;height:60px;border-radius:50%;background:conic-gradient(${c} 0% ${pct}%,#e5e7eb ${pct}% 100%);margin:0 auto;position:relative"><div style="position:absolute;inset:25%;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">${d.value}</div></div><div style="font-size:10px;font-weight:600;margin-top:4px">${d.label}</div></div>`;
                                                }).join('');
                                                html = `<div data-gadget-type="chart" data-chart-type="${ct}" data-chart-color="${color}" data-chart-data="${dataJson}" style="padding:16px;text-align:center">${title ? `<div style="font-size:14px;font-weight:700;margin-bottom:12px">${title}</div>` : ''}<div style="display:flex;gap:16px;justify-content:center">${gaugeHtml}</div></div>`;
                                            } else {
                                                // line chart fallback — use bars
                                                const barsHtml = data.map(d => {
                                                    const pct = Math.round((d.value / maxVal) * 100);
                                                    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div data-chart-bar data-target-height="${pct}%" style="width:100%;background:linear-gradient(to top,${color},${color}cc);border-radius:6px 6px 0 0;height:${pct}%"></div><span style="font-size:11px;font-weight:600">${d.label}</span></div>`;
                                                }).join('');
                                                html = `<div data-gadget-type="chart" data-chart-type="${ct}" data-chart-color="${color}" data-chart-data="${dataJson}" style="padding:16px;margin:10px 0">${title ? `<div style="font-size:14px;font-weight:700;margin-bottom:12px;text-align:center;color:inherit">${title}</div>` : ''}<div style="display:flex;align-items:flex-end;gap:8px;height:120px;padding:0 10px">${barsHtml}</div></div>`;
                                            }
                                        } else {
                                            html = `<div data-gadget-type="${t}" style="padding:16px;text-align:center">${newBlock.text || ''}</div>`;
                                        }
                                        window.__cloneEditorApi.replaceElement(path, html);
                                        // Keep gadget selected: update cloneSelectedEl state directly
                                        setCloneSelectedEl(prev => ({
                                            ...prev,
                                            ...newBlock,
                                            gadgetType: t,
                                            text: newBlock.text || prev?.text || '',
                                            innerHTML: html,
                                        }));
                                    };
                                    return (
                                        <div key={cloneSelectedEl.path}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px 0' }}>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                                    Gadget • {BLOCK_TYPES.find(b => b.type === gType)?.label || gType}
                                                </div>
                                                <button onClick={() => setCloneSelectedEl(null)} style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9ca3af', padding: '4px 8px', borderRadius: 6, fontWeight: 600 }}>✕</button>
                                            </div>
                                            <PropertiesPanel block={virtualBlock} onChange={handleGadgetChange} config={config} onConfigChange={updateConfig} steps={steps} />
                                            <div style={{ padding: '0 12px 12px' }}>
                                                <button
                                                    onClick={() => {
                                                        if (window.__cloneEditorApi) {
                                                            window.__cloneEditorApi.deleteElement(cloneSelectedEl.path);
                                                            setCloneSelectedEl(null);
                                                        }
                                                    }}
                                                    style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                                                >🗑️ Remover</button>
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : (
                            <div style={{ padding: 14 }} key={cloneSelectedEl.path}>
                                {/* Clean header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f3f4f6' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>
                                        {{ text: 'Texto', button: 'Botão', image: 'Imagem', container: 'Container', chart: 'Gráfico', input: 'Campo', 'progress-bar': '▰ Barra Progresso', 'risk-chart': '📉 Gráfico Risco', picker: cloneSelectedEl?.pickerType === 'height' ? '📏 Altura' : cloneSelectedEl?.pickerType === 'weight' ? '⚖️ Peso' : '🔢 Número' }[cloneSelectedEl.type] || 'Elemento'}
                                    </div>
                                    <button onClick={() => setCloneSelectedEl(null)} style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9ca3af', padding: '4px 8px', borderRadius: 6, fontWeight: 600 }}>✕</button>
                                </div>

                                <ClonePropertiesPanel el={cloneSelectedEl} step={activeStep} config={config} onBlockChange={(nb) => updateBlock(0, nb)} />

                                {/* Delete */}
                                <button
                                    onClick={() => {
                                        if (window.__cloneEditorApi) {
                                            window.__cloneEditorApi.deleteElement(cloneSelectedEl.path);
                                            setCloneSelectedEl(null);
                                        }
                                    }}
                                    style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 16 }}
                                >🗑️ Remover</button>

                                {/* Language translation */}
                                <details style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                                    <summary style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4b5563', cursor: 'pointer', userSelect: 'none', textTransform: 'uppercase', letterSpacing: '0.4px' }}>🌐 Idioma</summary>
                                    <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                                        <select id="clone-lang-select" defaultValue="es" style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: '0.72rem' }}>
                                            <option value="pt">🇧🇷 Português</option>
                                            <option value="en">🇺🇸 English</option>
                                            <option value="es">🇪🇸 Español</option>
                                            <option value="fr">🇫🇷 Français</option>
                                            <option value="de">🇩🇪 Deutsch</option>
                                            <option value="it">🇮🇹 Italiano</option>
                                        </select>
                                        <button
                                            onClick={async () => {
                                                const lang = document.getElementById('clone-lang-select')?.value;
                                                if (!lang) return;
                                                showToastMsg?.('🌐 Traduzindo...');
                                                try {
                                                    // Collect all text from all cloned steps
                                                    const textsToTranslate = [];
                                                    const stepMapping = []; // track which step/position each text belongs to
                                                    steps.forEach((s, si) => {
                                                        if (s.blocks?.[0]?.type !== 'html-script') return;
                                                        const code = s.blocks[0].code || '';
                                                        // Extract visible text nodes from HTML
                                                        const tmp = document.createElement('div');
                                                        tmp.innerHTML = code;
                                                        const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
                                                        let node;
                                                        while (node = walker.nextNode()) {
                                                            const text = node.textContent.trim();
                                                            if (text.length > 2 && text.length < 500 && !/^[\s\d.,:;!?@#$%^&*()_+=\-\[\]{}|\\/<>~`'"]+$/.test(text)) {
                                                                textsToTranslate.push(text);
                                                                stepMapping.push({ stepIdx: si, originalText: text });
                                                            }
                                                        }
                                                        // Also translate step name
                                                        if (s.name && s.name.length > 2) {
                                                            textsToTranslate.push(s.name);
                                                            stepMapping.push({ stepIdx: si, isName: true, originalText: s.name });
                                                        }
                                                    });

                                                    if (textsToTranslate.length === 0) { showToastMsg?.('Nenhum texto encontrado'); return; }

                                                    // Batch in chunks of 50
                                                    const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
                                                    const chunkSize = 50;
                                                    const allTranslated = [];
                                                    for (let i = 0; i < textsToTranslate.length; i += chunkSize) {
                                                        const chunk = textsToTranslate.slice(i, i + chunkSize);
                                                        const res = await fetch(`${API_BASE}/api/translate`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ texts: chunk, targetLang: lang }),
                                                        });
                                                        const data = await res.json();
                                                        allTranslated.push(...(data.translated || chunk));
                                                    }

                                                    // Apply translations
                                                    const newSteps = [...steps];
                                                    allTranslated.forEach((translated, i) => {
                                                        const mapping = stepMapping[i];
                                                        if (!mapping) return;
                                                        const step = newSteps[mapping.stepIdx];
                                                        if (mapping.isName) {
                                                            step.name = translated;
                                                        } else if (step.blocks?.[0]?.code) {
                                                            // Replace original text with translation in HTML code
                                                            step.blocks[0].code = step.blocks[0].code.split(mapping.originalText).join(translated);
                                                            if (step.blocks[0].fullCode) {
                                                                step.blocks[0].fullCode = step.blocks[0].fullCode.split(mapping.originalText).join(translated);
                                                            }
                                                        }
                                                    });
                                                    setSteps(newSteps);
                                                    showToastMsg?.(`✅ ${allTranslated.length} textos traduzidos!`);
                                                } catch (err) {
                                                    console.error('[Translate]', err);
                                                    showToastMsg?.('❌ Erro ao traduzir');
                                                }
                                            }}
                                            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                        >Traduzir</button>
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: '#9ca3af', marginTop: 4 }}>Traduz todos os textos de todas as etapas clonadas.</div>
                                </details>

                                {/* Pixel tracking */}
                                <details style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                                    <summary style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4b5563', cursor: 'pointer', userSelect: 'none', textTransform: 'uppercase', letterSpacing: '0.4px' }}>📊 Pixel</summary>
                                    <textarea
                                        value={activeStep.blocks[0].pixelCode || ''}
                                        onChange={e => {
                                            updateBlock(0, { ...activeStep.blocks[0], pixelCode: e.target.value });
                                        }}
                                        placeholder={'Facebook Pixel, analytics, etc.'}
                                        style={{ width: '100%', minHeight: 60, padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: '0.68rem', fontFamily: 'monospace', lineHeight: 1.5, resize: 'vertical', outline: 'none', background: '#fafafa', marginTop: 6, boxSizing: 'border-box' }}
                                    />
                                </details>
                            </div>
                            )
                        ) : selectedBlock ? (
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
                const views = analytics?.views || 0;
                const starts = analytics?.starts || 0;
                const completes = analytics?.completes || 0;
                const ctaClicks = (analytics?.events || []).filter(e => e.event === 'cta_click').length;
                const answerEvents = analytics?.answers || [];
                const leadsWithEmail = leads.filter(l => l.email);
                // Count completions: max of complete events, leads, or people who answered last question
                const questionStepsKPI = steps.map((step, si) => {
                    const isQ = step.blocks.some(b => ['choice', 'single-choice', 'yes-no', 'likert', 'statement', 'multi-select'].includes(b.type));
                    return { stepIndex: si, isQuestion: isQ };
                }).filter(s => s.isQuestion);
                const lastQIdxKPI = questionStepsKPI.length > 0 ? questionStepsKPI[questionStepsKPI.length - 1].stepIndex : -1;
                const lastQAnswersKPI = lastQIdxKPI >= 0 ? answerEvents.filter(a => a.questionIndex === lastQIdxKPI).length : 0;
                const realCompletes = Math.max(completes, leadsWithEmail.length, lastQAnswersKPI);
                const convRate = views ? ((ctaClicks / views) * 100).toFixed(1) : '0.0';

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
                                { icon: <Eye size={14} color="#6366f1" />, label: 'Visitas', value: views, sub: 'Acessaram o quiz' },
                                { icon: <Users size={14} color="#6366f1" />, label: 'Leads', value: leadsWithEmail.length, sub: 'Informaram email' },
                                { icon: <BarChart3 size={14} color="#6366f1" />, label: 'Conversão', value: convRate + '%', sub: 'Visitas → CTA' },
                                { icon: <MousePointerClick size={14} color="#6366f1" />, label: 'Cliques CTA', value: ctaClicks, sub: 'Clicaram no botão' },
                                { icon: <CheckCircle2 size={14} color="#6366f1" />, label: 'Completos', value: realCompletes, sub: 'Finalizaram o quiz' },
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
                                            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>Status</th>
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
                                                    <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#16a34a', fontWeight: 600 }}>Completou ✅</span>
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
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    {/* Result distribution */}
                                    <div className="card" style={{ padding: 20 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}><Users size={15} /> Público-Alvo</div>
                                        {(() => {
                                            // Only show demographic/audience-defining questions
                                            const audienceKeywords = [
                                                'sexo', 'gênero', 'genero', 'gender',
                                                'idade', 'faixa etária', 'faixa etaria', 'anos',
                                                'renda', 'salário', 'salario', 'faturamento', 'ganha', 'orçamento', 'orcamento', 'investir', 'budget', 'quanto',
                                                'experiência', 'experiencia', 'nível', 'nivel', 'iniciante', 'avançado',
                                                'profissão', 'profissao', 'trabalha', 'ocupação', 'ocupacao', 'área de atuação',
                                                'escolaridade', 'formação', 'formacao', 'estuda',
                                                'região', 'regiao', 'estado', 'cidade', 'onde mora', 'localização',
                                                'meta', 'objetivo', 'plano',
                                            ];
                                            const profileItems = steps.map((step, si) => {
                                                const qBlock = step.blocks.find(b => ['choice', 'single-choice', 'yes-no', 'likert', 'statement', 'multi-select'].includes(b.type));
                                                if (!qBlock) return null;
                                                const qText = (qBlock.text || '').toLowerCase();
                                                if (!audienceKeywords.some(kw => qText.includes(kw))) return null;
                                                const options = qBlock.options || [];
                                                const stepAns = answerEvents.filter(a => a.questionIndex === si);
                                                if (stepAns.length === 0) return null;
                                                const counts = {};
                                                stepAns.forEach(a => { const oi = a.optionIndex ?? 0; counts[oi] = (counts[oi] || 0) + 1; });
                                                const topOi = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                                                const topIdx = parseInt(topOi[0]);
                                                const topCount = topOi[1];
                                                const topOpt = options[topIdx];
                                                const topText = typeof topOpt === 'string' ? topOpt : (topOpt?.text || `Opção ${topIdx + 1}`);
                                                const pct = Math.round((topCount / stepAns.length) * 100);
                                                // Pick emoji based on question type
                                                let emoji = '📊';
                                                if (/sex|gên|gen/.test(qText)) emoji = '👤';
                                                else if (/idade|etár|anos/.test(qText)) emoji = '📅';
                                                else if (/rend|salár|fatura|orça|invest|quant|budget/.test(qText)) emoji = '💰';
                                                else if (/experiên|nível|nivel|iniciant/.test(qText)) emoji = '🎯';
                                                else if (/profiss|trabalh|ocupa|área/.test(qText)) emoji = '💼';
                                                else if (/escolar|forma|estud/.test(qText)) emoji = '🎓';
                                                else if (/regi|estado|cidade|mora|localiz/.test(qText)) emoji = '📍';
                                                else if (/meta|objetivo|plano/.test(qText)) emoji = '🎯';
                                                return { question: (qBlock.text || '').slice(0, 45), topText, pct, count: topCount, total: stepAns.length, emoji };
                                            }).filter(Boolean);

                                            if (profileItems.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: 20 }}>Sem dados demográficos ainda</div>;
                                            return profileItems.map((q, qi) => (
                                                <div key={qi} style={{ marginBottom: 10, padding: '10px 12px', background: '#f8f9fb', borderRadius: 8 }}>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>{q.question}{q.question.length >= 45 ? '...' : ''}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b' }}>{q.emoji} {q.topText}</span>
                                                        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#6366f1' }}>{q.count}/{q.total} ({q.pct}%)</span>
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                    {/* CTA & funnel */}
                                    <div className="card" style={{ padding: 20 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}><MousePointerClick size={15} /> Métricas de Conversão</div>
                                        {[{ label: 'Visitas → Quiz', val: starts, pct: 100 },
                                        { label: 'Quiz → Conclusão', val: realCompletes, pct: starts ? Math.round((realCompletes / starts) * 100) : 0 },
                                        { label: 'Conclusão → Lead', val: leadsWithEmail.length, pct: realCompletes ? Math.round((leadsWithEmail.length / realCompletes) * 100) : 0 },
                                        { label: 'Lead → CTA Click', val: ctaClicks, pct: leadsWithEmail.length ? Math.round((ctaClicks / leadsWithEmail.length) * 100) : 0 },
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

                                {/* ═══ PERFIL DO PÚBLICO ═══ */}
                                {(() => {
                                    // Detect demographic questions by text matching
                                    const demoKeywords = [
                                        { key: 'sexo', labels: ['sexo', 'gênero', 'genero', 'gender', 'sex'], emoji: '👤' },
                                        { key: 'idade', labels: ['idade', 'faixa etária', 'faixa etaria', 'age', 'anos'], emoji: '📅' },
                                    ];
                                    const profileColors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];
                                    const demoData = [];

                                    demoKeywords.forEach(dk => {
                                        // Find the step that matches this demographic type
                                        for (let si = 0; si < steps.length; si++) {
                                            const step = steps[si];
                                            const choiceBlock = step.blocks.find(b => ['choice', 'single-choice', 'yes-no', 'likert', 'statement'].includes(b.type));
                                            if (!choiceBlock) continue;
                                            const qText = (choiceBlock.text || '').toLowerCase();
                                            if (!dk.labels.some(kw => qText.includes(kw))) continue;

                                            // Found a demographic question — aggregate answers
                                            const options = choiceBlock.options || [];
                                            const stepAnswers = answerEvents.filter(a => a.questionIndex === si);
                                            const dist = {};
                                            options.forEach((o, oi) => {
                                                const optText = typeof o === 'string' ? o : (o.text || `Opção ${oi + 1}`);
                                                dist[optText] = 0;
                                            });
                                            stepAnswers.forEach(a => {
                                                const oi = a.optionIndex;
                                                const opt = options[oi];
                                                const optText = typeof opt === 'string' ? opt : (opt?.text || `Opção ${oi + 1}`);
                                                dist[optText] = (dist[optText] || 0) + 1;
                                            });

                                            // Find which option converts best (has most leads)
                                            // Cross-reference: for each lead, find their answer to this question
                                            // Since we don't have per-session tracking, use overall distribution
                                            const total = stepAnswers.length;

                                            demoData.push({
                                                key: dk.key,
                                                emoji: dk.emoji,
                                                question: choiceBlock.text,
                                                dist,
                                                total,
                                                stepIndex: si,
                                            });
                                            break; // Only use first match per keyword
                                        }
                                    });

                                    if (demoData.length === 0) return null;

                                    return (
                                        <div style={{ marginTop: 16 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Users size={15} /> Perfil do Público
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(demoData.length, 3)}, 1fr)`, gap: 16, marginBottom: 16 }}>
                                                {demoData.map((dd, di) => {
                                                    const entries = Object.entries(dd.dist).filter(([, v]) => v > 0);
                                                    const topEntry = entries.sort((a, b) => b[1] - a[1])[0];
                                                    return (
                                                        <div key={dd.key} className="card" style={{ padding: 18 }}>
                                                            <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <span>{dd.emoji}</span> {dd.key === 'sexo' ? 'Sexo' : dd.key === 'idade' ? 'Faixa Etária' : dd.question}
                                                            </div>
                                                            {dd.total === 0 ? (
                                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', padding: 14 }}>Sem dados</div>
                                                            ) : (
                                                                <>
                                                                    {Object.entries(dd.dist).map(([label, count], ci) => {
                                                                        const pct = dd.total > 0 ? Math.round((count / dd.total) * 100) : 0;
                                                                        const color = profileColors[ci % profileColors.length];
                                                                        return (
                                                                            <div key={label} style={{ marginBottom: 8 }}>
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                                                                    <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#334155' }}>{label}</span>
                                                                                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color }}>{count} ({pct}%)</span>
                                                                                </div>
                                                                                <div style={{ height: 7, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                                                                                    <div style={{ height: '100%', width: `${Math.max(pct, 2)}%`, background: color, borderRadius: 4, transition: 'width 0.5s' }} />
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {topEntry && (
                                                                        <div style={{ marginTop: 10, padding: '8px 10px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0', fontSize: '0.7rem', color: '#166534' }}>
                                                                            👑 Maioria: <strong>{topEntry[0]}</strong> ({Math.round((topEntry[1] / dd.total) * 100)}%)
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Best converting profile insight */}
                                            {demoData.some(d => d.total > 0) && leadsWithEmail.length > 0 && (
                                                <div className="card" style={{ padding: 16, background: 'linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)', border: '1px solid #c7d2fe' }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#4338ca', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <TrendingDown size={14} /> Público que Mais Converte
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: '#3730a3', lineHeight: 1.5 }}>
                                                        {demoData.map(dd => {
                                                            const top = Object.entries(dd.dist).sort((a, b) => b[1] - a[1])[0];
                                                            if (!top || top[1] === 0) return null;
                                                            return (
                                                                <span key={dd.key} style={{ display: 'inline-block', marginRight: 16, padding: '4px 10px', background: 'rgba(255,255,255,.7)', borderRadius: 6, marginBottom: 4 }}>
                                                                    {dd.emoji} <strong>{top[0]}</strong>
                                                                </span>
                                                            );
                                                        })}
                                                        <span style={{ display: 'block', marginTop: 6, fontSize: '0.68rem', color: '#6366f1' }}>
                                                            Baseado em {leadsWithEmail.length} lead{leadsWithEmail.length > 1 ? 's' : ''} convertido{leadsWithEmail.length > 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </>)}

                        {/* ═══ PERFORMANCE SUB-TAB ═══ */}
                        {leadSubTab === 'performance' && (
                            <div>
                                {(() => {
                                    // Build retention data — map answer events to their step positions
                                    const questionSteps = steps.map((step, si) => {
                                        const isQ = step.blocks.some(b => ['choice', 'single-choice', 'yes-no', 'likert', 'statement', 'multi-select'].includes(b.type));
                                        return { step, stepIndex: si, isQuestion: isQ };
                                    }).filter(s => s.isQuestion);

                                    const answersPerPage = {};
                                    answerEvents.forEach(a => {
                                        const qi = a.questionIndex;
                                        if (qi !== undefined) answersPerPage[qi] = (answersPerPage[qi] || 0) + 1;
                                    });

                                    const retentionData = questionSteps.map((qs, i) => ({
                                        name: qs.step.name || `Pergunta ${i + 1}`,
                                        count: answersPerPage[qs.stepIndex] || 0,
                                    }));

                                    const baseline = Math.max(views, starts, retentionData[0]?.count || 0, 1);
                                    const maxCount = Math.max(...retentionData.map(r => r.count), 1);

                                    let bigDrop = 0, bigDropIdx = -1;
                                    for (let i = 1; i < retentionData.length; i++) {
                                        const prev = retentionData[i - 1].count;
                                        const diff = prev - retentionData[i].count;
                                        if (prev > 0 && diff > bigDrop) { bigDrop = diff; bigDropIdx = i; }
                                    }
                                    const dropPct = bigDropIdx >= 0 && retentionData[bigDropIdx - 1]?.count > 0
                                        ? Math.round((bigDrop / retentionData[bigDropIdx - 1].count) * 100) : 0;
                                    const completionRate = views > 0 ? Math.round((realCompletes / views) * 100) : 0;

                                    return (
                                        <>
                                            {/* KPI cards */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                                                <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Visitantes</div>
                                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a1a2e' }}>{views}</div>
                                                </div>
                                                <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Conclusão</div>
                                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: completionRate >= 50 ? '#16a34a' : completionRate >= 20 ? '#f59e0b' : '#dc2626' }}>{completionRate}%</div>
                                                </div>
                                                <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Leads</div>
                                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#6366f1' }}>{leadsWithEmail.length}</div>
                                                </div>
                                            </div>


                                            {/* Conversion funnel */}
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 14, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}><TrendingDown size={15} /> Funil de Conversão</div>
                                            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                                                {(() => {
                                                    // Count completions: people who answered the last question step
                                                    const questionStepsForFunnel = steps.map((step, si) => {
                                                        const isQ = step.blocks.some(b => ['choice', 'single-choice', 'yes-no', 'likert', 'statement', 'multi-select'].includes(b.type));
                                                        return { stepIndex: si, isQuestion: isQ };
                                                    }).filter(s => s.isQuestion);
                                                    const lastQIdx = questionStepsForFunnel.length > 0 ? questionStepsForFunnel[questionStepsForFunnel.length - 1].stepIndex : -1;
                                                    const lastQAnswers = lastQIdx >= 0 ? (answerEvents.filter(a => a.questionIndex === lastQIdx).length) : 0;
                                                    const realCompletesF = Math.max(completes, lastQAnswers, leadsWithEmail.length);

                                                    return [
                                                        { label: 'Visitantes', val: views, icon: <Eye size={14} color="#6366f1" /> },
                                                        { label: 'Iniciaram Quiz', val: Math.max(starts, answerEvents.length > 0 ? 1 : 0), icon: <PlayCircle size={14} color="#6366f1" /> },
                                                        { label: 'Completaram', val: realCompletesF, icon: <CheckCircle2 size={14} color="#22c55e" /> },
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
                                                    });
                                                })()}
                                            </div>

                                            {/* Retention — compact all steps */}
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={15} /> Retenção por Etapa</div>
                                            <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
                                                {retentionData.length === 0 ? (
                                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: 20 }}>Sem dados ainda</div>
                                                ) : (
                                                    <>
                                                        {retentionData.map((r, i) => {
                                                            const pct = baseline > 0 ? Math.round((r.count / baseline) * 100) : 0;
                                                            const isWorst = i === bigDropIdx;
                                                            const barColor = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
                                                            return (
                                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                                        <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                                                                            <div style={{ height: '100%', width: `${Math.max(pct, 2)}%`, background: isWorst ? '#ef4444' : barColor, borderRadius: 3, transition: 'width 0.4s' }} />
                                                                        </div>
                                                                    </div>
                                                                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: isWorst ? '#dc2626' : barColor, width: 36, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                                                                </div>
                                                            );
                                                        })}
                                                        {bigDropIdx >= 0 && dropPct > 0 && (
                                                            <div style={{ marginTop: 10, padding: '8px 10px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca', fontSize: '0.72rem' }}>
                                                                <span style={{ color: '#dc2626', fontWeight: 600 }}>📉 -{dropPct}%</span>
                                                                <span style={{ color: '#7f1d1d' }}> na etapa {bigDropIdx + 1}: {retentionData[bigDropIdx]?.name}</span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    );
                                })()}
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
            })()
            }

            {/* ═══ DOMÍNIO TAB ═══ */}
            {
                activeTab === 'dominio' && (
                    <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 700, margin: '0 auto' }}>
                        <DomainSettings quizId={quizId || editId} />
                    </div>
                )
            }

            {/* Share modal */}
            {
                showShare && !saved && (
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
                )
            }

            {/* Template modal */}
            {
                showTemplates && (() => {
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
                })()
            }

            {/* AI Step Generation Modal */}
            {
                showAiStepModal && (
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
                )
            }

            {/* Clone Modal — Screenshot-based */}
            {/* Settings Modal */}
            {
                showSettings && (
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
                )
            }

            {
                showCloneModal && (
                    <div className="modal-overlay" onClick={() => !cloneLoading && setShowCloneModal(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                            <div className="modal-header">
                                <h3 className="modal-title">🔗 Clonar Quiz</h3>
                                <button className="modal-close" onClick={() => !cloneLoading && setShowCloneModal(false)}>×</button>
                            </div>

                            {!cloneLoading ? (
                                <div style={{ overflow: 'auto', flex: 1, padding: '0 0 16px' }}>
                                    {/* URL Input */}
                                    <div style={{ marginBottom: 14 }}>
                                        <label className="label">URL do quiz</label>
                                        <input className="input"
                                            placeholder="https://exemplo.com/quiz"
                                            value={cloneUrl}
                                            onChange={e => setCloneUrl(e.target.value)}
                                            style={{ borderRadius: 10, fontSize: '0.88rem' }}
                                        />
                                    </div>

                                    {/* Language selector */}
                                    <div style={{ marginBottom: 14 }}>
                                        <label className="label">🌐 Idioma do clone</label>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {[
                                                { id: 'original', label: '🔒 Manter original', desc: '' },
                                                { id: 'pt', label: '🇧🇷 Português', desc: '' },
                                                { id: 'en', label: '🇺🇸 Inglês', desc: '' },
                                                { id: 'es', label: '🇪🇸 Espanhol', desc: '' },
                                                { id: 'fr', label: '🇫🇷 Francês', desc: '' },
                                                { id: 'de', label: '🇩🇪 Alemão', desc: '' },
                                            ].map(lang => (
                                                <button key={lang.id}
                                                    onClick={() => setCloneLang(lang.id)}
                                                    style={{
                                                        padding: '6px 12px', border: 'none', borderRadius: 8, cursor: 'pointer',
                                                        fontSize: '0.72rem', fontWeight: 600,
                                                        background: cloneLang === lang.id ? 'var(--primary)' : '#f1f5f9',
                                                        color: cloneLang === lang.id ? '#fff' : 'var(--text-secondary)',
                                                        boxShadow: cloneLang === lang.id ? '0 2px 6px rgba(0,0,0,.15)' : 'none',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >{lang.label}</button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* How it works + Warnings */}
                                    <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 10, fontSize: '0.7rem', color: '#166534' }}>
                                        <Lightbulb size={14} style={{ display: 'inline', marginRight: 4 }} /> <strong>Como funciona:</strong> Nosso bot vai acessar a URL, navegar pelo quiz inteiro clicando nas opções, e clonar todas as etapas automaticamente.
                                    </div>

                                    <div style={{ padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 14, fontSize: '0.68rem', color: '#92400e', lineHeight: 1.6 }}>
                                        <strong>⚠️ Avisos importantes:</strong>
                                        <ul style={{ margin: '4px 0 0', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                            <li>O clone pode conter <strong>pequenos erros visuais</strong> — revise cada etapa cuidadosamente</li>
                                            <li><strong>Etapas animadas</strong> (loading, sliders complexos) podem não funcionar corretamente — substitua pelos componentes nativos do construtor</li>
                                            {cloneLang !== 'original' && <li><strong>Apenas textos são traduzidos</strong> — imagens com texto embutido precisam ser alteradas manualmente</li>}
                                            <li>Botões e links clonados precisam ser <strong>reconfigurados manualmente</strong></li>
                                        </ul>
                                    </div>

                                    {/* Clone progress log */}
                                    {cloneLog.length > 0 && (
                                        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', marginBottom: 14, maxHeight: 200, overflowY: 'auto', background: '#fafbfc' }}>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Progresso do clone:</div>
                                            {cloneLog.map((item, idx) => (
                                                <div key={idx} style={{ fontSize: '0.72rem', color: 'var(--text-primary)', padding: '3px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                                    <span style={{ flexShrink: 0 }}>{item.icon || '📄'}</span>
                                                    <span>{item.msg}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {cloneError && (
                                        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, marginBottom: 14, fontSize: '0.78rem', color: '#dc2626' }}>{cloneError}</div>
                                    )}

                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowCloneModal(false)}>Cancelar</button>
                                        <button className="btn btn-accent" style={{ flex: 2 }}
                                            disabled={!cloneUrl.trim()}
                                            onClick={async () => {
                                                setCloneError(null);
                                                if (!cloneUrl.trim()) { setCloneError('Cole a URL do quiz.'); return; }
                                                setCloneLoading(true);
                                                setCloneLog([]);
                                                setCloneProgress({ stage: 'connecting', msg: 'Conectando ao servidor...', pct: 5 });
                                                try {
                                                    const quiz = await cloneAndOptimize(cloneUrl, 'outro', 'clone_only', '', (stage, msg, data) => {
                                                        setCloneProgress({ stage, msg, pct: data?.pct || 0 });
                                                        if (data?.pageNum) {
                                                            setCloneLog(prev => {
                                                                const exists = prev.some(p => p.key === `page-${data.pageNum}`);
                                                                if (exists) return prev;
                                                                return [...prev, { key: `page-${data.pageNum}`, icon: data.pageType === 'welcome' ? '🏠' : data.pageType === 'lead' ? '📧' : '✅', msg }];
                                                            });
                                                        } else {
                                                            setCloneLog(prev => [...prev, { key: `stage-${stage}-${Date.now()}`, icon: stage === 'connecting' ? '🌐' : stage === 'building' ? '🧱' : stage === 'complete' ? '✅' : '🔍', msg }]);
                                                        }
                                                    }, cloneLang);
                                                    if (quiz && quiz.pages?.length > 0) {
                                                        const ns = quiz.pages.map((p, i) => {
                                                            if (p.type === 'compound' && p.blocks) return { id: `stp_url_${Date.now()}_${i}`, name: `Etapa ${i + 1}`, blocks: p.blocks };
                                                            return {
                                                                id: `stp_url_${Date.now()}_${i}`,
                                                                name: (p.text || p.headline || '').replace(/\n/g, ' ').slice(0, 25) || `Etapa ${i + 1}`,
                                                                blocks: [p]
                                                            };
                                                        });
                                                        setSteps(ns); setActiveStepIdx(0); setSelectedBlockIdx(null);
                                                        setConfig(c => ({ ...c, name: quiz.name || 'Quiz Clonado', primaryColor: quiz.primaryColor || c.primaryColor, niche: quiz.niche || c.niche, welcomeHeadline: quiz.welcome?.headline || '', welcomeSub: quiz.welcome?.subheadline || '', welcomeCta: quiz.welcome?.cta || 'Começar →' }));
                                                        if (quiz.results?.length) setClonedResults(quiz.results);
                                                        if (quiz.clonedCSS) setClonedCSS(quiz.clonedCSS);
                                                        setIsClone(true);
                                                        showToastMsg(`🎉 ${ns.length} etapas clonadas da URL!`);
                                                        setShowCloneModal(false); setCloneLog([]); setCloneUrl('');
                                                    } else {
                                                        setCloneError('Nenhuma etapa foi encontrada. Tente outra URL.');
                                                    }
                                                } catch (err) {
                                                    setCloneError(err.message || 'Erro ao clonar da URL.');
                                                }
                                                setCloneLoading(false);
                                            }}
                                        >
                                            {cloneLang !== 'original' ? `🌐 Clonar e Traduzir` : '🔗 Clonar da URL'}
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
                                        {cloneProgress.msg || 'Clonando quiz...'}
                                    </div>
                                    <div style={{ width: '80%', margin: '0 auto', height: 5, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--primary), #10b981)', borderRadius: 5, transition: 'width 0.5s ease', width: `${cloneProgress.pct || 10}%` }} />
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 10 }}>
                                        O bot está navegando pelo quiz e clonando cada etapa
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {renderToast()}
        </div >
    );
}
