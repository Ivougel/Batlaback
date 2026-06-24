/**
 * Сворачиваемый блок (accordion) для DOM.
 */

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

function renderAccordions(containerEl, sections) {
  if (!containerEl) return;
  containerEl.innerHTML = "";
  sections.forEach(({ title, html, open, getCopyText }) => {
    containerEl.appendChild(createAccordionSection(title, html, open === true, { getCopyText }));
  });
}
