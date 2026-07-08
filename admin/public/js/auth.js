const TOKEN_KEY = 'ndg_token';

async function login(username, password) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.token) return false;
    localStorage.setItem(TOKEN_KEY, data.token);
    window.location.replace('/dashboard.html');
    return true;
  } catch {
    return false;
  }
}

function checkAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.replace('/login.html');
    return null;
  }
  // Verifica expiración leyendo el payload (sin librería)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      logout();
      return null;
    }
  } catch {
    logout();
    return null;
  }
  return token;
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.replace('/login.html');
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    logout();
    return null;
  }
  return res;
}

// ── Logo de marca en el sidebar ──────────────────────────────────
async function loadLogo() {
  const icon = document.querySelector('.sidebar__brand-icon');
  if (!icon) return;
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch('/api/settings/logo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.exists) {
      icon.innerHTML = `<img src="${data.url}?t=${Date.now()}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" />`;
    }
  } catch {
    // Si falla, se conserva el icono por defecto
  }
}

loadLogo();
