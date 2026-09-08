// HAL Garage: conecta el login interno existente con Supabase Auth.
(() => {
  const STAFF = {
    admin: { email: 'edhr28@gmail.com', role: 'admin' },
    supervisor: { email: 'halgaragecd@gmail.com', role: 'supervisor' },
    operario: { email: 'ccoritosbbc@gmail.com', role: 'operator' }
  };
  const SESSION_KEY = 'HAL_STAFF_SUPABASE_SESSION';

  async function applySession(session) {
    if (!session?.access_token || !session?.refresh_token) throw new Error('Sesión Supabase incompleta');
    const { data, error } = await db.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    if (error || !data?.session) throw error || new Error('No se pudo establecer la sesión');
    localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }));
    return data.session;
  }

  window.login = async function() {
    const k = document.getElementById('loginProfile')?.value;
    const p = document.getElementById('loginPass')?.value || '';
    const u = FIXED_USERS?.[k];
    const m = document.getElementById('loginMsg');
    const cfg = STAFF[k];
    if (!u || !cfg || !p) { if (m) m.textContent = 'Ingresa la contraseña.'; return; }
    if (m) m.textContent = 'Conectando...';
    try {
      const { data, error } = await db.auth.signInWithPassword({ email: cfg.email, password: p });
      if (error || !data?.session) throw error || new Error('Credenciales incorrectas');
      await applySession(data.session);
      HAL_USER = { id: data.user.id, name: u.name, role: u.role };
      sessionStorage.setItem('HAL_FIXED_USER', k);
      document.getElementById('login')?.remove();
      document.getElementById('userLabel').textContent = HAL_USER.name + ' · ' + roleLabel(role());
      go(page);
      toast('Sesión iniciada');
    } catch (e) {
      console.error(e);
      if (m) m.textContent = 'Credenciales incorrectas o cuenta interna no sincronizada.';
    }
  };

  const oldLogout = window.logout;
  window.logout = async function() {
    try { await db.auth.signOut(); } catch (_) {}
    localStorage.removeItem(SESSION_KEY);
    return oldLogout?.apply(this, arguments);
  };

  (async () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const session = JSON.parse(raw);
      await applySession(session);
      if (HAL_USER) {
        const { data } = await db.auth.getUser();
        if (data?.user?.id) HAL_USER.id = data.user.id;
        document.getElementById('userLabel').textContent = HAL_USER.name + ' · ' + roleLabel(role());
        go(page || 'dashboard');
      }
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
      console.warn('HAL Staff Auth:', e);
    }
  })();
})();
