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

function norm(s) { return String(s || '').trim().toLowerCase(); }

async function fetchExisting(dept) {
  try {
    const out = [];
    const limit = 1000;
    let page = 1;
    while (true) {
      const res = await fetch(`${API_BASE}/api/regulations/${encodeURIComponent(dept)}?limit=${limit}&page=${page}`);
      let data = [];
      try { data = await res.json(); } catch (_) { data = []; }
      if (!Array.isArray(data) || data.length === 0) break;
      out.push(...data);
      if (data.length < limit) break;
      page++;
      if (page > 1000) break;
    }
    return out;
  } catch (_) {
    return [];
  }
}

function renderRowEditable(row, idx, tbody) {
  const tr = document.createElement('tr');
  const fields = ['regulasi','lingkup','pasal','deskripsi','kriteria','kepatuhan','jenisHukuman','warnaHukuman'];
  const tdNo = document.createElement('td'); tdNo.textContent = String(idx + 1); tdNo.style.textAlign = 'center'; tr.appendChild(tdNo);
  fields.forEach((f) => {
    const td = document.createElement('td');
    let el;
    if (f === 'kepatuhan' || f === 'warnaHukuman') {
      el = document.createElement('select');
      if (f === 'kepatuhan') {
        ['dalam-proses','terpenuhi','tidak-terpenuhi'].forEach(v => {
          const opt = document.createElement('option'); opt.value = v; opt.textContent = v; el.appendChild(opt);
        });
      } else {
        ['', 'merah','pink','kuning','hijau'].forEach(v => { const opt = document.createElement('option'); opt.value = v; opt.textContent = v || 'None'; el.appendChild(opt); });
      }
      el.value = row[f] || (f === 'kepatuhan' ? 'dalam-proses' : '');
    } else if (f === 'deskripsi' || f === 'kriteria') {
      el = document.createElement('textarea'); el.rows = 2; el.value = row[f] || '';
    } else {
      el = document.createElement('input'); el.type = 'text'; el.value = row[f] || '';
    }
    el.dataset.field = f;
    el.addEventListener('input', (e) => { row[f] = e.target.value; });
    td.appendChild(el); tr.appendChild(td);
  });
  const tdAct = document.createElement('td'); tdAct.style.textAlign = 'center';
  const btnSave = document.createElement('button'); btnSave.className = 'primary small'; btnSave.style.marginRight = '6px'; btnSave.textContent = 'Save';
  btnSave.addEventListener('click', async () => {
    try {
      const params = new URLSearchParams(location.search);
      const dept = params.get('dept') || 'HRGA';
      const res = await fetch(`${API_BASE}/api/regulations/${encodeURIComponent(dept)}/append`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([row])
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      btnSave.disabled = true; btnDelete.disabled = true; row.__saved = true;
      showToast('Baris disimpan ke departemen', 'success');
    } catch (e) { showToast('Gagal simpan baris: ' + e.message, 'error'); }
  });
  const btnDelete = document.createElement('button'); btnDelete.className = 'secondary danger'; btnDelete.textContent = 'Delete';
  btnDelete.addEventListener('click', () => { tbody.removeChild(tr); row.__deleted = true; showToast('Baris dihapus dari impor', 'info'); });
  tdAct.appendChild(btnSave); tdAct.appendChild(btnDelete); tr.appendChild(tdAct);
  tbody.appendChild(tr);
}

function renderRowReadonly(row, idx, tbody) {
  const tr = document.createElement('tr');
  const seq = [row.no, row.regulasi, row.lingkup, row.pasal, row.deskripsi, row.kriteria, row.kepatuhan, row.jenisHukuman, row.warnaHukuman];
  seq.forEach((v, i) => { const td = document.createElement('td'); td.textContent = String(v || ''); if (i === 0) td.style.textAlign = 'center'; tr.appendChild(td); });
  const tdAct = document.createElement('td'); tdAct.style.textAlign = 'center';
  const btnDelete = document.createElement('button'); btnDelete.className = 'secondary danger'; btnDelete.textContent = 'Delete';
  btnDelete.addEventListener('click', () => { tbody.removeChild(tr); row.__deleted = true; showToast('Baris dihapus dari impor', 'info'); });
  tdAct.appendChild(btnDelete); tr.appendChild(tdAct);
  tbody.appendChild(tr);
}

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const dept = params.get('dept') || 'HRGA';
  document.getElementById('deptLabel').textContent = dept;
  const backBtn = document.getElementById('btnBack');
  if (backBtn) backBtn.addEventListener('click', () => { location.href = `regulatory.html?dept=${encodeURIComponent(dept)}`; });

  try {
    const existing = await fetchExisting(dept);
    const raw = localStorage.getItem('import_review_data');
    if (!raw) throw new Error('Tidak ada data impor untuk direview. Kembali dan pilih file CSV.');
    const payload = JSON.parse(raw || '{}');
    if (!payload.rows || payload.dept !== dept) throw new Error('Data impor tidak valid atau beda departemen.');
    const importedRows = Array.isArray(payload.rows) ? payload.rows : [];
    const existsKey = new Set(existing.map(r => `${norm(r.regulasi)}|${norm(r.lingkup)}`));
    const dups = [];
    const uniques = [];
    importedRows.forEach(r => {
      const key = `${norm(r.regulasi)}|${norm(r.lingkup)}`;
      if (existsKey.has(key)) dups.push(r); else uniques.push(r);
    });

    document.getElementById('summaryText').textContent = `Imported: ${importedRows.length}, Duplicates: ${dups.length}, New: ${uniques.length}.`;

    const dupBody = document.getElementById('dupBody');
    const newBody = document.getElementById('newBody');
    dupBody.innerHTML = '';
    newBody.innerHTML = '';
    dups.forEach((r, i) => renderRowEditable(r, i, dupBody));
    uniques.forEach((r, i) => { r.no = i + 1; renderRowReadonly(r, i, newBody); });

    const btnSave = document.getElementById('btnSaveImport');
    btnSave.addEventListener('click', async () => {
      try {
        const latest = await fetchExisting(dept);
        const keySet = new Set(latest.map(r => `${norm(r.regulasi)}|${norm(r.lingkup)}`));

        const edited = dups.filter(r => !r.__deleted);
        const resolved = edited.filter(r => {
          const k = `${norm(r.regulasi)}|${norm(r.lingkup)}`;
          return !keySet.has(k);
        });
        const finalRowsToAppend = uniques.filter(r => !r.__deleted).concat(resolved);
        if (finalRowsToAppend.length === 0) {
          showToast('Tidak ada baris baru untuk disimpan.', 'info');
          return;
        }
        const combined = latest.concat(finalRowsToAppend);
        combined.forEach((r, i) => { r.no = i + 1; });
        const start = await fetch(`${API_BASE}/api/regulations/${encodeURIComponent(dept)}/replace-start`, { method: 'POST' });
        if (!start.ok) throw new Error(`HTTP ${start.status}`);

        let i = 0;
        while (i < combined.length) {
          let chunk = [];
          let size = 0;

          while (i < combined.length && chunk.length < 500) {
            const candidate = combined[i];
            const estimated = size + JSON.stringify(candidate).length;
            if (estimated > 45 * 1024 * 1024) break;
            chunk.push(candidate);
            size = estimated;
            i++;
          }
          const res = await fetch(`${API_BASE}/api/regulations/${encodeURIComponent(dept)}/append`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chunk)
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }
        showToast(`Impor disimpan: total ${combined.length} baris.`, 'success');
        localStorage.removeItem('import_review_data');
        setTimeout(() => { location.href = `regulatory.html?dept=${encodeURIComponent(dept)}`; }, 800);
      } catch (err) {
        showToast('Gagal menyimpan impor: ' + err.message, 'error');
      }
    });
  } catch (err) {
    showToast(err.message || 'Import review error', 'error');
  }
});
