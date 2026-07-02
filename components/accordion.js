/**
 * Сворачиваемый блок (accordion) и pop-up деталей для DOM.
 */

let detailPopupCopyFn = null;
let detailPopupBound = false;

function isDetailPopupOpen() {
  const el = document.getElementById("battle-detail-overlay");
  return !!(el && !el.classList.contains("hidden"));
}

function bindDetailPopupOnce() {
  if (detailPopupBound) return;
  detailPopupBound = true;

  document.getElementById("btn-battle-detail-close")?.addEventListener("click", hideDetailPopup);
  document.getElementById("battle-detail-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "battle-detail-overlay") hideDetailPopup();
  });
  document.getElementById("btn-battle-detail-copy")?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const text = detailPopupCopyFn?.();
    if (!text) return;
    const btn = document.getElementById("btn-battle-detail-copy");
    const ok = await copyTextToClipboard(text);
    if (ok && btn) {
      btn.textContent = "✓";
      btn.classList.add("copied");
      window.setTimeout(() => {
        btn.textContent = "📋";
        btn.classList.remove("copied");
      }, 1500);
    }
  });
}

function showDetailPopup(title, bodyHtml, getCopyText) {
  bindDetailPopupOnce();
  const overlay = document.getElementById("battle-detail-overlay");
  const titleEl = document.getElementById("battle-detail-title");
  const bodyEl = document.getElementById("battle-detail-body");
  const copyBtn = document.getElementById("btn-battle-detail-copy");
  if (!overlay || !titleEl || !bodyEl) return;

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  overlay.querySelector(".battle-detail-modal")
    ?.classList.toggle("battle-detail-modal--item-stats", !!bodyEl.querySelector(".is-meter-table"));
  detailPopupCopyFn = typeof getCopyText === "function" ? getCopyText : null;
  if (copyBtn) {
    copyBtn.classList.toggle("hidden", !detailPopupCopyFn);
  }

  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  if (typeof applyUiLayout === "function") applyUiLayout();
}

function hideDetailPopup() {
  const overlay = document.getElementById("battle-detail-overlay");
  overlay?.classList.add("hidden");
  overlay?.setAttribute("aria-hidden", "true");
  detailPopupCopyFn = null;
  const bodyEl = document.getElementById("battle-detail-body");
  bodyEl.innerHTML = "";
  overlay?.querySelector(".battle-detail-modal")?.classList.remove("battle-detail-modal--item-stats");
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  if (typeof applyUiLayout === "function") applyUiLayout();
}

function createAccordionSection(title, bodyHtml, openByDefault = false, options = {}) {
  const { getCopyText } = options;
  const section = document.createElement("div");
  section.className = "accordion-section" + (openByDefault ? " open" : "");

  const headerRow = document.createElement("div");
  headerRow.className = "accordion-header-row";

  const header = document.createElement("button");
  header.type = "button";
  header.className = "accordion-header";
  header.innerHTML = `<span class="accordion-title">${title}</span><span class="accordion-chevron">▼</span>`;

  header.addEventListener("click", () => {
    section.classList.toggle("open");
  });

  headerRow.appendChild(header);

  if (typeof getCopyText === "function") {
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "accordion-copy-btn";
    copyBtn.title = "Копировать";
    copyBtn.setAttribute("aria-label", "Копировать");
    copyBtn.textContent = "📋";
    copyBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = getCopyText();
      if (!text) return;
      const ok = await copyTextToClipboard(text);
      if (ok) {
        copyBtn.textContent = "✓";
        copyBtn.classList.add("copied");
        window.setTimeout(() => {
          copyBtn.textContent = "📋";
          copyBtn.classList.remove("copied");
        }, 1500);
      }
    });
    headerRow.appendChild(copyBtn);
  }

  const body = document.createElement("div");
  body.className = "accordion-body";
  body.innerHTML = bodyHtml;

  section.appendChild(headerRow);
  section.appendChild(body);
  return section;
}

function createStaticResultBlock(title, bodyHtml) {
  const block = document.createElement("div");
  block.className = "result-static-block";
  block.innerHTML = `
    <div class="result-static-block-title">${title}</div>
    <div class="result-static-block-body">${bodyHtml}</div>
  `;
  return block;
}

function bindTapActivate(el, handler) {
  let lastTouchAt = 0;
  el.addEventListener("touchend", (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    lastTouchAt = Date.now();
    handler(e);
  }, { passive: false });
  el.addEventListener("click", (e) => {
    if (Date.now() - lastTouchAt < 400) {
      e.preventDefault();
      return;
    }
    handler(e);
  });
}

function createPopupTriggerRow(title, popupTitle, bodyHtml, getCopyText) {
  const row = document.createElement("div");
  row.className = "popup-trigger-row";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "popup-trigger-btn battle-result-popup-trigger";
  btn.innerHTML = `<span class="popup-trigger-title">${title}</span><span class="popup-trigger-chevron" aria-hidden="true">›</span>`;
  bindTapActivate(btn, () => {
    showDetailPopup(popupTitle || title, bodyHtml, getCopyText);
  });

  row.appendChild(btn);

  if (typeof getCopyText === "function") {
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "popup-trigger-copy-btn";
    copyBtn.title = "Копировать";
    copyBtn.setAttribute("aria-label", "Копировать");
    copyBtn.textContent = "📋";
    bindTapActivate(copyBtn, async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = getCopyText();
      if (!text) return;
      const ok = await copyTextToClipboard(text);
      if (ok) {
        copyBtn.textContent = "✓";
        copyBtn.classList.add("copied");
        window.setTimeout(() => {
          copyBtn.textContent = "📋";
          copyBtn.classList.remove("copied");
        }, 1500);
      }
    });
    row.appendChild(copyBtn);
  }

  return row;
}

function renderAccordions(containerEl, sections) {
  if (!containerEl) return;
  containerEl.innerHTML = "";
  sections.forEach(({ title, html, open, getCopyText }) => {
    containerEl.appendChild(createAccordionSection(title, html, open === true, { getCopyText }));
  });
}

function renderBattleResultPanel(containerEl, sections) {
  if (!containerEl) return;
  containerEl.innerHTML = "";
  sections.forEach((section) => {
    if (section.type === "static") {
      containerEl.appendChild(createStaticResultBlock(section.title, section.html));
    } else if (section.type === "popup") {
      containerEl.appendChild(createPopupTriggerRow(
        section.title,
        section.popupTitle || section.title,
        section.html,
        section.getCopyText,
      ));
    } else {
      containerEl.appendChild(createAccordionSection(section.title, section.html, section.open === true, {
        getCopyText: section.getCopyText,
      }));
    }
  });
}
