# 🌍 Sistema IoT de Clima en Tiempo Real (Redis Pub/Sub)

Este proyecto es una simulación avanzada de una red de biosensores IoT instalados en 8 ciudades principales de Colombia, transmitiendo datos climatológicos en tiempo real utilizando una arquitectura de eventos impulsada por **Redis Pub/Sub**.

## 🚀 Arquitectura del Proyecto (Microservicios)

El proyecto está diseñado de forma modularizada, lo que permite su despliegue tanto en local como en infraestructuras Cloud Severless:

1. **Base de Datos (Transmisor y Caché)**: Servidor Redis encargado del enrutamiento de mensajes Pub/Sub y persistencia del historial térmico temporal (`Sorted Sets`).
2. **`publisher/` (Backend - Emisor Fantasma)**: Node.js worker actuando como la red de sensores. Utiliza un **modelo híbrido**: consulta datos reales a la API de *Open-Meteo* y aplica un algoritmo de *Random walk* entre peticiones para simular las variaciones fluidas.
3. **`subscriber/` (Backend - Receptor Node)**: Servidor Express + WebSockets. Inyecta el histórico almacenado a clientes nuevos mediante `ZRANGE` y emite un flujo constante de las lecturas en vivo mediante suscripciones Redis.
4. **`frontend/` (Dashboard Vercel/Vite)**: UI analítica nivel *SaaS* renderizada de forma asíncrona a 60FPS, con mitigación de atascos usando `requestAnimationFrame` (*throttling*). Incluye *Heatmaps* térmicos (Leaflet) y telemetría por Chart.js con animaciones CSS (Mesh Gradients & Glassmorphism).

---

## ☁️ Acceso en la Nube (Producción)

El proyecto se encuentra totalmente parametrizado a través de Variables de Entorno (`.env`) para ejecutarse en la nube usando capas Serverless gratuitas.

- **Redis**: Alojar en [Upstash](https://upstash.com/) `REDIS_URL`
- **Backends (Pub/Sub)**: Desplegables en [Render](https://render.com/) como "Web Services" independientes (El *Publisher* expone un health check por el puerto nativo para evitar la limitación de workers de Render).
- **Frontend**: Alojado en [Vercel](https://vercel.com/) consumiendo la URL del Subscriber como `VITE_WS_URL`.

> ⚠️ **Aviso de "Cold Start"**: Los servicios gratuitos de Render se suspenden tras 15 minutos sin tráfico. Al abrir el dashboard Vercel en la web, la conexión inicial WebSocket puede demorar unos 60 a 90 segundos en "despertar" al Subscriber/Publisher antes de proyectar la telemetría en tiempo real.

---

## ▶️ Ejecución en Local (Ambiente de Pruebas PC)

Para iniciar todo el sistema localmente con 0 configuración, necesitas **Node.js** y **Docker Desktop** funcionando.

### Arranque Rápido Automático (Windows)
1. Abre tu **Docker Desktop**. 
2. Haz doble clic en el archivo `run_all.bat`. Este script arrancará tu base Redis, instalará dependencias, iniciará ambos backends en consola e iniciará el Dashboard mediante Vite.
3. Ve a `http://localhost:5173`.

### Ejecución Manual Explicativa
Abre 4 consolas integradas en el proyecto y lanza lo siguiente en cada una:

**Consola 1: Iniciar Redis Local**
```bash
docker-compose up -d
```
**Consola 2 y 3: Levantar Nodos Backend**
```bash
cd subscriber && npm install && node index.js
# En la otra consola:
cd publisher && npm install && node index.js
```
**Consola 4: Interfaz Gráfica (Vite)**
```bash
cd frontend && npm install && npm run dev
```

---
*Implementado mediante WebSockets puros, JS Vanilla, Node y Redis IORedis.*
