// Data regulasi berdasarkan departemen
const departmentData = {};
// State management
let currentDepartment = 'HRGA';
let rows = [];
let editingIndex = null;
let isEditing = false;
let editingOriginalRow = null;
let currentPage = 1;
let pageSize = 50;
const deptCounts = {};
const LS_PAGE_SIZE_KEY = 'reg_page_size';
const LS_PAGE_KEY_PREFIX = 'reg_current_page_';

function getSavedPage(dept){
  try { const v = Number(localStorage.getItem(LS_PAGE_KEY_PREFIX + String(dept||'')) || 0); return v > 0 ? v : 1; } catch { return 1; }
}
function saveCurrentPage(dept, page){
  try { localStorage.setItem(LS_PAGE_KEY_PREFIX + String(dept||''), String(page)); } catch {}
}

const API_BASE = (location.port === '3009' || location.port === '3001') ? '' : 'http://localhost:3009';   


function showToast(message, type = 'info') {
  try {
    const container = document.getElementById('toastContainer');
    if (!container) { console.warn('Toast container not found'); return; }
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.textContent = message;
    container.appendChild(div);
    setTimeout(() => { div.remove(); }, 3000);
  } catch (e) {
    console.warn('Toast error:', e);
  }
}

async function loadDepartmentFromServer(dept) {
  try {
    const res = await fetch(`${API_BASE}/regulations/${encodeURIComponent(dept)}?limit=${pageSize}&page=${currentPage}`);
    let data = [];
    try {
      data = await res.json();
    } catch (_) { data = []; }
    if (!res.ok) {
      console.warn('HTTP error when fetching regulations:', res.status);
      departmentData[dept] = Array.isArray(data) ? data : [];
    } else {
      departmentData[dept] = Array.isArray(data) ? data : [];
    }
    if (dept === currentDepartment) rows = departmentData[currentDepartment];
    const pageNoEl = document.getElementById('pageNo');
    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');
    if (pageNoEl) pageNoEl.textContent = String(currentPage);
    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = (rows.length < pageSize);
    try {
      const sRes = await fetch(`${API_BASE}/regulations/${encodeURIComponent(dept)}/stats`);
      const s = await sRes.json().catch(() => ({ total: rows.length, articles: (rows || []).filter(r => (r.pasal||'').trim()!=='').length, maxNo: rows.reduce((m,r)=>Math.max(m, Number(r.no||0)),0) }));
      deptCounts[dept] = { total: Number(s.total||0), articles: Number(s.articles||0), maxNo: Number(s.maxNo||0) };
    } catch (_) { deptCounts[dept] = { total: rows.length, articles: (rows || []).filter(r => (r.pasal||'').trim()!=='').length, maxNo: rows.reduce((m,r)=>Math.max(m, Number(r.no||0)),0) }; }
  } catch (e) {
    console.warn('Gagal memuat data dari server, menggunakan data lokal sementara:', e);
    departmentData[dept] = departmentData[dept] || [];
  }
}

async function saveDepartmentToServer(dept) {
  try {
    const payload = departmentData[dept] || [];
    const res = await fetch(`${API_BASE}/api/regulations/${encodeURIComponent(dept)}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch (e) {
    console.warn('Gagal menyimpan ke server:', e);
    showToast('Gagal menyimpan ke database. Periksa koneksi server.', 'error');
    return false;
  }
}

async function seedAllFromLocal() {
  try {
    const deptButtons = document.querySelectorAll('.dept-btn');
    const depts = Array.from(deptButtons).map(b => b.dataset.dept).filter(Boolean);
    for (const dept of depts) {
      const local = departmentData[dept] || [];
      if (Array.isArray(local) && local.length > 0) {
    
        local.forEach((r, i) => { r.no = i + 1; });
        departmentData[dept] = local;
        const ok = await saveDepartmentToServer(dept);
        console.log(`Seed ${dept}:`, ok ? `OK (${local.length} rows)` : 'FAILED');
      }
    }
  } catch (e) {
    console.warn('Seed all failed:', e);
  }
}

const DEPARTMENT_MAP = [
  { key: 'HRGA', label: 'HRGA' },
  { key: 'MAINTENANCE', label: 'Maintenance' },
  { key: 'IT', label: 'IT' },
  { key: 'HSE', label: 'HSE' },
  { key: 'LEGAL_COMPLIANCE', label: 'Legal Compliance' },
  { key: 'PPIC_DMW_WAREHOUSE', label: 'PPIC DMW Warehouse' },
  { key: 'FAT', label: 'FAT' }
];

const DEPT_KEYS = DEPARTMENT_MAP.map(d => d.key);
function ensureValidCurrentDepartment() {
  if (!DEPT_KEYS.includes(String(currentDepartment || ''))) {
    currentDepartment = DEPARTMENT_MAP[0].key;
  }
}

function ensureNavButtons() {
  const nav = document.querySelector('.department-nav .nav-container');
  if (!nav) return;
  const current = Array.from(nav.querySelectorAll('.dept-btn')).map(b => b.dataset.dept).filter(Boolean);
  const missing = DEPT_KEYS.filter(k => !current.includes(k));
  if (missing.length) {
    loadDepartmentList();
  }
}

async function loadDepartmentList() {
  const nav = document.querySelector('.department-nav .nav-container');
  if (!nav) return;
  ensureValidCurrentDepartment();
  nav.innerHTML = '';
  DEPARTMENT_MAP.forEach(({ key, label }) => {
    const btn = document.createElement('button');
    btn.className = 'dept-btn' + (key === currentDepartment ? ' active' : '');
    btn.dataset.dept = key;
    btn.textContent = label;
    nav.appendChild(btn);
  });
}

function getInitialDepartment(depts) {
  const urlDept = new URLSearchParams(location.search).get('dept');
  if (urlDept && depts.includes(urlDept)) return urlDept;
  return depts[0] || 'HRGA';
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadDepartmentList();
  ensureNavButtons();
  const depts = Array.from(document.querySelectorAll('.dept-btn')).map(b => b.dataset.dept).filter(Boolean);
  currentDepartment = getInitialDepartment(depts);
  const pageSizeSel = document.getElementById('pageSizeSel');
  const savedPageSize = Number(localStorage.getItem(LS_PAGE_SIZE_KEY) || 0);
  if (savedPageSize && pageSizeSel) { pageSize = savedPageSize; pageSizeSel.value = String(savedPageSize); }
  currentPage = getSavedPage(currentDepartment);
  document.querySelectorAll('.dept-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.dept === currentDepartment);
  });

  await loadDepartmentFromServer(currentDepartment);
  renderTable();
  updateDepartmentInfo(currentDepartment, rows);
  renderHierarchyChart([
    { label: 'Regulation', value: 10 },
    { label: 'Articles', value: 30 },
    { label: 'Criteria', value: 18 }
  ]);

  document.querySelectorAll('.dept-btn').forEach(btn => {
    if (!btn.dataset.dept) return;
    btn.addEventListener('click', (e) => {
      const dept = e.currentTarget.dataset.dept;
      switchDepartment(dept);
      const url = new URL(location.href);
      url.searchParams.set('dept', dept);
      history.replaceState(null, '', url.toString());
    });
  });

  document.querySelectorAll('.dept-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const dept = e.currentTarget.dataset.dept; 
      switchDepartment(dept);
    });
  });

  document.getElementById('btnEnterEdit').addEventListener('click', () => {
    if (isEditing) {
      exitEditMode();
    } else {
      enterEditMode();
    }
  });

  const btnAddRow = document.getElementById('btnAddRow');
  if (btnAddRow) {
    btnAddRow.addEventListener('click', addNewRegulation);
  }
  const btnExitEdit = document.getElementById('btnExitEdit');
  if (btnExitEdit) {
    btnExitEdit.addEventListener('click', exitEditMode);
  }

  const btnSave = document.getElementById('btnSave');
  const btnCancel = document.getElementById('btnCancel');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  
  if (btnSave) {
    btnSave.addEventListener('click', updateRow);
  }
  if (btnCancel) {
    btnCancel.addEventListener('click', closeEditModal);
  }
  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', closeEditModal);
  }
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', closeEditModal);
  }
 
  const btnDelete = document.getElementById('btnDelete');
  if (btnDelete) {
    btnDelete.addEventListener('click', deleteRow);
  }

  const btnExportCSV = document.getElementById('btnExportCSV');
  if (btnExportCSV) btnExportCSV.addEventListener('click', exportCSV);
  const btnImport = document.getElementById('btnImport');
  const fileInput = document.getElementById('fileInput');
  if (btnImport && fileInput) {
    btnImport.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleImportCSV);
  }

  const AUTO_REFRESH_MS = 60000; 
  setInterval(async () => {
    if (isEditing || document.hidden) return;
    try {
      await loadDepartmentFromServer(currentDepartment);
      rows = departmentData[currentDepartment] || [];
      renderTable();
      updateDepartmentInfo(currentDepartment, rows);
      ensureNavButtons();
    } catch (err) {
      console.warn('Auto refresh gagal:', err);
    }
  }, AUTO_REFRESH_MS);

  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');
  if (btnPrev) btnPrev.addEventListener('click', async () => { if (currentPage > 1) { currentPage--; saveCurrentPage(currentDepartment, currentPage); await loadDepartmentFromServer(currentDepartment); renderTable(); }});
  if (btnNext) btnNext.addEventListener('click', async () => { currentPage++; saveCurrentPage(currentDepartment, currentPage); await loadDepartmentFromServer(currentDepartment); renderTable(); });
  if (pageSizeSel) pageSizeSel.addEventListener('change', async () => {
    pageSize = Number(pageSizeSel.value || 50);
    currentPage = 1;
    try { localStorage.setItem(LS_PAGE_SIZE_KEY, String(pageSize)); } catch {}
    await loadDepartmentFromServer(currentDepartment);
    renderTable();
  });
});

async function switchDepartment(dept) {
  document.querySelectorAll('.dept-btn').forEach(btn => btn.classList.remove('active'));
  const targetBtn = document.querySelector(`[data-dept="${dept}"]`);
  if (targetBtn) targetBtn.classList.add('active');
  currentDepartment = dept;
  currentPage = 1;
  saveCurrentPage(currentDepartment, currentPage);
  await loadDepartmentFromServer(dept);
  rows = departmentData[dept];
  updateDepartmentInfo(currentDepartment, rows);
  renderTable();
}

function updateDepartmentInfo(departmentName, rows) {
  const deptValue = document.getElementById('deptValue');
  const totalRegulation = document.getElementById('totalRegulation');
  const totalArticles = document.getElementById('totalArticles');
  const label = (DEPARTMENT_MAP.find(d => d.key === departmentName) || { label: departmentName }).label;
  if (deptValue) deptValue.textContent = label || '';
  const cnt = deptCounts[departmentName];
  if (totalRegulation) totalRegulation.textContent = String((cnt && cnt.total) || (rows?.length || 0));
  if (totalArticles) totalArticles.textContent = String((cnt && cnt.articles) || ((rows || []).filter(r => (r.pasal || '').trim() !== '').length));
}


function kepatuhanCell(status) {
  const td = document.createElement('td');
  const labelMap = {
    'dalam-proses': 'Dalam Proses',
    'terpenuhi': 'Patuh',
    'tidak-terpenuhi': 'Tidak Patuh'
  };
  const span = document.createElement('span');
  span.className = `status-badge ${status || ''}`;
  span.textContent = labelMap[status] || '';
  td.appendChild(span);
  return td;
}

function hukumanCell(text, warna) {
  const td = document.createElement('td');
  td.textContent = text || '';
  if (warna) {
    td.style.backgroundColor = warna === 'merah' ? '#ff6b6b' : 
                              warna === 'pink' ? '#ffc0cb' : 
                              warna === 'kuning' ? '#ffeb3b' : 
                              warna === 'hijau' ? '#4caf50' : '';
  }
  return td;
}

function aksiCell(idx) {
  const td = document.createElement('td');
  td.className = 'actions-cell';
  td.innerHTML = `<button onclick="openEditModal(${idx})" class="btn-edit">Edit</button>`;
  return td;
}

function syncActionsHeader() {
  const thActions = document.getElementById('th-actions');
  if (thActions) thActions.className = isEditing ? '' : 'hidden';
  const thSummary1 = document.getElementById('th-actions-summary');
  const thSummary2 = document.getElementById('th-actions-summary2');
  if (thSummary1) thSummary1.className = isEditing ? '' : 'hidden';
  if (thSummary2) thSummary2.className = isEditing ? '' : 'hidden';

  const table = document.querySelector('.reg-table');
  if (table) {
    table.classList.toggle('edit-mode', isEditing);
    table.classList.toggle('view-mode', !isEditing);
  }

  const colgroup = document.querySelector('.reg-table colgroup');
  const lastCol = colgroup && colgroup.lastElementChild;
  if (lastCol) {
    lastCol.className = isEditing ? '' : 'hidden';
  }
}

function enterEditMode() {
  isEditing = true;
  document.getElementById('btnEnterEdit').textContent = 'Selesai Mengedit';
  const toolbar = document.getElementById('editToolbar');
  if (toolbar) toolbar.classList.remove('hidden');
  renderTable();
}
function exitEditMode() {
  isEditing = false;
  document.getElementById('btnEnterEdit').textContent = 'Edit Data';
  const toolbar = document.getElementById('editToolbar');
  if (toolbar) toolbar.classList.add('hidden');
  try { closeEditModal(); } catch {}
  editingIndex = null;
  editingOriginalRow = null;
  renderTable();
}

function openEditModal(idx) {
  editingIndex = idx;
  const row = rows[idx];
  editingOriginalRow = row ? { ...row } : null;

  const fRegulasi = document.getElementById('fRegulasi');
  const fLingkup = document.getElementById('fLingkup');
  const fPasal = document.getElementById('fPasal');
  const fDeskripsi = document.getElementById('fDeskripsi');
  const fKriteria = document.getElementById('fKriteria');
  const fKepatuhan = document.getElementById('fKepatuhan');
  const fHukuman = document.getElementById('fHukuman');
  const fWarnaHukuman = document.getElementById('fWarnaHukuman');
  
  if (fRegulasi) fRegulasi.value = row.regulasi || '';
  if (fLingkup) fLingkup.value = row.lingkup || '';
  if (fPasal) fPasal.value = row.pasal || '';
  if (fDeskripsi) fDeskripsi.value = row.deskripsi || '';
  if (fKriteria) fKriteria.value = row.kriteria || '';
  if (fKepatuhan) fKepatuhan.value = row.kepatuhan || 'dalam-proses';
  if (fHukuman) fHukuman.value = row.jenisHukuman || '';
  if (fWarnaHukuman) fWarnaHukuman.value = row.warnaHukuman || '';
 
  const editModal = document.getElementById('editModal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  
  if (editModal) { editModal.classList.remove('hidden'); editModal.classList.add('show'); }
  if (modalBackdrop) modalBackdrop.classList.remove('hidden');
}
window.openEditModal = openEditModal;

function renderHierarchyChart(data) {
  const canvas = document.getElementById('regulationChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1976d2';
  const barWidth = 40;
  const gap = 20;
  const maxVal = Math.max(...data.map(v => v.value), 1);
  data.forEach((v, i) => {
    const barHeight = Math.round((v.value / maxVal) * (canvas.height - 40));
    const x = i * (barWidth + gap) + gap;
    const y = canvas.height - barHeight - 20;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#000';
    ctx.fillText(v.label, x, canvas.height - 5);
    ctx.fillText(String(v.value), x, y - 5);
    ctx.fillStyle = '#1976d2';
  });
}

function closeEditModal() {
  const editModal = document.getElementById('editModal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  
  if (editModal) { editModal.classList.remove('show'); editModal.classList.add('hidden'); }
  if (modalBackdrop) modalBackdrop.classList.add('hidden');
  editingIndex = null;
}

async function updateRow() {
  if (editingIndex === null) return;
  
  const fRegulasi = document.getElementById('fRegulasi');
  const fLingkup = document.getElementById('fLingkup');
  const fPasal = document.getElementById('fPasal');
  const fDeskripsi = document.getElementById('fDeskripsi');
  const fKriteria = document.getElementById('fKriteria');
  const fKepatuhan = document.getElementById('fKepatuhan');
  const fHukuman = document.getElementById('fHukuman');
  const fWarnaHukuman = document.getElementById('fWarnaHukuman');

  const updatedRow = {
    id: rows[editingIndex].id,
    no: rows[editingIndex].no,
    regulasi: fRegulasi ? fRegulasi.value : '',
    lingkup: fLingkup ? fLingkup.value : '',
    pasal: fPasal ? fPasal.value : '',
    deskripsi: fDeskripsi ? fDeskripsi.value : '',
    kriteria: fKriteria ? fKriteria.value : '',
    kepatuhan: fKepatuhan ? fKepatuhan.value : 'dalam-proses',
    jenisHukuman: fHukuman ? fHukuman.value : '',
    warnaHukuman: fWarnaHukuman ? fWarnaHukuman.value : ''
  };
  const diff = {};
  const keys = ['regulasi','lingkup','pasal','deskripsi','kriteria','kepatuhan','jenisHukuman','warnaHukuman'];
  if (editingOriginalRow) {
    keys.forEach(k => { if (String(updatedRow[k] || '') !== String(editingOriginalRow[k] || '')) diff[k] = updatedRow[k]; });
  } else {
    keys.forEach(k => { diff[k] = updatedRow[k]; });
  }
  
  if (!String(updatedRow.regulasi||'').trim()) { showToast('Isi REGULATION terlebih dahulu', 'error'); return; }
  rows[editingIndex] = updatedRow;
  departmentData[currentDepartment][editingIndex] = updatedRow;
  try {
    const id = rows[editingIndex].id;
    let res = await fetch(`${API_BASE}/api/regulations/${encodeURIComponent(currentDepartment)}/id/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(diff)
    });
    let j = null; try { j = await res.json(); } catch {}
    if (!res.ok || (j && j.error)) throw new Error(j && j.error ? j.error : `HTTP ${res.status}`);
    if (j && Number(j.updated||0) === 0) {
      const payload = [{
        regulasi: updatedRow.regulasi,
        lingkup: updatedRow.lingkup,
        pasal: updatedRow.pasal,
        deskripsi: updatedRow.deskripsi,
        kriteria: updatedRow.kriteria,
        kepatuhan: updatedRow.kepatuhan,
        jenisHukuman: updatedRow.jenisHukuman,
        warnaHukuman: updatedRow.warnaHukuman
      }];
      res = await fetch(`${API_BASE}/api/regulations/${encodeURIComponent(currentDepartment)}/append`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
      });
      j = await res.json().catch(()=>({}));
      if (!res.ok || !j.ok) throw new Error('Append gagal');
      const lastIndex = Number(j.lastIndex || 1);
      const targetPage = Math.ceil(lastIndex / pageSize);
      currentPage = targetPage; saveCurrentPage(currentDepartment, currentPage);
      await loadDepartmentFromServer(currentDepartment);
      rows = departmentData[currentDepartment] || [];
      renderTable();
    }
  } catch (e) {
    showToast('Gagal menyimpan perubahan', 'error');
    return;
  }

  renderTable();
  closeEditModal();
  showToast('Perubahan baris disimpan', 'success');
}

async function addNewRegulation() {
  try {
    const provisionalNo = (rows && rows.length) ? Number(rows[rows.length - 1].no || 0) + 1 : 1;
    const newRow = { no: provisionalNo, regulasi: '', lingkup: '', pasal: '', deskripsi: '', kriteria: '', kepatuhan: 'dalam-proses', jenisHukuman: '', warnaHukuman: '' };
    rows.push(newRow);
    renderTable();
    if (!isEditing) enterEditMode();
    const idx = rows.length - 1;
    setTimeout(()=>openEditModal(idx), 50);
  } catch (e) {
    showToast('Gagal menambah regulasi baru', 'error');
  }
}

function loadSavedData() { /* data harus dari database */ }
function saveData() { /* data harus dari database */ }

async function deleteRow() {
  if (editingIndex === null || editingIndex < 0 || editingIndex >= rows.length) {
    return;
  }
  const ok = confirm('Yakin ingin menghapus baris ini?');
  if (!ok) return;
  const idx = editingIndex;
  const id = rows[idx].id;
  try {
    let res = await fetch(`${API_BASE}/api/regulations/${encodeURIComponent(currentDepartment)}/id/${encodeURIComponent(id)}`, { method:'DELETE' });
    let j = await res.json().catch(()=>({}));
    if (!res.ok || (j && j.error)) {
      res = await fetch(`${API_BASE}/api/regulations/${encodeURIComponent(currentDepartment)}/id/delete`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id })
      });
      j = await res.json().catch(()=>({}));
      if (!res.ok || (j && j.error)) throw new Error(j && j.error || `HTTP ${res.status}`);
    }
  } catch (e) {
    showToast('Gagal menghapus baris', 'error');
    return;
  }
  await loadDepartmentFromServer(currentDepartment);
  rows = departmentData[currentDepartment] || [];
  closeEditModal();
  renderTable();
  updateDepartmentInfo(currentDepartment, rows);
  showToast('Baris regulasi dihapus', 'success');
}

function exportData() {
  try {
    const payload = JSON.stringify(departmentData, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `regulatory-data-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    showToast('Gagal mengekspor data: ' + e.message, 'error');
  }
}
function exportCSV() {
  try {
    const headers = ['NO','REGULATION','SCOPE','ARTICLE','DESCRIPTION','CRITERIA','COMPLIANCE','SANCTION TYPE','SANCTION COLOR'];
    const labelMap = {
      'dalam-proses': 'In Progress',
      'terpenuhi': 'Complied',
      'tidak-terpenuhi': 'Not Complied'
    };
    const deptName = currentDepartment;
    const data = departmentData[deptName] || [];
    const lines = [];
    const esc = (v) => { const s = v == null ? '' : String(v); return '"' + s.replace(/"/g, '""') + '"'; };
    lines.push(headers.join(','));
    data.forEach(r => { const row = [r.no, r.regulasi, r.lingkup, r.pasal, r.deskripsi, r.kriteria, labelMap[r.kepatuhan] || '', r.jenisHukuman, r.warnaHukuman].map(esc).join(','); lines.push(row); });
    const csvContent = lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url; a.download = `regulatory-${deptName}-${date}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) { showToast('Gagal ekspor CSV: ' + e.message, 'error'); }
}

function parseCSV(text) {
  const firstLine = (text.split(/\r?\n/)[0] || '').trim();
  let content = text;
  if (firstLine.includes(';') && !firstLine.includes(',')) {
    content = text.replace(/;/g, ',');
  }
  const rows = [];
  let cell = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        cell = '';
        rows.push(row);
        row = [];
      } else if (ch === '\r') {

      } else {
        cell += ch;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  while (rows.length && rows[rows.length - 1].every(v => (v || '').trim() === '')) {
    rows.pop();
  }
  return rows;
}

function handleImportCSV(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  file.text().then(async text => {
    try {
      const table = parseCSV(text);
      if (!table.length) throw new Error('Empty CSV');
      const headers = table[0].map(h => (h || '').trim().toLowerCase());
      const idx = (names) => { const arr = Array.isArray(names) ? names : [names]; for (const n of arr) { const i = headers.indexOf(n); if (i >= 0) return i; } return -1; };
      const hasIndo = ['regulasi','lingkup','pasal','deskripsi','kriteria','kepatuhan','jenis hukuman','warna hukuman'].every(col => headers.includes(col));
      const hasEng = (
        headers.includes('regulation') &&
        headers.includes('scope') &&
        headers.includes('article') &&
        headers.includes('description') &&
        headers.includes('criteria') &&
        (
          headers.includes('compliance') || headers.includes('complian')
        ) &&
        (
          headers.includes('sanction type') || headers.includes('sanction')
        ) &&
        (
          headers.includes('sanction color') || headers.includes('color')
        )
      );
      const hasRCS = headers.includes('department') && (headers.includes('regulation') || headers.includes('regulasi')) && (headers.includes('lingkup regulasi') || headers.includes('lingkup') || headers.includes('scope'));

      const labelToKey = {
        'terpenuhi': 'terpenuhi',
        'complied': 'terpenuhi',
        'tidak terpenuhi': 'tidak-terpenuhi',
        'not complied': 'tidak-terpenuhi',
        'not compliant': 'tidak-terpenuhi',
        'dalam proses': 'dalam-proses',
        'in progress': 'dalam-proses'
      };

      let importedRows = [];
      if (hasIndo || hasEng) {
        const noIdx = idx(['no']);
        const regIdx = idx(['regulasi','regulation']);
        const lingIdx = idx(['lingkup','scope']);
        const artIdx = idx(['pasal','article']);
        const descIdx = idx(['deskripsi','description']);
        const critIdx = idx(['kriteria','criteria']);
        const compIdx = idx(['kepatuhan','compliance','complian']);
        const sancTypeIdx = idx(['jenis hukuman','sanction type','sanction']);
        const colorIdx = idx(['warna hukuman','sanction color','color']);
        const colorMap = { pink: 'pink', red: 'merah', yellow: 'kuning', green: 'hijau' };
        importedRows = table.slice(1).map((r, i) => {
          const colorRaw = (r[colorIdx] || '').trim().toLowerCase();
          const warna = colorMap[colorRaw] || (colorRaw || '').trim();
          const compRaw = ((r[compIdx] || '').trim().toLowerCase());
          const noVal = noIdx >= 0 ? (parseInt(r[noIdx], 10) || (i + 1)) : (i + 1);
          return {
            no: noVal,
            regulasi: (r[regIdx] || '').trim(),
            lingkup: (r[lingIdx] || '').trim(),
            pasal: (r[artIdx] || '').trim(),
            deskripsi: (r[descIdx] || '').trim(),
            kriteria: (r[critIdx] || '').trim(),
            kepatuhan: labelToKey[compRaw] || 'dalam-proses',
            jenisHukuman: (r[sancTypeIdx] || '').trim(),
            warnaHukuman: warna
          };
        });
      } else if (hasRCS) {
        const depIdx = idx('department');
        const regIdx = idx(['regulation','regulasi']);
        const lingIdx = idx('lingkup regulasi');
        const notesIdx = idx('notes');
        const linkIdx = idx('link');
        const normalize = (s) => String(s || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
        const want = normalize(currentDepartment);
        const rowsBody = table.slice(1);
        const filtered = rowsBody.filter(r => {
          const depVal = normalize(r[depIdx] || '');
          return depVal === want || depVal.includes(want);
        });
        const chosen = filtered.length ? filtered : rowsBody; 
        importedRows = chosen.map((r, i) => {
          const title = (r[regIdx] || '').trim() || (r[lingIdx] || '').trim();
          const desc = (r[notesIdx] || '').trim();
          const link = (r[linkIdx] || '').trim();
          const combinedDesc = [desc, link].filter(Boolean).join('\n');
          return {
            no: i + 1,
            regulasi: title,
            lingkup: (r[lingIdx] || '').trim(),
            pasal: '',
            deskripsi: combinedDesc,
            kriteria: '',
            kepatuhan: 'dalam-proses',
            jenisHukuman: '',
            warnaHukuman: ''
          };
        });
      } else {
        throw new Error('Invalid headers. Gunakan format: (1) NO, REGULASI/LINGKUP/PASAL/DESKRIPSI/KRITERIA/KEPATUHAN/… atau (2) NO, REGULATION/SCOPE/ARTICLE/DESCRIPTION/CRITERIA/… atau (3) DEPARTMENT, REGULATION/REGULASI, LINGKUP REGULASI, NOTES, LINK');
      }

      if (!importedRows || importedRows.length === 0) {
        showToast('File CSV tidak berisi baris yang cocok. Periksa header kolom.', 'warn');
        return;
      }

      localStorage.setItem('import_review_data', JSON.stringify({ dept: currentDepartment, rows: importedRows }));
      location.href = `import-review.html?dept=${encodeURIComponent(currentDepartment)}`;
    } catch (e) {
      showToast('Gagal impor CSV: ' + e.message, 'error');
    } finally {
      event.target.value = '';
    }
  }).catch(err => {
    showToast('Gagal membaca file: ' + err.message, 'error');
    event.target.value = '';
  });
}

function updateDepartmentInfo(departmentName, rows) {
  const deptValue = document.getElementById('deptValue');
  const totalRegulation = document.getElementById('totalRegulation');
  const totalArticles = document.getElementById('totalArticles');
  if (deptValue) deptValue.textContent = departmentName || '';
  const cnt = deptCounts[departmentName];
  if (totalRegulation) totalRegulation.textContent = String((cnt && cnt.total) || (rows?.length || 0));
  if (totalArticles) totalArticles.textContent = String((cnt && cnt.articles) || ((rows || []).filter(r => (r.pasal || '').trim() !== '').length));
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  rows.forEach((r, idx) => tbody.appendChild(renderRow(r, idx)));
  syncActionsHeader();
}

function renderRow(r, idx) {
  const tr = document.createElement('tr');
  tr.appendChild(cell(r.no, 'center'));
  tr.appendChild(cell(r.regulasi));
  tr.appendChild(cell(r.lingkup));
  tr.appendChild(cell(r.pasal));
  tr.appendChild(cell(r.deskripsi));
  tr.appendChild(cell(r.kriteria));
  tr.appendChild(kepatuhanCell(r.kepatuhan));
  tr.appendChild(hukumanCell(r.jenisHukuman, r.warnaHukuman));
  if (isEditing) {
    tr.appendChild(aksiCell(idx));
  }
  return tr;
}

function cell(text, align) {
  const td = document.createElement('td');
  td.textContent = text || '';
  if (align) td.style.textAlign = align;
  return td;
}
