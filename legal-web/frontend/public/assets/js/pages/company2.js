import { showToast } from '../utils/toast.js';

const API = 'api/company';
const params = new URLSearchParams(location.search);
let MODE = (params.get('mode') || 'view').toLowerCase();

const actions = document.getElementById('actions');
const thead   = document.getElementById('thead');
const tbody   = document.getElementById('tbody');

const layer = document.getElementById('layer');
const layerTitle = document.getElementById('layerTitle');
const layerBackdrop = document.getElementById('layerBackdrop');
const btnClose = document.getElementById('btnClose');

const f_doc = document.getElementById('f_doc');
const f_num = document.getElementById('f_num');
const f_cat = document.getElementById('f_cat');
const f_inst= document.getElementById('f_inst');

const f_status = document.getElementById('f_status');
const f_submit = document.getElementById('f_submit');
const f_cancel = document.getElementById('f_cancel');
const f_approval = document.getElementById('f_approval');
const btnBackCatTop = document.getElementById('btnBackCatTop');
if (btnBackCatTop) btnBackCatTop.onclick = ()=>{ location.href = '/license-permit.html'; };

const importUI = {
  layer: document.getElementById('importPreviewLayer'),
  backdrop: document.getElementById('importPreviewBackdrop'),
  btnClose: document.getElementById('btnClosePreview'),
  body: document.getElementById('previewBody'),
  stats: document.getElementById('importStats'),
  chkAll: document.getElementById('chkAll'),
  chkHideDup: document.getElementById('chkHideDup'),
  chkOnlyValid: document.getElementById('chkOnlyValid'),
  btnCommit: document.getElementById('btnCommitSelected'),
  rows: [], filteredIdx: [], selected: new Set()
};

function fmtDate(x){
  if (!x) return '';
  const s = String(x);
  if (s === '0000-00-00') return '';
  if (s.includes('T')) return s.split('T')[0];
  if (s.includes(' ')) return s.split(' ')[0];
  return s.slice(0,10);
}
function statusBadge(status) {
  const s = String(status || '').trim().toLowerCase();
  let cls = 'bg-gray-100 text-gray-700', label = (status || '').toString();
  if (s === 'active')    { cls = 'bg-emerald-100 text-emerald-800'; label = 'Active'; }
  else if (s === 'inactive') { cls = 'bg-rose-100 text-rose-800'; label = 'Inactive'; }
  return `<span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded ${cls}">${label}</span>`;
}

function deriveStatus(row){
  return Number(row.inactive||0)===1 ? 'Inactive' : 'Active';
}

function isRowInvalid(r){
  return !String(r.doc_name||'').trim()
      || !String(r.category||'').trim()
      || !String(r.institution||'').trim();
}

function renderHead(){
  thead.innerHTML = `
    <tr>
      <th class="p-2 w-14 text-left">NO.</th>
      <th class="p-2 text-left">DOKUMEN</th>
      <th class="p-2 text-left">NOMOR DOKUMEN</th>
      <th class="p-2 text-left">KATEGORI</th>
      <th class="p-2 text-left">INSTITUSI</th>
      <th class="p-2 text-left">PENGESAHAN</th>
      
      <th class="p-2 text-left">STATUS</th>
      ${MODE === 'manage' ? '<th class="p-2 w-44 text-left">Action</th>' : ''}
    </tr>`;
}
function statusCell(row){
  const st = deriveStatus(row);
  if (MODE !== 'manage') return statusBadge(st);
  return `
    <select data-id="${row.id}" class="border rounded p-1 text-xs">
      <option value="Active" ${st === 'Active' ? 'selected' : ''}>Active</option>
      <option value="Inactive" ${st === 'Inactive' ? 'selected' : ''}>Inactive</option>
    </select>`;
}
function actionCell(row){
  if (MODE !== 'manage') return '';
  return `
    <button class="text-sky-600 mr-3 hover:underline" onclick="editItem(${row.id})">Edit</button>
    <button class="text-red-600 hover:underline" onclick="delItem(${row.id})">Hapus</button>
  `;
}
function rowTemplate(r,i){
  return `
    <tr class="border-t">
      <td class="p-2">${i+1}</td>
      <td class="p-2">${r.doc_name || ''}</td>
      <td class="p-2">${r.doc_number || ''}</td>
      <td class="p-2">${r.category || ''}</td>
      <td class="p-2">${r.institution || ''}</td>
      <td class="p-2">${fmtDate(r.approval_date) || ''}</td>
      
      <td class="p-2">${statusCell(r)}</td>
      ${MODE === 'manage' ? `<td class="p-2">${actionCell(r)}</td>` : ''}
    </tr>`;
}

function switchMode(next){
  const url = new URL(location.href);
  if (next === 'manage') url.searchParams.set('mode','manage');
  else url.searchParams.delete('mode');
  location.replace(url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : ''));
}
function renderTopActions(){
  if (MODE === 'manage') {
    actions.innerHTML = `
      <label class="px-3 py-2 bg-white border rounded cursor-pointer">Impor CSV
        <input id="csv" type="file" accept=".csv" class="hidden"/>
      </label>
      <a href="${API}/export" class="px-3 py-2 bg-white border rounded">Ekspor CSV</a>
      <button id="btnNew" class="px-3 py-2 bg-sky-600 text-white rounded">+ Tambah Baru</button>
      <button id="btnBackView" class="px-3 py-2 border rounded">← Kembali</button>
      <button id="btnBackCat" class="px-3 py-2 border rounded">← Kembali ke Kategori</button>
    `;  
    document.getElementById('btnBackView').onclick = () => switchMode('view');
    document.getElementById('btnBackCat').onclick = () => { location.href = '/license-permit.html'; };
  } else {
    actions.innerHTML = `
      <button id="btnGoManage" class="px-3 py-2 bg-sky-600 text-white rounded">Kelola</button>
      <button id="btnBackCat" class="px-3 py-2 border rounded">← Kembali ke Kategori</button>`;
    document.getElementById('btnGoManage').onclick = () => switchMode('manage');
    document.getElementById('btnBackCat').onclick = () => { location.href = '/license-permit.html'; };
  }
}

let cache = [];
let currentId = null;

async function refresh(){
  renderHead();
  try {
    const res = await fetch(API);
    if (!res.ok) {
      const text = await res.text();
      showToast(`Load data failed: ${res.status}`, 'error');
      console.error(text);
      return;
    }
    cache = await res.json();
  } catch (err) {
    showToast('Load data failed: network error', 'error');
    console.error(err);
    return;
  }
  tbody.innerHTML = cache.map((r, i) => rowTemplate(r, i)).join('');

  if (MODE === 'manage') {
    tbody.querySelectorAll('select[data-id]').forEach(sel => {
      const onStatus = async (e) => {
        const id = e.target.getAttribute('data-id');
        const status = e.target.value; // Active | Inactive
        const row = cache.find(x => String(x.id) === String(id));
        if (!row) return;

        const inactive = String(status).toLowerCase()==='inactive' ? 1 : 0;
        let ok = false;
        try {
          const up = await fetch(`${API}/${id}/status`, {
            method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ inactive })
          }); ok = up.ok;
        } catch {}
        // Fallback to company_legal_entities status endpoint
        if (!ok) {
          try {
            const up2 = await fetch(`/api/company-legal-entities/${id}/status`, {
              method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ inactive })
            }); ok = up2.ok;
          } catch {}
        }
        if (!ok) { e.target.value = Number(row.inactive||0)===1 ? 'Inactive' : 'Active'; showToast('Update status failed', 'error'); return; }
        showToast(`Status diubah ke ${status}`, 'success', 1500);
        e.target.blur();
        refresh();
      };
      sel.addEventListener('change', onStatus);
      sel.addEventListener('input', onStatus);
    });
  }
}

function bindManageControls(){
  if (MODE !== 'manage') return;

  const btnNew = document.getElementById('btnNew');
  const csvInput = document.getElementById('csv');

  btnNew.onclick = () => {
    currentId = null;
    f_doc.value = ''; f_num.value = ''; f_cat.value = ''; f_inst.value = '';
    if (f_approval) f_approval.value = '';
    f_status.value = 'Active';
    layerTitle.textContent = 'Tambah Dokumen Baru';
    layer.classList.remove('hidden');
  };

  btnClose.onclick = () => layer.classList.add('hidden');
  layerBackdrop.onclick = () => layer.classList.add('hidden');
  f_cancel.onclick = () => layer.classList.add('hidden');

  f_submit.onclick = async () => {
    if (!f_doc.value.trim() || !f_cat.value.trim() || !f_inst.value.trim()) {
      showToast('Harap isi minimal: Dokumen, Kategori, Institusi', 'error');
      return;
    }
    const payload = {
      doc_name: f_doc.value.trim(),
      doc_number: f_num.value.trim() || null,
      category: f_cat.value.trim(),
      institution: f_inst.value.trim(),
      approval_date: f_approval ? (f_approval.value || null) : null,
      
      status: f_status.value
    };
    const method = currentId ? 'PUT' : 'POST';
    const url = currentId ? `${API}/${currentId}` : API;

    const res = await fetch(url, {
      method,
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      showToast((currentId ? 'Update' : 'Create') + ' failed', 'error');
      return;
    }
    layer.classList.add('hidden');
    showToast(currentId ? 'Updated' : 'Created', 'success', 1200);
    refresh();
  };


  csvInput.onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('file', f);

    importUI.selected.clear();
    importUI.rows = [];
    importUI.stats.textContent = 'Loading…';
    importUI.chkHideDup.checked = false;
    importUI.chkOnlyValid.checked = false;
    if (importUI.chkAll) importUI.chkAll.checked = false;
    importUI.body.innerHTML = '';
    openImportPreview();

    const res = await fetch(`${API}/import/preview`, { method:'POST', body: fd });
    const j = await res.json().catch(()=>({}));
    if (!res.ok) {
      try {
        const txt = await f.text();
        const head = (txt.split(/\r?\n/)[0]||'');
        const cntComma=(head.match(/,/g)||[]).length, cntSemi=(head.match(/;/g)||[]).length, cntTab=(head.match(/\t/g)||[]).length;
        const delim = (cntSemi>cntComma && cntSemi>=cntTab)?';':((cntTab>cntComma && cntTab>=cntSemi)?'\t':',');
        const lines = txt.split(/\r?\n/).filter(Boolean);
        const headers = (lines[0]||'').split(delim).map(s=>String(s||'').trim().toLowerCase());
        const idx = (name)=>headers.indexOf(name);
        const pDate=(v)=>{ if(v==null) return null; const s=String(v).trim(); if(!s) return null; if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/); if(m){const dd=m[1].padStart(2,'0'), mm=m[2].padStart(2,'0'), yyyy=m[3].length===2?('20'+m[3]):m[3]; return `${yyyy}-${mm}-${dd}`;} const m2=s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i); if(m2){ const map={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}; const dd=m2[1].padStart(2,'0'), mm=map[String(m2[2]).toLowerCase().slice(0,3)]||'01', y=String(m2[3]), yyyy=y.length===2?('20'+y):y; return `${yyyy}-${mm}-${dd}`;} const d=new Date(s); return isNaN(d)?null:d.toISOString().slice(0,10); };
        const rows = [];
        for(let i=1;i<lines.length;i++){
          const cols=lines[i].split(delim);
          const doc_name = cols[idx('document name')]||cols[idx('dokumen')]||'';
          const doc_number = cols[idx('document number')]||cols[idx('nomor dokumen')]||cols[idx('nomor')]||cols[idx('no')]||'';
          const category = cols[idx('category')]||cols[idx('kategori')]||'';
          const institution = cols[idx('institution')]||cols[idx('institusi')]||'';
          const approval_date = pDate(cols[idx('approval date')]||cols[idx('pengesahan')]||cols[idx('tanggal pengesahan')]||cols[idx('berlaku')]||cols[idx('tanggal berlaku')]||null);
          const statusCell=(cols[idx('status')]||'');
          const status = String(statusCell||'').toLowerCase().includes('inactive') ? 'Inactive' : 'Active';
          rows.push({ doc_name, doc_number, category, institution, approval_date, status });
        }
        const existingSet = new Set();
        try {
          const ex = await fetch('/api/company');
          if (ex.ok){
            const existRows = await ex.json();
            existRows.forEach(r=>{
              const k = `${String(r.doc_name||'').trim().toLowerCase()}|${String(r.doc_number||'').trim().toLowerCase()}|${String(r.institution||'').trim().toLowerCase()}`;
              existingSet.add(k);
            });
          }
        } catch{}
        const counts = new Map();
        rows.forEach(r=>{ const k = `${String(r.doc_name||'').trim().toLowerCase()}|${String(r.doc_number||'').trim().toLowerCase()}|${String(r.institution||'').trim().toLowerCase()}`; if(k.replace(/\|/g,'').trim()) counts.set(k,(counts.get(k)||0)+1); });
        let dupFileTotal=0, dupDbTotal=0;
        importUI.rows = rows.map(r=>{
          const k = `${String(r.doc_name||'').trim().toLowerCase()}|${String(r.doc_number||'').trim().toLowerCase()}|${String(r.institution||'').trim().toLowerCase()}`;
          const dup_in_file = (counts.get(k)||0) > 1;
          const dup_in_db = existingSet.has(k);
          if (dup_in_file) dupFileTotal++;
          if (dup_in_db) dupDbTotal++;
          const invalid = isRowInvalid(r);
          return { ...r, dup_in_file, dup_in_db, invalid };
        });
        importUI.stats.textContent = `Total: ${importUI.rows.length} — Duplikat dalam file: ${dupFileTotal}, dalam database: ${dupDbTotal}`;
        importUI.selected.clear();
        importUI.rows.forEach((r,idx)=>{ const invalid=isRowInvalid(r); if(!r.dup_in_file && !r.dup_in_db && !invalid) importUI.selected.add(idx); });
        renderPreviewTable(); updateCommitButton();
      } catch(err){
        closeImportPreview();
        showToast(`Preview failed: ${j.error||res.status}`, 'error');
      }
      e.target.value='';
      return;
    }

    importUI.rows = j.preview || [];
    importUI.stats.textContent =
      `Total: ${j.total} — Duplikat dalam file: ${j.dup_in_file_total}, dalam database: ${j.dup_in_db_total}`;

    importUI.rows.forEach((r,idx)=>{
      const invalid = (r.invalid ?? isRowInvalid(r));
      if (!r.dup_in_file && !r.dup_in_db && !invalid) importUI.selected.add(idx);
    });

    renderPreviewTable();
    updateCommitButton();
    e.target.value = ''; 
  };
}

window.editItem = (id) => {
  if (MODE !== 'manage') return;
  const r = cache.find(x => String(x.id) === String(id)); if (!r) return;
  currentId = id;
  f_doc.value = r.doc_name || '';
  f_num.value = r.doc_number || '';
  f_cat.value = r.category || '';
  f_inst.value = r.institution || '';
  if (f_approval) f_approval.value = fmtDate(r.approval_date) || '';

  f_status.value = Number(r.inactive||0)===1 ? 'Inactive' : 'Active';
  layerTitle.textContent = 'Edit Dokumen';
  layer.classList.remove('hidden');
};

window.delItem = async (id) => {
  if (MODE !== 'manage') return;
  if (!confirm('Hapus item ini?')) return;
  const res = await fetch(`${API}/${id}`, { method:'DELETE' });
  if (!res.ok) { showToast('Delete failed', 'error'); return; }
  showToast('Deleted', 'success', 1200);
  refresh();
};

function openImportPreview(){ importUI.layer.classList.remove('hidden'); }
function closeImportPreview(){ importUI.layer.classList.add('hidden'); }
function updateCommitButton(){ importUI.btnCommit.textContent = `Simpan yang dipilih (${importUI.selected.size})`; }

function renderPreviewTable(){
  const hideDup = importUI.chkHideDup.checked;
  const onlyValid = importUI.chkOnlyValid.checked;
  importUI.body.innerHTML = '';
  importUI.filteredIdx = [];

  importUI.rows.forEach((r, idx) => {
    const isDup = r.dup_in_file || r.dup_in_db;
    const isInvalid = (r.invalid ?? isRowInvalid(r));
    if ((hideDup && isDup) || (onlyValid && isInvalid)) return;

    importUI.filteredIdx.push(idx);

    const dupLabel = isDup
      ? `<span class="px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300">
           ${r.dup_in_file && r.dup_in_db ? 'file & db' : (r.dup_in_file ? 'file' : 'db')}
         </span>`
      : `<span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">unique</span>`;

    const checked = importUI.selected.has(idx) && !isInvalid ? 'checked' : '';
    const disabled = isInvalid ? 'disabled' : '';

    const tr = document.createElement('tr');
    tr.className = (isDup ? 'bg-rose-50 ' : '') + (isInvalid ? 'opacity-60' : '');
    tr.innerHTML = `
      <td class="p-2">
        <input type="checkbox" class="rowchk accent-sky-600" data-idx="${idx}" ${checked} ${disabled}/>
      </td>
      <td class="p-2">${r.doc_name||''}</td>
      <td class="p-2">${r.doc_number||''}</td>
      <td class="p-2">${r.category||''}</td>
      <td class="p-2">${r.institution||''}</td>
      <td class="p-2">${fmtDate(r.approval_date)||''}</td>
      <td class="p-2">
        ${dupLabel}${isInvalid ? ' • <span class="text-amber-700">invalid</span>' : ''}
      </td>
    `;
    importUI.body.appendChild(tr);
  });

  importUI.body.querySelectorAll('.rowchk').forEach(cb=>{
    cb.addEventListener('change',(e)=>{
      const idx = Number(e.target.getAttribute('data-idx'));
      if (e.target.checked) importUI.selected.add(idx);
      else importUI.selected.delete(idx);
      updateCommitButton();
      importUI.chkAll.checked = (importUI.filteredIdx.length>0 && importUI.filteredIdx.every(i=>importUI.selected.has(i)));
    });
  });

  importUI.chkAll.checked = (importUI.filteredIdx.length>0 && importUI.filteredIdx.every(i=>importUI.selected.has(i)));
  updateCommitButton();
}

importUI.chkHideDup.addEventListener('change', renderPreviewTable);
importUI.chkOnlyValid.addEventListener('change', renderPreviewTable);

importUI.chkAll.addEventListener('change', ()=>{
  if (importUI.chkAll.checked) {
    importUI.filteredIdx.forEach(i=>{
      const r = importUI.rows[i];
      const isInvalid = (r.invalid ?? isRowInvalid(r));
      if (!isInvalid) importUI.selected.add(i);
    });
  } else {
    importUI.filteredIdx.forEach(i=>importUI.selected.delete(i));
  }
  renderPreviewTable();
});

importUI.btnClose.addEventListener('click', closeImportPreview);
importUI.backdrop.addEventListener('click', closeImportPreview);

async function commitSelected(){
  if (!importUI.selected.size){ showToast('No rows selected', 'error'); return; }
  const rows = Array.from(importUI.selected).map(i=>importUI.rows[i]);
  const res = await fetch(`${API}/import/commit`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ rows })
  });
  const j = await res.json().catch(()=>({}));
  if (!res.ok){ showToast(`Commit failed: ${j.error||res.status}`, 'error'); return; }

  showToast(`Imported ${j.imported||0} rows`, 'success');
  closeImportPreview();
  importUI.selected.clear();
  importUI.rows = [];
  importUI.body.innerHTML = '';
  updateCommitButton();
  refresh();
}
importUI.btnCommit.addEventListener('click', commitSelected);

function renderTopActionsInit(){
  if (MODE === 'manage') {
    actions.innerHTML = `
      <label class="px-3 py-2 bg-white border rounded cursor-pointer">Impor CSV
        <input id="csv" type="file" accept=".csv" class="hidden"/>
      </label>
      <a href="${API}/export" class="px-3 py-2 bg-white border rounded">Ekspor CSV</a>
      <button id="btnNew" class="px-3 py-2 bg-sky-600 text-white rounded">+ Tambah Baru</button>
      <button id="btnBackView" class="px-3 py-2 border rounded">← Kembali</button>
    `;
    document.getElementById('btnBackView').onclick = () => switchMode('view');
  } else {
    actions.innerHTML = `<button id="btnGoManage" class="px-3 py-2 bg-sky-600 text-white rounded">Kelola</button>`;
    document.getElementById('btnGoManage').onclick = () => switchMode('manage');
  }
}
renderTopActionsInit();
renderHead();
bindManageControls();
refresh();
