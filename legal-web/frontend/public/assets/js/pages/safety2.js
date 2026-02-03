import { showToast } from '../utils/toast.js';

const API = 'api/safety';
const params = new URLSearchParams(location.search);
let MODE = (params.get('mode') || 'view').toLowerCase();

const actions = document.getElementById('actions');
const thead   = document.getElementById('thead');
const tbody   = document.getElementById('tbody');
const layer = document.getElementById('layer'), backdrop = document.getElementById('backdrop');
const btnClose = document.getElementById('btnClose'), layerTitle = document.getElementById('layerTitle');
const btnBackCatTop = document.getElementById('btnBackCatTop');
btnBackCatTop && (btnBackCatTop.onclick = ()=>{ location.href = '/license-permit.html'; });

const f_name=document.getElementById('f_name'),
      f_document=document.getElementById('f_document'),
      f_category=document.getElementById('f_category'),
      f_institution=document.getElementById('f_institution'),
      f_start=document.getElementById('f_start'),
      f_exp=document.getElementById('f_exp'),
      f_rem=document.getElementById('f_rem'),
      f_inactive=document.getElementById('f_inactive'),
      f_submit=document.getElementById('f_submit'),
      f_cancel=document.getElementById('f_cancel'),
      statusNote=document.getElementById('statusNote');

let cache=[], currentId=null;

function fmtDate(x){ if(!x) return ''; const s=String(x); if(s.includes('T')) return s.split('T')[0]; if(s.includes(' ')) return s.split(' ')[0]; return s.slice(0,10); }
function toDMY(s){ if(!s) return ''; const m=String(s).match(/^(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})/); if(m) return `${m[3]}-${m[2]}-${m[1]}`; const d=new Date(s); if(isNaN(d)) return s; const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); const yy=d.getFullYear(); return `${dd}-${mm}-${yy}`; }
function fallbackRemindISO(exp){ if(!exp) return ''; const parts=String(exp).split('-'); if(parts.length!==3) return ''; const y=Number(parts[0]), m=Number(parts[1]), d=Number(parts[2]); const dt=new Date(Date.UTC(y, m-1, d)); dt.setUTCMonth(dt.getUTCMonth()-6); return dt.toISOString().slice(0,10); }
function recomputeRemind(){
  if(!f_exp.value){ f_rem.value=''; return; }
  const parts = f_exp.value.split('-');
  if (parts.length===3){
    const y = Number(parts[0]); const m = Number(parts[1]); const d = Number(parts[2]);
    const dt = new Date(Date.UTC(y, m-1, d));
    dt.setUTCMonth(dt.getUTCMonth()-6);
    f_rem.value = dt.toISOString().slice(0,10);
    return;
  }
  f_rem.value = '';
}
f_exp.addEventListener('change', recomputeRemind);
function openLayer(t){ layerTitle.textContent=t||'New'; layer.classList.remove('hidden'); }
function closeLayer(){ layer.classList.add('hidden'); }
function clearForm(){ f_name.value=f_document.value=f_category.value=f_institution.value=''; f_start.value=f_exp.value=f_rem.value=''; f_inactive.value='0'; statusNote.classList.add('hidden'); }

function statusBadge(status){
  const s = String(status||'').toLowerCase();
  let cls = 'bg-gray-100 text-gray-700';
  if (s==='active')   cls = 'bg-emerald-100 text-emerald-800';
  if (s==='inactive') cls = 'bg-rose-100 text-rose-800';
  if (s==='overdue')  cls = 'bg-yellow-100 text-yellow-800';
  return `<span class="px-2 py-1 text-xs font-medium rounded ${cls}">${status||'-'}</span>`;
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
      <th class="p-2 text-left w-14">NO.</th>
      <th class="p-2 text-left">NAME</th>
      <th class="p-2 text-left">DOKUMEN</th>
      <th class="p-2 text-left">KATEGORI</th>
      <th class="p-2 text-left">INSTITUSI</th>
      <th class="p-2 text-left">TANGGAL BERLAKU</th>
      <th class="p-2 text-left">TANGGAL KEDALUWARSA</th>
      <th class="p-2 text-left">TANGGAL PENGINGAT</th>
      <th class="p-2 text-left">STATUS</th>
      ${MODE==='manage' ? '<th class="p-2 text-left w-44">Action</th>' : ''}
    </tr>`;
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
      <option value="Active" ${!isInactive ? 'selected' : ''}>Active</option>
      <option value="Overdue">Overdue</option>
      <option value="Inactive" ${isInactive ? 'selected' : ''}>Inactive</option>
    </select>
  `;
}

function rowTemplate(r,i){
  const action = MODE==='manage' ? `
    <button class="text-sky-600 mr-3 hover:underline" onclick="editItem(${r.id})">Edit</button>
    <button class="text-red-600 hover:underline" onclick="delItem(${r.id})">Hapus</button>` : '';
  return `
    <tr class="border-t">
      <td class="p-2">${i+1}</td>
      <td class="p-2">${r.name||''}</td>
      <td class="p-2">${r.document||''}</td>
      <td class="p-2">${r.type||r.category||''}</td>
      <td class="p-2">${r.institution||''}</td>
      <td class="p-2">${toDMY(r.start_date)}</td>
      <td class="p-2">${toDMY(r.expired_date)}</td>
      <td class="p-2">${toDMY(r.remind_date || fallbackRemindISO(r.expired_date))}</td>
      <td class="p-2">${statusCell(r)}</td>
      ${MODE==='manage' ? `<td class="p-2">${action}</td>` : ''}
    </tr>`;
}

function switchMode(next){
  const url = new URL(location.href);
  if (next==='manage') url.searchParams.set('mode','manage');
  else url.searchParams.delete('mode');
  location.replace(url.pathname + (url.search ? url.search : ''));
}
function renderTopActions(){
  if (MODE==='manage') {
    actions.innerHTML = `
      <label class="px-3 py-2 bg-white border rounded cursor-pointer">Impor CSV
        <input id="csv" type="file" accept=".csv" class="hidden"/>
      </label>
      <a href="${API}/export" class="px-3 py-2 bg-white border rounded">Ekspor CSV</a>
      <button id="btnNew"  class="px-3 py-2 bg-sky-600 text-white rounded">+ Tambah Baru</button>
      <button id="btnBack" class="px-3 py-2 border rounded">← Kembali</button>`;
    document.getElementById('btnBack').onclick = ()=>switchMode('view');
  } else {
    actions.innerHTML = `<button id="btnManage" class="px-3 py-2 bg-sky-600 text-white rounded">Kelola</button>`;
    document.getElementById('btnManage').onclick = ()=>switchMode('manage');
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
    async function onStatusChange(e){
      const id = e.target.getAttribute('data-id');
      const selected = e.target.value;
      const row = cache.find(x => String(x.id) === String(id));
      const current  = deriveStatus(row);
      if (!row) { e.target.value = current; return; }

      if (selected === 'Overdue') {
        showToast('Status Overdue ditentukan otomatis oleh tanggal kedaluwarsa. Ubah tanggal untuk memperbarui status.', 'info', 3600, true);
        e.target.value = current;
        e.target.blur();
        return;
      }

      if (String(current).toLowerCase() === 'overdue' && selected === 'Active') {
        showToast('Item Overdue tidak bisa diaktifkan manual. Edit tanggalnya dulu.', 'info');
        e.target.value = current;
        return;
      }

      const makeInactive = (selected === 'Inactive') ? 1 : 0;

      const up = await fetch(`${API}/${row.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inactive: makeInactive })
      });

      if (!up.ok) {
        const alt = await fetch(`/api/safety-licenses/${row.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inactive: makeInactive })
        });
        if (!alt.ok) {
          showToast('Update status gagal', 'error');
          e.target.value = current;
          return;
        }
      }

      showToast(`Status diubah ke ${selected}`, 'success');
      e.target.blur();
      refresh();
    }

    tbody.querySelectorAll('select.status-dd').forEach(sel => {
      sel.addEventListener('change', onStatusChange);
      sel.addEventListener('input', onStatusChange);
    });
  }
}

function bindManageControls(){
  if (MODE!=='manage') return;
  const btnNew = document.getElementById('btnNew');
  const csv = document.getElementById('csv');

  btnNew.onclick = ()=>{ currentId=null; clearForm(); openLayer('Tambah Dokumen Baru'); };
  btnClose.onclick = closeLayer; backdrop.onclick = closeLayer; f_cancel.onclick = closeLayer;

  f_submit.onclick = async ()=>{
    if(!f_name.value.trim() || !f_document.value.trim() || !f_category.value.trim() || !f_institution.value.trim()){
      showToast('Isi semua field utama', 'info'); return;
    }
    const payload = {
      name:f_name.value.trim(), document:f_document.value.trim(), type:f_category.value.trim(),
      institution:f_institution.value.trim(), start_date:f_start.value||null, expired_date:f_exp.value||null,
      remind_date:f_rem.value||null, inactive:Number(f_inactive.value)||0
    };
    const method = currentId ? 'PUT' : 'POST';
    const url = currentId ? `${API}/${currentId}` : API;
    const r = await fetch(url,{ method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const j = await r.json().catch(()=>({}));
    if (!r.ok){ showToast((currentId?'Update':'Create')+' failed: '+(j.error||r.status), 'error'); return; }
    closeLayer(); clearForm(); refresh();
  };

  csv.onchange = async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const fd = new FormData(); fd.append('file', f);
    importUI.selected.clear(); importUI.rows=[]; importUI.stats.textContent='Loading…';
    importUI.chkHideDup.checked=false; importUI.chkAll.checked=false; importUI.body.innerHTML='';
    openImportPreview();

    const res = await fetch(`${API}/import/preview`, { method:'POST', body: fd });
    const j = await res.json().catch(()=>({}));
    if(!res.ok){
      try {
        const txt = await f.text();
        const head = (txt.split(/\r?\n/)[0]||'');
        const cntComma=(head.match(/,/g)||[]).length, cntSemi=(head.match(/;/g)||[]).length, cntTab=(head.match(/\t/g)||[]).length;
        const delim = (cntSemi>cntComma && cntSemi>=cntTab)?';':((cntTab>cntComma && cntTab>=cntSemi)?'\t':',');
        const lines = txt.split(/\r?\n/).filter(Boolean);
        const headers = (lines[0]||'').split(delim).map(s=>String(s||'').trim().toLowerCase());
        const findIdx = (names)=>{ for(const n of names){ const i=headers.indexOf(n); if(i>=0) return i; } return -1; };
        const pDate=(v)=>{ if(v==null) return null; const s=String(v).trim(); if(!s) return null; if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const m=s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/); if(m){const dd=m[1].padStart(2,'0'), mm=m[2].padStart(2,'0'), yyyy=m[3].length===2?('20'+m[3]):m[3]; return `${yyyy}-${mm}-${dd}`;} const m2=s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i); if(m2){ const map={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}; const dd=m2[1].padStart(2,'0'), mm=map[String(m2[2]).toLowerCase().slice(0,3)]||'01', y=String(m2[3]), yyyy=y.length===2?('20'+y):y; return `${yyyy}-${mm}-${dd}`;} const d=new Date(s); return isNaN(d)?null:d.toISOString().slice(0,10); };
        const nameIdx = findIdx(['nama','name']);
        const docIdx = findIdx(['dokumen','document']);
        const typeIdx = findIdx(['tipe','type','kategori','jenis','jenis dokumen','kategori dokumen']);
        const instIdx = findIdx(['institusi','institution','instansi','lembaga','penerbit']);
        const startIdx = findIdx(['start date','tanggal mulai','tanggal berlaku','masa berlaku','mulai berlaku','valid from','berlaku','tgl berlaku']);
        const expIdx = findIdx(['expired date','tanggal kedaluwarsa','masa kedaluwarsa','berakhir','valid until','kedaluwarsa','kedaluarsa','tanggal kedaluwarsa','tanggal kadaluarsa','kadaluarsa','tanggal kedai','tgl kedai','masa berlaku sampai','masa berlaku s/d','masa berlaku hingga']);
        const remIdx = findIdx(['remind date','tanggal pengingat','pengingat','reminder','reminder date','tanggal peringat','tgl pengingat']);

        const rows=[];
        for(let i=1;i<lines.length;i++){
          const cols=lines[i].split(delim);
          const name=(nameIdx>=0?cols[nameIdx]:'')||'';
          const document=(docIdx>=0?cols[docIdx]:'')||'';
          const type=(typeIdx>=0?cols[typeIdx]:'')||'';
          const institution=(instIdx>=0?cols[instIdx]:'')||'';
          const start_date=pDate(startIdx>=0?cols[startIdx]:null);
          const expired_date=pDate(expIdx>=0?cols[expIdx]:null);
          let remind_date=pDate(remIdx>=0?cols[remIdx]:null);
          if(!remind_date && expired_date){ const parts=String(expired_date).split('-'); if(parts.length===3){ const y=Number(parts[0]), m=Number(parts[1]), d=Number(parts[2]); const dt=new Date(Date.UTC(y,m-1,d)); dt.setUTCMonth(dt.getUTCMonth()-6); remind_date=dt.toISOString().slice(0,10); } }
          const statusCell=(cols[findIdx(['status'])]||'');
          const status=String(statusCell||'').toLowerCase().includes('inactive')?'Inactive':'Active';
          rows.push({ name, document, type, institution, start_date, expired_date, remind_date, status });
        }

        const existingSet = new Set();
        try {
          const existingRes = await fetch('/api/safety');
          if (existingRes.ok){
            const existing = await existingRes.json();
            existing.forEach(r=>{
              const k = `${String(r.name||'').trim().toLowerCase()}|${String(r.document||'').trim().toLowerCase()}|${String(r.institution||'').trim().toLowerCase()}`;
              existingSet.add(k);
            });
          }
        } catch {}

        const counts = new Map();
        rows.forEach(r=>{
          const k = `${String(r.name||'').trim().toLowerCase()}|${String(r.document||'').trim().toLowerCase()}|${String(r.institution||'').trim().toLowerCase()}`;
          if(k.replace(/\|/g,'').trim()) counts.set(k,(counts.get(k)||0)+1);
        });

        let dupFileTotal=0, dupDbTotal=0;
        const previewRows = rows.map(r=>{
          const k = `${String(r.name||'').trim().toLowerCase()}|${String(r.document||'').trim().toLowerCase()}|${String(r.institution||'').trim().toLowerCase()}`;
          const dup_in_file = (counts.get(k)||0) > 1;
          const dup_in_db = existingSet.has(k);
          if (dup_in_file) dupFileTotal++;
          if (dup_in_db) dupDbTotal++;
          return { ...r, dup_in_file, dup_in_db, invalid: !String(r.name||'').trim() || !String(r.document||'').trim() || !String(r.institution||'').trim() };
        });

        importUI.rows = previewRows;
        importUI.stats.textContent = `Total baris: ${previewRows.length} — Duplikat dalam file: ${dupFileTotal}, dalam database: ${dupDbTotal}`;
        importUI.selected.clear();
        importUI.rows.forEach((r,idx)=>{ if(!r.dup_in_file && !r.dup_in_db && !r.invalid) importUI.selected.add(idx); });
        renderPreviewTable();
      } catch(err){
        closeImportPreview();
        showToast('Preview failed: '+(j.error||res.status)+(j.detail?`\n${j.detail}`:''), 'error');
      }
      e.target.value='';
      return;
    }

    importUI.rows = j.preview || [];
    importUI.stats.textContent = `Total baris: ${j.total} — Duplikat dalam file: ${j.dup_in_file_total}, dalam database: ${j.dup_in_db_total}`;
    importUI.rows.forEach((r,idx)=>{ if(!r.dup_in_file && !r.dup_in_db) importUI.selected.add(idx); });
    renderPreviewTable(); e.target.value='';
  };
}

window.editItem = (id)=>{
  if (MODE!=='manage') return;
  const r = cache.find(x=>String(x.id)===String(id)); if(!r) return;
  currentId=id; f_name.value=r.name||''; f_document.value=r.document||''; f_category.value=r.type||''; f_institution.value=r.institution||'';
  f_start.value=fmtDate(r.start_date)||''; 
  f_exp.value=fmtDate(r.expired_date)||''; 
  if (r.remind_date) { f_rem.value = fmtDate(r.remind_date); } else { recomputeRemind(); }
  f_inactive.value = (String(r.status).toLowerCase()==='inactive') ? '1' : '0';
  openLayer('Edit Safety License');
};
window.delItem = async (id)=>{
  if (MODE!=='manage') return; if(!confirm('Hapus item ini?')) return;
  const r = await fetch(`${API}/${id}`,{method:'DELETE'}); if(!r.ok) showToast('Delete failed', 'error'); refresh();
};

const importUI = {
  layer: document.getElementById('importPreviewLayer'),
  backdrop: document.getElementById('importPreviewBackdrop'),
  btnClose: document.getElementById('btnClosePreview'),
  body: document.getElementById('previewBody'),
  stats: document.getElementById('importStats'),
  chkAll: document.getElementById('chkAll'),
  chkHideDup: document.getElementById('chkHideDup'),
  btnCommit: document.getElementById('btnCommitSelected'),
  rows: [], filteredIdx: [], selected: new Set()
};
function openImportPreview(){ importUI.layer.classList.remove('hidden'); }
function closeImportPreview(){ importUI.layer.classList.add('hidden'); }
function renderPreviewTable(){
  const hideDup = importUI.chkHideDup.checked; importUI.body.innerHTML=''; importUI.filteredIdx=[];
  importUI.rows.forEach((r,idx)=>{
    const isDup = r.dup_in_file || r.dup_in_db;
    if (hideDup && isDup) return;
    importUI.filteredIdx.push(idx);
    const dupLabel = isDup
      ? `<span class="px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300">${r.dup_in_file&&r.dup_in_db?'file & db':(r.dup_in_file?'file':'db')}</span>`
      : `<span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">tidak duplikat</span>`;
    const checked = importUI.selected.has(idx) ? 'checked' : '';
    const tr = document.createElement('tr'); tr.className = isDup ? 'bg-rose-50' : '';
    tr.innerHTML = `
      <td class="p-2"><input type="checkbox" class="rowchk accent-sky-600" data-idx="${idx}" ${checked}/></td>
      <td class="p-2">${r.name||''}</td>
      <td class="p-2">${r.document||''}</td>
      <td class="p-2">${r.type||r.category||''}</td>
      <td class="p-2">${r.institution||''}</td>
      <td class="p-2">${r.start_date||''}</td>
      <td class="p-2">${r.expired_date||''}</td>
      <td class="p-2">${r.remind_date||''}</td>
      <td class="p-2">${r.status||''}</td>
      <td class="p-2">${dupLabel}</td>`;
    importUI.body.appendChild(tr);
  });
  importUI.body.querySelectorAll('.rowchk').forEach(cb=>{
    cb.addEventListener('change',(e)=>{
      const idx = Number(e.target.getAttribute('data-idx'));
      if (e.target.checked) importUI.selected.add(idx); else importUI.selected.delete(idx);
      updateCommitButton();
    });
  });
  importUI.chkAll.checked = (importUI.filteredIdx.length>0 && importUI.filteredIdx.every(i=>importUI.selected.has(i)));
  updateCommitButton();
}
function updateCommitButton(){ importUI.btnCommit.textContent = `Simpan yang dipilih (${importUI.selected.size})`; }
importUI.chkHideDup.addEventListener('change', renderPreviewTable);
importUI.chkAll.addEventListener('change', ()=>{
  if (importUI.chkAll.checked) importUI.filteredIdx.forEach(i=>importUI.selected.add(i));
  else importUI.filteredIdx.forEach(i=>importUI.selected.delete(i));
  renderPreviewTable();
});
importUI.btnClose.addEventListener('click', closeImportPreview);
importUI.backdrop.addEventListener('click', closeImportPreview);

async function commitSelected(){
  if (!importUI.selected.size){
    showToast('No rows selected', 'info');
    return;
  }
  const rows = Array.from(importUI.selected).map(i => importUI.rows[i]);
  const res = await fetch(`${API}/import/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok){
    showToast('Commit failed: ' + (j.error || res.status) + (j.detail ? `\n${j.detail}` : ''), 'error');
    return;
  }
  showToast(`Imported ${j.imported || 0} rows`, 'success');
  closeImportPreview();
  refresh();
}
importUI.btnCommit.addEventListener('click', commitSelected);

function renderTopActionsInit(){ renderTopActions(); bindManageControls(); refresh(); }
renderTopActionsInit();
