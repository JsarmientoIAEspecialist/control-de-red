'use strict';

// Auto-deteccion del router. Sin que el usuario sepa la marca, deduce el
// fabricante y (cuando es posible) el modelo del router combinando dos senales
// obtenidas desde el propio PC:
//   1) La MAC de la puerta de enlace -> fabricante por prefijo OUI.
//   2) La pagina del panel de admin  -> titulo / marca / huellas conocidas.
// Con eso sugiere que "driver" usar y la URL del panel. No necesita internet:
// todo se resuelve contra el router en la LAN.

const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const { OUI } = require('../oui');

function run(cmd, timeoutMs = 5000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => resolve(stdout || ''));
  });
}

// Lee la puerta de enlace predeterminada real (no asume .1).
async function getGateway() {
  // ipconfig muestra "Puerta de enlace predeterminada" / "Default Gateway".
  const out = await run('ipconfig');
  const lines = out.split(/\r?\n/);
  for (const line of lines) {
    if (/Puerta de enlace|Default Gateway/i.test(line)) {
      const m = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (m) return m[1];
    }
  }
  return null;
}

// MAC de una IP desde la tabla ARP.
async function macOf(ip) {
  const out = await run('arp -a');
  const re = new RegExp(
    ip.replace(/\./g, '\\.') + '\\s+([0-9a-fA-F]{2}(?:[-:][0-9a-fA-F]{2}){5})'
  );
  const m = out.match(re);
  return m ? m[1].replace(/-/g, ':').toLowerCase() : null;
}

function vendorFromMac(mac) {
  if (!mac) return null;
  const prefix = mac.split(':').slice(0, 3).join('').toUpperCase();
  return OUI[prefix] || null;
}

// Decodifica entidades HTML numericas (&#70; -> F) y nombradas basicas.
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// Descarga la pagina del panel (http y https) y devuelve { title, server, body }.
function fetchPanel(ip) {
  const attempts = [
    { mod: https, port: 443, proto: 'https' },
    { mod: http, port: 80, proto: 'http' },
  ];

  return new Promise((resolve) => {
    let pending = attempts.length;
    const found = { title: null, server: null, body: '', url: null };

    const finish = () => {
      if (--pending <= 0) resolve(found);
    };

    for (const a of attempts) {
      const opts = {
        host: ip,
        port: a.port,
        method: 'GET',
        path: '/',
        rejectUnauthorized: false,
        timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
      };
      // Los ONT de operador (ZTE/Huawei) suelen usar TLS antiguo y cifrados
      // debiles que Node rechaza por defecto. Permitirlos solo para leer el
      // panel en la LAN (equipo propio).
      if (a.proto === 'https') {
        opts.minVersion = 'TLSv1';
        opts.ciphers = 'DEFAULT@SECLEVEL=0';
      }
      const req = a.mod.request(
        opts,
        (res) => {
          if (!found.server && res.headers.server) found.server = res.headers.server;
          let data = '';
          let recorded = false;
          const record = () => {
            if (recorded) return;
            recorded = true;
            if (!found.body && data) {
              found.body = data.slice(0, 8000);
              found.url = `${a.proto}://${ip}/`;
              const m = data.match(/<title>([^<]*)<\/title>/i);
              if (m) found.title = decodeEntities(m[1]);
            }
            finish();
          };
          res.on('data', (c) => {
            data += c;
            // En cuanto tengamos el <head> completo, ya basta: registrar y cortar.
            if (data.length > 20000 || /<\/head>/i.test(data)) {
              record();
              res.destroy();
            }
          });
          res.on('end', record);
          res.on('error', record);
        }
      );
      req.on('error', finish);
      req.on('timeout', () => { req.destroy(); finish(); });
      req.end();
    }
  });
}

// Huellas conocidas: marca + patrones de modelo -> driver sugerido.
const FINGERPRINTS = [
  { brand: 'ZTE', re: /zte|f6\d{2}|f6\d{3}|h1\d{2}/i, driver: 'zte-f6xx', modelRe: /(F\d{3,4}|H\d{3})/i },
  { brand: 'Huawei', re: /huawei|hg8\d{3}|echolife|hs8/i, driver: 'huawei-hg8245', modelRe: /(HG8\d{3}|EG8\d{3})/i },
  { brand: 'TP-Link', re: /tp-?link|archer|tl-/i, driver: 'tplink-generic', modelRe: /(Archer[\s_-]?\w+|TL-\w+)/i },
  { brand: 'Nokia', re: /nokia|alcatel|g-\d{3}/i, driver: 'unconfigured', modelRe: /(G-?\d{3}\w*)/i },
  { brand: 'MikroTik', re: /mikrotik|routeros/i, driver: 'mikrotik', modelRe: /(RB\w+|hAP\s?\w*)/i },
  { brand: 'Technicolor', re: /technicolor/i, driver: 'unconfigured', modelRe: /([A-Z]{2}\d{3,4})/ },
  { brand: 'Arris', re: /arris/i, driver: 'unconfigured', modelRe: /([A-Z]{2,4}\d{3,4})/ },
];

// Deteccion completa.
async function detectRouter() {
  const gateway = (await getGateway()) || '192.168.1.1';
  const mac = await macOf(gateway);
  const macVendor = vendorFromMac(mac);
  const panel = await fetchPanel(gateway);

  const haystack = [macVendor, panel.title, panel.server, panel.body || '']
    .filter(Boolean)
    .join(' ');

  let brand = macVendor || null;
  let model = null;
  let driver = 'unconfigured';
  let confidence = 'baja';

  for (const fp of FINGERPRINTS) {
    if (fp.re.test(haystack)) {
      brand = fp.brand;
      driver = fp.driver;
      // Intentar sacar el modelo del titulo primero, luego del cuerpo.
      const src = `${panel.title || ''} ${panel.body ? panel.body.slice(0, 4000) : ''}`;
      const mm = src.match(fp.modelRe);
      if (mm) model = mm[1].toUpperCase().replace(/\s+/g, '');
      confidence = model ? 'alta' : 'media';
      break;
    }
  }

  // Si el OUI daba marca pero ninguna huella coincidio, confianza media.
  if (!model && macVendor && confidence === 'baja') confidence = 'media';

  return {
    gateway,
    mac,
    macVendor,
    panelUrl: panel.url || `https://${gateway}/`,
    panelTitle: panel.title,
    server: panel.server,
    brand,
    model,
    suggestedDriver: driver,
    confidence,
    label: brand ? `${brand}${model ? ' ' + model : ''}` : 'Desconocido',
  };
}

module.exports = { detectRouter, getGateway };
