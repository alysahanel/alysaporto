const categoryTitles = {
    'undang-undang': 'Undang - Undang',
    'peraturan-pemerintah': 'Peraturan Pemerintah',
    'peraturan-presiden': 'Peraturan Presiden',
    'peraturan-daerah': 'Peraturan Daerah Provinsi dan Kabupaten/Kota',
    'peraturan-kawasan': 'Peraturan Kawasan Industri',
    'peraturan-lainnya': 'Peraturan Lainnya'
};

let regulationGrid;
let regulationDetail;
let detailTitle;
let detailTableBody;
let backBtn;
let hierarchyBtn;
let nextBtn;
let elibraryTable;
let thActions;
let btnEnterEdit;
let editToolbar;
let btnAddRow;
let btnExportCSV;
let btnImport;
let fileInput;
let btnExitEdit;

let currentCategory = null;
let rows = [];
let isEditing = false;
let autoRefreshDetailTimer = null;
let autoRefreshCountsTimer = null;
let currentPage = 1;
let pageSize = 50;
const LS_ELIB_PAGE_SIZE_KEY = 'elib_page_size';
const LS_ELIB_PAGE_KEY_PREFIX = 'elib_current_page_';
function getSavedElibPage(cat){ try { const v = Number(localStorage.getItem(LS_ELIB_PAGE_KEY_PREFIX + String(cat||'')) || 0); return v>0?v:1; } catch { return 1; } }
function saveElibPage(cat,page){ try { localStorage.setItem(LS_ELIB_PAGE_KEY_PREFIX + String(cat||''), String(page)); } catch {} }
let newRowIndex = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    setupEventListeners();
    const url = new URL(location.href);
    const initialCategory = url.searchParams.get('category');
    if (initialCategory) {
        showRegulationDetail(initialCategory);
        try {
            document.querySelectorAll('.regulation-card').forEach(c => c.classList.remove('primary-card'));
            const sel = document.querySelector(`.regulation-card[data-category="${CSS.escape(initialCategory)}"]`);
            if (sel) sel.classList.add('primary-card');
        } catch {}
    } else {
        showRegulationHierarchy();
    }
    setTimeout(addScrollAnimations, 100);
    if (typeof updateCategoryCounts === 'function') updateCategoryCounts();
    if (!initialCategory && typeof startCountsAutoRefresh === 'function') startCountsAutoRefresh();
});

function initializeElements() {
    regulationGrid = document.getElementById('regulationGrid');
    regulationDetail = document.getElementById('regulationDetail');
    detailTitle = document.getElementById('detailTitle');
    detailTableBody = document.getElementById('detailTableBody');
    backBtn = document.getElementById('backBtn');
    hierarchyBtn = document.getElementById('hierarchyBtn');
    nextBtn = document.getElementById('nextBtn');
    elibraryTable = document.getElementById('elibraryTable');
    thActions = document.getElementById('th-actions');
    btnEnterEdit = document.getElementById('btnEnterEdit');
    editToolbar = document.getElementById('editToolbar');
    btnAddRow = document.getElementById('btnAddRow');
    btnExportCSV = document.getElementById('btnExportCSV');
    btnImport = document.getElementById('btnImport');
    fileInput = document.getElementById('fileInput');
    btnExitEdit = document.getElementById('btnExitEdit');
    const pageSizeSel = document.getElementById('pageSizeSel');
    const savedPageSize = Number(localStorage.getItem(LS_ELIB_PAGE_SIZE_KEY) || 0);
    if (pageSizeSel) {
      if (savedPageSize && [25,50,100].includes(savedPageSize)) { pageSize = savedPageSize; pageSizeSel.value = String(savedPageSize); }
      pageSizeSel.addEventListener('change', async () => {
        pageSize = Number(pageSizeSel.value || 50);
        try { localStorage.setItem(LS_ELIB_PAGE_SIZE_KEY, String(pageSize)); } catch {}
        currentPage = 1;
        await refreshDetailPage();
      });
    }
}

function setupEventListeners() {
    const regulationCards = document.querySelectorAll('.regulation-card');
    regulationCards.forEach(card => {
        card.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            try {
                document.querySelectorAll('.regulation-card').forEach(c => c.classList.remove('primary-card'));
                this.classList.add('primary-card');
            } catch {}
            const url = new URL(location.href);
            url.searchParams.set('category', category);
            history.replaceState(null, '', url.toString());
            saveElibPage(category, 1);
            showRegulationDetail(category);
        });
        card.addEventListener('mouseenter', function() { this.style.transform = 'translateY(-5px)'; });
        card.addEventListener('mouseleave', function() { this.style.transform = 'translateY(0)'; });
    });

    if (backBtn) backBtn.addEventListener('click', () => {
        const url = new URL(location.href);
        url.searchParams.delete('category');
        history.replaceState(null, '', url.toString());
        if (currentCategory) saveElibPage(currentCategory, 1);
        showRegulationHierarchy();
    });
    if (hierarchyBtn) hierarchyBtn.addEventListener('click', () => {
        const url = new URL(location.href);
        url.searchParams.delete('category');
        history.replaceState(null, '', url.toString());
        if (currentCategory) saveElibPage(currentCategory, 1);
        showRegulationHierarchy();
    });
    const prevBtn = document.getElementById('prevBtn');
    const pageNoEl = document.getElementById('pageNo');
    if (nextBtn) nextBtn.addEventListener('click', async () => {
        const knownTotalPages = typeof window.ELibTotalPages === 'number' ? window.ELibTotalPages : null;
        const allowNext = knownTotalPages != null ? (currentPage < knownTotalPages) : (rows.length === pageSize);
        if (!allowNext) return;
        currentPage++;
        await refreshDetailPage();
        saveElibPage(currentCategory, currentPage);
    });
    if (prevBtn) prevBtn.addEventListener('click', async () => { if (currentPage > 1) { currentPage--; await refreshDetailPage(); saveElibPage(currentCategory, currentPage); } });

    if (btnEnterEdit) btnEnterEdit.addEventListener('click', () => setEditMode(true));
    if (btnExitEdit) btnExitEdit.addEventListener('click', async () => {
        setEditMode(false);
        if (currentCategory) {
            await saveCategoryToServer(currentCategory);
            const fresh = await loadCategoryFromServer(currentCategory);
            rows = normalizeRows(fresh || []);
            renderTable();
            updateCategoryCounts();
            startDetailAutoRefresh();
        }
    });
    if (btnAddRow) btnAddRow.addEventListener('click', addRow);
    if (btnExportCSV) btnExportCSV.addEventListener('click', exportCSV);
    if (btnImport) btnImport.addEventListener('click', () => fileInput && fileInput.click());
    if (fileInput) fileInput.addEventListener('change', handleImportCSV);

    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancel = document.getElementById('btnCancel');
    const btnDelete = document.getElementById('btnDelete');
    const btnSave = document.getElementById('btnSave');
    const modalBackdrop = document.getElementById('modalBackdrop');

    if (btnCloseModal) btnCloseModal.addEventListener('click', closeEditModal);
    if (btnCancel) btnCancel.addEventListener('click', closeEditModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeEditModal);
    if (btnDelete) btnDelete.addEventListener('click', deleteRowCurrent);
    if (btnSave) btnSave.addEventListener('click', saveRowFromModal);
}

function showRegulationHierarchy() {
    if (regulationGrid && regulationDetail) {
        regulationGrid.style.display = 'grid';
        regulationDetail.style.display = 'none';
        if (hierarchyBtn) hierarchyBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'block';
        currentCategory = null;
        rows = [];
        setEditMode(false);
        try { document.querySelectorAll('.regulation-card').forEach(c => c.classList.remove('primary-card')); } catch {}
        updateCategoryCounts();
        startCountsAutoRefresh();
        stopDetailAutoRefresh();
    }
}

function showRegulationDetail(category) {
    if (!regulationGrid || !regulationDetail || !detailTitle || !detailTableBody) {
        console.error('Required elements not found');
        return;
    }

    currentCategory = category;
    regulationGrid.style.display = 'none';
    regulationDetail.style.display = 'block';
    detailTitle.textContent = categoryTitles[category] || 'Regulation Detail';

    currentPage = getSavedElibPage(category);
    (async () => {
      try {
        const resp = await fetch('/api/elibrary-counts');
        const counts = resp.ok ? await resp.json() : null;
        const total = counts && counts[category] ? Number(counts[category]) : null;
        window.ELibTotalPages = total ? Math.ceil(total / pageSize) : null;
      } catch { window.ELibTotalPages = null; }
    })();

    loadCategoryFromServer(category).then(data => {
        rows = normalizeRows(data || []);
        renderTable();
        if (hierarchyBtn) hierarchyBtn.style.display = 'block';
        if (nextBtn) nextBtn.style.display = 'block';
        const prevBtn = document.getElementById('prevBtn');
        const pageNoEl = document.getElementById('pageNo');
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (pageNoEl) pageNoEl.textContent = String(currentPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        startDetailAutoRefresh();
        stopCountsAutoRefresh();
    }).catch(() => {
        rows = [];
        renderTable();
    });
}

function normalizeRows(list) {
    return (list || []).map((it, idx) => ({
        id: Number(it.id || 0),
        no: Number(it.no ?? idx + 1),
        departemen: String(it.departemen || ''),
        regulasi: String(it.regulasi || ''),
        lingkup: String(it.lingkup || ''),
        status: ((String((it.status || '')).toLowerCase().trim() === 'tidak berlaku')
              || (String((it.status || '')).toLowerCase().trim() === 'tidak-berlaku')
              || (String((it.status || '')).toLowerCase().trim() === 'not applicable'))
                ? 'Tidak Berlaku' : 'Berlaku',
        link: String(it.link || ''),
        notes: String(it.notes || '')
    }));
}

function renderTable() {
    if (!detailTableBody) return;
    detailTableBody.innerHTML = '';
    if (thActions) thActions.className = isEditing ? '' : 'hidden';
    if (elibraryTable) {
        elibraryTable.classList.remove('view-mode', 'edit-mode');
        elibraryTable.classList.add(isEditing ? 'edit-mode' : 'view-mode');
    }

    rows.forEach((item, idx) => {
        const tr = document.createElement('tr');
        const statusBadge = `<span class="status-${item.status.toLowerCase() === 'berlaku' ? 'active' : 'inactive'}">${item.status}</span>`;
        const aksi = isEditing ? `<button class="btn-edit" onclick="window.openEditModal(${idx})">Edit</button>` : '';
        const safeHref = item.link ? encodeURI(item.link) : '';
        const regulasiCell = item.link ? `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.regulasi)}</a>` : `${escapeHtml(item.regulasi)}`;
        const displayNo = ((currentPage - 1) * pageSize) + idx + 1;
        tr.innerHTML = `
            <td>${displayNo}</td>
            <td>${escapeHtml(item.departemen)}</td>
            <td>${regulasiCell}</td>
            <td>${escapeHtml(item.lingkup)}</td>
            <td>${statusBadge}</td>
            <td>${escapeHtml(item.notes)}</td>
            ${isEditing ? `<td>${aksi}</td>` : ''}
        `;
        detailTableBody.appendChild(tr);
    });
}

function setEditMode(flag) {
    isEditing = !!flag;
    if (editToolbar) {
        if (isEditing) editToolbar.classList.remove('hidden');
        else editToolbar.classList.add('hidden');
    }
    renderTable();
    if (currentCategory) {
        if (isEditing) stopDetailAutoRefresh();
        else startDetailAutoRefresh();
    }
}

function openEditModal(idx) {
    const editModal = document.getElementById('editModal');
    const modalBackdrop = document.getElementById('modalBackdrop');
    const fDepartemen = document.getElementById('fDepartemen');
    const fRegulasi = document.getElementById('fRegulasi');
    const fLingkup = document.getElementById('fLingkup');
    const fStatus = document.getElementById('fStatus');
    const fLink = document.getElementById('fLink');
    const fNotes = document.getElementById('fNotes');
    const row = rows[idx];
    if (!row) return;
    openEditModal.currentIndex = idx;
    if (fDepartemen) fDepartemen.value = row.departemen;
    if (fRegulasi) fRegulasi.value = row.regulasi;
    if (fLingkup) fLingkup.value = row.lingkup;
    if (fStatus) {
        const s = (row.status || '').toLowerCase();
        fStatus.value = (s === 'tidak berlaku' || s === 'tidak-berlaku' || s === 'not applicable') ? 'not-applicable' : 'applicable';
    }
    if (fLink) fLink.value = row.link || '';
    if (fNotes) fNotes.value = row.notes || '';
    if (editModal) { editModal.classList.remove('hidden'); editModal.classList.add('show'); }
    if (modalBackdrop) modalBackdrop.classList.remove('hidden');
}
window.openEditModal = openEditModal;

function closeEditModal() {
    const editModal = document.getElementById('editModal');
    const modalBackdrop = document.getElementById('modalBackdrop');
    if (editModal) { editModal.classList.remove('show'); editModal.classList.add('hidden'); }
    if (modalBackdrop) modalBackdrop.classList.add('hidden');
}

function createOrGetErrorEl(id) {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.style.color = '#c0392b';
        el.style.fontSize = '12px';
        el.style.marginTop = '4px';
        const fLink = document.getElementById('fLink');
        if (fLink && fLink.parentElement) fLink.parentElement.appendChild(el);
    }
    return el;
}

function clearErrorEl(id) {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
}

function isValidUrl(str) {
    try {
        const u = new URL(str);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.padding = '10px 14px';
        toast.style.borderRadius = '6px';
        toast.style.color = '#fff';
        toast.style.fontSize = '14px';
        toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        toast.style.zIndex = '10000';
        toast.style.transition = 'opacity 0.3s.ease';
        document.body.appendChild(toast);
    }
    toast.style.background = type === 'success' ? '#2ecc71' : '#e74c3c';
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 1800);
}

async function saveRowFromModal() {
    const idx = openEditModal.currentIndex;
    if (idx === undefined || !rows[idx]) return;
    const fDepartemen = document.getElementById('fDepartemen');
    const fRegulasi = document.getElementById('fRegulasi');
    const fLingkup = document.getElementById('fLingkup');
    const fStatus = document.getElementById('fStatus');
    const fLink = document.getElementById('fLink');
    const fNotes = document.getElementById('fNotes');

    let linkVal = (fLink && fLink.value || '').trim();
    if (linkVal) {
        if (!/^https?:\/\//i.test(linkVal) && /\w+\./.test(linkVal)) {
            const prefixed = 'https://' + linkVal;
            if (isValidUrl(prefixed)) { linkVal = prefixed; if (fLink) fLink.value = linkVal; }
        }
        if (!isValidUrl(linkVal)) {
            const err = createOrGetErrorEl('fLinkError');
            err.textContent = 'Link tidak valid. Gunakan format http(s)://...';
            return;
        } else {
            clearErrorEl('fLinkError');
        }
    } else {
        clearErrorEl('fLinkError');
    }

    rows[idx] = {
        ...rows[idx],
        departemen: (fDepartemen && fDepartemen.value || '').trim(),
        regulasi: (fRegulasi && fRegulasi.value || '').trim(),
        lingkup: (fLingkup && fLingkup.value || '').trim(),
        status: ((fStatus && fStatus.value) === 'not-applicable') ? 'Tidak Berlaku' : 'Berlaku',
        link: linkVal,
        notes: (fNotes && fNotes.value || '').trim()
    };
    
    closeEditModal();

    if (!currentCategory) return;
    try {
        const rowId = Number(rows[idx]?.id || 0);
        const dbNo = Number(rows[idx]?.no || 0);
        let j = null;
        if (newRowIndex === idx) {
            const resp = await fetch(`/api/elibrary/${encodeURIComponent(currentCategory)}/append`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify([rows[idx]]) });
            try { j = await resp.json(); } catch {}
            if (!resp.ok || (j && j.error)) throw new Error(j && j.detail ? j.detail : ('HTTP ' + resp.status));
            newRowIndex = null;
            try {
              const targetNo = j && Number(j.lastNo || 0) ? Number(j.lastNo) : null;
              if (targetNo) {
                const targetPage = Math.ceil(targetNo / pageSize);
                currentPage = targetPage;
                saveElibPage(currentCategory, currentPage);
              } else {
                const countsResp = await fetch('/api/elibrary-counts');
                const counts = countsResp.ok ? await countsResp.json() : null;
                const total = counts && counts[currentCategory] ? Number(counts[currentCategory]) : null;
                if (total) { currentPage = Math.ceil(total / pageSize); saveElibPage(currentCategory, currentPage); }
              }
            } catch {}
        } else {
            const targetUrl = rowId ? `/api/elibrary/${encodeURIComponent(currentCategory)}/id/${rowId}` : `/api/elibrary/${encodeURIComponent(currentCategory)}/${dbNo}`;
            const resp = await fetch(targetUrl, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(rows[idx]) });
            try { j = await resp.json(); } catch {}
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            if (j && j.error) throw new Error(j.error);
            if (j && Number(j.updated || 0) === 0) {
              const a = await fetch(`/api/elibrary/${encodeURIComponent(currentCategory)}/append`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify([rows[idx]]) });
              let aj = null; try { aj = await a.json(); } catch {}
              if (!a.ok || (aj && aj.error)) throw new Error(aj && aj.detail ? aj.detail : ('HTTP ' + a.status));
              newRowIndex = null;
              try {
                const targetNo = aj && Number(aj.lastNo || 0) ? Number(aj.lastNo) : null;
                if (targetNo) {
                  const targetPage = Math.ceil(targetNo / pageSize);
                  currentPage = targetPage;
                  saveElibPage(currentCategory, currentPage);
                } else {
                  const countsResp = await fetch('/api/elibrary-counts');
                  const counts = countsResp.ok ? await countsResp.json() : null;
                  const total = counts && counts[currentCategory] ? Number(counts[currentCategory]) : null;
                  if (total) { currentPage = Math.ceil(total / pageSize); saveElibPage(currentCategory, currentPage); }
                }
              } catch {}
            }
        }
        const fresh = await loadCategoryFromServer(currentCategory);
        rows = normalizeRows(fresh || []);
        renderTable();
        try {
          const targetNo = (j && Number(j.lastNo || 0)) ? Number(j.lastNo) : null;
          const idxOnPage = targetNo ? ((targetNo - 1) % pageSize) : null;
          if (idxOnPage != null && detailTableBody && detailTableBody.children[idxOnPage]) {
            detailTableBody.children[idxOnPage].style.background = '#e2f0ff';
            detailTableBody.children[idxOnPage].scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { if (detailTableBody.children[idxOnPage]) detailTableBody.children[idxOnPage].style.background = ''; }, 1500);
          }
        } catch {}
        if (typeof updateCategoryCounts === 'function') updateCategoryCounts();
        showToast('Data disimpan', 'success');
        setEditMode(false);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        startDetailAutoRefresh();
    } catch (e) {
        showToast('Gagal menyimpan ke server', 'error');
    }
}

async function deleteRowCurrent() {
    const idx = openEditModal.currentIndex;
    if (idx === undefined) return;

    const ok = confirm('Are you sure you want to delete this data?');
    if (!ok) return;
    const rowId = Number(rows[idx]?.id || 0);
    const dbNo = Number(rows[idx]?.no || 0);
    closeEditModal();
    if (!currentCategory || (!rowId && !dbNo)) return;
    try {
        const targetUrl = rowId ? `/api/elibrary/${encodeURIComponent(currentCategory)}/id/${rowId}` : `/api/elibrary/${encodeURIComponent(currentCategory)}/${dbNo}`;
        const resp = await fetch(targetUrl, { method:'DELETE' });
        let j = null; try { j = await resp.json(); } catch {}
        if (!resp.ok || (j && j.error)) throw new Error(j && j.error ? j.error : ('HTTP ' + resp.status));
        try { await fetch(`/api/elibrary/${encodeURIComponent(currentCategory)}/reindex`, { method:'POST' }); } catch {}
        try {
          const countsResp = await fetch('/api/elibrary-counts');
          const counts = countsResp.ok ? await countsResp.json() : null;
          const total = counts && counts[currentCategory] ? Number(counts[currentCategory]) : null;
          const totalPages = total ? Math.ceil(total / pageSize) : 1;
          if (currentPage > totalPages) { currentPage = totalPages; saveElibPage(currentCategory, currentPage); }
        } catch {}
        const fresh = await loadCategoryFromServer(currentCategory);
        rows = normalizeRows(fresh || []);
        renderTable();
        if (typeof updateCategoryCounts === 'function') updateCategoryCounts();
        showToast('Baris dihapus', 'success');
    } catch (e) {
        showToast('Gagal menghapus baris', 'error');
    }
}

function addRow() {
    const idx = rows.length;
    rows.push({ no: idx + 1, departemen: '', regulasi: '', lingkup: '', status: 'Berlaku', link: '', notes: '' });
    newRowIndex = idx;
    setEditMode(true);
    openEditModal(idx);
}

function exportCSV() {
    try {
        const headers = ['NO','DEPARTEMEN','REGULASI','LINGKUP REGULASI','STATUS','LINK','NOTES'];
        const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
        const lines = [headers.join(',')];
        rows.forEach(r => { const row = [r.no, r.departemen, r.regulasi, r.lingkup, r.status, r.link || '', r.notes || ''].map(esc).join(','); lines.push(row); });
        const csvContent = lines.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        a.href = url; a.download = `elibrary-${currentCategory || 'data'}-${date}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) { alert('Failed to export CSV: ' + e.message); }
}

function parseCSV(text) {
    const rows = []; let i = 0, cur = '', inQuotes = false; let row = [];
    const pushCell = (arr, cell) => arr.push(cell.replace(/^\s+|\s+$/g, ''));
    while (i < text.length) {
        const ch = text[i++];
        if (inQuotes) {
            if (ch === '"') { if (text[i] === '"') { cur += '"'; i++; } else inQuotes = false; }
            else { cur += ch; }
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ',') { pushCell(row, cur); cur = ''; }
            else if (ch === '\n') { pushCell(row, cur); rows.push(row); row = []; cur = ''; }
            else if (ch === '\r') { }
            else { cur += ch; }
        }
    }
    if (cur.length || row.length) { pushCell(row, cur); rows.push(row); }
    return rows;
}

function handleImportCSV(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    file.text().then(text => {
        try {
            const table = parseCSV(text);
            if (!table.length) throw new Error('Empty CSV');
            const headers = table[0].map(h => (h || '').trim().toLowerCase());
            const hasIndo = ['no','departemen','regulasi','lingkup regulasi','status'].every(col => headers.includes(col));
            const hasEng = ['no','department','regulation','regulation scope','status'].every(col => headers.includes(col));
            if (!hasIndo && !hasEng) throw new Error('Invalid headers. Use columns: NO, DEPARTMENT, REGULATION, REGULATION SCOPE, STATUS');
            const idx = (names) => {
              const arr = Array.isArray(names) ? names : [names];
              for (const n of arr) { const i = headers.indexOf(n); if (i >= 0) return i; }
              return -1;
            };
            const importedRows = table.slice(1).map((r, i) => ({
              no: Number(r[idx('no')]) || i + 1,
              departemen: (r[idx(['departemen','department'])] || '').trim(),
              regulasi: (r[idx(['regulasi','regulation'])] || '').trim(),
              lingkup: (r[idx(['lingkup regulasi','regulation scope'])] || '').trim(),
              status: ((r[idx('status')] || '').trim().toLowerCase() === 'not applicable'
                   || (r[idx('status')] || '').trim().toLowerCase() === 'tidak berlaku'
                   || (r[idx('status')] || '').trim().toLowerCase() === 'tidak-berlaku') ? 'Tidak Berlaku' : 'Berlaku',
              link: idx('link') >= 0 ? (r[idx('link')] || '').trim() : '',
              notes: idx('notes') >= 0 ? (r[idx('notes')] || '').trim() : ''
            }));
            try {
              localStorage.setItem('elibrary_import_review_data', JSON.stringify({ category: currentCategory, rows: importedRows }));
            } catch {}
            location.href = `elibrary-import-review.html?category=${encodeURIComponent(currentCategory || '')}`;
        } catch (e) { alert('Failed to read file: ' + e.message); event.target.value = ''; }
        finally { event.target.value = ''; }
    }).catch(err => { alert('Failed to read file: ' + err.message); event.target.value = ''; });
}

async function loadCategoryFromServer(category) {
    try {
        const resp = await fetch(`api/elibrary/${encodeURIComponent(category)}?limit=${pageSize}&page=${currentPage}`);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return await resp.json();
    } catch (e) {
        console.warn('Failed to load category from server', category, e && e.message);
        return [];
    }
}

async function refreshDetailPage() {
    const data = await loadCategoryFromServer(currentCategory);
    rows = normalizeRows(data || []);
    renderTable();
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageNoEl = document.getElementById('pageNo');
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    try {
      const resp = await fetch('/api/elibrary-counts');
      const counts = resp.ok ? await resp.json() : null;
      const total = counts && counts[currentCategory] ? Number(counts[currentCategory]) : null;
      const totalPages = total ? Math.ceil(total / pageSize) : null;
      window.ELibTotalPages = totalPages || null;
      if (nextBtn) nextBtn.disabled = totalPages ? (currentPage >= totalPages) : (rows.length < pageSize);
    } catch { if (nextBtn) nextBtn.disabled = rows.length < pageSize; }
    if (pageNoEl) pageNoEl.textContent = String(currentPage);
    if (currentCategory) saveElibPage(currentCategory, currentPage);
}

async function saveCategoryToServer(category) {
    try {
        const payload = rows.map((r, i) => ({ no: i + 1, departemen: r.departemen, regulasi: r.regulasi, lingkup: r.lingkup, status: r.status, link: r.link || '', notes: r.notes || '' }));
        const resp = await fetch(`/api/elibrary/${encodeURIComponent(category)}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        console.log('Saved elibrary category', category, data);
    } catch (e) { alert('Gagal menyimpan ke server: ' + (e && e.message)); }
}

function addScrollAnimations() {
    const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => { if (entry.isIntersecting) { entry.target.style.opacity = '1'; entry.target.style.transform = 'translateY(0)'; } });
    }, observerOptions);
    const cards = document.querySelectorAll('.regulation-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0'; card.style.transform = 'translateY(30px)';
        card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
        observer.observe(card);
    });
}

function formatRegulationText(text) { return text; }
function escapeHtml(s) { return String(s || '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])); }
function searchRegulations(query) { console.log('Searching for:', query); }

window.ELibrary = { showRegulationHierarchy, showRegulationDetail, searchRegulations };

async function updateCategoryCounts() {
    try {
        let counts = null;
        try {
            const resp = await fetch('/api/elibrary-counts');
            if (resp.ok) counts = await resp.json();
        } catch {}

        const cards = document.querySelectorAll('.regulation-card');
        const tasks = Array.from(cards).map(async (card) => {
            const cat = card.getAttribute('data-category');
            const countEl = card.querySelector('.regulation-count');
            if (!cat || !countEl) return;

            if (counts && typeof counts[cat] !== 'undefined') {
                countEl.textContent = `${Number(counts[cat] || 0)} Peraturan`;
                return;
            }
            try {
                const resp = await fetch(`/api/elibrary/${encodeURIComponent(cat)}`);
                let list = [];
                if (resp.ok) list = await resp.json();
                const n = Array.isArray(list) ? list.length : 0;
                countEl.textContent = `${n} Peraturan`;
            } catch (e) {
                countEl.textContent = `0 Peraturan`;
            }
        });
        await Promise.all(tasks);
    } catch (e) {
        console.warn('Gagal memperbarui jumlah kategori:', e && e.message);
    }
}

function startCountsAutoRefresh() {
    if (autoRefreshCountsTimer) return;
    autoRefreshCountsTimer = setInterval(() => {
        if (regulationGrid && regulationGrid.style.display !== 'none') {
            updateCategoryCounts();
        }
    }, 60000);
}

function stopCountsAutoRefresh() {
    if (autoRefreshCountsTimer) {
        clearInterval(autoRefreshCountsTimer);
        autoRefreshCountsTimer = null;
    }
}

function startDetailAutoRefresh() {
    if (!currentCategory || isEditing) return;
    stopDetailAutoRefresh();
    autoRefreshDetailTimer = setInterval(async () => {
        try {
            const fresh = await loadCategoryFromServer(currentCategory);
            const normalized = normalizeRows(fresh || []);
            const changed = JSON.stringify(normalized) !== JSON.stringify(rows);
            rows = normalized;
            if (changed) renderTable();
        } catch (e) {
        }
    }, 15000);
}

function stopDetailAutoRefresh() {
    if (autoRefreshDetailTimer) {
        clearInterval(autoRefreshDetailTimer);
        autoRefreshDetailTimer = null;
    }
}
