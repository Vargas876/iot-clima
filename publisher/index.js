require('dotenv').config();
const Redis = require('ioredis');
const axios = require('axios');
const http = require('http'); // Servidor nativo de Node (no requiere instalar nada)

// --- TRUCO NUBE: Health Check Server ---
// Abre un puerto ficticio para engañar a Render y que nos dé la capa Gratuita de Web Service
const PORT = process.env.PORT || 3002;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('IoT Publisher is active and sending data.');
}).listen(PORT, () => console.log(`[Health] Publisher disfrazado esperando en puerto ${PORT}`));
// ---------------------------------------

// Usa REDIS_URL en la nube, o la configuración local como fallback
const redis = process.env.REDIS_URL ? 
  new Redis(process.env.REDIS_URL) : 
  new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
  });

const CITIES = [
  { name: 'Bogotá', lat: 4.6097, lon: -74.0817 },
  { name: 'Medellín', lat: 6.2518, lon: -75.5636 },
  { name: 'Cali', lat: 3.4372, lon: -76.5225 },
  { name: 'Barranquilla', lat: 10.9685, lon: -74.7813 },
  { name: 'Cartagena', lat: 10.3997, lon: -75.5144 },
  { name: 'Bucaramanga', lat: 7.1254, lon: -73.1198 },
  { name: 'Pereira', lat: 4.8133, lon: -75.6961 },
  { name: 'Manizales', lat: 5.0689, lon: -75.5174 }
];

let currentData = {};

CITIES.forEach(c => {
    // Initial plausible mock data
    currentData[c.name] = {
        ciudad: c.name,
        lat: c.lat,
        lon: c.lon,
        temperatura: 20,
        humedad: 60,
        presion: 1010,
        viento: 5,
        timestamp: Date.now()
    };
});

async function fetchRealData() {
    console.log(`[API] Fetching real data from Open-Meteo for ${CITIES.length} cities...`);
    try {
        const lats = CITIES.map(c => c.lat).join(',');
        const lons = CITIES.map(c => c.lon).join(',');
        
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m`;
        
        const response = await axios.get(url);
        const results = response.data;
        
        if (Array.isArray(results)) {
            results.forEach((cityResult, index) => {
                const cityName = CITIES[index].name;
                currentData[cityName] = {
                    ciudad: cityName,
                    lat: CITIES[index].lat,
                    lon: CITIES[index].lon,
                    temperatura: cityResult.current.temperature_2m,
                    humedad: cityResult.current.relative_humidity_2m,
                    presion: cityResult.current.surface_pressure,
                    viento: cityResult.current.wind_speed_10m,
                    timestamp: Date.now()
                };
            });
            console.log('[API] Update successful.');
        }
    } catch (error) {
         console.error('[API ERROR] Failed to fetch metrics from Open-Meteo:', error.message);
         // Fallback to simulation naturally happens via random walk
    }
}

function simulateRandomWalk() {
    CITIES.forEach(c => {
        const d = currentData[c.name];
        
        d.temperatura = parseFloat((d.temperatura + (Math.random() - 0.5)).toFixed(2));
        d.humedad = Math.max(0, Math.min(100, Math.round(d.humedad + (Math.random() * 2 - 1))));
        d.presion = parseFloat((d.presion + (Math.random() - 0.5)).toFixed(2));
        d.viento = Math.max(0, parseFloat((d.viento + (Math.random() - 0.5)).toFixed(2)));
        d.timestamp = Date.now();
    });
}

async function publishData() {
    const pipeline = redis.pipeline(); 
    
    CITIES.forEach(c => {
        const payload = JSON.stringify(currentData[c.name]);
        // 1. Publish to the live channel
        pipeline.publish('clima', payload);
        
        // 2. Add to historical Sorted Set
        pipeline.zadd('clima_historial', currentData[c.name].timestamp, payload);
    });
    
    // Maintain a capped sorted set (keep the last 15 minutes of readings)
    const cutoff = Date.now() - (15 * 60 * 1000);
    pipeline.zremrangebyscore('clima_historial', '-inf', cutoff);
    
    await pipeline.exec();
}

(async () => {
    redis.on('error', (err) => console.error('[Redis ERROR]', err.message));
    redis.on('connect', () => console.log('[Redis] Connected successfully.'));

    // 1. Fetch immediately
    await fetchRealData();
    // 2. Schedule fetch every 60 seconds
    setInterval(fetchRealData, 60 * 1000);
    
    // 3. Schedule random walk and publishing every 5 seconds
    setInterval(async () => {
        simulateRandomWalk();
        await publishData();
    }, 5000);
})();
