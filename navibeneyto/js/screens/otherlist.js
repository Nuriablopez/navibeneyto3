// Lista de otra persona: deseos + reservas, pistas y chat secreto
import { PEOPLE, getPerson } from '../config.js';
import {
  listWishes, listGiftsFor, joinGift, leaveGift, updateGift, setReaction,
  getHints, watchComments, addComment,
} from '../db.js';
import {
  esc, safeUrl, hostOf, euros, avatar, sticker, toast, confirmDialog, openSheet,
  STATUS, shareOf, pickSticker, reactionsRow, wishThumb, loadThumbs,
} from '../ui.js';
import { stickersOf, randomFrom } from '../stickers.js';

const names = (ids) => ids.map((id) => getPerson(id)?.name).filter(Boolean);
const joinNames = (list) => list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} y ${list.at(-1)}`;

export async function renderOtherList(app, me, owner, { tab = 'deseos', go, onCleanup }) {
  app.innerHTML = `
    <section class="screen screen-other">
      <div class="sticky-head">
        <header class="topbar">
          <button class="back-btn" id="back">‹ Inicio</button>
          <div class="topbar-who">${avatar(owner, 'sm')}<h1 class="topbar-title">${esc(owner.name)}</h1></div>
          <span class="topbar-spacer"></span>
        </header>
        <div class="segmented" role="tablist">
          <button data-tab="deseos" class="${tab === 'deseos' ? 'on' : ''}">🎁 Deseos</button>
          <button data-tab="pistas" class="${tab === 'pistas' ? 'on' : ''}">🕵️‍♀️ Pistas</button>
          <button data-tab="chat" class="${tab === 'chat' ? 'on' : ''}">💬 Chat</button>
        </div>
      </div>

      <div class="secret-banner">🤫 ${esc(owner.name)} no ve nada de lo que pase aquí</div>

      <div id="tab-body"><div class="loading-small">🎄</div></div>
    </section>
  `;
  app.querySelector('#back').addEventListener('click', () => go('inicio'));
  app.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => go(`lista/${owner.id}${b.dataset.tab === 'deseos' ? '' : '/' + b.dataset.tab}`)));

  const body = app.querySelector('#tab-body');
  if (tab === 'pistas') return renderHints(body, owner);
  if (tab === 'chat') return renderChat(body, me, owner, onCleanup);
  return renderWishes(body, me, owner);
}

// ------------------------------------------------------------
//  DESEOS + RESERVAS
// ------------------------------------------------------------
async function renderWishes(body, me, owner) {
  const [wishes, gifts] = await Promise.all([listWishes(owner.id), listGiftsFor(owner.id)]);
  const giftOf = (wishId) => gifts.find((g) => g.wishId === wishId);
  const free = wishes.filter((w) => !giftOf(w.id)).length;

  if (!wishes.length) {
    body.innerHTML = `
      <div class="empty">
        ${sticker(randomFrom(stickersOf(owner.id, { solo: true })).id, 'empty-sticker wiggle')}
        <h3>${esc(owner.name)} aún no ha pedido nada</h3>
        <p>Mientras tanto, puedes cotillear con las demás en el chat 👀</p>
      </div>`;
    return;
  }

  body.innerHTML = `
    <p class="list-hint">${wishes.length} ${wishes.length === 1 ? 'deseo' : 'deseos'} · ${free === 0 ? '¡todo reservado! 🎉' : `${free} sin reservar`}</p>
    <div class="wish-list">${wishes.map((w) => otherWishCard(w, giftOf(w.id), me)).join('')}</div>
  `;

  loadThumbs(body);
  const refresh = () => renderWishes(body, me, owner);
  body.querySelectorAll('.wish').forEach((card) => {
    const wish = wishes.find((w) => w.id === card.dataset.id);
    card.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      const gift = giftOf(wish.id);
      try {
        if (action === 'reserve') {
          await joinGift(wish, me.id);
          toast('¡Reservado! jejejej 🤫', randomFrom(stickersOf(owner.id)).id);
        }
        if (action === 'join') {
          await joinGift(wish, me.id);
          toast('¡Os lo regaláis a medias! 🤝', randomFrom(stickersOf(owner.id)).id);
        }
        if (action === 'manage') return openGiftSheet(wish, gift, me, refresh);
        if (action === 'react') {
          const picked = await pickSticker({ title: `Reacciona a "${wish.title}"`, allowRemove: !!wish.reactions?.[me.id], personId: owner.id });
          if (!picked) return;
          await setReaction(wish.id, me.id, picked === 'none' ? null : picked);
        }
        refresh();
      } catch (err) {
        toast(`Error: ${err.message}`);
      }
    });
  });
}

function otherWishCard(w, gift, me) {
  const link = safeUrl(w.link);
  const mine = gift?.participants.includes(me.id);
  const share = shareOf(gift);

  let giftBlock;
  if (!gift) {
    giftBlock = `<button class="btn btn-reserve btn-block" data-action="reserve">🎁 ¡Yo lo regalo!</button>`;
  } else {
    const who = gift.participants.map((id) => `<img class="mini-face" src="stickers/faces/${id}.webp" alt="">`).join('');
    const st = STATUS[gift.status] ?? STATUS.reservado;
    giftBlock = `
      <div class="gift-box ${mine ? 'gift-mine' : ''}">
        <div class="gift-who">
          <span class="faces">${who}</span>
          <span><b>${esc(joinNames(names(gift.participants)))}</b><small>${st.icon} ${st.label}${share ? ` · ${euros(share)}${gift.participants.length > 1 ? ' cada una' : ''}` : ''}</small></span>
        </div>
        ${mine
          ? `<button class="btn btn-ghost btn-sm" data-action="manage">Gestionar</button>`
          : `<button class="btn btn-ghost btn-sm" data-action="join">🤝 Me apunto</button>`}
      </div>`;
  }

  return `
    <article class="wish wish-other ${w.priority === 'top' ? 'wish-top' : ''} ${gift ? 'is-taken' : ''}" data-id="${esc(w.id)}">
      <div class="wish-row">
        ${wishThumb(w)}
        <div class="wish-body">
          <h3>${esc(w.title)}</h3>
          ${w.details ? `<p class="wish-details">${esc(w.details)}</p>` : ''}
          <div class="wish-meta">
            ${w.priority === 'top' ? '<span class="chip chip-top">❤️ Lo quiere muchísimo</span>' : '<span class="chip">🙂 Le haría ilusión</span>'}
            ${w.price ? `<span class="chip chip-price">~${euros(w.price)}</span>` : ''}
            ${w.exact ? '<span class="chip chip-exact">🎯 Exacto</span>' : '<span class="chip">💭 Idea</span>'}
          </div>
          ${link ? `<a class="wish-link" href="${esc(link)}" target="_blank" rel="noopener">🔗 ${esc(hostOf(link))} ↗</a>` : ''}
          ${w.note ? `<p class="wish-note">📝 ${esc(w.note)}</p>` : ''}
        </div>
      </div>
      ${giftBlock}
    </article>`;
}

// Hoja para gestionar un regalo en el que participo
function openGiftSheet(wish, gift, me, onDone) {
  let status = gift.status || 'reservado';
  const { el, close } = openSheet(`
    <div class="sheet-head">
      <h2>${esc(wish.title)}</h2>
      <button class="icon-btn" data-close aria-label="Cerrar">✕</button>
    </div>
    <form class="form">
      <div class="field">
        <span>¿Cómo va?</span>
        <div class="status-pick">
          ${Object.entries(STATUS).map(([k, s]) => `
            <button type="button" data-status="${k}" class="${k === status ? 'on' : ''}">
              <b>${s.icon}</b>${s.label}
            </button>`).join('')}
        </div>
      </div>
      <label class="field">
        <span>Precio real del regalo</span>
        <div class="input-suffix">
          <input name="price" inputmode="decimal" placeholder="0" value="${gift.price ?? ''}">
          <b>€</b>
        </div>
      </label>
      <div class="split-info" id="split"></div>
      <button class="btn btn-primary btn-block" type="submit">Guardar</button>
      <button class="btn btn-link btn-block btn-danger-text" type="button" data-leave>
        ${gift.participants.length > 1 ? 'Me borro de este regalo' : 'Quitar mi reserva'}
      </button>
    </form>
  `);
  const form = el.querySelector('form');
  const parsePrice = () => {
    const t = form.price.value.replace(',', '.').replace(/[^\d.]/g, '');
    const n = t ? Math.round(Number(t) * 100) / 100 : null;
    return Number.isFinite(n) ? n : null;
  };
  const paintSplit = () => {
    const n = gift.participants.length;
    const p = parsePrice();
    el.querySelector('#split').innerHTML = `
      <div class="faces">${gift.participants.map((id) => `<img class="mini-face" src="stickers/faces/${id}.webp" alt="">`).join('')}</div>
      <span>${n === 1 ? 'Lo regalas tú sola' : `Sois ${n}: ${esc(joinNames(names(gift.participants)))}`}
      ${p ? `<b>${euros(shareOf({ price: p, participants: gift.participants }))} cada una</b>` : ''}</span>`;
  };
  paintSplit();
  form.price.addEventListener('input', paintSplit);
  el.querySelector('[data-close]').addEventListener('click', close);
  el.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
    status = b.dataset.status;
    el.querySelectorAll('[data-status]').forEach((x) => x.classList.toggle('on', x === b));
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await updateGift(wish.id, { status, price: parsePrice() });
    close();
    const msgs = { reservado: 'Apuntado 📌', comprado: '¡Comprado! 🛍️', envuelto: '¡Envuelto y listo! 🎀' };
    toast(msgs[status], randomFrom(stickersOf(wish.owner)).id);
    onDone();
  });

  el.querySelector('[data-leave]').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: gift.participants.length > 1 ? '¿Te borras del regalo?' : '¿Quitar la reserva?',
      text: gift.participants.length > 1 ? 'Las demás seguirán con él.' : 'El deseo volverá a estar libre.',
      ok: 'Sí', danger: true,
      stickerId: randomFrom(stickersOf(wish.owner)).id,
    });
    if (!ok) return;
    await leaveGift(wish.id, me.id);
    close();
    toast('Hecho 👍');
    onDone();
  });
}

// ------------------------------------------------------------
//  PISTAS (solo lectura)
// ------------------------------------------------------------
const HINT_LABELS = {
  tallaTop: '👕 Camiseta / jersey', tallaBottom: '👖 Pantalón', pie: '👟 Pie', anillo: '💍 Anillo',
  colores: '🎨 Colores favoritos', gustos: '✨ Le gusta', no: '🙅‍♀️ Por favor, esto NO',
};

async function renderHints(body, owner) {
  const hints = await getHints(owner.id);
  const filled = Object.entries(HINT_LABELS).filter(([k]) => hints[k]);
  if (!filled.length) {
    body.innerHTML = `
      <div class="empty">
        ${sticker(randomFrom(stickersOf(owner.id)).id, 'empty-sticker wiggle')}
        <h3>Sin pistas todavía</h3>
        <p>${esc(owner.name)} no ha rellenado sus pistas 🔍</p>
      </div>`;
    return;
  }
  const sizes = filled.filter(([k]) => ['tallaTop', 'tallaBottom', 'pie', 'anillo'].includes(k));
  const texts = filled.filter(([k]) => !['tallaTop', 'tallaBottom', 'pie', 'anillo'].includes(k));
  body.innerHTML = `
    ${sizes.length ? `<div class="size-grid">${sizes.map(([k]) => `
      <div class="size-card"><small>${HINT_LABELS[k]}</small><b>${esc(hints[k])}</b></div>`).join('')}</div>` : ''}
    ${texts.map(([k]) => `
      <div class="card hint-card ${k === 'no' ? 'hint-no' : ''}">
        <small>${HINT_LABELS[k]}</small>
        <p>${esc(hints[k])}</p>
      </div>`).join('')}
  `;
}

// ------------------------------------------------------------
//  CHAT SECRETO (en tiempo real)
// ------------------------------------------------------------
function renderChat(body, me, owner, onCleanup) {
  body.innerHTML = `
    <div class="chat" id="chat"><div class="loading-small">💬</div></div>
    <form class="chat-bar" id="chat-form">
      <button type="button" class="chat-sticker-btn" id="sticker-btn" aria-label="Enviar sticker">😜</button>
      <input name="text" autocomplete="off" maxlength="400" placeholder="Escribe sin que ${esc(owner.name)} se entere…">
      <button class="chat-send" type="submit" aria-label="Enviar">➤</button>
    </form>
  `;
  const chat = body.querySelector('#chat');
  const form = body.querySelector('#chat-form');
  let first = true;

  const stop = watchComments(owner.id, (list) => {
    if (!list.length) {
      chat.innerHTML = `<div class="chat-empty">${sticker(randomFrom(stickersOf(owner.id)).id, 'chat-empty-sticker')}
        <p>Nadie ha dicho nada aún.<br>¡Empieza el cotilleo sobre ${esc(owner.name)}!</p></div>`;
      return;
    }
    let lastAuthor = null;
    chat.innerHTML = list.map((c) => {
      const author = getPerson(c.author);
      const mine = c.author === me.id;
      const showHead = c.author !== lastAuthor;
      lastAuthor = c.author;
      const time = new Date(c.createdAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `
        <div class="msg ${mine ? 'msg-mine' : ''} ${showHead ? 'msg-head' : ''}">
          ${!mine && showHead && author ? avatar(author, 'xs') : '<span class="msg-gap"></span>'}
          <div class="msg-content">
            ${!mine && showHead && author ? `<small class="msg-name" style="color:${author.color}">${esc(author.name)}</small>` : ''}
            ${c.stickerId ? sticker(c.stickerId, 'msg-sticker') : `<div class="msg-bubble">${esc(c.text)}</div>`}
            <small class="msg-time">${time}</small>
          </div>
        </div>`;
    }).join('');
    chat.lastElementChild?.scrollIntoView({ block: 'end', behavior: first ? 'auto' : 'smooth' });
    first = false;
  });
  onCleanup(stop);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = form.text.value.trim();
    if (!text) return;
    form.text.value = '';
    await addComment({ listOwner: owner.id, author: me.id, text, stickerId: null });
  });
  body.querySelector('#sticker-btn').addEventListener('click', async () => {
    const picked = await pickSticker({ title: 'Manda un sticker', personId: owner.id });
    if (picked && picked !== 'none') await addComment({ listOwner: owner.id, author: me.id, text: '', stickerId: picked });
  });
}