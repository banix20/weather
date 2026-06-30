const API_KEY = 'ee0752dafdd6f36c381645918f861faa';

let currentCity = 'Bucharest,RO';
let chartInstance = null;

const totalPrecipEl = document.getElementById('total-precip');
const locationNameEl = document.getElementById('location-name');
const searchForm = document.getElementById('search-form');
const cityInput = document.getElementById('city-input');
const gpsBtn = document.getElementById('gps-btn');
const suggestionsList = document.getElementById('suggestions-list');

let debounceTimer = null;
let activeSuggestionIndex = -1;
let currentSuggestions = [];

function buildGeocodingUrl(query) {
  return `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`;
}

function formatSuggestionLabel(place) {
  const parts = [place.name];
  if (place.state) parts.push(place.state);
  if (place.country) parts.push(place.country);
  return parts.join(', ');
}

function hideSuggestions() {
  suggestionsList.hidden = true;
  suggestionsList.innerHTML = '';
  currentSuggestions = [];
  activeSuggestionIndex = -1;
}

function renderSuggestions(places) {
  currentSuggestions = places;
  activeSuggestionIndex = -1;

  if (!places.length) {
    hideSuggestions();
    return;
  }

  suggestionsList.innerHTML = places
    .map((place, index) => `<li role="option" data-index="${index}">${formatSuggestionLabel(place)}</li>`)
    .join('');
  suggestionsList.hidden = false;
}

async function fetchSuggestions(query) {
  try {
    const response = await fetch(buildGeocodingUrl(query));
    if (!response.ok) {
      hideSuggestions();
      return;
    }
    const places = await response.json();
    renderSuggestions(places);
  } catch (error) {
    console.error('Eroare la sugestii:', error);
    hideSuggestions();
  }
}

function selectSuggestion(place) {
  const label = formatSuggestionLabel(place);
  cityInput.value = label;
  hideSuggestions();
  fetchWeatherData(buildUrlByCoords(place.lat, place.lon));
}

cityInput.addEventListener('input', () => {
  const query = cityInput.value.trim();
  clearTimeout(debounceTimer);

  if (query.length < 2) {
    hideSuggestions();
    return;
  }

  debounceTimer = setTimeout(() => fetchSuggestions(query), 300);
});

cityInput.addEventListener('keydown', (e) => {
  if (suggestionsList.hidden || !currentSuggestions.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex + 1) % currentSuggestions.length;
    updateActiveSuggestion();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
    updateActiveSuggestion();
  } else if (e.key === 'Enter') {
    if (activeSuggestionIndex >= 0) {
      e.preventDefault();
      selectSuggestion(currentSuggestions[activeSuggestionIndex]);
    }
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
});

function updateActiveSuggestion() {
  [...suggestionsList.children].forEach((li, index) => {
    li.classList.toggle('active', index === activeSuggestionIndex);
  });
  const activeEl = suggestionsList.children[activeSuggestionIndex];
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
}

suggestionsList.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const index = Number(li.dataset.index);
  selectSuggestion(currentSuggestions[index]);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-input-wrap')) {
    hideSuggestions();
  }
});

function buildUrlByCity(city) {
  return `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&lang=ro`;
}

function buildUrlByCoords(lat, lon) {
  return `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ro`;
}

async function fetchWeatherData(url) {
  totalPrecipEl.textContent = 'Încărcare...';
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Localitate negăsită. Verifică numele orașului.');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    processWeatherData(data);
  } catch (error) {
    console.error('Eroare la preluarea datelor:', error);
    totalPrecipEl.textContent = 'Eroare la încărcare';
    locationNameEl.textContent = error.message || '';
  }
}

function processWeatherData(data) {
  // Display location name
  if (data.city && data.city.name) {
    const country = data.city.country ? `, ${data.city.country}` : '';
    locationNameEl.textContent = `${data.city.name}${country}`;
  }

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

  totalPrecipEl.textContent = `${totalPrecip.toFixed(1)} mm`;

  createPrecipChart(dailyPrecip);
}

function createPrecipChart(dailyPrecip) {
  const ctx = document.getElementById('precipChart').getContext('2d');

  // Destroy previous chart instance before creating a new one
  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
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
      responsive: true,
      maintainAspectRatio: false,
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

// Search form submit (by city name)
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (!city) return;
  hideSuggestions();
  currentCity = city;
  fetchWeatherData(buildUrlByCity(currentCity));
});

// GPS button: get user's current location
gpsBtn.addEventListener('click', () => {
  hideSuggestions();
  if (!navigator.geolocation) {
    locationNameEl.textContent = 'Geolocalizarea nu este suportată de acest browser.';
    return;
  }

  gpsBtn.disabled = true;
  gpsBtn.textContent = '⏳';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      cityInput.value = '';
      fetchWeatherData(buildUrlByCoords(latitude, longitude));
      gpsBtn.disabled = false;
      gpsBtn.textContent = '📍';
    },
    (error) => {
      console.error('Eroare GPS:', error);
      locationNameEl.textContent = 'Nu am putut obține locația. Verifică permisiunile.';
      gpsBtn.disabled = false;
      gpsBtn.textContent = '📍';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

window.addEventListener('load', () => fetchWeatherData(buildUrlByCity(currentCity)));
