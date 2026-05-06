(function () {
  const HOTMART_URL = "https://pay.hotmart.com/V105422735Y?off=ykvzwja6";
  const STORAGE_KEY = "cpaia_sales_agent_session";
  const SCORE_KEY = "cpaia_sales_agent_score";
  const container = document.getElementById("openclaw-widget-container");

  if (!container) return;

  const state = {
    isOpen: false,
    isBusy: false,
    leadScore: Number(localStorage.getItem(SCORE_KEY) || 0),
    turnCount: 0,
    sessionId: getSessionId(),
  };

  function getSessionId() {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const value =
      "lead_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10);
    localStorage.setItem(STORAGE_KEY, value);
    return value;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function render() {
    container.innerHTML = `
      <button class="sales-agent-launcher" type="button" aria-label="Abrir asesor IA">
        <span>AI</span>
      </button>
      <section class="sales-agent-panel sales-agent-hidden" aria-label="Asesor IA de ventas">
        <header class="sales-agent-header">
          <div class="sales-agent-title">
            <strong>Asesor IA</strong>
            <span>Ciberseguridad Proactiva e IA</span>
          </div>
          <button class="sales-agent-close" type="button" aria-label="Cerrar chat">x</button>
        </header>
        <div class="sales-agent-body" data-agent-body></div>
        <footer class="sales-agent-footer">
          <div class="sales-agent-lead-form sales-agent-hidden" data-lead-form>
            <label>Te puedo guardar el enlace y tus dudas. Correo requerido; telefono opcional.</label>
            <div class="sales-agent-lead-row">
              <input class="sales-agent-input" data-lead-name placeholder="Nombre">
              <input class="sales-agent-input" data-lead-email placeholder="Email">
            </div>
            <div class="sales-agent-lead-row">
              <input class="sales-agent-input" data-lead-phone placeholder="WhatsApp opcional">
              <button class="sales-agent-save" type="button" data-lead-save>Guardar</button>
            </div>
          </div>
          <a class="sales-agent-buy sales-agent-hidden" href="${HOTMART_URL}" target="_blank" rel="noopener" data-buy-link>Acceder por Hotmart</a>
          <form class="sales-agent-compose" data-agent-form>
            <textarea class="sales-agent-textbox" data-agent-input placeholder="Escribe tu duda sobre el curso..." rows="1"></textarea>
            <button class="sales-agent-send" type="submit">Enviar</button>
          </form>
          <div class="sales-agent-meta" data-agent-meta></div>
        </footer>
      </section>
    `;

    bindEvents();
    addAssistantMessage(
      "Hola. Soy el asesor IA del curso. Puedo ayudarte con precio, garantia, temario, nivel recomendado y acceso por Hotmart."
    );
    renderChips([
      "Cuanto cuesta?",
      "Me sirve si soy principiante?",
      "Que incluye el curso?",
      "Como funciona la garantia?",
    ]);
  }

  function bindEvents() {
    const launcher = container.querySelector(".sales-agent-launcher");
    const close = container.querySelector(".sales-agent-close");
    const form = container.querySelector("[data-agent-form]");
    const input = container.querySelector("[data-agent-input]");
    const saveLead = container.querySelector("[data-lead-save]");
    const buyLink = container.querySelector("[data-buy-link]");

    launcher.addEventListener("click", openPanel);
    close.addEventListener("click", closePanel);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      sendMessage(input.value);
      input.value = "";
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    saveLead.addEventListener("click", captureLead);
    buyLink.addEventListener("click", function () {
      trackEvent("clicked_hotmart", { score: state.leadScore });
    });

    document.querySelectorAll('a[href*="hotmart"], a[href*="pay.hotmart"]').forEach((link) => {
      link.addEventListener("click", function () {
        trackEvent("clicked_hotmart_existing_cta", {
          href: link.href,
          score: state.leadScore,
        });
      });
    });
  }

  function openPanel() {
    state.isOpen = true;
    container.querySelector(".sales-agent-panel").classList.remove("sales-agent-hidden");
    container.querySelector(".sales-agent-launcher").classList.add("sales-agent-hidden");
    trackEvent("opened_widget", { score: state.leadScore });
  }

  function closePanel() {
    state.isOpen = false;
    container.querySelector(".sales-agent-panel").classList.add("sales-agent-hidden");
    container.querySelector(".sales-agent-launcher").classList.remove("sales-agent-hidden");
  }

  function bodyEl() {
    return container.querySelector("[data-agent-body]");
  }

  function metaEl() {
    return container.querySelector("[data-agent-meta]");
  }

  function scrollToBottom() {
    const body = bodyEl();
    body.scrollTop = body.scrollHeight;
  }

  function addMessage(role, text) {
    const message = document.createElement("div");
    message.className = `sales-agent-message ${role}`;
    message.innerHTML = escapeHtml(text);
    bodyEl().appendChild(message);
    scrollToBottom();
  }

  function addAssistantMessage(text) {
    addMessage("assistant", text);
  }

  function addUserMessage(text) {
    addMessage("user", text);
  }

  function renderChips(items) {
    const wrap = document.createElement("div");
    wrap.className = "sales-agent-chips";
    items.forEach((item) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sales-agent-chip";
      chip.textContent = item;
      chip.addEventListener("click", () => sendMessage(item));
      wrap.appendChild(chip);
    });
    bodyEl().appendChild(wrap);
    scrollToBottom();
  }

  function setBusy(value) {
    state.isBusy = value;
    container.querySelector(".sales-agent-send").disabled = value;
    metaEl().textContent = value ? "Consultando agente RAG..." : "";
  }

  async function sendMessage(rawMessage) {
    const message = String(rawMessage || "").trim();
    if (!message || state.isBusy) return;

    state.turnCount += 1;
    addUserMessage(message);
    setBusy(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: state.sessionId,
          message,
          turnCount: state.turnCount,
          leadScore: state.leadScore,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Chat failed");

      state.leadScore = Number(payload.leadScore || state.leadScore || 0);
      localStorage.setItem(SCORE_KEY, String(state.leadScore));
      addAssistantMessage(payload.reply || fallbackReply(message));
      updateCommercialState(payload);
    } catch (error) {
      addAssistantMessage(fallbackReply(message));
      showBuyLink();
      metaEl().textContent = "Modo respaldo activo.";
    } finally {
      setBusy(false);
    }
  }

  function fallbackReply(message) {
    const text = message.toLowerCase();
    if (text.includes("precio") || text.includes("cuanto") || text.includes("costo")) {
      return "El acceso de lanzamiento es de $47 USD por Hotmart. Si quieres asegurar tu lugar, usa el boton de acceso.";
    }
    if (text.includes("garantia") || text.includes("devolucion")) {
      return "Hotmart respalda la compra con 7 dias de garantia. Puedes solicitar devolucion si el curso no cumple tus expectativas.";
    }
    return "Puedo ayudarte con precio, garantia, temario y nivel recomendado. Tambien puedes acceder directo por Hotmart.";
  }

  function updateCommercialState(payload) {
    if (payload.nextAction === "hotmart" || Number(payload.leadScore || 0) >= 70) {
      showBuyLink();
    }

    if (
      payload.nextAction === "capture_lead" ||
      payload.nextAction === "handle_objection" ||
      Number(payload.leadScore || 0) >= 45
    ) {
      showLeadForm();
    }

    if (payload.provider === "fallback") {
      metaEl().textContent = "Respuesta de respaldo. El agente RAG no esta disponible.";
    }
  }

  function showBuyLink() {
    container.querySelector("[data-buy-link]").classList.remove("sales-agent-hidden");
  }

  function showLeadForm() {
    container.querySelector("[data-lead-form]").classList.remove("sales-agent-hidden");
  }

  async function captureLead() {
    const name = container.querySelector("[data-lead-name]").value.trim();
    const email = container.querySelector("[data-lead-email]").value.trim();
    const phone = container.querySelector("[data-lead-phone]").value.trim();

    if (!email) {
      metaEl().textContent = "Escribe un email para guardar el seguimiento.";
      return;
    }

    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: state.sessionId,
          name,
          email,
          phone,
          score: state.leadScore,
          status: state.leadScore >= 70 ? "hot" : "qualified",
        }),
      });
      metaEl().textContent = "Listo. Quedo guardado tu interes.";
      container.querySelector("[data-lead-form]").classList.add("sales-agent-hidden");
      showBuyLink();
    } catch {
      metaEl().textContent = "No pude guardar tus datos ahora, pero puedes acceder por Hotmart.";
      showBuyLink();
    }
  }

  function trackEvent(eventType, payload) {
    const body = JSON.stringify({
      sessionId: state.sessionId,
      eventType,
      payload: payload || {},
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/event", new Blob([body], { type: "application/json" }));
      return;
    }

    fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(function () {});
  }

  render();
})();
