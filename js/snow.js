// Nieve cayendo en un <canvas> de fondo. Ligera para que no gaste batería.
export function startSnow(canvas) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  let w, h, flakes;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(90, (w * h) / 9000));
    flakes = Array.from({ length: count }, () => newFlake(true));
  }

  function newFlake(anywhere = false) {
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -10,
      r: 1 + Math.random() * 3,
      speed: 0.3 + Math.random() * 0.9,
      drift: Math.random() * Math.PI * 2,
      alpha: 0.4 + Math.random() * 0.6,
    };
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (const f of flakes) {
      f.y += f.speed;
      f.drift += 0.01;
      f.x += Math.sin(f.drift) * 0.4;
      if (f.y > h + 10) Object.assign(f, newFlake());
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${f.alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  resize();
  tick();
}
