// blockTypes.js — Enhanced block types with rich options

export const BLOCK_TYPES = [
    // ── Interactive ──
    { type: 'choice', label: 'Opções', icon: '📝', color: '#6c63ff', category: 'interactive', desc: 'Escolha única/múltipla' },
    { type: 'image-select', label: 'Opções Visual', icon: '🖼️', color: '#9b59b6', category: 'interactive', desc: 'Cards com imagem' },
    { type: 'likert', label: 'Escala', icon: '📊', color: '#e67e22', category: 'interactive', desc: 'Intensidade 1-5' },
    { type: 'statement', label: 'Afirmação', icon: '💬', color: '#3498db', category: 'interactive', desc: 'Concordo/Discordo' },
    { type: 'capture', label: 'Captura', icon: '📧', color: '#e74c3c', category: 'interactive', desc: 'Coletar nome/email' },
    { type: 'scroll-picker', label: 'Seletor', icon: '🔄', color: '#06b6d4', category: 'interactive', desc: 'Roleta numérica' },
    { type: 'number-input', label: 'Número', icon: '🔢', color: '#10b981', category: 'interactive', desc: 'Campo de número' },
    // ── Content ──
    { type: 'welcome', label: 'Capa', icon: '🏠', color: '#6c63ff', category: 'content', desc: 'Página inicial do quiz' },
    { type: 'text', label: 'Texto', icon: '✏️', color: '#95a5a6', category: 'content', desc: 'Bloco de texto livre' },
    { type: 'image', label: 'Imagem', icon: '🖼️', color: '#1abc9c', category: 'content', desc: 'Imagem com legenda' },
    { type: 'video', label: 'Vídeo', icon: '🎬', color: '#e74c3c', category: 'content', desc: 'Embed YouTube/Vimeo' },
    { type: 'button', label: 'Botão', icon: '🔘', color: '#2ecc71', category: 'content', desc: 'CTA ou link' },
    // ── Engagement ──
    { type: 'insight', label: 'Insight', icon: '💡', color: '#f1c40f', category: 'engagement', desc: 'Dica educativa' },
    { type: 'social-proof', label: 'Prova Social', icon: '👥', color: '#1abc9c', category: 'engagement', desc: 'Validação social' },
    { type: 'testimonial', label: 'Depoimento', icon: '⭐', color: '#f39c12', category: 'engagement', desc: 'Avaliação de cliente' },
    { type: 'arguments', label: 'Argumentos', icon: '📋', color: '#8e44ad', category: 'engagement', desc: 'Lista de benefícios' },
    { type: 'alert', label: 'Alerta', icon: '⚠️', color: '#e74c3c', category: 'engagement', desc: 'Urgência / aviso' },
    { type: 'bmi', label: 'IMC', icon: '📊', color: '#8b5cf6', category: 'engagement', desc: 'Cálculo de IMC automático' },
    // ── Advanced ──
    { type: 'timer', label: 'Timer', icon: '⏱️', color: '#c0392b', category: 'advanced', desc: 'Contagem regressiva' },
    { type: 'loading', label: 'Loading', icon: '⏳', color: '#7f8c8d', category: 'advanced', desc: 'Animação de carregamento' },
    { type: 'price', label: 'Preço', icon: '💰', color: '#27ae60', category: 'advanced', desc: 'Card de oferta' },
    { type: 'chart', label: 'Gráfico', icon: '📈', color: '#2980b9', category: 'advanced', desc: 'Dados visuais' },
    { type: 'result', label: 'Resultado', icon: '🏆', color: '#e67e22', category: 'advanced', desc: 'Fim + diagnóstico IA' },
];

export const CATEGORIES = [
    { key: 'interactive', label: 'Interativo' },
    { key: 'content', label: 'Conteúdo' },
    { key: 'engagement', label: 'Engajamento' },
    { key: 'advanced', label: 'Avançado' },
];

export const OPTION_LAYOUTS = [
    { key: 'list', label: 'Lista', icon: '☰' },
    { key: 'horizontal', label: 'Horizontal', icon: '⬜⬜' },
    { key: 'image-text', label: 'Img+Txt', icon: '🖼️' },
    { key: 'icon-text', label: 'Ico+Txt', icon: '😊' },
    { key: 'grid', label: 'Grade', icon: '⊞' },
];

export const CHART_TYPES = [
    { key: 'bar', label: 'Barras', icon: '📊' },
    { key: 'line', label: 'Linhas', icon: '📈' },
    { key: 'pie', label: 'Pizza', icon: '🥧' },
    { key: 'donut', label: 'Donut', icon: '🍩' },
    { key: 'radial', label: 'Radial', icon: '🎯' },
];

export const ALERT_STYLES = [
    { key: 'banner', label: 'Banner' },
    { key: 'card', label: 'Card' },
    { key: 'floating', label: 'Flutuante' },
];

export const ALERT_TYPES = [
    { key: 'warning', label: 'Aviso', color: '#f39c12', bg: '#fef9e7', icon: '⚠️' },
    { key: 'danger', label: 'Urgente', color: '#e74c3c', bg: '#fdedec', icon: '🔥' },
    { key: 'success', label: 'Sucesso', color: '#27ae60', bg: '#eafaf1', icon: '✅' },
    { key: 'info', label: 'Info', color: '#3498db', bg: '#ebf5fb', icon: 'ℹ️' },
];

export const BUTTON_ANIMATIONS = [
    { key: 'none', label: 'Nenhuma' },
    { key: 'pulse', label: 'Pulsar' },
    { key: 'shake', label: 'Tremer' },
    { key: 'glow', label: 'Brilho' },
];

export const TIMER_FORMATS = [
    { key: 'digital', label: 'Digital' },
    { key: 'circular', label: 'Circular' },
    { key: 'progress', label: 'Barra' },
];

export const INSIGHT_STYLES = [
    { key: 'card', label: 'Card' },
    { key: 'fullscreen', label: 'Destaque' },
    { key: 'minimal', label: 'Minimal' },
];

export function createBlock(type) {
    const id = `blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const base = { id, type };
    switch (type) {
        case 'choice':
            return {
                ...base, text: 'Nova pergunta?', optionLayout: 'list', multiSelect: false, options: [
                    { text: 'Opção 1', emoji: '😊', weight: 1 }, { text: 'Opção 2', emoji: '🤔', weight: 2 }
                ]
            };
        case 'image-select':
            return {
                ...base, text: 'Qual cenário?', optionLayout: 'image-text', options: [
                    { text: 'Opção A', image: '🧘', weight: 1 }, { text: 'Opção B', image: '💼', weight: 2 }
                ]
            };
        case 'likert':
            return {
                ...base, text: 'Com que frequência?', options: [
                    { text: 'Quase nunca', value: 1, weight: 1 }, { text: 'Raramente', value: 2, weight: 2 },
                    { text: 'Às vezes', value: 3, weight: 3 }, { text: 'Frequentemente', value: 4, weight: 4 },
                    { text: 'Sempre', value: 5, weight: 5 }
                ]
            };
        case 'statement':
            return { ...base, text: 'Você concorda?', quote: 'Afirmação aqui', options: ['Discordo vivamente', 'Discordo parcialmente', 'Concordo parcialmente', 'Concordo vivamente'] };
        case 'capture':
            return { ...base, title: 'Quase lá!', subtitle: 'Preencha para ver seu resultado', fields: ['name', 'email'], buttonText: 'Ver resultado →' };
        case 'welcome':
            return { ...base, headline: '', subtitle: '', cta: 'Começar →', emoji: '', imageUrl: '', imageWidth: 100, imageHeight: 'auto', imagePosition: 'top', textAlign: 'center', bgColor: '' };
        case 'text':
            return { ...base, content: 'Seu texto aqui...', align: 'left', fontSize: 'md' };
        case 'image':
            return { ...base, imageUrl: '', caption: '', alt: 'Imagem', rounded: true };
        case 'video':
            return { ...base, videoUrl: '', caption: '' };
        case 'button':
            return { ...base, text: 'Clique aqui →', url: '', style: 'primary', size: 'lg', animation: 'none' };
        case 'insight':
            return { ...base, title: 'Você sabia?', body: 'Texto da dica educativa...', insightStyle: 'card' };
        case 'social-proof':
            return { ...base, headline: '+10.000', subheadline: 'pessoas já fizeram esse quiz', emoji: '👥' };
        case 'testimonial':
            return { ...base, name: 'Maria S.', text: 'Esse quiz mudou minha vida!', rating: 5, avatar: '' };
        case 'arguments':
            return { ...base, title: 'Por que fazer?', emoji: '✅', items: ['Benefício 1', 'Benefício 2', 'Benefício 3'] };
        case 'alert':
            return { ...base, alertType: 'warning', alertStyle: 'banner', title: '🔥 Atenção!', text: 'Vagas limitadas — apenas hoje!', emoji: '🔥', customColor: '' };
        case 'timer':
            return { ...base, duration: 300, title: 'Oferta expira em:', timerFormat: 'digital', autoAdvance: true };
        case 'loading':
            return { ...base, title: 'Analisando suas respostas...', duration: 3, loadingStyle: 'steps', items: ['Calculando perfil...', 'Gerando recomendações...', 'Preparando resultado...'] };
        case 'price':
            return { ...base, title: 'Oferta Especial', originalPrice: 'R$ 197', price: 'R$ 47', discount: '76% OFF', cta: 'Garantir vaga →', ctaUrl: '', priceStyle: 'highlight', features: ['Acesso vitalício', 'Suporte VIP', 'Garantia 7 dias'] };
        case 'chart':
            return {
                ...base, title: 'Resultados', chartType: 'bar', chartColor: '', data: [
                    { label: 'Item A', value: 75 }, { label: 'Item B', value: 45 }, { label: 'Item C', value: 90 }
                ]
            };
        case 'result':
            return { ...base, productName: '', salesUrl: '', cta: '🔥 Ver minha solução →', productContext: '', title: 'Seu Diagnóstico Personalizado' };
        case 'scroll-picker':
            return { ...base, text: 'Selecione um valor', unit: 'cm', min: 140, max: 210, step: 1, defaultValue: 170 };
        case 'number-input':
            return { ...base, text: 'Digite o valor', unit: 'kg', placeholder: 'Ex: 72', imageUrl: '', min: 0, max: 300 };
        case 'bmi':
            return { ...base, title: 'Seu IMC', text: 'Resultado calculado com base nas suas respostas' };
        default: return base;
    }
}
