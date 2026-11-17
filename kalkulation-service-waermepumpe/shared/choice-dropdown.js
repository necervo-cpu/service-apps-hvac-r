/**
 * Auswahl-Dropdown und mittige Zahlenfelder (Vorlage, Design-Stand 2026-11-18)
 * In shared.js des Projekts übernehmen und im DOMContentLoaded-Handler aufrufen:
 *   initChoiceDropdowns();  initUnitPadding();
 *
 * Regel: Mehr als 3 Optionen oder Optionen, die breiter sind als der Bildschirm, erscheinen als Dropdown.
 * Die Original-Schaltflächen (.tab-strip, .segmented-control) bleiben versteckt bestehen und werden bei
 * Änderung angeklickt, die App-Logik bleibt unverändert. Ausnahmen:
 *   data-choice-keep    Container bleibt immer als Pill-Zeile (z. B. Abschnitte eines Formulars mit Haken).
 *   data-choice-action  Schnellwahl: Das Dropdown zeigt den Hinweistext statt des aktuellen Werts, die Wahl
 *                       löst den Klick aus (z. B. "Typische Spreizung wählen" unter einem Zahlenfeld).
 * CSS: .choice-select, .choice-select--action und die Zahlenfeld-Regeln stehen in liquid-glass-tokens.css.
 */
export const CHOICE_SELECTOR = ".tab-strip:not([data-choice-keep]), .segmented-control:not([data-choice-keep])";
const choiceFields = new WeakMap();

function choiceLabel(btn) {
  const clone = btn.cloneNode(true);
  clone.querySelectorAll(".material-symbols-rounded").forEach((n) => n.remove());
  return clone.textContent.replace(/\s+/g, " ").trim();
}

function choiceActiveIndex(buttons) {
  return buttons.findIndex(
    (b) => b.getAttribute("aria-selected") === "true" || b.getAttribute("aria-pressed") === "true",
  );
}

function syncChoice(container) {
  const buttons = Array.from(container.querySelectorAll("button"));
  let field = choiceFields.get(container);
  if (buttons.length < 2) {
    if (field) field.wrap.hidden = true;
    return;
  }

  let needDropdown = buttons.length > 3;
  if (!needDropdown && container.offsetParent !== null) {
    const wasHidden = container.hidden;
    container.hidden = false;
    needDropdown = container.scrollWidth > container.clientWidth + 1;
    container.hidden = wasHidden;
  } else if (!needDropdown && field && !field.wrap.hidden) {
    needDropdown = true;
  }

  if (!needDropdown) {
    container.hidden = false;
    if (field) field.wrap.hidden = true;
    return;
  }

  if (!field) {
    const wrap = document.createElement("div");
    wrap.className = container.dataset.choiceAction ? "choice-select choice-select--action" : "choice-select";
    const select = document.createElement("select");
    select.className = "choice-select-input";
    const label = container.getAttribute("aria-label");
    if (label) select.setAttribute("aria-label", label);
    const icon = document.createElement("span");
    icon.className = "material-symbols-rounded";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "expand_more";
    wrap.append(select, icon);
    container.after(wrap);
    select.addEventListener("change", () => {
      if (select.value === "") return;
      const current = Array.from(container.querySelectorAll("button"));
      const target = current[Number(select.value)];
      if (container.dataset.choiceAction) select.value = "";
      if (target) target.click();
    });
    field = { wrap, select, signature: "" };
    choiceFields.set(container, field);
  }

  const action = container.dataset.choiceAction || "";
  const labels = buttons.map(choiceLabel);
  const signature = `${action}\u0002${labels.join("\u0001")}`;
  if (field.signature !== signature) {
    field.signature = signature;
    const options = labels.map((text, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = text;
      return opt;
    });
    if (action) {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = action;
      options.unshift(placeholder);
    }
    field.select.replaceChildren(...options);
  }
  if (action) {
    if (field.select.value !== "") field.select.value = "";
  } else {
    const active = choiceActiveIndex(buttons);
    if (active >= 0 && field.select.value !== String(active)) field.select.value = String(active);
  }
  field.wrap.hidden = false;
  container.hidden = true;
}

function syncAllChoices() {
  document.querySelectorAll(CHOICE_SELECTOR).forEach(syncChoice);
}

/**
 * Zahlenfelder mit Einheit: gleicher Innenabstand links und rechts, damit der Wert mittig steht.
 */
function syncUnitPadding(wrapper) {
  const unit = wrapper.querySelector(".input-unit-addon");
  const input = wrapper.querySelector(".glass-input");
  if (!unit || !input) return;
  const pad = `${Math.ceil(unit.getBoundingClientRect().width) + 20}px`;
  input.style.paddingInline = pad;
}

export function initUnitPadding() {
  if (typeof ResizeObserver !== "function") return;
  const observer = new ResizeObserver((entries) => {
    entries.forEach((e) => {
      const wrapper = e.target.closest(".input-wrapper");
      if (wrapper) syncUnitPadding(wrapper);
    });
  });
  const attach = () => {
    document.querySelectorAll(".input-wrapper .input-unit-addon").forEach((u) => {
      if (u.dataset.padBound) return;
      u.dataset.padBound = "true";
      observer.observe(u);
    });
  };
  attach();
  new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
}

export function initChoiceDropdowns() {
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      syncAllChoices();
    });
  };
  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-selected", "aria-pressed", "class"],
  });
  window.addEventListener("resize", schedule);
  syncAllChoices();
}

