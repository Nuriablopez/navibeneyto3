// Pantallas de entrada: "¿Quién eres?" y PIN
import { PEOPLE, getPerson } from '../config.js';
import { getPinHash, setPinHash } from '../db.js';
import { mountCountdown } from '../countdown.js';
import { avatar, sticker, toast } from '../ui.js';
import { MAIN_STICKER, stickersOf, randomFrom } from '../stickers.js';

async function hashPin(userId, pin) {
  const data = new TextEncoder().encode(`navibeneyto:${userId}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function renderWho(app, { onPick }) {
  app.innerHTML = `
    <section class="screen screen-who">
      <header class="brand">
        <h1>NaviBeneyto <span>2.0</span></h1>
        <p>Regalitos para las Beneytos 😏</p>
      </header>

      <div class="hero-sticker">${sticker('s10', 'float')}</div>

      <div class="countdown-pill" id="countdown"></div>

      <h2 class="section-title who-title">¿Quién eres?</h2>
      <div class="who-grid">
        ${PEOPLE.map((p) => `
          <button class="who-btn" data-id="${p.id}">
            ${avatar(p, 'lg')}
            <span>${p.name}</span>
          </button>`).join('')}
      </div>
    </section>
  `;
  mountCountdown(app.querySelector('#countdown'), { variant: 'pill' });
  app.querySelectorAll('.who-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      btn.classList.add('picked');
      setTimeout(() => onPick(getPerson(btn.dataset.id)), 180);
    }));
}

export async function renderPin(app, person, { onBack, onSuccess }) {
  const existing = await getPinHash(person.id);
  // modos: 'check' (ya tiene PIN), 'create' y 'confirm' (primera vez)
  const state = { mode: existing ? 'check' : 'create', pin: '', first: '', fails: 0 };

  const titles = {
    check: `¡Hola, ${person.name}!`,
    create: `¡Bienvenida, ${person.name}!`,
    confirm: 'Repite tu PIN',
  };
  const subtitles = {
    check: 'Mete tu PIN para entrar',
    create: 'Es tu primera vez: inventa un PIN de 4 números',
    confirm: 'Para asegurarnos de que lo recuerdas 😉',
  };

  app.innerHTML = `
    <section class="screen screen-pin">
      <button class="back-btn" id="back">‹ Volver</button>
      <div class="pin-sticker">${sticker(MAIN_STICKER[person.id], 'wiggle')}</div>
      <h2 id="pin-title"></h2>
      <p class="pin-sub" id="pin-sub"></p>
      <div class="pin-dots" id="dots">${'<i></i>'.repeat(4)}</div>
      <p class="pin-error" id="pin-error"></p>
      <div class="keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}
        <span></span>
        <button data-k="0">0</button>
        <button data-k="del" aria-label="Borrar">⌫</button>
      </div>
    </section>
  `;

  const $ = (sel) => app.querySelector(sel);
  const paint = () => {
    $('#pin-title').textContent = titles[state.mode];
    $('#pin-sub').textContent = subtitles[state.mode];
    [...$('#dots').children].forEach((d, i) => d.classList.toggle('on', i < state.pin.length));
  };
  const fail = (msg) => {
    $('#pin-error').textContent = msg;
    const dots = $('#dots');
    dots.classList.remove('shake');
    void dots.offsetWidth; // reinicia la animación
    dots.classList.add('shake');
    state.pin = '';
    paint();
  };

  async function complete() {
    if (state.mode === 'create') {
      state.first = state.pin; state.pin = ''; state.mode = 'confirm';
      $('#pin-error').textContent = '';
      return paint();
    }
    if (state.mode === 'confirm') {
      if (state.pin !== state.first) {
        state.mode = 'create'; state.first = '';
        return fail('No coinciden, vuelve a empezar');
      }
      await setPinHash(person.id, await hashPin(person.id, state.pin));
      return welcome();
    }
    if ((await hashPin(person.id, state.pin)) === existing) return welcome();

    state.fails++;
    fail('PIN incorrecto 🙈');
    // Al segundo fallo, alguien "sospecha"
    if (state.fails >= 2) {
      toast(`¿Seguro que eres ${person.name}? 🤨`, randomFrom(stickersOf(person.id)).id);
    }
  }

  function welcome() {
    toast(`¡Hola, ${person.name}! 🎄`, randomFrom(stickersOf(person.id)).id);
    onSuccess(person);
  }

  $('.keypad').addEventListener('click', (e) => {
    const k = e.target.closest('button')?.dataset.k;
    if (!k) return;
    if (k === 'del') state.pin = state.pin.slice(0, -1);
    else if (state.pin.length < 4) state.pin += k;
    paint();
    if (state.pin.length === 4) setTimeout(complete, 150);
  });
  $('#back').addEventListener('click', onBack);
  paint();
}
