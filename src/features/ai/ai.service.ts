import { env } from '../../config/env';
import {
  TOOLS,
  executeTool,
  getOverviewData,
  getResidentsData,
  getHouseholdsData,
  getBusinessesData,
  getInquiriesData,
} from './ai.tools';

// ─── Ollama low-level client ─────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';
export type ToolCall = { function?: { name?: string; arguments?: unknown } };
export type ChatMessage = {
  role: ChatRole;
  content: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
};

const HOST = env.OLLAMA_HOST.replace(/\/$/, '');

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), env.AI_TIMEOUT_MS);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

type OllamaBody = {
  messages: ChatMessage[];
  tools?: unknown[];
  json?: boolean;
  temperature?: number;
};

function buildBody(body: OllamaBody, stream: boolean) {
  return {
    model: env.AI_MODEL,
    messages: body.messages,
    stream,
    think: false,
    ...(body.tools ? { tools: body.tools } : {}),
    ...(body.json ? { format: 'json' } : {}),
    options: { temperature: body.temperature ?? (body.json ? 0.2 : 0.6) },
  };
}

/** One non-streaming /api/chat call → the raw assistant message. */
async function chatOnce(body: OllamaBody, signal?: AbortSignal): Promise<ChatMessage> {
  const doFetch = (s: AbortSignal) =>
    fetch(`${HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody(body, false)),
      signal: s,
    });
  const res = signal ? await doFetch(signal) : await withTimeout(doFetch);
  if (!res.ok) throw new Error(`Ollama chat failed (${res.status})`);
  const json = (await res.json()) as { message?: ChatMessage };
  return json.message ?? { role: 'assistant', content: '' };
}

/** Streaming /api/chat call → yields text deltas. */
async function* streamOnce(body: OllamaBody, signal?: AbortSignal): AsyncGenerator<string> {
  const res = await fetch(`${HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBody(body, true)),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Ollama chat failed (${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line) as { message?: { content?: string } };
        const delta = obj.message?.content ?? '';
        if (delta) yield delta;
      } catch {
        /* ignore malformed line */
      }
    }
  }
}

function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function parseJson<T>(text: string): T | null {
  const cleaned = stripThink(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ─── Status ──────────────────────────────────────────────────────────────────

export type AiStatus = {
  connected: boolean;
  provider: string;
  model: string;
  contextWindow?: number;
  latencyMs?: number;
  message?: string;
};

export async function getStatus(): Promise<AiStatus> {
  const base = { provider: env.AI_PROVIDER, model: env.AI_MODEL };
  if (!env.AI_ENABLED) return { ...base, connected: false, message: 'AI disabled (AI_ENABLED=false)' };
  try {
    const started = Date.now();
    const res = await withTimeout((signal) => fetch(`${HOST}/api/tags`, { signal }));
    if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
    const json = (await res.json()) as { models?: { name: string }[] };
    const latencyMs = Date.now() - started;
    const installed = (json.models ?? []).some(
      (m) => m.name === env.AI_MODEL || m.name.split(':')[0] === env.AI_MODEL.split(':')[0],
    );
    if (!installed) {
      return { ...base, connected: false, latencyMs, message: `Model "${env.AI_MODEL}" not pulled. Run: ollama pull ${env.AI_MODEL}` };
    }
    return { ...base, connected: true, latencyMs, contextWindow: 32768 };
  } catch (err) {
    return { ...base, connected: false, message: (err as Error).message || 'Ollama not reachable' };
  }
}

// ─── Chat with tool-calling (DB retrieval) ────────────────────────────────────

const LOCALE_NAME: Record<string, string> = { uz: "o'zbek", ru: 'русский', en: 'English' };
function langLine(locale?: string): string {
  return `Javobni faqat ${LOCALE_NAME[locale ?? 'uz'] ?? "o'zbek"} tilida ber.`;
}

export function chatSystemPrompt(): ChatMessage {
  return {
    role: 'system',
    content:
      "Sen Mahalla OS tizimining AI yordamchisisan. Mahalla rahbariyatiga aholi, xonadonlar, bizneslar va murojaatlar bo'yicha aniq, qisqa, foydali javoblar berasan. " +
      "Aniq raqam yoki statistika kerak bo'lganda mavjud asboblardan (tools) foydalanib ma'lumotni bazadan ol — taxmin qilma. Savol mavzusiga mos asbobni chaqir: aholi→get_residents, oila→get_households, biznes→get_businesses, murojaat→get_inquiries, umumiy→get_overview. Ma'lumot olingach, uni tushunarli qilib izohlab ber.",
  };
}

/**
 * Resolves any tool calls the model requests (executing the org-scoped DB
 * functions), then streams the final grounded answer. Up to 3 tool rounds.
 */
export async function* chatStreamWithTools(
  orgId: string,
  userMessages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const messages: ChatMessage[] = [chatSystemPrompt(), ...userMessages];

  for (let round = 0; round < 3; round++) {
    const m = await chatOnce({ messages, tools: TOOLS }, signal);
    const calls = m.tool_calls ?? [];
    if (calls.length === 0) {
      // No (more) tools needed → stream the final answer for a smooth UX.
      yield* streamOnce({ messages }, signal);
      return;
    }
    // Record the assistant's tool-call turn, then run each tool and feed results back.
    messages.push({ role: 'assistant', content: m.content ?? '', tool_calls: calls });
    for (const tc of calls) {
      const name = tc.function?.name ?? '';
      const result = await executeTool(name, orgId);
      messages.push({ role: 'tool', content: JSON.stringify(result), tool_name: name });
    }
  }
  // Hit the round cap with data gathered → stream whatever the model can synthesize.
  yield* streamOnce({ messages }, signal);
}

/** Non-streaming variant (fallback for clients that don't stream). */
export async function chatWithTools(orgId: string, userMessages: ChatMessage[]): Promise<string> {
  let full = '';
  for await (const delta of chatStreamWithTools(orgId, userMessages)) full += delta;
  return full || stripThink(full);
}

// ─── Report analysis / forecast / anomalies (deterministic data routing) ──────

// Map a report/menu topic to the DB function that feeds it.
async function dataForTopic(orgId: string, topic: string): Promise<unknown> {
  switch (topic) {
    case 'residents':
    case 'demographics':
      return getResidentsData(orgId);
    case 'households':
      return getHouseholdsData(orgId);
    case 'businesses':
      return getBusinessesData(orgId);
    case 'inquiries':
      return getInquiriesData(orgId);
    default:
      return getOverviewData(orgId);
  }
}

export type AnalyzeInput = { reportType: string; from?: string; to?: string; locale?: string };

export async function analyzeReport(orgId: string, input: AnalyzeInput) {
  const data = await dataForTopic(orgId, input.reportType);
  const prompt = `${langLine(input.locale)}
Quyidagi haqiqiy mahalla ma'lumotlariga asoslanib "${input.reportType}" hisoboti tahlilini tayyorla.
Ma'lumotlar (JSON): ${JSON.stringify(data)}

Faqat quyidagi JSON formatda javob ber (boshqa matnsiz):
{"summary":"2-4 jumla","highlights":[{"label":"...","value":"...","trend":"up|down|flat","delta":"..."}],"insights":["..."],"recommendations":["..."],"risks":["..."]}`;
  const raw = await chatOnce({ messages: [{ role: 'user', content: prompt }], json: true });
  const parsed = parseJson<any>(raw.content) ?? {};
  return {
    reportType: input.reportType,
    from: input.from ?? null,
    to: input.to ?? null,
    summary: parsed.summary ?? '',
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    generatedAt: new Date().toISOString(),
    model: env.AI_MODEL,
  };
}

export type ForecastInput = { metric: string; horizon?: number; locale?: string };

export async function forecast(orgId: string, input: ForecastInput) {
  const horizon = input.horizon ?? 6;
  const topicMap: Record<string, string> = {
    population: 'residents',
    inquiries: 'inquiries',
    businesses: 'businesses',
    utility_debt: 'overview',
    migration: 'residents',
  };
  const data = await dataForTopic(orgId, topicMap[input.metric] ?? 'overview');
  const prompt = `${langLine(input.locale)}
Haqiqiy mahalla ma'lumotlari (JSON): ${JSON.stringify(data)}
"${input.metric}" ko'rsatkichi uchun keyingi ${horizon} oyga oddiy bashorat tayyorla.
Faqat JSON: {"narrative":"izoh","confidence":0.0-1.0,"series":[{"label":"oy","actual":son|null,"forecast":son|null}]}`;
  const raw = await chatOnce({ messages: [{ role: 'user', content: prompt }], json: true });
  const parsed = parseJson<any>(raw.content) ?? {};
  return {
    metric: input.metric,
    horizon,
    narrative: parsed.narrative ?? '',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
    series: Array.isArray(parsed.series) ? parsed.series : [],
    generatedAt: new Date().toISOString(),
    model: env.AI_MODEL,
  };
}

export async function detectAnomalies(orgId: string) {
  const [overview, inq] = await Promise.all([getOverviewData(orgId), getInquiriesData(orgId)]);
  const prompt = `Haqiqiy mahalla ma'lumotlari:
overview: ${JSON.stringify(overview)}
inquiries: ${JSON.stringify(inq)}

Ushbu ko'rsatkichlarda e'tibor talab qiladigan g'ayritabiiy holatlarni aniqla (masalan muddati o'tgan murojaatlar ko'pligi, past reyting, va h.k.).
Faqat JSON: {"items":[{"id":"a1","severity":"low|medium|high|critical","scope":"...","title":"...","description":"...","metric":"...","value":"...","expected":"...","detectedAt":"${new Date().toISOString()}"}]}
Anomaliya bo'lmasa: {"items":[]}`;
  const raw = await chatOnce({ messages: [{ role: 'user', content: prompt }], json: true });
  const parsed = parseJson<any>(raw.content) ?? {};
  return {
    items: Array.isArray(parsed.items) ? parsed.items : [],
    generatedAt: new Date().toISOString(),
    model: env.AI_MODEL,
  };
}
