const languagePack = {
  az: {
    title: "ChargeFinder ⚡",
    searchPlaceholder: "Məkan daxil edin...",
    distanceFilterLabel: "Məsafə Filtri (KM):",
    footerText: "ChargeFinder © 2025",
    planRouteButton: "Axtar",
    analyticsTitle: "Analitik Panel 📊",
    searchCount: "Axtarışlar: ",
    error: "Stansiyaların alınmasında xəta",
    notFound: "Yaxınlıqda stansiya tapılmadı",
    found: "Tapıldı",
    locationBlocked: "Geolokasiya bloklanıb. Chrome-da icazələri sıfırlayın və ya məkanı əl ilə daxil edin.",
    becomePremium: "Premium ol ⭐",
    premiumOnly: "Bu funksiya yalnız premium istifadəçilər üçündür.",
    successPurchase: "Premium aktiv oldu. Təşəkkür edirik!",
    legalLinks: "İstifadə Şərtləri · Məxfilik · Qaytarma",
    termsLink: "İstifadə Şərtləri",
    privacyLink: "Məxfilik",
    refundLink: "Qaytarma"
  },
  en: {
    title: "ChargeFinder ⚡",
    searchPlaceholder: "Enter location...",
    distanceFilterLabel: "Distance Filter (KM):",
    footerText: "ChargeFinder © 2025",
    planRouteButton: "Search",
    analyticsTitle: "Analytics Dashboard 📊",
    searchCount: "Searches: ",
    error: "Error fetching stations",
    notFound: "No stations found nearby",
    found: "Found",
    locationBlocked: "Geolocation is blocked. Reset permissions in Chrome or enter a location manually.",
    becomePremium: "Become Premium ⭐",
    premiumOnly: "This feature is for premium users only.",
    successPurchase: "Premium activated. Thank you!",
    legalLinks: "Terms · Privacy · Refund",
    termsLink: "Terms of Use",
    privacyLink: "Privacy Policy",
    refundLink: "Refund Policy"
  }
};

const API_KEY = "b45853eb-d295-4cc1-a8bc-8c2a4be7a8ff";
const API_URL = "https://api.openchargemap.io/v3/poi/";

let userLang = navigator.language.slice(0, 2);
if (!languagePack[userLang]) userLang = "az";

let stats = JSON.parse(localStorage.getItem("stats")) || { searches: 0 };
let userProfile = null;
let isPremium = false;

// DOM elementləri
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const resultsCount = document.getElementById("resultsCount");
const toggleMode = document.getElementById("toggleMode");
const distanceSelector = document.getElementById("distanceSelector");
const spinner = document.getElementById("spinner");
const languageSelector = document.getElementById("languageSelector");
const searchCountEl = document.getElementById("searchCount");
const premiumButton = document.getElementById("premiumButton");

// Leaflet xəritəsi
const map = L.map("map").setView([40.4093, 49.8671], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// Google giriş callback
window.handleGoogleSignIn = (response) => {
  const jwt = response.credential;
  const payload = JSON.parse(atob(jwt.split('.')[1]));
  userProfile = {
    name: payload.name,
    email: payload.email,
    picture: payload.picture
  };

  alert(`Xoş gəldiniz, ${userProfile.name}!`);
  checkPremiumStatus();
  showPremiumOptions();
};

function init() {
  setupEventListeners();
  loadInitialData();
  updateTranslations();
  if (searchCountEl) searchCountEl.textContent = stats.searches;
}

function setupEventListeners() {
  searchButton.addEventListener("click", searchLocation);

  toggleMode.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    toggleMode.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
  });

  languageSelector.addEventListener("change", (e) => {
    userLang = e.target.value;
    updateTranslations();
  });

  if (premiumButton) {
    premiumButton.addEventListener("click", () => {
      if (!userProfile) {
        alert("Əvvəlcə daxil olun.");
        return;
      }

      Paddle.Checkout.open({
        product: 12345, // Buraya Paddle Product ID-ni əlavə et
        email: userProfile.email,
        successCallback: () => {
          localStorage.setItem("premiumEmail", userProfile.email);
          isPremium = true;
          document.body.classList.add("premium-enabled");
          alert(languagePack[userLang].successPurchase);
        }
      });
    });
  }
}

function updateTranslations() {
  document.querySelectorAll("[data-translate]").forEach((el) => {
    const key = el.getAttribute("data-translate");
    const translation = languagePack[userLang]?.[key];
    if (!translation) return;
    if (["INPUT", "TEXTAREA"].includes(el.tagName)) {
      el.placeholder = translation;
    } else {
      el.textContent = translation;
    }
  });
}

function checkPremiumStatus() {
  const premiumEmail = localStorage.getItem("premiumEmail");
  if (userProfile?.email && premiumEmail === userProfile.email) {
    isPremium = true;
    document.body.classList.add("premium-enabled");
  }
}

function showPremiumOptions() {
  if (premiumButton) premiumButton.classList.remove("hidden");
}

function loadInitialData() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 12);
        loadChargingStations(latitude, longitude);
      },
      () => {
        alert(languagePack[userLang]?.locationBlocked);
        map.setView([40.4093, 49.8671], 12);
      }
    );
  } else {
    alert("Geolocation not supported");
    map.setView([40.4093, 49.8671], 12);
  }
}

function searchLocation() {
  const location = searchInput.value.trim();
  if (!location) return alert(languagePack[userLang]?.searchPlaceholder);

  stats.searches++;
  localStorage.setItem("stats", JSON.stringify(stats));
  if (searchCountEl) searchCountEl.textContent = stats.searches;

  spinner.classList.remove("hidden");

  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`)
    .then((res) => res.json())
    .then((data) => {
      if (!data.length) {
        spinner.classList.add("hidden");
        resultsCount.innerHTML = `❌ ${languagePack[userLang]?.notFound}`;
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      map.setView([lat, lon], 12);
      loadChargingStations(lat, lon);
    })
    .catch((err) => {
      console.error(err);
      spinner.classList.add("hidden");
      resultsCount.innerHTML = `❌ ${languagePack[userLang]?.error}`;
    });
}

async function loadChargingStations(lat, lon) {
  const radiusKM = parseInt(distanceSelector?.value) || 20;

  // Premium yoxlaması
  if (radiusKM > 30 && !isPremium) {
    alert(languagePack[userLang].premiumOnly);
    return;
  }

  const maxResults = 100;
  const url = `${API_URL}?output=json&latitude=${lat}&longitude=${lon}&distance=${radiusKM}&distanceunit=KM&maxresults=${maxResults}&compact=false&verbose=false&key=${API_KEY}`;

  try {
    spinner.classList.remove("hidden");
    resultsCount.innerHTML = "";

    const res = await fetch(url);
    const stations = await res.json();

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    let count = 0;
    stations.forEach((station) => {
      const info = station.AddressInfo;
      const address = info?.Title || "Naməlum Yer";
      const latitude = info?.Latitude;
      const longitude = info?.Longitude;
      const power = station.Connections?.[0]?.PowerKW || "N/A";
      const isOperational = station.StatusType?.IsOperational;
      const statusText = isOperational ? "🟢 Mövcuddur" : "🔴 Mövcud deyil";

      if (!latitude || !longitude) return;

      const marker = L.marker([latitude, longitude]).addTo(map);
      const popup = `
        <strong>${address}</strong><br/>
        ⚡ Güc: ${power} kW<br/>
        ${statusText}<br/>
        <a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank">🗺️ Naviqasiya</a>
      `;
      marker.bindPopup(popup);
      count++;
    });

    spinner.classList.add("hidden");
    resultsCount.innerHTML = count > 0
      ? `🔌 ${languagePack[userLang]?.found} ${count} stansiya`
      : `❌ ${languagePack[userLang]?.notFound}`;
  } catch (error) {
    console.error("Stansiyalar yüklənmədi:", error);
    spinner.classList.add("hidden");
    resultsCount.innerHTML = `❌ ${languagePack[userLang]?.error}`;
  }
}

init();
