// Utilitats de text (independents del navegador; es poden provar amb Vitest).

export function uid(prefix = ''): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return prefix ? `${prefix}_${rnd}` : rnd;
}

const STOPWORDS = new Set(
  (
    // català
    'el la els les un una uns unes de del dels al als a en i o u que què qui per amb sense sobre sota entre ' +
    'és són era eren ser estar ha han hi ho li ens us es se seu seva seus seves aquest aquesta aquests aquestes ' +
    'aquell aquella com quan on més menys molt molts també no si ja però sinó tot tots tota totes cada pel pels ' +
    'fins des cap mitjançant segons dins fora qual quals altre altra altres pot poden ha de cal ' +
    // castellà
    'lo los las unos unas y e ni que para por con sin su sus este esta estos estas ese esa eso aquel ' +
    'como cuando donde más muy también pero sino todo todos toda todas cada puede pueden debe deben son está ' +
    // anglès
    'the of and or to in on for with without is are was were be been this that these those it its as by an ' +
    'at from which who whom can may must not'
  ).split(/\s+/),
);

export function isStopword(w: string): boolean {
  return STOPWORDS.has(w.toLowerCase());
}

/** Normalitza per comparar: minúscules, sense accents ni puntuació, espais simples. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/l·l/g, 'll')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((w) => w.length > 1);
}

export function contentWords(s: string): string[] {
  return tokens(s).filter((w) => !STOPWORDS.has(w) && w.length > 2);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Similitud de Jaccard entre conjunts de paraules amb contingut */
export function jaccard(a: string, b: string): number {
  const A = new Set(contentWords(a));
  const B = new Set(contentWords(b));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  A.forEach((w) => B.has(w) && inter++);
  return inter / (A.size + B.size - inter);
}

/** Divideix en frases, respectant abreviatures habituals i numeracions legals. */
export function splitSentences(text: string): string[] {
  const protectedText = text
    .replace(/\b(art|arts|núm|num|pàg|pág|p|pp|etc|sr|sra|dr|dra|ed|vol|cap|ex|vs|aprox|admin|prof)\./gi, '$1§')
    .replace(/(\d)\.(\d)/g, '$1§$2');
  return protectedText
    .split(/(?<=[.!?;])\s+(?=[«"“(¿¡]?[A-ZÀ-ÚÇÑ0-9])/u)
    .map((s) => s.replace(/§/g, '.').trim())
    .filter((s) => s.length > 0);
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Barreja determinista (Fisher–Yates) amb llavor */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('ca-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function daysBetween(a: number, b: number): number {
  return Math.floor(Math.abs(b - a) / 86400000);
}

// ---------- Text font amb marques de pàgina ----------
// El text d'una secció es desa amb marques "[[p:N]]" a l'inici de cada pàgina.

export interface PagedSegment {
  page: number;
  text: string;
}

export function parsePaged(sourceText: string): PagedSegment[] {
  const out: PagedSegment[] = [];
  const re = /\[\[p:(\d+)\]\]/g;
  let last = 0;
  let page = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sourceText))) {
    const chunk = sourceText.slice(last, m.index);
    if (chunk.trim()) out.push({ page, text: chunk.trim() });
    page = Number(m[1]);
    last = m.index + m[0].length;
  }
  const tail = sourceText.slice(last);
  if (tail.trim()) out.push({ page, text: tail.trim() });
  return out;
}

export function stripPageMarks(sourceText: string): string {
  return sourceText.replace(/\[\[p:\d+\]\]\n?/g, '');
}

/** Troba la pàgina on apareix un fragment (aproximadament) */
export function findPageOf(sourceText: string, fragment: string): number | undefined {
  const target = normalize(fragment).slice(0, 80);
  if (!target) return undefined;
  for (const seg of parsePaged(sourceText)) {
    if (normalize(seg.text).includes(target)) return seg.page;
  }
  return undefined;
}

/** Comprova si un fragment apareix (gairebé) literalment al text font */
export const EXCERPT_SEP = ' … ';

/** Comprova si un fragment (o tots els trossos d'un fragment compost, separats per « … ») apareix al text font */
export function fragmentInSource(sourceText: string, fragment: string): boolean {
  const parts = fragment.split(EXCERPT_SEP).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) return parts.every((p) => fragmentInSource(sourceText, p));
  const src = normalize(stripPageMarks(sourceText));
  const frag = normalize(fragment);
  if (!frag) return false;
  if (src.includes(frag)) return true;
  // tolerància: el 85% de les paraules amb contingut del fragment, consecutives en finestres
  const words = frag.split(' ');
  if (words.length < 4) return false;
  const win = Math.max(4, Math.floor(words.length * 0.6));
  let hits = 0;
  let checks = 0;
  for (let i = 0; i + win <= words.length; i += Math.max(1, Math.floor(win / 2))) {
    checks++;
    if (src.includes(words.slice(i, i + win).join(' '))) hits++;
  }
  return checks > 0 && hits / checks >= 0.85;
}
