/* ============================================================
   app.js — บันทึกการขายล็อตเตอรี่
   ข้อมูลเก็บใน localStorage key: "lottery_records"
   ============================================================ */

'use strict';

/**
 * วันปฏิทินตามเวลาท้องถิ่น (YYYY-MM-DD)
 * ห้ามใช้ toISOString().slice(0,10) สำหรับ "วันนี้" — บน iPhone/ไทย ช่วงเช้า
 * (ก่อน 07:00) อาจยังเป็นวันก่อนใน UTC ทำให้ยอด/รายการ "วันนี้" หายหรือปนกับวันอื่น
 */
function localYmd(d) {
  const x = d instanceof Date ? d : new Date(d);
  const pad = n => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

function getPayKey(r) {
  const k = r && r.payMethod;
  if (k === 'cash' || k === 'transfer' || k === 'pending') return k;
  return 'cash';
}

function payLabel(key) {
  if (key === 'transfer') return 'โอน';
  if (key === 'pending') return 'ค้าง';
  return 'จ่ายสด';
}

function payBadgeClass(key) {
  if (key === 'transfer') return 'pay-b-trf';
  if (key === 'pending') return 'pay-b-pen';
  return 'pay-b-cash';
}

// ── Location Themes ──────────────────────────────────────────
const LOCATION_THEMES = {
  'ปตท':           { color: '#1565C0', dark: '#0D47A1', light: '#BBDEFB', bg: '#E3F2FD' },
  'ตลาดซอย 17':    { color: '#00695C', dark: '#004D40', light: '#B2DFDB', bg: '#E0F2F1' },
  'ตลาดพานทอง':    { color: '#D84315', dark: '#BF360C', light: '#FFCCBC', bg: '#FFF3E0' },
  'วัดหนองตำลึง':  { color: '#6A1B9A', dark: '#4A148C', light: '#E1BEE7', bg: '#F3E5F5' },
  'อื่นๆ':          { color: '#455A64', dark: '#263238', light: '#CFD8DC', bg: '#ECEFF1' },
};

function applyTheme(loc) {
  const t = LOCATION_THEMES[loc] || LOCATION_THEMES['ปตท'];
  const r = document.documentElement.style;
  r.setProperty('--theme',       t.color);
  r.setProperty('--theme-dark',  t.dark);
  r.setProperty('--theme-light', t.light);
  r.setProperty('--theme-bg',    t.bg);
  r.setProperty('--theme-text',  t.dark);
}

function updateStatsBar() {
  const today = localYmd();
  const records = loadRecords().filter(r => {
    const d = (r.datetime || '').slice(0, 10);
    return d && d === today;
  });
  const locLbl  = document.getElementById('rsb-loc-lbl');
  const locVal  = document.getElementById('rsb-loc-val');
  const allVal  = document.getElementById('rsb-all-val');
  if (!locVal || !allVal) return;

  const allTotal = records.reduce((a, r) => a + r.total, 0);
  allVal.textContent = allTotal.toLocaleString('th-TH');

  const loc = state.selectedLocation;
  if (loc) {
    const locTotal = records.filter(r => r.location === loc).reduce((a, r) => a + r.total, 0);
    if (locLbl) locLbl.textContent = loc;
    locVal.textContent = locTotal.toLocaleString('th-TH');
  } else {
    if (locLbl) locLbl.textContent = 'เลือกสถานที่';
    locVal.textContent = '0';
  }
}

function triggerDatetime() {
  // handled by <label for="sell-datetime"> in HTML
}

function updateDtBtn() {
  const el = document.getElementById('sell-datetime');
  const btn = document.getElementById('a2-dt-btn');
  if (!el || !btn) return;
  const v = el.value;
  if (!v) { btn.textContent = 'เลือกวันเวลา'; return; }
  const d = new Date(v);
  try {
    btn.textContent = d.toLocaleString('th-TH', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    // iOS fallback
    const pad = n => String(n).padStart(2, '0');
    btn.textContent = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

function shareApp() {
  const url = 'https://pisitsak48-commits.github.io/789lotto/';
  if (navigator.share) {
    navigator.share({ title: 'บันทึกขายล็อตเตอรี่', url }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(url).then(() => showToast('คัดลอกลิงก์แล้ว'));
  }
}

function toggleNav() {
  showPage('history');
}

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
let pendingSaveRecord = null;
let selectedPayMethod = 'cash';

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
  updateDtBtn();
  autoSelectLocation();
  updateStatsBar();
  renderTodaySummary();
  renderPendingPage();

  // History: เซ็ตวันเริ่มต้นเป็นวันนี้ (ตามเวลาท้องถิ่น)
  const today = localYmd();
  document.getElementById('history-date').value = today;

  // Attach custom price input
  const cp = document.getElementById('custom-price');
  if (cp) cp.addEventListener('input', calcTotal);

  // กลับมาเปิดแอปหลังวันเปลี่ยน — รีเฟรชยอด "วันนี้" ตามเวลาท้องถิ่น
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    updateStatsBar();
    renderTodaySummary();
    if (document.getElementById('page-summary')?.classList.contains('active')) renderSummary();
    if (document.getElementById('page-history')?.classList.contains('active')) renderHistory();
    if (document.getElementById('page-pending')?.classList.contains('active')) renderPendingPage();
  });
});

function initDatetime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  document.getElementById('sell-datetime').value = local.toISOString().slice(0, 16);
  updateDtBtn();
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
  if (name === 'pending') renderPendingPage();
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

  applyTheme(state.selectedLocation);
  updateStatsBar();
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
    // inner: label + count badge
    btn.innerHTML = `<span class="price-label">${p.toLocaleString('th-TH')}</span><span class="price-count">1</span>`;
    attachPriceBtnHandlers(btn, p);
    grid.appendChild(btn);
  });

  if (type.hasCustomPrice || state.selectedType === 'custom') {
    const btn = document.createElement('button');
    btn.className = 'price-btn';
    btn.innerHTML = '<span class="price-label">กำหนดเอง</span><span class="price-count">1</span>';
    btn.addEventListener('click', () => {
      if (state.selectedPrice === null && btn.classList.contains('selected')) {
        // already on custom — increment
        state.qty = Math.max(1, state.qty + 1);
        updateQtyDisplay();
        calcTotal();
      } else {
        document.querySelectorAll('.price-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.selectedPrice = null;
        state.qty = 1;
        updateQtyDisplay();
        customPriceInput.classList.remove('hidden');
        customPriceInput.focus();
        calcTotal();
      }
    });
    grid.appendChild(btn);
  }
}

// ── Long-press helpers ───────────────────────────────────────
let _lpTimer = null;

function attachPriceBtnHandlers(btn, price) {
  // Tap → +1 qty (first tap selects, subsequent tap = count up)
  btn.addEventListener('click', () => {
    if (state.selectedPrice === price) {
      state.qty += 1;
    } else {
      document.querySelectorAll('.price-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedPrice = price;
      document.getElementById('custom-price').classList.add('hidden');
      state.qty = 1;
    }
    updateQtyDisplay();
    updatePriceBadge(btn);
    calcTotal();
  });

  // Long-press = −1 qty
  const startLp = () => {
    _lpTimer = setTimeout(() => {
      _lpTimer = null;
      if (state.selectedPrice === price && state.qty > 1) {
        state.qty -= 1;
        updateQtyDisplay();
        updatePriceBadge(btn);
        calcTotal();
        if (navigator.vibrate) navigator.vibrate(30);
      }
    }, 450);
  };
  const cancelLp = () => { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } };

  btn.addEventListener('touchstart', startLp, { passive: true });
  btn.addEventListener('touchend',   cancelLp);
  btn.addEventListener('touchmove',  cancelLp);
  btn.addEventListener('mousedown',  startLp);
  btn.addEventListener('mouseup',    cancelLp);
  btn.addEventListener('mouseleave', cancelLp);
}

function updateQtyDisplay() {
  document.getElementById('qty-display').textContent = state.qty;
}

function updatePriceBadge(btn) {
  const badge = btn.querySelector('.price-count');
  if (badge) badge.textContent = state.qty;
}

function selectPrice(btn, price) {
  // used only from edit modal — just highlight without qty change
  document.querySelectorAll('.price-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  state.selectedPrice = price;
  const customPriceInput = document.getElementById('custom-price');
  if (price !== null) customPriceInput.classList.add('hidden');
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
    total > 0 ? total.toLocaleString('th-TH') : '0';
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

  pendingSaveRecord = record;
  openPayModal();
}

// ── Modal รูปแบบรับเงิน (ก่อนบันทึกจริง) ────────────────────
function openPayModal() {
  selectedPayMethod = 'cash';
  document.querySelectorAll('.pay-opt').forEach(b => b.classList.remove('selected'));
  const cashBtn = document.getElementById('pay-opt-cash');
  if (cashBtn) cashBtn.classList.add('selected');
  const dw = document.getElementById('pay-debt-wrap');
  if (dw) dw.classList.add('hidden');
  const dn = document.getElementById('pay-debt-note');
  if (dn) dn.value = '';
  document.getElementById('pay-modal')?.classList.remove('hidden');
}

function closePayModal() {
  pendingSaveRecord = null;
  document.getElementById('pay-modal')?.classList.add('hidden');
}

function selectPayMethod(pay, btn) {
  selectedPayMethod = pay;
  document.querySelectorAll('.pay-opt').forEach(x => x.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
  const debtWrap = document.getElementById('pay-debt-wrap');
  if (debtWrap) {
    if (pay === 'pending') {
      debtWrap.classList.remove('hidden');
      setTimeout(() => document.getElementById('pay-debt-note')?.focus(), 150);
    } else {
      debtWrap.classList.add('hidden');
    }
  }
}

function confirmPaySave() {
  if (!pendingSaveRecord) return;
  const pay = selectedPayMethod;
  const debtNote = pay === 'pending'
    ? (document.getElementById('pay-debt-note')?.value || '').trim()
    : '';

  const rec = { ...pendingSaveRecord, payMethod: pay, debtNote };
  const records = loadRecords();
  records.push(rec);
  saveRecords(records);

  pendingSaveRecord = null;
  document.getElementById('pay-modal')?.classList.add('hidden');

  showToast(`บันทึกแล้ว ยอด ${rec.total.toLocaleString('th-TH')} บาท — ${payLabel(pay)}`);
  clearForm();
  renderTodaySummary();
  updateStatsBar();
  renderSummary();
  renderHistory();
  renderPendingPage();
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
  document.getElementById('qty-display').textContent = 0;
  document.getElementById('total-amount').textContent = '0';
}

// ── Today Summary ────────────────────────────────────────────
function renderTodaySummary() {
  const today = localYmd();
  const records = loadRecords().filter(r => (r.datetime || '').slice(0, 10) === today);
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
  const list = [...records].sort(
    (a, b) => (b.datetime || '').localeCompare(a.datetime || '')
  );
  let html = '<div class="data-table-wrap"><table class="data-table data-table--pay">';
  html += '<thead><tr>';
  html += '<th>เวลา</th><th>สถานที่</th><th>ชนิด</th><th>ราคา</th><th>จำนวน</th><th>รวม</th><th>จ่าย</th>';
  if (showEdit) html += '<th></th>';
  html += '</tr></thead><tbody>';

  let grandTotal = 0;
  let grandQty = 0;

  list.forEach(r => {
    const typeInfo = TYPES[r.type] || {};
    const chip = typeInfo.chip || 'chip-custom';
    const timeStr = r.datetime ? r.datetime.slice(11, 16) : '';
    const pk = getPayKey(r);
    const pCls = payBadgeClass(pk);
    let payCell = `<span class="pay-badge ${pCls}">${payLabel(pk)}</span>`;
    if (pk === 'pending' && r.debtNote) {
      payCell += `<div class="pay-debt-txt">${escHtml(r.debtNote)}</div>`;
    }
    html += '<tr>';
    html += `<td>${timeStr}</td>`;
    html += `<td>${escHtml(r.location)}</td>`;
    html += `<td><span class="chip ${chip}">${escHtml(r.typeLabel || r.type)}</span></td>`;
    html += `<td>${r.price.toLocaleString('th-TH')}</td>`;
    html += `<td>${r.qty}</td>`;
    html += `<td class="td-amount">${r.total.toLocaleString('th-TH')}</td>`;
    html += `<td class="td-pay">${payCell}</td>`;
    if (showEdit) {
      const safeId = (r.id || '').replace(/'/g, "\\'");
      html += `<td class="td-edit"><button type="button" class="btn-edit-row" onclick="openEditModal('${safeId}')">แก้ไข</button></td>`;
    }
    html += '</tr>';
    grandTotal += r.total;
    grandQty += r.qty;
  });

  // Total row
  html += '<tr class="total-row">';
  html += '<td colspan="3">รวม</td>';
  html += '<td></td>';
  html += `<td>${grandQty}</td>`;
  html += `<td class="td-amount">${grandTotal.toLocaleString('th-TH')}</td><td></td>`;
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
  document.getElementById('edit-pay').value = getPayKey(rec);
  document.getElementById('edit-debt-note').value = rec.debtNote || '';
  onEditPayChange();

  document.getElementById('edit-modal').classList.remove('hidden');
}

function onEditPayChange() {
  const v = document.getElementById('edit-pay')?.value;
  const w = document.getElementById('edit-debt-wrap');
  if (w) w.classList.toggle('hidden', v !== 'pending');
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

  const pay = document.getElementById('edit-pay')?.value || 'cash';
  const debtNote = pay === 'pending'
    ? (document.getElementById('edit-debt-note')?.value || '').trim()
    : '';

  records[idx] = {
    ...records[idx],
    datetime: document.getElementById('edit-datetime').value,
    location: document.getElementById('edit-location').value.trim(),
    price,
    qty,
    total: price * qty,
    note: document.getElementById('edit-note').value.trim(),
    payMethod: pay,
    debtNote: pay === 'pending' ? debtNote : ''
  };

  saveRecords(records);
  closeEditModal();
  showToast('แก้ไขแล้ว');
  renderTodaySummary();
  renderSummary();
  renderHistory();
  renderPendingPage();
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
  renderPendingPage();
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
  const inRange = loadRecords().filter(r => {
    const d = r.datetime ? r.datetime.slice(0, 10) : '';
    return d >= start && d <= end;
  });

  const payF = document.getElementById('summary-pay-filter')?.value || 'all';
  const records = payF === 'all'
    ? inRange
    : inRange.filter(r => getPayKey(r) === payF);

  const cashT = inRange.filter(r => getPayKey(r) === 'cash').reduce((a, r) => a + r.total, 0);
  const trfT = inRange.filter(r => getPayKey(r) === 'transfer').reduce((a, r) => a + r.total, 0);
  const penT = inRange.filter(r => getPayKey(r) === 'pending').reduce((a, r) => a + r.total, 0);

  // Cards
  const totalSales = records.reduce((a, r) => a + r.total, 0);
  const totalQty = records.reduce((a, r) => a + r.qty, 0);
  const filterHint = payF === 'all' ? 'ช่วงที่เลือก' : 'ตามตัวกรองด้านบน';
  const cardsEl = document.getElementById('summary-cards');
  cardsEl.innerHTML = `
    <div class="summary-cards">
      <div class="summary-card">
        <div class="card-label">ยอดรวม (${filterHint})</div>
        <div class="card-value">${totalSales.toLocaleString('th-TH')}</div>
        <div class="card-sub">บาท</div>
      </div>
      <div class="summary-card">
        <div class="card-label">จำนวนรายการ</div>
        <div class="card-value">${records.length}</div>
        <div class="card-sub">รายการ (${totalQty} หน่วย)</div>
      </div>
    </div>
    <div class="pay-breakdown">
      <div class="pay-mini pay-mini-cash">
        <span class="pm-l">จ่ายสด</span>
        <span class="pm-v">${cashT.toLocaleString('th-TH')}</span>
      </div>
      <div class="pay-mini pay-mini-trf">
        <span class="pm-l">โอน</span>
        <span class="pm-v">${trfT.toLocaleString('th-TH')}</span>
      </div>
      <div class="pay-mini pay-mini-pen">
        <span class="pm-l">ค้าง</span>
        <span class="pm-v">${penT.toLocaleString('th-TH')}</span>
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
  const now = new Date();
  const today = localYmd(now);
  if (period === 'today') return { start: today, end: today };
  if (period === 'week') {
    const startD = new Date(now);
    startD.setDate(startD.getDate() - 6);
    return { start: localYmd(startD), end: today };
  }
  if (period === 'month') {
    const start = localYmd(new Date(now.getFullYear(), now.getMonth(), 1));
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

  const payF = document.getElementById('history-pay-filter')?.value || 'all';
  let records = loadRecords().filter(r => r.datetime && r.datetime.startsWith(dateVal));
  if (payF !== 'all') {
    records = records.filter(r => getPayKey(r) === payF);
  }
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
  const payF = document.getElementById('history-pay-filter')?.value || 'all';
  let records = loadRecords().filter(r => r.datetime && r.datetime.startsWith(month));
  if (payF !== 'all') {
    records = records.filter(r => getPayKey(r) === payF);
  }
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

// ── หน้า รายการค้าง (รวมทุกวัน) ──────────────────────────────
function renderPendingPage() {
  const wrap = document.getElementById('pending-table-wrap');
  const totEl = document.getElementById('pending-totals');
  if (!wrap) return;

  const all = loadRecords().filter(r => getPayKey(r) === 'pending');
  all.sort((a, b) => (b.datetime || '').localeCompare(a.datetime || ''));
  const sum = all.reduce((a, r) => a + r.total, 0);

  if (totEl) {
    totEl.innerHTML = `
    <div class="pending-cards">
      <div class="summary-card">
        <div class="card-label">ยอดค้างรวม (ทุกรายการ)</div>
        <div class="card-value">${sum.toLocaleString('th-TH')}</div>
        <div class="card-sub">บาท — ${all.length} รายการ</div>
      </div>
    </div>`;
  }

  if (all.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div>ตอนนี้ยังไม่มียอดค้าง</div>';
    return;
  }
  wrap.innerHTML = buildTable(all, true);
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

  const header = ['วันเวลา', 'สถานที่', 'ชนิด', 'ราคาต่อหน่วย', 'จำนวน', 'ยอดรวม', 'รูปแบบรับเงิน', 'โน๊ตคนค้าง', 'หมายเหตุ'];
  const rows = records.map(r => [
    r.datetime || '',
    r.location || '',
    r.typeLabel || r.type || '',
    r.price || 0,
    r.qty || 0,
    r.total || 0,
    payLabel(getPayKey(r)),
    r.debtNote || '',
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
  const period = document.getElementById('summary-period')?.value;
  const { start, end } = getPeriodRange(period);
  const records = loadRecords().filter(r => {
    const d = r.datetime ? r.datetime.slice(0, 10) : '';
    return d >= start && d <= end;
  });

  if (records.length === 0) return showToast('ไม่มีข้อมูลสำหรับ Export', 'error');

  const totalSales = records.reduce((a, r) => a + r.total, 0);
  const totalQty   = records.reduce((a, r) => a + r.qty, 0);

  let rows = '';
  records.forEach((r, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#f0f4f8';
    const time = r.datetime ? r.datetime.replace('T', ' ').slice(0, 16) : '';
    const pk = getPayKey(r);
    rows += `<tr style="background:${bg}">
      <td style="padding:6px 5px">${escHtml(time)}</td>
      <td style="padding:6px 5px">${escHtml(r.location)}</td>
      <td style="padding:6px 5px">${escHtml(r.typeLabel || r.type)}</td>
      <td style="padding:6px 5px;text-align:right">${(r.price||0).toLocaleString('th-TH')}</td>
      <td style="padding:6px 5px;text-align:center">${r.qty}</td>
      <td style="padding:6px 5px;text-align:right;font-weight:700;color:#0D47A1">${(r.total||0).toLocaleString('th-TH')}</td>
      <td style="padding:6px 5px;font-size:11px">${escHtml(payLabel(pk))}</td>
      <td style="padding:6px 5px;font-size:11px">${escHtml((pk === 'pending' && r.debtNote) ? r.debtNote : '')}</td>
      <td style="padding:6px 5px">${escHtml(r.note || '')}</td>
    </tr>`;
  });

  const pageHtml = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8"/>
  <title>รายงานล็อตเตอรี่ ${start}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700;800&display=swap');
    body { font-family:'Sarabun',sans-serif; font-size:13px; color:#1e293b; padding:20px; margin:0; }
    h2 { font-size:18px; color:#0D47A1; margin:0 0 4px; }
    p  { color:#64748b; margin:0 0 14px; font-size:12px; }
    .cards { display:flex; gap:12px; margin-bottom:16px; }
    .card  { flex:1; background:#E3F2FD; border-radius:8px; padding:10px 14px; }
    .card .lbl { font-size:10px; color:#64748b; }
    .card .val { font-size:22px; font-weight:800; color:#0D47A1; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    thead tr { background:#0D47A1; color:#fff; }
    th { padding:7px 5px; text-align:left; }
    td { padding:6px 5px; }
    tfoot tr { background:#FFF9C4; font-weight:700; }
    @media print {
      body { padding:10px; }
      button { display:none; }
    }
  </style>
</head>
<body>
  <h2>รายงานการขายล็อตเตอรี่</h2>
  <p>ช่วงเวลา: ${start} ถึง ${end}</p>
  <div class="cards">
    <div class="card"><div class="lbl">ยอดขายรวม</div><div class="val">${totalSales.toLocaleString('th-TH')}</div><div class="lbl">บาท</div></div>
    <div class="card"><div class="lbl">จำนวนรายการ</div><div class="val">${records.length}</div><div class="lbl">รายการ (${totalQty} หน่วย)</div></div>
  </div>
  <table>
    <thead><tr>
      <th>วันเวลา</th><th>สถานที่</th><th>ชนิด</th>
      <th style="text-align:right">ราคา</th><th style="text-align:center">จำนวน</th>
      <th style="text-align:right">รวม</th>
      <th>จ่าย</th><th>คนค้าง</th><th>หมายเหตุ</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="4">รวมทั้งหมด</td>
      <td style="text-align:center">${totalQty}</td>
      <td style="text-align:right;color:#0D47A1">${totalSales.toLocaleString('th-TH')}</td>
      <td colspan="3"></td>
    </tr></tfoot>
  </table>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  const win = window.open('', '_blank');
  if (!win) return showToast('อนุญาต pop-up ก่อนนะครับ', 'error');
  win.document.write(pageHtml.replace(
    '<script>window.onload = function(){ window.print(); }<\/script>',
    isIOS
      ? '<p style="text-align:center;padding:16px;color:#0D47A1;font-size:14px">📄 กด Share → Print หรือบันทึกเป็น PDF ได้เลยครับ</p>'
      : '<script>window.onload = function(){ window.print(); }<\/script>'
  ));
  win.document.close();
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
