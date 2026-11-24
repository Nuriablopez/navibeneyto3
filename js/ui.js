// ============================================================
//  PIEZAS DE INTERFAZ REUTILIZABLES
// ============================================================
import { faceOf, getSticker } from './stickers.js';
import { dbMode } from './db.js';

// Evita que un texto escrito por alguien rompa el HTML
export function esc(text = '') {
  return String(text).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Solo dejamos enlaces http(s)
export function safeUrl(url = '') {
  const value = url.trim();
  if (!value) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
  } catch { return ''; }
}

export const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

export const euros = (n) =>
  n == null || n === '' ? '' : `${Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;

// Avatar redondo con la cara
export function avatar(person, size = 'md') {
  return `<div class="avatar avatar-${size}" style="--c:${person.color}">
    <img src="${faceOf(person.id)}" alt="" loading="lazy">
  </div>`;
}

// Sticker recortado (con su borde blanco)
export function sticker(id, cls = '') {
  const s = getSticker(id);
  return s ? `<img class="sticker ${cls}" src="${s.src}" alt="" loading="lazy" draggable="false">` : '';
}

export function demoBadge() {
  return dbMode() === 'local'
    ? `<div class="demo-badge">Modo prueba · los datos solo se guardan en este móvil</div>`
    : '';
}

// Aviso flotante con un sticker que "salta"
let toastTimer;
export function toast(message, stickerId) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${stickerId ? sticker(stickerId, 'toast-sticker') : ''}<span>${esc(message)}</span>`;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

// Diálogo de confirmación bonito (en vez del confirm() del navegador)
export function confirmDialog({ title, text, ok = 'Sí', cancel = 'Cancelar', stickerId, danger = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true">
        ${stickerId ? sticker(stickerId, 'dialog-sticker') : ''}
        <h3>${esc(title)}</h3>
        ${text ? `<p>${esc(text)}</p>` : ''}
        <div class="dialog-actions">
          <button class="btn btn-ghost" data-r="0">${esc(cancel)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-r="1">${esc(ok)}</button>
        </div>
      </div>`;
    wrap.addEventListener('click', (e) => {
      const r = e.target.closest('[data-r]')?.dataset.r;
      if (r === undefined && e.target !== wrap) return;
      wrap.remove();
      resolve(r === '1');
    });
    document.body.appendChild(wrap);
  });
}

// Hoja que sube desde abajo (formularios). Devuelve el elemento y una función para cerrarla.
export function openSheet(innerHtml) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop sheet-backdrop';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${innerHtml}</div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  const close = () => {
    wrap.classList.add('closing');
    document.body.classList.remove('no-scroll');
    setTimeout(() => wrap.remove(), 250);
  };
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  return { el: wrap.querySelector('.sheet'), close };
}

// Reduce una foto del carrete a ~700px en JPEG para que ocupe poco
export function compressImage(file, maxSize = 700, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

// ------------------------------------------------------------
//  Regalos: estados y reparto
// ------------------------------------------------------------
export const STATUS = {
  reservado: { label: 'Reservado', icon: '📌' },
  comprado:  { label: 'Comprado',  icon: '🛍️' },
  envuelto:  { label: 'Envuelto',  icon: '🎀' },
};

// Lo que pone cada una (reparto a partes iguales)
export function shareOf(gift) {
  if (!gift?.price || !gift.participants?.length) return null;
  return Math.round((gift.price / gift.participants.length) * 100) / 100;
}

// Selector de stickers. Resuelve con el id elegido, 'none' para quitar, o null si se cierra.
// `personId`: solo enseña stickers donde sale esa persona (en su lista)
export function pickSticker({ title = 'Elige un sticker', allowRemove = false, personId = null } = {}) {
  return import('./stickers.js').then(({ STICKERS }) => new Promise((resolve) => {
    const options = personId ? STICKERS.filter((s) => s.people.includes(personId)) : STICKERS;
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const { el, close } = openSheet(`
      <div class="sheet-head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn" data-close aria-label="Cerrar">✕</button>
      </div>
      <div class="sticker-grid">
        ${options.map((s) => `<button class="sticker-opt" data-s="${s.id}">${sticker(s.id)}</button>`).join('')}
      </div>
      ${allowRemove ? '<button class="btn btn-link btn-block" data-s="none">Quitar mi reacción</button>' : ''}
    `);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]');
      if (b) { finish(b.dataset.s); close(); }
      if (e.target.closest('[data-close]')) { finish(null); close(); }
    });
    el.parentElement.addEventListener('click', (e) => { if (e.target === el.parentElement) finish(null); });
  }));
}

// Fila de reacciones (stickers pequeñitos con la cara de quién reaccionó)
export function reactionsRow(reactions = {}, people) {
  const list = Object.entries(reactions);
  if (!list.length) return '';
  return `<div class="reactions">${list.map(([pid, sid]) => {
    const p = people.find((x) => x.id === pid);
    return p ? `<span class="reaction" title="${esc(p.name)}">${sticker(sid)}<img class="reaction-face" src="${faceOf(pid)}" alt=""></span>` : '';
  }).join('')}</div>`;
}
