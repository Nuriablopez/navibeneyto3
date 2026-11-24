import { GIFT_MOMENT } from './config.js';

let timer = null;

// Calcula el próximo 24/12 a las 23:00 hora de Madrid.
// En diciembre Madrid está en UTC+1, así que restamos 1 hora para pasar a UTC.
function giftDate(year) {
  const { month, day, hour, minute } = GIFT_MOMENT;
  return new Date(Date.UTC(year, month - 1, day, hour - 1, minute));
}

function getState(now = new Date()) {
  const year = now.getUTCFullYear();
  const target = giftDate(year);
  const partyEnds = new Date(target.getTime() + 36 * 3600 * 1000); // hasta el 26 por la mañana

  if (now < target) return { phase: 'waiting', ms: target - now };
  if (now < partyEnds) return { phase: 'party' };
  return { phase: 'waiting', ms: giftDate(year + 1) - now };
}

const pad = (n) => String(n).padStart(2, '0');

// Pinta la cuenta atrás dentro de `el` y la actualiza cada segundo.
// variant: 'full' (con textos), 'compact' (solo cajitas) o 'pill' (una línea)
export function mountCountdown(el, { variant = 'full' } = {}) {
  clearInterval(timer);

  function render() {
    if (!el.isConnected) return clearInterval(timer);
    const s = getState();
    if (s.phase === 'party') {
      el.innerHTML = `<div class="countdown-party">🎉 ¡Feliz Navidad! 🎁</div>`;
      return;
    }
    const total = Math.floor(s.ms / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;

    if (variant === 'pill') {
      el.innerHTML = `<span class="pill-icon">🎁</span>
        <b>${d}</b>d <b>${pad(h)}</b>h <b>${pad(m)}</b>m <b>${pad(sec)}</b>s
        <span class="pill-sub">para el 24 a las 23:00</span>`;
      return;
    }

    const compact = variant === 'compact';
    el.innerHTML = `
      ${compact ? '' : '<p class="countdown-label">Faltan para abrir los regalos</p>'}
      <div class="countdown ${compact ? 'countdown-compact' : ''}">
        <div class="cd-box"><span>${d}</span><small>días</small></div>
        <div class="cd-box"><span>${pad(h)}</span><small>horas</small></div>
        <div class="cd-box"><span>${pad(m)}</span><small>min</small></div>
        <div class="cd-box"><span>${pad(sec)}</span><small>seg</small></div>
      </div>
      ${compact ? '' : '<p class="countdown-sub">24 de diciembre · 23:00 🎄</p>'}
    `;
  }

  render();
  timer = setInterval(render, 1000);
}
