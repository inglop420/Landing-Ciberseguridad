const { methodNotAllowed, readJsonBody, sendJson } = require("./_lib/http");
const { insertEvent, isSupabaseConfigured } = require("./_lib/supabase");

function cleanString(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response);

  try {
    const body = await readJsonBody(request);
    const sessionId = cleanString(body.sessionId, 120);
    const eventType = cleanString(body.eventType, 100);

    if (!sessionId || !eventType) {
      return sendJson(response, 400, { error: "Missing sessionId or eventType." });
    }

    if (!isSupabaseConfigured()) {
      return sendJson(response, 202, { saved: false, reason: "Supabase is not configured." });
    }

    await insertEvent({
      session_id: sessionId,
      event_type: eventType,
      payload: body.payload || {},
      created_at: new Date().toISOString(),
    });

    return sendJson(response, 200, { saved: true });
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: "Could not save event." });
  }
};
