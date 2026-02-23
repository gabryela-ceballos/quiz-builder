// aiService.js — 5-step OpenAI pipeline for quiz generation
// Step 1: analyzeProduct    → metadata
// Step 2: buildStructure     → structure.phases
// Step 3: generateQuestions  → questions[]
// Step 4: generateResults    → results[]
// Step 5: generateQuizImages → images (DALL-E)

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DALLE_URL = 'https://api.openai.com/v1/images/generations';
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

// ── Shared AI caller ──
async function callAI(prompt, { system = '', temperature = 0.7, maxTokens = 2000 } = {}) {
  if (!API_KEY) throw new Error('VITE_OPENAI_API_KEY não configurada no .env');

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('[callAI] Failed to parse response:', cleaned);
    throw new Error('A IA retornou um formato inválido.');
  }
}

// ════════════════════════════════════════════════════════
// STEP 1 — analyzeProduct → metadata
// ════════════════════════════════════════════════════════
export async function analyzeProduct(productName, description, niche) {
  const prompt = `Analise este produto e retorne SOMENTE um JSON válido com EXATAMENTE estes campos (nenhum a mais, nenhum a menos):

{
  "niche": "string — nicho confirmado/refinado",
  "subTheme": "string — sub-tema específico dentro do nicho",
  "tone": "string — um de: empático, motivacional, profissional, urgente, casual",
  "palette": ["#hex1", "#hex2", "#hex3"],
  "emojiStyle": "string — um de: minimal, moderate, expressive"
}

Produto: ${productName}
Descrição: ${description || 'Não fornecida'}
Nicho selecionado: ${niche}

REGRAS:
- niche: refine o nicho selecionado para algo mais específico se possível
- subTheme: identifique o sub-tema principal (ex: "yoga para dores nas costas", "finanças para freelancers")
- tone: escolha o tom que melhor converte para este público
- palette: 3 cores hex que combinam com o produto (a primeira será a cor principal)
- emojiStyle: baseie-se no público-alvo
- Tudo em português brasileiro
- Retorne SOMENTE o JSON, sem markdown`;

  return callAI(prompt, { temperature: 0.5, maxTokens: 400 });
}

// ════════════════════════════════════════════════════════
// STEP 2 — buildStructure → structure.phases
// ════════════════════════════════════════════════════════
export async function buildStructure(productName, description, metadata) {
  const system = `Você é um psicólogo comportamental especialista em quiz funnels de alta conversão.
Seu objetivo é criar um quiz que funcione como uma JORNADA PSICOLÓGICA de 4 fases, guiando a pessoa desde a curiosidade leve até estar emocionalmente pronta para agir.

PRINCÍPIOS INVIOLÁVEIS:
1. NUNCA gere perguntas genéricas (ex: "Como você se sente?", "Qual seu objetivo?"). Cada pergunta deve ser ESPECÍFICA ao nicho e ao sub-tema.
2. Cada pergunta deve ter uma INTENÇÃO ESTRATÉGICA — ela existe para aumentar a consciência do problema ou preparar emocionalmente para o CTA.
3. As opções de resposta devem ser ESPELHOS — a pessoa deve se reconhecer nas opções e pensar "isso sou eu".
4. Use linguagem do cotidiano do público, não jargão técnico.
5. VARIE os tipos de pergunta: choice para decisões simples, multi-select para mapear amplitude do problema, statement/Likert para gerar reflexão profunda.
6. Insights devem causar um "micro-insight" real — um dado ou perspectiva que a pessoa não tinha antes.`;

  const prompt = `Crie a estrutura de fases do quiz seguindo a PROGRESSÃO PSICOLÓGICA abaixo.

Produto: ${productName}
Descrição: ${description || 'Não fornecida'}
Nicho: ${metadata.niche}
Sub-tema: ${metadata.subTheme}
Tom: ${metadata.tone}
Estilo de emoji: ${metadata.emojiStyle}

═══ PROGRESSÃO PSICOLÓGICA OBRIGATÓRIA ═══

PHASE 1 — "GANCHO LEVE" (label curto, ex: "Perfil")
Objetivo: Criar conforto e rapport. Perguntas fáceis que qualquer um responde.
- 4-5 items tipo choice
- Comece com gênero/idade (perguntas zero esforço)
- Termine com 1-2 perguntas situacionais que já TANGENCIAM a dor sem aprofundar (ex: "Como está sua rotina de [tema] hoje?")
- As opções devem ser leves mas estrategicamente ordenadas para que a maioria das pessoas escolha opções que indicam o problema

PHASE 2 — "INTENSIFICAÇÃO DA DOR" (label curto, ex: "Desafios")
Objetivo: Fazer a pessoa SENTIR e NOMEAR seus problemas. Cada pergunta aprofunda.
- 4-5 items: pelo menos 1 multi-select + 1 statement + choices
- Perguntas multi-select para mapear AMPLITUDE dos problemas ("Quais desses você sente?") — com opções hiperspecíficas ao nicho
- Statements/Likert com declarações provocativas que geram auto-reflexão ("Eu já tentei resolver isso sozinho(a) e não consegui")
- Ordene do menos intenso ao mais intenso emocionalmente
- Termine com 1 social-proof ("X pessoas descobriram que...") para validar e normalizar o problema

PHASE 3 — "DIAGNÓSTICO" (label curto, ex: "Análise")
Objetivo: A pessoa percebe que o problema é maior do que imaginava.
- 4-5 items: pelo menos 2 statements + choices
- Perguntas que CONECTAM sintomas a causas raiz ("Você percebe que [sintoma] pode estar ligado a [causa]?")
- Statements que fazem a pessoa concordar com a gravidade ("Sinto que isso impacta minha [área da vida] mais do que eu gostaria")
- Perguntas cruzadas — referenciando respostas anteriores conceptualmente
- Termine com 1 insight poderoso: um dado estatístico ou perspectiva que recontextualiza o problema

PHASE 4 — "PREPARAÇÃO PARA TRANSFORMAÇÃO" (label curto, ex: "Caminho")
Objetivo: Gerar esperança e urgência ao mesmo tempo. Preparar emocionalmente para o CTA.
- 4-5 items: pelo menos 1 multi-select + 1 statement + choices
- Perguntas sobre ASPIRAÇÕES específicas ao nicho (não genéricas como "o que você quer")
- Statements de comprometimento ("Estou disposto(a) a investir em mim")
- 1 pergunta de timeline ("Quando gostaria de ver resultados?") para criar urgência
- Termine com 1 insight que apresenta o "caminho" — conecta o problema já diagnosticado à solução

═══ ESTRUTURA JSON EXATA ═══

Retorne SOMENTE um JSON válido:
{
  "phases": [
    {
      "label": "Nome curto",
      "items": [
        {"type":"choice","text":"Pergunta?","options":[{"text":"Opção","emoji":"😊","weight":1}]},
        {"type":"multi-select","text":"Pergunta?","options":[{"text":"Opção","emoji":"😊","weight":2}]},
        {"type":"statement","text":"Afirmação?","quote":"Declaração.","options":["Discordo vivamente","Discordo parcialmente","Concordo parcialmente","Concordo vivamente"]},
        {"type":"likert","text":"Frequência?","options":[{"text":"Quase nunca","value":1,"weight":1},{"text":"Raramente","value":2,"weight":2},{"text":"Às vezes","value":3,"weight":3},{"text":"Frequentemente","value":4,"weight":4},{"text":"Sempre","value":5,"weight":5}]},
        {"type":"image-select","text":"Cenário?","options":[{"text":"Desc","image":"🧘","weight":2},{"text":"Desc","image":"💼","weight":3}]},
        {"type":"insight","title":"Título forte","body":"Texto educativo com bullet points e dado estatístico."},
        {"type":"social-proof","headline":"Número","subheadline":"Contexto"}
      ]
    }
  ]
}

DISTRIBUIÇÃO DE TIPOS (excluindo insight/social-proof):
- ~40% choice, ~20% multi-select, ~20% likert, ~20% image-select
- NUNCA todas do mesmo tipo

REGRAS POR TIPO:
- choice/multi-select: {text, emoji, weight}
- statement: quote + ["Discordo vivamente","Discordo parcialmente","Concordo parcialmente","Concordo vivamente"]
- likert: 5 opções com value 1-5 e weight 1-5
- image-select: 3-4 opções com {text, image (emoji do nicho), weight}
- insight body: escreva um texto rica com bullets (•), dados estatísticos e reforço emocional. Separe blocos com dois enters.

REGRAS TÉCNICAS:
- Exatamente 4 phases
- Tudo em português brasileiro
- NENHUM campo extra
- Cada pergunta específica ao sub-tema "${metadata.subTheme}"`;

  return callAI(prompt, { system, temperature: 0.75, maxTokens: 4500 });
}

// ════════════════════════════════════════════════════════
// STEP 3 — generateQuestions → questions[]
// ════════════════════════════════════════════════════════
export async function generateQuestions(phases) {
  const system = `Extraia SOMENTE as perguntas respondíveis (choice, multi-select, statement, likert, image-select) das fases fornecidas, na mesma ordem em que aparecem. Ignore items do tipo insight e social-proof.`;

  // Build a compact list of phases for the AI
  const phaseSummary = phases.map((p, i) => {
    const questionItems = p.items.filter(it => ['choice', 'multi-select', 'statement', 'likert', 'image-select'].includes(it.type));
    return `Phase ${i + 1} "${p.label}": ${questionItems.length} perguntas`;
  }).join('\n');

  const prompt = `Fases do quiz:
${phaseSummary}

Items completos:
${JSON.stringify(phases, null, 0)}

Retorne SOMENTE um JSON válido:
{
  "questions": [
    {"type":"choice","text":"...","options":[{"text":"...","emoji":"...","weight":1}]},
    {"type":"multi-select","text":"...","options":[{"text":"...","emoji":"...","weight":1}]},
    {"type":"statement","text":"...","quote":"...","options":["Discordo vivamente","Discordo parcialmente","Concordo parcialmente","Concordo vivamente"]},
    {"type":"likert","text":"...","options":[{"text":"...","value":1,"weight":1}]},
    {"type":"image-select","text":"...","options":[{"text":"...","image":"emoji","weight":1}]}
  ]
}

REGRAS:
- Inclua SOMENTE items tipo choice, multi-select, statement, likert, image-select
- Mantenha a MESMA ORDEM das phases
- Não modifique o texto das perguntas
- Mínimo 1 pergunta
- Sem campos extras`;

  return callAI(prompt, { system, temperature: 0.2, maxTokens: 2500 });
}

// ════════════════════════════════════════════════════════
// STEP 4 — generateResults → results[] (conversion-focused)
// ════════════════════════════════════════════════════════
export async function generateResults(productName, metadata, questions = [], phases = []) {
  const phaseLabels = phases.map((p, i) => `Fase ${i + 1}: "${p.label}"`).join(', ');
  const questionSummary = questions.slice(0, 10).map((q, i) => `${i + 1}. [${q.type}] ${q.text}`).join('\n');

  const system = `Você é um copywriter especialista em conversão no nicho "${metadata.niche}".
Seu trabalho é criar perfis de resultado CURTOS e PERSUASIVOS que:
1. Façam a pessoa sentir urgência em agir
2. Conectem o diagnóstico diretamente ao produto como solução
3. Usem terminologia ESPECÍFICA ao sub-tema "${metadata.subTheme}"
4. Sejam BREVES — máximo 3 frases na description`;

  const prompt = `Gere 3 perfis de resultado para o quiz "${productName}".

═══ CONTEXTO ═══
Sub-tema: ${metadata.subTheme} | Nicho: ${metadata.niche}
Fases: ${phaseLabels}
Perguntas: ${questionSummary}

═══ FORMATO JSON ═══
{
  "results": [
    {"id":"slug","name":"Nome","minPct":0,"maxPct":40,"description":"...","cta":"🔥 AÇÃO AGORA →","ctaUrl":""},
    {"id":"slug","name":"Nome","minPct":41,"maxPct":70,"description":"...","cta":"🔥 AÇÃO AGORA →","ctaUrl":""},
    {"id":"slug","name":"Nome","minPct":71,"maxPct":100,"description":"...","cta":"🔥 AÇÃO AGORA →","ctaUrl":""}
  ]
}

═══ REGRAS DA DESCRIPTION (MÁXIMO 3 FRASES) ═══
Frase 1: Diagnóstico direto e específico baseado nas respostas do quiz (personalizado ao sub-tema)
Frase 2: Consequência de NÃO agir — crie urgência real e específica ao tema
Frase 3: Ponte para a solução "${productName}" — conecte o diagnóstico ao produto de forma natural

PROIBIDO na description:
- Listas com bullets (•, -, ✓)
- Blocos de estatísticas com %
- Textos em itálico ou emphasis
- Mais de 3 frases
- Texto genérico

═══ REGRAS DE NOME ═══
- Vocabulário ESPECÍFICO ao sub-tema "${metadata.subTheme}"
- PROIBIDO nomes genéricos

═══ REGRAS DE CTA ═══
- Comece com emoji 🔥 e use CAPS nas palavras-chave
- Mencione o benefício específico do produto
- Exemplos: "🔥 ACESSAR MEU PLANO PERSONALIZADO →", "🔥 QUERO MINHA ROTINA AGORA →"
- NUNCA usar "Saiba mais", "Clique aqui" ou "Ver resultado"

REGRAS TÉCNICAS:
- Exatamente 3 results, ranges cobrem 0-100 sem gaps
- Campos: id, name, minPct, maxPct, description, cta, ctaUrl
- ctaUrl sempre string vazia
- Tom: "${metadata.tone}" | Português brasileiro`;

  return callAI(prompt, { system, temperature: 0.7, maxTokens: 1200 });
}

// ════════════════════════════════════════════════════════
// DALL-E IMAGE CALLER
// ════════════════════════════════════════════════════════
async function callDALLE(prompt, size = '1024x1024') {
  if (!API_KEY) return null;
  try {
    const res = await fetch(DALLE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        quality: 'standard',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[DALL-E] Error:', err.error?.message || res.status);
      return null;
    }
    const data = await res.json();
    return data.data?.[0]?.url || null;
  } catch (err) {
    console.warn('[DALL-E] Failed:', err.message);
    return null;
  }
}

// ════════════════════════════════════════════════════════
// STEP 5 — generateQuizImages → images via DALL-E
// ════════════════════════════════════════════════════════

// Coordenadas de estilo (o "backend" que mantém padrão)
const IMAGE_STYLE = 'professional photography, warm natural lighting, clean modern aesthetic, high quality, no text overlays, no watermarks, no logos';

export async function generateQuizImages(metadata, phases) {
  // Collect insight titles and check for social-proof
  const insightTitles = [];
  let hasSocialProof = false;
  (phases || []).forEach(phase => {
    (phase.items || []).forEach(item => {
      if (item.type === 'insight') insightTitles.push(item.title);
      if (item.type === 'social-proof') hasSocialProof = true;
    });
  });

  const niche = metadata.niche || '';
  const sub = metadata.subTheme || niche;

  // Build contextual prompts
  const prompts = [];

  // Social proof image (always generate if there's a social-proof page)
  if (hasSocialProof) {
    prompts.push({
      key: 'socialProof',
      prompt: `A diverse group of 3 real people standing together, smiling confidently, related to the topic of "${sub}". One person holds a smartphone. They look like real customers who benefited from a ${niche} product. Casual modern clothing, clean white background, full body shot, ${IMAGE_STYLE}`,
    });
  }

  // Insight images (one per insight, contextual to its title)
  insightTitles.forEach((title, i) => {
    prompts.push({
      key: `insight_${i}`,
      prompt: `Professional lifestyle photo illustrating the concept: "${title}". Context: ${sub} (${niche}). Show a real person in a relevant situation that emotionally connects to this topic. The image should feel aspirational and empathetic. ${IMAGE_STYLE}`,
    });
  });

  // Generate all images in parallel for speed
  console.log(`[Step 5] Generating ${prompts.length} images via DALL-E...`);
  const results = await Promise.all(
    prompts.map(async ({ key, prompt }) => {
      const url = await callDALLE(prompt);
      if (url) console.log(`[Step 5] ✅ ${key} generated`);
      else console.warn(`[Step 5] ⚠️ ${key} failed, will use fallback`);
      return { key, url };
    })
  );

  // Build images object
  const images = { socialProof: null, insights: [] };
  results.forEach(({ key, url }) => {
    if (key === 'socialProof') images.socialProof = url;
    else if (key.startsWith('insight_')) images.insights.push(url);
  });

  return images;
}
