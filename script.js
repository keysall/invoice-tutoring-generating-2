// ============ State ============
let items = [
  { desc: "Math: Functions", qty: 1, price: 100000 },
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

// ============ Line items (form side) ============
function renderItemRows() {
  const list = el("itemsList");
  list.innerHTML = "";
  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <input type="text" data-idx="${idx}" data-field="desc" placeholder="Deskripsi sesi" value="${escapeAttr(item.desc)}">
      <input type="number" min="0" step="1" data-idx="${idx}" data-field="qty" value="${item.qty}">
      <input type="number" min="0" step="1000" data-idx="${idx}" data-field="price" value="${item.price}">
      <button type="button" class="item-remove" data-idx="${idx}" aria-label="Hapus baris">
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
  items.push({ desc: "", qty: 1, price: 0 });
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
  let total = 0;
  items.forEach((item, i) => {
    const subtotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
    total += subtotal;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(item.desc) || "—"}</td>
      <td class="num">${item.qty || 0}</td>
      <td class="num">${formatRupiah(item.price)}</td>
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
    optionsWrap.innerHTML = `<div class="payment-empty">Belum ada metode pembayaran diisi.</div>`;
  } else {
    if (hasQris) {
      const block = document.createElement("div");
      block.className = "payment-block";
      block.innerHTML = `
        <img src="${qrisDataUrl}" alt="QRIS" class="qris-thumb">
        <div class="payment-text">
          <div class="payment-title">QRIS</div>
          Scan untuk bayar
        </div>
      `;
      optionsWrap.appendChild(block);
    }
    if (hasBank) {
      const block = document.createElement("div");
      block.className = "payment-block";
      block.innerHTML = `
        <div class="payment-text">
          <div class="payment-title">Transfer bank</div>
          ${escapeHtml(bank)} ${escapeHtml(bankAcc)}<br>
          a.n. ${escapeHtml(bankHolder)}
        </div>
      `;
      optionsWrap.appendChild(block);
    }
  }

  // footer
  el("prevClosingNote").textContent = el("closingNote").value || "—";
  el("prevContact").textContent = el("fromContact").value || "";
  el("prevSignature").textContent = el("fromName").value || "—";
}

// ============ Wire up live inputs ============
[
  "fromName", "fromContact", "clientName", "invoiceNumber", "invoiceDate",
  "bankName", "bankAccount", "bankHolder", "closingNote",
].forEach((id) => {
  el(id).addEventListener("input", renderPreview);
});

// ============ Default date = today ============
el("invoiceDate").value = new Date().toISOString().slice(0, 10);

// ============ PDF export ============
el("downloadBtn").addEventListener("click", async () => {
  const btn = el("downloadBtn");
  const originalLabel = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "Menyiapkan PDF...";

  try {
    const sheet = el("invoiceSheet");
    const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "px", format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);

    const fileName = (el("invoiceNumber").value || "invoice").replace(/[^\w-]+/g, "_");
    pdf.save(`${fileName}.pdf`);
  } catch (err) {
    console.error(err);
    alert("Gagal membuat PDF. Coba lagi.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalLabel;
  }
});

// ============ Init ============
renderItemRows();
renderPreview();
