// ============ State ============
const STORAGE_KEY = "invoiceGeneratorState";

let items = [
  { desc: "Math: Functions", note: "", qty: 1, price: 100000, additionalFee: 0 },
];
let qrisDataUrl = null;

// ============ Helpers ============
function formatRupiah(n) {
  n = Number(n) || 0;
  return "Rp" + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

function formatDateID(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
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
    el("invoiceDate").value = state.invoiceDate ?? new Date().toISOString().slice(0, 10);
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

// ============ Line items (form side) RENDERRR BOSS ============
function renderItemRows() {
  const list = el("itemsList");
  list.innerHTML = "";
  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <input type="text" data-idx="${idx}" data-field="desc" placeholder="Session description" value="${escapeAttr(item.desc)}">
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
      const val = field === "desc" ? e.target.value : Number(e.target.value);
      items[idx][field] = val;
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
  items.push({ desc: "", note:"", qty: 1, price: 0, additionalFee: 0 });
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
  el("prevDate").textContent = formatDateID(el("invoiceDate").value);

  // items
  const body = el("prevItemsBody");
  body.innerHTML = "";
  
  // preview renderrr 
  let total = 0;
  items.forEach((item, i) => {
    const subtotal = (Number(item.price) || 0) + (Number(item.additionalFee) || 0);
    total += subtotal;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(item.desc) || "—"}</td>
      <td>${escapeHtml(item.note) || "—"}</td>
      <td class="num">${formatRupiah(item.price)}</td>
      <td class="num">${formatRupiah(item.additionalFee || 0)}</td>
      <td class="num">${formatRupiah(subtotal)}</td>
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
          Account holder:  ${escapeHtml(bankHolder)}
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

// ============ Load cache (jika ada), fallback ke tanggal hari ini ============
const hadSavedState = loadState();
if (!hadSavedState) {
  el("invoiceDate").value = new Date().toISOString().slice(0, 10);
}

el("clearCacheBtn").addEventListener("click", () => {
  if (confirm("Delete all data was saved from this web?")) clearState();
});

// ============ PDF export ============
el("downloadBtn").addEventListener("click", async () => {
  const btn = el("downloadBtn");
  const originalLabel = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "Prepare PDF...";

  try {
    const sheet = el("invoiceSheet");
    const canvas = await html2canvas(sheet, {
      scale: 2,
      backgroundColor: "#ffffff",
      windowWidth: sheet.scrollWidth,
      windowHeight: sheet.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    });
    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "px", format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);

    const fileName = (el("invoiceNumber").value || "invoice").replace(/[^\w-]+/g, "_");
    pdf.save(`${fileName}.pdf`);
  } catch (err) {
    console.error(err);
    alert("failed to make PDF. Please try again :(.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalLabel;
  }
});

// ============ Init ============
renderItemRows();
renderPreview();
