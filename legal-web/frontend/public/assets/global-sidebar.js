(function(){
  const mountSidebar = async () => {
    try {
      if (!document.querySelector('link[href$="global-sidebar.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './assets/global-sidebar.css';
        document.head.appendChild(link);
      }
      const resp = await fetch('./assets/sidebar.html', { cache: 'no-cache' });
      const html = await resp.text();
      const temp = document.createElement('div');
      temp.innerHTML = html.trim();
      const sidebar = temp.firstElementChild;
      document.body.appendChild(sidebar);

      let pageToggle = document.getElementById('btnMenu');
      if (!pageToggle) {
        const fab = document.createElement('button');
        fab.id = 'btnMenu';
        fab.className = 'fixed top-4 left-4 z-50 p-3 bg-white shadow rounded-full text-gray-800 hover:bg-gray-100';
        fab.innerHTML = '<i class="fas fa-bars"></i>';
        document.body.appendChild(fab);
        pageToggle = fab;
      }

      const stateKey = 'globalSidebarOpen';
      const setOpen = (open) => {
        sidebar.classList.toggle('open', open);
        document.body.classList.toggle('sidebar-open', open);
        localStorage.setItem(stateKey, open ? '1' : '0');
      };

      const saved = localStorage.getItem(stateKey);
      setOpen(saved === '1');

      const toggle = () => setOpen(!sidebar.classList.contains('open'));
      sidebar.querySelector('#gsToggle')?.addEventListener('click', toggle);
      pageToggle.addEventListener('click', toggle);

    } catch (e) {
      console.warn('Failed to mount sidebar:', e);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountSidebar);
  } else {
    mountSidebar();
  }
})();
