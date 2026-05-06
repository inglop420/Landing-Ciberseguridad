const HOT_WORDS = [
  "comprar",
  "inscrib",
  "pagar",
  "precio",
  "costo",
  "garantia",
  "garantía",
  "hotmart",
  "acceso",
  "cupos",
  "descuento",
  "hoy",
  "ahora",
];

const OBJECTION_PATTERNS = [
  { key: "price", words: ["caro", "dinero", "presupuesto", "precio", "costo"] },
  { key: "time", words: ["tiempo", "duracion", "duración", "horario"] },
  { key: "trust", words: ["confio", "confío", "real", "estafa", "garantia", "garantía"] },
  { key: "fit", words: ["principiante", "avanzado", "nivel", "sirve para"] },
  { key: "access", words: ["acceso", "plataforma", "hotmart", "recibo"] },
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectObjections(text) {
  const normalized = normalizeText(text);
  return OBJECTION_PATTERNS.filter((pattern) =>
    pattern.words.some((word) => normalized.includes(normalizeText(word)))
  ).map((pattern) => pattern.key);
}

function scoreLead({ message = "", reply = "", existingScore = 0, turnCount = 1 }) {
  const normalizedMessage = normalizeText(message);
  const normalizedReply = normalizeText(reply);
  const combined = `${normalizedMessage} ${normalizedReply}`;
  const matchedHotWords = HOT_WORDS.filter((word) =>
    combined.includes(normalizeText(word))
  );
  const objections = detectObjections(message);

  let score = Math.max(0, Number(existingScore) || 0);
  score += Math.min(35, matchedHotWords.length * 7);
  score += Math.min(20, turnCount * 4);
  if (objections.length > 0) score += 10;
  if (normalizedMessage.includes("?")) score += 5;
  if (normalizedMessage.length > 80) score += 5;

  score = Math.max(0, Math.min(100, score));

  let status = "new";
  let nextAction = "answer";

  if (score >= 75) {
    status = "hot";
    nextAction = "hotmart";
  } else if (score >= 45) {
    status = "qualified";
    nextAction = "capture_lead";
  } else if (objections.length > 0) {
    status = "needs_followup";
    nextAction = "handle_objection";
  }

  return {
    objections,
    score,
    status,
    nextAction,
  };
}

module.exports = {
  scoreLead,
};
