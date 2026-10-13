/**
 * social/platforms.js — Integrasi sosial media yang benar-benar jalan di web statis.
 *
 * Yang BISA dilakukan tanpa API resmi & tanpa server:
 *  - Deteksi platform otomatis dari URL postingan (paste link -> terisi sendiri)
 *  - Ambil metadata publik via oEmbed (judul/author/thumbnail) bila platform mengizinkan CORS
 *  - Sematkan (embed) postingan asli langsung di kartu konten -> pratinjau + insight visual
 *  - Deep-link aksi: buka profil, DM, share, subscriber, komentar
 *
 * Yang TIDAK bisa tanpa token API/tim server (dijelaskan jujur di UI):
 *  - menarik likes/views/komentar otomatis secara real-time
 *  Solusinya: kolom metrik di Google Sheet (diisi manual/AI bantu baca) + tombol
 *  "Cek Metadata" untuk validasi judul & thumbnail.
 */

import { PLATFORMS, SCHOOL_PROFILE } from '../core/config.js';

/* ------------------------------ DETEKSI URL ---------------------------- */

const MATCHERS = [
  { platform: 'instagram', host: /instagram\.com|instagr\.am/i, format: (u) => (/\/reels?\//i.test(u.pathname) ? 'Reels' : /\/stories\//i.test(u.pathname) ? 'Story' : /\/p\//i.test(u.pathname) ? 'Carousel' : 'Feed') },
  { platform: 'tiktok', host: /tiktok\.com/i, format: () => 'Video' },
  { platform: 'youtube', host: /youtube\.com|youtu\.be/i, format: (u) => (/\/shorts\//i.test(u.pathname) ? 'Shorts' : /\/live\//i.test(u.pathname) ? 'Live' : 'Video Panjang') },
  { platform: 'facebook', host: /facebook\.com|fb\.watch|fb\.me/i, format: (u) => (/\/reels?\//i.test(u.pathname) ? 'Reels' : 'Feed') },
  { platform: 'whatsapp', host: /wa\.me|whatsapp\.com|chat\.whatsapp\.com/i, format: () => 'Broadcast' },
];

/** @returns {{platform:string, format:string, id:string|null}|null} */
export function detectFromUrl(url) {
  if (!url) return null;
  let u;
  try {
    u = new URL(/^https?:/i.test(url) ? url : `https://${url}`);
  } catch {
    return null;
  }
  for (const m of MATCHERS) {
    if (m.host.test(u.hostname)) {
      return { platform: m.platform, format: m.format(u), id: extractPostId(m.platform, u) };
    }
  }
  if (/sch\.id|sekolah|ppdb/i.test(u.hostname)) return { platform: 'website', format: 'Artikel', id: null };
  return null;
}

export function extractPostId(platform, u) {
  const p = u.pathname;
  switch (platform) {
    case 'instagram': return p.match(/\/(?:p|reel|reels|tv)\/([\w-]+)/i)?.[1] ?? null;
    case 'tiktok': return p.match(/\/video\/(\d+)/)?.[1] ?? p.match(/\/photo\/(\d+)/)?.[1] ?? null;
    case 'youtube': return u.hostname.includes('youtu.be') ? p.slice(1) || null : u.searchParams.get('v');
    case 'facebook': return p.match(/\/videos?\/(\d+)/)?.[1] ?? null;
    default: return null;
  }
}

/* -------------------------------- EMBED -------------------------------- */

/** HTML iframe embed resmi per platform. */
export function embedHtml(platform, url, { height } = {}) {
  const id = url ? extractPostId(platform, safeUrl(url)) : null;
  switch (platform) {
    case 'instagram': {
      const code = id || url?.match(/\/(?:p|reel|reels)\/([\w-]+)/)?.[1];
      return code
        ? `<iframe src="https://www.instagram.com/p/${code}/embed/captioned/" title="Instagram embed" loading="lazy" allowtransparency="true" allowfullscreen style="width:100%;min-height:${height || 520}px;border:0;background:#fff"></iframe>`
        : null;
    }
    case 'tiktok': {
      const vid = id || url?.match(/\/video\/(\d+)/)?.[1];
      return vid
        ? `<iframe src="https://www.tiktok.com/embed/v2/${vid}" title="TikTok embed" loading="lazy" allow="encrypted-media; fullscreen" allowfullscreen style="width:100%;min-height:${height || 560}px;border:0;background:#fff"></iframe>`
        : null;
    }
    case 'youtube': {
      const vid = id || extractYouTubeId(url);
      return vid
        ? `<iframe src="https://www.youtube-nocookie.com/embed/${vid}" title="YouTube embed" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;aspect-ratio:16/9;border:0;background:#000"></iframe>`
        : null;
    }
    case 'facebook': {
      const href = encodeURIComponent(url || `https://www.facebook.com/${SCHOOL_PROFILE.akun}`);
      return `<iframe src="https://www.facebook.com/plugins/post.php?href=${href}&show_text=true&width=500" title="Facebook embed" loading="lazy" style="width:100%;min-height:${height || 560}px;border:0;background:#fff"></iframe>`;
    }
    default:
      return null;
  }
}

export function extractYouTubeId(url = '') {
  const m = String(url).match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/|\/live\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

function safeUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Thumbnail publik (tanpa API) untuk kartu. */
export function thumbnailUrl(platform, url) {
  if (!url) return null;
  if (platform === 'youtube') {
    const id = extractYouTubeId(url);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  }
  return null; // platform lain: pakai thumbnail dari oEmbed bila tersedia
}

/* -------------------------------- oEmbed ------------------------------- */

const OEMBED_ENDPOINTS = {
  youtube: (url) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  tiktok: (url) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  instagram: (url) => `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`,
  facebook: null,
  whatsapp: null,
  website: null,
};

/**
 * Ambil metadata publik. Mengembalikan {ok, title, author, thumbnail, error}.
 * CORS ramah: YouTube ✔, TikTok ✔ (Access-Control-Allow-Origin: *),
 * Instagram/Facebook diblokir -> otomatis fallback ke input manual.
 */
export async function fetchMeta(platform, url, { timeout = 8000 } = {}) {
  const build = OEMBED_ENDPOINTS[platform];
  if (!build || !url) {
    return { ok: false, error: `${PLATFORMS[platform]?.label || platform} tidak menyediakan oEmbed publik — isi metrik manual di Sheet.` };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(build(url), { signal: ctrl.signal, mode: 'cors', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      ok: true,
      title: data.title || data.author_name || '',
      author: data.author_name || '',
      thumbnail: data.thumbnail_url || '',
      html: data.html || null,
      width: data.thumbnail_width || null,
      height: data.thumbnail_height || null,
      provider: data.provider_name || PLATFORMS[platform]?.label,
    };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'Timeout saat mengambil metadata.' : `Gagal ambil metadata (${err.message}).` };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------ DEEP LINK ------------------------------ */

/** URL aksi cepat: DM, profil, subscriber, share, komentar. */
export const actions = {
  profile(platform) {
    switch (platform) {
      case 'instagram': return `https://instagram.com/${SCHOOL_PROFILE.akun}`;
      case 'tiktok': return `https://tiktok.com/@${SCHOOL_PROFILE.akun}`;
      case 'youtube': return `https://youtube.com/@${SCHOOL_PROFILE.akun}`;
      case 'facebook': return `https://facebook.com/${SCHOOL_PROFILE.akun}`;
      case 'whatsapp': return `https://wa.me/${SCHOOL_PROFILE.whatsapp}`;
      default: return SCHOOL_PROFILE.website;
    }
  },
  dm(text = 'Assalamualaikum, saya ingin bertanya tentang PPDB Sekolah Anak Saleh.') {
    return `https://wa.me/${SCHOOL_PROFILE.whatsapp}?text=${encodeURIComponent(text)}`;
  },
  share(platform, url, text = '') {
    const u = encodeURIComponent(url || SCHOOL_PROFILE.website);
    const t = encodeURIComponent(text);
    switch (platform) {
      case 'whatsapp': return `https://wa.me/?text=${t}%20${u}`;
      case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
      case 'youtube': return `https://youtube.com/@${SCHOOL_PROFILE.akun}?sub_confirmation=1`;
      default: return `https://instagram.com/${SCHOOL_PROFILE.akun}`;
    }
  },
  ppdb: () => SCHOOL_PROFILE.ppdbLink,
  subscribe: () => `https://youtube.com/@${SCHOOL_PROFILE.akun}?sub_confirmation=1`,
};

/* ------------------------------- UTILITAS ------------------------------ */

/** Tambahkan UTM ke link CTA agar ketebakan konten mana yang menghasilkan klik. */
export function buildUtm(link, { source = 'instagram', medium = 'social', campaign = '', content = '' } = {}) {
  if (!link || !/^https?:/i.test(link)) return link || '';
  try {
    const u = new URL(link);
    u.searchParams.set('utm_source', source);
    u.searchParams.set('utm_medium', medium);
    if (campaign) u.searchParams.set('utm_campaign', campaign);
    if (content) u.searchParams.set('utm_content', content);
    return u.toString();
  } catch {
    return link;
  }
}

/** Deteksi pilar dari caption + hashtag (dipakai untuk saran otomatis). */
export function suggestPilar(text = '') {
  const t = String(text).toLowerCase();
  const rules = [
    ['ppdb', /ppdb|spmb|pendaftaran|daftar|kuota|gelombang|open house/],
    ['tahfiz', /tahfiz|tahfidz|hafal|juz|qur'?an|tilawah|murojaah/],
    ['karakter', /adab|akhlak|karakter|sunnah|mabit|muhasabah|doa|ibadah/],
    ['akademik', /prestasi|juara|lomba|olimpiade|nilai|ujian|wisuda|akademik/],
    ['kesiswaan', /ekskul|ekstrakurikuler|panahan|drum ?band|futsal|pramuka|kegiatan siswa/],
    ['sarana', /fasilitas|ruang kelas|lab|perpustakaan|kantin|gedung|ac|lapangan/],
    ['guru', /ustadz|ustadzah|guru|staf|pengajar/],
    ['testimoni', /testimoni|kata wali|menurut bunda|ulasan|review/],
    ['edukasi', /tips|panduan|cara|checklist|parenting|edukasi|gizi/],
    ['event', /agenda|acara|event|jadwal|peringatan|hari besar/],
  ];
  for (const [pilar, re] of rules) if (re.test(t)) return pilar;
  return '';
}
