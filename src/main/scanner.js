'use strict';

// Escaner de red local. Descubre dispositivos conectados a la misma red
// mediante un barrido de ping (para poblar la cache ARP del sistema) y luego
// lee la tabla ARP para obtener las direcciones MAC. Todo se hace desde este
// PC, sin tocar el trafico de otros dispositivos: solo observa quien esta
// presente. Es 100% legitimo en tu propia red.

const os = require('os');
const { exec } = require('child_process');
const { OUI } = require('./oui');

function run(cmd, timeoutMs = 8000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
      resolve(stdout || '');
    });
  });
}

// Devuelve la interfaz activa (IPv4, no interna) y su rango /24.
function getLocalNetwork() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const addr of ifaces[name] || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        const parts = addr.address.split('.');
        const base = `${parts[0]}.${parts[1]}.${parts[2]}`;
        return {
          iface: name,
          ip: addr.address,
          mac: (addr.mac || '').toLowerCase(),
          base, // ej. "192.168.1"
          netmask: addr.netmask,
        };
      }
    }
  }
  return null;
}

// Hace ping a un host. Resuelve con la latencia en ms o null si no responde.
async function pingHost(ip) {
  // -n 1: un intento, -w 400: timeout 400ms
  const out = await run(`ping -n 1 -w 400 ${ip}`, 2000);
  if (/TTL=/i.test(out)) {
    const m = out.match(/tiempo[=<]\s*(\d+)ms|time[=<]\s*(\d+)ms/i);
    const ms = m ? parseInt(m[1] || m[2], 10) : null;
    return { alive: true, ms };
  }
  return { alive: false, ms: null };
}

// Barrido de ping en paralelo por lotes para no saturar el sistema.
async function pingSweep(base, onProgress) {
  const results = {};
  const hosts = [];
  for (let i = 1; i <= 254; i++) hosts.push(`${base}.${i}`);

  const batchSize = 32;
  let done = 0;
  for (let i = 0; i < hosts.length; i += batchSize) {
    const batch = hosts.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (ip) => {
        const r = await pingHost(ip);
        if (r.alive) results[ip] = r.ms;
        done++;
      })
    );
    if (onProgress) onProgress(Math.round((done / hosts.length) * 100));
  }
  return results;
}

// Lee la tabla ARP del sistema y devuelve un mapa ip -> mac.
async function readArpTable() {
  const out = await run('arp -a', 5000);
  const map = {};
  const re = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+([0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2})/g;
  let m;
  while ((m = re.exec(out)) !== null) {
    const ip = m[1];
    const mac = m[2].replace(/-/g, ':').toLowerCase();
    map[ip] = mac;
  }
  return map;
}

// True si la MAC es "localmente administrada" (aleatoria por privacidad).
// Los moviles modernos rotan su MAC por WiFi; se detecta por el segundo bit
// menos significativo del primer octeto.
function isRandomMac(mac) {
  if (!mac) return false;
  const firstOctet = parseInt(mac.split(':')[0], 16);
  return (firstOctet & 0x02) !== 0;
}

// Identifica el fabricante por el prefijo OUI de la MAC (primeros 3 octetos).
function vendorFromMac(mac) {
  if (!mac) return 'Desconocido';
  const prefix = mac.split(':').slice(0, 3).join('').toUpperCase();
  if (OUI[prefix]) return OUI[prefix];
  if (isRandomMac(mac)) return 'MAC aleatoria (movil)';
  return 'Desconocido';
}

// Escaneo completo: barrido + ARP + fusion de datos.
async function scanNetwork(onProgress) {
  const net = getLocalNetwork();
  if (!net) {
    return { error: 'No se encontro una conexion de red activa.', devices: [] };
  }

  const latencies = await pingSweep(net.base, onProgress);
  // Pequena espera para que la cache ARP se asiente.
  await new Promise((r) => setTimeout(r, 300));
  const arp = await readArpTable();

  // Unir IPs que respondieron al ping con las que estan en ARP.
  const ips = new Set([...Object.keys(latencies), ...Object.keys(arp)]);
  // Solo las de nuestra subred.
  const devices = [];
  for (const ip of ips) {
    if (!ip.startsWith(net.base + '.')) continue;
    // Descartar broadcast de red y multicast.
    if (ip.endsWith('.255')) continue;
    const mac = ip === net.ip ? net.mac : arp[ip] || null;
    if (mac === 'ff:ff:ff:ff:ff:ff') continue;
    const isSelf = ip === net.ip;
    const isGateway = ip.endsWith('.1'); // heuristica comun para el router
    devices.push({
      ip,
      mac,
      vendor: vendorFromMac(mac),
      latency: latencies[ip] !== undefined ? latencies[ip] : null,
      online: latencies[ip] !== undefined || !!arp[ip],
      isSelf,
      isGateway,
      label: isSelf ? 'Este PC' : isGateway ? 'Router' : '',
    });
  }

  devices.sort((a, b) => {
    const na = a.ip.split('.').map(Number);
    const nb = b.ip.split('.').map(Number);
    return na[3] - nb[3];
  });

  return { error: null, network: net, devices };
}

module.exports = { scanNetwork, getLocalNetwork };
