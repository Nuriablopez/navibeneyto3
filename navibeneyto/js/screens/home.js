// Pantalla de inicio
import { PEOPLE } from '../config.js';
import { countWishes, listGiftsFor, countComments, resetEverything } from '../db.js';
import { mountCountdown } from '../countdown.js';
import { avatar, sticker, euros, confirmDialog, toast } from '../ui.js';
import { STICKERS, randomFrom } from '../stickers.js';
import { myTotal } from './budget.js';

// Solo esta persona ve el botón de resetear
const ADMIN_ID = 'nuria';

const GREETINGS = [
  '¿Qué quieres este año?',
  'Recuerda: pedir es "gratis" 😌',
  'Ojo, que las demás están cotilleando 👀',
  'Este año no te regalan calcetines… creo',
  '¿Ya has escrito tu carta?',
  'Alguien ha reservado algo… 🤭',
  'Hay chat secreto. Úsalo con cabeza 😏',
];

export async function renderHome(app, person, { go, logout }) {
  const others = PEOPLE.filter((p) => p.id !== person.id);
  const daily = randomFrom(STICKERS); // pantalla principal: cualquier sticker

  app.innerHTML = `
    <section class="screen screen-home">
      <div class="sticky-head">
        <header class="topbar">
          <div class="topbar-user">${avatar(person, 'sm')}<span>Hola, <b>${person.name}</b></span></div>
          <button class="link-btn" id="logout">Salir</button>
        </header>
      </div>

      <div class="greeting">
        ${sticker(daily.id, 'greeting-sticker')}
        <div class="bubble">${randomFrom(GREETINGS)}</div>
      </div>

      <div class="card countdown-card" id="countdown"></div>

      <div class="tiles">
        <button class="tile tile-red" data-go="mi-lista">
          <span class="tile-icon">📝</span><b>Mi lista</b><small id="wish-count">…</small>
        </button>
        <button class="tile tile-green" data-go="presupuesto">
          <span class="tile-icon">💰</span><b>Mi presupuesto</b><small id="spent">…</small>
        </button>
      </div>

      <h2 class="section-title">Las listas de las demás</h2>
      <div class="others">
        ${others.map((p) => `
          <button class="other-row" data-go="lista/${p.id}">
            ${avatar(p, 'md')}
            <span>Lista de <b>${p.name}</b><small id="info-${p.id}">…</small></span>
            <span class="chat-count" id="chat-${p.id}" hidden></span>
            <span class="chev">›</span>
          </button>`).join('')}
      </div>
      ${person.id === ADMIN_ID ? `
        <button class="reset-btn" id="reset">🧨 Resetear todo</button>` : ''}
    </section>
  `;

  mountCountdown(app.querySelector('#countdown'), { variant: 'compact' });
  app.querySelector('#logout').addEventListener('click', logout);
  app.querySelector('#reset')?.addEventListener('click', () => resetAll(logout));
  app.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

  const set = (id, text) => { const el = app.querySelector(id); if (el) el.textContent = text; };

  // Datos (en paralelo). Ojo: nunca se piden los regalos ni el chat de MI lista.
  countWishes(person.id).then((n) =>
    set('#wish-count', n === 0 ? '¡Aún vacía!' : `${n} ${n === 1 ? 'deseo' : 'deseos'}`));
  myTotal(person).then((t) => set('#spent', t ? `${euros(t)} gastados` : 'Nada reservado aún'));

  others.forEach(async (p) => {
    // Solo se cuentan los deseos (no se descargan), así el inicio carga rápido
    const [n, gifts, chats] = await Promise.all([
      countWishes(p.id), listGiftsFor(p.id), countComments(p.id).catch(() => 0),
    ]);
    const free = Math.max(0, n - gifts.length);
    set(`#info-${p.id}`, n === 0
      ? 'Aún no ha pedido nada'
      : `${n} ${n === 1 ? 'deseo' : 'deseos'} · ${free === 0 ? 'todo reservado 🎉' : `${free} sin reservar`}`);
    const badge = app.querySelector(`#chat-${p.id}`);
    if (badge && chats) { badge.textContent = `💬 ${chats}`; badge.hidden = false; }
  });
}

// Borra TODO: PIN, pistas, deseos, reservas, chats y límites. Pide confirmar dos veces.
async function resetAll(logout) {
  const first = await confirmDialog({
    title: '¿Resetear TODO?',
    text: 'Se borran los PIN, las pistas, los deseos, las reservas, los chats y los presupuestos de las cinco.',
    ok: 'Continuar', danger: true,
  });
  if (!first) return;
  const second = await confirmDialog({
    title: '¿Segurísima? 😬',
    text: 'No se puede deshacer. Todas tendréis que crear vuestro PIN otra vez.',
    ok: 'Sí, borrar todo', danger: true,
  });
  if (!second) return;
  try {
    await resetEverything();
    toast('Todo borrado. ¡Empezamos de cero! 🎄');
    logout();
  } catch (err) {
    toast(`Error: ${err.message}`);
  }
}
