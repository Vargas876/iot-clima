require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const cors = require('cors');

const app = express();
app.use(cors());

// Serve optional REST endpoint just for health checks
app.get('/', (req, res) => res.send('🌡️ Subscriber IoT Service: Online and Waiting for WebSockets...'));
app.get('/health', (req, res) => res.send('OK'));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Allows any frontend to connect natively
        methods: ['GET', 'POST']
    }
});

const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
};

// Two independent connections: one for pub/sub, one for commands (zrange)
const pubSubRedis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : new Redis(redisConfig);
const cmdRedis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : new Redis(redisConfig);

pubSubRedis.on('error', (err) => console.error('[Redis pubsub] ERROR:', err.message));
cmdRedis.on('error', (err) => console.error('[Redis cmd] ERROR:', err.message));

pubSubRedis.subscribe('clima', (err, count) => {
    if (err) {
        console.error('Failed to subscribe: %s', err.message);
    } else {
        console.log(`[Redis] Subscribed successfully! Currently subscribed to ${count} channels.`);
    }
});

pubSubRedis.on('message', (channel, message) => {
    if (channel === 'clima') {
        // Validación de parsing de datos
        try {
            const data = JSON.parse(message);
            // Broadcast the live update
            io.emit('clima_update', data);
            console.log(`[Flow] Reenviando clima_update para ${data.ciudad} a los clientes conectados.`);
        } catch (error) {
            console.error('[Error de Datos] Fallo al procesar el mensaje desde Redis:', error.message);
        }
    }
});

io.on('connection', async (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);
    
    // When a client connects, send the historical data
    try {
        const historyDataStrings = await cmdRedis.zrange('clima_historial', 0, -1);
        const historyData = historyDataStrings.map(str => {
            try {
                return JSON.parse(str);
            } catch (e) {
                return null;
            }
        }).filter(item => item !== null); // Remove corrupted elements
        socket.emit('clima_history', historyData);
    } catch (e) {
        console.error('[Redis] Error fetching history:', e);
    }
    
    socket.on('disconnect', () => {
        console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`[Server] Subscriber/WebSocket service listening on port ${PORT}`);
});
