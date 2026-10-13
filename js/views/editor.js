/**
 * views/editor.js — Drawer editor konten (form, tab, pratinjau embed, analisis real-time).
 * Menangani: tambah baru, edit, duplikat, pratinjau sosial media, dan audit konten.
 */

import {
  CTA_GOALS, CTA_TYPES, PILARS, PLATFORMS, SCHOOL_PROFILE, STATUSES,
} from '../core/config.js';
import {
  fmtCompact, fmtDate, fmtDecimal, fmtNumber, fmtPercent, fmtTime, todayISO,
} from '../core/format.js';
import { $, $$, append, el, escapeHtml, openExternal, uniq } from '../core/util.js';
import * as anim from '../lib/anim.js';
import { barChart, gauge, progressBar } from '../lib/charts.js';

import { analyzeRow, engagementRate } from '../analytics/metrics.js';
import { auditContent, generateCaption, prioritizeFindings, suggestHashtags } from '../analytics/insight.js';
import * as store from '../data/store.js';
import { actions, buildUtm, detectFromUrl, embedHtml, fetchMeta } from '../social/platforms.js';
import {
  avatar, button, ctaChip, emptyState, field, icon, iconButton, openModal, panel, pilarChip,
  platformBadge, scoreRing, statusPill, toast, toastError, toastSuccess, toastWarn,
} from '../ui/components.js';
import { closeDrawerShell, openDrawerShell } from '../ui/components.js';

let current = null;
let dirty = false;

const num = (v) => (Number.isFinite(+v) ? +v : 0);

/* ------------------------------- TEMPLATE ------------------------------ */

function blankRecord(seed = {}) {
  const base = {
    id: '', tanggal: todayISO(), jam: '19.30', judul: '', platform: 'instagram', format: 'Reels',
    pilar: 'edukasi', status: 'ide', caption: '', hashtag: '', cta_jenis: 'simpan', cta_teks: '',
    cta_link: '', asset_url: '', post_url: '', views: 0, likes: 0, comments: 0, shares: 0, saves: 0,
    followers_gain: 0, klik_link: 0, pendaftar: 0, pic: '', catatan: '',
  };
  return { ...base, ...seed };
}

/* -------------------------------- OPENERS ------------------------------ */

export function openNew(seed = {}) {
  current = blankRecord(seed);
  dirty = false;
  openDrawerShell('Konten Baru', 'Isi detail konten, tambahkan CTA, lalu simpan ke Google Sheet.');
  $('#drawer-title').textContent = 'Konten Baru';
  buildForm();
}

export function openEdit(row) {
  current = { ...row };
  dirty = false;
  openDrawerShell('Edit Konten', row.judul || '(tanpa judul)');
  buildForm();
}

export async function duplicateContent(row) {
  const res = await store.duplicate(row.id);
  if (res?.record) {
    toastSuccess('Konten diduplikasi sebagai ide baru.');
    openEdit(res.record);
  }
}

/* --------------------------------- FORM -------------------------------- */

function buildForm() {
  const form = $('#content-form');
  form.innerHTML = '';
  const record = current;

  const panels = {
    detail: buildDetailTab(record),
    caption: buildCaptionTab(record),
    cta: buildCtaTab(record),
    metrik: buildMetrikTab(record),
    analisis: buildAnalisisTab(record),
  };

  Object.entries(panels).forEach(([key, node]) => {
    node.dataset.tabPanel = key;
    node.classList.toggle('is-hidden', key !== 'detail');
    append(form, node);
  });

  attachFormBehavior(form);
  setTab('detail');

  $$('#drawer-tabs .tab').forEach((t) => {
    t.onclick = () => setTab(t.dataset.tab);
  });
}

function setTab(name) {
  $$('#drawer-tabs .tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === name));
  $$('[data-tab-panel]').forEach((p) => p.classList.toggle('is-hidden', p.dataset.tabPanel !== name));
  const panelEl = $(`[data-tab-panel="${name}"]`);
  if (panelEl) anim.animateListRows(panelEl, '.field');
  if (name === 'analisis') refreshAudit();
  if (name === 'caption') refreshCaptionPreview();
}

function buildDetailTab(r) {
  const wrap = el('div', { class: 'tab-panel' });
  append(wrap, field({
    label: 'Judul konten', name: 'judul', value: r.judul, required: true,
    placeholder: 'Contoh: Tur Fasilitas Kelas Tahfiz',
    help: 'Judul dipakai untuk pencarian internal, bukan untuk tayang.',
  }));

  const row1 = el('div', { class: 'field-row' });
  append(row1, 
    field({
      label: 'Platform', name: 'platform', value: r.platform,
      options: Object.entries(PLATFORMS).map(([id, p]) => ({ value: id, label: p.label })),
    }),
    field({
      label: 'Format', name: 'format', value: r.format,
      options: PLATFORMS[r.platform]?.types.map((t) => ({ value: t, label: t })) || [],
    }),
  );
  append(wrap, row1);

  const row2 = el('div', { class: 'field-row' });
  append(row2, 
    field({
      label: 'Pilar konten', name: 'pilar', value: r.pilar,
      options: [{ value: '', label: '— pilih pilar —' }, ...PILARS.map((p) => ({ value: p.id, label: `${p.emoji} ${p.label}` }))],
      help: 'Pilar menentukan target ER & tujuan konten.',
    }),
    field({
      label: 'Status', name: 'status', value: r.status,
      options: Object.entries(STATUSES).map(([id, s]) => ({ value: id, label: s.label })),
    }),
  );
  append(wrap, row2);

  const row3 = el('div', { class: 'field-row' });
  append(row3, 
    field({ label: 'Tanggal tayang', name: 'tanggal', type: 'date', value: r.tanggal }),
    field({ label: 'Jam tayang (WIB)', name: 'jam', type: 'time', value: r.jam, help: `Rekomendasi ${PLATFORMS[r.platform]?.bestTime || '19.00–20.00'}` }),
  );
  append(wrap, row3);

  const row4 = el('div', { class: 'field-row' });
  append(row4, 
    field({ label: 'PIC / penanggung jawab', name: 'pic', value: r.pic, placeholder: 'Ustadzah Rina', attrs: { list: 'pic-list' } }),
    field({ label: 'Aset media (Drive/Canva)', name: 'asset_url', value: r.asset_url, placeholder: 'https://drive.google.com/...' }),
  );
  append(wrap, row4);
  append(wrap, el('datalist', { id: 'pic-list' }, uniq(store.pics()).map((p) => el('option', { value: p }))));

  append(wrap, field({
    label: 'URL postingan (setelah tayang)', name: 'post_url', value: r.post_url,
    placeholder: 'https://www.instagram.com/reel/...',
    help: 'Tempel tautan asli agar pratinjau, embed, dan analisis performa bisa dibuka.',
    attrs: { id: 'input-post-url' },
  }));

  const embedHost = el('div', { id: 'embed-preview', class: 'embed-host' });
  const embedTitle = el('h4', { class: 'mini-title', text: 'Pratinjau postingan' });
  append(wrap, embedTitle, embedHost);

  append(wrap, field({ label: 'Catatan produksi', name: 'catatan', type: 'textarea', value: r.catatan, rows: 3, placeholder: 'Brief, referensi, atau catatan revisi…' }));
  return wrap;
}

function buildCaptionTab(r) {
  const wrap = el('div', { class: 'tab-panel' });

  const toolbar = el('div', { class: 'mini-toolbar' });
  append(toolbar, 
    button('Buat Caption Otomatis', {
      variant: 'gold', size: 'sm', iconName: 'spark',
      onClick: () => {
        const judul = $('#content-form [name="judul"]').value;
        const pilar = $('#content-form [name="pilar"]').value;
        const platform = $('#content-form [name="platform"]').value;
        const cta = $('#content-form [name="cta_jenis"]')?.value || 'simpan';
        const { caption, hashtag } = generateCaption({ judul, pilar, platform, cta_jenis: cta });
        $('#content-form [name="caption"]').value = caption;
        $('#content-form [name="hashtag"]').value = hashtag;
        markDirty();
        refreshCaptionPreview();
        toastSuccess('Caption & hashtag dibuat. Silakan sesuaikan.');
      },
    }),
    button('Saran Hashtag', {
      size: 'sm', iconName: 'spark',
      onClick: () => {
        const row = readForm();
        $('#content-form [name="hashtag"]').value = suggestHashtags(row);
        markDirty();
        refreshCaptionPreview();
      },
    }),
    button('Buat Link UTM', {
      size: 'sm', iconName: 'link',
      onClick: () => {
        const form = $('#content-form');
        const link = form.querySelector('[name="cta_link"]');
        if (!link) return;
        if (!link.value) return toastWarn('Isi dulu Link CTA di tab CTA.');
        link.value = buildUtm(link.value, {
          source: form.querySelector('[name="platform"]').value,
          medium: 'social',
          campaign: form.querySelector('[name="pilar"]').value || 'kampanye',
          content: form.querySelector('[name="judul"]').value.slice(0, 24).replace(/\s+/g, '-').toLowerCase(),
        });
        markDirty();
        toastSuccess('Link CTA sudah diberi UTM.');
      },
    }),
  );
  append(wrap, toolbar);

  append(wrap, field({
    label: 'Caption', name: 'caption', type: 'textarea', value: r.caption, rows: 9,
    placeholder: 'Tulis caption lengkap. Baris pertama = hook.',
    help: 'Struktur disarankan: hook → isi/manfaat → bukti → CTA.',
    attrs: { id: 'input-caption' },
  }));
  append(wrap, field({
    label: 'Hashtag', name: 'hashtag', value: r.hashtag, rows: 3, type: 'textarea',
    placeholder: '#SekolahAnakSaleh #PPDB2026',
    help: '5–10 hashtag: nama sekolah + kota + tema.',
  }));

  const preview = el('div', { class: 'caption-preview', id: 'caption-preview' });
  append(wrap, preview);
  return wrap;
}

function refreshCaptionPreview() {
  const host = $('#caption-preview');
  if (!host) return;
  const caption = $('#content-form [name="caption"]')?.value || '';
  const hashtag = $('#content-form [name="hashtag"]')?.value || '';
  const platform = $('#content-form [name="platform"]')?.value || 'instagram';
  const limit = platform === 'instagram' ? 2200 : platform === 'tiktok' ? 2200 : platform === 'youtube' ? 5000 : 63206;
  const len = caption.length + hashtag.length;
  host.innerHTML = '';
  append(host, 
    el('div', { class: 'caption-preview__head' }, [
      platformBadge(platform, { size: 'sm' }),
      el('span', { class: `char-count ${len > limit ? 'is-over' : ''}`, text: `${fmtNumber(len)} / ${fmtNumber(limit)} karakter` }),
    ]),
    el('pre', { class: 'caption-preview__body', text: `${caption}\n\n${hashtag}`.trim() || 'Belum ada caption.' }),
  );
}

function buildCtaTab(r) {
  const wrap = el('div', { class: 'tab-panel' });
  append(wrap, el('p', { class: 'muted small', text: 'CTA = ajakan bertindak. Satu konten sebaiknya punya SATU CTA utama agar audiens tidak bingung.' }));

  const grid = el('div', { class: 'cta-picker' });
  CTA_TYPES.forEach((c) => {
    const goal = CTA_GOALS[c.goal];
    const card = el('button', {
      class: `cta-pick ${r.cta_jenis === c.id ? 'is-active' : ''}`,
      type: 'button',
      style: { '--cp': goal.color },
      dataset: { cta: c.id },
      onclick: () => {
        $('#content-form [name="cta_jenis"]').value = c.id;
        const teks = $('#content-form [name="cta_teks"]');
        if (!teks.value.trim() && c.template) teks.value = c.template.replace('{akun}', SCHOOL_PROFILE.akun);
        $$('.cta-pick').forEach((n) => n.classList.toggle('is-active', n.dataset.cta === c.id));
        markDirty();
        toast(`CTA "${c.label}" dipilih.`, { tone: 'info' });
      },
    }, [
      el('strong', { text: c.label }),
      el('span', { class: 'badge', text: goal.label }),
    ]);
    append(grid, card);
  });
  append(wrap, grid);

  append(wrap, field({
    label: 'Jenis CTA', name: 'cta_jenis', value: r.cta_jenis,
    options: [{ value: '', label: '— tanpa CTA —' }, ...CTA_TYPES.map((c) => ({ value: c.id, label: `${c.label} (${CTA_GOALS[c.goal].label})` }))],
  }));
  append(wrap, field({
    label: 'Teks CTA (yang tampil di caption)', name: 'cta_teks', type: 'textarea', rows: 3, value: r.cta_teks,
    placeholder: 'Simpan postingan ini ya, Bunda 📌',
  }));
  append(wrap, field({
    label: 'Link CTA', name: 'cta_link', value: r.cta_link, placeholder: 'https://sekolahanaksaleh.sch.id/ppdb',
    help: 'Gunakan tombol "Buat Link UTM" di tab Caption agar klik bisa dilacak.',
  }));

  const quick = el('div', { class: 'quick-links' });
  append(quick, 
    button('WhatsApp Admin', { size: 'sm', iconName: 'whatsapp', onClick: () => { $('#content-form [name="cta_link"]').value = actions.dm(); markDirty(); } }),
    button('Link PPDB', { size: 'sm', iconName: 'globe', onClick: () => { $('#content-form [name="cta_link"]').value = actions.ppdb(); markDirty(); } }),
    button('Link Subscribe YouTube', { size: 'sm', iconName: 'youtube', onClick: () => { $('#content-form [name="cta_link"]').value = actions.subscribe(); markDirty(); } }),
  );
  append(wrap, el('h4', { class: 'mini-title', text: 'Tautan cepat' }), quick);
  return wrap;
}

function buildMetrikTab(r) {
  const wrap = el('div', { class: 'tab-panel' });
  append(wrap, el('p', { class: 'muted small', html: 'Isi metrik setelah konten tayang. Angka diambil dari insight platform (Instagram/TikTok/YouTube Studio). <strong>Tanpa token API resmi, aplikasi tidak bisa menarik angka ini otomatis.</strong>' }));

  const metaBar = el('div', { class: 'mini-toolbar' });
  append(metaBar, 
    button('Cek Metadata Publik', {
      size: 'sm', iconName: 'cloud',
      onClick: async (e) => {
        const btn = e.currentTarget;
        const row = readForm();
        if (!row.post_url) return toastWarn('Tempel dulu URL postingan di tab Detail.');
        btn.disabled = true;
        btn.classList.add('is-loading');
        const res = await fetchMeta(row.platform, row.post_url);
        btn.disabled = false;
        btn.classList.remove('is-loading');
        if (res.ok) {
          toastSuccess(`Metadata ditemukan: ${res.title || res.author || 'berhasil'}`, { title: res.provider });
          const note = $('#content-form [name="catatan"]');
          if (note && !note.value.includes('Judul asli')) note.value = `${note.value}\n[Judul asli: ${res.title || '-'} | Akun: ${res.author || '-'}]`.trim();
          refreshEmbedPreview();
        } else {
          toastWarn(res.error, { title: 'Metadata tidak tersedia' });
        }
      },
    }),
    button('Buka Post', { size: 'sm', iconName: 'external', onClick: () => { const u = $('#content-form [name="post_url"]').value; if (u) openExternal(u); } }),
  );
  append(wrap, metaBar);

  const fields = [
    ['views', 'Views / Tayangan', 'eye'],
    ['likes', 'Likes', 'heart'],
    ['comments', 'Komentar', 'comment'],
    ['shares', 'Shares / Bagikan', 'send'],
    ['saves', 'Saves / Simpan', 'bookmark'],
    ['followers_gain', 'Followers Baru', 'users'],
    ['klik_link', 'Klik Link CTA', 'link'],
    ['pendaftar', 'Pendaftar (konversi)', 'target'],
  ];
  const grid = el('div', { class: 'field-grid' });
  fields.forEach(([name, label]) => {
    append(grid, field({ label, name, type: 'number', min: 0, value: num(r[name]), step: '1' }));
  });
  append(wrap, grid);

  const live = el('div', { class: 'live-kpi', id: 'live-kpi' });
  append(wrap, live);
  return wrap;
}

function refreshLiveKpi() {
  const host = $('#live-kpi');
  if (!host) return;
  const row = readForm();
  const analyzed = analyzeRow({ ...current, ...row });
  const k = analyzed.kpi;
  host.innerHTML = '';
  append(host, 
    el('div', { class: 'live-kpi__head' }, [el('h4', { text: 'Perhitungan otomatis' }), scoreRing(k.score, { size: 58 })]),
  );
  const grid = el('div', { class: 'kpi-grid kpi-grid--sm' });
  const items = [
    ['Engagement Rate', `${fmtDecimal(k.er)}%`, k.er >= 4 ? 'ok' : k.er >= 2 ? 'info' : 'warn'],
    ['Save Rate', `${fmtDecimal(k.saveRate)}%`, 'info'],
    ['Share Rate', `${fmtDecimal(k.shareRate)}%`, 'info'],
    ['Click Rate', `${fmtDecimal(k.clickRate)}%`, 'info'],
    ['Interaksi', fmtCompact(k.interactions), 'ok'],
    ['Pendaftar / 1.000 views', fmtDecimal(k.conversionRate), 'gold'],
  ];
  items.forEach(([label, value, tone]) => {
    append(grid, el('div', { class: `mini-kpi mini-kpi--${tone}` }, [
      el('span', { class: 'mini-kpi__label', text: label }),
      el('strong', { class: 'mini-kpi__value', text: value }),
    ]));
  });
  append(host, grid);
  append(host, progressBar(k.score, { tone: k.grade.color, label: `Skor ${fmtDecimal(k.score)} — ${k.grade.label}` }));
}

function buildAnalisisTab(r) {
  const wrap = el('div', { class: 'tab-panel', id: 'audit-panel' });
  return wrap;
}

function refreshAudit() {
  const host = $('#audit-panel');
  if (!host) return;
  const row = { ...current, ...readForm() };
  const { score, grade, findings } = auditContent(row, store.state.rows);
  const ordered = prioritizeFindings(findings);
  host.innerHTML = '';
  append(host, el('div', { class: 'audit-head' }, [
    scoreRing(score, { size: 66 }),
    el('div', {}, [
      el('h4', { text: `Kelengkapan konten: ${fmtDecimal(score)}/100 (${grade})` }),
      el('p', { class: 'muted small', text: findings.length ? `${findings.length} catatan ditemukan.` : 'Semua komponen penting sudah lengkap 🎉' }),
    ]),
  ]));

  if (!ordered.length) {
    append(host, emptyState({ title: 'Konten sudah rapi', message: 'Tidak ada catatan. Siap dijadwalkan.', iconName: 'check' }));
    return;
  }
  ordered.forEach((f) => {
    const tone = f.level === 'good' ? 'var(--ok)' : f.level === 'high' ? 'var(--danger)' : f.level === 'medium' ? 'var(--warn)' : 'var(--info)';
    const card = el('article', { class: `finding finding--${f.level}`, style: { '--fc': tone } });
    append(card, el('h5', { text: f.title }), el('p', { text: f.detail }));
    if (f.fix) append(card, el('p', { class: 'finding__fix', html: `<strong>Perbaikan:</strong> ${escapeHtml(f.fix)}` }));
    append(host, card);
  });
  anim.animateListRows(host, '.finding');
}

/* ------------------------------ FORM LOGIC ----------------------------- */

function readForm() {
  const form = $('#content-form');
  const data = {};
  new FormData(form).forEach((v, k) => { data[k] = v; });
  ['views', 'likes', 'comments', 'shares', 'saves', 'followers_gain', 'klik_link', 'pendaftar'].forEach((k) => {
    data[k] = num(data[k]);
  });
  return data;
}

function markDirty() {
  dirty = true;
  const hint = $('#drawer-hint');
  if (hint) hint.innerHTML = '<span class="warn-text">Ada perubahan belum disimpan.</span>';
}

function attachFormBehavior(form) {
  form.oninput = (e) => {
    markDirty();
    if (e.target.name === 'caption' || e.target.name === 'hashtag' || e.target.name === 'platform') refreshCaptionPreview();
    if (['views', 'likes', 'comments', 'shares', 'saves', 'followers_gain', 'klik_link', 'pendaftar'].includes(e.target.name)) refreshLiveKpi();
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    save();
  };

  // deteksi platform dari URL postingan
  const urlInput = form.querySelector('[name="post_url"]');
  urlInput?.addEventListener('paste', () => setTimeout(autoDetect, 30));
  urlInput?.addEventListener('blur', autoDetect);
  urlInput?.addEventListener('change', () => refreshEmbedPreview());

  function autoDetect() {
    const value = urlInput.value.trim();
    if (!value) return;
    const det = detectFromUrl(value);
    if (!det) return;
    const pSelect = form.querySelector('[name="platform"]');
    if (pSelect.value !== det.platform) {
      pSelect.value = det.platform;
      pSelect.dispatchEvent(new Event('change', { bubbles: true }));
      rebuildFormatOptions(det.format);
      toast(`Platform terdeteksi: ${PLATFORMS[det.platform]?.label}`, { tone: 'info' });
      refreshEmbedPreview();
    }
  }

  const pSelect = form.querySelector('[name="platform"]');
  pSelect?.addEventListener('change', () => {
    rebuildFormatOptions();
    const hint = form.querySelector('[name="jam"]')?.closest('.field')?.querySelector('.field__help');
    if (hint) hint.textContent = `Rekomendasi ${PLATFORMS[pSelect.value]?.bestTime || '19.00–20.00'}`;
  });

  refreshLiveKpi();
  refreshEmbedPreview();
}

function rebuildFormatOptions(preferred) {
  const form = $('#content-form');
  const pSelect = form.querySelector('[name="platform"]');
  const fSelect = form.querySelector('[name="format"]');
  if (!fSelect) return;
  const types = PLATFORMS[pSelect.value]?.types || [];
  fSelect.innerHTML = '';
  types.forEach((t) => append(fSelect, el('option', { value: t, text: t })));
  if (preferred && types.includes(preferred)) fSelect.value = preferred;
}

/* ------------------------------ EMBED PREVIEW -------------------------- */

export function refreshEmbedPreview() {
  const host = $('#embed-preview');
  if (!host) return;
  const form = $('#content-form');
  const url = form?.querySelector('[name="post_url"]')?.value?.trim();
  const platform = form?.querySelector('[name="platform"]')?.value || 'instagram';
  const html = url ? embedHtml(platform, url) : null;
  host.innerHTML = '';
  if (!html) {
    append(host, emptyState({
      title: 'Belum ada pratinjau',
      message: url
        ? `Platform ${PLATFORMS[platform]?.label} tidak mendukung embed untuk tautan ini. Isi metrik manual di tab Metrik.`
        : 'Tempel URL postingan (Instagram/TikTok/YouTube/Facebook) untuk menampilkan embed asli.',
      iconName: 'link',
    }));
    return;
  }
  append(host, el('div', { class: 'embed-frame', html }));
}

/* --------------------------------- SAVE -------------------------------- */

export async function save() {
  const form = $('#content-form');
  const data = readForm();
  const errors = [];
  if (!data.judul?.trim()) errors.push('Judul wajib diisi.');
  if (!data.tanggal) errors.push('Tanggal tayang wajib diisi.');

  $$('.field').forEach((f) => f.classList.remove('is-invalid'));
  if (errors.length) {
    toastError(errors.join(' '), { title: 'Belum bisa disimpan' });
    const target = form.querySelector('[name="judul"]');
    target?.closest('.field')?.classList.add('is-invalid');
    setTab('detail');
    anim.shake(target);
    return;
  }

  const payload = { ...current, ...data };
  if (!payload.id) payload.id = '';
  const { record, sync } = await store.upsert(payload);
  current = { ...record };
  dirty = false;
  if (sync?.ok) toastSuccess('Konten tersimpan & dikirim ke Google Sheet.', { title: 'Tersimpan' });
  else if (sync?.pending) toastWarn(`${sync.error || 'Pengiriman tertunda'} — perubahan diantrekan dan akan dikirim otomatis.`, { title: 'Tersimpan lokal' });
  else toastSuccess('Konten tersimpan di perangkat ini (Mode Demo).', { title: 'Tersimpan' });
  closeDrawerShell();
}

export function hasUnsaved() {
  return dirty;
}

export function confirmCloseIfDirty(onClose) {
  if (!dirty) {
    onClose?.();
    return;
  }
  const body = el('p', { text: 'Ada perubahan yang belum disimpan. Tutup tanpa menyimpan?' });
  const footer = el('div', { class: 'modal__actions' });
  let api;
  append(footer, 
    button('Lanjut mengedit', { onClick: () => api.close() }),
    button('Tutup tanpa simpan', { variant: 'danger', onClick: () => { api.close(); onClose?.(); } }),
  );
  api = openModal({ title: 'Perubahan belum disimpan', body, footer });
}

/* ------------------------------ ANALISIS MODAL ------------------------- */

export async function openAnalysis(row) {
  const analyzed = analyzeRow(row);
  const { score, grade, findings } = auditContent(row, store.state.rows);
  const ordered = prioritizeFindings(findings);
  const published = store.state.rows.filter((r) => r.status === 'tayang' && r.platform === row.platform);
  const samePilar = store.state.rows.filter((r) => r.status === 'tayang' && r.pilar === row.pilar);
  const avgErPlatform = samePilar.length
    ? samePilar.reduce((a, r) => a + engagementRate(r), 0) / samePilar.length
    : 0;

  const body = el('div', { class: 'analysis-modal' });

  /* Ringkasan atas */
  const head = el('div', { class: 'analysis-head' });
  const left = el('div', { class: 'analysis-head__left' });
  append(left, 
    el('div', { class: 'analysis-head__tags' }, [platformBadge(row.platform), statusPill(row.status), pilarChip(row.pilar), ctaChip(row.cta_jenis)]),
    el('h3', { text: row.judul || '(tanpa judul)' }),
    el('p', { class: 'muted', text: `${fmtDate(row.tanggal, 'full')} • ${fmtTime(row.jam)} WIB • ${row.format || 'format belum diisi'} • PIC ${row.pic || '—'}` }),
    el('p', { class: 'analysis-head__verdict', text: analyzed.kpi.score >= 55 ? `Performa ${grade.label} (${fmtDecimal(score)}/100)` : `Skor ${fmtDecimal(score)}/100 — ${grade.label}` }),
  );
  const right = el('div', { class: 'analysis-head__right' });
  append(right, scoreRing(analyzed.kpi.score, { size: 92, label: grade.label }));
  append(head, left, right);
  append(body, head);

  /* Perbandingan dengan rata-rata pilar */
  if (row.status === 'tayang') {
    append(body, panel('Perbandingan performa', el('div', { class: 'compare-grid' }, [
      compareItem('ER konten', analyzed.kpi.er, avgErPlatform, `rata-rata pilar ${fmtDecimal(avgErPlatform)}%`),
      compareItem('Simpan', analyzed.kpi.saveRate, 1, 'target ideal ≥ 1%'),
      compareItem('Bagikan', analyzed.kpi.shareRate, 0.8, 'target ideal ≥ 0.8%'),
      compareItem('Klik link', analyzed.kpi.clickRate, 1, 'target ideal ≥ 1%'),
    ]), { subtitle: 'Angka konten ini dibandingkan dengan target pilar & praktik baik industri.' }));
  }

  /* Komponen skor */
  const comp = analyzed.kpi.components;
  const compData = [
    { label: 'Engagement', value: Math.min(100, comp.engagement) },
    { label: 'Reach', value: Math.min(100, comp.reach) },
    { label: 'Save', value: Math.min(100, comp.save) },
    { label: 'Share', value: Math.min(100, comp.share) },
    { label: 'Click', value: Math.min(100, comp.click) },
    { label: 'Growth', value: Math.min(100, comp.growth) },
  ];
  append(body, panel('Komponen skor konten', barChart(compData, { height: 210, format: (v) => `${Math.round(v)}` }), {
    subtitle: 'Nilai 100 = tepat di benchmark. Batang rendah menandakan area yang perlu diperbaiki.',
  }));

  /* Temuan */
  const findingsWrap = el('div', { class: 'findings-list' });
  if (!ordered.length) append(findingsWrap, emptyState({ title: 'Tidak ada catatan', message: 'Konten sudah lengkap.', iconName: 'check' }));
  ordered.forEach((f) => {
    const tone = f.level === 'good' ? 'var(--ok)' : f.level === 'high' ? 'var(--danger)' : f.level === 'medium' ? 'var(--warn)' : 'var(--info)';
    const card = el('article', { class: `finding finding--${f.level}`, style: { '--fc': tone } });
    append(card, el('h5', { text: f.title }), el('p', { text: f.detail }));
    if (f.fix) append(card, el('p', { class: 'finding__fix', html: `<strong>Perbaikan:</strong> ${escapeHtml(f.fix)}` }));
    append(findingsWrap, card);
  });
  append(body, panel('Audit konten & rekomendasi', findingsWrap, { subtitle: `${ordered.length} temuan diurutkan dari yang paling penting.` }));

  /* Pratinjau embed */
  const embedHost = el('div', { id: 'modal-embed' });
  refreshModalEmbed(embedHost, row);
  append(body, panel('Pratinjau postingan', embedHost, { subtitle: 'Embed resmi platform (bukan salinan data).' }));

  /* Footer aksi */
  const footer = el('div', { class: 'modal__actions' });
  append(footer, 
    button('Edit konten', { variant: 'primary', iconName: 'edit', onClick: () => { api.close(); openEdit(row); } }),
    row.post_url ? button('Buka postingan', { iconName: 'external', onClick: () => openExternal(row.post_url) }) : null,
    button('Tutup', { onClick: () => api.close() }),
  );

  const api = openModal({ title: 'Analisis Konten', body, footer, wide: true });
  anim.animateCharts(body);
  anim.animateListRows(body, '.finding');
  return api;
}

function compareItem(label, value, target, note) {
  const ratio = target ? value / target : value > 0 ? 1 : 0;
  const tone = ratio >= 1 ? 'var(--ok)' : ratio >= 0.7 ? 'var(--info)' : ratio >= 0.4 ? 'var(--warn)' : 'var(--danger)';
  const item = el('div', { class: 'compare-item' });
  append(item, 
    el('span', { class: 'compare-item__label', text: label }),
    el('strong', { class: 'compare-item__value', style: { color: tone }, text: `${fmtDecimal(value)}%` }),
    progressBar(Math.min(150, ratio * 100), { max: 100, tone }),
    el('span', { class: 'compare-item__note muted small', text: note }),
  );
  return item;
}

function refreshModalEmbed(host, row) {
  if (!host) return;
  const html = row.post_url ? embedHtml(row.platform, row.post_url) : null;
  if (!html) {
    append(host, emptyState({
      title: 'Pratinjau tidak tersedia',
      message: row.post_url
        ? 'Tautan ini tidak bisa di-embed. Gunakan tombol "Buka postingan" untuk melihat aslinya.'
        : 'Belum ada URL postingan pada konten ini.',
      iconName: 'link',
    }));
    return;
  }
  append(host, el('div', { class: 'embed-frame', html }));
}

/* ------------------------------- PREVIEW ------------------------------- */

export function openPreview(row) {
  const body = el('div', { class: 'preview-modal' });
  const info = el('div', { class: 'preview-info' });
  append(info, 
    el('h3', { text: row.judul || '(tanpa judul)' }),
    el('div', { class: 'preview-info__tags' }, [platformBadge(row.platform), statusPill(row.status), pilarChip(row.pilar)]),
    el('p', { class: 'muted small', text: `${fmtDate(row.tanggal, 'full')} • ${fmtTime(row.jam)} WIB` }),
    el('pre', { class: 'caption-preview__body', text: `${row.caption || ''}\n\n${row.hashtag || ''}`.trim() || 'Belum ada caption.' }),
    row.cta_teks ? el('div', { class: 'cta-box' }, [el('p', { class: 'cta-box__text', text: row.cta_teks })]) : null,
  );
  const visual = el('div', { class: 'preview-visual' });
  refreshModalEmbed(visual, row);
  append(body, info, visual);
  const footer = el('div', { class: 'modal__actions' });
  const api = openModal({
    title: 'Pratinjau Konten',
    body,
    footer,
    wide: true,
  });
  append(footer, 
    button('Edit', { iconName: 'edit', onClick: () => { api.close(); openEdit(row); } }),
    row.post_url ? button('Buka postingan', { iconName: 'external', variant: 'primary', onClick: () => openExternal(row.post_url) }) : null,
    button('Tutup', { onClick: () => api.close() }),
  );
}
