// Mi presupuesto: lo que llevo gastado y en qué regalos estoy
import { PEOPLE, getPerson } from '../config.js';
import { listMyGifts, listAllWishes, getBudget, setBudget } from '../db.js';
import { esc, euros, avatar, sticker, toast, openSheet, STATUS, shareOf } from '../ui.js';
import { stickersOf, randomFrom } from '../stickers.js';

export async function myTotal(me) {
  const gifts = await listMyGifts(me.id);
  return gifts.reduce((s, g) => s + (shareOf(g) || 0), 0);
}

export async function renderBudget(app, me, { go }) {
  app.innerHTML = `
    <section class="screen screen-budget">
      <div class="sticky-head">
        <header class="topbar">
          <button class="back-btn" id="back">‹ Inicio</button>
          <h1 class="topbar-title">Mi presupuesto</h1>
          <span class="topbar-spacer"></span>
        </header>
      </div>
      <div id="body"><div class="loading-small">💰</div></div>
    </section>`;
  app.querySelector('#back').addEventListener('click', () => go('inicio'));

  const [gifts, wishes, budget] = await Promise.all([listMyGifts(me.id), listAllWishes(), getBudget(me.id)]);
  const total = gifts.reduce((s, g) => s + (shareOf(g) || 0), 0);
  const noPrice = gifts.filter((g) => !g.price).length;
  const pct = budget ? Math.min(100, Math.round((total / budget) * 100)) : 0;
  const over = budget && total > budget;
  const counts = Object.keys(STATUS).map((k) => [k, gifts.filter((g) => (g.status || 'reservado') === k).length]);

  const body = app.querySelector('#body');
  body.innerHTML = `
    <div class="card budget-card">
      ${sticker(randomFrom(stickersOf(me.id, { solo: true })).id, 'budget-sticker')}
      <small>Llevas gastado</small>
      <div class="budget-total">${euros(total) || '0 €'}</div>
      ${budget ? `
        <div class="bar ${over ? 'bar-over' : ''}"><i style="width:${pct}%"></i></div>
        <p class="budget-of">${over ? `😱 Te has pasado ${euros(total - budget)}` : `de ${euros(budget)} · te quedan ${euros(budget - total)}`}</p>` : ''}
      <button class="btn btn-link btn-sm" id="set-budget">${budget ? 'Cambiar mi límite' : '＋ Ponerme un límite'}</button>
      ${noPrice ? `<p class="budget-warn">⚠️ ${noPrice} ${noPrice === 1 ? 'regalo no tiene' : 'regalos no tienen'} precio todavía</p>` : ''}
    </div>

    <div class="status-counts">
      ${counts.map(([k, n]) => `<div><b>${n}</b><small>${STATUS[k].icon} ${STATUS[k].label}</small></div>`).join('')}
    </div>

    ${!gifts.length ? `
      <div class="empty">
        ${sticker(randomFrom(stickersOf(me.id)).id, 'empty-sticker wiggle')}
        <h3>Aún no has reservado nada</h3>
        <p>¿A qué esperas? 👀</p>
      </div>` :
      PEOPLE.filter((p) => p.id !== me.id).map((p) => {
        const mine = gifts.filter((g) => g.owner === p.id);
        if (!mine.length) return '';
        const sub = mine.reduce((s, g) => s + (shareOf(g) || 0), 0);
        return `
          <button class="budget-person" data-go="${p.id}">
            <div class="budget-person-head">${avatar(p, 'sm')}<b>Para ${esc(p.name)}</b><span>${euros(sub)}</span></div>
            ${mine.map((g) => {
              const w = wishes.find((x) => x.id === g.wishId);
              const others = g.participants.filter((id) => id !== me.id).map((id) => getPerson(id)?.name);
              const st = STATUS[g.status] ?? STATUS.reservado;
              return `
                <div class="budget-gift">
                  <span class="bg-status">${st.icon}</span>
                  <span class="bg-title">${esc(w?.title ?? g.wishTitle)}${!w ? ' <em>(lo ha borrado de su lista)</em>' : ''}
                    ${others.length ? `<small>a medias con ${esc(others.join(', '))}</small>` : ''}</span>
                  <b>${shareOf(g) ? euros(shareOf(g)) : '¿? €'}</b>
                </div>`;
            }).join('')}
          </button>`;
      }).join('')}
  `;

  body.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(`lista/${b.dataset.go}`)));
  body.querySelector('#set-budget').addEventListener('click', () => {
    const { el, close } = openSheet(`
      <div class="sheet-head"><h2>Mi límite</h2><button class="icon-btn" data-close>✕</button></div>
      <form class="form">
        <label class="field"><span>¿Cuánto quieres gastarte como mucho?</span>
          <div class="input-suffix"><input name="b" inputmode="decimal" placeholder="Ej: 150" value="${budget ?? ''}"><b>€</b></div>
        </label>
        <button class="btn btn-primary btn-block">Guardar</button>
        ${budget ? '<button type="button" class="btn btn-link btn-block" data-clear>Quitar límite</button>' : ''}
      </form>`);
    el.querySelector('[data-close]').addEventListener('click', close);
    const save = async (value) => {
      await setBudget(me.id, value);
      close();
      toast('Límite guardado 💰', randomFrom(stickersOf(me.id)).id);
      renderBudget(app, me, { go });
    };
    el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const n = Number(el.querySelector('[name=b]').value.replace(',', '.').replace(/[^\d.]/g, ''));
      save(n > 0 ? n : null);
    });
    el.querySelector('[data-clear]')?.addEventListener('click', () => save(null));
  });
}
