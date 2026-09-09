# Control de Red

App de escritorio (Electron) para **tu propia red local**: descubre los
dispositivos conectados y gestiona su ancho de banda a traves de tu router.

> Solo para tu red. El control (limitar/pausar/priorizar) se aplica dando ordenes
> a tu **router**, que es el equipo que legitimamente administra el trafico. La app
> nunca intercepta ni espia el trafico de otros dispositivos.

## Instalar

Ejecuta `dist/Control de Red Setup 1.0.0.exe`. Puedes elegir la carpeta de
instalacion; crea acceso directo en el escritorio y menu inicio.

## Que funciona ya

- **Escaner de red**: pulsa "Escanear red". Descubre IP, MAC, fabricante,
  latencia y estado (en linea / ausente) de cada dispositivo. Marca tu PC y el
  router. Las MAC aleatorias de moviles se identifican como tal.
- **Nombres**: puedes ponerle un alias a cada dispositivo (se guarda).

## Que falta conectar (control del router)

Limitar velocidad, pausar y priorizar se aplican vía el panel de tu router. Cada
modelo es distinto, así que hay que implementar el "driver" de tu router.
Estado actual: interfaz lista, esperando el modelo.

Para completarlo necesito:
1. **Marca y modelo** de tu router (etiqueta trasera).
2. **IP del panel** (`192.168.1.1` normalmente) y **usuario/clave de admin**.

La arquitectura ya esta preparada: cada driver vive en `src/main/router/` e
implementa la misma interfaz (`setSpeedLimit`, `blockDevice`, `prioritizeDevice`,
etc.). Ver `src/main/router/driver.js`.

## Desarrollo

```bash
npm install       # dependencias
npm start         # ejecutar en modo desarrollo
npm run dist      # generar el instalador (dist/)
node build-icon.js  # regenerar el icono
```

## Estructura

```
src/
  main/
    main.js          proceso principal de Electron + IPC
    preload.js       puente seguro UI <-> sistema
    scanner.js       escaneo de red (ping sweep + ARP + OUI)
    oui.js           fabricantes por prefijo MAC
    router/
      driver.js      interfaz de drivers de router (+ driver por defecto)
  renderer/
    index.html       interfaz
    styles.css       estilos
    renderer.js      logica de la UI
```

## Nota legal

Usa esta herramienta unicamente en redes de tu propiedad o con autorizacion
explicita. Gestionar el ancho de banda del propio router es legitimo; interferir
la conexion de terceros sin permiso no lo es.
```
