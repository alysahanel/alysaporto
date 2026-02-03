(function() {
  const API_BASE = '/api';

  document.addEventListener('DOMContentLoaded', () => {
    const ids = ['searchItem', 'searchItemSimple', 'itemSearch', 'dashboardItemSearch'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) setupAutocomplete(el);
    });
  });

  function setupAutocomplete(inputEl) {
    const dropdownId = `${inputEl.id}Dropdown`;
    let dropdown = document.getElementById(dropdownId);
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = dropdownId;
      dropdown.className = 'absolute left-0 right-0 bg-white border border-gray-200 rounded-md shadow z-50';
      dropdown.style.display = 'none';
      dropdown.style.maxHeight = '300px';
      dropdown.style.overflowY = 'auto';

      const parent = inputEl.parentNode;
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      parent.appendChild(dropdown);
    }

    let timer = null;
    inputEl.addEventListener('input', () => {
      const q = inputEl.value.trim();
      clearTimeout(timer);
      if (q.length < 1) return hide(dropdown);
      timer = setTimeout(() => fetchSuggestions(q, dropdown, inputEl), 250);
    });

    inputEl.addEventListener('focus', () => {
      const q = inputEl.value.trim();
      if (q.length >= 1) fetchSuggestions(q, dropdown, inputEl);
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !inputEl.contains(e.target)) hide(dropdown);
    });

    inputEl.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('a[data-suggestion]');
      let active = dropdown.querySelector('a[data-suggestion].bg-gray-100');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = active ? active.nextElementSibling : items[0];
        if (active) active.classList.remove('bg-gray-100');
        if (next) next.classList.add('bg-gray-100');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = active ? active.previousElementSibling : items[items.length - 1];
        if (active) active.classList.remove('bg-gray-100');
        if (prev) prev.classList.add('bg-gray-100');
      } else if (e.key === 'Enter') {
        if (active) {
          e.preventDefault();
          active.click();
        }
      } else if (e.key === 'Escape') {
        hide(dropdown);
      }
    });
  }

  async function fetchSuggestions(q, dropdown, inputEl) {
    const token = localStorage.getItem('token');
    try {
      let items = [];
      if (q.length >= 2) {
        const res = await fetch(`${API_BASE}/items/search?q=${encodeURIComponent(q)}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        items = (data && data.success && Array.isArray(data.data)) ? data.data : [];
      } else {
        const res = await fetch(`${API_BASE}/items`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        const all = (data && Array.isArray(data.data)) ? data.data : [];
        const qLower = q.toLowerCase();
        items = all.filter(it => String(it.item_name || '').toLowerCase().includes(qLower)).slice(0, 10);
      }
      render(dropdown, items, inputEl);
      show(dropdown);
    } catch (err) {
      console.error('Suggestion fetch failed:', err);
      dropdown.innerHTML = '<div class="p-2 text-sm text-red-600">Gagal memuat saran</div>';
      show(dropdown);
    }
  }

  function render(dropdown, items, inputEl) {
    let role = null;
    try {
      role = JSON.parse(localStorage.getItem('user') || '{}')?.role || null;
    } catch {}
    const showStock = role !== 'user';
    const showUnit = role !== 'user';

    if (!items.length) {
      dropdown.innerHTML = '<div class="p-2 text-sm text-gray-500">No items found</div>';
      return;
    }
    dropdown.innerHTML = items.map(item => {
      const stock = typeof item.stock === 'number' ? item.stock : Number(item.stock || 0);
      const unit = item.unit || '';
      const detail = item.detail || '';
      const code = item.item_id || '';
      let subLine = `${escapeHtml(code)}`;
      if (showStock) {
        subLine = `${escapeHtml(code)} · Stock: ${stock}${showUnit && unit ? ' ' + escapeHtml(unit) : ''}`;
      } else if (showUnit && unit) {
        subLine = `${escapeHtml(code)} · ${escapeHtml(unit)}`;
      }
      return `
        <a href="#" data-suggestion class="block p-2 border-b last:border-b-0 hover:bg-gray-100" data-item-id="${item.id}" data-item-name="${escapeHtml(item.item_name)}" data-item-code="${escapeHtml(code)}" data-unit="${escapeHtml(unit)}" data-detail="${escapeHtml(detail)}">
          <div class="flex justify-between">
            <div>
              <div class="font-medium text-gray-800">${escapeHtml(item.item_name)}</div>
              <div class="text-xs text-gray-500">${subLine}</div>
            </div>
            <div class="text-right text-xs text-gray-500">${escapeHtml(detail)}</div>
          </div>
        </a>
      `;
    }).join('');

    dropdown.querySelectorAll('a[data-suggestion]').forEach(a => {
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        const name = a.getAttribute('data-item-name');
        const id = a.getAttribute('data-item-id');
        const code = a.getAttribute('data-item-code');
        let unit = a.getAttribute('data-unit') || '';
        let detail = a.getAttribute('data-detail') || '';
        inputEl.value = name || '';
        inputEl.setAttribute('data-selected-item-id', id || '');
        inputEl.setAttribute('data-selected-item-code', code || '');

  
        if (!unit || !detail) {
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/items/${id}`, {
              headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
              credentials: 'include'
            });
            if (res.ok) {
              const json = await res.json();
              const item = json && json.data ? json.data : {};
              unit = unit || item.unit || '';
              detail = detail || item.detail || item.description || '';
            }
          } catch (err) {
            console.warn('Fallback fetch item detail failed:', err);
          }
        }

        inputEl.setAttribute('data-selected-item-unit', unit);
        inputEl.setAttribute('data-selected-item-detail', detail);
        hide(dropdown);
        triggerSearch(inputEl);
      });
    });
  }

  function triggerSearch(inputEl) {
    const q = inputEl.value;
  
    try {
      const evt = new CustomEvent('ga:item-selected', { detail: { query: q, inputId: inputEl.id } });
      inputEl.dispatchEvent(evt);
    } catch (err) {
      console.warn('Dispatch ga:item-selected failed:', err);
    }

    try {
      if (typeof window.searchItems === 'function') {
        if (window.searchItems.length >= 1) {
          window.searchItems(q);
        } else {
          window.searchItems();
        }
      }
      if (typeof window.searchItemFromDashboard === 'function') {
        window.searchItemFromDashboard();
      }
      if (typeof window.filterRequests === 'function') {
        window.filterRequests();
      }
    } catch (err) {
      console.warn('Trigger search handler failed:', err);
    }
  }

  function show(dropdown) { dropdown.style.display = 'block'; }
  function hide(dropdown) { dropdown.style.display = 'none'; }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }
})();