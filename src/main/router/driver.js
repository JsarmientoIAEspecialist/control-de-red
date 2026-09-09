'use strict';

// Capa de abstraccion del router ("driver"). La app NO toca el trafico de otros
// dispositivos directamente: le da ordenes al router, que es el equipo que
// legitimamente controla el ancho de banda de tu red. Cada marca/modelo de
// router expone su panel de forma distinta, asi que cada uno se implementa como
// un driver que cumple esta misma interfaz.
//
// Interfaz que todo driver debe implementar:
//   async connect(config)                      -> { ok, message }
//   async listDevices()                        -> [{ mac, ip, name, limited, blocked }]
//   async setSpeedLimit(mac, downKbps, upKbps) -> { ok, message }
//   async clearSpeedLimit(mac)                 -> { ok, message }
//   async blockDevice(mac)                     -> { ok, message }
//   async unblockDevice(mac)                   -> { ok, message }
//   async prioritizeDevice(mac)                -> { ok, message }
//
// config = { host, username, password, model }

// Driver por defecto: aun no hay un modelo de router configurado. Devuelve
// mensajes claros en vez de fallar en silencio. Se reemplaza por el driver
// real del modelo del usuario una vez conocido.
class UnconfiguredDriver {
  constructor() {
    this.name = 'Sin configurar';
  }

  async connect() {
    return {
      ok: false,
      message:
        'Aun no hay un driver para tu modelo de router. Indica marca y modelo ' +
        'para conectar el control de ancho de banda al panel de tu router.',
    };
  }

  async listDevices() {
    return [];
  }

  _needsRouter() {
    return {
      ok: false,
      message:
        'Esta accion requiere el driver de tu router. Configura tu modelo ' +
        'primero (Ajustes > Router).',
    };
  }

  async setSpeedLimit() {
    return this._needsRouter();
  }
  async clearSpeedLimit() {
    return this._needsRouter();
  }
  async blockDevice() {
    return this._needsRouter();
  }
  async unblockDevice() {
    return this._needsRouter();
  }
  async prioritizeDevice() {
    return this._needsRouter();
  }
}

// Registro de drivers disponibles. Se iran agregando por modelo.
// Ejemplos previstos:
//   'tplink-generic'  -> automatiza el panel web de TP-Link (QoS + control de acceso)
//   'huawei-hg8245'   -> panel Huawei ONT
//   'mikrotik'        -> API RouterOS (queues)
//   'openwrt'         -> SSH + tc/SQM
const REGISTRY = {
  unconfigured: () => new UnconfiguredDriver(),
};

function createDriver(model) {
  const factory = REGISTRY[model] || REGISTRY.unconfigured;
  return factory();
}

module.exports = { createDriver, REGISTRY, UnconfiguredDriver };
