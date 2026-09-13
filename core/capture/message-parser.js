/* ═══════════════════════════════════════════════════════════════════════════
 * core/capture/message-parser.js
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: convierte texto crudo de una conversación en mensajes
 *     tipados. Detecta quién habla (user/assistant/tool/system), en qué idioma
 *     está escrito, qué INTENCIÓN tiene (pregunta, decisión, requisito, plan,
 *     error, búsqueda, informe...) y extrae requisitos, restricciones,
 *     incógnitas, bloques de código, enlaces y JSON embebido.
 *     POR QUÉ EXISTE: es el paso "Normalización" del pipeline
 *     (Chat → Captura → Normalización → Análisis...). Sin él, el nivel RAW
 *     sería un cementerio de texto: guardar sin entender no es documentar.
 *
 *     ⚠️ HONESTIDAD DE DISEÑO: este parser es DETERMINISTA (reglas, cero IA).
 *     No intenta adivinar el razonamiento interno de nadie (DEC-00003). Cuando
 *     exista un adaptador de modelo, se conectará en `interpret()` y este
 *     archivo seguirá siendo la capa de respaldo offline.
 *
 * 🇬🇧 EN — WHAT IT DOES: turns raw conversation text into typed messages. It
 *     detects the speaker (user/assistant/tool/system), the language, the
 *     INTENT (question, decision, requirement, plan, error, search, report...)
 *     and extracts requirements, constraints, unknowns, code blocks, links and
 *     embedded JSON.
 *     WHY IT EXISTS: it is the "Normalization" step of the pipeline. Without it
 *     the RAW level would be a graveyard of text: storing without understanding
 *     is not documenting.
 *     ⚠️ DESIGN HONESTY: this parser is DETERMINISTIC (rules, zero AI). It never
 *     tries to guess anyone's internal reasoning (DEC-00003). When a model
 *     adapter exists it plugs into `interpret()`, and this file remains the
 *     offline fallback layer.
 *
 * 🇧🇷 PT — O QUE FAZ: converte texto bruto de uma conversa em mensagens
 *     tipadas. Detecta quem fala (user/assistant/tool/system), em que idioma
 *     está escrito, qual a INTENÇÃO (pergunta, decisão, requisito, plano, erro,
 *     busca, relatório...) e extrai requisitos, restrições, incógnitas, blocos
 *     de código, links e JSON embutido.
 *     POR QUE EXISTE: é o passo "Normalização" do pipeline. Sem ele, o nível RAW
 *     seria um cemitério de texto: guardar sem entender não é documentar.
 *     ⚠️ HONESTIDADE DE DESIGN: este parser é DETERMINÍSTICO (regras, zero IA).
 *     Nunca tenta adivinhar o raciocínio interno (DEC-00003).
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Expresión regular (regex) ES/EN/PT: un patrón de búsqueda en texto.
 *     `/^(USER|HUMAN):/i` significa: "^" inicio de línea, "(USER|HUMAN)" una de
 *     estas dos palabras, ":" dos puntos literal, "/i" ignora mayúsculas.
 *     A regex is a text search pattern; ^ = start, | = or, /i = ignore case.
 *   • `text.match(regex)` devuelve el resultado o `null`; `regex.exec(text)`
 *     devuelve un array donde `[0]` es el texto completo y `[1]`, `[2]`... son
 *     los grupos capturados entre paréntesis.
 *     exec returns groups captured by parentheses.
 *   • Stopwords para detectar idioma ES/EN/PT: contamos palabras muy frecuentes
 *     y exclusivas de cada idioma ("el/la/qué" = español, "the/and/what" =
 *     inglés, "o/não/você" = portugués). El idioma con más aciertos gana. Es
 *     heurístico, no perfecto, y por eso devolvemos también la confianza.
 *     Counting language-exclusive frequent words; heuristic, so we return confidence.
 *   • Normalizar texto ES/EN/PT: `toLowerCase()` + colapsar espacios múltiples
 *     hace que las comparaciones no fallen por mayúsculas o dobles espacios.
 *     Lowercasing and collapsing whitespace prevents silly comparison failures.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** ES/EN/PT: palabras características por idioma (muestra, no lista exhaustiva). */
const LANGUAGE_MARKERS = Object.freeze({
  es: ['el', 'la', 'los', 'las', 'que', 'qué', 'una', 'uno', 'para', 'con', 'por', 'como', 'cómo', 'este', 'esta', 'sería', 'haría', 'además', 'porque', 'también', 'estamos', 'necesito', 'proyecto', 'sesión', 'decisión', 'construir', 'guardar'],
  en: ['the', 'and', 'that', 'this', 'with', 'for', 'from', 'what', 'which', 'would', 'should', 'because', 'also', 'there', 'their', 'have', 'been', 'project', 'session', 'decision', 'build', 'store'],
  pt: ['que', 'não', 'você', 'uma', 'com', 'para', 'por', 'como', 'mais', 'isso', 'este', 'esta', 'seria', 'faria', 'além', 'porque', 'também', 'estamos', 'preciso', 'projeto', 'sessão', 'decisão', 'construir', 'guardar', 'arquivo'],
});

const ROLE_PATTERNS = Object.freeze([
  { role: 'user', re: /^\s*(?:#+\s*)?(?:>+\s*)?(?:user|usuario|usuário|human|humano|humano:|me|yo)\s*[:\-—]\s*/i },
  { role: 'assistant', re: /^\s*(?:#+\s*)?(?:>+\s*)?(?:assistant|ia|ai|bot|agent|agente|genesis|claude|gpt|gemini)\s*[:\-—]\s*/i },
  { role: 'tool', re: /^\s*(?:tool|herramienta|ferramenta|function|bash|shell)\s*[:\-—]\s*/i },
  { role: 'system', re: /^\s*(?:system|sistema)\s*[:\-—]\s*/i },
]);

const INTENT_RULES = Object.freeze([
  { intent: 'decision', score: 3, re: /\b(decisi[oó]n|decision trace|decid[ií]|we chose|elegimos|optar[ií]a|aprobad[oa]|approved)\b/i },
  { intent: 'error', score: 3, re: /\b(error|fallo|fall[oó]|excepci[oó]n|exception|stack ?trace|traceback|no funciona|doesn'?t work|broken|corrupto)\b/i },
  { intent: 'requirement', score: 2, re: /\b(requisito|requirement|debe|must|tiene que|tiene que ser|acceptance|criterio de aceptaci[oó]n|necesitamos|we need)\b/i },
  { intent: 'plan', score: 2, re: /\b(plan|fase \d|phase \d|paso \d|step \d|roadmap|har[ií]a|we would|primero|first)\b/i },
  { intent: 'search', score: 3, re: /\b(b[uú]squeda|search|query|google|fuente|source|investigar|research)\b/i },
  { intent: 'blocker', score: 3, re: /\b(bloqueo|bloqueado|blocked|corte|interrupci[oó]n|interrupted|no puedo|i can'?t|403|permission denied)\b/i },
  { intent: 'question', score: 2, re: /\?\s*$/m },
  { intent: 'instruction', score: 2, re: /^\s*(?:[-*]\s*)?(?:haz|crea|construye|implementa|ejecuta|do|create|build|implement|run)\b/im },
  { intent: 'lesson', score: 3, re: /\b(lecci[oó]n|lesson|aprendizaje|learning|aprendimos|we learned|regla futura|future rule)\b/i },
  { intent: 'report', score: 1, re: /\b(completado|completed|listo|done|resultado|result|summary|resumen)\b/i },
]);

/** ES/EN/PT: normaliza espacios y saltos de línea redundantes. Normalizes redundant whitespace. */
export function normalizeText(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * ES: detecta el idioma dominante contando marcadores. Devuelve idioma y confianza.
 * EN: detects the dominant language by counting markers. Returns language and confidence.
 * PT: detecta o idioma dominante contando marcadores. Devolve idioma e confiança.
 */
export function detectLanguage(text) {
  const words = normalizeText(text).toLowerCase().match(/[a-záéíóúñüàâãçõ]+/g) ?? [];
  if (words.length === 0) return { language: 'und', confidence: 0, counts: {} };
  const counts = {};
  for (const [language, markers] of Object.entries(LANGUAGE_MARKERS)) {
    const set = new Set(markers);
    counts[language] = words.filter((w) => set.has(w)).length;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [top, topCount] = ranked[0] ?? ['und', 0];
  const second = ranked[1]?.[1] ?? 0;
  const confidence = topCount === 0 ? 0 : Math.round((topCount / (topCount + second || 1)) * 100) / 100;
  return { language: topCount === 0 ? 'und' : top, confidence, counts, word_count: words.length };
}

/** ES/EN/PT: extrae bloques ```código``` con su lenguaje. Extracts fenced code blocks with their language. */
export function extractCodeBlocks(text) {
  const blocks = [];
  const re = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    blocks.push({ language: (match[1] || 'text').toLowerCase(), content: match[2], lines: match[2].split('\n').length, chars: match[2].length });
  }
  return blocks;
}

/** ES/EN/PT: extrae URLs. Extracts URLs. */
export function extractLinks(text) {
  const found = String(text).match(/https?:\/\/[^\s)"'<>]+/g) ?? [];
  return [...new Set(found)];
}

/** ES/EN/PT: extrae objetos JSON embebidos en bloques ```json. Extracts JSON objects embedded in ```json blocks. */
export function extractJsonBlocks(text) {
  const out = [];
  for (const block of extractCodeBlocks(text)) {
    if (!['json', 'jsonc', ''].includes(block.language)) continue;
    const trimmed = block.content.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // ES: JSON ilustrativo (con "..." o comentarios) no es parseable; lo guardamos como texto.
      // EN: illustrative JSON (with "..." or comments) is unparseable; keep it as text.
      // PT: JSON ilustrativo (com "..." ou comentários) não é parseável; guardamos como texto.
      out.push({ _unparsed: trimmed.slice(0, 2000) });
    }
  }
  return out;
}

/** ES/EN/PT: extrae encabezados markdown como estructura del mensaje. Extracts markdown headings. */
export function extractHeadings(text) {
  return (String(text).match(/^#{1,6}\s+.*$/gm) ?? []).map((line) => ({
    level: (line.match(/^#+/) ?? ['#'])[0].length,
    text: line.replace(/^#+\s*/, '').trim(),
  }));
}

/**
 * ES: extrae requisitos de listas imperativas ("- Debe...", "1. Tiene que...").
 * EN: extracts requirements from imperative lists ("- Must...", "1. It has to...").
 * PT: extrai requisitos de listas imperativas ("- Deve...", "1. Tem que...").
 */
export function extractRequirements(text) {
  const out = [];
  const lines = normalizeText(text).split('\n');
  const re = /^\s*(?:[-*•]|\d+[.)])\s+(.{6,240}?)\s*$/;
  const keyword = /\b(debe|deben|tiene que|hay que|requisito|necesitamos|must|shall|should|require|requirement|needs to|deve|devem|tem que|é preciso|precisa)\b/i;
  for (const line of lines) {
    const match = re.exec(line);
    if (!match) continue;
    const sentence = match[1].replace(/[*_`]/g, '').trim();
    if (keyword.test(sentence)) out.push(sentence);
  }
  return [...new Set(out)].slice(0, 40);
}

/** ES/EN/PT: extrae restricciones ("no ...", "nunca ...", "evitar ...", "never ..."). */
export function extractConstraints(text) {
  const out = [];
  const re = /\b(no\s+(?:debes?|deber[ií]amos|construir[ií]a|meter[ií]a|usar|intentar)|nunca|jam[aá]s|evitar|prohibido|never|do not|don'?t|must not|avoid|forbidden|n[aã]o\s+(?:deve|devemos|usar|tentar)|nunca)\s+([^.!?\n]{6,180})/gi;
  let match;
  while ((match = re.exec(String(text))) !== null) {
    out.push(normalizeText(`${match[1]} ${match[2]}`).replace(/\s+/g, ' '));
  }
  return [...new Set(out)].slice(0, 30);
}

/** ES/EN/PT: extrae incógnitas = preguntas abiertas del mensaje. Extracts unknowns = open questions. */
export function extractUnknowns(text) {
  const out = [];
  const re = /(?:^|\n)\s*(?:[-*•>]\s*)?((?:qué|qu[eé]|c[oó]mo|cu[aá]l|cu[aá]ndo|d[oó]nde|por qu[eé]|who|what|how|which|when|where|why|should we|podemos|debemos)[^.\n]{4,220}\?)/gi;
  let match;
  while ((match = re.exec(String(text))) !== null) out.push(normalizeText(match[1]));
  return [...new Set(out)].slice(0, 30);
}

/** ES/EN/PT: extrae identificadores del proyecto (DEC-00001, TSK-3, REQ-0002...). */
export function extractEntityRefs(text) {
  const re = /\b(DEC|TSK|REQ|SES|MSG|INT|CHK|BLD|LES|POL|EVT|SRC|ERR|PLN|ACT|ART|CPT|TEC)-\d{2,6}\b/g;
  return [...new Set(String(text).match(re) ?? [])];
}

/** ES/EN/PT: detecta términos técnicos para alimentar el grafo de conocimiento. */
export function extractTechnicalTerms(text) {
  const known = [
    'sqlite', 'fts5', 'next.js', 'react', 'typescript', 'tailwind', 'node', 'zod', 'event bus', 'knowledge graph',
    'manifest', 'orchestrator', 'planner', 'executor', 'verifier', 'recovery', 'checkpoint', 'rollback', 'mcp',
    'langgraph', 'crewai', 'autogen', 'n8n', 'dify', 'flowise', 'langflow', 'tauri', 'electron', 'embeddings',
    'json', 'jsonl', 'markdown', 'git', 'api', 'rest', 'cli', 'esm', 'regex', 'schema', 'adapter', 'pipeline',
    'context engine', 'decision trace', 'agent', 'skill', 'automation', 'testing', 'i18n', 'dashboard', 'timeline',
  ];
  const haystack = String(text).toLowerCase();
  return known.filter((term) => haystack.includes(term));
}

/**
 * ES: clasifica la intención principal de un mensaje puntuando reglas.
 * EN: classifies the main intent of a message by scoring rules.
 * PT: classifica a intenção principal de uma mensagem pontuando regras.
 */
export function classifyIntent(text) {
  const scores = {};
  for (const rule of INTENT_RULES) {
    const matches = String(text).match(new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : `${rule.re.flags}g`));
    if (matches && matches.length) scores[rule.intent] = (scores[rule.intent] ?? 0) + rule.score * Math.min(3, matches.length);
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((sum, [, v]) => sum + v, 0);
  return {
    intent: ranked[0]?.[0] ?? 'statement',
    confidence: total === 0 ? 0 : Math.round((ranked[0][1] / total) * 100) / 100,
    scores,
    secondary: ranked.slice(1, 4).map(([intent]) => intent),
  };
}

/** ES/EN/PT: métricas básicas de un mensaje. Basic metrics of a message. */
export function messageStats(text) {
  const normalized = normalizeText(text);
  const words = normalized.match(/\S+/g) ?? [];
  return {
    chars: normalized.length,
    words: words.length,
    lines: normalized.split('\n').length,
    sentences: (normalized.match(/[.!?]+(?:\s|$)/g) ?? []).length,
    reading_minutes: Math.max(1, Math.round(words.length / 200)),
  };
}

/**
 * ES: convierte un texto crudo en un mensaje tipado y analizado.
 *     Esta es la función principal del parser.
 * EN: turns raw text into a typed, analyzed message. This is the parser's main function.
 * PT: converte um texto bruto em uma mensagem tipada e analisada. Esta é a função principal do parser.
 *
 * @param {string} content raw text
 * @param {{ role?: string, index?: number, session_id?: string, ts?: string, id?: string }} [meta]
 */
export function parseMessage(content, meta = {}) {
  const text = normalizeText(content);
  const language = detectLanguage(text);
  const intent = classifyIntent(text);
  const stats = messageStats(text);
  const codeBlocks = extractCodeBlocks(text);

  return {
    id: meta.id ?? null,
    session_id: meta.session_id ?? null,
    index: meta.index ?? 0,
    role: meta.role ?? 'user',
    ts: meta.ts ?? new Date().toISOString(),
    content: text,
    language: language.language,
    language_confidence: language.confidence,
    intent: intent.intent,
    intent_confidence: intent.confidence,
    secondary_intents: intent.secondary,
    stats,
    interpretation: {
      // ES: sección B del requisito "documentar TODO": la interpretación.
      // EN: section B of the "document EVERYTHING" requirement: the interpretation.
      // PT: seção B do requisito "documentar TUDO": a interpretação.
      intent: intent.intent,
      requirements: extractRequirements(text),
      constraints: extractConstraints(text),
      unknowns: extractUnknowns(text),
      headings: extractHeadings(text),
      entities: extractEntityRefs(text),
      technical_terms: extractTechnicalTerms(text),
      links: extractLinks(text),
      code_blocks: codeBlocks.map((b) => ({ language: b.language, lines: b.lines, chars: b.chars })),
      json_blocks: extractJsonBlocks(text).length,
      deterministic: true,
      interpreter: 'core/capture/message-parser (rule-based, offline)',
    },
  };
}

/**
 * ES: divide una transcripción completa en mensajes. Acepta tres formatos:
 *     1. Texto con marcadores "USER:" / "ASSISTANT:" (o "Usuario:", "IA:").
 *     2. JSON: array de {role, content} u objeto {messages:[...]}.
 *     3. JSONL: una línea = un mensaje.
 *     Si no reconoce nada, trata todo el texto como UN único mensaje de usuario.
 * EN: splits a whole transcript into messages. Accepts three formats:
 *     1. Text with "USER:" / "ASSISTANT:" markers (or "Usuario:", "IA:").
 *     2. JSON: an array of {role, content} or an object {messages:[...]}.
 *     3. JSONL: one line = one message.
 *     If nothing is recognized, the whole text becomes ONE user message.
 * PT: divide uma transcrição inteira em mensagens. Aceita três formatos:
 *     marcadores "USER:" / "ASSISTANT:", JSON com array de {role, content} e
 *     JSONL. Se nada for reconhecido, todo o texto vira UMA mensagem de usuário.
 *
 * @param {string} raw
 * @returns {{ format: string, chunks: {role: string, content: string}[] }}
 */
export function parseTranscript(raw) {
  const text = normalizeText(raw);
  if (!text) return { format: 'empty', chunks: [] };

  // ES: intento 1 — JSON estructurado. Attempt 1 — structured JSON.
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const data = JSON.parse(text);
      const list = Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : null;
      if (list && list.every((m) => m && typeof m === 'object')) {
        const chunks = list.map((m) => ({
          role: String(m.role ?? m.author ?? m.speaker ?? 'user').toLowerCase(),
          content: normalizeText(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)),
          ts: m.ts ?? m.timestamp ?? null,
        })).filter((c) => c.content);
        if (chunks.length) return { format: 'json', chunks };
      }
    } catch {
      /* ES: no era JSON válido; seguimos con los otros formatos | EN: not valid JSON; try the next formats */
    }
  }

  // ES: intento 2 — JSONL. Attempt 2 — JSONL.
  const lines = text.split('\n');
  if (lines.length > 1 && lines.every((l) => !l.trim() || (l.trim().startsWith('{') && l.trim().endsWith('}')))) {
    const chunks = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj.content === 'string') chunks.push({ role: String(obj.role ?? 'user').toLowerCase(), content: normalizeText(obj.content), ts: obj.ts ?? null });
      } catch { /* ES: línea rota, se ignora | EN: broken line, ignored */ }
    }
    if (chunks.length) return { format: 'jsonl', chunks };
  }

  // ES: intento 3 — marcadores de rol al inicio de línea. Attempt 3 — role markers at line start.
  const markerRe = /^\s*(?:#+\s*)?(?:>+\s*)?(user|usuario|usuário|human|humano|assistant|ia|ai|bot|agent|agente|genesis|tool|herramienta|system|sistema)\s*[:\-—]\s*$/i;
  const boundaries = [];
  lines.forEach((line, index) => {
    const match = markerRe.exec(line);
    if (!match) return;
    const token = match[1].toLowerCase();
    const role = ROLE_PATTERNS.find((p) => p.re.test(`${token}:`))?.role ?? (['ia', 'ai', 'bot', 'agent', 'agente', 'genesis', 'assistant'].includes(token) ? 'assistant' : 'user');
    boundaries.push({ index, role });
  });

  if (boundaries.length >= 2) {
    const chunks = boundaries.map((boundary, position) => {
      const end = boundaries[position + 1]?.index ?? lines.length;
      return { role: boundary.role, content: normalizeText(lines.slice(boundary.index + 1, end).join('\n')) };
    }).filter((c) => c.content);
    if (chunks.length) return { format: 'markers', chunks };
  }

  // ES: intento 4 — marcadores en línea ("USER: hola"). Attempt 4 — inline markers.
  const inlineRe = /^\s*(?:#+\s*)?(?:>+\s*)?(user|usuario|assistant|ia|ai|agent|agente|genesis|tool|system|sistema)\s*[:\-—]\s*(.+)$/i;
  const inlineChunks = [];
  let buffer = { role: 'user', content: [] };
  for (const line of lines) {
    const match = inlineRe.exec(line);
    if (match) {
      if (buffer.content.length) inlineChunks.push({ role: buffer.role, content: normalizeText(buffer.content.join('\n')) });
      const token = match[1].toLowerCase();
      buffer = { role: ['ia', 'ai', 'agent', 'agente', 'genesis', 'assistant'].includes(token) ? 'assistant' : token === 'tool' ? 'tool' : token === 'system' || token === 'sistema' ? 'system' : 'user', content: [match[2]] };
    } else {
      buffer.content.push(line);
    }
  }
  if (buffer.content.length) inlineChunks.push({ role: buffer.role, content: normalizeText(buffer.content.join('\n')) });
  if (inlineChunks.length > 1) return { format: 'inline-markers', chunks: inlineChunks.filter((c) => c.content) };

  // ES: intento 5 — todo es un único mensaje. Attempt 5 — everything is a single message.
  return { format: 'single', chunks: [{ role: 'user', content: text }] };
}

/**
 * ES: punto de extensión para un adaptador de IA real. Hoy devuelve el análisis
 *     determinista; mañana puede enriquecerlo con un modelo sin cambiar a quien
 *     lo llama. Esto es el patrón adaptador (DEC-00009).
 * EN: extension point for a real AI adapter. Today it returns the deterministic
 *     analysis; tomorrow it can enrich it with a model without changing callers.
 *     This is the adapter pattern (DEC-00009).
 * PT: ponto de extensão para um adaptador de IA real. Hoje devolve a análise
 *     determinística; amanhã pode enriquecê-la com um modelo sem mudar quem
 *     chama. Este é o padrão adaptador (DEC-00009).
 */
export function interpret(message, adapter = null) {
  if (typeof adapter?.interpret === 'function') return adapter.interpret(message);
  return message.interpretation;
}

export default {
  normalizeText, detectLanguage, classifyIntent, messageStats, parseMessage, parseTranscript,
  extractCodeBlocks, extractLinks, extractJsonBlocks, extractHeadings, extractRequirements,
  extractConstraints, extractUnknowns, extractEntityRefs, extractTechnicalTerms, interpret,
};
