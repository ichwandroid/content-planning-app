/**
 * lib/anim.js — Semua animasi GSAP terkumpul di satu tempat.
 * GSAP dimuat dari CDN di index.html (window.gsap). Bila gagal dimuat,
 * seluruh fungsi di sini tetap aman dipanggil (fallback tanpa animasi).
 */

import { prefersReducedMotion } from '../core/util.js';

const G = () => globalThis.gsap;
export const hasGsap = () => Boolean(G());
const reduce = () => prefersReducedMotion();

function ctx(scope, fn) {
  if (!hasGsap() || reduce()) {
    fn(null);
    return null;
  }
  const g = G();
  return g.context(() => fn(g), scope || undefined);
}

/* --------------------------- MASUK / KELUAR HALAMAN --------------------- */

/** Animasi pembuka aplikasi: overlay logo -> konten utama. */
export function bootIntro(onDone) {
  const overlay = document.querySelector('#boot-overlay');
  const shell = document.querySelector('#app-shell');

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    overlay?.classList.add('is-hidden');
    overlay?.setAttribute('aria-hidden', 'true');
    shell?.classList.remove('is-hidden');
    shell?.classList.add('is-ready');
    onDone?.();
  };

  // Jaring pengaman: apa pun yang terjadi (GSAP gagal dimuat, tab tidak aktif,
  // animasi dijeda browser), aplikasi tetap tampil paling lama 2,5 detik.
  const safety = setTimeout(finish, 2500);

  if (!overlay || !hasGsap() || reduce()) {
    clearTimeout(safety);
    finish();
    return;
  }

  const g = G();
  g.timeline({
    defaults: { ease: 'power3.out' },
    onComplete: () => {
      clearTimeout(safety);
      finish();
      headerReveal();
    },
  })
    .fromTo('.boot-logo', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6 }, 0)
    .from('.boot-title span', { yPercent: 120, opacity: 0, duration: 0.55, stagger: 0.04 }, 0.12)
    .from('.boot-sub', { opacity: 0, y: 12, duration: 0.45 }, 0.42)
    .fromTo('.boot-bar__fill', { width: '0%' }, { width: '100%', duration: 0.9, ease: 'power2.inOut' }, 0.3)
    .to('.boot-title', { yPercent: -8, opacity: 0, duration: 0.35, ease: 'power2.in' }, '+=0.15')
    .to('.boot-sub, .boot-bar, .boot-logo', { opacity: 0, duration: 0.25 }, '<')
    .to(overlay, { opacity: 0, duration: 0.35, pointerEvents: 'none' }, '-=0.1');
}

/** Animasi elemen utama setelah halaman siap (stat, toolbar, kartu). */
export function headerReveal() {
  ctx(document.body, (g) => {
    if (!g) return;
    const stats = document.querySelectorAll('.stat-card');
    if (stats.length) g.from(stats, { y: 22, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out', clearProps: 'transform' });
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) g.from(toolbar, { y: 14, opacity: 0, duration: 0.45, ease: 'power2.out', clearProps: 'transform' });
  });
}

/* -------------------------------- VIEW --------------------------------- */

export function animateViewEnter(root = document) {
  ctx(root, (g) => {
    if (!g) return;
    const targets = root.querySelectorAll('[data-anim-view]');
    if (!targets.length) return;
    g.from(targets, { y: 20, opacity: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out', clearProps: 'transform' });
  });
}

/** Animasi overlay boot memakai selektor yang pasti ada; dibungkus guard. */
function safeFrom(tl, selector, vars, position) {
  const nodes = document.querySelectorAll(selector);
  if (!nodes.length) return tl;
  return tl.from(nodes, vars, position);
}

/** Kartu konten muncul berurutan (stagger). */
export function animateCards(container, selector = '.content-card') {
  ctx(container, (g) => {
    if (!g) return;
    const cards = container.querySelectorAll(selector);
    if (!cards.length) return;
    g.from(cards, {
      y: 26, opacity: 0, scale: 0.97, duration: 0.45, stagger: { each: 0.04, from: 'start' },
      ease: 'power2.out', clearProps: 'transform,opacity',
      onComplete: () => cards.forEach((c) => c.classList.add('is-in')),
    });
  });
}

export function animateListRows(container, selector = '.list-row') {
  ctx(container, (g) => {
    if (!g) return;
    const rows = container.querySelectorAll(selector);
    if (!rows.length) return;
    g.from(rows, { x: -18, opacity: 0, duration: 0.4, stagger: 0.03, ease: 'power2.out', clearProps: 'all' });
  });
}

export function animateNumber(node, to, { duration = 1.1, format = (v) => Math.round(v).toLocaleString('id-ID'), decimals = 0 } = {}) {
  if (!node) return;
  const target = Number(to) || 0;
  if (!hasGsap() || reduce()) {
    node.textContent = format(target);
    return;
  }
  const g = G();
  const obj = { v: 0 };
  g.to(obj, {
    v: target,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      const val = decimals ? Number(obj.v.toFixed(decimals)) : Math.round(obj.v);
      node.textContent = format(val);
    },
  });
}

export function countUpAll(root = document) {
  root.querySelectorAll('[data-countup]').forEach((node) => {
    const raw = node.dataset.countup;
    const decimals = Number(node.dataset.decimals || 0);
    const suffix = node.dataset.suffix || '';
    const value = Number(raw) || 0;
    const compact = node.dataset.compact === 'true';
    animateNumber(node, value, {
      decimals,
      format: (v) => `${compact ? new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(v) : v.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`,
    });
  });
}

/* ------------------------------- CHART --------------------------------- */

/** Animasi elemen SVG hasil lib/charts.js */
export function animateCharts(root = document) {
  ctx(root, (g) => {
    if (!g) return;
    root.querySelectorAll('path[data-anim="draw"]').forEach((path) => {
      let len = 0;
      try { len = path.getTotalLength(); } catch { len = 0; }
      if (!len) return;
      g.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' });
    });
    root.querySelectorAll('[data-anim="fade"]').forEach((n) => g.from(n, { opacity: 0, duration: 0.9, ease: 'power2.out' }));
    root.querySelectorAll('[data-anim="pop"]').forEach((n) => g.from(n, { scale: 0, transformOrigin: 'center', duration: 0.4, stagger: 0.03, ease: 'back.out(2.4)' }));
    root.querySelectorAll('[data-anim="grow-y"]').forEach((n) => g.from(n, { scaleY: 0, duration: 0.7, stagger: 0.05, ease: 'power3.out' }));
    root.querySelectorAll('[data-anim="grow-x"]').forEach((n) => g.from(n, { scaleX: 0, transformOrigin: 'left center', duration: 0.8, stagger: 0.05, ease: 'power3.out' }));
    root.querySelectorAll('[data-anim="donut"]').forEach((n) => {
      const dash = n.style.getPropertyValue('--dash') || '0';
      g.fromTo(n, { strokeDasharray: `0 ${n.style.getPropertyValue('--circ')}` }, { strokeDasharray: `${dash} ${n.style.getPropertyValue('--gap')}`, duration: 1.0, ease: 'power2.out' });
    });
    root.querySelectorAll('[data-anim="gauge"]').forEach((n) => {
      const circ = Number(n.style.getPropertyValue('--circ')) || 100;
      const dash = Number(n.style.getPropertyValue('--dash')) || 0;
      g.fromTo(n, { strokeDashoffset: circ }, { strokeDashoffset: circ - dash, duration: 1.2, ease: 'power3.out' });
    });
  });
}

/* ------------------------------- DRAWER -------------------------------- */

export function openDrawer(panel, backdrop) {
  if (!hasGsap() || reduce()) {
    panel?.classList.add('is-open');
    backdrop?.classList.add('is-open');
    return;
  }
  const g = G();
  g.set([panel, backdrop], { display: 'block' });
  g.timeline()
    .to(backdrop, { opacity: 1, duration: 0.25 })
    .fromTo(panel, { xPercent: 100 }, { xPercent: 0, duration: 0.5, ease: 'power3.out' }, 0)
    .from(panel.querySelectorAll('[data-stagger]'), { y: 18, opacity: 0, duration: 0.35, stagger: 0.03, ease: 'power2.out' }, 0.12);
}

export function closeDrawer(panel, backdrop) {
  if (!hasGsap() || reduce()) {
    panel?.classList.remove('is-open');
    backdrop?.classList.remove('is-open');
    return;
  }
  const g = G();
  g.timeline({ onComplete: () => g.set([panel, backdrop], { display: 'none' }) })
    .to(panel, { xPercent: 100, duration: 0.35, ease: 'power2.in' })
    .to(backdrop, { opacity: 0, duration: 0.3 }, 0);
}

/* -------------------------------- MODAL -------------------------------- */

export function openModal(modal, backdrop) {
  if (!hasGsap() || reduce()) {
    modal?.classList.add('is-open');
    backdrop?.classList.add('is-open');
    return;
  }
  const g = G();
  g.set([modal, backdrop], { display: 'flex' });
  g.timeline()
    .to(backdrop, { opacity: 1, duration: 0.22 })
    .fromTo(modal, { y: 26, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.42, ease: 'back.out(1.6)' }, 0);
}

export function closeModal(modal, backdrop) {
  if (!hasGsap() || reduce()) {
    modal?.classList.remove('is-open');
    backdrop?.classList.remove('is-open');
    return;
  }
  const g = G();
  g.timeline({ onComplete: () => g.set([modal, backdrop], { display: 'none' }) })
    .to(modal, { y: 16, opacity: 0, duration: 0.25, ease: 'power2.in' })
    .to(backdrop, { opacity: 0, duration: 0.22 }, 0);
}

/* -------------------------------- TOAST -------------------------------- */

export function toastIn(node) {
  if (!hasGsap() || reduce()) return;
  const g = G();
  g.from(node, { x: 40, opacity: 0, duration: 0.4, ease: 'back.out(1.7)' });
}

export function toastOut(node, done) {
  if (!hasGsap() || reduce()) {
    done?.();
    return;
  }
  G().to(node, { x: 30, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: done });
}

/* -------------------------------- MISC --------------------------------- */

export function pulse(node, tone = 'rgba(15,118,110,0.35)') {
  if (!hasGsap() || reduce() || !node) return;
  G().fromTo(node, { boxShadow: `0 0 0 0 ${tone}` }, { boxShadow: '0 0 0 14px rgba(15,118,110,0)', duration: 0.9, ease: 'power2.out' });
}

export function shake(node) {
  if (!hasGsap() || reduce() || !node) return;
  G().fromTo(node, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.35)' });
}

export function flipIn(node) {
  if (!hasGsap() || reduce() || !node) return;
  G().fromTo(node, { rotateX: -18, opacity: 0, transformPerspective: 600 }, { rotateX: 0, opacity: 1, duration: 0.45, ease: 'power2.out' });
}

/** Transisi antar halaman (view) */
export function viewTransition(outEl, inEl) {
  if (!hasGsap() || reduce()) {
    outEl?.classList.add('is-hidden');
    inEl?.classList.remove('is-hidden');
    return;
  }
  const g = G();
  const tl = g.timeline();
  if (outEl && !outEl.classList.contains('is-hidden')) {
    tl.to(outEl, { opacity: 0, y: -12, duration: 0.18, ease: 'power2.in', onComplete: () => outEl.classList.add('is-hidden') });
  }
  tl.add(() => {
    inEl?.classList.remove('is-hidden');
    if (inEl) g.fromTo(inEl, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.38, ease: 'power3.out' });
  });
  return tl;
}

export function progressRing(node, pct, tone = '#0F766E') {
  if (!node) return;
  node.style.setProperty('--p', `${Math.max(0, Math.min(100, pct))}%`);
  node.style.setProperty('--tone', tone);
}

export function staggerBar(container) {
  ctx(container, (g) => {
    if (!g) return;
    g.from(container.querySelectorAll('.metric-chip'), { y: 10, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out', clearProps: 'all' });
  });
}

/** Efek hover 3D halus untuk kartu (desktop only). */
export function attachCardTilt(root = document) {
  if (reduce() || window.matchMedia('(hover: none)').matches) return;
  root.querySelectorAll('.content-card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - 0.5) * -5;
      const ry = ((e.clientX - r.left) / r.width - 0.5) * 5;
      card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

export { G as gsapRef };
