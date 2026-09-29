import fs from 'fs';
import os from 'os';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import type { CanvasRenderingContext2D, Image as CanvasImage } from 'canvas';
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { CanvasNode, WorkflowItem } from './types.js';

const URL_GOOGLE_NOTICIAS_COLOMBIA = 'https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREZzY3pJU0JtVnpMVFF4T1NnQVAB?hl=es-419&gl=CO&ceid=CO%3Aes-419';
const URL_POR_DEFECTO = URL_GOOGLE_NOTICIAS_COLOMBIA;

// Carpeta de salida: variable de entorno OUTPUT_DIR o Escritorio/posts_generados
const carpetaDestino =
  process.env.OUTPUT_DIR ?? path.join(os.homedir(), 'Desktop', 'posts_generados');

const MAX_TITULARES = 20;        // cuántos titulares se leen de la fuente
const CANTIDAD_POR_DEFECTO = 5;  // cuántas noticias se procesan por ejecución
const CANTIDAD_MAXIMA = 10;
const ARCHIVO_HISTORIAL = path.join(carpetaDestino, 'historial.json');

// ─────────────────────────────────────────────
// Utilidades compartidas
// ─────────────────────────────────────────────
const normalizarEspacios = (t: string): string => t.replace(/\s+/g, ' ').trim();

const recortar = (texto: string, max: number): string =>
  texto.length > max ? `${texto.slice(0, max - 1).trimEnd()}…` : texto;

const normalizar = (t: string): string =>
  t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

interface EntradaHistorial {
  clave: string;
  titulo: string;
  fecha: string;
}

const claveDeTitular = (titulo: string): string =>
  normalizar(titulo).replace(/[^a-z0-9]+/g, ' ').trim();

const leerHistorial = (): EntradaHistorial[] => {
  try {
    const datos: unknown = JSON.parse(fs.readFileSync(ARCHIVO_HISTORIAL, 'utf-8'));
    return Array.isArray(datos) ? (datos as EntradaHistorial[]) : [];
  } catch {
    return []; // no existe todavía o está dañado
  }
};

const registrarEnHistorial = (nuevas: EntradaHistorial[]): void => {
  const historial = [...leerHistorial(), ...nuevas].slice(-500); // se conservan las últimas 500
  fs.mkdirSync(carpetaDestino, { recursive: true });
  fs.writeFileSync(ARCHIVO_HISTORIAL, JSON.stringify(historial, null, 2), 'utf-8');
};

// Dos titulares se consideran "la misma noticia" si comparten ≥ 70 % de sus palabras significativas
const sonSimilares = (a: string, b: string): boolean => {
  const A = new Set(claveDeTitular(a).split(' ').filter((p) => p.length > 3));
  const B = new Set(claveDeTitular(b).split(' ').filter((p) => p.length > 3));
  if (A.size === 0 || B.size === 0) return false;
  let comunes = 0;
  for (const palabra of A) if (B.has(palabra)) comunes++;
  return comunes / Math.min(A.size, B.size) >= 0.7;
};

const tokenizar = (texto: string): string[] =>
  normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean);

const STOPWORDS = new Set([
  'para', 'como', 'esta', 'este', 'estos', 'estas', 'pero', 'porque', 'sobre', 'entre', 'desde',
  'hasta', 'cual', 'cuales', 'tiene', 'hace', 'that', 'this', 'with', 'from', 'your', 'have',
  'will', 'what', 'when', 'which', 'their', 'there', 'would', 'could', 'about', 'after', 'before',
  'being', 'more', 'most', 'some', 'than', 'then', 'them', 'they', 'were', 'been', 'does', 'just',
  'like', 'only', 'over', 'also', 'using', 'used', 'uses', 'show', 'make', 'made', 'need', 'best',
  'into', 'the', 'and', 'los', 'las', 'del', 'una', 'uno', 'por', 'con', 'que',
  'tras', 'segun', 'durante', 'luego', 'aunque', 'ayer', 'horas', 'cuando', 'donde', 'quien', 'quienes', 'asi', 'esto',
]);

// ─────────────────────────────────────────────
// Banco de imágenes temáticas de alta resolución (Respaldo verificado)
// ─────────────────────────────────────────────
export const BANCO_IMAGENES_TEMATICAS: Record<string, string[]> = {
  economia: [
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1280&q=80',
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1280&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1280&q=80',
  ],
  politica: [
    'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1280&q=80',
    'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1280&q=80',
    'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1280&q=80',
  ],
  justicia: [
    'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1280&q=80',
    'https://images.unsplash.com/photo-1505664194779-8beaceb93744?w=1280&q=80',
  ],
  seguridad: [
    'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=1280&q=80',
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1280&q=80',
  ],
  tecnologia: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1280&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1280&q=80',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1280&q=80',
  ],
  salud: [
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1280&q=80',
    'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=1280&q=80',
  ],
  ambiente: [
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1280&q=80',
    'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1280&q=80',
  ],
  deportes: [
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1280&q=80',
  ],
  movilidad: [
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1280&q=80',
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1280&q=80',
    'https://images.unsplash.com/photo-1493238792000-8113da705763?w=1280&q=80',
  ],
  servicios: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1280&q=80',
    'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1280&q=80',
  ],
  colombia: [
    'https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?w=1280&q=80',
    'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1280&q=80',
    'https://images.unsplash.com/photo-1583531352515-8884af319dc1?w=1280&q=80',
  ],
  noticias: [
    'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1280&q=80',
    'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1280&q=80',
    'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1280&q=80',
  ],
};

const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
};

export const obtenerImagenTematica = (titulo: string, categoria?: string): string => {
  // Normalizar el texto para comparaciones (minúsculas, sin tildes)
  const t = normalizar(`${titulo} ${categoria ?? ''}`);

  // Orden de prioridad: categorías más específicas primero para evitar colisiones
  // IMPORTANTE: Se usan patrones de palabra completa para evitar que "cortes" matchee "corte" (tribunal)
  const reglas: [RegExp, string][] = [
    // Movilidad y transporte (ANTES de seguridad para que "accidente vial" no vaya a seguridad)
    [/\b(movilidad|transito|trafico|accidente vial|ciclovia|metro|mio|troncal|semaforo|transporte|transmilenio|bus|via bloqueada|vias|peaje)\b/, 'movilidad'],
    // Servicios públicos y utilities (ANTES de ambiente para que "agua" no vaya a medio ambiente)
    [/\b(acueducto|agua potable|sin agua|corte de agua|corte del servicio|corte de luz|electricidad|gas natural|servicio publico|alcantarillado|basuras|recoleccion)\b/, 'servicios'],
    // Economía y finanzas
    [/\b(dolar|peso|inflacion|banco de la republica|tasa de interes|economia|finanzas|bolsa|mercado|dinero|inversion|precio|petroleo|barril|fmi|tributar|impuesto|recaudo|deficit|deuda)\b/, 'economia'],
    // Justicia (solo términos judiciales, NO "cortes" de servicio)
    [/\b(fiscalia|corte suprema|consejo de estado|justicia|captura|carcel|tribunal|delito|acusado|demanda penal|abogado|sentencia|juicio|imputado|procesado)\b/, 'justicia'],
    // Política y gobierno
    [/\b(congreso|senado|reforma|presidente|gobierno|ministro|politica|elecciones|alcalde|canciller|voto|petro|espriella|decreto|proyecto de ley|gabinete)\b/, 'politica'],
    // Seguridad y orden público
    [/\b(policia|ejercito|fuerza publica|seguridad|armas|operativo|orden publico|atentado|combate|detenido|capturado|asesinato|homicidio|hurto|robo|extorsion|eln|farc|disidentes)\b/, 'seguridad'],
    // Tecnología
    [/\b(inteligencia artificial|tecnologia|apple|google|microsoft|chip|nvidia|software|internet|ciber|hackers|app|celular|smartphone|startup)\b/, 'tecnologia'],
    // Salud
    [/\b(salud|hospital|medico|vacuna|enfermedad|virus|eps|cirugia|clinica|minsalud|pandemia|dengue|covid)\b/, 'salud'],
    // Medio ambiente y desastres naturales
    [/\b(clima|lluvias|sequia|inundacion|desbordamiento|ambiente|calor extremo|volcan|incendio forestal|temblor|sismo|terremoto|fenomeno natural)\b/, 'ambiente'],
    // Deportes
    [/\b(futbol|partido|gol|seleccion colombia|copa|campeon|liga|estadio|atleta|deporte|olimpico|ciclismo|tenis)\b/, 'deportes'],
    // Colombia (genérico, como último recurso regional)
    [/\b(colombia|bogota|medellin|cali|barranquilla|cartagena|bucaramanga|yopal|casanare|antioquia|cundinamarca)\b/, 'colombia'],
  ];

  for (const [patron, categoria] of reglas) {
    if (patron.test(t)) {
      const arr = BANCO_IMAGENES_TEMATICAS[categoria];
      if (arr?.length) return arr[Math.abs(hashString(titulo)) % arr.length];
    }
  }

  const arr = BANCO_IMAGENES_TEMATICAS.noticias;
  return arr[Math.abs(hashString(titulo)) % arr.length];
};

// Selecciona la imagen temática más apropiada sin depender de APIs externas
// (Wikimedia Commons resultó ser impredecible — devolvía imágenes no relacionadas)
export const buscarImagenRelacionada = async (
  titulo: string,
  _medio?: string,
  categoria?: string
): Promise<string> => {
  const imgFallback = obtenerImagenTematica(titulo, categoria);
  console.log(`   🎨 [Imagen] Seleccionando imagen temática para: "${titulo.slice(0, 50)}…"`);
  return imgFallback;
};

// ─────────────────────────────────────────────
// NODO 1: Lector Web (extractor de titulares)
// ─────────────────────────────────────────────
type MetodoExtraccion = 'google-rss' | 'rss' | 'json-ld' | 'articulo' | 'listado' | 'respaldo';

interface Titular {
  titulo: string;
  enlace?: string;
  descripcion?: string;
  fecha?: string;
  medio?: string; // Ej.: "El Tiempo"
  medioUrl?: string;
  cobertura?: string[]; // Otros medios que cubren la misma noticia
  imagenUrl?: string;   // URL de la imagen principal del artículo
}

interface ResultadoExtraccion {
  principal: Titular;
  otros: Titular[];
  metodo: MetodoExtraccion;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Selectores por orden de prioridad (del más específico al más genérico)
const SELECTORES_TITULARES = [
  '.titleline > a', // Hacker News
  'article h1 a, article h2 a, article h3 a',
  'article h1, article h2, article h3',
  '[itemprop="headline"]',
  '.article-title, .entry-title, .post-title, .headline, .story-title, .news-title',
  '[class*="headline"] a, [class*="article-title"] a, [class*="post-title"] a, [class*="entry-title"] a',
  'h2 a, h3 a, h1 a',
  'h1, h2, h3',
];

const SELECTORES_GOOGLE_NOTICIAS = [
  'article a[href*="/read/"]',
  'article a[href*="/articles/"]',
  'article h3 a',
  'article h4 a',
  'h3 a, h4 a',
];

// Zonas de la página donde NO hay titulares editoriales
const ZONAS_IGNORADAS =
  'nav, footer, aside, [role="navigation"], [class*="menu"], [class*="cookie"], [class*="newsletter"], [class*="sidebar"]';

const TEXTOS_GENERICOS = /^(home|inicio|menu|menú|search|buscar|login|iniciar sesi[oó]n|subscribe|suscr[ií]bete|sign in|sign up|read more|leer m[aá]s|contact|contacto|about|acerca|newsletter|skip to|ver m[aá]s|m[aá]s |see more|view more|full coverage|cobertura completa)/i;

const esTitularValido = (t: string): boolean =>
  t.length >= 20 &&
  t.length <= 220 &&
  t.split(/\s+/).length >= 4 &&
  !TEXTOS_GENERICOS.test(t);

// Quita sufijos tipo " | TechCrunch" o " - The Verge" (solo si el final es corto)
const limpiarTitulo = (crudo: string): string => {
  const limpio = normalizarEspacios(crudo);
  const m = /^(.{15,}?)\s+[|–—·•-]\s+([^|–—·•-]{2,30})$/.exec(limpio);
  return m ? m[1].trim() : limpio;
};

const resolverUrl = (href: string | undefined, base: URL): string | undefined => {
  if (!href) return undefined;
  try {
    const u = new URL(href, base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
};

// Extrae la imagen principal de una página HTML (og:image → twitter:image → primera <img> relevante)
const extraerImagenPrincipal = ($: ReturnType<typeof cheerio.load>, base: URL): string | undefined => {
  // 1) Open Graph
  const og = $('meta[property="og:image"]').attr('content');
  if (og) return resolverUrl(og, base);

  // 2) Twitter Card
  const tw = $('meta[name="twitter:image"]').attr('content') ||
    $('meta[name="twitter:image:src"]').attr('content');
  if (tw) return resolverUrl(tw, base);

  // 3) JSON-LD image
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const data = JSON.parse($(el).html() ?? '{}') as Record<string, unknown>;
      const img = (data.image as { url?: string } | string | undefined);
      const src = typeof img === 'string' ? img : img?.url;
      if (src) return resolverUrl(src, base);
    } catch { /* */ }
  }

  // 4) Primera <img> dentro del cuerpo del artículo con dimensiones razonables
  const zonas = ['article', '[role="main"]', 'main', '.post-content', '.entry-content', '.article-body'];
  for (const zona of zonas) {
    const el = $(`${zona} img`).first();
    const src = el.attr('src') ?? el.attr('data-src') ?? el.attr('data-lazy-src');
    if (!src) continue;
    const w = parseInt(el.attr('width') ?? '0', 10);
    const h = parseInt(el.attr('height') ?? '0', 10);
    // Aceptamos si no hay dimensiones declaradas o son suficientemente grandes
    if (w === 0 || (w >= 200 && h >= 120)) {
      const url = resolverUrl(src, base);
      if (url) return url;
    }
  }

  return undefined;
};

const aISO = (valor: string): string | undefined => {
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

const htmlATexto = (html: string): string =>
  normalizarEspacios(cheerio.load(`<div>${html}</div>`)('div').text());

const descargar = async (url: string, timeout = 10000) => {
  const respuesta = await axios.get<string>(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es,en;q=0.8',
    },
    timeout,
    responseType: 'text',
    maxContentLength: 5 * 1024 * 1024,
  });
  return {
    cuerpo: respuesta.data,
    contentType: String(respuesta.headers['content-type'] ?? '').toLowerCase(),
  };
};

const esFeed = (contentType: string, cuerpo: string): boolean => {
  const inicio = cuerpo.slice(0, 1500).toLowerCase();
  const tipoFeed = !contentType.includes('html') && /(xml|rss|atom)/.test(contentType);
  return tipoFeed || inicio.includes('<rss') || inicio.includes('<feed');
};

// Quita prefijos editoriales ("Video |", "[Foto]"), sufijos de medio ("| El Colombiano")
// y convierte titulares en MAYÚSCULAS SOSTENIDAS a formato normal.
const limpiarTituloNoticia = (crudo: string): string => {
  let t = normalizarEspacios(crudo)
    .replace(/^\[(video|foto|fotos|galer[ií]a)\]\s*/i, '')
    .replace(/^(video|fotos?|galer[ií]a|en vivo|opini[oó]n)\s*[|:–—-]\s+/i, '');
  t = limpiarTitulo(t);

  const letras = t.replace(/[^\p{L}]/gu, '');
  const mayusculas = letras.replace(/[^\p{Lu}]/gu, '');
  if (letras.length > 10 && mayusculas.length / letras.length > 0.7) {
    const minusculas = t.toLowerCase();
    t = minusculas.charAt(0).toUpperCase() + minusculas.slice(1);
  }
  return t;
};

// ── Estrategia 1: RSS / Atom ──
const extraerDeFeed = (xml: string, base: URL): ResultadoExtraccion | null => {
  const $ = cheerio.load(xml, { xmlMode: true });
  const titulares: Titular[] = [];

  for (const el of $('item, entry').toArray().slice(0, MAX_TITULARES)) {
    const $el = $(el);
    const titulo = normalizarEspacios($el.children('title').first().text());
    if (!titulo) continue;

    const hrefAtom =
      $el.children('link[rel="alternate"]').first().attr('href') ??
      $el.children('link').first().attr('href');
    const enlace = resolverUrl(hrefAtom || $el.children('link').first().text().trim(), base);

    const bruto = $el.children('description').first().text() || $el.children('summary').first().text();
    const fechaTxt = $el.children('pubDate, updated, published').first().text().trim();

    titulares.push({
      titulo,
      enlace,
      descripcion: bruto ? htmlATexto(bruto) : undefined,
      fecha: fechaTxt ? aISO(fechaTxt) : undefined,
    });
  }

  if (titulares.length === 0) return null;
  return { principal: titulares[0], otros: titulares.slice(1, MAX_TITULARES), metodo: 'rss' };
};

// ── Estrategia 2: JSON-LD (Article / NewsArticle / BlogPosting) ──
type Obj = Record<string, unknown>;

const aplanarJsonLd = (dato: unknown): Obj[] => {
  if (Array.isArray(dato)) return dato.flatMap((d) => aplanarJsonLd(d));
  if (dato && typeof dato === 'object') {
    const obj = dato as Obj;
    const grafo = obj['@graph'];
    return [obj, ...(Array.isArray(grafo) ? grafo.flatMap((d) => aplanarJsonLd(d)) : [])];
  }
  return [];
};

const extraerJsonLd = ($: cheerio.CheerioAPI, base: URL): Titular | null => {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const datos: unknown = JSON.parse($(el).text());
      for (const nodo of aplanarJsonLd(datos)) {
        const tipos = Array.isArray(nodo['@type']) ? nodo['@type'] : [nodo['@type']];
        const esArticulo = tipos.some(
          (t) => typeof t === 'string' && /Article|BlogPosting|Report/i.test(t)
        );
        if (esArticulo && typeof nodo.headline === 'string' && nodo.headline.trim()) {
          return {
            titulo: normalizarEspacios(nodo.headline),
            descripcion:
              typeof nodo.description === 'string' ? normalizarEspacios(nodo.description) : undefined,
            fecha: typeof nodo.datePublished === 'string' ? aISO(nodo.datePublished) : undefined,
            enlace: typeof nodo.url === 'string' ? resolverUrl(nodo.url, base) : undefined,
          };
        }
      }
    } catch {
      // JSON-LD mal formado: se ignora y se prueba con el siguiente bloque
    }
  }
  return null;
};

// ── Estrategia 3: listados de portada / categoría ──
const extraerListado = (
  $: cheerio.CheerioAPI,
  base: URL,
  selectores: string[] = SELECTORES_TITULARES
): Titular[] => {
  const vistos = new Set<string>();
  const candidatos: Titular[] = [];

  for (const selector of selectores) {
    for (const el of $(selector).toArray().slice(0, 25)) {
      const $el = $(el);
      if ($el.closest(ZONAS_IGNORADAS).length > 0) continue;

      const titulo = normalizarEspacios($el.text());
      const clave = titulo.toLowerCase();
      if (!esTitularValido(titulo) || vistos.has(clave)) continue;
      vistos.add(clave);

      const $enlace = $el.is('a') ? $el : $el.find('a').first().length ? $el.find('a').first() : $el.closest('a');
      candidatos.push({ titulo, enlace: resolverUrl($enlace.attr('href'), base) });

      if (candidatos.length >= MAX_TITULARES) return candidatos;
    }
  }
  return candidatos;
};

const obtenerDescripcionArticulo = async (enlace: string): Promise<string | undefined> => {
  try {
    const { cuerpo } = await descargar(enlace, 8000);
    const $ = cheerio.load(cuerpo);
    const meta =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content');
    if (meta) return normalizarEspacios(meta);

    for (const p of $('article p, main p, p').toArray().slice(0, 10)) {
      const texto = normalizarEspacios($(p).text());
      if (texto.length >= 80) return texto;
    }
  } catch {
    // Si el artículo no responde, el bot trabaja solo con el titular
  }
  return undefined;
};

interface DatosArticulo {
  descripcion?: string;
  imagenUrl?: string;
}

const obtenerDatosArticulo = async (enlace: string): Promise<DatosArticulo> => {
  try {
    const { cuerpo } = await descargar(enlace, 8000);
    const $ = cheerio.load(cuerpo);
    const base = new URL(enlace);

    const descMeta =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content');

    let descripcion: string | undefined = descMeta ? normalizarEspacios(descMeta) : undefined;

    if (!descripcion) {
      for (const p of $('article p, main p, p').toArray().slice(0, 10)) {
        const texto = normalizarEspacios($(p).text());
        if (texto.length >= 80) {
          descripcion = texto;
          break;
        }
      }
    }

    const imagenUrl = extraerImagenPrincipal($, base);
    return { descripcion, imagenUrl };
  } catch {
    return {};
  }
};

// ── Google Noticias ──
const esGoogleNoticias = (url: URL): boolean => url.hostname === 'news.google.com';

// Reconstruye siempre ceid = GL:HL para evitar valores corruptos como "CO:3es-419"
const parametrosGoogle = (url: URL) => {
  const hl = url.searchParams.get('hl') || 'es-419';
  const gl = (url.searchParams.get('gl') || 'CO').toUpperCase();
  return { hl, gl, ceid: `${gl}:${hl}` };
};

const aplicarParametrosGoogle = (destino: URL, url: URL): URL => {
  const { hl, gl, ceid } = parametrosGoogle(url);
  destino.searchParams.set('hl', hl);
  destino.searchParams.set('gl', gl);
  destino.searchParams.set('ceid', ceid);
  return destino;
};

const construirFeedGoogleNoticias = (url: URL): string => {
  const feed = new URL('https://news.google.com');
  const ruta = url.pathname.replace(/\/+$/, '');
  if (ruta.startsWith('/topics/')) {
    feed.pathname = `/rss${ruta}`; // /rss/topics/ID (y /sections/ID si existe)
  } else if (ruta.startsWith('/search')) {
    feed.pathname = '/rss/search';
    const q = url.searchParams.get('q');
    if (q) feed.searchParams.set('q', q);
  } else if (ruta.startsWith('/rss')) {
    feed.pathname = ruta;
  } else {
    feed.pathname = '/rss'; // portada
  }
  return aplicarParametrosGoogle(feed, url).href;
};

const extraerDeFeedGoogle = (xml: string): ResultadoExtraccion | null => {
  const $ = cheerio.load(xml, { xmlMode: true });
  const titulares: Titular[] = [];

  for (const el of $('item').toArray().slice(0, MAX_TITULARES)) {
    const $el = $(el);
    const tituloCrudo = normalizarEspacios($el.children('title').first().text());
    if (!tituloCrudo) continue;

    // Google entrega "Titular - Medio"; separamos ambos
    const $fuente = $el.children('source').first();
    let medio = normalizarEspacios($fuente.text());
    let titulo = tituloCrudo;

    if (medio && titulo.endsWith(` - ${medio}`)) {
      titulo = titulo.slice(0, -(medio.length + 3)).trim();
    } else {
      const m = /^(.*\S)\s+-\s+([^-]{2,60})$/.exec(tituloCrudo);
      if (m) {
        titulo = m[1].trim();
        medio = medio || m[2].trim();
      }
    }
    titulo = limpiarTituloNoticia(titulo);
    if (!titulo) continue;

    // La descripción del feed es HTML con la cobertura relacionada:
    // <li><a>Titular</a> <font>Medio</font></li>
    const descHtml = $el.children('description').first().text();
    let cobertura: string[] = [];
    if (descHtml) {
      const $d = cheerio.load(`<div>${descHtml}</div>`);
      cobertura = [
        ...new Set(
          $d('font')
            .toArray()
            .map((f) => normalizarEspacios($d(f).text()))
            .filter((m) => m && m.toLowerCase() !== medio.toLowerCase())
        ),
      ];
    }

    const fechaTxt = $el.children('pubDate').first().text().trim();
    titulares.push({
      titulo,
      enlace: $el.children('link').first().text().trim() || undefined,
      fecha: fechaTxt ? aISO(fechaTxt) : undefined,
      medio: medio || undefined,
      medioUrl: $fuente.attr('url') || undefined,
      cobertura,
    });
  }

  if (titulares.length === 0) return null;
  return { principal: titulares[0], otros: titulares.slice(1, MAX_TITULARES), metodo: 'google-rss' };
};

const extraerDeGoogleNoticias = async (url: URL): Promise<ResultadoExtraccion> => {
  let motivoFeed = '';
  // 1) Feed RSS del mismo tema
  try {
    const feedUrl = construirFeedGoogleNoticias(url);
    console.log(`📡 [Nodo 1] Google Noticias detectado → feed: ${feedUrl}`);
    const feed = await descargar(feedUrl);
    if (esFeed(feed.contentType, feed.cuerpo)) {
      const resultado = extraerDeFeedGoogle(feed.cuerpo);
      if (resultado) return resultado;
      motivoFeed = 'el feed no trajo noticias';
    } else {
      motivoFeed = 'la respuesta no es un feed RSS';
    }
  } catch (error) {
    motivoFeed = axios.isAxiosError(error) && error.response ? `HTTP ${error.response.status}` : error instanceof Error ? error.message : 'error desconocido';
  }

  // 2) Respaldo: HTML de la página con selectores estructurales
  console.warn(`⚠️ [Nodo 1] Feed no disponible (${motivoFeed}). Probando el HTML de la página...`);
  try {
    const pagina = aplicarParametrosGoogle(new URL(url.pathname, 'https://news.google.com'), url);
    const { cuerpo } = await descargar(pagina.href);
    const $ = cheerio.load(cuerpo);
    const candidatos = extraerListado($, pagina, SELECTORES_GOOGLE_NOTICIAS).map((c) => ({
      ...c,
      titulo: limpiarTituloNoticia(c.titulo),
    }));
    if (candidatos.length > 0) {
      return { principal: candidatos[0], otros: candidatos.slice(1, MAX_TITULARES), metodo: 'listado' };
    }
  } catch {
    // Se informa abajo con el motivo del feed
  }

  throw new Error(
    `No se pudieron obtener noticias de Google Noticias (${motivoFeed}). Verifica que el ID del tema en la URL sea válido.`
  );
};

const extraerTitular = async (
  html: string,
  contentType: string,
  url: URL
): Promise<ResultadoExtraccion> => {
  // 1) La URL ya es un feed
  if (esFeed(contentType, html)) {
    const feed = extraerDeFeed(html, url);
    if (feed) return feed;
    throw new Error('El feed no contiene entradas con título');
  }

  const $ = cheerio.load(html);
  const jsonLd = extraerJsonLd($, url);
  const ogTipo = $('meta[property="og:type"]').attr('content')?.toLowerCase();
  const descripcionMeta = normalizarEspacios(
    $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      ''
  );

  // 2) Página de un artículo concreto
  if (jsonLd || ogTipo === 'article') {
    const titulo = jsonLd
      ? jsonLd.titulo
      : limpiarTitulo(
          $('meta[property="og:title"]').attr('content') ||
            $('h1').first().text() ||
            $('title').first().text()
        );
    if (titulo) {
      return {
        principal: {
          titulo,
          descripcion: jsonLd?.descripcion || descripcionMeta || undefined,
          fecha: jsonLd?.fecha,
          enlace:
            resolverUrl($('link[rel="canonical"]').attr('href'), url) ?? jsonLd?.enlace ?? url.href,
          imagenUrl: extraerImagenPrincipal($, url),
        },
        otros: [],
        metodo: jsonLd ? 'json-ld' : 'articulo',
      };
    }
  }

  // 3a) Portada con feed anunciado: el feed es más limpio que el HTML
  const hrefFeed = resolverUrl(
    $('link[rel="alternate"][type*="rss"], link[rel="alternate"][type*="atom"]').first().attr('href'),
    url
  );
  if (hrefFeed) {
    try {
      const feed = await descargar(hrefFeed, 8000);
      if (esFeed(feed.contentType, feed.cuerpo)) {
        const resultado = extraerDeFeed(feed.cuerpo, new URL(hrefFeed));
        if (resultado) return resultado;
      }
    } catch {
      // Si el feed falla, seguimos con las heurísticas de HTML
    }
  }

  // 3b) Heurísticas de titulares sobre el HTML
  const candidatos = extraerListado($, url);
  if (candidatos.length > 0) {
    return { principal: candidatos[0], otros: candidatos.slice(1, MAX_TITULARES), metodo: 'listado' };
  }

  // 4) Último recurso: título general de la página
  const titulo = limpiarTitulo(
    $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text() ||
      $('title').first().text()
  );
  if (!titulo) throw new Error('No se encontró ningún titular en la página');

  return {
    principal: { titulo, enlace: url.href, descripcion: descripcionMeta || undefined },
    otros: [],
    metodo: 'respaldo',
  };
};

export const ejecutarNodoNoticias = async (
  nodesData?: CanvasNode[]
): Promise<WorkflowItem[]> => {
  const nodo = nodesData?.find((n) => n.id === '1');
  const urlIngresada = nodo?.data?.url?.trim();
  const urlObjetivo = urlIngresada ? urlIngresada : URL_POR_DEFECTO;

  // Configuración del nodo: cuántas noticias y si se evitan las ya publicadas
  const cantidadPedida = Number(nodo?.data?.cantidad);
  const cantidad =
    Number.isFinite(cantidadPedida) && cantidadPedida >= 1
      ? Math.min(Math.floor(cantidadPedida), CANTIDAD_MAXIMA)
      : CANTIDAD_POR_DEFECTO;
  const evitarRepetidas = nodo?.data?.evitarRepetidas !== false; // activo por defecto

  let url: URL;
  try {
    url = new URL(urlObjetivo);
  } catch {
    throw new Error(`URL inválida: "${urlObjetivo}"`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Solo se permiten URLs http o https');
  }

  const googleNoticias = esGoogleNoticias(url);
  const region = googleNoticias ? parametrosGoogle(url).gl : '';

  let resultado: ResultadoExtraccion;

  if (googleNoticias) {
    resultado = await extraerDeGoogleNoticias(url);
  } else {
    console.log(`🌐 [Nodo 1] Conectando a ${url.href}`);
    let pagina: { cuerpo: string; contentType: string };
    try {
      pagina = await descargar(url.href);
    } catch (error) {
      const motivo =
        axios.isAxiosError(error) && error.response
          ? `HTTP ${error.response.status}`
          : error instanceof Error
            ? error.message
            : 'error de red desconocido';
      throw new Error(`No se pudo leer la página (${motivo})`);
    }
    resultado = await extraerTitular(pagina.cuerpo, pagina.contentType, url);
  }

  const { principal, otros, metodo } = resultado;

  // ── Selección de varias noticias sin repetir ──
  const todos: Titular[] = [principal, ...otros];
  const yaVistas = evitarRepetidas ? leerHistorial() : [];
  const elegidos: Titular[] = [];
  let omitidasPorHistorial = 0;

  for (const titular of todos) {
    const clave = claveDeTitular(titular.titulo);
    const repetidaDeAntes = yaVistas.some(
      (h) => h.clave === clave || sonSimilares(h.titulo, titular.titulo)
    );
    if (repetidaDeAntes) {
      omitidasPorHistorial++;
      continue;
    }
    if (elegidos.some((e) => sonSimilares(e.titulo, titular.titulo))) continue; // duplicada en esta misma lista
    elegidos.push(titular);
    if (elegidos.length >= cantidad) break;
  }

  if (elegidos.length === 0) {
    throw new Error(
      `No hay noticias nuevas: las ${omitidasPorHistorial} encontradas ya fueron procesadas. ` +
        'Desmarca "Evitar noticias ya publicadas" o borra posts_generados/historial.json.'
    );
  }

  // ── Contexto RPC para el servicio interno de Google Noticias (DotsSplashUi) ──
  const GARTURLREQ_CTX = [
    ['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1],
    'X',
    'X',
    1,
    [1, 1, 1],
    1,
    1,
    null,
    0,
    0,
    null,
    0,
  ];

  // Decodifica la URL interna de Google Noticias a la URL real del medio de comunicación
  const decodificarUrlGoogleNoticias = async (enlace: string): Promise<string | null> => {
    try {
      const url = new URL(enlace);
      const partes = url.pathname.split('/');
      const artId = partes[partes.length - 1];
      if (!artId) return null;

      const hl = url.searchParams.get('hl') || 'es-419';
      const gl = url.searchParams.get('gl') || 'CO';
      const ceid = url.searchParams.get('ceid') || `${gl}:${hl}`;
      const urlPagina = `https://news.google.com/rss/articles/${artId}?hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;

      const res = await axios.get(urlPagina, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 8000,
      });

      const matchSg = res.data.match(/data-n-a-sg="([^"]+)"/);
      const matchTs = res.data.match(/data-n-a-ts="([^"]+)"/);
      if (!matchSg || !matchTs) return null;

      const signature = matchSg[1];
      const timestamp = matchTs[1];

      const inner = [
        'garturlreq',
        GARTURLREQ_CTX,
        artId,
        Number(timestamp) || timestamp,
        signature,
      ];
      const envelope = [['Fbv4je', JSON.stringify(inner), null, '1']];
      const payload = `f.req=${encodeURIComponent(JSON.stringify([envelope]))}`;

      const resp = await axios.post(
        'https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je',
        payload,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'User-Agent': USER_AGENT,
          },
          timeout: 8000,
        }
      );

      let body = resp.data;
      if (body.includes('\n\n')) body = body.split('\n\n')[1];
      body = body.trim();
      if (body.startsWith(")]}'")) body = body.replace(/^\)\]\}\'\s*/, '');
      const rows = JSON.parse(body);

      for (const row of rows) {
        if (Array.isArray(row) && row.length >= 3) {
          let payloadCell = row[2];
          if (typeof payloadCell === 'string') payloadCell = JSON.parse(payloadCell);
          if (Array.isArray(payloadCell) && payloadCell[0] === 'garturlres' && typeof payloadCell[1] === 'string') {
            return payloadCell[1];
          }
        }
      }
    } catch (err) {
      console.warn(`⚠️ [Nodo 1] Decodificación Google saltada: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
  };

  const categoria =
    region === 'CO' ? 'Noticias Colombia' : googleNoticias ? 'Google Noticias' : 'Tecnología en Vivo';

  // ── Descripción e imagen real de cada artículo ──
  console.log(`🔍 [Nodo 1] Extrayendo artículo e imagen para ${elegidos.length} noticia(s)...`);
  const datosArticulos = await Promise.all(
    elegidos.map(async (t, i): Promise<DatosArticulo> => {
      let imagenUrlBase: string | undefined = t.imagenUrl;
      let urlParaExtraer = t.enlace;
      let descripcionFinal = t.descripcion;

      // Si es un enlace de Google Noticias, resolver la URL real del periódico
      if (t.enlace && t.enlace.includes('news.google.com')) {
        const urlReal = await decodificarUrlGoogleNoticias(t.enlace);
        if (urlReal) {
          t.enlace = urlReal; // Actualizamos para que viaje la URL real del medio!
          urlParaExtraer = urlReal;
        }
      }

      let finalImg = imagenUrlBase;
      if (urlParaExtraer && !urlParaExtraer.includes('news.google.com')) {
        const datos = await obtenerDatosArticulo(urlParaExtraer);
        finalImg = imagenUrlBase ?? datos.imagenUrl;
        descripcionFinal = t.descripcion ?? datos.descripcion;
      }

      // Si la noticia no traía imagen en origen o el scraping no la encontró,
      // buscamos una imagen cercana y relevante basada en el título y contexto
      if (!finalImg) {
        console.log(`   🔎 [${i + 1}/${elegidos.length}] Buscando imagen relevante para: "${t.titulo.slice(0, 45)}…"`);
        finalImg = await buscarImagenRelacionada(t.titulo, t.medio, categoria);
      } else {
        console.log(`   📸 [${i + 1}/${elegidos.length}] ${t.titulo.slice(0, 45)}… → Imagen extraída ✔`);
      }

      return {
        descripcion: descripcionFinal,
        imagenUrl: finalImg,
      };
    })
  );

  console.log(
    `📰 [Nodo 1] Método: ${metodo} → ${elegidos.length} noticia(s) seleccionada(s)` +
      (omitidasPorHistorial > 0 ? ` (${omitidasPorHistorial} omitida(s) por ya publicadas)` : '')
  );
  elegidos.forEach((t, i) => console.log(`   ${i + 1}. ${t.titulo}`));

  return elegidos.map((t, i) => ({
    json: {
      titulo: t.titulo,
      descripcion: datosArticulos[i]?.descripcion ?? '',
      imagenNoticiaUrl: datosArticulos[i]?.imagenUrl ?? '',
      enlace: t.enlace ?? url.href,
      fuente: url.href,
      sitio: url.hostname.replace(/^www\./, ''),
      medio: t.medio ?? '',
      cobertura: t.cobertura ?? [],
      region,
      categoria,
      fecha: t.fecha ?? new Date().toISOString(),
      metodoExtraccion: metodo,
      posicion: i + 1,
      total: elegidos.length,
      omitidasPorHistorial,
      claveHistorial: claveDeTitular(t.titulo),
      evitarRepetidas,
      advertencia:
        metodo === 'respaldo'
          ? 'Solo se encontró el título general de la página. Prueba con un feed RSS o con la URL de un artículo.'
          : '',
    },
  }));
};
// ─────────────────────────────────────────────
// NODO 2: Procesador Inteligente (bot local)
// ─────────────────────────────────────────────
interface Tema {
  nombre: string;
  grupo?: 'noticias';
  hashtags: string[];
  claves: string[]; // en minúsculas, sin tildes
  gancho: string;
  cta: string;
}

const TEMAS_TECH: Tema[] = [
  {
    nombre: 'Inteligencia Artificial',
    hashtags: ['#InteligenciaArtificial', '#IA'],
    claves: ['ai', 'ia', 'artificial intelligence', 'inteligencia artificial', 'gpt', 'llm', 'llms', 'openai', 'anthropic', 'gemini', 'claude', 'chatgpt', 'copilot', 'machine learning', 'aprendizaje', 'neural', 'agent', 'agentes', 'deepseek', 'mistral', 'llama', 'diffusion'],
    gancho: '🤖 La inteligencia artificial sigue avanzando:',
    cta: '¿Cómo crees que esto cambiará tu forma de trabajar?',
  },
  {
    nombre: 'Desarrollo Web',
    hashtags: ['#DesarrolloWeb', '#Frontend'],
    claves: ['javascript', 'typescript', 'react', 'vue', 'angular', 'svelte', 'node js', 'nodejs', 'next js', 'nextjs', 'css', 'html', 'frontend', 'backend', 'web', 'browser', 'navegador', 'chrome', 'firefox', 'vite', 'api', 'wasm', 'webassembly', 'framework'],
    gancho: '🌐 Novedades para quienes construyen la web:',
    cta: '¿Lo probarías en tu próximo proyecto?',
  },
  {
    nombre: 'Programación',
    hashtags: ['#Programacion', '#Coding'],
    claves: ['python', 'rust', 'golang', 'java', 'kotlin', 'swift', 'compiler', 'compilador', 'programming', 'programacion', 'developer', 'developers', 'desarrollador', 'code', 'coding', 'codigo', 'software', 'library', 'libreria'],
    gancho: '👨‍💻 Para quienes viven en el código:',
    cta: '¿Qué opinan los desarrolladores del equipo?',
  },
  {
    nombre: 'Ciberseguridad',
    hashtags: ['#Ciberseguridad', '#InfoSec'],
    claves: ['security', 'seguridad', 'hack', 'hacker', 'breach', 'vulnerability', 'vulnerabilidad', 'ransomware', 'malware', 'exploit', 'cve', 'privacy', 'privacidad', 'encryption', 'cifrado', 'leak', 'phishing', 'attack', 'ataque'],
    gancho: '🔐 Alerta de seguridad que conviene conocer:',
    cta: '¿Tu equipo está preparado para algo así?',
  },
  {
    nombre: 'Cloud y DevOps',
    hashtags: ['#Cloud', '#DevOps'],
    claves: ['cloud', 'nube', 'aws', 'azure', 'kubernetes', 'docker', 'devops', 'serverless', 'deploy', 'despliegue', 'infrastructure', 'infraestructura', 'server', 'servidor'],
    gancho: '☁️ Novedades de infraestructura y nube:',
    cta: '¿Cómo lo aplicarías en tu stack actual?',
  },
  {
    nombre: 'Datos',
    hashtags: ['#Datos', '#Analytics'],
    claves: ['database', 'databases', 'base de datos', 'sql', 'postgres', 'postgresql', 'mysql', 'sqlite', 'mongodb', 'data', 'datos', 'analytics'],
    gancho: '📊 Los datos vuelven a ser noticia:',
    cta: '¿Cómo gestionas los datos en tus proyectos?',
  },
  {
    nombre: 'Código Abierto',
    hashtags: ['#OpenSource', '#CodigoAbierto'],
    claves: ['open source', 'opensource', 'codigo abierto', 'github', 'gitlab', 'linux', 'license', 'licencia', 'maintainer'],
    gancho: '🧩 Novedades del mundo open source:',
    cta: '¿Contribuyes a algún proyecto abierto?',
  },
  {
    nombre: 'Hardware',
    hashtags: ['#Hardware', '#Tecnologia'],
    claves: ['chip', 'chips', 'gpu', 'nvidia', 'intel', 'amd', 'processor', 'procesador', 'semiconductor', 'iphone', 'android', 'smartphone', 'laptop', 'apple', 'samsung', 'device', 'dispositivo'],
    gancho: '🔧 Novedades de hardware y dispositivos:',
    cta: '¿Cambiarías tu equipo por esto?',
  },
  {
    nombre: 'Startups y Negocios',
    hashtags: ['#Startups', '#Negocios'],
    claves: ['startup', 'startups', 'funding', 'raises', 'acquisition', 'acquires', 'adquisicion', 'ipo', 'billion', 'million', 'inversion', 'ronda', 'valuation', 'layoffs', 'despidos'],
    gancho: '💼 Movimientos en el mundo de los negocios tech:',
    cta: '¿Qué impacto tendrá en el mercado?',
  },
  {
    nombre: 'Blockchain',
    hashtags: ['#Blockchain', '#Cripto'],
    claves: ['bitcoin', 'crypto', 'cryptocurrency', 'blockchain', 'ethereum', 'token', 'nft'],
    gancho: '⛓️ Novedades en blockchain y criptomonedas:',
    cta: '¿Ves futuro en esta tecnología?',
  },
  {
    nombre: 'Automatización',
    hashtags: ['#Automatizacion', '#Productividad'],
    claves: ['automation', 'automatizacion', 'workflow', 'workflows', 'n8n', 'zapier', 'bot', 'rpa', 'low code', 'no code'],
    gancho: '⚙️ Automatizar es ganar tiempo:',
    cta: '¿Qué tarea automatizarías primero?',
  },
  {
    nombre: 'Ciencia y Espacio',
    hashtags: ['#Ciencia', '#Espacio'],
    claves: ['space', 'espacio', 'nasa', 'spacex', 'quantum', 'cuantico', 'cuantica', 'physics', 'fisica', 'rocket', 'cohete', 'satellite', 'satelite', 'research', 'investigacion', 'study', 'estudio'],
    gancho: '🔭 Ciencia y tecnología que abren horizontes:',
    cta: '¿Hasta dónde crees que llegaremos?',
  },
];

const TEMAS_NOTICIAS: Tema[] = [
  {
    nombre: 'Política',
    grupo: 'noticias',
    hashtags: ['#Politica', '#Gobierno'],
    claves: ['gobierno', 'presidente', 'presidencia', 'congreso', 'senado', 'senador', 'ministro', 'ministra', 'elecciones', 'reforma', 'alcalde', 'alcaldia', 'gobernador', 'gobernacion', 'partido', 'candidato', 'campana', 'decreto', 'oposicion', 'consejo de estado'],
    gancho: '🏛️ Lo que se mueve en la política nacional:',
    cta: '¿Cómo crees que esto afectará al país?',
  },
  {
    nombre: 'Seguridad y Orden Público',
    grupo: 'noticias',
    hashtags: ['#Seguridad', '#OrdenPublico'],
    claves: ['ataque', 'atentado', 'capturado', 'captura', 'capturan', 'asesinato', 'asesinado', 'asesinan', 'homicidio', 'disidencias', 'eln', 'narcotrafico', 'cocaina', 'policia', 'ejercito', 'militar', 'militares', 'secuestro', 'bombardeo', 'criminal', 'banda', 'hurto', 'extorsion', 'incautan', 'incautacion', 'operativo', 'explosivos'],
    gancho: '🚨 Atención, esto es lo que se conoce:',
    cta: '¿Cómo ves la situación de seguridad en tu región?',
  },
  {
    nombre: 'Justicia',
    grupo: 'noticias',
    hashtags: ['#Justicia'],
    claves: ['fiscalia', 'juez', 'jueza', 'tribunal', 'corte', 'condena', 'sentencia', 'fallo', 'audiencia', 'demanda', 'tutela', 'procuraduria', 'juzgado', 'imputacion'],
    gancho: '⚖️ Novedades desde los estrados:',
    cta: '¿Estás de acuerdo con la decisión?',
  },
  {
    nombre: 'Economía',
    grupo: 'noticias',
    hashtags: ['#Economia', '#Finanzas'],
    claves: ['economia', 'inflacion', 'dolar', 'banco', 'tasa', 'impuesto', 'impuestos', 'tributaria', 'pib', 'empleo', 'desempleo', 'salario', 'petroleo', 'ecopetrol', 'gasolina', 'combustible', 'mercado', 'bolsa', 'arriendo', 'subsidio'],
    gancho: '💰 Lo que debes saber sobre tu bolsillo:',
    cta: '¿Cómo te afecta este cambio?',
  },
  {
    nombre: 'Deportes',
    grupo: 'noticias',
    hashtags: ['#Deportes'],
    claves: ['futbol', 'seleccion', 'liga', 'gol', 'partido', 'ciclismo', 'tour', 'formula', 'campeonato', 'mundial', 'dimayor', 'tenis', 'atletismo', 'olimpicos'],
    gancho: '⚽ Noticias del mundo deportivo:',
    cta: '¿Quién se lleva tu apoyo?',
  },
  {
    nombre: 'Clima y Emergencias',
    grupo: 'noticias',
    hashtags: ['#Clima', '#Emergencia'],
    claves: ['temblor', 'sismo', 'terremoto', 'lluvia', 'lluvias', 'inundacion', 'incendio', 'incendios', 'calor', 'clima', 'ideam', 'volcan', 'emergencia', 'damnificados', 'deslizamiento', 'nino', 'ceniza'],
    gancho: '🌦️ Alerta y prevención:',
    cta: '¿Estás preparado? Comparte para informar a otros.',
  },
  {
    nombre: 'Movilidad y Servicios',
    grupo: 'noticias',
    hashtags: ['#Movilidad', '#Ciudad'],
    claves: ['pico y placa', 'transmilenio', 'metro', 'trancon', 'movilidad', 'transito', 'agua', 'acueducto', 'racionamiento', 'energia', 'transporte', 'aeropuerto', 'vuelo', 'avianca', 'peajes', 'cortes'],
    gancho: '🚦 Si te mueves por la ciudad, esto te interesa:',
    cta: '¿Cómo te afecta en tu día a día?',
  },
  {
    nombre: 'Salud',
    grupo: 'noticias',
    hashtags: ['#Salud'],
    claves: ['salud', 'hospital', 'eps', 'medico', 'medicos', 'vacuna', 'epidemia', 'dengue', 'virus', 'sanitaria', 'enfermedad', 'clinica', 'eutanasia'],
    gancho: '🩺 Información de salud que vale la pena conocer:',
    cta: '¿Conocías esta información?',
  },
  {
    nombre: 'Educación',
    grupo: 'noticias',
    hashtags: ['#Educacion'],
    claves: ['colegio', 'universidad', 'estudiantes', 'docentes', 'profesores', 'educacion', 'icfes', 'matricula', 'beca', 'sena'],
    gancho: '🎓 Novedades del sector educativo:',
    cta: '¿Cómo lo ven estudiantes y familias?',
  },
  {
    nombre: 'Entretenimiento y Cultura',
    grupo: 'noticias',
    hashtags: ['#Entretenimiento', '#Cultura'],
    claves: ['cantante', 'artista', 'musica', 'concierto', 'pelicula', 'serie', 'festival', 'television', 'actor', 'actriz', 'reality', 'premio', 'masterchef', 'influencer'],
    gancho: '🎬 Lo último en entretenimiento y cultura:',
    cta: '¿Qué opinas?',
  },
  {
    nombre: 'Internacional',
    grupo: 'noticias',
    hashtags: ['#Internacional'],
    claves: ['venezuela', 'estados unidos', 'eeuu', 'rusia', 'ucrania', 'israel', 'gaza', 'china', 'onu', 'trump', 'cancilleria', 'embajada', 'frontera', 'migrantes', 'ofac'],
    gancho: '🌎 Una mirada al panorama internacional:',
    cta: '¿Cómo crees que impactará a Colombia?',
  },
];

const TEMAS: Tema[] = [...TEMAS_TECH, ...TEMAS_NOTICIAS];

// Marcas y tecnologías conocidas → hashtag canónico
const ENTIDADES: Record<string, string> = {
  google: '#Google', apple: '#Apple', microsoft: '#Microsoft', meta: '#Meta', amazon: '#Amazon',
  nvidia: '#Nvidia', tesla: '#Tesla', samsung: '#Samsung', openai: '#OpenAI', anthropic: '#Anthropic',
  mozilla: '#Mozilla', linux: '#Linux', python: '#Python', rust: '#RustLang', github: '#GitHub',
  typescript: '#TypeScript', javascript: '#JavaScript', react: '#ReactJS', kubernetes: '#Kubernetes',
  docker: '#Docker', postgres: '#PostgreSQL', postgresql: '#PostgreSQL', aws: '#AWS', azure: '#Azure',
  nasa: '#NASA', spacex: '#SpaceX', intel: '#Intel', amd: '#AMD', gemini: '#Gemini', claude: '#Claude',
};

// Lugares (clave normalizada y sin tildes) → hashtag
const LUGARES: Record<string, string> = {
  bogota: '#Bogota',
  medellin: '#Medellin',
  cali: '#Cali',
  barranquilla: '#Barranquilla',
  cartagena: '#Cartagena',
  bucaramanga: '#Bucaramanga',
  cucuta: '#Cucuta',
  pereira: '#Pereira',
  manizales: '#Manizales',
  ibague: '#Ibague',
  pasto: '#Pasto',
  'santa marta': '#SantaMarta',
  villavicencio: '#Villavicencio',
  soacha: '#Soacha',
  cauca: '#Cauca',
  antioquia: '#Antioquia',
  'valle del cauca': '#ValleDelCauca',
  cundinamarca: '#Cundinamarca',
  atlantico: '#Atlantico',
  narino: '#Narino',
  tolima: '#Tolima',
  santander: '#Santander',
  boyaca: '#Boyaca',
  choco: '#Choco',
  guajira: '#LaGuajira',
  catatumbo: '#Catatumbo',
  'norte de santander': '#NorteDeSantander',
  magdalena: '#Magdalena',
  huila: '#Huila',
  caqueta: '#Caqueta',
  putumayo: '#Putumayo',
};

// Instituciones y marcas colombianas
const ENTIDADES_CO: Record<string, string> = {
  ecopetrol: '#Ecopetrol',
  avianca: '#Avianca',
  dian: '#DIAN',
  ideam: '#IDEAM',
  transmilenio: '#TransMilenio',
  fiscalia: '#Fiscalia',
  registraduria: '#Registraduria',
  congreso: '#Congreso',
  bancolombia: '#Bancolombia',
  procuraduria: '#Procuraduria',
};

const unicos = (lista: string[]): string[] => {
  const vistos = new Set<string>();
  return lista.filter((h) => {
    const clave = h.toLowerCase();
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
};

const detectarLugares = (...textos: string[]): string[] => {
  const encontrados: string[] = [];
  for (const texto of textos) {
    const hay = ` ${tokenizar(texto).join(' ')} `;
    for (const [clave, hashtag] of Object.entries(LUGARES)) {
      if (hay.includes(` ${clave} `)) encontrados.push(hashtag);
    }
  }
  return unicos(encontrados);
};

// Claves largas admiten variantes (agent → agents); las cortas exigen palabra exacta
const coincide = (haystack: string, clave: string): boolean =>
  clave.length >= 5 ? haystack.includes(` ${clave}`) : haystack.includes(` ${clave} `);

const puntuarTema = (tema: Tema, hayTitulo: string, hayDescripcion: string): number =>
  tema.claves.reduce(
    (total, clave) =>
      total + (coincide(hayTitulo, clave) ? 2 : 0) + (coincide(hayDescripcion, clave) ? 1 : 0),
    0
  );

const extraerEntidades = (titulo: string): string[] => {
  const encontradas: string[] = [];
  for (const cruda of titulo.split(/\s+/)) {
    const palabra = cruda.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!palabra) continue;
    const clave = normalizar(palabra);
    const conocida = ENTIDADES[clave] ?? ENTIDADES_CO[clave];
    if (conocida) {
      encontradas.push(conocida);
    } else if (/^[A-Z][a-z]+[A-Z][A-Za-z]*$/.test(palabra)) {
      encontradas.push(`#${palabra}`); // CamelCase: OpenAI, TransMilenio…
    }
  }
  return encontradas;
};

const primerasFrases = (texto: string, max: number): string => {
  const limpio = normalizarEspacios(texto);
  if (!limpio) return '';
  const frases = limpio.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [limpio];
  let resumen = '';
  for (const frase of frases) {
    if ((resumen + frase).length > max) break;
    resumen += frase;
  }
  return resumen.trim() || recortar(limpio, max);
};

const fraseFuente = (medio: string, cobertura: string[]): string => {
  if (!medio) return '';
  const otros = [...new Set(cobertura.filter((m) => m.toLowerCase() !== medio.toLowerCase()))].slice(0, 2);
  if (otros.length === 0) return `Información publicada por ${medio}.`;
  const lista = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(otros);
  return `Información publicada por ${medio}, con cobertura también de ${lista}.`;
};

export const ejecutarNodoGeminiLocal = async (
  inputData: WorkflowItem[]
): Promise<WorkflowItem[]> => {
  console.log('🤖 [Nodo 2] El bot está analizando el contenido...');
  const resultados: WorkflowItem[] = [];

  for (const item of inputData) {
    const noticia = item.json;
    const titulo = String(noticia.titulo ?? '');
    const descripcionCruda = String(noticia.descripcion ?? '');
    const enlace = String(noticia.enlace ?? noticia.fuente ?? '');
    const medio = String(noticia.medio ?? '');
    const region = String(noticia.region ?? '');
    const cobertura: string[] = Array.isArray(noticia.cobertura)
      ? noticia.cobertura.filter((m: unknown): m is string => typeof m === 'string')
      : [];

    // La descripción se ignora si solo repite el titular
    const repiteTitular = normalizar(descripcionCruda).startsWith(normalizar(titulo).slice(0, 30));
    const descripcion = repiteTitular ? '' : descripcionCruda;

    // 1) Detección de temas
    const hayTitulo = ` ${tokenizar(titulo).join(' ')} `;
    const hayDescripcion = ` ${tokenizar(descripcion).join(' ')} `;
    const temasPuntuados = TEMAS.map((tema) => ({
      tema,
      puntaje: puntuarTema(tema, hayTitulo, hayDescripcion),
    }))
      .filter((t) => t.puntaje >= 2)
      .sort((a, b) => b.puntaje - a.puntaje)
      .slice(0, 2);

    const principal = temasPuntuados[0]?.tema;
    const secundario = temasPuntuados[1]?.tema;
    const grupoNoticias = region !== '' || principal?.grupo === 'noticias';
    const esColombia = region === 'CO' || hayTitulo.includes(' colombia ');

    // 2) Palabras clave, lugares y entidades
    const palabrasClave = [
      ...new Set(tokenizar(titulo).filter((p) => p.length > 3 && !STOPWORDS.has(p))),
    ].slice(0, 4);
    const lugares = detectarLugares(titulo, descripcion).slice(0, 2);
    const entidades = unicos(extraerEntidades(titulo)).slice(0, 2);

    // 3) Hashtags: contexto primero, cierre fijo al final (máximo 6)
    const finales = grupoNoticias ? ['#Actualidad', '#Noticias'] : ['#TechNews'];
    const base = unicos([
      ...(esColombia ? ['#Colombia'] : []),
      ...lugares,
      ...(principal?.hashtags ?? []),
      ...(secundario ? [secundario.hashtags[0]] : []),
      ...entidades,
    ]).filter((h) => !finales.includes(h));

    const hashtags = unicos([...base.slice(0, 6 - finales.length), ...finales]);

    // 4) Resumen limpio
    let resumenBot = primerasFrases(descripcion, 180);
    if (!resumenBot) {
      if (grupoNoticias) {
        resumenBot = [fraseFuente(medio, cobertura), principal ? `Tema: ${principal.nombre}.` : '']
          .filter(Boolean)
          .join(' ');
      } else if (principal && palabrasClave.length > 0) {
        resumenBot = `Titular sobre ${principal.nombre.toLowerCase()}. Conceptos clave: ${palabrasClave.join(', ')}.`;
      } else if (palabrasClave.length > 0) {
        resumenBot = `Conceptos clave del titular: ${palabrasClave.join(', ')}.`;
      }
    }

    // 5) Copy largo y corto (≤ 280 caracteres)
    const gancho = principal?.gancho ?? (grupoNoticias ? '📢 Última hora:' : '📢 Última hora en tecnología:');
    const cta = principal?.cta ?? '¿Qué opinas de esta noticia?';

    // Los enlaces de redirección de Google son larguísimos: no se incluyen en el copy
    const enlaceCopy = enlace.length <= 120 ? enlace : '';

    const textoRedes = [
      gancho,
      `📰 ${titulo}`,
      resumenBot || null,
      `💬 ${cta}`,
      enlaceCopy ? `🔗 ${enlaceCopy}` : null,
      hashtags.join(' '),
    ]
      .filter((seccion): seccion is string => Boolean(seccion))
      .join('\n\n');

    const hashtagsCortos = hashtags.slice(0, 3).join(' ');
    const espacioTitulo = Math.max(40, 280 - gancho.length - hashtagsCortos.length - 4);
    const copyCorto = [gancho, recortar(titulo, espacioTitulo), hashtagsCortos].join('\n\n');

    resultados.push({
      json: {
        ...noticia,
        categoria: principal?.nombre ?? noticia.categoria,
        resumenBot,
        textoRedes,
        copyCorto,
        hashtags,
        analisis: {
          temas: temasPuntuados.map((t) => ({ nombre: t.tema.nombre, puntaje: t.puntaje })),
          palabrasClave,
          lugares,
          entidades,
          palabrasTitulo: titulo.split(/\s+/).filter(Boolean).length,
          caracteresCopyCorto: copyCorto.length,
        },
      },
    });
  }

  return resultados;
};

// ─────────────────────────────────────────────
// NODO 3: Generador Gráfico
// ─────────────────────────────────────────────
const dividirLineas = (
  ctx: CanvasRenderingContext2D,
  texto: string,
  maxAncho: number,
  maxLineas: number
): string[] => {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';

  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > maxAncho && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);

  if (lineas.length > maxLineas) {
    const recorte = lineas.slice(0, maxLineas);
    recorte[maxLineas - 1] = `${recorte[maxLineas - 1].replace(/[.,;:\s]+$/, '')}…`;
    return recorte;
  }
  return lineas;
};

// Dibuja un rectángulo con esquinas redondeadas
const dibujarRectanguloRedondeado = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

interface PalabraRender {
  texto: string;
  esClave: boolean;
}

interface LineaColor {
  palabras: PalabraRender[];
}

// Divide el titular en líneas manteniendo el coloreado de palabras clave (#38bdf8)
const dividirLineasConColores = (
  ctx: CanvasRenderingContext2D,
  textoCompleto: string,
  setClaves: Set<string>,
  maxAncho: number,
  maxLineas: number
): LineaColor[] => {
  const palabras = textoCompleto.split(/\s+/).filter(Boolean);
  const lineas: LineaColor[] = [];
  let lineaActual: PalabraRender[] = [];
  let anchoActual = 0;
  const espacioAncho = ctx.measureText(' ').width;

  for (const p of palabras) {
    const palabraNorm = normalizar(p)
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
      .toLowerCase();
    const esClave = palabraNorm.length >= 3 && setClaves.has(palabraNorm);
    const palabraAncho = ctx.measureText(p).width;
    const nuevoAncho =
      lineaActual.length > 0 ? anchoActual + espacioAncho + palabraAncho : palabraAncho;

    if (nuevoAncho > maxAncho && lineaActual.length > 0) {
      lineas.push({ palabras: lineaActual });
      lineaActual = [{ texto: p, esClave }];
      anchoActual = palabraAncho;
    } else {
      lineaActual.push({ texto: p, esClave });
      anchoActual = nuevoAncho;
    }
  }

  if (lineaActual.length > 0 && lineas.length < maxLineas) {
    lineas.push({ palabras: lineaActual });
  }

  if (lineas.length >= maxLineas) {
    const ultima = lineas[maxLineas - 1];
    if (ultima && ultima.palabras.length > 0) {
      const ultPalabra = ultima.palabras[ultima.palabras.length - 1];
      ultPalabra.texto = `${ultPalabra.texto.replace(/[.,;:\s]+$/, '')}…`;
    }
  }

  return lineas.slice(0, maxLineas);
};

export interface OpcionesRender {
  colorAcento?: string;
  colorSecundario?: string;
  marcaAgua?: string;
  nombreArchivo?: string;
  marca?: number;
}

export const renderizarTarjeta = async (
  datos: Record<string, any>,
  indice = 0,
  total = 1,
  opciones: OpcionesRender = {}
): Promise<{
  imagenPath: string;
  imagenNombre: string;
  tamanoKB: number;
  vistaPrevia: string;
  tieneMiniatura: boolean;
}> => {
  fs.mkdirSync(carpetaDestino, { recursive: true });

  // 1. Dimensiones estilo infografía / Instagram (1080 x 1350 px, vertical 4:5)
  const width = 1080;
  const height = 1350;
  const X_PAD = 70;
  const maxAncho = width - X_PAD * 2; // 940 px
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const colorAcento = opciones.colorAcento || String(datos.colorAcento || '#0284c7');

  // 2. Cargar imagen de la noticia para usarla como fondo cover
  let imgCargada: CanvasImage | null = null;
  const imagenNoticiaUrl =
    typeof datos.imagenNoticiaUrl === 'string' ? datos.imagenNoticiaUrl : '';
  if (imagenNoticiaUrl) {
    try {
      const respImagen = await axios.get<ArrayBuffer>(imagenNoticiaUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'image/*,*/*;q=0.8',
          Referer: 'https://news.google.com/',
        },
        responseType: 'arraybuffer',
        timeout: 10000,
        maxRedirects: 5,
      });
      const imgBuffer = Buffer.from(respImagen.data);
      imgCargada = await loadImage(imgBuffer);
    } catch (err) {
      console.warn(
        `⚠️ [Nodo 3] No se pudo cargar imagen de fondo: ${err instanceof Error ? err.message : String(err)}`
      );
      imgCargada = null;
    }
  }

  // 2b. Si no vino imagen o falló la descarga, buscar una imagen relacionada de respaldo garantizada
  if (!imgCargada) {
    try {
      const fallbackUrl = await buscarImagenRelacionada(
        String(datos.titulo || ''),
        String(datos.medio || ''),
        String(datos.categoria || '')
      );
      if (fallbackUrl) {
        console.log(`   🔄 [Nodo 3] Cargando imagen relacionada de respaldo en canvas...`);
        const respFallback = await axios.get<ArrayBuffer>(fallbackUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'image/*,*/*;q=0.8',
          },
          responseType: 'arraybuffer',
          timeout: 10000,
        });
        imgCargada = await loadImage(Buffer.from(respFallback.data));
      }
    } catch (err) {
      console.warn(`⚠️ [Nodo 3] Error cargando imagen de respaldo en canvas: ${err instanceof Error ? err.message : String(err)}`);
      imgCargada = null;
    }
  }

  // 3. Dibujar Fondo (object-fit: cover) o gradiente de respaldo
  if (imgCargada) {
    const scale = Math.max(width / imgCargada.width, height / imgCargada.height);
    const w = imgCargada.width * scale;
    const h = imgCargada.height * scale;
    const x = (width - w) / 2;
    const y = (height - h) / 2;
    ctx.drawImage(imgCargada, x, y, w, h);
  } else {
    const fondo = ctx.createLinearGradient(0, 0, width, height);
    fondo.addColorStop(0, '#030712');
    fondo.addColorStop(0.5, '#0f172a');
    fondo.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, width, height);
  }

  // 4. Overlays degradados para máxima legibilidad
  // Degradado superior (para marca de agua y Picture-in-Picture)
  const gradTop = ctx.createLinearGradient(0, 0, 0, 240);
  gradTop.addColorStop(0, 'rgba(3, 7, 18, 0.85)');
  gradTop.addColorStop(1, 'rgba(3, 7, 18, 0)');
  ctx.fillStyle = gradTop;
  ctx.fillRect(0, 0, width, 240);

  // Degradado inferior profundo (de transparente a oscuro casi sólido)
  const gradBottom = ctx.createLinearGradient(0, 480, 0, height);
  gradBottom.addColorStop(0, 'rgba(3, 7, 18, 0)');
  gradBottom.addColorStop(0.28, 'rgba(3, 7, 18, 0.5)');
  gradBottom.addColorStop(0.62, 'rgba(3, 7, 18, 0.92)');
  gradBottom.addColorStop(1, 'rgba(2, 4, 10, 0.98)');
  ctx.fillStyle = gradBottom;
  ctx.fillRect(0, 480, width, height - 480);

  // 5. Marca de Agua Institucional (Esquina Superior Izquierda)
  const watermarkX = X_PAD;
  const watermarkY = 85;

  ctx.save();
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(watermarkX + 6, watermarkY - 7, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Arial, Helvetica, sans-serif';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  const textoMarca = String(
    opciones.marcaAgua || datos.marcaAgua || 'UNIVERSO OBSERVABLE'
  ).toUpperCase();
  ctx.fillText(textoMarca, watermarkX + 24, watermarkY);
  ctx.restore();

  // 6. Picture-in-Picture Flotante Circular con Borde Blanco (Esquina Superior Derecha)
  const pipR = 56;
  const pipCX = width - X_PAD - pipR;
  const pipCY = 85;

  ctx.save();
  ctx.beginPath();
  ctx.arc(pipCX, pipCY, pipR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (imgCargada) {
    const zoom = 1.35;
    const minD = Math.min(imgCargada.width, imgCargada.height);
    const sw = minD / zoom;
    const sh = minD / zoom;
    const sx = (imgCargada.width - sw) / 2;
    const sy = (imgCargada.height - sh) / 2;
    ctx.drawImage(imgCargada, sx, sy, sw, sh, pipCX - pipR, pipCY - pipR, pipR * 2, pipR * 2);
  } else {
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(pipCX - pipR, pipCY - pipR, pipR * 2, pipR * 2);
  }
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(pipCX, pipCY, pipR, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // 7. Preparación de Palabras Clave para el Resaltado en Cian (#38bdf8)
  const palabrasClaveRaw: string[] = Array.isArray(datos.palabrasClave)
    ? datos.palabrasClave
    : Array.isArray(datos.analisis?.palabrasClave)
      ? datos.analisis.palabrasClave
      : [];

  const clavesFinales =
    palabrasClaveRaw.length > 0
      ? palabrasClaveRaw
      : tokenizar(String(datos.titulo ?? ''))
          .filter((p) => p.length > 3 && !STOPWORDS.has(p))
          .slice(0, 5);

  const setClaves = new Set(
    clavesFinales
      .map((k) =>
        normalizar(k)
          .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
          .toLowerCase()
      )
      .filter(Boolean)
  );

  // 8. Cálculo de Layout Dinámico del Bloque Inferior
  ctx.font = 'bold 50px Arial, Helvetica, sans-serif';
  const lineasTitular = dividirLineasConColores(
    ctx,
    String(datos.titulo ?? ''),
    setClaves,
    maxAncho,
    4
  );
  const titularAlto = lineasTitular.length * 66;

  const resumen = String(datos.resumenBot ?? '').trim();
  ctx.font = '24px Arial, sans-serif';
  const lineasResumen = resumen ? dividirLineas(ctx, resumen, maxAncho, 2) : [];
  const resumenAlto = lineasResumen.length > 0 ? lineasResumen.length * 34 + 18 : 0;

  const creditosY = 1250;
  const pillH = 38;
  const gapPillTitle = 24;
  const totalTextoH =
    pillH + gapPillTitle + titularAlto + (resumenAlto > 0 ? 20 + resumenAlto : 0);
  const inicioY = Math.max(720, creditosY - 35 - totalTextoH);

  // 9. Etiqueta de Categoría Superior (Pastilla Azul con Texto Blanco)
  const catTexto = String(datos.categoria ?? 'NOTICIAS').toUpperCase();
  ctx.font = 'bold 16px Arial, sans-serif';
  const pillW = ctx.measureText(catTexto).width + 36;
  const pillY = inicioY;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 8;
  dibujarRectanguloRedondeado(ctx, X_PAD, pillY, pillW, pillH, 8);
  ctx.fillStyle = colorAcento || '#0284c7';
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(catTexto, X_PAD + 18, pillY + 24);

  if (total > 1) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText(`${indice + 1}/${total}`, X_PAD + pillW + 16, pillY + 24);
  }

  // 10. Titular Principal con Palabras Clave Resaltadas en Cian (#38bdf8)
  let curY = pillY + pillH + gapPillTitle + 42;
  ctx.save();
  ctx.font = 'bold 50px Arial, Helvetica, sans-serif';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 3;

  for (const linea of lineasTitular) {
    let curX = X_PAD;
    for (const item of linea.palabras) {
      ctx.fillStyle = item.esClave ? '#38bdf8' : '#ffffff';
      ctx.fillText(item.texto, curX, curY);
      curX += ctx.measureText(item.texto + ' ').width;
    }
    curY += 66;
  }
  ctx.restore();

  // 11. Subtítulo / Resumen
  if (lineasResumen.length > 0) {
    curY += 8;
    ctx.save();
    ctx.font = '24px Arial, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    for (const lr of lineasResumen) {
      ctx.fillText(lr, X_PAD, curY);
      curY += 34;
    }
    ctx.restore();
  }

  // 12. Crédito Inferior (Línea, Fuente y Enlace)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(X_PAD, creditosY);
  ctx.lineTo(width - X_PAD, creditosY);
  ctx.stroke();

  // Fuente original (lado izquierdo)
  const medioTexto = datos.medio
    ? `FUENTE: ${String(datos.medio).toUpperCase()}`
    : 'FUENTE: NOTICIA ORIGINAL';
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(medioTexto, X_PAD, creditosY + 40);

  // Enlace directo a la noticia (lado derecho)
  const enlaceNoticia = String(datos.enlace ?? datos.fuente ?? '');
  if (enlaceNoticia) {
    try {
      const urlObj = new URL(enlaceNoticia);
      const dominio = urlObj.hostname.replace(/^www\./, '');
      const rutaCorta =
        urlObj.pathname.length > 28
          ? `${urlObj.pathname.slice(0, 25)}…`
          : urlObj.pathname;
      const textoEnlace = `🔗 ${dominio}${rutaCorta !== '/' ? rutaCorta : ''}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px Arial, sans-serif';
      ctx.fillText(textoEnlace, width - X_PAD, creditosY + 40);
      ctx.textAlign = 'left';
    } catch {
      const limpio = enlaceNoticia.replace(/^https?:\/\/(www\.)?/, '').slice(0, 36);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px Arial, sans-serif';
      ctx.fillText(`🔗 ${limpio}`, width - X_PAD, creditosY + 40);
      ctx.textAlign = 'left';
    }
  }

  const marca = opciones.marca || Date.now();
  const nombreArchivo = opciones.nombreArchivo || `post_${marca}_${indice + 1}.png`;
  const rutaCompleta = path.join(carpetaDestino, nombreArchivo);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(rutaCompleta, buffer);

  return {
    imagenPath: rutaCompleta,
    imagenNombre: nombreArchivo,
    tamanoKB: Math.round(buffer.length / 1024),
    vistaPrevia: `data:image/png;base64,${buffer.toString('base64')}`,
    tieneMiniatura: imgCargada !== null,
  };
};

export const ejecutarNodoGeneradorImagen = async (
  inputData: WorkflowItem[],
  nodesData?: CanvasNode[]
): Promise<WorkflowItem[]> => {
  const nodo3 = nodesData?.find((n) => n.id === '3');
  const colorConfig = nodo3?.data?.colorAcento;

  console.log(`🎨 [Nodo 3] Renderizando ${inputData.length} imagen(es) PNG...`);
  const resultados: WorkflowItem[] = [];
  const nuevasEnHistorial: EntradaHistorial[] = [];
  const marca = Date.now();

  for (const [indice, item] of inputData.entries()) {
    const datos = item.json;
    const resultadoRender = await renderizarTarjeta(datos, indice, inputData.length, {
      marca,
      colorAcento: colorConfig || datos.colorAcento,
    });

    console.log(
      `🖼️ ${indice + 1}/${inputData.length} guardada en: ${resultadoRender.imagenPath}${resultadoRender.tieneMiniatura ? ' [con imagen]' : ''}`
    );

    if (datos.evitarRepetidas === true && typeof datos.claveHistorial === 'string') {
      nuevasEnHistorial.push({
        clave: datos.claveHistorial,
        titulo: String(datos.titulo ?? ''),
        fecha: new Date().toISOString(),
      });
    }

    resultados.push({
      json: {
        ...datos,
        ...resultadoRender,
        colorAcento: datos.colorAcento || '#38bdf8',
        estado: '¡Scraping, análisis y diseño completados!',
      },
    });
  }

  if (nuevasEnHistorial.length > 0) registrarEnHistorial(nuevasEnHistorial);

  return resultados;
};