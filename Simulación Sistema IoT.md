# Descripción de la actividad
Utilizando Redis como base de datos en memoria, simular un sistema IoT que recopile datos de clima (temperatura, humedad, presión) de múltiples sensores distribuidos geográficamente. Los datos deben ser procesados y visualizados en tiempo real mediante una aplicación web sencilla. Para efectos de la simulación, los datos pueden ser tomados de una API pública de clima.

Reto: En grupos de 3, simular un sistema IoT en vivo con datos de clima.
# Objetivo
- Implementar un sistema IoT que recopile, procese y visualice datos climáticos en tiempo real.
- Fomentar el trabajo en equipo y la colaboración entre los miembros del grupo.
- Desarrollar habilidades en el uso de Redis, APIs públicas y tecnologías web.
- Mejorar la capacidad de presentar y explicar proyectos técnicos.

# Pasos sugeridos
1. **Configurar Redis**: Instalar y configurar Redis en un servidor local o en la nube.
2. **Consultar y seleccionar una API para obtener datos de clima**: Utilizar una API pública como Open-Meteo, OpenWeatherMap 
3. **Publisher**: Crear un script que cada X segundos consulte una API de clima
   - Temperatura
   - Humedad
   - Velocidad del viento
4. **Subscriber**: Un script web o Node.js que reciba los eventos en tiempo real.
5. **Visualización**: Utilizar una biblioteca de gráficos como *Chart.js, heatmap.jso o D3.js* para mostrar los datos en tiempo real en una página web. Se debe visualizar:
    - Gráfica de temperatura vs tiempo
    - Gráfica de humedad vs tiempo
    - Gráfica de presión vs tiempo
    - Mapa de calor (heatmap) de las diferentes ubicaciones de los sensores