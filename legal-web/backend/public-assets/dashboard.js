(function(){
  const sidebar = document.getElementById('sidebar');
  const btnToggle = document.getElementById('btnToggle');
  const btnMenu = document.getElementById('btnMenu');

  const toggle = () => {
    if (!sidebar) return;
    sidebar.classList.toggle('open');
  };
  if (window.innerWidth > 960) {
    sidebar && sidebar.classList.add('open');
  }

  if (btnToggle) btnToggle.addEventListener('click', toggle);
  if (btnMenu) btnMenu.addEventListener('click', toggle);
})();