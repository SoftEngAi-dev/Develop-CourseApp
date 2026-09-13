/* ═══════════════════════════════════════════════════════════════════════════
 * scripts/generate-icons.js — PWA icons with ZERO dependencies
 * ───────────────────────────────────────────────────────────────────────────
 * 🇪🇸 ES — QUÉ HACE: dibuja los iconos de la app (192, 512 y maskable 512) y los
 *     escribe como PNG reales. Sin ImageMagick, sin sharp, sin canvas: un
 *     codificador PNG propio de ~90 líneas usando `node:zlib`.
 *     POR QUÉ EXISTE: una PWA instalable exige iconos PNG de 192 y 512 px. La
 *     alternativa "fácil" sería añadir una dependencia de imágenes, y eso
 *     rompería POL-0001 (cero dependencias npm, 100% offline). Así que el icono
 *     se genera con matemáticas y compresión, igual que todo lo demás.
 *     USO: node scripts/generate-icons.js
 *
 * 🇬🇧 EN — WHAT IT DOES: draws the app icons (192, 512 and maskable 512) and
 *     writes them as real PNG files. No ImageMagick, no sharp, no canvas: our own
 *     ~90-line PNG encoder using `node:zlib`.
 *     WHY IT EXISTS: an installable PWA requires 192px and 512px PNG icons. The
 *     "easy" alternative would be adding an image dependency, which would break
 *     POL-0001 (zero npm dependencies, 100% offline). So the icon is generated
 *     with mathematics and compression, like everything else here.
 *     USAGE: node scripts/generate-icons.js
 *
 * 🇧🇷 PT — O QUE FAZ: desenha os ícones do app (192, 512 e maskable 512) e os
 *     grava como PNG reais, com um codificador PNG próprio usando `node:zlib`.
 *     POR QUE EXISTE: uma PWA instalável exige ícones PNG de 192 e 512 px, e
 *     adicionar uma dependência de imagem quebraria POL-0001 (zero dependências).
 *     USO: node scripts/generate-icons.js
 *
 * 🎓 BEGINNER COURSE / CURSO PARA PRINCIPIANTES / CURSO PARA INICIANTES
 *   • Anatomía de un PNG ES/EN/PT: un PNG es una secuencia de "chunks":
 *       – firma fija de 8 bytes (siempre la misma)
 *       – IHDR: ancho, alto, profundidad de color, tipo (RGBA = 8 bits × 4 canales)
 *       – IDAT: los píxeels comprimidos con DEFLATE (el mismo algoritmo de .zip)
 *       – IEND: fin del archivo
 *     Cada chunk lleva su longitud, su tipo, sus datos y un CRC32 (suma de
 *     verificación). Si el CRC está mal, el navegador rechaza la imagen.
 *     A PNG is a list of chunks; every chunk carries a CRC32 checksum.
 *   • Filtro por fila ES/EN/PT: antes de comprimir, cada fila de píxeles lleva UN
 *     byte extra que indica el "filtro" usado. El filtro 0 (None) significa "los
 *     bytes van tal cual". Es el más simple y suficiente para un icono.
 *     Each scanline is prefixed by a filter byte; 0 = raw bytes.
 *   • CRC32 ES/EN/PT: no es criptografía, es detección de errores: un número de
 *     32 bits que resume el contenido. Se calcula con una tabla de 256 entradas.
 *     CRC32 is error detection, not security.
 *   • Supermuestreo (antialias) ES/EN/PT: un píxel es un cuadrado, no un punto.
 *     Para que el borde de un círculo no se vea "dentado", calculamos cuánta
 *     fracción del píxel está DENTRO de la figura (0.0 a 1.0) y mezclamos colores.
 *     Sin eso, el icono se ve como una escalera.
 *     Antialiasing = how much of each pixel lies inside the shape.
 *   • Icono "maskable" ES/EN/PT: Android recorta los iconos en círculos, squircles
 *     o cuadrados según el fabricante. Por eso el contenido debe vivir en el 80%
 *     central y el fondo debe rellenar TODO el lienzo. Si no, el icono queda
 *     decapitado en algunos teléfonos.
 *     Maskable icons keep content in the central 80% and fill the whole canvas.
 * ═══════════════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'apps', 'console', 'icons');

/* ── Colores de la marca / Brand colours ──────────────────────────────────── */
const C = {
  bg: [8, 11, 16, 255],          // ES: casi negro azulado | EN: near-black blue
  bgSoft: [18, 25, 36, 255],
  teal: [79, 209, 197, 255],     // accent
  blue: [122, 162, 247, 255],    // accent 2
  green: [86, 211, 100, 255],
  magenta: [199, 146, 234, 255],
  white: [230, 237, 246, 255],
};

/* ── CRC32 (tabla de 256 entradas) / CRC32 (256-entry table) ──────────────── */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

/** ES/EN/PT: arma un chunk PNG: longitud + tipo + datos + CRC. Builds one PNG chunk. */
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/**
 * ES: codifica píxeles RGBA (Uint8ClampedArray de size*size*4) a un PNG válido.
 * EN: encodes RGBA pixels (Uint8ClampedArray of size*size*4) into a valid PNG.
 * PT: codifica pixels RGBA num PNG válido.
 */
function encodePng(size, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);   // width
  ihdr.writeUInt32BE(size, 4);   // height
  ihdr.writeUInt8(8, 8);         // ES: 8 bits por canal | EN: bit depth
  ihdr.writeUInt8(6, 9);         // ES: 6 = color verdadero con alfa (RGBA) | EN: truecolour + alpha
  ihdr.writeUInt8(0, 10);        // compression: deflate
  ihdr.writeUInt8(0, 11);        // filter method
  ihdr.writeUInt8(0, 12);        // interlace: none

  // ES: cada fila lleva un byte de filtro (0 = None) antes de sus píxeles.
  // EN: every scanline is prefixed by a filter byte (0 = None).
  // PT: cada linha é prefixada por um byte de filtro (0 = None).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, rowStart + 1);
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ── Primitivas de dibujo / Drawing primitives ────────────────────────────── */

/** ES/EN/PT: pinta un píxel con alfa (mezcla con lo que ya había). Alpha blend. */
function put(pixels, size, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= size || y >= size || alpha <= 0) return;
  const i = (y * size + x) * 4;
  const a = Math.min(1, alpha) * (color[3] / 255);
  for (let channel = 0; channel < 3; channel += 1) {
    pixels[i + channel] = Math.round(pixels[i + channel] * (1 - a) + color[channel] * a);
  }
  pixels[i + 3] = Math.min(255, Math.round(pixels[i + 3] + (255 - pixels[i + 3]) * a));
}

/**
 * ES: cobertura de un círculo sobre el píxel (x,y) usando supermuestreo 3×3.
 * EN: circle coverage over pixel (x,y) using 3×3 supersampling.
 * PT: cobertura de um círculo no pixel (x,y) com superamostragem 3×3.
 */
function circleCoverage(px, py, cx, cy, radius) {
  const dx = px + 0.5 - cx;
  const dy = py + 0.5 - cy;
  const distance = Math.hypot(dx, dy);
  // ES: borde suave de 1 píxel de ancho | EN: 1px soft edge | PT: borda suave de 1px
  return Math.max(0, Math.min(1, radius - distance + 0.5));
}

/** ES/EN/PT: cobertura de un segmento grueso (línea con radio). Thick segment coverage. */
function segmentCoverage(px, py, x1, y1, x2, y2, radius) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy || 1;
  let t = ((px + 0.5 - x1) * dx + (py + 0.5 - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return circleCoverage(px, py, x1 + t * dx, y1 + t * dy, radius);
}

/** ES/EN/PT: cobertura de un cuadrado redondeado. Rounded-rect coverage. */
function roundedRectCoverage(px, py, x, y, width, height, radius) {
  const cx = Math.max(x + radius, Math.min(x + width - radius, px + 0.5));
  const cy = Math.max(y + radius, Math.min(y + height - radius, py + 0.5));
  const dx = Math.abs(px + 0.5 - cx);
  const dy = Math.abs(py + 0.5 - cy);
  if (dx <= radius && dy <= radius) {
    const inside = px + 0.5 >= x && px + 0.5 <= x + width && py + 0.5 >= y && py + 0.5 <= y + height;
    return inside ? 1 : 0;
  }
  return circleCoverage(px, py, cx, cy, radius);
}

/* ── El dibujo: doble hélice de conocimiento / The drawing: knowledge helix ── */

/**
 * ES: dibuja el icono. Motivo: una doble hélice (ADN → GENESIS) formada por dos
 *     senos desfasados, con "peldaños" que unen ambas cadenas y nodos de grafo en
 *     los extremos. Es la metáfora visual del proyecto: conocimiento que se
 *     hereda, se enlaza y se reproduce en la siguiente sesión.
 * EN: draws the icon. Motif: a double helix (DNA → GENESIS) made of two
 *     phase-shifted sine waves, with "rungs" joining both strands and graph nodes
 *     at the ends. It is the visual metaphor of the project: knowledge that is
 *     inherited, linked and reproduced in the next session.
 * PT: desenha o ícone. Motivo: dupla hélice (DNA → GENESIS) com "degraus" e nós
 *     de grafo nas pontas.
 *
 * @param {number} size         lado en píxeles (192 o 512)
 * @param {object} options
 * @param {boolean} options.maskable  rellena todo el lienzo y centra el motivo al 80%
 */
function drawIcon(size, options = {}) {
  const { maskable = false } = options;
  const pixels = new Uint8ClampedArray(size * size * 4);

  // ES: zona segura. En maskable el motivo vive en el 80% central.
  // EN: safe zone. In maskable mode the motif lives in the central 80%.
  // PT: zona segura. No modo maskable o motivo vive nos 80% centrais.
  const pad = maskable ? size * 0.1 : size * 0.06;
  const boxSize = size - pad * 2;
  const cornerRadius = maskable ? 0 : size * 0.19;

  // 1) fondo (rectángulo redondeado, o lienzo completo si es maskable)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const coverage = maskable ? 1 : roundedRectCoverage(x, y, pad, pad, boxSize, boxSize, cornerRadius);
      if (coverage <= 0) continue;
      // ES: degradado vertical sutil para que no parezca plano.
      // EN: subtle vertical gradient so it does not look flat.
      const t = (y - pad) / boxSize;
      const color = [
        Math.round(C.bg[0] + (C.bgSoft[0] - C.bg[0]) * t),
        Math.round(C.bg[1] + (C.bgSoft[1] - C.bg[1]) * t),
        Math.round(C.bg[2] + (C.bgSoft[2] - C.bg[2]) * t),
        255,
      ];
      put(pixels, size, x, y, color, coverage);
    }
  }

  // 2) halo radial teal detrás de la hélice | EN: teal radial glow behind the helix
  const centerX = size / 2;
  const centerY = size / 2;
  const glowRadius = boxSize * 0.42;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY);
      if (distance > glowRadius) continue;
      const falloff = 1 - distance / glowRadius;
      put(pixels, size, x, y, C.teal, 0.16 * falloff * falloff);
    }
  }

  // 3) doble hélice | EN: double helix
  const helixHeight = boxSize * 0.74;
  const helixTop = centerY - helixHeight / 2;
  const amplitude = boxSize * 0.17;
  const turns = 1.35;                       // ES: vueltas y media | EN: one and a half turns
  const strandRadius = Math.max(1.4, size * 0.019);
  const steps = 64;

  const strandPoint = (strand, step) => {
    const t = step / steps;
    const y = helixTop + t * helixHeight;
    const phase = strand === 0 ? 0 : Math.PI;
    const x = centerX + Math.sin(t * Math.PI * 2 * turns + phase) * amplitude;
    return { x, y, depth: Math.cos(t * Math.PI * 2 * turns + phase) };
  };

  // ES: peldaños primero (quedan detrás de las cadenas).
  // EN: rungs first (they sit behind the strands).
  const rungCount = 11;
  for (let rung = 0; rung < rungCount; rung += 1) {
    const step = (rung + 0.5) * (steps / rungCount);
    const a = strandPoint(0, step);
    const b = strandPoint(1, step);
    const rungColor = rung % 3 === 0 ? C.magenta : rung % 3 === 1 ? C.blue : C.green;
    for (let y = Math.floor(Math.min(a.y, b.y)) - 2; y <= Math.ceil(Math.max(a.y, b.y)) + 2; y += 1) {
      for (let x = Math.floor(Math.min(a.x, b.x)) - 2; x <= Math.ceil(Math.max(a.x, b.x)) + 2; x += 1) {
        const coverage = segmentCoverage(x, y, a.x, a.y, b.x, b.y, strandRadius * 0.62);
        if (coverage > 0) put(pixels, size, x, y, rungColor, coverage * 0.9);
      }
    }
  }

  // ES: las dos cadenas. `depth` (>0 = delante) define el brillo: da sensación 3D.
  // EN: the two strands. `depth` (>0 = in front) drives brightness: a 3D feel.
  // PT: as duas cadeias; `depth` controla o brilho (sensação 3D).
  for (const strand of [0, 1]) {
    const baseColor = strand === 0 ? C.teal : C.blue;
    for (let step = 0; step < steps; step += 1) {
      const from = strandPoint(strand, step);
      const to = strandPoint(strand, step + 1);
      const brightness = 0.72 + 0.28 * ((from.depth + 1) / 2);
      const color = [
        Math.min(255, Math.round(baseColor[0] * brightness)),
        Math.min(255, Math.round(baseColor[1] * brightness)),
        Math.min(255, Math.round(baseColor[2] * brightness)),
        255,
      ];
      const minX = Math.floor(Math.min(from.x, to.x)) - 3;
      const maxX = Math.ceil(Math.max(from.x, to.x)) + 3;
      const minY = Math.floor(Math.min(from.y, to.y)) - 3;
      const maxY = Math.ceil(Math.max(from.y, to.y)) + 3;
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const coverage = segmentCoverage(x, y, from.x, from.y, to.x, to.y, strandRadius);
          if (coverage > 0) put(pixels, size, x, y, color, coverage);
        }
      }
    }
  }

  // 4) nodos de grafo en los extremos | EN: graph nodes at the extremes
  const nodeRadius = size * 0.036;
  for (const [strand, step] of [[0, 0], [1, 0], [0, steps], [1, steps]]) {
    const point = strandPoint(strand, Math.min(step, steps));
    const color = strand === 0 ? C.teal : C.blue;
    for (let y = Math.floor(point.y - nodeRadius - 2); y <= Math.ceil(point.y + nodeRadius + 2); y += 1) {
      for (let x = Math.floor(point.x - nodeRadius - 2); x <= Math.ceil(point.x + nodeRadius + 2); x += 1) {
        const coverage = circleCoverage(x, y, point.x, point.y, nodeRadius);
        if (coverage > 0) put(pixels, size, x, y, C.white, coverage);
        const ring = circleCoverage(x, y, point.x, point.y, nodeRadius * 1.5) - coverage;
        if (ring > 0) put(pixels, size, x, y, color, ring * 0.55);
      }
    }
  }

  return encodePng(size, pixels);
}

/* ── Escritura / Write ────────────────────────────────────────────────────── */

fs.mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

for (const target of targets) {
  const png = drawIcon(target.size, { maskable: target.maskable });
  const destination = path.join(OUT_DIR, target.file);
  fs.writeFileSync(destination, png);
  process.stdout.write(`  ✓ ${path.relative(ROOT, destination)}  ${png.length} bytes\n`);
}

process.stdout.write(`\n  ${targets.length} icon(s) generated with zero dependencies.\n`);
