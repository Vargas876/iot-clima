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
let heatLayer;

if (typeof L.heatLayer === 'function') {
    heatLayer = L.heatLayer(heatPoints, {
        radius: 70, 
        blur: 50,   
        maxZoom: 6, 
        max: 35, 
        gradient: {0.1: 'blue', 0.3: 'cyan', 0.5: 'lime', 0.8: 'yellow', 1.0: 'red'}
    }).addTo(map);
} else {
    console.error('Heatmap plugin not found or not loaded correctly.');
}

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
    const date = new Date(dataPoint.timestamp);
    const timeLabel = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const city = dataPoint.ciudad;
    
    let labelIndex = globalLabels.indexOf(timeLabel);
    
    // Si la etiqueta no existe, la creamos y sincronizamos todos los datasets
    if (labelIndex === -1) {
        globalLabels.push(timeLabel);
        labelIndex = globalLabels.length - 1;
        
        // Mantener solo los últimos 40 puntos
        if (globalLabels.length > 40) {
            globalLabels.shift();
            labelIndex--; 
            // Limpiar datos viejos de todos los datasets para mantener sincronía
            [tempChart, humChart, presChart].forEach(chart => {
                chart.data.labels = globalLabels;
                chart.data.datasets.forEach(ds => ds.data.shift());
            });
        }
    }
    
    // Función auxiliar para actualizar datasets específicos
    const updateDataset = (chart, value) => {
        const ds = getOrCreateDataset(chart, city);
        // Rellenar con nulls si la ciudad se saltó intervalos previos
        while (ds.data.length < globalLabels.length) {
            ds.data.push(null);
        }
        // Colocar el valor en su posición temporal exacta
        ds.data[labelIndex] = value;
    };

    updateDataset(tempChart, dataPoint.temperatura);
    updateDataset(humChart, dataPoint.humedad);
    updateDataset(presChart, dataPoint.presion);
    
    tempChart.update('none'); // 'none' para mejor performance en actualizaciones rápidas
    humChart.update('none');
    presChart.update('none');
}

function updateHeatmap() {
    if (heatLayer) {
        heatLayer.setLatLngs(heatPoints);
    }
}

// Websocket Connection (Cloud o Local)
const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3001";
const socket = io(WS_URL);

socket.on('connect', () => {
    console.log('Connected to Subscriber via WebSockets');
});

let isInitialized = false;

socket.on('clima_history', (historyArray) => {
    if(isInitialized || !Array.isArray(historyArray)) return;
    console.log(`[Dashboard] Procesando historial de ${historyArray.length} puntos...`);
    
    // Sort array by timestamp
    historyArray.sort((a,b) => a.timestamp - b.timestamp);
    
    const latestStatus = {};

    historyArray.forEach(point => {
        updateCharts(point);
        latestStatus[point.ciudad] = point;
    });

    // Dibujar el estado más reciente de cada ciudad en el mapa inmediatamente
    Object.values(latestStatus).forEach(data => {
        updateMapElements(data);
    });
    
    isInitialized = true;
});

function updateMapElements(data) {
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
    updateHeatmap();
}

let updateQueue = [];
let isProcessingQueue = false;

function processQueue() {
    if (updateQueue.length === 0) {
        isProcessingQueue = false;
        return;
    }
    isProcessingQueue = true;
    
    const batch = updateQueue.splice(0, 5);
    batch.forEach(data => {
        updateCharts(data);
        updateMapElements(data);
    });

    requestAnimationFrame(processQueue);
}

socket.on('clima_update', (data) => {
    // Encolar evento (throttling básico)
    updateQueue.push(data);
    if (!isProcessingQueue) {
        requestAnimationFrame(processQueue);
    }
});
