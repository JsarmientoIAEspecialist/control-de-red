'use strict';

const $ = (id) => document.getElementById(id);

let devices = [];
let limitTargetMac = null;

// ---- Resumen de red ----
async function loadNetInfo() {
  const net = await window.api.netInfo();
  if (net) {
    $('netSummary').textContent = `Red ${net.base}.0/24  ·  este PC: ${net.ip}`;
  } else {
    $('netSummary').textContent = 'Sin conexion de red detectada';
  }
}

// ---- Escaneo ----
async function scan() {
  const btn = $('btnScan');
  btn.disabled = true;
  btn.textContent = 'Escaneando…';
  $('progressWrap').classList.remove('hidden');
  setProgress(0);

  const off = window.api.onScanProgress((pct) => setProgress(pct));
  try {
    const res = await window.api.scan();
    if (res.error) {
      alertBanner(res.error);
    } else {
      devices = res.devices || [];
      renderDevices();
    }
  } finally {
    off();
    $('progressWrap').classList.add('hidden');
    btn.disabled = false;
    btn.textContent = 'Escanear red';
  }
}

function setProgress(pct) {
  $('progressBar').style.width = pct + '%';
  $('progressText').textContent = `Escaneando… ${pct}%`;
}

// ---- Render de la tabla ----
function renderDevices() {
  const body = $('devBody');
  body.innerHTML = '';

  if (!devices.length) {
    body.innerHTML = '<tr class="empty"><td colspan="7">No se encontraron dispositivos.</td></tr>';
    updateStats();
    return;
  }

  for (const d of devices) {
    const tr = document.createElement('tr');

    const tags = [];
    if (d.isSelf) tags.push('<span class="tag self">Este PC</span>');
    if (d.isGateway) tags.push('<span class="tag router">Router</span>');
    if (d.limited) tags.push('<span class="tag limited">Limitado</span>');
    if (d.blocked) tags.push('<span class="tag blocked">Bloqueado</span>');

    const nameVal = d.name || d.label || '';
    const latency = d.latency !== null && d.latency !== undefined ? `${d.latency} ms` : '—';

    tr.innerHTML = `
      <td><span class="dot ${d.online ? 'on' : 'off'}"></span>${d.online ? 'En linea' : 'Ausente'}</td>
      <td class="dev-name">
        <input type="text" value="${escapeAttr(nameVal)}" placeholder="Sin nombre" data-mac="${d.mac || ''}" />
        ${tags.join('')}
      </td>
      <td class="mono">${d.ip}</td>
      <td class="mono">${d.mac || '—'}</td>
      <td>${d.vendor || 'Desconocido'}</td>
      <td>${latency}</td>
      <td>${renderActions(d)}</td>
    `;
    body.appendChild(tr);
  }

  // Listeners de alias
  body.querySelectorAll('.dev-name input').forEach((inp) => {
    inp.addEventListener('change', async (e) => {
      const mac = e.target.dataset.mac;
      if (mac) await window.api.setAlias(mac, e.target.value.trim());
    });
  });

  // Listeners de acciones
  body.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => onAction(btn.dataset.action, btn.dataset.mac));
  });

  updateStats();
}

function renderActions(d) {
  if (d.isSelf) return '<span class="muted">—</span>';
  const parts = [];
  parts.push(`<button class="btn sm" data-action="limit" data-mac="${d.mac || ''}">Limitar</button>`);
  if (d.blocked) {
    parts.push(`<button class="btn sm warn" data-action="unblock" data-mac="${d.mac || ''}">Reactivar</button>`);
  } else {
    parts.push(`<button class="btn sm danger" data-action="block" data-mac="${d.mac || ''}">Pausar</button>`);
  }
  parts.push(`<button class="btn sm" data-action="prioritize" data-mac="${d.mac || ''}">Priorizar</button>`);
  return `<div class="row-actions">${parts.join('')}</div>`;
}

function updateStats() {
  $('statTotal').textContent = devices.length;
  $('statOnline').textContent = devices.filter((d) => d.online).length;
  $('statLimited').textContent = devices.filter((d) => d.limited).length;
  $('statBlocked').textContent = devices.filter((d) => d.blocked).length;
}

// ---- Acciones sobre dispositivos ----
async function onAction(action, mac) {
  if (action === 'limit') {
    limitTargetMac = mac;
    const d = devices.find((x) => x.mac === mac);
    $('limitTarget').textContent = d ? `${d.name || d.vendor} · ${d.ip} · ${mac}` : mac;
    openModal('limitModal');
    return;
  }
  const res = await window.api.routerAction({ action, mac });
  handleRouterResult(res, action, mac);
}

async function applyLimit() {
  const down = parseFloat($('limitDown').value) || 0;
  const up = parseFloat($('limitUp').value) || 0;
  const res = await window.api.routerAction({
    action: 'limit',
    mac: limitTargetMac,
    downKbps: Math.round(down * 1000),
    upKbps: Math.round(up * 1000),
  });
  closeModal('limitModal');
  handleRouterResult(res, 'limit', limitTargetMac);
}

function handleRouterResult(res, action, mac) {
  if (!res.ok) {
    alertBanner(res.message || 'No se pudo aplicar la accion. Configura tu router.');
    return;
  }
  // Reflejar estado localmente.
  const d = devices.find((x) => x.mac === mac);
  if (d) {
    if (action === 'block') d.blocked = true;
    if (action === 'unblock') d.blocked = false;
    if (action === 'limit') d.limited = true;
    if (action === 'clearLimit') d.limited = false;
  }
  hideBanner();
  renderDevices();
}

// ---- Banner / mensajes ----
function alertBanner(msg) {
  const b = $('routerBanner');
  b.textContent = '⚠ ' + msg;
  b.classList.remove('hidden');
}
function hideBanner() {
  $('routerBanner').classList.add('hidden');
}

// ---- Router config ----
async function openSettings() {
  const cfg = await window.api.getConfig();
  const r = cfg.router || {};
  $('routerModel').value = r.model || 'unconfigured';
  $('routerHost').value = r.host || '';
  $('routerUser').value = r.username || '';
  $('routerPass').value = '';
  $('routerMsg').textContent = '';
  $('routerMsg').className = 'msg';
  openModal('settingsModal');
}

async function saveSettings() {
  const config = {
    model: $('routerModel').value,
    host: $('routerHost').value.trim(),
    username: $('routerUser').value.trim(),
    password: $('routerPass').value,
  };
  const res = await window.api.configureRouter(config);
  const msg = $('routerMsg');
  msg.textContent = res.message || (res.ok ? 'Conectado.' : 'No se pudo conectar.');
  msg.className = 'msg ' + (res.ok ? 'ok' : 'err');
  if (res.ok) setTimeout(() => closeModal('settingsModal'), 900);
}

// ---- Utilidades ----
function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }
function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- Wiring ----
$('btnScan').addEventListener('click', scan);
$('btnSettings').addEventListener('click', openSettings);
$('btnCancelSettings').addEventListener('click', () => closeModal('settingsModal'));
$('btnSaveSettings').addEventListener('click', saveSettings);
$('btnCancelLimit').addEventListener('click', () => closeModal('limitModal'));
$('btnApplyLimit').addEventListener('click', applyLimit);

loadNetInfo();
