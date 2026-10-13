// Capa de servidor per a la IA de StudyFlow.
// - Les claus API es llegeixen de variables d'entorn i NO s'envien mai al navegador.
// - Controla límits de mida, de peticions per minut i per dia, i informa del cost estimat.
// - Si no hi ha cap clau configurada, /api/ai/status ho indica i l'app continua en mode local.

import Anthropic from '@anthropic-ai/sdk';

// Preus orientatius (USD per milió de tokens) per estimar costos.
const PRICES = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
};
// Models amb suport per a la reexecució automàtica en cas de rebuig ("fallbacks").
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1', 'claude-opus-5']);

function readConfig(env) {
  const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== undefined ? Number(v) : d);
  const anthropicKey = env.ANTHROPIC_API_KEY || '';
  const compatBase = (env.OPENAI_COMPAT_BASE_URL || '').replace(/\/$/, '');
  const allowed = (env.AI_ALLOWED_MODELS || 'claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const providers = [
    {
      id: 'anthropic',
      label: 'Anthropic (Claude)',
      configured: Boolean(anthropicKey),
      models: allowed.filter((m) => m.startsWith('claude')),
      defaultModel: env.AI_MODEL || 'claude-opus-5-5',
    },
    {
      id: 'openai-compatible',
      label: 'API compatible amb OpenAI',
      configured: Boolean(compatBase && env.OPENAI_COMPAT_MODEL),
      models: env.OPENAI_COMPAT_MODEL ? [env.OPENAI_COMPAT_MODEL] : [],
      defaultModel: env.OPENAI_COMPAT_MODEL || '',
    },
  ];
  return {
    anthropicKey,
    compatBase,
    compatKey: env.OPENAI_COMPAT_API_KEY || '',
    providers,
    defaultProvider: env.AI_PROVIDER || 'anthropic',
    maxInputChars: num(env.AI_MAX_INPUT_CHARS, 60000),
    maxOutputTokens: num(env.AI_MAX_OUTPUT_TOKENS, 16000),
    ratePerMin: num(env.AI_RATE_LIMIT_PER_MIN, 10),
    maxPerDay: num(env.AI_MAX_REQUESTS_PER_DAY, 200),
  };
}

// ---------- Límits de peticions (en memòria) ----------
const recent = [];
let dayKey = '';
let dayCount = 0;
let totalCost = 0;

function checkLimits(cfg) {
  const now = Date.now();
  while (recent.length && now - recent[0] > 60000) recent.shift();
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) {
    dayKey = today;
    dayCount = 0;
  }
  if (recent.length >= cfg.ratePerMin) return `S’ha superat el límit de ${cfg.ratePerMin} peticions per minut. Espera uns segons.`;
  if (dayCount >= cfg.maxPerDay) return `S’ha arribat al límit diari de ${cfg.maxPerDay} peticions d’IA (AI_MAX_REQUESTS_PER_DAY).`;
  recent.push(now);
  dayCount++;
  return null;
}

// ---------- Prompts ----------
const SYSTEM = `Ets un professor universitari rigorós que prepara material d'estudi en català a partir d'apunts o documents que aporta l'estudiant.
Regles obligatòries:
- Basa't EXCLUSIVAMENT en el text del document que se't proporciona. No inventis dades, articles, lleis, terminis, cites ni números de pàgina.
- Diferencia sempre entre: "textual" (informació que apareix al document), "complementari" (explicació didàctica teva que no és al document) i "no_verificable" (afirmacions que no es poden comprovar amb el document).
- Conserva amb especial cura articles, números de lleis, terminis, excepcions, requisits, classificacions i jurisprudència citada.
- Les marques [[p:N]] indiquen l'inici de la pàgina N del PDF original. Utilitza-les per indicar les pàgines.
- Respon NOMÉS amb un objecte JSON vàlid, sense text addicional ni blocs de codi.`;

function theoryPrompt({ sectionTitle, subjectName, sourceText }) {
  return `Assignatura: ${subjectName || '(sense nom)'}
Apartat: ${sectionTitle}

Crea la teoria estructurada d'aquest apartat per a un nivell universitari, sense reduir excessivament el contingut ni eliminar excepcions, requisits, terminis o articles.
Format JSON exacte:
{
  "objectius": ["..."],
  "blocs": [
    {"tipus": "titol|paragraf|definicio|llista|normativa|exemple|comparacio|nota",
     "origen": "textual|complementari|no_verificable",
     "terme": "(només definicio)",
     "text": "...",
     "elements": ["(només llista)"],
     "capcaleres": ["(només comparacio)"], "files": [["..."]],
     "referencies": ["(només normativa: articles/lleis citats)"],
     "pagines": [N],
     "cita": "fragment LITERAL curt (10-25 paraules) copiat del document que justifica el bloc (obligatori si origen=textual)"}
  ],
  "resum": ["..."],
  "conceptes_clau": ["..."],
  "avisos": ["informació que falta, ambigua o que no s'ha pogut verificar"]
}

TEXT DEL DOCUMENT:
"""
${sourceText}
"""`;
}

function questionsPrompt({ sectionTitle, sourceText, count, pool }) {
  return `Apartat: ${sectionTitle}
Genera ${count} preguntes ${pool === 'exam' ? "per a un EXAMEN sense apunts (diferents de preguntes de pràctica típiques, sense pistes a l'enunciat)" : 'de PRÀCTICA (l’estudiant pot consultar la teoria)'} basades només en el document.
Barreja tipus: "mcq" (4 opcions, UNA sola correcta, distractors plausibles però inequívocament incorrectes), "truefalse", "cloze" (completar, amb ________), "short" (resposta curta amb criteris), "difference" (diferència entre conceptes), "case" (cas pràctic, només si la matèria ho permet).
Dificultats variades: easy, medium, hard.
Format JSON exacte:
{"preguntes": [
  {"tipus": "mcq|truefalse|cloze|short|difference|case",
   "enunciat": "...",
   "opcions": ["A","B","C","D"],
   "resposta": "mcq: índex 0-3; truefalse: true/false; cloze: paraula exacta; obertes: resposta model",
   "criteris": [{"text": "criteri de correcció", "paraules_clau": ["..."]}],
   "explicacio": "per què és correcta i per què les altres no",
   "cita": "fragment LITERAL del document que justifica la resposta",
   "pagines": [N],
   "dificultat": "easy|medium|hard",
   "concepte": "concepte avaluat"}
]}

TEXT DEL DOCUMENT:
"""
${sourceText}
"""`;
}

function gradePrompt({ question, reference, criteria, answer }) {
  return `Avalua de manera orientativa la resposta d'un estudiant.
Pregunta: ${question}
Resposta de referència (del document): ${reference}
Criteris: ${JSON.stringify(criteria || [])}
Resposta de l'estudiant: """${answer}"""
Respon amb JSON: {"puntuacio": 0..1, "criteris_complerts": ["..."], "criteris_no_complerts": ["..."], "comentari": "explicació breu i constructiva en català"}
No premiïs informació que no aparegui a la referència si la contradiu.`;
}

// ---------- Crides als proveïdors ----------
function extractJson(text) {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('La resposta de la IA no conté JSON.');
  return JSON.parse(t.slice(start, end + 1));
}

async function callAnthropic(cfg, model, prompt, maxTokens) {
  const client = new Anthropic({ apiKey: cfg.anthropicKey, maxRetries: 2 });
  const params = {
    model,
    max_tokens: maxTokens,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort: 'medium' },
  };
  let message;
  if (FALLBACK_MODELS.has(model)) {
    message = await client.beta.messages
      .stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      .finalMessage();
  } else {
    message = await client.messages.stream(params).finalMessage();
  }
  if (message.stop_reason === 'refusal') {
    const err = new Error('El model ha declinat respondre aquesta petició.');
    err.status = 422;
    throw err;
  }
  if (message.stop_reason === 'max_tokens') {
    const err = new Error('La resposta de la IA s’ha tallat (límit de tokens). Prova amb un apartat més curt o augmenta AI_MAX_OUTPUT_TOKENS.');
    err.status = 422;
    throw err;
  }
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const usage = message.usage || {};
  const [pin, pout] = PRICES[model] || [0, 0];
  const cost = ((usage.input_tokens || 0) * pin + (usage.output_tokens || 0) * pout) / 1e6;
  return { text, usage: { input: usage.input_tokens || 0, output: usage.output_tokens || 0, costUsd: cost }, model: message.model || model };
}

async function callCompat(cfg, model, prompt, maxTokens) {
  const r = await fetch(`${cfg.compatBase}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cfg.compatKey ? { authorization: `Bearer ${cfg.compatKey}` } : {}) },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!r.ok) {
    const err = new Error(`El proveïdor ha retornat l’error ${r.status}.`);
    err.status = r.status === 429 ? 429 : 502;
    throw err;
  }
  const j = await r.json();
  return { text: j.choices?.[0]?.message?.content ?? '', usage: { input: j.usage?.prompt_tokens || 0, output: j.usage?.completion_tokens || 0, costUsd: 0 }, model };
}

function mapError(e) {
  if (e instanceof Anthropic.AuthenticationError) return [401, 'La clau ANTHROPIC_API_KEY no és vàlida.'];
  if (e instanceof Anthropic.PermissionDeniedError) return [403, 'La clau no té permís per utilitzar aquest model.'];
  if (e instanceof Anthropic.NotFoundError) return [404, 'El model configurat no existeix o no està disponible.'];
  if (e instanceof Anthropic.RateLimitError) return [429, 'El proveïdor d’IA ha limitat les peticions. Torna-ho a provar d’aquí a una estona.'];
  if (e instanceof Anthropic.BadRequestError) return [400, `Petició no vàlida per al proveïdor: ${e.message}`];
  if (e instanceof Anthropic.APIConnectionError) return [502, 'No s’ha pogut connectar amb el proveïdor d’IA.'];
  if (e instanceof Anthropic.APIError) return [502, `Error del proveïdor d’IA (${e.status ?? '?'}).`];
  if (e instanceof SyntaxError) return [502, 'La IA ha retornat un JSON no vàlid. Torna-ho a provar.'];
  return [e.status || 500, e.message || 'Error desconegut'];
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

export function createAiMiddleware(env = process.env) {
  return async function aiMiddleware(req, res, next) {
    const url = (req.url || '').split('?')[0];
    if (!url.startsWith('/api/ai/')) return next();
    const cfg = readConfig(env);
    try {
      if (url === '/api/ai/status' && req.method === 'GET') {
        return send(res, 200, {
          configured: cfg.providers.some((p) => p.configured),
          defaultProvider: cfg.defaultProvider,
          providers: cfg.providers.map(({ id, label, configured, models, defaultModel }) => ({ id, label, configured, models, defaultModel })),
          limits: { maxInputChars: cfg.maxInputChars, ratePerMin: cfg.ratePerMin, maxPerDay: cfg.maxPerDay, usedToday: dayCount },
          estimatedCostUsd: Math.round(totalCost * 10000) / 10000,
        });
      }
      if (req.method !== 'POST') return send(res, 405, { error: 'Mètode no permès' });
      const body = await readBody(req);
      const providerId = body.provider || cfg.defaultProvider;
      const provider = cfg.providers.find((p) => p.id === providerId);
      if (!provider || !provider.configured) {
        return send(res, 503, { error: 'No hi ha cap proveïdor d’IA configurat al servidor. Defineix ANTHROPIC_API_KEY (o un proveïdor compatible) al fitxer .env. Les funcions locals continuen disponibles.' });
      }
      const model = body.model && provider.models.includes(body.model) ? body.model : provider.defaultModel;
      const inputLen = JSON.stringify(body).length;
      if (inputLen > cfg.maxInputChars) {
        return send(res, 413, { error: `El text és massa llarg per a la IA (${inputLen} caràcters; límit ${cfg.maxInputChars}). Divideix l’apartat o augmenta AI_MAX_INPUT_CHARS.` });
      }
      const limit = checkLimits(cfg);
      if (limit) return send(res, 429, { error: limit });

      let prompt;
      let maxTokens = cfg.maxOutputTokens;
      if (url === '/api/ai/theory') prompt = theoryPrompt(body);
      else if (url === '/api/ai/questions') prompt = questionsPrompt({ count: Math.min(Number(body.count) || 10, 30), ...body });
      else if (url === '/api/ai/grade') {
        prompt = gradePrompt(body);
        maxTokens = Math.min(maxTokens, 4000);
      } else return send(res, 404, { error: 'Ruta desconeguda' });

      const call = provider.id === 'anthropic' ? callAnthropic : callCompat;
      const out = await call(cfg, model, prompt, maxTokens);
      totalCost += out.usage.costUsd;
      const data = extractJson(out.text);
      return send(res, 200, { data, model: out.model, usage: out.usage });
    } catch (e) {
      const [status, msg] = mapError(e);
      return send(res, status, { error: msg });
    }
  };
}
