// registry.js — component palette for the v2 builder (what shows up in the sidebar and the quick-insert menu)
import {
    ListChecks, CircleDot, Images, ThumbsUp, Star, Gauge, SlidersHorizontal, TextCursorInput, Mail, Phone, Hash, AlignLeft,
    Calendar, Ruler, Weight, ClipboardList, Heading, Type, Image, Video, Volume2, MousePointerClick, MoveVertical, Hexagon,
    House, Quote, Users, Sparkle, TrendingDown, CheckCheck, Columns2, GalleryHorizontal, CircleHelp, BadgeDollarSign, TriangleAlert, Bell, Timer,
    Loader, ChartColumn, Activity, ChartLine, TrendingUp, Calculator, Trophy, Sparkles, Code2, Lightbulb,
} from 'lucide-react';
import { createBlock } from '../utils/blockTypes';

export const PALETTE_CATEGORIES = [
    { key: 'questions', label: 'Perguntas' },
    { key: 'fields', label: 'Campos' },
    { key: 'content', label: 'Conteúdo' },
    { key: 'persuasion', label: 'Persuasão' },
    { key: 'dynamic', label: 'Dinâmicos' },
    { key: 'results', label: 'Resultado' },
    { key: 'advanced', label: 'Avançado' },
];

// key is unique per palette entry; `type` is the block type it creates; `preset` overrides the default props
export const PALETTE = [
    // Perguntas
    { key: 'choice', type: 'choice', label: 'Opções', desc: 'Cards de escolha única', icon: ListChecks, color: '#7c3aed', cat: 'questions', kw: 'pergunta escolha alternativa quiz opção' },
    { key: 'multi', type: 'choice', label: 'Múltipla escolha', desc: 'Marcar várias opções', icon: CheckCheck, color: '#7c3aed', cat: 'questions', kw: 'varias checkbox multipla selecao', preset: { multiSelect: true, autoAdvance: false, optionLayout: 'list', text: 'Quais dessas opções combinam com você?', desc: 'Selecione quantas quiser' } },
    { key: 'single-choice', type: 'single-choice', label: 'Lista com rádio', desc: 'Escolha única em lista', icon: CircleDot, color: '#7c3aed', cat: 'questions', kw: 'radio lista unica' },
    { key: 'image-select', type: 'image-select', label: 'Cards com imagem', desc: 'Opções com foto', icon: Images, color: '#7c3aed', cat: 'questions', kw: 'imagem foto galeria visual' },
    { key: 'yes-no', type: 'yes-no', label: 'Sim / Não', desc: 'Resposta binária', icon: ThumbsUp, color: '#7c3aed', cat: 'questions', kw: 'sim nao binario' },
    { key: 'rating', type: 'rating', label: 'Avaliação', desc: 'Estrelas de 1 a 5', icon: Star, color: '#f59e0b', cat: 'questions', kw: 'estrela nota avaliacao rating' },
    { key: 'nps', type: 'nps', label: 'NPS', desc: 'Nota de 0 a 10', icon: Gauge, color: '#0ea5e9', cat: 'questions', kw: 'nps nota recomendacao 0 10' },
    { key: 'slider', type: 'slider', label: 'Slider', desc: 'Valor numa escala', icon: SlidersHorizontal, color: '#8b5cf6', cat: 'questions', kw: 'slider escala range regua valor' },

    // Campos
    { key: 'text-input', type: 'text-input', label: 'Campo de texto', desc: 'Resposta curta', icon: TextCursorInput, color: '#2563eb', cat: 'fields', kw: 'nome texto input campo' },
    { key: 'email-input', type: 'email-input', label: 'E-mail', desc: 'Com validação', icon: Mail, color: '#2563eb', cat: 'fields', kw: 'email' },
    { key: 'phone-input', type: 'phone-input', label: 'WhatsApp', desc: 'Telefone com máscara', icon: Phone, color: '#16a34a', cat: 'fields', kw: 'telefone whatsapp celular', preset: { text: 'Seu WhatsApp', placeholder: '(11) 99999-9999' } },
    { key: 'capture', type: 'capture', label: 'Formulário de lead', desc: 'Nome, e-mail e WhatsApp', icon: ClipboardList, color: '#2563eb', cat: 'fields', kw: 'lead captura formulario cadastro', preset: { fields: ['name', 'email', 'phone'] } },
    { key: 'number-input', type: 'number-input', label: 'Número', desc: 'Campo numérico', icon: Hash, color: '#2563eb', cat: 'fields', kw: 'numero idade valor' },
    { key: 'textarea-input', type: 'textarea-input', label: 'Texto longo', desc: 'Resposta aberta', icon: AlignLeft, color: '#2563eb', cat: 'fields', kw: 'textarea longo aberta comentario' },
    { key: 'date-input', type: 'date-input', label: 'Data', desc: 'Seletor de data', icon: Calendar, color: '#2563eb', cat: 'fields', kw: 'data nascimento' },
    { key: 'scroll-picker', type: 'scroll-picker', label: 'Altura', desc: 'Régua de altura', icon: Ruler, color: '#06b6d4', cat: 'fields', kw: 'altura regua cm' },
    { key: 'weight-picker', type: 'weight-picker', label: 'Peso', desc: 'Régua de peso', icon: Weight, color: '#10b981', cat: 'fields', kw: 'peso kg regua' },

    // Conteúdo
    { key: 'heading', type: 'text', label: 'Título', desc: 'Texto grande', icon: Heading, color: '#475569', cat: 'content', kw: 'titulo headline', preset: { variant: 'headline', content: 'Seu título aqui', align: 'center' } },
    { key: 'text', type: 'text', label: 'Texto', desc: 'Parágrafo', icon: Type, color: '#475569', cat: 'content', kw: 'texto paragrafo', preset: { content: 'Escreva aqui. Use {{nome}} para personalizar.' } },
    { key: 'image', type: 'image', label: 'Imagem', desc: 'Foto ou banner', icon: Image, color: '#475569', cat: 'content', kw: 'imagem foto banner' },
    { key: 'video', type: 'video', label: 'Vídeo', desc: 'YouTube ou Vturb', icon: Video, color: '#475569', cat: 'content', kw: 'video youtube vturb' },
    { key: 'audio', type: 'audio', label: 'Áudio', desc: 'Mensagem de voz', icon: Volume2, color: '#475569', cat: 'content', kw: 'audio voz' },
    { key: 'button', type: 'button', label: 'Botão', desc: 'Avançar ou abrir link', icon: MousePointerClick, color: '#475569', cat: 'content', kw: 'botao cta link' },
    { key: 'welcome', type: 'welcome', label: 'Capa', desc: 'Tela inicial', icon: House, color: '#475569', cat: 'content', kw: 'capa inicio welcome', preset: { headline: 'Descubra em 1 minuto o plano ideal para você', subtitle: 'Responda algumas perguntas rápidas', emoji: '✨' } },
    { key: 'logo', type: 'logo', label: 'Logo', desc: 'Sua marca', icon: Hexagon, color: '#475569', cat: 'content', kw: 'logo marca' },
    { key: 'spacer', type: 'spacer', label: 'Espaço', desc: 'Respiro vertical', icon: MoveVertical, color: '#94a3b8', cat: 'content', kw: 'espaco margem' },

    // Persuasão
    { key: 'testimonial', type: 'testimonial', label: 'Depoimento', desc: 'Avaliação de cliente', icon: Quote, color: '#f59e0b', cat: 'persuasion', kw: 'depoimento review' },
    { key: 'social-proof', type: 'social-proof', label: 'Prova social', desc: '+10.000 pessoas', icon: Users, color: '#14b8a6', cat: 'persuasion', kw: 'prova social numero' },
    { key: 'arguments', type: 'arguments', label: 'Benefícios', desc: 'Lista com checks', icon: CheckCheck, color: '#16a34a', cat: 'persuasion', kw: 'beneficios argumentos lista' },
    { key: 'before-after', type: 'before-after', label: 'Antes e depois', desc: 'Comparação', icon: Columns2, color: '#ec4899', cat: 'persuasion', kw: 'antes depois comparacao' },
    { key: 'carousel', type: 'carousel', label: 'Carrossel', desc: 'Slides', icon: GalleryHorizontal, color: '#6366f1', cat: 'persuasion', kw: 'carrossel slides' },
    { key: 'faq', type: 'faq', label: 'FAQ', desc: 'Perguntas frequentes', icon: CircleHelp, color: '#6366f1', cat: 'persuasion', kw: 'faq duvidas perguntas' },
    { key: 'price', type: 'price', label: 'Oferta', desc: 'Card de preço', icon: BadgeDollarSign, color: '#16a34a', cat: 'persuasion', kw: 'preco oferta checkout' },
    { key: 'alert', type: 'alert', label: 'Alerta', desc: 'Aviso / urgência', icon: TriangleAlert, color: '#ef4444', cat: 'persuasion', kw: 'alerta aviso urgencia' },
    { key: 'insight', type: 'insight', label: 'Você sabia?', desc: 'Dica educativa', icon: Lightbulb, color: '#eab308', cat: 'persuasion', kw: 'insight dica educativo' },
    { key: 'notification', type: 'notification', label: 'Notificação', desc: 'Toast de atividade', icon: Bell, color: '#f59e0b', cat: 'persuasion', kw: 'notificacao toast' },

    // Dinâmicos
    { key: 'timer', type: 'timer', label: 'Timer', desc: 'Contagem regressiva', icon: Timer, color: '#ef4444', cat: 'dynamic', kw: 'timer contagem urgencia', preset: { autoAdvance: false } },
    { key: 'loading', type: 'loading', label: 'Carregando', desc: 'Checklist animado', icon: Loader, color: '#64748b', cat: 'dynamic', kw: 'loading analisando' },
    { key: 'progress-bar', type: 'progress-bar', label: 'Barra de análise', desc: '0 → 100% animado', icon: Activity, color: '#10b981', cat: 'dynamic', kw: 'progresso barra analise' },
    { key: 'level', type: 'level', label: 'Nível', desc: 'Barra de nível', icon: TrendingUp, color: '#f59e0b', cat: 'dynamic', kw: 'nivel barra' },
    { key: 'chart', type: 'chart', label: 'Gráfico', desc: 'Linhas, barras, pizza', icon: ChartColumn, color: '#2563eb', cat: 'dynamic', kw: 'grafico chart' },
    { key: 'risk-chart', type: 'risk-chart', label: 'Curva de risco', desc: 'Gráfico animado', icon: ChartLine, color: '#ef4444', cat: 'dynamic', kw: 'risco curva grafico' },
    { key: 'bmi', type: 'bmi', label: 'IMC', desc: 'Calcula pelo peso/altura', icon: Calculator, color: '#2563eb', cat: 'dynamic', kw: 'imc bmi calculo' },
    { key: 'projection', type: 'projection', label: 'Projeção', desc: 'Atual → meta com data', icon: TrendingDown, color: '#10b981', cat: 'dynamic', kw: 'projecao grafico meta peso data evolucao' },
    { key: 'lottie', type: 'lottie', label: 'Animação Lottie', desc: 'Arquivo .json animado', icon: Sparkle, color: '#8b5cf6', cat: 'content', kw: 'lottie animacao json' },
    { key: 'metrics', type: 'metrics', label: 'Métricas', desc: 'TMB, peso ideal…', icon: Gauge, color: '#2563eb', cat: 'dynamic', kw: 'metricas tmb' },

    // Resultado
    { key: 'outcome', type: 'outcome', label: 'Resultado por pontos', desc: 'Muda conforme as respostas', icon: Trophy, color: '#ea580c', cat: 'results', kw: 'resultado pontos pontuacao perfil' },
    { key: 'result', type: 'result', label: 'Diagnóstico com IA', desc: 'Texto gerado pelas respostas', icon: Sparkles, color: '#ea580c', cat: 'results', kw: 'resultado ia diagnostico' },

    // Avançado
    { key: 'html-script', type: 'html-script', label: 'HTML / Script', desc: 'Código customizado', icon: Code2, color: '#64748b', cat: 'advanced', kw: 'html script codigo pixel' },
];

export function paletteByType(type, block) {
    if (type === 'text' && block?.variant === 'headline') return PALETTE.find(p => p.key === 'heading');
    if (type === 'choice' && block?.multiSelect) return PALETTE.find(p => p.key === 'multi');
    return PALETTE.find(p => p.type === type) || { label: type, icon: Type, color: '#64748b' };
}

export function createFromPalette(entry) {
    const block = createBlock(entry.type);
    return entry.preset ? { ...block, ...JSON.parse(JSON.stringify(entry.preset)) } : block;
}

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchPalette(query) {
    const q = norm(query).trim();
    if (!q) return PALETTE;
    return PALETTE.filter(p => norm(`${p.label} ${p.desc} ${p.kw}`).includes(q));
}
