/* ============================================================
   app.js — บันทึกการขายล็อตเตอรี่
   ข้อมูลเก็บใน localStorage key: "lottery_records"
   ============================================================ */

'use strict';

// ── ข้อมูลชนิดและราคา ──────────────────────────────────────
const TYPES = {
  single: {
    label: 'ใบเดียว',
    chip: 'chip-single',
    prices: [90, 95, 100, 110, 120],
    highlight: 100,
    unit: 'ใบ',
    sheets: 1
  },
  set2: {
    label: 'ชุด 2 ใบ',
    chip: 'chip-set2',
    prices: [190, 200, 210, 220, 240],
    highlight: 200,
    unit: 'ชุด',
    sheets: 2
  },
  set5: {
    label: 'ชุด 5 ใบ',
    chip: 'chip-set5',
    prices: [600, 650, 700],
    highlight: 600,
    hasCustomPrice: true,
    unit: 'ชุด',
    sheets: 5
  },
  set10: {
    label: 'ชุด 10 ใบ',
    chip: 'chip-set10',
    prices: [2000, 2200, 2500],
    highlight: 2000,
    unit: 'ชุด',
    sheets: 10
  },
  custom: {
    label: 'อื่นๆ',
    chip: 'chip-custom',
    prices: [],
    highlight: null,
    hasCustomPrice: true,
    unit: 'ชุด',
    sheets: null
  }
};

// ── State ───────────────────────────────────────────────────
let state = {
  selectedLocation: null,
  selectedType: null,
  selectedPrice: null,
  qty: 1
};

let editingId = null;

// ── LocalStorage helpers ────────────────────────────────────
function loadRecords() {
  try { return JSON.parse(localStorage.getItem('lottery_records') || '[]'); }
  catch { return []; }
}

function saveRecords(records) {
  localStorage.setItem('lottery_records', JSON.stringify(records));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDatetime();
  updateHeaderDate();
  autoSelectLocation();
  renderTodaySummary();

  // History: เซ็ตวันเริ่มต้นเป็นวันนี้
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('history-date').value = today;

  // Attach custom price input
  const cp = document.getElementById('custom-price');
  if (cp) cp.addEventListener('input', calcTotal);
});

function toDateString(d) {
  return d.toISOString().slice(0, 10);
}

function initDatetime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  document.getElementById('sell-datetime').value = local.toISOString().slice(0, 16);
}

function updateHeaderDate() {
  const el = document.getElementById('header-date');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('th-TH', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
}

// ── Auto Location by Day/Time ────────────────────────────────
function getAutoLocation() {
  const now = new Date();
  const day = now.getDay(); // 0=อาทิตย์ 1-5=จันทร์-ศุกร์ 6=เสาร์
  const h = now.getHours();
  const m = now.getMinutes();
  const t = h + m / 60; // ชั่วโมงทศนิยม

  if (day >= 1 && day <= 5) {
    // จันทร์–ศุกร์
    if (t >= 8  && t < 15) return 'ปตท';
    if (t >= 15 && t < 20) return 'ตลาดซอย 17';
  } else if (day === 6) {
    // วันเสาร์
    if (t >= 7  && t < 10) return 'ตลาดพานทอง';
    if (t >= 10 && t < 15) return 'ปตท';
    if (t >= 15 && t < 20) return 'ตลาดซอย 17';
  } else if (day === 0) {
    // วันอาทิตย์
    if (t >= 4  && t < 10) return 'วัดหนองตำลึง';
    if (t >= 10 && t < 15) return 'ปตท';
    if (t >= 15 && t < 20) return 'ตลาดซอย 17';
  }
  return null;
}

function autoSelectLocation() {
  const loc = getAutoLocation();
  if (!loc) return;
  const btn = document.querySelector(`.loc-btn[data-loc="${loc}"]`);
  if (btn) selectLocation(btn);
}

// ── Page Navigation ─────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  const page = document.getElementById('page-' + name);
  if (page) {
    page.classList.remove('hidden');
    page.classList.add('active');
  }
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-btn[data-page="${name}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (name === 'summary') renderSummary();
  if (name === 'history') renderHistory();
}

// ── Location Selection ───────────────────────────────────────
function selectLocation(btn) {
  document.querySelectorAll('.loc-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  state.selectedLocation = btn.dataset.loc;

  const otherInput = document.getElementById('location-other');
  if (state.selectedLocation === 'อื่นๆ') {
    otherInput.classList.remove('hidden');
    otherInput.focus();
  } else {
    otherInput.classList.add('hidden');
    otherInput.value = '';
  }
}

// ── Type Selection ───────────────────────────────────────────
function selectType(btn) {
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  state.selectedType = btn.dataset.type;
  state.selectedPrice = null;

  const customSheets = document.getElementById('custom-sheets');
  if (state.selectedType === 'custom') {
    customSheets.classList.remove('hidden');
    customSheets.focus();
  } else {
    customSheets.classList.add('hidden');
  }

  renderPriceGrid();
  calcTotal();
}

// ── Price Grid ───────────────────────────────────────────────
function renderPriceGrid() {
  const grid = document.getElementById('price-grid');
  const customPriceInput = document.getElementById('custom-price');
  const type = TYPES[state.selectedType];

  grid.innerHTML = '';
  customPriceInput.classList.add('hidden');

  if (!type) return;

  type.prices.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'price-btn' + (type.highlight === p ? ' highlight' : '');
    btn.textContent = p.toLocaleString('th-TH');
    btn.onclick = () => selectPrice(btn, p);
    grid.appendChild(btn);
  });

  if (type.hasCustomPrice || state.selectedType === 'custom') {
    const btn = document.createElement('button');
    btn.className = 'price-btn';
    btn.textContent = 'กำหนดเอง';
    btn.onclick = () => {
      selectPrice(btn, null);
      customPriceInput.classList.remove('hidden');
      customPriceInput.focus();
    };
    grid.appendChild(btn);
  }
}

function selectPrice(btn, price) {
  document.querySelectorAll('.price-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  state.selectedPrice = price;

  const customPriceInput = document.getElementById('custom-price');
  if (price !== null) {
    customPriceInput.classList.add('hidden');
  }
  calcTotal();
}

// ── Quantity ─────────────────────────────────────────────────
function changeQty(delta) {
  state.qty = Math.max(1, state.qty + delta);
  document.getElementById('qty-display').textContent = state.qty;
  calcTotal();
}

function setQty(n) {
  state.qty = n;
  document.getElementById('qty-display').textContent = n;
  calcTotal();
}

// ── Calc Total ─────────────────────────────────────────────
function calcTotal() {
  let price = state.selectedPrice;
  if (price === null) {
    const cp = parseFloat(document.getElementById('custom-price')?.value);
    if (!isNaN(cp) && cp > 0) price = cp;
  }
  const total = price ? price * state.qty : 0;
  document.getElementById('total-amount').textContent =
    total > 0 ? total.toLocaleString('th-TH') + ' บาท' : '0 บาท';
}

// custom-price listener is attached in the main DOMContentLoaded above

// ── Save Record ─────────────────────────────────────────────
function saveRecord() {
  const datetime = document.getElementById('sell-datetime').value;
  if (!datetime) return showToast('กรุณาระบุวันเวลา', 'error');
  if (!state.selectedLocation) return showToast('กรุณาเลือกสถานที่', 'error');
  if (!state.selectedType) return showToast('กรุณาเลือกชนิดล็อตเตอรี่', 'error');

  let location = state.selectedLocation;
  if (location === 'อื่นๆ') {
    const ov = document.getElementById('location-other').value.trim();
    location = ov || 'อื่นๆ';
  }

  let price = state.selectedPrice;
  if (price === null) {
    price = parseFloat(document.getElementById('custom-price')?.value);
    if (isNaN(price) || price <= 0) return showToast('กรุณาระบุราคา', 'error');
  }

  const typeInfo = TYPES[state.selectedType];
  let typeLabel = typeInfo.label;
  let sheets = typeInfo.sheets;

  if (state.selectedType === 'custom') {
    const cs = parseInt(document.getElementById('custom-sheets')?.value);
    if (!isNaN(cs) && cs > 0) {
      sheets = cs;
      typeLabel = `อื่นๆ (${cs} ใบ/ชุด)`;
    } else {
      typeLabel = 'อื่นๆ';
    }
  }

  const total = price * state.qty;
  const note = document.getElementById('note-field').value.trim();

  const record = {
    id: genId(),
    datetime,
    location,
    type: state.selectedType,
    typeLabel,
    sheets,
    price,
    qty: state.qty,
    total,
    note,
    createdAt: new Date().toISOString()
  };

  const records = loadRecords();
  records.push(record);
  saveRecords(records);

  showToast(`บันทึกแล้ว ยอด ${total.toLocaleString('th-TH')} บาท`);
  clearForm();
  renderTodaySummary();
}

// ── Clear Form ───────────────────────────────────────────────
function clearForm() {
  const prevLocation = state.selectedLocation; // คงสถานที่ไว้
  initDatetime();
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.price-btn').forEach(b => b.classList.remove('selected'));
  // ซ่อน sub-inputs
  const cs = document.getElementById('custom-sheets');
  if (cs) { cs.classList.add('hidden'); cs.value = ''; }
  const cp = document.getElementById('custom-price');
  if (cp) { cp.classList.add('hidden'); cp.value = ''; }
  document.getElementById('note-field').value = '';
  document.getElementById('price-grid').innerHTML = '';
  state = { selectedLocation: prevLocation, selectedType: null, selectedPrice: null, qty: 1 };
  document.getElementById('qty-display').textContent = 1;
  document.getElementById('total-amount').textContent = '0 บาท';
}

// ── Today Summary ────────────────────────────────────────────
function renderTodaySummary() {
  const today = new Date().toISOString().slice(0, 10);
  const records = loadRecords().filter(r => r.datetime && r.datetime.startsWith(today));
  const wrap = document.getElementById('today-table-wrap');
  if (!wrap) return;

  if (records.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div>ยังไม่มีรายการวันนี้</div>';
    return;
  }

  wrap.innerHTML = buildTable(records, true);
}

// ── Build Table ───────────────────────────────────────────────
function buildTable(records, showEdit = false) {
  let html = '<div class="data-table-wrap"><table class="data-table">';
  html += '<thead><tr>';
  html += '<th>เวลา</th><th>สถานที่</th><th>ชนิด</th><th>ราคา</th><th>จำนวน</th><th>รวม</th>';
  if (showEdit) html += '<th></th>';
  html += '</tr></thead><tbody>';

  let grandTotal = 0;
  let grandQty = 0;

  records.forEach(r => {
    const typeInfo = TYPES[r.type] || {};
    const chip = typeInfo.chip || 'chip-custom';
    const timeStr = r.datetime ? r.datetime.slice(11, 16) : '';
    html += '<tr>';
    html += `<td>${timeStr}</td>`;
    html += `<td>${escHtml(r.location)}</td>`;
    html += `<td><span class="chip ${chip}">${escHtml(r.typeLabel || r.type)}</span></td>`;
    html += `<td>${r.price.toLocaleString('th-TH')}</td>`;
    html += `<td>${r.qty}</td>`;
    html += `<td class="td-amount">${r.total.toLocaleString('th-TH')}</td>`;
    if (showEdit) html += `<td class="td-edit"><button class="btn-edit-row" onclick="openEditModal('${r.id}')">แก้ไข</button></td>`;
    html += '</tr>';
    grandTotal += r.total;
    grandQty += r.qty;
  });

  // Total row
  html += '<tr class="total-row">';
  html += `<td colspan="3">รวม</td>`;
  html += `<td></td><td>${grandQty}</td>`;
  html += `<td class="td-amount">${grandTotal.toLocaleString('th-TH')}</td>`;
  if (showEdit) html += '<td></td>';
  html += '</tr>';

  html += '</tbody></table></div>';
  return html;
}

// ── Edit Modal ────────────────────────────────────────────────
function openEditModal(id) {
  const records = loadRecords();
  const rec = records.find(r => r.id === id);
  if (!rec) return;

  editingId = id;
  document.getElementById('edit-datetime').value = rec.datetime || '';
  document.getElementById('edit-location').value = rec.location || '';
  document.getElementById('edit-type').value = rec.typeLabel || rec.type || '';
  document.getElementById('edit-price').value = rec.price || '';
  document.getElementById('edit-qty').value = rec.qty || '';
  document.getElementById('edit-total').value = (rec.total || 0).toLocaleString('th-TH') + ' บาท';
  document.getElementById('edit-note').value = rec.note || '';

  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  editingId = null;
  document.getElementById('edit-modal').classList.add('hidden');
}

function recalcEditTotal() {
  const p = parseFloat(document.getElementById('edit-price').value) || 0;
  const q = parseInt(document.getElementById('edit-qty').value) || 0;
  document.getElementById('edit-total').value = (p * q).toLocaleString('th-TH') + ' บาท';
}

function saveEdit() {
  if (!editingId) return;
  const records = loadRecords();
  const idx = records.findIndex(r => r.id === editingId);
  if (idx === -1) return;

  const price = parseFloat(document.getElementById('edit-price').value);
  const qty = parseInt(document.getElementById('edit-qty').value);
  if (isNaN(price) || price <= 0) return showToast('ราคาไม่ถูกต้อง', 'error');
  if (isNaN(qty) || qty < 1) return showToast('จำนวนไม่ถูกต้อง', 'error');

  records[idx] = {
    ...records[idx],
    datetime: document.getElementById('edit-datetime').value,
    location: document.getElementById('edit-location').value.trim(),
    price,
    qty,
    total: price * qty,
    note: document.getElementById('edit-note').value.trim()
  };

  saveRecords(records);
  closeEditModal();
  showToast('แก้ไขแล้ว');
  renderTodaySummary();
  renderSummary();
  renderHistory();
}

function deleteRecord() {
  if (!editingId) return;
  if (!confirm('ลบรายการนี้?')) return;
  const records = loadRecords().filter(r => r.id !== editingId);
  saveRecords(records);
  closeEditModal();
  showToast('ลบแล้ว');
  renderTodaySummary();
  renderSummary();
  renderHistory();
}

// ── Summary Page ──────────────────────────────────────────────
function renderSummary() {
  const period = document.getElementById('summary-period')?.value;
  const customRange = document.getElementById('custom-date-range');

  if (period === 'custom') {
    customRange.classList.remove('hidden');
  } else {
    customRange.classList.add('hidden');
  }

  const { start, end } = getPeriodRange(period);
  const records = loadRecords().filter(r => {
    const d = r.datetime ? r.datetime.slice(0, 10) : '';
    return d >= start && d <= end;
  });

  // Cards
  const totalSales = records.reduce((a, r) => a + r.total, 0);
  const totalQty = records.reduce((a, r) => a + r.qty, 0);
  const cardsEl = document.getElementById('summary-cards');
  cardsEl.innerHTML = `
    <div class="summary-cards">
      <div class="summary-card">
        <div class="card-label">ยอดขายรวม</div>
        <div class="card-value">${totalSales.toLocaleString('th-TH')}</div>
        <div class="card-sub">บาท</div>
      </div>
      <div class="summary-card">
        <div class="card-label">จำนวนรายการ</div>
        <div class="card-value">${records.length}</div>
        <div class="card-sub">รายการ (${totalQty} หน่วย)</div>
      </div>
    </div>
  `;

  // ตารางแบ่งตามชนิด
  const byType = {};
  records.forEach(r => {
    if (!byType[r.typeLabel || r.type]) byType[r.typeLabel || r.type] = { qty: 0, total: 0, chip: (TYPES[r.type] || {}).chip || 'chip-custom' };
    byType[r.typeLabel || r.type].qty += r.qty;
    byType[r.typeLabel || r.type].total += r.total;
  });

  let html = '<div class="data-table-wrap"><table class="data-table"><thead><tr><th>ชนิด</th><th>จำนวน</th><th>ยอดรวม</th></tr></thead><tbody>';
  Object.entries(byType).forEach(([label, v]) => {
    html += `<tr><td><span class="chip ${v.chip}">${escHtml(label)}</span></td><td>${v.qty}</td><td class="td-amount">${v.total.toLocaleString('th-TH')}</td></tr>`;
  });
  html += `<tr class="total-row"><td>รวม</td><td>${totalQty}</td><td class="td-amount">${totalSales.toLocaleString('th-TH')}</td></tr>`;
  html += '</tbody></table></div>';

  document.getElementById('summary-table-wrap').innerHTML = html;
}

function getPeriodRange(period) {
  const today = new Date().toISOString().slice(0, 10);
  if (period === 'today') return { start: today, end: today };
  if (period === 'week') {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return { start: d.toISOString().slice(0, 10), end: today };
  }
  if (period === 'month') {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    return { start, end: today };
  }
  if (period === 'custom') {
    const s = document.getElementById('range-start')?.value || today;
    const e = document.getElementById('range-end')?.value || today;
    return { start: s, end: e };
  }
  return { start: today, end: today };
}

// ── History Page ──────────────────────────────────────────────
function renderHistory() {
  const dateVal = document.getElementById('history-date')?.value;
  if (!dateVal) return;

  const records = loadRecords().filter(r => r.datetime && r.datetime.startsWith(dateVal));
  const wrap = document.getElementById('history-table-wrap');

  if (records.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div>ไม่มีรายการในวันนี้</div>';
    return;
  }

  wrap.innerHTML = buildTable(records, true);
}

function showMonthHistory() {
  const dateVal = document.getElementById('history-date')?.value;
  if (!dateVal) return;
  const month = dateVal.slice(0, 7); // YYYY-MM
  const records = loadRecords().filter(r => r.datetime && r.datetime.startsWith(month));
  const wrap = document.getElementById('history-table-wrap');

  if (records.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div>ไม่มีรายการในเดือนนี้</div>';
    return;
  }

  // Group by date
  const byDate = {};
  records.forEach(r => {
    const d = r.datetime.slice(0, 10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(r);
  });

  let html = '';
  Object.keys(byDate).sort().reverse().forEach(d => {
    const dayTotal = byDate[d].reduce((a, r) => a + r.total, 0);
    const dDisplay = new Date(d).toLocaleDateString('th-TH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    html += `<div class="section-title-row" style="margin:14px 0 6px"><span class="section-title" style="font-size:14px">${dDisplay}</span><span class="td-amount" style="font-size:14px">${dayTotal.toLocaleString('th-TH')} บาท</span></div>`;
    html += buildTable(byDate[d], true);
  });

  wrap.innerHTML = html;
}

// ── Export CSV ────────────────────────────────────────────────
function exportCSV() {
  const period = document.getElementById('summary-period')?.value;
  const { start, end } = getPeriodRange(period);
  const records = loadRecords().filter(r => {
    const d = r.datetime ? r.datetime.slice(0, 10) : '';
    return d >= start && d <= end;
  });

  if (records.length === 0) return showToast('ไม่มีข้อมูลสำหรับ Export', 'error');

  const header = ['วันเวลา', 'สถานที่', 'ชนิด', 'ราคาต่อหน่วย', 'จำนวน', 'ยอดรวม', 'หมายเหตุ'];
  const rows = records.map(r => [
    r.datetime || '',
    r.location || '',
    r.typeLabel || r.type || '',
    r.price || 0,
    r.qty || 0,
    r.total || 0,
    r.note || ''
  ]);

  const csvContent = [header, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  // Add BOM for Thai characters in Excel
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lottery_${start}_${end}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export CSV สำเร็จ');
}

// ── Export PDF ────────────────────────────────────────────────
function exportPDF() {
  if (typeof window.jspdf === 'undefined') {
    return showToast('กำลังโหลด jsPDF...', 'error');
  }

  const period = document.getElementById('summary-period')?.value;
  const { start, end } = getPeriodRange(period);
  const records = loadRecords().filter(r => {
    const d = r.datetime ? r.datetime.slice(0, 10) : '';
    return d >= start && d <= end;
  });

  if (records.length === 0) return showToast('ไม่มีข้อมูลสำหรับ Export', 'error');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header text (basic Latin fallback since Thai needs custom font)
  doc.setFontSize(16);
  doc.text(`Lottery Sales Report`, 14, 20);
  doc.setFontSize(11);
  doc.text(`Period: ${start} to ${end}`, 14, 28);

  const totalSales = records.reduce((a, r) => a + r.total, 0);
  doc.text(`Total Sales: ${totalSales.toLocaleString()} THB  |  Records: ${records.length}`, 14, 35);

  const tableData = records.map(r => [
    r.datetime ? r.datetime.replace('T', ' ').slice(0, 16) : '',
    r.location || '',
    r.typeLabel || r.type || '',
    r.price?.toLocaleString() || '',
    String(r.qty),
    r.total?.toLocaleString() || '',
    r.note || ''
  ]);

  doc.autoTable({
    startY: 42,
    head: [['Datetime', 'Location', 'Type', 'Price', 'Qty', 'Total', 'Note']],
    body: tableData,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [26, 26, 46], textColor: [245, 166, 35] },
    alternateRowStyles: { fillColor: [240, 244, 250] },
    foot: [['', '', '', '', records.reduce((a, r) => a + r.qty, 0), totalSales.toLocaleString(), '']],
    footStyles: { fillColor: [245, 166, 35], textColor: [26, 26, 46], fontStyle: 'bold' }
  });

  doc.save(`lottery_${start}_${end}.pdf`);
  showToast('Export PDF สำเร็จ');
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast' + (type === 'error' ? ' error' : '');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => t.classList.add('show'));
  });
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Utility ───────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
