const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

async function supabaseRequest(path, options = {}) {
  if (!isSupabaseConfigured()) return { skipped: true };

  const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data && data.message
        ? data.message
        : `Supabase request failed with ${response.status}.`;
    throw new Error(message);
  }

  return { data, skipped: false };
}

async function upsertLead(lead) {
  return supabaseRequest("sales_leads?on_conflict=session_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([lead]),
  });
}

async function insertMessage(message) {
  return supabaseRequest("sales_messages", {
    method: "POST",
    body: JSON.stringify([message]),
  });
}

async function insertEvent(event) {
  return supabaseRequest("sales_events", {
    method: "POST",
    body: JSON.stringify([event]),
  });
}

module.exports = {
  insertEvent,
  insertMessage,
  isSupabaseConfigured,
  upsertLead,
};
