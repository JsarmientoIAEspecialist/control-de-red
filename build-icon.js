'use strict';

// Genera assets/icon.ico (256x256) sin dependencias externas.
// Dibuja un fondo degradado azul con un simbolo de "senal/red" simple.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;

function makePixels() {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  const cx = SIZE / 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      // Fondo degradado diagonal (azul -> violeta).
      const t = (x + y) / (2 * SIZE);
      let r = Math.round(0x4f + (0x7b - 0x4f) * t);
      let g = Math.round(0x8c + (0x5c - 0x8c) * t);
      let b = Math.round(0xff + (0xff - 0xff) * t);

      // Ondas de "senal": tres arcos concentricos desde la base centro.
      const dx = x - cx;
      const dy = y - (SIZE - 40);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const up = y < SIZE - 40;
      for (const radius of [70, 120, 170]) {
        if (up && Math.abs(dist - radius) < 9 && Math.abs(dx) < dy * 2.2 + 60) {
          r = 255; g = 255; b = 255;
        }
      }
      // Punto base.
      if (dist < 16 && up) { r = 255; g = 255; b = 255; }

      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }
  }
  return buf;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Filtro 0 por scanline.
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = 0; // width 256
  entry[1] = 0; // height 256
  entry[2] = 0; entry[3] = 0;
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12); // offset
  return Buffer.concat([header, entry, png]);
}

const pixels = makePixels();
const png = makePng(pixels);
const ico = makeIco(png);

const dir = path.join(__dirname, 'assets');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon.ico'), ico);
fs.writeFileSync(path.join(dir, 'icon.png'), png);
console.log('Icono generado:', ico.length, 'bytes');
