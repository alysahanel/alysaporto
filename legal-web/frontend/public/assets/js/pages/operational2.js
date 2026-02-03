import { showToast } from '../utils/toast.js';

const API = 'api/operational';
const params = new URLSearchParams(location.search);
let MODE = (params.get('mode') || 'view').toLowerCase();

const actions   = document.getElementById('actions');
const thead     = document.getElementById('thead');
const tbody     = document.getElementById('tbody');
const layer     = document.getElementById('layer');
const backdrop  = document.getElementById('backdrop');
const btnClose  = document.getElementById('btnClose');
const layerTitle= document.getElementById('layerTitle');

const f_name = document.getElementById('f_name');
const f_category = document.getElementById('f_category');
const f_inst = document.getElementById('f_inst');
const f_start= document.getElementById('f_start');
const f_exp  = document.getElementById('f_exp');
const f_rem  = document.getElementById('f_rem');
const f_inactive = document.getElementById('f_inactive');
const f_submit   = document.getElementById('f_submit');
const f_cancel   = document.getElementById('f_cancel');
const btnBackCatTop = document.getElementById('btnBackCatTop');
btnBackCatTop && (btnBackCatTop.onclick = ()=>{ location.href = '/license-permit.html'; });

let cache = [];
let currentId = null;
let originalStatus = null;

function toDMY(s){
  if(!s) return '';
  const m = String(s).match(/^(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  if (isNaN(d)) return s;
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}
function openLayer(title){ layerTitle.textContent = title || 'New'; layer.classList.remove('hidden'); }
function closeLayer(){ layer.classList.add('hidden'); }
function clearForm(){
  f_name.value=''; f_category.value=''; f_inst.value='';
  f_start.value=''; f_exp.value=''; f_rem.value='';
  f_inactive.value='0';
}
function recomputeRemind(){
  if (!f_exp.value) { f_rem.value=''; return; }
  const parts = f_exp.value.split('-');
  if (parts.length!==3) { f_rem.value=''; return; }
  const y = Number(parts[0]); const m = Number(parts[1]); const d = Number(parts[2]);
  const dt = new Date(Date.UTC(y, m-1, d));
  dt.setUTCMonth(dt.getUTCMonth()-2);
  f_rem.value = dt.toISOString().slice(0,10);
}
f_exp?.addEventListener('change', recomputeRemind);

function fmtISO(x){
  if (!x) return '';
  if (x instanceof Date && !isNaN(x)) return x.toISOString().slice(0,10);
  const s = String(x);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d) ? '' : d.toISOString().slice(0,10);
}

function statusBadge(status) {
  const s = String(status || '').trim().toLowerCase();
  let cls = 'bg-gray-100 text-gray-700';
  let label = (status || '').toString();
  if (s === 'active')      { cls = 'bg-emerald-100 text-emerald-800'; label='Active'; }
  else if (s === 'inactive'){ cls = 'bg-rose-100 text-rose-800';    label='Inactive'; }
  else if (s === 'overdue') { cls = 'bg-yellow-100 text-yellow-800'; label='Overdue'; }
  return `<span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded ${cls}">${label}</span>`;
}

function deriveStatus(row){
  const inactive = Number(row.inactive||0)===1;
  if (inactive) return 'Inactive';
  const ed = row.expired_date ? new Date(row.expired_date) : null;
  const today = new Date(); today.setHours(0,0,0,0);
  if (ed && !isNaN(ed) && ed < today) return 'Overdue';
  return 'Active';
}

function renderHead(){
  thead.innerHTML = `
    <tr>
      <th class="p-2 text-left">NO.</th>
      <th class="p-2 text-left">DOKUMEN</th>
      <th class="p-2 text-left">KATEGORI</th>
      <th class="p-2 text-left">INSTITUSI</th>
      <th class="p-2 text-left">TANGGAL BERLAKU</th>
      <th class="p-2 text-left">TANGGAL KEDALUWARSA</th>
      <th class="p-2 text-left">TANGGAL PENGINGAT</th>
      <th class="p-2 text-left">STATUS</th>
      ${MODE === 'manage' ? '<th class="p-2 text-left">Action</th>' : ''}
    </tr>
  `;
}

function statusCell(row){
  const statusRaw = deriveStatus(row);
  const status = String(statusRaw).toLowerCase();

  if (MODE !== 'manage') return statusBadge(statusRaw);

  if (status === 'overdue') {
    return `
      <div class="flex flex-col gap-1">
        <select data-id="${row.id}" data-current="${statusRaw}" class="status-dd border rounded p-1 text-xs">
          <option value="Active" disabled>Active</option>
          <option value="Overdue" selected>Overdue</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>
    `;
  }

  const isInactive = status === 'inactive';
  return `
    <select data-id="${row.id}" data-current="${statusRaw}" class="status-dd border rounded p-1 text-xs">
      <option value="Active" ${!isInactive ? 'selected':''}>Active</option>
      <option value="Overdue">Overdue</option>
      <option value="Inactive" ${isInactive ? 'selected':''}>Inactive</option>
    </select>
  `;
}

function actionCell(row){
  if (MODE !== 'manage') return '';
  return `
    <button class="text-sky-600 mr-3 hover:underline" onclick="editItem(${row.id})">Edit</button>
    <button class="text-red-600 hover:underline" onclick="delItem(${row.id})">Hapus</button>
  `;
}

function rowTemplate(r,i){ return `
  <tr class="border-t">
    <td class="p-2">${i+1}</td>
    <td class="p-2">${r.doc_name||''}</td>
    <td class="p-2">${r.type||r.category||''}</td>
    <td class="p-2">${r.institution||''}</td>
    <td class="p-2">${toDMY(r.start_date)||''}</td>
    <td class="p-2">${toDMY(r.expired_date)||''}</td>
    <td class="p-2">${toDMY(r.remind_date)||''}</td>
    <td class="p-2">${statusCell(r)}</td>
    ${MODE === 'manage' ? `<td class="p-2">${actionCell(r)}</td>` : ''}
  </tr>`; }

function switchMode(next){
  const url = new URL(location.href);
  if (next === 'manage') url.searchParams.set('mode','manage');
  else url.searchParams.delete('mode');
  location.replace(url.pathname + (url.search ? url.search : ''));
}
function renderTopActions(){
  if (MODE === 'manage') {
    actions.innerHTML = `
      <label class="px-3 py-2 bg-white border rounded cursor-pointer">Impor CSV
        <input id="csv" type="file" accept=".csv" class="hidden" />
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

async function refresh(){
  renderHead();
  const res = await fetch(API);
  if (!res.ok) { showToast('Load data failed', 'error'); return; }
  const data = await res.json();
  cache = data;
  tbody.innerHTML = data.map((r,i)=>rowTemplate(r,i)).join('');

  if (MODE === 'manage') {
    tbody.querySelectorAll('select.status-dd').forEach(sel=>{
      const handler = async (e)=>{
        try {
          const id = e.target.getAttribute('data-id');
          const selected = e.target.value;                 // Active | Overdue | Inactive
          const row = cache.find(x => String(x.id) === String(id));
          const current = deriveStatus(row);
          if (!row) { e.target.value = current; return; }

          if (selected === 'Overdue') {
            showToast('Status Overdue dihitung otomatis dari tanggal kedaluwarsa. Ubah tanggal untuk memperbarui status.', 'info', 3600, true);
            e.target.value = current; e.target.blur(); return;
          }
          if (String(current).toLowerCase() === 'overdue' && selected === 'Active') {
            showToast('Item berstatus Overdue tidak bisa diaktifkan manual. Edit tanggalnya dulu.', 'info');
            e.target.value = current; return;
          }

          const makeInactive = (selected === 'Inactive') ? 1 : 0;
          let ok = false;
          try {
            const up = await fetch(`${API}/${id}/status`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ inactive: makeInactive }) });
            ok = up.ok;
          } catch {}
          if (!ok) {
            const payload = {
              doc_name: row.doc_name,
              type: row.type || row.category || '',
              institution: row.institution,
              start_date: row.start_date,
              expired_date: row.expired_date,
              remind_date: row.remind_date,
              inactive: makeInactive
            };
            const up2 = await fetch(`${API}/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
            ok = up2.ok;
          }
          if (!ok) { showToast('Update status gagal', 'error'); e.target.value = current; return; }
          showToast(`Status diubah ke ${selected}`, 'success', 1600);
          e.target.blur();
          refresh();
        } catch(err){ showToast('Terjadi error saat update status', 'error'); }
      };
      sel.addEventListener('change', handler);
      sel.addEventListener('input', handler);
    });
  }
}

function bindManageControls(){
  if (MODE !== 'manage') return;

  const btnNew = document.getElementById('btnNew');
  const csvInput = document.getElementById('csv');

  btnNew.onclick = ()=>{
    currentId = null;
    originalStatus = null;
    clearForm();
    openLayer('New Operational Permit');
  };

  btnClose.onclick = closeLayer;
  backdrop.onclick = closeLayer;
  f_cancel.onclick = closeLayer;

  f_inactive.addEventListener('change', ()=>{ originalStatus = null; });

  f_submit.onclick = async ()=>{
    if(!f_name.value.trim() || !f_category.value.trim() || !f_inst.value.trim()){
      showToast('Isi minimal: Dokumen, Kategori, Institusi', 'error'); 
      return;
    }
    const payload = {
      doc_name: f_name.value.trim(),
      type: f_category.value.trim(),
      institution: f_inst.value.trim(),
      start_date: f_start.value || null,
      expired_date: f_exp.value || null,
      remind_date: f_rem.value || null,
      inactive: Number(f_inactive.value) || 0
    };
    const method = currentId ? 'PUT' : 'POST';
    const url = currentId ? `${API}/${currentId}` : API;

    const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const j = await res.json().catch(()=>({}));
    if (!res.ok) { 
      showToast((currentId?'Update':'Create')+' failed: ' + (j.error||res.status), 'error'); 
      return; 
    }
    closeLayer(); clearForm(); showToast(currentId ? 'Updated' : 'Created', 'success', 1500);
    refresh();
  };


  const importUI = _importUI; 
  const csvChange = _csvChangeFactory(importUI);
  csvInput.onchange = csvChange;
}

window.editItem = (id)=>{
  if (MODE !== 'manage') return;
  const r = cache.find(x => String(x.id) === String(id)); if(!r) return;
  currentId = id;

  f_name.value = r.doc_name || '';
  f_category.value = r.type || r.category || '';
  f_inst.value = r.institution || '';
  f_start.value = fmtISO(r.start_date) || '';
  f_exp.value   = fmtISO(r.expired_date) || '';
  recomputeRemind();

  originalStatus = r.status || 'Active';
  f_inactive.value = (String(r.status).toLowerCase() === 'inactive') ? '1' : '0';

  openLayer('Edit Operational Permit');
};

window.delItem = async (id)=>{
  if (MODE !== 'manage') return;
  if(!confirm('Hapus item ini?')) return;
  const res = await fetch(`${API}/${id}`, { method:'DELETE' });
  if (!res.ok) { showToast('Delete failed', 'error'); return; }
  showToast('Deleted', 'success', 1500);
  refresh();
};

const _importUI = {
  layer: document.getElementById('importPreviewLayer'),
  backdrop: document.getElementById('importPreviewBackdrop'),
  btnClose: document.getElementById('btnClosePreview'),
  body: document.getElementById('previewBody'),
  stats: document.getElementById('importStats'),
  chkAll: document.getElementById('chkAll'),
  chkHideDup: document.getElementById('chkHideDup'),
  btnCommit: document.getElementById('btnCommitSelected'),
  rows: [],
  filteredIdx: [],
  selected: new Set()
};
function openImportPreview(){ _importUI.layer.classList.remove('hidden'); }
function closeImportPreview(){ _importUI.layer.classList.add('hidden'); }
function updateCommitButton(){ _importUI.btnCommit.textContent = `Save selected (${_importUI.selected.size})`; }

function renderPreviewTable(){
  const hideDup = _importUI.chkHideDup.checked;
  _importUI.body.innerHTML = '';
  _importUI.filteredIdx = [];

  _importUI.rows.forEach((r,idx)=>{
    const isDup = r.dup_in_file || r.dup_in_db;
    if (hideDup && isDup) return;

    _importUI.filteredIdx.push(idx);

    const dupLabel = isDup
      ? `<span class="px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300">${r.dup_in_file && r.dup_in_db ? 'file & db' : (r.dup_in_file ? 'file' : 'db')}</span>`
      : `<span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">tidak duplikat</span>`;

    const checked = _importUI.selected.has(idx) ? 'checked' : '';
    const tr = document.createElement('tr');
    tr.className = isDup ? 'bg-rose-50' : '';
    tr.innerHTML = `
      <td class="p-2"><input type="checkbox" class="rowchk accent-sky-600" data-idx="${idx}" ${checked}/></td>
      <td class="p-2">${r.doc_name||r.name||''}</td>
      <td class="p-2">${r.type||r.category||''}</td>
      <td class="p-2">${r.institution||''}</td>
      <td class="p-2">${r.start_date||''}</td>
      <td class="p-2">${r.expired_date||''}</td>
      <td class="p-2">${r.remind_date||''}</td>
      <td class="p-2">${r.status||''}</td>
      <td class="p-2">${dupLabel}</td>
    `;
    _importUI.body.appendChild(tr);
  });

  _importUI.body.querySelectorAll('.rowchk').forEach(cb=>{
    cb.addEventListener('change',(e)=>{
      const idx = Number(e.target.getAttribute('data-idx'));
      if (e.target.checked) _importUI.selected.add(idx);
      else _importUI.selected.delete(idx);
      updateCommitButton();
    });
  });

  _importUI.chkAll.checked = (_importUI.filteredIdx.length>0 && _importUI.filteredIdx.every(i=>_importUI.selected.has(i)));
  updateCommitButton();
}

_importUI.chkHideDup.addEventListener('change', renderPreviewTable);
_importUI.chkAll.addEventListener('change', ()=>{
  if (_importUI.chkAll.checked) _importUI.filteredIdx.forEach(i=>_importUI.selected.add(i));
  else _importUI.filteredIdx.forEach(i=>_importUI.selected.delete(i));
  renderPreviewTable();
});
_importUI.btnClose.addEventListener('click', closeImportPreview);
_importUI.backdrop.addEventListener('click', closeImportPreview);

async function commitSelected(){
  if (!_importUI.selected.size){ showToast('No rows selected', 'info'); return; }
  const rows = Array.from(_importUI.selected).map(i=>_importUI.rows[i]);

  const res = await fetch(`${API}/import/commit`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ rows })
  });
  const j = await res.json().catch(()=>({}));

  if (!res.ok){
    showToast('Commit failed: ' + (j.error||res.status) + (j.detail?`\n${j.detail}`:''), 'error');
    return;
  }
  showToast(`Imported ${j.imported||0} rows`, 'success');
  closeImportPreview();
  refresh();
}
_importUI.btnCommit.addEventListener('click', commitSelected);

function _csvChangeFactory(importUI){
  return async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const fd = new FormData(); fd.append('file', f);

    // reset preview state
    importUI.selected.clear();
    importUI.rows = [];
    importUI.stats.textContent = 'Loading…';
    importUI.chkHideDup.checked = false;
    importUI.chkAll.checked = false;
    importUI.body.innerHTML = '';

    openImportPreview();

    // PREVIEW ke backend
    const resPrev = await fetch(`${API}/import/preview`, { method:'POST', body: fd });
    const jPrev = await resPrev.json().catch(()=>({}));
    if(!resPrev.ok){
      try {
        const txt = await f.text();
        const head = (txt.split(/\r?\n/)[0]||'');
        const cntComma=(head.match(/,/g)||[]).length, cntSemi=(head.match(/;/g)||[]).length, cntTab=(head.match(/\t/g)||[]).length;
        const delim = (cntSemi>cntComma && cntSemi>=cntTab)?';':((cntTab>cntComma && cntTab>=cntSemi)?'\t':',');
        const lines = txt.split(/\r?\n/).filter(Boolean);
        const headers = (lines[0]||'').split(delim).map(s=>String(s||'').trim().toLowerCase());
        const idx = (name)=>headers.indexOf(name);
        const pDate=(v)=>{ if(v==null) return null; const s=String(v).trim(); if(!s) return null; if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/); if(m){const dd=m[1].padStart(2,'0'), mm=m[2].padStart(2,'0'), yyyy=m[3].length===2?('20'+m[3]):m[3]; const dt=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd))); return dt.toISOString().slice(0,10);} const m2=s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i); if(m2){ const map={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}; const dd=m2[1].padStart(2,'0'), mm=map[String(m2[2]).toLowerCase().slice(0,3)]||'01', y=String(m2[3]), yyyy=y.length===2?('20'+y):y; const dt=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd))); return dt.toISOString().slice(0,10);} const d=new Date(s); return isNaN(d)?null:d.toISOString().slice(0,10); };
        const rows=[];
        for(let i=1;i<lines.length;i++){
          const cols=lines[i].split(delim);
          const doc_name=cols[idx('document name')]||cols[idx('dokumen')]||'';
          const type=cols[idx('type')]||cols[idx('kategori')]||'';
          const institution=cols[idx('institution')]||cols[idx('institusi')]||'';
          const start_date=pDate(cols[idx('start date')]||cols[idx('tanggal berlaku')]||null);
          const expired_date=pDate(cols[idx('expired date')]||cols[idx('tanggal kedaluarsa')]||cols[idx('tanggal kedaluwarsa')]||cols[idx('tanggal kadaluarsa')]||null);
          const remind_date=pDate(cols[idx('remind date')]||cols[idx('tanggal pengingat')]||null);
          const statusCell=(cols[idx('status')]||'');
          const status=String(statusCell||'').toLowerCase().includes('inactive')?'Inactive':'Active';
          rows.push({ doc_name, type, institution, start_date, expired_date, remind_date, status, dup_in_file:false, dup_in_db:false });
        }
        const existingSet = new Set();
        try {
          const ex = await fetch('/api/operational');
          if (ex.ok){
            const existRows = await ex.json();
            existRows.forEach(r=>{
              const k = `${String(r.doc_name||'').trim().toLowerCase()}|${String(r.type||'').trim().toLowerCase()}|${String(r.institution||'').trim().toLowerCase()}`;
              existingSet.add(k);
            });
          }
        } catch{}
        const counts = new Map();
        rows.forEach(r=>{ const k = `${String(r.doc_name||'').trim().toLowerCase()}|${String(r.type||'').trim().toLowerCase()}|${String(r.institution||'').trim().toLowerCase()}`; if(k.replace(/\|/g,'').trim()) counts.set(k,(counts.get(k)||0)+1); });
        let dupFileTotal=0, dupDbTotal=0;
        _importUI.rows = rows.map(r=>{
          const k = `${String(r.doc_name||'').trim().toLowerCase()}|${String(r.type||'').trim().toLowerCase()}|${String(r.institution||'').trim().toLowerCase()}`;
          const dup_in_file = (counts.get(k)||0) > 1;
          const dup_in_db = existingSet.has(k);
          if (dup_in_file) dupFileTotal++;
          if (dup_in_db) dupDbTotal++;
          return { ...r, dup_in_file, dup_in_db };
        });
        _importUI.stats.textContent = `Total baris: ${_importUI.rows.length} — Duplikat dalam file: ${dupFileTotal}, dalam database: ${dupDbTotal}`;
        _importUI.selected.clear();
        _importUI.rows.forEach((r,idx)=>{ if(!r.dup_in_file && !r.dup_in_db) _importUI.selected.add(idx); });
        renderPreviewTable();
      } catch(err){
        closeImportPreview();
        showToast('Preview failed: ' + (jPrev.error||resPrev.status) + (jPrev.detail?`\n${jPrev.detail}`:''));
      }
      e.target.value='';
      return;
    }

    _importUI.rows = jPrev.preview || [];
    _importUI.stats.textContent =
      `Total baris: ${jPrev.total||_importUI.rows.length} — Duplikat dalam file: ${jPrev.dup_in_file_total||0}, dalam database: ${jPrev.dup_in_db_total||0}`;

    _importUI.rows.forEach((r,idx)=>{ if(!r.dup_in_file && !r.dup_in_db) _importUI.selected.add(idx); });
    renderPreviewTable();
    e.target.value='';
  };
}

function renderTopActionsInit(){ renderTopActions(); bindManageControls(); refresh(); }
renderTopActionsInit();
