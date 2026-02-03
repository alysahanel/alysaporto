const API_BASE = 'api';

function showToast(message, type = 'info') {
  try {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.textContent = message;
    container.appendChild(div);
    setTimeout(() => div.remove(), 3500);
  } catch {}
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[\s\t\n\r]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '');
}

async function fetchExisting(category) {
  const res = await fetch(`${API_BASE}/api/elibrary/${encodeURIComponent(category)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function renderRowEditable(row, idx, dupBody, newBody, state) {
  const tr = document.createElement('tr');
  const fields = ['departemen','regulasi','lingkup','status','link','notes'];
  const tdNo = document.createElement('td'); tdNo.textContent = String(idx + 1); tdNo.style.textAlign = 'center'; tr.appendChild(tdNo);
  fields.forEach((f) => {
    const td = document.createElement('td');
    let el;
    if (f === 'status') {
      el = document.createElement('select');
      ['Berlaku','Tidak Berlaku'].forEach(v => { const opt = document.createElement('option'); opt.value = v; opt.textContent = v; el.appendChild(opt); });
      el.value = row[f] || 'Berlaku';
    } else if (f === 'notes') {
      el = document.createElement('textarea'); el.rows = 2; el.value = row[f] || '';
    } else {
      el = document.createElement('input'); el.type = 'text'; el.value = row[f] || '';
    }
    el.dataset.field = f;
    el.addEventListener('input', (e) => { row[f] = e.target.value; });
    td.appendChild(el); tr.appendChild(td);
  });
  const tdAct = document.createElement('td'); tdAct.style.textAlign = 'center';
  const btnDelete = document.createElement('button'); btnDelete.className = 'secondary danger'; btnDelete.textContent = 'Delete';
  btnDelete.addEventListener('click', () => { dupBody.removeChild(tr); row.__deleted = true; updateSummary(state); showToast('Baris duplikat dibuang dari impor', 'info'); });
  const btnSave = document.createElement('button'); btnSave.className = 'primary'; btnSave.style.marginLeft = '6px'; btnSave.textContent = 'Save';
  btnSave.addEventListener('click', () => {
    const idxInDups = state.dups.indexOf(row);
    if (idxInDups >= 0) state.dups.splice(idxInDups, 1);
    row.__resolved = true;
    state.uniques.push(row);
    dupBody.removeChild(tr);
    const i = state.uniques.length - 1;
    row.no = i + 1;
    renderRowReadonly(row, i, newBody);
    updateSummary(state);
    showToast('Baris dipindahkan ke No Duplicates (belum disimpan ke database)', 'success');
  });
  tdAct.appendChild(btnDelete);
  tdAct.appendChild(btnSave);
  tr.appendChild(tdAct);
  dupBody.appendChild(tr);
}

function renderRowReadonly(row, idx, tbody) {
  const tr = document.createElement('tr');
  const seq = [row.no, row.departemen, row.regulasi, row.lingkup, row.status, row.link, row.notes];
  seq.forEach((v, i) => { const td = document.createElement('td'); td.textContent = String(v || ''); if (i === 0) td.style.textAlign = 'center'; tr.appendChild(td); });
  const tdAct = document.createElement('td'); tdAct.style.textAlign = 'center';
  const btnDelete = document.createElement('button'); btnDelete.className = 'secondary danger'; btnDelete.textContent = 'Delete';
  btnDelete.addEventListener('click', () => { tbody.removeChild(tr); row.__deleted = true; showToast('Baris baru dihapus dari impor', 'info'); });
  tdAct.appendChild(btnDelete); tr.appendChild(tdAct);
  tbody.appendChild(tr);
}

function updateSummary(state){
  const imported = state.imported != null ? state.imported : (state.dups.length + state.uniques.length);
  const el = document.getElementById('summaryText');
  if (el) el.textContent = `Imported: ${imported}, Duplicates: ${state.dups.length}, New: ${state.uniques.length}.`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const category = params.get('category') || '';
  document.getElementById('catLabel').textContent = category;
  const backBtn = document.getElementById('btnBack');
  if (backBtn) backBtn.addEventListener('click', () => { location.href = `elibrary.html?category=${encodeURIComponent(category)}`; });

  try {
    const existing = await fetchExisting(category);
    const raw = localStorage.getItem('elibrary_import_review_data');
    if (!raw) throw new Error('Tidak ada data impor untuk direview. Kembali dan pilih file CSV.');
    const payload = JSON.parse(raw || '{}');
    if (!payload.rows || payload.category !== category) throw new Error('Data impor tidak valid atau beda kategori.');
    const importedRows = Array.isArray(payload.rows) ? payload.rows : [];

    const existsFull = new Set(existing.map(r => `${norm(r.regulasi)}|${norm(r.lingkup)}`));
    const existsRegOnly = new Set(existing.map(r => norm(r.regulasi)));
    const dups = [];
    const uniques = [];
    importedRows.forEach(r => {
      const regN = norm(r.regulasi);
      const lingN = norm(r.lingkup);
      const fullKey = `${regN}|${lingN}`;
      const isDup = existsFull.has(fullKey) || (existsRegOnly.has(regN) && !lingN);
      if (isDup) dups.push(r); else uniques.push(r);
    });

    updateSummary({ dups, uniques, imported: importedRows.length });

    const dupBody = document.getElementById('dupBody');
    const newBody = document.getElementById('newBody');
    dupBody.innerHTML = '';
    newBody.innerHTML = '';
    dups.forEach((r, i) => renderRowEditable(r, i, dupBody, newBody, { dups, uniques, imported: importedRows.length }));
    uniques.forEach((r, i) => { r.no = i + 1; renderRowReadonly(r, i, newBody); });

    const btnSave = document.getElementById('btnSaveImport');
    btnSave.addEventListener('click', async () => {
      try {
        const latest = await fetchExisting(category);
        const keyFullSet = new Set(latest.map(r => `${norm(r.regulasi)}|${norm(r.lingkup)}`));
        const keyRegSet = new Set(latest.map(r => norm(r.regulasi)));

        const editedResolved = dups.filter(r => !r.__deleted && r.__resolved);
        const finalRowsToAppend = uniques.filter(r => !r.__deleted).concat(editedResolved);
        if (finalRowsToAppend.length === 0) {
          showToast('Tidak ada baris baru untuk disimpan.', 'info');
          return;
        }
        const combined = latest.concat(finalRowsToAppend);
        combined.forEach((r, i) => { r.no = i + 1; });
        const res = await fetch(`${API_BASE}/api/elibrary/${encodeURIComponent(category)}/save`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(combined)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showToast(`Impor disimpan: +${finalRowsToAppend.length} baris, total ${combined.length}.`, 'success');
        localStorage.removeItem('elibrary_import_review_data');
        setTimeout(() => { location.href = `elibrary.html?category=${encodeURIComponent(category)}`; }, 800);
      } catch (err) {
        showToast('Gagal menyimpan impor: ' + err.message, 'error');
      }
    });
  } catch (err) {
    showToast(err.message || 'Import review error', 'error');
  }
});
