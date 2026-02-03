let toastTimer = null;
let toastLockUntil = 0;

function getEls() {
  const toast = document.getElementById('toast');
  const toastInner = document.getElementById('toastInner');
  return { toast, toastInner };
}

function setToastType(toastInner, type) {
  toastInner.classList.remove('toast-success', 'toast-error', 'toast-info');

  if (type === 'success') toastInner.classList.add('toast-success');
  else if (type === 'error') toastInner.classList.add('toast-error');
  else toastInner.classList.add('toast-info');
}

export function showToast(msg, type = 'info', ms = 2200, sticky = false) {
  const { toast, toastInner } = getEls();
  if (!toast || !toastInner) return;

  const now = Date.now();
  if (!sticky && now < toastLockUntil) return;

  // penting: jangan overwrite class desain UI
  setToastType(toastInner, type);

  toastInner.textContent = msg;
  toast.classList.remove('hidden');

  clearTimeout(toastTimer);
  toastLockUntil = sticky ? now + ms : 0;

  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
    toastLockUntil = 0;
  }, ms);
}
