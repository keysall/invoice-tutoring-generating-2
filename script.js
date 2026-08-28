// ============ State ============
const STORAGE_KEY = "invoiceGeneratorState";

// Each item row: date (session date), desc (subject/session tutor), note,
// price (fee tutor), additionalFee. No per-row subtotal anymore — only a
// single grand Total Fee at the bottom of the table.
let items = [
  { date: "", desc: "Math: Functions", note: "", price: 100000, additionalFee: 0 },
];
let qrisDataUrl = null;

// ============ Helpers ============
function formatRupiah(n) {
  n = Number(n) || 0;
  return "Rp" + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

// Invoice header date = billing month (input type="month" gives "YYYY-MM").
function formatDateEN(monthStr) {
  if (!monthStr) return "—";
  const d = new Date(monthStr + "-01T00:00:00");
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Per-session date (input type="date"). en-GB locale gives "Tuesday, 18 August 2026"
// (day before month), matching the original design.
function formatSessionDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function el(id) { return document.getElementById(id); }

// ============ Cache (localStorage) ============
function collectState() {
  return {
    fromName: el("fromName").value,
    fromContact: el("fromContact").value,
    clientName: el("clientName").value,
    invoiceNumber: el("invoiceNumber").value,
    invoiceDate: el("invoiceDate").value,
    bankName: el("bankName").value,
    bankAccount: el("bankAccount").value,
    bankHolder: el("bankHolder").value,
    closingNote: el("closingNote").value,
    items: items,
    qrisDataUrl: qrisDataUrl,
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
  } catch (e) {
    console.warn("Failed saving cache:", e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const state = JSON.parse(raw);
    el("fromName").value = state.fromName ?? el("fromName").value;
    el("fromContact").value = state.fromContact ?? "";
    el("clientName").value = state.clientName ?? "";
    el("invoiceNumber").value = state.invoiceNumber ?? "";
    el("invoiceDate").value = state.invoiceDate ?? new Date().toISOString().slice(0, 7);
    el("bankName").value = state.bankName ?? "";
    el("bankAccount").value = state.bankAccount ?? "";
    el("bankHolder").value = state.bankHolder ?? "";
    el("closingNote").value = state.closingNote ?? el("closingNote").value;
    if (Array.isArray(state.items) && state.items.length) items = state.items;
    qrisDataUrl = state.qrisDataUrl || null;
    if (qrisDataUrl) el("removeQrisBtn").hidden = false;
    return true;
  } catch (e) {
    console.warn("Failed to load cache:", e);
    return false;
  }
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

// ============ Line items (form side) ============
// Row fields: date | desc (subject) | note | price (fee tutor) | additionalFee
function renderItemRows() {
  const list = el("itemsList");
  list.innerHTML = "";
  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <input type="date" data-idx="${idx}" data-field="date" value="${escapeAttr(item.date || "")}">
      <input type="text" data-idx="${idx}" data-field="desc" placeholder="Subject / session tutor" value="${escapeAttr(item.desc)}">
      <input type="text" data-idx="${idx}" data-field="note" placeholder="Note" value="${escapeAttr(item.note || "")}">
      <input type="number" min="0" step="1000" data-idx="${idx}" data-field="price" value="${item.price}">
      <input type="number" min="0" step="1000" data-idx="${idx}" data-field="additionalFee" value="${item.additionalFee || 0}">
      <button type="button" class="item-remove" data-idx="${idx}" aria-label="Remove row">
        <i class="ti ti-trash" aria-hidden="true"></i>
      </button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      const isText = field === "desc" || field === "note" || field === "date";
      items[idx][field] = isText ? e.target.value : Number(e.target.value);
      renderPreview();
    });
  });
  list.querySelectorAll(".item-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.currentTarget.dataset.idx);
      items.splice(idx, 1);
      renderItemRows();
      renderPreview();
    });
  });
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : str;
  return d.innerHTML;
}

el("addItemBtn").addEventListener("click", () => {
  items.push({ date: "", desc: "", note: "", price: 0, additionalFee: 0 });
  renderItemRows();
  renderPreview();
});

// ============ QRIS upload ============
el("qrisUpload").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    qrisDataUrl = reader.result;
    el("removeQrisBtn").hidden = false;
    renderPreview();
  };
  reader.readAsDataURL(file);
});
el("removeQrisBtn").addEventListener("click", () => {
  qrisDataUrl = null;
  el("qrisUpload").value = "";
  el("removeQrisBtn").hidden = true;
  renderPreview();
});

// ============ Preview render ============
function renderPreview() {
  el("prevFromName").textContent = el("fromName").value || "—";
  el("prevClientName").textContent = el("clientName").value || "—";
  el("prevInvoiceNumber").textContent = el("invoiceNumber").value
    ? "Invoice No: " + el("invoiceNumber").value
    : "—";
  el("prevDate").textContent = formatDateEN(el("invoiceDate").value);

  // items — table: No | Date | Subject | Note | Fee Tutor | Additional Fee
  const body = el("prevItemsBody");
  body.innerHTML = "";

  let total = 0;
  items.forEach((item, i) => {
    total += (Number(item.price) || 0) + (Number(item.additionalFee) || 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${formatSessionDate(item.date)}</td>
      <td>${escapeHtml(item.desc) || "—"}</td>
      <td>${escapeHtml(item.note) || "—"}</td>
      <td class="num">${formatRupiah(item.price)}</td>
      <td class="num">${formatRupiah(item.additionalFee || 0)}</td>
    `;
    body.appendChild(tr);
  });

  el("prevTotal").textContent = formatRupiah(total);

  // payment
  const bank = el("bankName").value;
  const bankAcc = el("bankAccount").value;
  const bankHolder = el("bankHolder").value;
  const optionsWrap = el("paymentOptions");
  optionsWrap.innerHTML = "";

  const hasQris = !!qrisDataUrl;
  const hasBank = bank || bankAcc || bankHolder;

  if (!hasQris && !hasBank) {
    optionsWrap.innerHTML = `<div class="payment-empty">No payment method has been added yet.</div>`;
  } else {
    if (hasQris) {
      const block = document.createElement("div");
      block.className = "payment-block";
      block.innerHTML = `
        <img src="${qrisDataUrl}" alt="QRIS" class="qris-thumb">
        <div class="payment-text">
          <div class="payment-title">QRIS</div>
          Scan to pay
        </div>
      `;
      optionsWrap.appendChild(block);
    }
    if (hasBank) {
      const block = document.createElement("div");
      block.className = "payment-block";
      block.innerHTML = `
        <div class="payment-text">
          <div class="payment-title">Bank Transfer</div>
          ${escapeHtml(bank)} ${escapeHtml(bankAcc)}<br>
          Account holder: ${escapeHtml(bankHolder)}
        </div>
      `;
      optionsWrap.appendChild(block);
    }
  }

  // footer
  el("prevClosingNote").textContent = el("closingNote").value || "—";
  el("prevContact").textContent = el("fromContact").value || "";
  el("prevSignature").textContent = el("fromName").value || "—";

  saveState();
}

// ============ Wire up live inputs ============
[
  "fromName", "fromContact", "clientName", "invoiceNumber", "invoiceDate",
  "bankName", "bankAccount", "bankHolder", "closingNote",
].forEach((id) => {
  el(id).addEventListener("input", renderPreview);
});

// ============ Load cache (if any), fallback to current month ============
const hadSavedState = loadState();
if (!hadSavedState) {
  el("invoiceDate").value = new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

el("clearCacheBtn").addEventListener("click", () => {
  if (confirm("Delete all data saved from this browser?")) clearState();
});

// ============ PDF export ============
// Always exports on real A4 paper size. If the invoice content is taller
// than one A4 page (e.g. ~10+ session rows), it automatically continues
// onto page 2, 3, etc. — text stays full-size, it never shrinks to fit.
el("downloadBtn").addEventListener("click", async () => {
  const btn = el("downloadBtn");
  const originalLabel = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "Preparing PDF...";

  try {
    const sheet = el("invoiceSheet");
    // windowWidth/Height forces html2canvas to capture the sheet's full
    // natural size, regardless of the current browser/phone viewport —
    // this is what keeps the PDF looking like the desktop layout even
    // when exporting from a phone.
    const canvas = await html2canvas(sheet, {
      scale: 2,
      backgroundColor: "#ffffff",
      windowWidth: sheet.scrollWidth,
      windowHeight: sheet.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;

    const pxToMm = contentWidth / canvas.width;
    const scaledHeightMm = canvas.height * pxToMm;

    if (scaledHeightMm <= contentHeight) {
      // Fits on a single A4 page.
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, contentWidth, scaledHeightMm);
    } else {
      // Content is longer than one page — slice it into multiple A4 pages.
      const pageHeightPx = contentHeight / pxToMm;
      let renderedPx = 0;
      let pageIndex = 0;

      while (renderedPx < canvas.height) {
        const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightPx;
        pageCanvas.getContext("2d").drawImage(
          canvas,
          0, renderedPx, canvas.width, sliceHeightPx,
          0, 0, canvas.width, sliceHeightPx
        );

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", margin, margin, contentWidth, sliceHeightPx * pxToMm);

        renderedPx += sliceHeightPx;
        pageIndex++;
      }
    }

    const fileName = (el("invoiceNumber").value || "invoice").replace(/[^\w-]+/g, "_");
    pdf.save(`${fileName}.pdf`);
  } catch (err) {
    console.error(err);
    alert("Failed to make PDF. Please try again.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalLabel;
  }
});

// ============ Init ============
renderItemRows();
renderPreview();
