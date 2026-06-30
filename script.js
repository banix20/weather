const API_KEY = 'ee0752dafdd6f36c381645918f861faa';
const CITY = 'Bucharest,RO';

// Forecast API URL (5-day / 3-hour)
const API_URL = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(CITY)}&appid=${API_KEY}&units=metric`;

async function fetchWeatherData() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    processWeatherData(data);
  } catch (error) {
    console.error('Eroare la preluarea datelor:', error);
    document.getElementById('total-precip').textContent = 'Eroare la încărcare';
  }
}

function processWeatherData(data) {
  // Aggregate precipitation by day
  const dailyPrecipMap = {};

  data.list.forEach(item => {
    // Get date string (without time)
    const dateStr = new Date(item.dt * 1000).toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' });

    // Get rain volume for 3h interval, default 0 if not available
    const rain3h = item.rain && item.rain['3h'] ? item.rain['3h'] : 0;

    // Sum precipitation for each day
    if (!dailyPrecipMap[dateStr]) {
      dailyPrecipMap[dateStr] = 0;
    }
    dailyPrecipMap[dateStr] += rain3h;
  });

  // Convert object to array of {date, precip}
  const dailyPrecip = Object.entries(dailyPrecipMap).map(([date, precip]) => ({
    date,
    precip
  }));

  // Total precipitation over all days
  const totalPrecip = dailyPrecip.reduce((sum, day) => sum + day.precip, 0);

  document.getElementById('total-precip').textContent = `${totalPrecip.toFixed(1)} mm`;

  createPrecipChart(dailyPrecip);
}

function createPrecipChart(dailyPrecip) {
  const ctx = document.getElementById('precipChart').getContext('2d');

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dailyPrecip.map(day => day.date),
      datasets: [{
        label: 'Precipitații (mm)',
        data: dailyPrecip.map(day => day.precip.toFixed(2)),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Precipitații (mm)', color: '#fff' },
          ticks: { color: '#fff' }
        },
        x: {
          ticks: { color: '#fff' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#fff' }
        }
      }
    }
  });
}

window.addEventListener('load', fetchWeatherData);
