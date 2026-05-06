const { methodNotAllowed, readJsonBody, sendJson } = require("./_lib/http");
const { insertEvent, isSupabaseConfigured, upsertLead } = require("./_lib/supabase");

function cleanString(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response);

  try {
    const body = await readJsonBody(request);
    const sessionId = cleanString(body.sessionId, 120);

    if (!sessionId) {
      return sendJson(response, 400, { error: "Missing sessionId." });
    }

    if (!isSupabaseConfigured()) {
      return sendJson(response, 202, { saved: false, reason: "Supabase is not configured." });
    }

    const now = new Date().toISOString();
    const lead = {
      session_id: sessionId,
      source: "landing-ciberseguridad",
      name: cleanString(body.name, 160) || null,
      email: cleanString(body.email, 220).toLowerCase() || null,
      phone: cleanString(body.phone, 80) || null,
      status: cleanString(body.status, 80) || "qualified",
      score: Math.max(0, Math.min(100, Number(body.score || 0))),
      updated_at: now,
    };

    await upsertLead(lead);
    await insertEvent({
      session_id: sessionId,
      event_type: "lead_capture",
      payload: {
        hasEmail: Boolean(lead.email),
        hasPhone: Boolean(lead.phone),
        score: lead.score,
      },
      created_at: now,
    });

    return sendJson(response, 200, { saved: true });
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: "Could not save lead." });
  }
};
