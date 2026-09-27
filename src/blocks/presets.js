// presets.js — one-click option sets, ready-made steps and full quiz templates for the v2 builder
import { createBlock } from '../utils/blockTypes';
import { newOptionId } from './logic';

// ── Option presets ──
// Each item: [emoji, text] or text. Points follow the order (1..n) so scales score naturally.
export const OPTION_PRESETS = [
    { key: 'gender', label: 'Gênero', group: 'Perfil', items: [['👩', 'Feminino'], ['👨', 'Masculino'], ['🙂', 'Prefiro não dizer']] },
    { key: 'age', label: 'Faixa etária', group: 'Perfil', items: [['🌱', '18 a 24 anos'], ['💪', '25 a 34 anos'], ['⭐', '35 a 44 anos'], ['🌟', '45 a 54 anos'], ['👑', '55 anos ou mais']] },
    { key: 'marital', label: 'Estado civil', group: 'Perfil', items: [['🙋', 'Solteiro(a)'], ['💑', 'Namorando'], ['💍', 'Casado(a)'], ['🔄', 'Divorciado(a)'], ['🕊️', 'Viúvo(a)']] },
    { key: 'income', label: 'Renda mensal', group: 'Perfil', items: [['💵', 'Até R$ 2 mil'], ['💰', 'R$ 2 mil a R$ 5 mil'], ['💎', 'R$ 5 mil a R$ 10 mil'], ['🏦', 'Acima de R$ 10 mil']] },
    { key: 'experience', label: 'Nível de experiência', group: 'Perfil', items: [['🌱', 'Iniciante'], ['🌿', 'Intermediário'], ['🌳', 'Avançado']] },
    { key: 'yesno', label: 'Sim / Não', group: 'Respostas', items: [['✅', 'Sim'], ['❌', 'Não']] },
    { key: 'yesnomaybe', label: 'Sim / Não / Talvez', group: 'Respostas', items: [['✅', 'Sim'], ['🤔', 'Talvez'], ['❌', 'Não']] },
    { key: 'agree', label: 'Concordância (5 níveis)', group: 'Escalas', items: ['Discordo totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo totalmente'] },
    { key: 'frequency', label: 'Frequência', group: 'Escalas', items: [['🚫', 'Nunca'], ['🌙', 'Raramente'], ['🔁', 'Às vezes'], ['📅', 'Frequentemente'], ['🔥', 'Sempre']] },
    { key: 'satisfaction', label: 'Satisfação (emojis)', group: 'Escalas', items: [['😡', 'Muito insatisfeito'], ['😕', 'Insatisfeito'], ['😐', 'Neutro'], ['🙂', 'Satisfeito'], ['😍', 'Muito satisfeito']] },
    { key: 'intensity', label: 'Intensidade', group: 'Escalas', items: [['🟢', 'Nada'], ['🟡', 'Pouco'], ['🟠', 'Moderado'], ['🔴', 'Muito']] },
    { key: 'activity', label: 'Nível de atividade', group: 'Saúde e fitness', items: [['🛋️', 'Sedentário'], ['🚶', 'Levemente ativo'], ['🏃', 'Moderadamente ativo'], ['🏋️', 'Muito ativo']] },
    { key: 'fitgoal', label: 'Objetivo (fitness)', group: 'Saúde e fitness', items: [['🔥', 'Perder peso'], ['💪', 'Ganhar massa muscular'], ['✨', 'Definir o corpo'], ['⚡', 'Ter mais energia'], ['❤️', 'Melhorar a saúde']] },
    { key: 'sleep', label: 'Horas de sono', group: 'Saúde e fitness', items: [['😵', 'Menos de 5h'], ['🥱', '5 a 6h'], ['😴', '7 a 8h'], ['🛌', 'Mais de 8h']] },
    { key: 'water', label: 'Consumo de água', group: 'Saúde e fitness', items: [['🥤', 'Menos de 1 litro'], ['💧', '1 a 2 litros'], ['🌊', 'Mais de 2 litros']] },
    { key: 'days', label: 'Dias por semana', group: 'Saúde e fitness', items: [['1️⃣', '1 a 2 dias'], ['3️⃣', '3 a 4 dias'], ['5️⃣', '5 dias ou mais']] },
    { key: 'skin', label: 'Tipo de pele', group: 'Beleza', items: [['💧', 'Oleosa'], ['🏜️', 'Seca'], ['🌗', 'Mista'], ['🌸', 'Normal'], ['🌡️', 'Sensível']] },
    { key: 'hair', label: 'Tipo de cabelo', group: 'Beleza', items: [['〰️', 'Liso'], ['🌊', 'Ondulado'], ['🌀', 'Cacheado'], ['➰', 'Crespo']] },
    { key: 'time', label: 'Tempo disponível por dia', group: 'Rotina', items: [['⏱️', 'Menos de 15 min'], ['⏰', '15 a 30 min'], ['🕐', '30 a 60 min'], ['🕒', 'Mais de 1 hora']] },
    { key: 'urgency', label: 'Quando quer começar', group: 'Compra', items: [['🚀', 'Hoje mesmo'], ['📆', 'Nas próximas semanas'], ['🗓️', 'Nos próximos meses'], ['👀', 'Só estou pesquisando']] },
    { key: 'budget', label: 'Investimento', group: 'Compra', items: [['🪙', 'Até R$ 50'], ['💵', 'R$ 50 a R$ 150'], ['💰', 'R$ 150 a R$ 500'], ['💎', 'Acima de R$ 500']] },
    { key: 'pain', label: 'Maior dificuldade', group: 'Compra', items: [['⌛', 'Falta de tempo'], ['😮‍💨', 'Falta de motivação'], ['🧭', 'Não sei por onde começar'], ['🔁', 'Já tentei e não funcionou']] },
    { key: 'channel', label: 'Como nos conheceu', group: 'Compra', items: [['📸', 'Instagram'], ['🎵', 'TikTok'], ['▶️', 'YouTube'], ['🔎', 'Google'], ['🗣️', 'Indicação']] },
];

export function presetOptions(preset) {
    return preset.items.map((it, i) => {
        const [emoji, text] = Array.isArray(it) ? it : ['', it];
        return { id: newOptionId(), text, emoji, points: i + 1 };
    });
}

// ── Helpers to build steps ──
function blk(type, props = {}) {
    const b = createBlock(type);
    const merged = { ...b, ...props };
    if (props.options) merged.options = props.options.map(o => ({ id: newOptionId(), ...o }));
    return merged;
}
const opts = (key) => presetOptions(OPTION_PRESETS.find(p => p.key === key));
const step = (name, blocks, extra = {}) => ({ id: `stp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name, blocks, ...extra });

// ── Ready-made steps ──
export const STEP_TEMPLATES = [
    // Início
    { key: 'cover', cat: 'Início', icon: '🏠', name: 'Capa', desc: 'Título, subtítulo e botão', build: () => step('Capa', [blk('welcome', { emoji: '✨', headline: 'Descubra em 1 minuto o plano ideal para você', subtitle: 'Responda algumas perguntas rápidas e receba um resultado personalizado.', cta: 'Começar agora →' })], { hideProgress: true }) },
    { key: 'cover-proof', cat: 'Início', icon: '🚀', name: 'Capa com prova social', desc: 'Capa + contador de pessoas', build: () => step('Capa', [blk('welcome', { emoji: '🔥', headline: 'Qual é o seu perfil?', subtitle: 'Faça o teste gratuito e descubra o caminho mais rápido para o seu objetivo.', cta: 'Fazer o teste →' }), blk('social-proof', { headline: '+12.000', subheadline: 'pessoas já fizeram este teste', emoji: '👥' })], { hideProgress: true }) },

    // Perguntas
    { key: 'gender', cat: 'Perguntas', icon: '👤', name: 'Gênero', desc: 'Feminino, masculino…', build: () => step('Gênero', [blk('choice', { text: 'Qual é o seu gênero?', desc: '', optionLayout: 'grid', options: opts('gender') })]) },
    { key: 'age', cat: 'Perguntas', icon: '🎂', name: 'Idade', desc: 'Faixa etária', build: () => step('Idade', [blk('choice', { text: 'Qual é a sua idade?', desc: '', optionLayout: 'list', options: opts('age') })]) },
    { key: 'goal', cat: 'Perguntas', icon: '🎯', name: 'Objetivo', desc: 'Meta principal', build: () => step('Objetivo', [blk('choice', { text: 'Qual é o seu principal objetivo?', desc: '', optionLayout: 'list', options: opts('fitgoal') })]) },
    { key: 'pain', cat: 'Perguntas', icon: '🧩', name: 'Maiores dificuldades', desc: 'Múltipla escolha', build: () => step('Dificuldades', [blk('choice', { text: 'O que mais te atrapalha hoje?', desc: 'Pode marcar mais de uma', multiSelect: true, autoAdvance: false, optionLayout: 'list', options: opts('pain') })]) },
    { key: 'frequency', cat: 'Perguntas', icon: '🔁', name: 'Frequência', desc: 'Nunca → sempre', build: () => step('Frequência', [blk('choice', { text: 'Com que frequência isso acontece com você?', desc: '', optionLayout: 'list', options: opts('frequency') })]) },
    { key: 'agree', cat: 'Perguntas', icon: '💬', name: 'Afirmação', desc: 'Concorda ou discorda', build: () => step('Afirmação', [blk('text', { variant: 'subheadline', align: 'center', content: '“Sinto que já tentei de tudo e nada funciona.”' }), blk('choice', { text: 'Você se identifica com essa frase?', desc: '', optionLayout: 'list', options: opts('agree') })]) },
    { key: 'yesno', cat: 'Perguntas', icon: '👍', name: 'Sim ou não', desc: 'Pergunta binária', build: () => step('Sim ou não', [blk('yes-no', { text: 'Você já tentou resolver isso antes?' })]) },
    { key: 'rating', cat: 'Perguntas', icon: '⭐', name: 'Avaliação', desc: 'Estrelas 1–5', build: () => step('Avaliação', [blk('rating', {})]) },
    { key: 'nps', cat: 'Perguntas', icon: '📊', name: 'NPS', desc: 'Nota 0–10', build: () => step('NPS', [blk('nps', {})]) },
    { key: 'height', cat: 'Perguntas', icon: '📏', name: 'Altura', desc: 'Régua em cm', build: () => step('Altura', [blk('scroll-picker', {})]) },
    { key: 'weight', cat: 'Perguntas', icon: '⚖️', name: 'Peso', desc: 'Régua em kg', build: () => step('Peso', [blk('weight-picker', {})]) },
    { key: 'activity', cat: 'Perguntas', icon: '🏃', name: 'Nível de atividade', desc: 'Sedentário → muito ativo', build: () => step('Atividade', [blk('choice', { text: 'Qual é o seu nível de atividade física?', desc: '', optionLayout: 'list', options: opts('activity') })]) },

    // Captura
    { key: 'name', cat: 'Captura', icon: '✍️', name: 'Nome', desc: 'Pergunta o nome e personaliza', build: () => step('Nome', [blk('text-input', { text: 'Como podemos te chamar?', placeholder: 'Seu primeiro nome', varName: 'nome' })]) },
    { key: 'lead', cat: 'Captura', icon: '📩', name: 'E-mail e WhatsApp', desc: 'Formulário de lead', build: () => step('Cadastro', [blk('capture', { title: '{{primeiro_nome}}, seu resultado está pronto! 🎉', subtitle: 'Informe seus dados para receber o resultado completo.', fields: ['name', 'email', 'phone'], buttonText: 'Ver meu resultado →' })]) },

    // Engajamento
    { key: 'insight', cat: 'Engajamento', icon: '💡', name: 'Você sabia?', desc: 'Dica educativa', build: () => step('Você sabia?', [blk('insight', { title: 'Você sabia?', body: '8 em cada 10 pessoas que seguem um plano personalizado atingem o objetivo em menos de 90 dias.' })]) },
    { key: 'testimonials', cat: 'Engajamento', icon: '❝', name: 'Depoimentos', desc: '2 depoimentos + prova social', build: () => step('Depoimentos', [blk('text', { variant: 'subheadline', align: 'center', content: 'Quem já fez, aprovou 💬' }), blk('testimonial', { name: 'Maria S.', text: 'Em 3 semanas já senti diferença. Queria ter começado antes!', rating: 5 }), blk('testimonial', { name: 'Carlos R.', text: 'Simples de seguir e funciona de verdade.', rating: 5 }), blk('social-proof', { headline: '4,9 ★', subheadline: 'nota média de 2.300 avaliações', emoji: '⭐' })]) },
    { key: 'before-after', cat: 'Engajamento', icon: '⟷', name: 'Antes e depois', desc: 'Comparação visual', build: () => step('Antes e depois', [blk('before-after', {})]) },

    // Conversão
    { key: 'analyzing', cat: 'Conversão', icon: '⏳', name: 'Analisando respostas', desc: 'Barra 0→100% e avança', build: () => step('Analisando', [blk('progress-bar', {})], { hideProgress: true }) },
    { key: 'outcome', cat: 'Conversão', icon: '🏆', name: 'Resultado por pontos', desc: 'Perfil conforme a pontuação', build: () => step('Resultado', [blk('outcome', {})], { hideProgress: true, confetti: true }) },
    { key: 'ai-result', cat: 'Conversão', icon: '🤖', name: 'Diagnóstico com IA', desc: 'Texto gerado pelas respostas', build: () => step('Diagnóstico', [blk('result', {})], { hideProgress: true }) },
    { key: 'bmi', cat: 'Conversão', icon: '📊', name: 'Resultado de IMC', desc: 'Usa altura e peso', build: () => step('IMC', [blk('bmi', {})], { hideProgress: true }) },
    {
        key: 'offer', cat: 'Conversão', icon: '💰', name: 'Página de oferta', desc: 'Timer, preço, depoimento e FAQ', build: () => step('Oferta', [
            blk('alert', { alertType: 'danger', title: '🔥 Oferta liberada para você', text: 'Condição especial válida só nesta página.' }),
            blk('timer', { duration: 600, title: 'Sua oferta expira em:', autoAdvance: false }),
            blk('price', {}),
            blk('testimonial', { name: 'Ana P.', text: 'Melhor investimento que fiz este ano.', rating: 5 }),
            blk('faq', { title: 'Dúvidas frequentes', items: [{ q: 'Como recebo o acesso?', a: 'Na hora, no seu e-mail.' }, { q: 'Tem garantia?', a: 'Sim, 7 dias incondicional.' }] }),
        ], { hideProgress: true }),
    },
];

export const STEP_TEMPLATE_CATEGORIES = ['Início', 'Perguntas', 'Captura', 'Engajamento', 'Conversão'];

export function buildStepTemplate(key) {
    const t = STEP_TEMPLATES.find(x => x.key === key);
    return t ? t.build() : null;
}

// ── Full quiz templates ──
const tpl = (...keys) => () => keys.map(k => buildStepTemplate(k));

export const QUIZ_TEMPLATES = [
    {
        id: 'tpl_emagrecimento', name: 'Emagrecimento', emoji: '🔥', color: '#ea580c', desc: 'Funil completo com IMC, análise e oferta',
        design: { primaryColor: '#ea580c', bgColor: '#fffaf5' },
        steps: tpl('cover-proof', 'gender', 'age', 'goal', 'height', 'weight', 'activity', 'pain', 'insight', 'name', 'analyzing', 'bmi', 'offer'),
    },
    {
        id: 'tpl_skincare', name: 'Skincare', emoji: '🌸', color: '#db2777', desc: 'Descobre o tipo de pele e recomenda a rotina',
        design: { primaryColor: '#db2777', bgColor: '#fff7fb' },
        steps: () => [
            buildStepTemplate('cover'),
            step('Tipo de pele', [blk('choice', { text: 'Como é a sua pele?', desc: '', optionLayout: 'grid', options: opts('skin') })]),
            buildStepTemplate('age'),
            step('Rotina', [blk('choice', { text: 'Você tem uma rotina de cuidados?', desc: '', optionLayout: 'list', options: opts('frequency') })]),
            buildStepTemplate('pain'),
            buildStepTemplate('testimonials'),
            buildStepTemplate('lead'),
            buildStepTemplate('analyzing'),
            buildStepTemplate('outcome'),
        ],
    },
    {
        id: 'tpl_leads', name: 'Captação de leads', emoji: '📩', color: '#2563eb', desc: 'Qualifica e captura contato em 6 etapas',
        design: { primaryColor: '#2563eb', bgColor: '#ffffff' },
        steps: () => [
            buildStepTemplate('cover'),
            step('Perfil', [blk('choice', { text: 'Qual destas opções melhor te descreve?', desc: '', optionLayout: 'list', options: opts('experience') })]),
            step('Momento', [blk('choice', { text: 'Quando você pretende começar?', desc: '', optionLayout: 'list', options: opts('urgency') })]),
            step('Investimento', [blk('choice', { text: 'Quanto pretende investir?', desc: '', optionLayout: 'list', options: opts('budget') })]),
            buildStepTemplate('name'),
            buildStepTemplate('lead'),
            buildStepTemplate('outcome'),
        ],
    },
    {
        id: 'tpl_satisfacao', name: 'Pesquisa de satisfação', emoji: '⭐', color: '#0ea5e9', desc: 'NPS, avaliação e comentário',
        design: { primaryColor: '#0ea5e9', bgColor: '#f7fbff' },
        steps: () => [
            step('Boas-vindas', [blk('welcome', { emoji: '💙', headline: 'Sua opinião vale muito!', subtitle: 'Leva menos de 1 minuto.', cta: 'Responder →' })], { hideProgress: true }),
            buildStepTemplate('nps'),
            buildStepTemplate('rating'),
            step('Comentário', [blk('textarea-input', { text: 'O que podemos melhorar?', placeholder: 'Conte pra gente…', required: false })]),
            step('Obrigado', [blk('text', { variant: 'headline', align: 'center', content: 'Obrigado, {{primeiro_nome}}! 💙' }), blk('text', { align: 'center', content: 'Sua resposta foi registrada.' })], { hideProgress: true, confetti: true, continueButton: 'never' }),
        ],
    },
];
