// yarn center-icons [icon.png ...]   (default: all of src/assets/icons)
//
// The game's icons have a faint shadow under the item, and were centred with it,
// so the item itself sits too high next to text. This shifts the pixel rows so
// the solid part is centred. Nothing is resampled or cut off, and a second run
// changes nothing. Only handles 8-bit RGBA, non-interlaced PNGs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const ICONS_DIR = fileURLToPath(new URL("../src/assets/icons", import.meta.url));
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BYTES_PER_PIXEL = 4;
// More opaque than this is the item; less is the shadow.
const SOLID_ALPHA = 40;

interface RgbaImage {
  width: number;
  height: number;
  pixels: Buffer;
}

interface Margins {
  top: number;
  bottom: number;
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

function decodePng(file: string): RgbaImage {
  const data = fs.readFileSync(file);
  if (!data.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${file}: not a PNG`);
  let width = 0;
  let height = 0;
  const compressed: Buffer[] = [];
  for (let offset = 8; offset < data.length; ) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, colorType, , , interlace] = [body[8], body[9], body[10], body[11], body[12]];
      if (depth !== 8 || colorType !== 6 || interlace !== 0) {
        throw new Error(`${file}: only 8-bit RGBA, non-interlaced PNGs are supported`);
      }
    } else if (type === "IDAT") {
      compressed.push(body);
    }
    offset += 12 + length;
  }

  const raw = zlib.inflateSync(Buffer.concat(compressed));
  const stride = width * BYTES_PER_PIXEL;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= BYTES_PER_PIXEL ? (pixels[y * stride + x - BYTES_PER_PIXEL] ?? 0) : 0;
      const up = y > 0 ? (pixels[(y - 1) * stride + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= BYTES_PER_PIXEL ? (pixels[(y - 1) * stride + x - BYTES_PER_PIXEL] ?? 0) : 0;
      const value = line[x] ?? 0;
      switch (filter) {
        case 0:
          pixels[y * stride + x] = value;
          break;
        case 1:
          pixels[y * stride + x] = (value + left) & 0xff;
          break;
        case 2:
          pixels[y * stride + x] = (value + up) & 0xff;
          break;
        case 3:
          pixels[y * stride + x] = (value + ((left + up) >> 1)) & 0xff;
          break;
        case 4:
          pixels[y * stride + x] = (value + paeth(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`${file}: unknown PNG filter ${filter}`);
      }
    }
  }
  return { width, height, pixels };
}

function pngChunk(type: string, body: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(body.length, 0);
  header.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([header.subarray(4), body])), 0);
  return Buffer.concat([header, body, crc]);
}

// Picks the PNG filter per row with the smallest sum of absolute values (the usual heuristic).
function filterRows(image: RgbaImage): Buffer {
  const stride = image.width * BYTES_PER_PIXEL;
  const out: Buffer[] = [];
  for (let y = 0; y < image.height; y++) {
    let best: Buffer | null = null;
    let bestScore = Infinity;
    for (let filter = 0; filter <= 4; filter++) {
      const line = Buffer.alloc(stride + 1);
      line[0] = filter;
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const value = image.pixels[y * stride + x] ?? 0;
        const left = x >= BYTES_PER_PIXEL ? (image.pixels[y * stride + x - BYTES_PER_PIXEL] ?? 0) : 0;
        const up = y > 0 ? (image.pixels[(y - 1) * stride + x] ?? 0) : 0;
        const upLeft = y > 0 && x >= BYTES_PER_PIXEL ? (image.pixels[(y - 1) * stride + x - BYTES_PER_PIXEL] ?? 0) : 0;
        const predictions = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)];
        const filtered = (value - (predictions[filter] ?? 0)) & 0xff;
        line[x + 1] = filtered;
        score += filtered < 128 ? filtered : 256 - filtered;
      }
      if (score < bestScore) {
        best = line;
        bestScore = score;
      }
    }
    if (best) out.push(best);
  }
  return Buffer.concat(out);
}

function encodePng(image: RgbaImage): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(filterRows(image), { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function margins(image: RgbaImage, minAlpha: number): Margins | null {
  const stride = image.width * BYTES_PER_PIXEL;
  let first = -1;
  let last = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 3; x < stride; x += BYTES_PER_PIXEL) {
      if ((image.pixels[y * stride + x] ?? 0) > minAlpha) {
        if (first === -1) first = y;
        last = y;
        break;
      }
    }
  }
  return first === -1 ? null : { top: first, bottom: image.height - 1 - last };
}

// Positive shift moves down.
function shiftRows(image: RgbaImage, shift: number): RgbaImage {
  const stride = image.width * BYTES_PER_PIXEL;
  const pixels = Buffer.alloc(image.pixels.length);
  for (let y = 0; y < image.height; y++) {
    const from = y - shift;
    if (from >= 0 && from < image.height) image.pixels.copy(pixels, y * stride, from * stride, (from + 1) * stride);
  }
  return { ...image, pixels };
}

function centringShift(image: RgbaImage): number {
  const solid = margins(image, SOLID_ALPHA);
  const visible = margins(image, 0);
  if (!solid || !visible) return 0;
  // Truncated so that a second run is a no-op.
  const wanted = Math.trunc((solid.bottom - solid.top) / 2);
  return wanted > 0 ? Math.min(wanted, visible.bottom) : Math.max(wanted, -visible.top);
}

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : fs.readdirSync(ICONS_DIR).filter((name) => name.endsWith(".png")).sort().map((name) => path.join(ICONS_DIR, name));

let changed = 0;
for (const file of files) {
  const image = decodePng(file);
  const shift = centringShift(image);
  if (shift === 0) continue;
  fs.writeFileSync(file, encodePng(shiftRows(image, shift)));
  changed++;
  console.log(`${path.basename(file)}: moved ${Math.abs(shift)} px ${shift > 0 ? "down" : "up"}`);
}
console.log(`${changed} of ${files.length} icon(s) re-centred.`);
