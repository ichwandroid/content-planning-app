/**
 * views/cta.js — Library CTA + CTA Builder + efektivitas CTA dari data Sheet.
 */

import { CTA_GOALS, CTA_TYPES, PLATFORMS, SCHOOL_PROFILE } from '../core/config.js';
import { fmtCompact, fmtDecimal, fmtNumber, fmtPercent } from '../core/format.js';
import { $, append, copyText, download, el, uniq } from '../core/util.js';
import * as anim from '../lib/anim.js';
import { barChart } from '../lib/charts.js';

import { breakdown } from '../analytics/metrics.js';
import * as store from '../data/store.js';
import { actions, buildUtm } from '../social/platforms.js';
import {
  button, copyButton, copyRow, emptyState, field, icon, openModal, panel, platformBadge, toast,
  toastSuccess,
} from '../ui/components.js';
import { openNew } from './editor.js';

let goalFilter = 'all';

export function setGoalFilter(goal) {
  goalFilter = goal;
}

/* -------------------------------- RENDER ------------------------------- */

export function renderCta() {
  const host = $('#cta-root');
  if (!host) return;
  host.innerHTML = '';

  const list = CTA_TYPES.filter((c) => goalFilter === 'all' || c.goal === goalFilter);

  /* Kolom kiri: library */
  const libraryWrap = el('div', { class: 'cta-grid' });
  if (!list.length) append(libraryWrap, emptyState({ title: 'Tidak ada CTA', message: 'Ubah filter tujuan CTA.', iconName: 'megaphone' }));
  list.forEach((c) => append(libraryWrap, ctaCard(c)));
  append(host, panel('Library CTA', libraryWrap, {
    subtitle: `${CTA_TYPES.length} pola CTA siap pakai. Klik "Pakai" untuk membuat konten baru dengan CTA ini.`,
    cls: 'panel--wide',
  }));

  /* Efektivitas CTA dari data nyata */
  append(host, panel('Efektivitas CTA pada data Anda', effectiveness(), {
    cls: 'panel--wide',
    subtitle: 'Dihitung dari kolom Klik Link & Pendaftar pada Sheet.',
  }));

  /* Builder + tips */
  const grid = el('div', { class: 'cta-layout__inner' });
  append(grid, panel('CTA Builder', builder(), { subtitle: 'Susun CTA sesuai tujuan & kanal, lengkap dengan tautan UTM.' }));
  append(grid, panel('Panduan menulis CTA sekolah', guide(), { subtitle: 'Prinsip yang terbukti menaikkan klik di kanal pendidikan.' }));
  append(host, grid);

  anim.animateCards(host, '.cta-card');
  anim.animateCharts(host);
}

function ctaCard(c) {
  const goal = CTA_GOALS[c.goal];
  const card = el('article', { class: 'cta-card', style: { '--cp': goal.color }, dataset: { cta: c.id } });
  const head = el('header', { class: 'cta-card__head' });
  append(head, el('h4', { text: c.label }), el('span', { class: 'badge', text: goal.label }));
  append(card, head);
  append(card, el('p', { class: 'cta-card__template', text: c.template || 'Tulis CTA kustom Anda.' }));

  const foot = el('footer', { class: 'cta-card__foot' });
  append(foot, 
    copyButton(c.template || '', 'Salin template'),
    button('Pakai', {
      size: 'sm', variant: 'primary', iconName: 'plus',
      onClick: () => openNew({ cta_jenis: c.id, cta_teks: c.template, pilar: c.goal === 'conversion' ? 'ppdb' : 'edukasi' }),
    }),
  );
  append(card, foot);

  const preview = el('div', { class: 'cta-preview' });
  append(preview, 
    el('div', { class: 'cta-preview__head' }, [platformBadge('instagram', { size: 'sm' }), el('span', { class: 'muted small', text: 'contoh tampilan caption' })]),
    el('pre', { class: 'cta-preview__body', text: `Alhamdulillah, kegiatan hari ini berjalan lancar 🤍\n\n…\n\n${c.template ? c.template.replace('{akun}', SCHOOL_PROFILE.akun) : 'CTA kustom Anda'}` }),
  );
  append(card, preview);
  return card;
}

function effectiveness() {
  const rows = store.state.rows;
  const data = breakdown(rows, 'cta').filter((d) => d.count > 0);
  if (!data.length) return emptyState({ title: 'Belum ada data CTA', message: 'Isi kolom CTA Jenis pada Sheet agar efektivitas bisa dihitung.', iconName: 'chart' });
  const wrap = el('div', { class: 'cta-effectiveness' });
  const chart = barChart(
    data.map((d) => ({ label: d.label, value: d.clicks, sub: `${d.count} konten • ${d.daftar} daftar` })),
    { height: 260, format: (v) => fmtCompact(v) },
  );
  append(wrap, chart);

  const best = [...data].sort((a, b) => (b.clicks + b.daftar * 10) - (a.clicks + a.daftar * 10))[0];
  const worst = [...data].filter((d) => d.key !== 'tanpa-cta').sort((a, b) => (a.clicks + a.daftar * 10) - (b.clicks + b.daftar * 10))[0];

  const notes = el('div', { class: 'cta-notes' });
  if (best) {
    append(notes, el('div', { class: 'insight-card insight-card--good', style: { '--ic': 'var(--ok)' } }, [
      el('h4', { text: `CTA paling menggerakkan: ${best.label}` }),
      el('p', { text: `${fmtNumber(best.clicks)} klik link dan ${fmtNumber(best.daftar)} pendaftar dari ${best.count} konten (ER ${fmtDecimal(best.er)}%).` }),
      el('p', { class: 'finding__fix', text: 'Jadikan standar untuk konten konversi berikutnya.' }),
    ]));
  }
  if (worst && worst.key !== best?.key) {
    append(notes, el('div', { class: 'insight-card insight-card--medium', style: { '--ic': 'var(--warn)' } }, [
      el('h4', { text: `CTA perlu dievaluasi: ${worst.label}` }),
      el('p', { text: `Hanya ${fmtNumber(worst.clicks)} klik dari ${worst.count} konten.` }),
      el('p', { class: 'finding__fix', text: 'Coba ganti ke CTA konversi yang lebih spesifik, mis. "Daftar kunjungan sekolah" bukan sekadar "Follow".' }),
    ]));
  }
  const noCta = data.find((d) => d.key === 'tanpa-cta');
  if (noCta) {
    append(notes, el('div', { class: 'insight-card insight-card--high', style: { '--ic': 'var(--danger)' } }, [
      el('h4', { text: `${noCta.count} konten tanpa CTA` }),
      el('p', { text: 'Konten ini hanya menghasilkan jangkauan, bukan tindakan.' }),
      el('p', { class: 'finding__fix', text: 'Buka Planner, filter "Tanpa CTA", lalu lengkapi.' }),
    ]));
  }
  append(wrap, notes);
  return wrap;
}

/* -------------------------------- BUILDER ------------------------------ */

function builder() {
  const wrap = el('div', { class: 'cta-builder' });
  const form = el('div', { class: 'cta-builder__form' });

  const ctaSelect = el('select', { class: 'input', id: 'b-cta' });
  CTA_TYPES.forEach((c) => append(ctaSelect, el('option', { value: c.id, text: `${c.label} — ${CTA_GOALS[c.goal].label}` })));
  const platformSelect = el('select', { class: 'input', id: 'b-platform' });
  Object.entries(PLATFORMS).forEach(([id, p]) => append(platformSelect, el('option', { value: id, text: p.label })));
  const topicInput = el('input', { class: 'input', id: 'b-topik', placeholder: 'Contoh: Open House PPDB 2026' });
  const urgencySelect = el('select', { class: 'input', id: 'b-urgensi' });
  [['none', 'Tanpa urgensi'], ['soft', 'Lembut (ajakan halus)'], ['medium', 'Terbatas (kuota/waktu)'], ['hard', 'Mendesak (sisa kuota)']]
    .forEach(([v, l]) => append(urgencySelect, el('option', { value: v, text: l })));
  const linkInput = el('input', { class: 'input', id: 'b-link', placeholder: 'https://sekolahanaksaleh.sch.id/ppdb' });

  append(form, 
    el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Jenis CTA' }), ctaSelect]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Platform' }), platformSelect]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Topik konten' }), topicInput]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Tingkat urgensi' }), urgencySelect]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Link tujuan (opsional)' }), linkInput]),
  );
  append(wrap, form);

  const output = el('div', { class: 'cta-builder__output' });
  const result = el('pre', { class: 'cta-builder__result', id: 'b-result' });
  const linkOut = el('div', { class: 'cta-builder__link', id: 'b-link-out' });
  append(output, el('h4', { class: 'mini-title', text: 'Hasil' }), result, linkOut);
  append(wrap, output);

  const build = () => {
    const cta = CTA_TYPES.find((c) => c.id === ctaSelect.value);
    const platform = platformSelect.value;
    const topic = topicInput.value.trim() || 'kegiatan terbaru di sekolah kami';
    const urgency = urgencySelect.value;
    const base = (cta?.template || 'Ikuti terus informasi kami ya 🤍').replace('{akun}', SCHOOL_PROFILE.akun);
    const prefix = {
      none: '',
      soft: 'Insya Allah bermanfaat — ',
      medium: `Kuota terbatas untuk ${topic}! `,
      hard: `⚠️ Sisa sedikit untuk ${topic}. `,
    }[urgency];
    const suffix = urgency === 'hard' ? ' Jangan sampai terlewat ya, Bunda.' : urgency === 'medium' ? ' Amankan sekarang ya.' : '';
    const text = `${prefix}${base}${suffix}`.replace(/\s+/g, ' ').trim();
    result.textContent = text;
    linkOut.innerHTML = '';
    if (linkInput.value.trim()) {
      const url = buildUtm(linkInput.value.trim(), {
        source: platform,
        medium: 'social',
        campaign: topic.slice(0, 30).replace(/\s+/g, '-').toLowerCase(),
      });
      append(linkOut, el('span', { class: 'field__label', text: 'Link dengan UTM' }), copyRow(url));
      linkOut.dataset.url = url;
    }
  };

  [ctaSelect, platformSelect, urgencySelect].forEach((n) => n.addEventListener('change', build));
  [topicInput, linkInput].forEach((n) => n.addEventListener('input', build));
  build();

  const foot = el('div', { class: 'cta-builder__foot' });
  append(foot, 
    copyButton('', 'Salin CTA').cloneNode(true),
  );
  foot.innerHTML = '';
  append(foot, 
    button('Salin CTA', { size: 'sm', iconName: 'copy', onClick: async () => { await copyText(result.textContent); toastSuccess('CTA disalin.'); } }),
    button('Buat konten dengan CTA ini', {
      size: 'sm', variant: 'primary', iconName: 'plus',
      onClick: () => openNew({ cta_jenis: ctaSelect.value, cta_teks: result.textContent, platform: platformSelect.value }),
    }),
  );
  append(wrap, foot);
  return wrap;
}

function guide() {
  const wrap = el('div', { class: 'guide-list' });
  const tips = [
    ['Satu konten, satu CTA', 'Dua ajakan sekaligus membuat audiens ragu. Pilih yang paling penting.', 'target'],
    ['Sebutkan langkahnya, bukan hanya manfaatnya', '"Klik link di bio lalu isi formulir 2 menit" lebih jelas daripada "Daftar sekarang".', 'list'],
    ['Pakai kata ganti orang tua', '"Bunda/Ayah" terasa personal dan menaikkan klik di kanal parenting.', 'users'],
    ['Beri alasan untuk bertindak sekarang', 'Kuota, jadwal gelombang, atau bonus pendaftaran awal — tetap jujur, jangan menakut-nakuti.', 'clock'],
    ['Letakkan CTA di 2 tempat', 'Di caption (baris terakhir) dan sebagai teks overlay video 3 detik terakhir.', 'eye'],
    ['Sisipkan tautan ber-UTM', 'Agar Anda tahu konten mana yang benar-benar mendatangkan pendaftar.', 'link'],
    ['Balas komentar dengan CTA', 'Komentar "berapa biayanya?" dijawab dengan arahan ke admin = konversi tambahan.', 'comment'],
  ];
  tips.forEach(([title, detail, ic], i) => {
    const row = el('article', { class: 'guide-item' });
    const icEl = el('span', { class: 'guide-item__icon' });
    icEl.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none">${ICONS[ic] || ICONS.dot}</svg>`;
    append(row, icEl, el('div', {}, [el('strong', { text: `${i + 1}. ${title}` }), el('p', { text: detail })]));
    append(wrap, row);
  });
  append(wrap, panel('Tautan cepat tim media', el('div', { class: 'quick-links' }, [
    button('Chat Admin (WA)', { size: 'sm', iconName: 'whatsapp', onClick: () => window.open(actions.dm(), '_blank', 'noopener') }),
    button('Buka Link PPDB', { size: 'sm', iconName: 'globe', onClick: () => window.open(actions.ppdb(), '_blank', 'noopener') }),
    button('Profil Instagram', { size: 'sm', iconName: 'instagram', onClick: () => window.open(actions.profile('instagram'), '_blank', 'noopener') }),
    button('Kanal TikTok', { size: 'sm', iconName: 'tiktok', onClick: () => window.open(actions.profile('tiktok'), '_blank', 'noopener') }),
  ]), { cls: 'panel--compact' }));
  return wrap;
}

const ICONS = {
  target: '<circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.7"/>',
  list: '<path d="M4 6.5h16M4 12h16M4 17.5h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  users: '<circle cx="9.5" cy="8.5" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M3.8 19.5c.6-3 2.9-4.8 5.7-4.8s5.1 1.8 5.7 4.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  clock: '<circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  eye: '<path d="M2.8 12S6 6.8 12 6.8 21.2 12 21.2 12 18 17.2 12 17.2 2.8 12 2.8 12Z" stroke="currentColor" stroke-width="1.7"/>',
  link: '<path d="M10 14a4 4 0 0 1 0-5.6l2-2a4 4 0 1 1 5.6 5.6l-1 1M14 10a4 4 0 0 1 0 5.6l-2 2A4 4 0 0 1 6.4 12l1-1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  comment: '<path d="M4.5 6.5A3 3 0 0 1 7.5 3.5h9a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H10l-4 4v-4a3 3 0 0 1-3-3v-5Z" stroke="currentColor" stroke-width="1.6"/>',
  dot: '<circle cx="12" cy="12" r="3" fill="currentColor"/>',
};

export function bindCta() {
  const sel = $('#cta-goal');
  if (!sel) return;
  sel.value = goalFilter;
  sel.addEventListener('change', () => {
    goalFilter = sel.value;
    renderCta();
  });
}
