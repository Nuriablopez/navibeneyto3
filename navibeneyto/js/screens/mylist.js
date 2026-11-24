// Pantalla "Mi lista": mis deseos y mis pistas
import { listWishes, addWish, updateWish, deleteWish, getHints, setHints, getImage } from '../db.js';
import { PEOPLE } from '../config.js';
import { esc, safeUrl, hostOf, euros, sticker, toast, confirmDialog, openSheet, compressImage, reactionsRow, wishThumb, loadThumbs } from '../ui.js';
import { stickersOf, randomFrom } from '../stickers.js';

const PRIORITY = {
  top:    { label: '❤️ Lo quiero muchísimo', short: '❤️ Muchísimo' },
  normal: { label: '🙂 Me haría ilusión',    short: '🙂 Ilusión' },
};

export async function renderMyList(app, person, { tab = 'deseos', go }) {
  app.innerHTML = `
    <section class="screen screen-list">
      <div class="sticky-head">
        <header class="topbar">
          <button class="back-btn" id="back">‹ Inicio</button>
          <h1 class="topbar-title">Mi lista</h1>
          <span class="topbar-spacer"></span>
        </header>
        <div class="segmented" role="tablist">
          <button role="tab" data-tab="deseos" class="${tab === 'deseos' ? 'on' : ''}">🎁 Mis deseos</button>
          <button role="tab" data-tab="pistas" class="${tab === 'pistas' ? 'on' : ''}">🕵️‍♀️ Mis pistas</button>
        </div>
      </div>

      <div id="tab-body"><div class="loading-small">🎄</div></div>
    </section>
  `;
  app.querySelector('#back').addEventListener('click', () => go('inicio'));
  app.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => go(b.dataset.tab === 'pistas' ? 'mi-lista/pistas' : 'mi-lista')));

  const body = app.querySelector('#tab-body');
  if (tab === 'pistas') return renderHints(body, person);
  return renderWishes(body, person);
}

// ------------------------------------------------------------
//  DESEOS
// ------------------------------------------------------------
async function renderWishes(body, person) {
  const wishes = await listWishes(person.id);
  const total = wishes.reduce((s, w) => s + (Number(w.price) || 0), 0);

  body.innerHTML = `
    <p class="list-hint">Lo que las demás reserven no lo puedes saber (aunque seguro que Blanca y Ana lo intentarán) 😜</p>

    ${wishes.length === 0 ? `
      <div class="empty">
        ${sticker(randomFrom(stickersOf(person.id, { solo: true })).id, 'empty-sticker wiggle')}
        <h3>Tu lista está vacía</h3>
        <p>¡Pide algo, que es gratis!</p>
      </div>` : `
      <div class="wish-list">
        ${wishes.map(wishCard).join('')}
      </div>
      <p class="list-total">${wishes.length} ${wishes.length === 1 ? 'deseo' : 'deseos'}${total ? ` · unos ${euros(total)} en total` : ''}</p>
    `}

    <button class="fab" id="add">＋ Añadir deseo</button>
  `;

  body.querySelector('#add').addEventListener('click', () =>
    openWishForm(person, null, () => renderWishes(body, person)));
  loadThumbs(body);

  body.querySelectorAll('.wish').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return; // el enlace a la tienda se abre sin más
      const wish = wishes.find((w) => w.id === card.dataset.id);
      openWishForm(person, wish, () => renderWishes(body, person));
    });
  });
}

function wishCard(w) {
  const link = safeUrl(w.link);
  return `
    <article class="wish ${w.priority === 'top' ? 'wish-top' : ''}" data-id="${esc(w.id)}">
      ${wishThumb(w)}
      <div class="wish-body">
        <h3>${esc(w.title)}</h3>
        ${w.details ? `<p class="wish-details">${esc(w.details)}</p>` : ''}
        <div class="wish-meta">
          <span class="chip">${PRIORITY[w.priority]?.short ?? PRIORITY.normal.short}</span>
          ${w.price ? `<span class="chip chip-price">~${euros(w.price)}</span>` : ''}
          ${w.exact ? '<span class="chip chip-exact">🎯 Exacto</span>' : '<span class="chip">💭 Idea</span>'}
        </div>
        ${link ? `<a class="wish-link" href="${esc(link)}" target="_blank" rel="noopener">🔗 ${esc(hostOf(link))} ↗</a>` : ''}
        ${reactionsRow(w.reactions, PEOPLE)}
      </div>
      <span class="wish-edit" aria-hidden="true">✏️</span>
    </article>`;
}

// Formulario para crear o editar un deseo
function openWishForm(person, wish, onDone) {
  const isEdit = !!wish;
  const w = wish ?? { title: '', exact: false, link: '', details: '', price: '', priority: 'normal', note: '', image: '' };
  let image = w.image || '';
  let imageChanged = false;
  let exact = !!w.exact;

  const { el, close } = openSheet(`
    <div class="sheet-head">
      <h2>${isEdit ? 'Editar deseo' : 'Nuevo deseo'}</h2>
      <button class="icon-btn" data-close aria-label="Cerrar">✕</button>
    </div>
    <form class="form" novalidate>
      <label class="field">
        <span>¿Qué te gustaría?</span>
        <input name="title" required maxlength="80" placeholder="Ej: Un jersey calentito" value="${esc(w.title)}">
      </label>

      <div class="field">
        <span>¿Sabes exactamente cuál? (si es así, pon el enlace)</span>
        <div class="segmented segmented-sm">
          <button type="button" data-exact="0" class="${!exact ? 'on' : ''}">💭 Es una idea</button>
          <button type="button" data-exact="1" class="${exact ? 'on' : ''}">🎯 Sé cuál es</button>
        </div>
      </div>

      <label class="field exact-only" ${exact ? '' : 'hidden'}>
        <span>Enlace de la tienda</span>
        <input name="link" type="url" inputmode="url" autocapitalize="off" autocorrect="off"
               placeholder="Pega aquí el link" value="${esc(w.link)}">
      </label>

      <label class="field">
        <span class="details-label">${exact ? 'Talla, color, modelo…' : 'Pistas para acertar (opcional)'}</span>
        <input name="details" maxlength="120" value="${esc(w.details)}"
               placeholder="${exact ? 'Ej: Talla M, color rosa' : 'Ej: de Zara o Mango, tonos neutros'}">
      </label>

      <label class="field">
        <span>Precio aproximado (opcional)</span>
        <div class="input-suffix">
          <input name="price" inputmode="decimal" placeholder="0" value="${w.price ?? ''}">
          <b>€</b>
        </div>
      </label>

      <div class="field">
        <span>¿Cuánta ilusión te hace?</span>
        <div class="priority-pick">
          ${Object.entries(PRIORITY).map(([k, p]) => `
            <label class="radio-card">
              <input type="radio" name="priority" value="${k}" ${w.priority === k ? 'checked' : ''}>
              <span>${p.label}</span>
            </label>`).join('')}
        </div>
      </div>

      <div class="field">
        <span>Foto (opcional)</span>
        <div class="photo-pick">
          <div class="photo-preview">${image ? `<img src="${esc(image)}" alt="">` : '📷'}</div>
          <div class="photo-actions">
            <label class="btn btn-ghost btn-sm">
              ${image ? 'Cambiar foto' : 'Añadir foto'}
              <input type="file" accept="image/*" hidden name="photo">
            </label>
            <button type="button" class="btn btn-link btn-sm" data-remove-photo ${image ? '' : 'hidden'}>Quitar</button>
          </div>
        </div>
      </div>

      <label class="field">
        <span>Algo más que deban saber (opcional)</span>
        <textarea name="note" rows="2" maxlength="300" placeholder="Ej: si no hay en verde, en azul también vale">${esc(w.note)}</textarea>
      </label>

      <p class="form-error" hidden></p>

      <button class="btn btn-primary btn-block" type="submit">${isEdit ? 'Guardar cambios' : 'Añadir a mi lista'}</button>
      ${isEdit ? '<button class="btn btn-link btn-block btn-danger-text" type="button" data-delete>Borrar este deseo</button>' : ''}
    </form>
  `);

  const form = el.querySelector('form');
  const $ = (s) => el.querySelector(s);
  el.querySelector('[data-close]').addEventListener('click', close);

  // Idea / exacto
  el.querySelectorAll('[data-exact]').forEach((b) => b.addEventListener('click', () => {
    exact = b.dataset.exact === '1';
    el.querySelectorAll('[data-exact]').forEach((x) => x.classList.toggle('on', x === b));
    $('.exact-only').hidden = !exact;
    $('.details-label').textContent = exact ? 'Talla, color, modelo…' : 'Pistas para acertar (opcional)';
    form.details.placeholder = exact ? 'Ej: Talla M, color verde botella' : 'Ej: de Zara o Mango, tonos neutros';
    if (exact) form.link.focus();
  }));

  // Foto
  const paintPhoto = () => {
    $('.photo-preview').innerHTML = image ? `<img src="${esc(image)}" alt="">` : '📷';
    $('[data-remove-photo]').hidden = !image;
  };
  form.photo.addEventListener('change', async () => {
    const file = form.photo.files[0];
    if (!file) return;
    try { image = await compressImage(file); imageChanged = true; paintPhoto(); }
    catch (err) { showError(err.message); }
  });
  $('[data-remove-photo]').addEventListener('click', () => { image = ''; imageChanged = true; paintPhoto(); });
  // Si la foto va aparte, se carga ahora (el formulario ya está abierto)
  if (!image && w.hasImage) {
    $('.photo-preview').innerHTML = '⏳';
    getImage(w.id).then((src) => { if (!imageChanged) { image = src; paintPhoto(); } });
  }

  function showError(msg) {
    const p = $('.form-error');
    p.textContent = msg;
    p.hidden = !msg;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = form.title.value.trim();
    if (!title) { showError('Ponle un nombre a tu deseo 🙂'); form.title.focus(); return; }

    const rawLink = form.link.value.trim();
    const link = exact ? safeUrl(rawLink) : '';
    if (exact && rawLink && !link) { showError('Ese enlace no parece válido'); return; }

    const priceText = form.price.value.replace(',', '.').replace(/[^\d.]/g, '');
    const price = priceText ? Math.round(Number(priceText) * 100) / 100 : null;

    const data = {
      owner: person.id,
      title,
      exact,
      link,
      details: form.details.value.trim(),
      price: Number.isFinite(price) ? price : null,
      priority: form.priority.value || 'normal',
      note: form.note.value.trim(),
      ...(isEdit ? (imageChanged ? { image } : {}) : { image }),
    };

    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      if (isEdit) await updateWish(wish.id, data);
      else await addWish(data);
      close();
      toast(isEdit ? 'Deseo actualizado ✨' : '¡Apuntado en tu lista! 🎁', randomFrom(stickersOf(person.id)).id);
      onDone();
    } catch (err) {
      showError(err.message);
      btn.disabled = false;
    }
  });

  el.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '¿Borrar este deseo?',
      text: `"${wish.title}" desaparecerá de tu lista.`,
      ok: 'Borrar', danger: true,
      stickerId: randomFrom(stickersOf(person.id)).id,
    });
    if (!ok) return;
    await deleteWish(wish.id);
    close();
    toast('Deseo borrado', randomFrom(stickersOf(person.id)).id);
    onDone();
  });
}

// ------------------------------------------------------------
//  PISTAS
// ------------------------------------------------------------
const HINT_FIELDS = [
  { key: 'tallaTop',    label: '👕 Talla de camiseta / jersey', placeholder: 'Ej: M' },
  { key: 'tallaBottom', label: '👖 Talla de pantalón',          placeholder: 'Ej: 38' },
  { key: 'pie',         label: '👟 Número de pie',              placeholder: 'Ej: 38' },
  { key: 'anillo',      label: '💍 Talla de anillo / pulsera',            placeholder: 'Ej: 14' },
  { key: 'colores',     label: '🎨 Colores favoritos',          placeholder: 'Ej: verde, morado, nada de rosa' },
  { key: 'gustos',      label: '✨ Cosas y marcas que me gustan', placeholder: 'Ej: Zara Home, libros, velas', long: true },
  { key: 'no',          label: '🙅‍♀️ Por favor, esto NI DE BROMA',          placeholder: 'Ej: Tía Ana, nada de zapatillas de estar por casa 😅', long: true },
];

async function renderHints(body, person) {
  const hints = await getHints(person.id);

  body.innerHTML = `
    <form class="form card hints-form">
      ${HINT_FIELDS.map((f) => `
        <label class="field ${f.key === 'no' ? 'field-no' : ''}">
          <span>${f.label}</span>
          ${f.long
            ? `<textarea name="${f.key}" rows="2" maxlength="300" placeholder="${esc(f.placeholder)}">${esc(hints[f.key])}</textarea>`
            : `<input name="${f.key}" maxlength="60" placeholder="${esc(f.placeholder)}" value="${esc(hints[f.key])}">`}
        </label>`).join('')}
      <button class="btn btn-primary btn-block" type="submit">Guardar pistas</button>
    </form>
  `;

  const form = body.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(HINT_FIELDS.map((f) => [f.key, form[f.key].value.trim()]));
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await setHints(person.id, data);
      toast('Pistas guardadas 🕵️‍♀️', randomFrom(stickersOf(person.id)).id);
    } catch (err) {
      toast(`Error: ${err.message}`);
    }
    btn.disabled = false;
  });
}
