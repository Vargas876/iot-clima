import { io } from "socket.io-client";
import Chart from 'chart.js/auto';

// Initialize Map
const map = L.map('map', {
    center: [4.5709, -74.2973], // Center of Colombia
    zoom: 6,
    zoomControl: false // optional
});

// CartoDB Dark Base Map
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
}).addTo(map);

// Prepare Heatmap layer
let heatPoints = [];
let heatLayer = L.heatLayer(heatPoints, {
    radius: 70, // 🔥 Aumentadísimo para verse espectacular de lejos
    blur: 50,   // 🔥 Mayor difuminado para fundirse con el terreno
    maxZoom: 6, // Hace que la escala de intensidad soporte el alejamiento
    max: 35, 
    gradient: {0.1: 'blue', 0.3: 'cyan', 0.5: 'lime', 0.8: 'yellow', 1.0: 'red'}
}).addTo(map);

let cityMarkers = {}; // Keep reference to markers

// Initialize Charts
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: {
        mode: 'index',
        intersect: false,
    },
    scales: {
        x: {
            type: 'category',
            ticks: { color: '#c5c6c7', maxTicksLimit: 10 },
            grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
            ticks: { color: '#c5c6c7' },
            grid: { color: 'rgba(255,255,255,0.05)' }
        }
    },
    plugins: {
        legend: { labels: { color: '#ffffff' } }
    }
};

const createChart = (ctxId, label) => {
    const ctx = document.getElementById(ctxId).getContext('2d');
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], 
            datasets: [] 
        },
        options: commonOptions
    });
};

const tempChart = createChart('tempChart', 'Temperatura (°C)');
const humChart  = createChart('humChart', 'Humedad (%)');
const presChart = createChart('presChart', 'Presión (hPa)');

const cityColors = {
    'Bogotá': '#ff5e57',
    'Medellín': '#0fb9b1',
    'Cali': '#fbc531',
    'Barranquilla': '#0be881',
    'Cartagena': '#3c40c6',
    'Bucaramanga': '#ffa801',
    'Pereira': '#ff3f34',
    'Manizales': '#808e9b'
};

const appData = {};

function getOrCreateDataset(chart, city) {
    let dataset = chart.data.datasets.find(ds => ds.label === city);
    if (!dataset) {
        dataset = {
            label: city,
            data: [],
            borderColor: cityColors[city] || '#ffffff',
            backgroundColor: (cityColors[city] || '#ffffff') + '33',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6
        };
        chart.data.datasets.push(dataset);
    }
    return dataset;
}

// Global ordered labels array
const globalLabels = [];

function updateCharts(dataPoint) {
    const timeLabel = new Date(dataPoint.timestamp).toLocaleTimeString();
    const city = dataPoint.ciudad;
    
    if (!globalLabels.includes(timeLabel)) {
        globalLabels.push(timeLabel);
        tempChart.data.labels.push(timeLabel);
        humChart.data.labels.push(timeLabel);
        presChart.data.labels.push(timeLabel);
        
        // Keep last 40 intervals
        if (globalLabels.length > 40) {
            globalLabels.shift();
            tempChart.data.labels.shift();
            humChart.data.labels.shift();
            presChart.data.labels.shift();
            
            tempChart.data.datasets.forEach(ds => ds.data.shift());
            humChart.data.datasets.forEach(ds => ds.data.shift());
            presChart.data.datasets.forEach(ds => ds.data.shift());
        }
    }
    
    const dsTemp = getOrCreateDataset(tempChart, city);
    const dsHum = getOrCreateDataset(humChart, city);
    const dsPres = getOrCreateDataset(presChart, city);
    
    // Pad missing points for the city if it missed an interval
    while(dsTemp.data.length < globalLabels.length - 1) { dsTemp.data.push(dsTemp.data[dsTemp.data.length-1] || null); }
    while(dsHum.data.length < globalLabels.length - 1) { dsHum.data.push(dsHum.data[dsHum.data.length-1] || null); }
    while(dsPres.data.length < globalLabels.length - 1) { dsPres.data.push(dsPres.data[dsPres.data.length-1] || null); }
    
    dsTemp.data.push(dataPoint.temperatura);
    dsHum.data.push(dataPoint.humedad);
    dsPres.data.push(dataPoint.presion);
    
    tempChart.update();
    humChart.update();
    presChart.update();
}

function updateHeatmap() {
    heatLayer.setLatLngs(heatPoints);
}

// Websocket Connection (Cloud o Local)
const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3001";
const socket = io(WS_URL);

socket.on('connect', () => {
    console.log('Connected to Subscriber via WebSockets');
});

let isInitialized = false;

socket.on('clima_history', (historyArray) => {
    if(isInitialized) return;
    
    // Sort array by timestamp
    historyArray.sort((a,b) => a.timestamp - b.timestamp);
    
    // Guardar el último estado para dibujar el mapa inicial
    const latestStatus = {};

    historyArray.forEach(point => {
        updateCharts(point);
        latestStatus[point.ciudad] = point;
    });

    // Inyectar el estado inicial en el mapa para no esperar la próxima actualización
    Object.values(latestStatus).forEach(data => {
        updateQueue.push(data);
    });

    if (!isProcessingQueue && updateQueue.length > 0) {
        requestAnimationFrame(processQueue);
    }
    
    isInitialized = true;
});

let updateQueue = [];
let isProcessingQueue = false;

function processQueue() {
    if (updateQueue.length === 0) {
        isProcessingQueue = false;
        return;
    }
    isProcessingQueue = true;
    
    // Throttling básico: procesar un batch máximo por frame para evitar sobrecarga del frontend
    const batch = updateQueue.splice(0, 5);
    
    batch.forEach(data => {
        updateCharts(data);
        
        const {lat, lon, ciudad, temperatura, humedad} = data;
        
        if (!cityMarkers[ciudad]) {
            const marker = L.circleMarker([lat, lon], {
                radius: 8,
                fillColor: cityColors[ciudad] || '#fff',
                color: '#fff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.9
            }).addTo(map);
            
            cityMarkers[ciudad] = marker;
        }
        
        cityMarkers[ciudad].bindTooltip(`
            <div class="custom-premium-popup">
              <strong style="color:${cityColors[ciudad]}">${ciudad}</strong>
              <div class="popup-data">TEMP <span>${temperatura}°C</span></div>
              <div class="popup-data">HUM <span>${humedad}%</span></div>
            </div>
        `);
        
        let idx = heatPoints.findIndex(p => p[0] === lat && p[1] === lon);
        if (idx !== -1) {
            heatPoints[idx] = [lat, lon, temperatura];
        } else {
            heatPoints.push([lat, lon, temperatura]);
        }
    });

    updateHeatmap();
    requestAnimationFrame(processQueue);
}

socket.on('clima_update', (data) => {
    // Encolar evento (throttling básico)
    updateQueue.push(data);
    if (!isProcessingQueue) {
        requestAnimationFrame(processQueue);
    }
});
