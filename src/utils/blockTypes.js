// blockTypes.js — Inlead-style categories & components

export const BLOCK_TYPES = [
    // ── Formulário ──
    { type: 'capture', label: 'Campo', icon: 'AB', color: '#6366f1', category: 'form', desc: 'Campo de texto genérico' },
    { type: 'email-input', label: 'E-mail', icon: '@', color: '#6366f1', category: 'form', desc: 'Campo de e-mail' },
    { type: 'phone-input', label: 'Telefone', icon: '📞', color: '#6366f1', category: 'form', desc: 'Campo de telefone' },
    { type: 'button', label: 'Botão', icon: '▢', color: '#6366f1', category: 'form', desc: 'CTA ou link' },
    { type: 'number-input', label: 'Número', icon: '12', color: '#6366f1', category: 'form', desc: 'Campo numérico' },
    { type: 'textarea-input', label: 'Textarea', icon: '¶', color: '#6366f1', category: 'form', desc: 'Texto longo' },
    { type: 'date-input', label: 'Data', icon: '📅', color: '#6366f1', category: 'form', desc: 'Seletor de data' },
    { type: 'scroll-picker', label: 'Altura', icon: '📏', color: '#06b6d4', category: 'form', desc: 'Régua de altura' },
    { type: 'weight-picker', label: 'Peso', icon: '⚖️', color: '#10b981', category: 'form', desc: 'Régua de peso' },

    // ── Quiz ──
    { type: 'choice', label: 'Opções', icon: '☰', color: '#8b5cf6', category: 'quiz', desc: 'Escolha com opções' },
    { type: 'image-select', label: 'Múltipla Escolha', icon: '☷', color: '#8b5cf6', category: 'quiz', desc: 'Marcar várias opções' },
    { type: 'single-choice', label: 'Escolha Única', icon: '◉', color: '#8b5cf6', category: 'quiz', desc: 'Selecionar apenas uma' },
    { type: 'yes-no', label: 'Sim/Não', icon: '✓✗', color: '#8b5cf6', category: 'quiz', desc: 'Resposta binária' },
    { type: 'video-response', label: 'Video Resposta', icon: '🎥', color: '#8b5cf6', category: 'quiz', desc: 'Vídeo com alternativas' },

    // ── Mídia e conteúdo ──
    { type: 'text', label: 'Texto', icon: 'T', color: '#64748b', category: 'media', desc: 'Bloco de texto' },
    { type: 'image', label: 'Imagem', icon: '🖼️', color: '#64748b', category: 'media', desc: 'Upload de imagem' },
    { type: 'video', label: 'Vídeo', icon: '▶', color: '#64748b', category: 'media', desc: 'Embed vídeo' },
    { type: 'audio', label: 'Áudio', icon: '🔊', color: '#64748b', category: 'media', desc: 'Player de áudio' },

    // ── Atenção ──
    { type: 'alert', label: 'Alerta', icon: '⚠', color: '#ef4444', category: 'attention', desc: 'Aviso / urgência' },
    { type: 'notification', label: 'Notificação', icon: '🔔', color: '#f59e0b', category: 'attention', desc: 'Toast notification' },
    { type: 'timer', label: 'Timer', icon: '⏱', color: '#ef4444', category: 'attention', desc: 'Contagem regressiva' },
    { type: 'loading', label: 'Loading', icon: '◐', color: '#6b7280', category: 'attention', desc: 'Animação de loading' },
    { type: 'level', label: 'Nível', icon: '≡', color: '#6b7280', category: 'attention', desc: 'Barra de nível' },

    // ── Argumentação ──
    { type: 'arguments', label: 'Argumentos', icon: '☐', color: '#8b5cf6', category: 'argumentation', desc: 'Lista de benefícios' },
    { type: 'testimonial', label: 'Depoimentos', icon: '❝', color: '#f59e0b', category: 'argumentation', desc: 'Avaliação de cliente' },
    { type: 'faq', label: 'FAQ', icon: '≡', color: '#6366f1', category: 'argumentation', desc: 'Perguntas frequentes' },
    { type: 'price', label: 'Preço', icon: '$', color: '#16a34a', category: 'argumentation', desc: 'Card de oferta' },
    { type: 'before-after', label: 'Antes/Depois', icon: '⟷', color: '#ec4899', category: 'argumentation', desc: 'Comparação visual' },
    { type: 'carousel', label: 'Carrossel', icon: '▤', color: '#6366f1', category: 'argumentation', desc: 'Slides rotativos' },

    // ── Gráficos ──
    { type: 'bmi', label: 'IMC', icon: '📊', color: '#2563eb', category: 'charts', desc: 'Índice de massa corporal' },
    { type: 'metrics', label: 'Métricas', icon: '📐', color: '#2563eb', category: 'charts', desc: 'TMB, GEB, Peso Ideal...' },
    { type: 'chart', label: 'Gráficos', icon: '📈', color: '#2563eb', category: 'charts', desc: 'Dados visuais' },

    // ── Personalização ──
    { type: 'logo', label: 'Logo', icon: '◎', color: '#6366f1', category: 'customization', desc: 'Logo centralizado (topo ou rodapé)' },
    { type: 'spacer', label: 'Espaço', icon: '↕', color: '#94a3b8', category: 'customization', desc: 'Espaçamento vertical' },
    { type: 'html-script', label: 'HTML/Script', icon: '</>', color: '#94a3b8', category: 'customization', desc: 'Código customizado' },

    // ── Resultado ──
    { type: 'result', label: 'Resultado', icon: '🏆', color: '#e67e22', category: 'argumentation', desc: 'Fim + diagnóstico IA' },
    { type: 'welcome', label: 'Capa', icon: '🏠', color: '#6c63ff', category: 'argumentation', desc: 'Página inicial' },
    { type: 'insight', label: 'Insight', icon: '💡', color: '#f1c40f', category: 'argumentation', desc: 'Dica educativa' },
    { type: 'social-proof', label: 'Prova Social', icon: '👥', color: '#1abc9c', category: 'argumentation', desc: 'Validação social' },

    // ── Hidden (still work but not in palette) ──
    { type: 'likert', label: 'Escala', icon: '📊', color: '#e67e22', category: 'hidden', desc: 'Intensidade 1-5' },
    { type: 'statement', label: 'Afirmação', icon: '💬', color: '#3498db', category: 'hidden', desc: 'Concordo/Discordo' },
];

export const CATEGORIES = [
    { key: 'form', label: 'Formulário' },
    { key: 'quiz', label: 'Quiz' },
    { key: 'media', label: 'Mídia e conteúdo' },
    { key: 'attention', label: 'Atenção' },
    { key: 'argumentation', label: 'Argumentação' },
    { key: 'charts', label: 'Gráficos' },
    { key: 'customization', label: 'Personalização' },
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
                ...base, text: 'Qual a questão a ser respondida?', desc: 'Digite aqui uma descrição de ajuda para introduzir o usuário à questão.',
                optionLayout: 'grid', multiSelect: false, required: true, autoAdvance: true, options: [
                    { text: 'Opção 1', emoji: '', weight: 1, points: 1, value: 'A', destination: '' },
                    { text: 'Opção 2', emoji: '', weight: 2, points: 1, value: 'B', destination: '' },
                    { text: 'Opção 3', emoji: '', weight: 3, points: 1, value: 'C', destination: '' },
                    { text: 'Opção 4', emoji: '', weight: 4, points: 1, value: 'D', destination: '' },
                ]
            };
        case 'image-select':
            return {
                ...base, text: 'Qual cenário?', desc: 'Selecione uma opção', optionLayout: 'image-text', multiSelect: true, required: true, options: [
                    { text: 'Opção A', image: '', weight: 1, points: 1, value: 'A', destination: '' },
                    { text: 'Opção B', image: '', weight: 2, points: 1, value: 'B', destination: '' }
                ]
            };
        case 'single-choice':
            return {
                ...base, text: 'Escolha uma opção:', desc: '', optionLayout: 'list', multiSelect: false, required: true, options: [
                    { text: 'Opção 1', weight: 1, points: 1, value: 'A', destination: '' },
                    { text: 'Opção 2', weight: 2, points: 1, value: 'B', destination: '' },
                ]
            };
        case 'yes-no':
            return { ...base, text: 'Qual a questão?', desc: '', yesLabel: 'Sim', noLabel: 'Não', yesEmoji: '✅', noEmoji: '🚫', required: true };
        case 'video-response':
            return {
                ...base, text: 'Assista e escolha a melhor opção:', desc: '', videoUrl: '',
                options: [
                    { text: 'Aqui você descreve a primeira opção.', value: 'A' },
                    { text: 'Depois você descreve a segunda opção.', value: 'B' },
                    { text: 'Caso precise de mais opções é só adicionar.', value: 'C' },
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
            return { ...base, title: 'Quase lá!', subtitle: 'Preencha para ver seu resultado', fields: ['name', 'email'], buttonText: 'Ver resultado →', required: false };
        case 'email-input':
            return { ...base, text: 'Seu e-mail', placeholder: 'exemplo@email.com', required: true };
        case 'phone-input':
            return { ...base, text: 'Seu telefone', placeholder: '(11) 99999-9999', required: true };
        case 'textarea-input':
            return { ...base, text: 'Conte-nos mais', placeholder: 'Digite aqui...', maxLength: 500, required: false };
        case 'date-input':
            return { ...base, text: 'Selecione a data', required: false };
        case 'welcome':
            return { ...base, headline: '', subtitle: '', cta: 'Começar →', emoji: '', imageUrl: '', imageWidth: 100, imageHeight: 'auto', imagePosition: 'top', textAlign: 'center', bgColor: '' };
        case 'text':
            return { ...base, content: 'Seu texto aqui...', align: 'left', fontSize: 'md' };
        case 'image':
            return { ...base, imageUrl: '', caption: '', alt: 'Imagem', rounded: true };
        case 'video':
            return { ...base, videoUrl: '', caption: '' };
        case 'audio':
            return { ...base, audioUrl: '', senderName: '', imageUrl: '' };
        case 'button':
            return { ...base, text: 'Continuar', url: '', style: 'primary', size: 'lg', animation: 'none' };
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
        case 'notification':
            return { ...base, title: 'Nova notificação', text: 'Alguém acabou de se inscrever!', icon: '🔔', duration: 5, position: 'top-right' };
        case 'timer':
            return { ...base, duration: 300, title: 'Oferta expira em:', timerFormat: 'digital', autoAdvance: true };
        case 'loading':
            return { ...base, title: 'Analisando suas respostas...', duration: 3, loadingStyle: 'steps', items: ['Calculando perfil...', 'Gerando recomendações...', 'Preparando resultado...'] };
        case 'level':
            return { ...base, title: 'Seu nível', value: 3, maxValue: 5, label: 'Intermediário', color: '#f59e0b' };
        case 'price':
            return { ...base, title: 'Oferta Especial', originalPrice: 'R$ 197', price: 'R$ 47', discount: '76% OFF', cta: 'Garantir vaga →', ctaUrl: '', priceStyle: 'highlight', features: ['Acesso vitalício', 'Suporte VIP', 'Garantia 7 dias'] };
        case 'faq':
            return { ...base, title: 'Perguntas Frequentes', items: [{ q: 'Pergunta 1?', a: 'Resposta 1' }, { q: 'Pergunta 2?', a: 'Resposta 2' }] };
        case 'before-after':
            return { ...base, title: 'Resultado real', beforeImage: '', afterImage: '', beforeLabel: 'Antes', afterLabel: 'Depois' };
        case 'carousel':
            return { ...base, title: '', slides: [{ image: '', text: 'Slide 1' }, { image: '', text: 'Slide 2' }] };
        case 'chart':
            return {
                ...base, title: 'Resultados', chartType: 'line', chartColor: '', showArea: true, showAxisX: true, showAxisY: true, showGridX: true, showGridY: true,
                datasets: [
                    { name: 'Você', fillType: 'gradient', colors: ['#dc2626', '#fbbf24', '#22c55e'], data: [{ label: 'Ontem', value: 10 }, { label: 'Hoje', value: 30 }, { label: 'Amanhã', value: 90 }] },
                    { name: 'Concorrente', fillType: 'solid', colors: ['#9ca3af'], data: [{ label: 'Ontem', value: 20 }, { label: 'Hoje', value: 60 }, { label: 'Amanhã', value: 80 }] },
                ],
            };
        case 'result':
            return { ...base, productName: '', salesUrl: '', cta: '🔥 Ver minha solução →', productContext: '', title: 'Seu Diagnóstico Personalizado' };
        case 'scroll-picker':
            return { ...base, text: 'Qual é a sua altura?', unit: 'cm', min: 140, max: 210, step: 1, defaultValue: 170, required: false };
        case 'weight-picker':
            return { ...base, text: 'Qual é o seu peso?', unit: 'kg', min: 30, max: 200, step: 1, defaultValue: 70, required: false };
        case 'number-input':
            return { ...base, text: 'Digite o valor', unit: 'kg', placeholder: 'Ex: 72', imageUrl: '', min: 0, max: 300 };
        case 'bmi':
            return { ...base, title: 'Seu IMC', text: 'Resultado calculado com base nas suas respostas' };
        case 'metrics':
            return { ...base, metricType: 'tmb', title: 'Sua Métrica', text: 'Calculado com base nas respostas' };
        case 'spacer':
            return { ...base, height: 40 };
        case 'html-script':
            return { ...base, code: '<!-- Seu código aqui -->', executeOnLoad: true };
        case 'logo':
            return { ...base, imageUrl: '', maxWidth: 120, position: 'top', alt: 'Logo' };
        default: return base;
    }
}
