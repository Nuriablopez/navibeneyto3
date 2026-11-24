// ============================================================
//  ARRANQUE Y NAVEGACIÓN
//  Rutas (en la #almohadilla de la URL):
//    #/inicio · #/mi-lista · #/mi-lista/pistas · #/presupuesto
//    #/lista/{persona} · #/lista/{persona}/pistas · #/lista/{persona}/chat
// ============================================================
import { getPerson } from './config.js';
import { initDB, getPinHash } from './db.js';
import { startSnow } from './snow.js';
import { esc } from './ui.js';
import { renderWho, renderPin } from './screens/login.js';
import { renderHome } from './screens/home.js';
import { renderMyList } from './screens/mylist.js';
import { renderOtherList } from './screens/otherlist.js';
import { renderBudget } from './screens/budget.js';

const app = document.getElementById('app');
const SESSION_KEY = 'navibeneyto.session';

const session = {
  get: () => { try { return localStorage.getItem(SESSION_KEY); } catch { return null; } },
  set: (id) => { try { localStorage.setItem(SESSION_KEY, id); } catch {} },
  clear: () => { try { localStorage.removeItem(SESSION_KEY); } catch {} },
};

// Cosas que hay que apagar al cambiar de pantalla (p. ej. el chat en tiempo real)
let cleanups = [];
const onCleanup = (fn) => cleanups.push(fn);
function runCleanups() { cleanups.forEach((fn) => { try { fn(); } catch {} }); cleanups = []; }

const go = (route) => {
  const target = `#/${route}`;
  if (location.hash === target) handleRoute(); else location.hash = target;
};

function logout() {
  session.clear();
  history.replaceState(null, '', location.pathname);
  showLogin();
}

// Las pantallas de entrada ocupan justo la pantalla, sin scroll
function setFit(on) { app.classList.toggle('fit', on); document.body.classList.toggle('fit-body', on); }

function showLogin() {
  runCleanups();
  setFit(true);
  renderWho(app, {
    onPick: (person) => renderPin(app, person, {
      onBack: showLogin,
      onSuccess: (p) => { session.set(p.id); go('inicio'); },
    }),
  });
}

async function handleRoute() {
  runCleanups();
  const me = getPerson(session.get());
  if (!me) return showLogin();
  setFit(false);

  const [section, arg, sub] = (location.hash.replace(/^#\//, '') || 'inicio').split('/');
  window.scrollTo(0, 0);
  try {
    if (section === 'mi-lista') return await renderMyList(app, me, { tab: arg === 'pistas' ? 'pistas' : 'deseos', go });
    if (section === 'presupuesto') return await renderBudget(app, me, { go });
    if (section === 'lista') {
      const owner = getPerson(arg);
      if (!owner || owner.id === me.id) return go(owner ? 'mi-lista' : 'inicio'); // tu propia lista, nunca en modo "espía"
      return await renderOtherList(app, me, owner, { tab: sub || 'deseos', go, onCleanup });
    }
    return await renderHome(app, me, { go, logout });
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="card error-card">Algo ha fallado 😢<br><small>${esc(err.message)}</small><br><br>
      <button class="btn btn-primary" onclick="location.reload()">Reintentar</button></div>`;
  }
}

async function start() {
  startSnow(document.getElementById('snow'));
  app.innerHTML = `<div class="loading">🎄</div>`;
  try {
    await initDB();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="card error-card">No se pudo conectar con la base de datos 😢<br><small>${esc(err.message)}</small></div>`;
    return;
  }
  // Si la usuaria guardada ya no tiene PIN (p. ej. tras un reset), vuelve a la entrada
  const saved = session.get();
  if (saved && !(await getPinHash(saved).catch(() => 'error'))) session.clear();

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

start();
