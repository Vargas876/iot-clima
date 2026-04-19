# 🌍 Sistema IoT de Clima en Tiempo Real (Redis Pub/Sub)

Este proyecto es una simulación avanzada de una red de biosensores IoT instalados en 8 ciudades principales de Colombia, transmitiendo datos climatológicos en tiempo real utilizando una arquitectura de eventos impulsada por **Redis Pub/Sub**.

## 🚀 Arquitectura del Proyecto

El proyecto está diseñado bajo un modelo de microservicios:

1. **`docker-compose.yml` (Base de Datos)**: Contenedor principal de Redis, encargado del enrutamiento de mensajes y persistencia del historial térmico temporal (`Sorted Sets`).
2. **`publisher/` (Backend - Emisor)**: Script en Node.js actuando como la red de sensores. Utiliza un **modelo híbrido**: consulta datos reales a la API de *Open-Meteo* y aplica un algoritmo de *Random walk* entre peticiones para simular las variaciones en tiempo real de los sensores IoT.
3. **`subscriber/` (Backend - Receptor)**: Servidor Express + WebSockets (Socket.io). Está suscrito permanentemente al canal Redis. Inyecta el histórico almacenado a clientes nuevos y emite un flujo (stream) constante de las lecturas en vivo.
4. **`frontend/` (Cliente UI)**: Dashboard analítico estilo *SaaS* renderizado de forma fluida a 60FPS. Contiene integración con Leaflet (Mapas de calor) y Chart.js para telemetría cronometrada.

---

## ⚙️ Requisitos Previos

Necesitas tener instaladas las siguientes herramientas en tu sistema (Windows/Mac/Linux):

- **[Node.js](https://nodejs.org/)** (v16.0 o superior)
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (Debe estar ejecutándose en segundo plano para levantar Redis)

---

## ▶️ ¿Cómo iniciar el Proyecto?

Toda la inicialización se puede hacer casi de manera automática en Windows. Alternativamente, puedes arrancar manualmente cada sección. 

### Opción 1: Arranque Rápido (Recomendado en Windows)

1. Abre / Inicia tu **Docker Desktop** (Asegúrate de que su icono esté abierto en tu barra de tareas). 
2. Haz doble clic en el archivo `run_all.bat` ubicado en la carpeta del proyecto.
   > Este script instalará todo e iniciará tu Publisher, tu servidor de Subscriber y tu Frontend web de manera simultánea en consolas pequeñas diferentes.
3. Una de esas consolas pertenecerá al servidor Web (Vite) y te escupirá una Local URL allí dibujada (usualmente `http://localhost:5173`). ¡Solo tienes que darle `CTRL` + `Click` encima y verás el panel de control fluir!

*(Es primordial que Docker te encienda tu base de datos Redis. Si ves errores rojos en los Node al correr el `.bat`, prueba primero levantar Docker tú mismo abriendo tu terminal ahí mismo y lanzando el comando clásico: `docker-compose up -d`).*

### Opción 2: Ejecución Manual Paso a Paso (Modo Exposición)

Si prefieres levantar las piezas una a una para explicarlas:

**Paso 1: Encender la Base de Datos Redis**
Abre una consola o consola PowerShell dentro del proyecto y lanza:
```bash
docker-compose up -d
```

**Paso 2: Iniciar Servidor de WebSockets (Subscriber Receptor)**
Abre otra consola separada:
```bash
cd subscriber
npm install  # Solo si es la primera vez
node index.js
```

**Paso 3: Iniciar Flujo de Eventos IoT (Publisher Simulado)**
Abre otra consola separada:
```bash
cd publisher
npm install  # Solo si es la primera vez
node index.js
```

**Paso 4: Iniciar el Panel Interactivo (Frontend)**
En una última consola separada lanza tu Vite:
```bash
cd frontend
npm install  # Solo si es la primera vez
npm run dev
```

---

## 🛠 Detalles Técnicos Extra
- **Persistencia Temporal:** Redis guarda hasta 15 minutos en el historial rotativo manejando `ZADD clima_historial <timestamp> <JSON_serializado>`.
- **Mitigación de Errores Vía Throttling RAF:** Si ocurre un pico inesperado o spamming en la red IoT, JavaScript maneja los eventos de Socket usando la API nativa `requestAnimationFrame` impidiendo el bloqueo del hilo principal de pintado UI.
- **Resiliencia de Datos:** El servidor capta posibles fallas en el `JSON.parse` envolviéndolos de manera estricta para evitar bloqueos del Backend si un sensor inyectara datos crudos o corruptos al Redis PubSum.
