const { methodNotAllowed, readJsonBody, sendJson } = require("./_lib/http");
const { scoreLead } = require("./_lib/lead-score");
const { insertEvent, insertMessage, isSupabaseConfigured, upsertLead } = require("./_lib/supabase");

const DEFAULT_HOTMART_URL = "https://pay.hotmart.com/V105422735Y?off=ykvzwja6";
const DEFAULT_MODE = "chat";

function cleanString(value, maxLength = 2000) {
  return String(value || "").trim().slice(0, maxLength);
}

function buildAnythingLlmUrl() {
  const baseUrl = process.env.ANYTHINGLLM_BASE_URL;
  const workspaceSlug = process.env.ANYTHINGLLM_WORKSPACE_SLUG;

  if (!baseUrl || !workspaceSlug) return null;

  return `${baseUrl.replace(/\/$/, "")}/api/v1/workspace/${encodeURIComponent(
    workspaceSlug
  )}/chat`;
}

function anythingLlmHeaders() {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (process.env.ANYTHINGLLM_API_KEY) {
    headers.Authorization = `Bearer ${process.env.ANYTHINGLLM_API_KEY}`;
  }

  if (
    process.env.CLOUDFLARE_ACCESS_CLIENT_ID &&
    process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET
  ) {
    headers["CF-Access-Client-Id"] = process.env.CLOUDFLARE_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] =
      process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET;
  }

  return headers;
}

function fallbackReply(message) {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    normalized.includes("precio") ||
    normalized.includes("costo") ||
    normalized.includes("cuanto") ||
    normalized.includes("cuesta")
  ) {
    return "El acceso de lanzamiento esta en $47 USD para los primeros cupos. El pago se realiza por Hotmart y el precio regular indicado en la landing es $147 USD.";
  }

  if (normalized.includes("garantia") || normalized.includes("devolucion")) {
    return "Tienes 7 dias de garantia por Hotmart. Si el curso no cumple tus expectativas, puedes solicitar la devolucion dentro de ese periodo.";
  }

  if (normalized.includes("principiante") || normalized.includes("nivel")) {
    return "El curso empieza por fundamentos de redes y avanza hacia hacking etico, respuesta operativa e IA. Si quieres aprender tomando decisiones con escenarios, es una buena entrada.";
  }

  if (normalized.includes("temario") || normalized.includes("modulo")) {
    return "El camino cubre blindaje de arquitectura de redes, fundamentos de ciberseguridad y hacking etico, ciclo del conflicto y cierre operativo, e IA proactiva y automatizacion.";
  }

  return "Puedo ayudarte con precio, garantia, temario, nivel recomendado y acceso por Hotmart. Si ya quieres asegurar tu lugar, te llevo directo al pago.";
}

async function askAnythingLlm({ message, sessionId }) {
  const url = buildAnythingLlmUrl();
  if (!url || !process.env.ANYTHINGLLM_API_KEY) {
    throw new Error("AnythingLLM is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: anythingLlmHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        message,
        mode: process.env.ANYTHINGLLM_MODE || DEFAULT_MODE,
        sessionId,
        reset: false,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.type === "abort") {
      throw new Error(payload.error || `AnythingLLM returned ${response.status}.`);
    }

    return {
      reply: cleanString(payload.textResponse, 5000),
      sources: Array.isArray(payload.sources) ? payload.sources : [],
      provider: "anythingllm",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function persistConversation({
  sessionId,
  message,
  reply,
  score,
  status,
  nextAction,
  objections,
  provider,
  sources,
}) {
  if (!isSupabaseConfigured()) return;

  const now = new Date().toISOString();
  const leadPayload = {
    session_id: sessionId,
    source: "landing-ciberseguridad",
    status,
    score,
    objections,
    last_message: message,
    last_reply: reply,
    last_provider: provider,
    next_action: nextAction,
    updated_at: now,
  };

  await upsertLead(leadPayload);

  await insertMessage({
    session_id: sessionId,
    role: "user",
    content: message,
    provider: "landing",
    created_at: now,
  });

  await insertMessage({
    session_id: sessionId,
    role: "assistant",
    content: reply,
    provider,
    score,
    metadata: { sources },
    created_at: now,
  });

  await insertEvent({
    session_id: sessionId,
    event_type: "chat_response",
    payload: { score, status, nextAction, objections, provider },
    created_at: now,
  });
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response);

  try {
    const body = await readJsonBody(request);
    const sessionId = cleanString(body.sessionId, 120);
    const message = cleanString(body.message, 2000);
    const turnCount = Number(body.turnCount || 1);
    const existingScore = Number(body.leadScore || 0);
    const hotmartUrl = process.env.HOTMART_URL || DEFAULT_HOTMART_URL;

    if (!sessionId) {
      return sendJson(response, 400, { error: "Missing sessionId." });
    }

    if (!message) {
      return sendJson(response, 400, { error: "Message is required." });
    }

    let provider = "fallback";
    let reply;
    let sources = [];

    try {
      const anything = await askAnythingLlm({ message, sessionId });
      reply = anything.reply || fallbackReply(message);
      sources = anything.sources;
      provider = anything.provider;
    } catch (error) {
      console.warn("AnythingLLM fallback:", error.message);
      reply = fallbackReply(message);
    }

    const lead = scoreLead({ message, reply, existingScore, turnCount });

    await persistConversation({
      sessionId,
      message,
      reply,
      score: lead.score,
      status: lead.status,
      nextAction: lead.nextAction,
      objections: lead.objections,
      provider,
      sources,
    }).catch((error) => {
      console.warn("Supabase persistence skipped:", error.message);
    });

    return sendJson(response, 200, {
      reply,
      leadScore: lead.score,
      leadStatus: lead.status,
      nextAction: lead.nextAction,
      objections: lead.objections,
      hotmartUrl,
      provider,
      sources,
    });
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, {
      error: "No pude procesar el mensaje en este momento.",
      reply: "Estoy teniendo problemas para conectar con el agente. Puedes asegurar tu acceso directamente por Hotmart.",
      hotmartUrl: process.env.HOTMART_URL || DEFAULT_HOTMART_URL,
    });
  }
};
