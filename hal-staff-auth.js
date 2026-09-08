// HAL Garage: conecta el login interno existente con Supabase Auth sin exponer credenciales en el navegador.
(() => {
  const STAFF = {
    admin: { email: 'edhr28@gmail.com', role: 'admin' },
    supervisor: { email: 'halgaragecd@gmail.com', role: 'supervisor' },
    operario: { email: 'ccoritosbbc@gmail.com', role: 'operator' }
  };
  const SESSION_KEY = 'HAL_STAFF_SUPABASE_SESSION';

  async function applySession(session) {
    if (!session?.access_token || !session?.refresh_token) throw new Error('Sesión Supabase incompleta');
    const { data, error } = await db.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });
    if (error || !data?.session) throw error || new Error('No se pudo establecer la sesión');
    db.auth.startAutoRefresh?.();
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    }));
    return data.session;
  }

  async function verifyStaff(user, expectedRole) {
    if (!user?.id) throw new Error('Usuario no autenticado');
    const { data, error } = await db.from('profiles')
      .select('id,full_name,role,active')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data?.active || data.role !== expectedRole) {
      await db.auth.signOut().catch(() => {});
      localStorage.removeItem(SESSION_KEY);
      throw new Error('La cuenta no tiene un perfil interno activo autorizado.');
    }
    return data;
  }

  window.login = async function() {
    const k = document.getElementById('loginProfile')?.value;
    const p = document.getElementById('loginPass')?.value || '';
    const u = FIXED_USERS?.[k];
    const cfg = STAFF[k];
    const m = document.getElementById('loginMsg');
    if (!u || !cfg || !p) { if (m) m.textContent = 'Ingresa la contraseña.'; return; }
    if (m) m.textContent = 'Conectando con HAL Garage...';
    try {
      const { data, error } = await db.auth.signInWithPassword({ email: cfg.email, password: p });
      if (error || !data?.session || !data?.user) throw error || new Error('Credenciales incorrectas');
      const profile = await verifyStaff(data.user, cfg.role);
      await applySession(data.session);
      HAL_USER = { id: data.user.id, name: profile.full_name || u.name, role: profile.role };
      sessionStorage.setItem('HAL_FIXED_USER', k);
      document.getElementById('login')?.remove();
      document.getElementById('userLabel').textContent = HAL_USER.name + ' · ' + roleLabel(role());
      go(page || 'dashboard');
      toast('Sesión iniciada');
    } catch (e) {
      console.error(e);
      if (m) m.textContent = e?.message?.includes('perfil interno')
        ? 'Esta cuenta no está autorizada para el sistema interno.'
        : 'Credenciales incorrectas. Usa la contraseña de tu cuenta de HAL Garage.';
    }
  };

  const oldLogout = window.logout;
  window.logout = async function() {
    try { db.auth.stopAutoRefresh?.(); await db.auth.signOut(); } catch (_) {}
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('HAL_FIXED_USER');
    HAL_USER = null;
    document.getElementById('userLabel').textContent = 'Sin sesión';
    return oldLogout?.apply(this, arguments);
  };

  (async () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        // El login antiguo no cuenta como autenticación: obligamos a usar Supabase Auth.
        if (HAL_USER) {
          HAL_USER = null;
          sessionStorage.removeItem('HAL_FIXED_USER');
          document.getElementById('userLabel').textContent = 'Sin sesión';
          showLogin();
        }
        return;
      }
      const session = await applySession(JSON.parse(raw));
      const { data, error } = await db.auth.getUser(session.access_token);
      if (error || !data?.user) throw error || new Error('Sesión inválida');
      const k = Object.keys(STAFF).find(x => STAFF[x].email === data.user.email);
      if (!k) throw new Error('Cuenta no autorizada');
      const profile = await verifyStaff(data.user, STAFF[k].role);
      HAL_USER = { id: data.user.id, name: profile.full_name || FIXED_USERS[k].name, role: profile.role };
      sessionStorage.setItem('HAL_FIXED_USER', k);
      document.getElementById('userLabel').textContent = HAL_USER.name + ' · ' + roleLabel(role());
      go(page || 'dashboard');
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem('HAL_FIXED_USER');
      HAL_USER = null;
      document.getElementById('userLabel').textContent = 'Sin sesión';
      showLogin();
      console.warn('HAL Staff Auth:', e);
    }
  })();
})();
