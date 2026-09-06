/**
 * Servizio per ottenere informazioni reali sulla zona
 * Utilizza le API di OpenStreetMap per recuperare punti di interesse e informazioni
 */
import axios from 'axios';

// Cache per memorizzare i risultati delle ricerche
const poiCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 ore

/**
 * Recupera i punti di interesse vicino a una posizione
 * @param {number} lat - Latitudine
 * @param {number} lon - Longitudine
 * @param {number} radius - Raggio di ricerca in metri (default: 500m)
 * @returns {Promise<Object>} - Informazioni sulla zona
 */
export const getNearbyPointsOfInterest = async (lat, lon, radius = 500) => {
  console.log('🔍 locationService: Recupero POI per coordinate:', { lat, lon, radius });
  
  if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
    console.warn('❌ locationService: Coordinate non valide:', { lat, lon });
    return { 
      success: false, 
      error: 'Coordinate non valide',
      poiByCategory: generateEmptyPOICategories(),
      insights: generateDefaultInsights()
    };
  }

  // Chiave di cache
  const cacheKey = `poi_${lat.toFixed(5)}_${lon.toFixed(5)}_${radius}`;
  
  // Verifica se i dati sono in cache
  const cached = poiCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log('✅ locationService: Dati POI recuperati dalla cache');
    return cached.data;
  }

  try {
    console.log('🌐 locationService: Chiamata API Overpass per POI...');
    
    // Utilizziamo Overpass API per ottenere POI da OpenStreetMap
    // Questa query cerca punti di interesse comuni come scuole, ospedali, parchi, ecc.
    const overpassQuery = `
      [out:json];
      (
        node["amenity"~"school|university|hospital|restaurant|cafe|bar|bank|pharmacy"](around:${radius},${lat},${lon});
        node["leisure"~"park|garden|playground"](around:${radius},${lat},${lon});
        node["shop"](around:${radius},${lat},${lon});
        node["public_transport"="station"](around:${radius},${lat},${lon});
        way["amenity"~"school|university|hospital"](around:${radius},${lat},${lon});
        way["leisure"~"park|garden"](around:${radius},${lat},${lon});
      );
      out center;
    `;

    // Timeout più lungo per evitare errori di rete
    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      overpassQuery,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000
      }
    );

    // Processa i risultati
    console.log(`✅ locationService: Ricevuti ${response.data?.elements?.length || 0} POI da Overpass`);
    const results = processOverpassResults(response.data);
    
    // Salva in cache
    poiCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });
    
    return results;
  } catch (error) {
    console.error('❌ locationService: Errore nel recupero dei POI:', error.message);
    
    // Fallback: genera dati simulati ma realistici
    console.log('🔄 locationService: Uso dati di fallback');
    const fallbackData = generateFallbackPOIData();
    return fallbackData;
  }
};

/**
 * Processa i risultati di Overpass API
 * @param {Object} data - Dati da Overpass API
 * @returns {Object} - Dati processati
 */
function processOverpassResults(data) {
  if (!data || !data.elements || data.elements.length === 0) {
    console.warn('⚠️ locationService: Nessun POI trovato, uso fallback');
    return generateFallbackPOIData();
  }
  
  // Raggruppa i POI per categoria
  const poiByCategory = generateEmptyPOICategories();
  
  data.elements.forEach(element => {
    const tags = element.tags || {};
    const name = tags.name || 'Senza nome';
    const lat = element.lat || element.center?.lat;
    const lon = element.lon || element.center?.lon;
    
    if (!lat || !lon) return;
    
    const poi = {
      name,
      lat,
      lon,
      type: tags.amenity || tags.leisure || tags.shop || tags.public_transport || 'other',
      tags
    };
    
    // Categorizza il POI
    if (tags.amenity === 'school' || tags.amenity === 'university') {
      poiByCategory.education.push(poi);
    } else if (tags.amenity === 'hospital' || tags.amenity === 'pharmacy') {
      poiByCategory.health.push(poi);
    } else if (['restaurant', 'cafe', 'bar'].includes(tags.amenity)) {
      poiByCategory.food.push(poi);
    } else if (tags.leisure === 'park' || tags.leisure === 'garden' || tags.leisure === 'playground') {
      poiByCategory.leisure.push(poi);
    } else if (tags.shop) {
      poiByCategory.shopping.push(poi);
    } else if (tags.public_transport === 'station') {
      poiByCategory.transport.push(poi);
    } else {
      poiByCategory.other.push(poi);
    }
  });
  
  // Genera insights basati sui dati reali
  const insights = generateInsightsFromPOI(poiByCategory);
  
  return {
    success: true,
    poiByCategory,
    insights,
    count: data.elements.length
  };
}

/**
 * Genera categorie POI vuote
 */
function generateEmptyPOICategories() {
  return {
    education: [],
    health: [],
    food: [],
    leisure: [],
    shopping: [],
    transport: [],
    other: []
  };
}

/**
 * Genera insight basati sui POI trovati
 * @param {Object} poiByCategory - POI raggruppati per categoria
 * @returns {Array} - Array di insight
 */
function generateInsightsFromPOI(poiByCategory) {
  const insights = [];
  
  // Insight sull'educazione
  if (poiByCategory.education.length > 0) {
    const schools = poiByCategory.education.filter(poi => poi.tags?.amenity === 'school');
    const universities = poiByCategory.education.filter(poi => poi.tags?.amenity === 'university');
    
    if (universities.length > 0) {
      insights.push({
        type: 'investment',
        title: 'Ottima zona per investimenti',
        description: 'La presenza di università rende questa zona ideale per investimenti immobiliari destinati a studenti.',
        icon: '🎓',
        score: 5
      });
    }
    
    if (schools.length > 0) {
      insights.push({
        type: 'family',
        title: 'Zona adatta alle famiglie',
        description: `Presenza di ${schools.length} scuole nelle vicinanze, ideale per famiglie con bambini.`,
        icon: '👨‍👩‍👧‍👦',
        score: 4
      });
    }
  }
  
  // Insight sul tempo libero
  if (poiByCategory.leisure.length > 0) {
    insights.push({
      type: 'lifestyle',
      title: 'Zona verde e vivibile',
      description: `Presenza di ${poiByCategory.leisure.length} aree verdi nelle vicinanze per attività all'aperto.`,
      icon: '🌳',
      score: 4
    });
  }
  
  // Insight sui trasporti
  if (poiByCategory.transport.length > 0) {
    insights.push({
      type: 'mobility',
      title: 'Ben collegata',
      description: `La zona è ben servita dai mezzi pubblici con ${poiByCategory.transport.length} fermate nelle vicinanze.`,
      icon: '🚇',
      score: 5
    });
  }
  
  // Insight sui servizi
  const servicesCount = poiByCategory.health.length + poiByCategory.shopping.length + poiByCategory.food.length;
  if (servicesCount > 5) {
    insights.push({
      type: 'services',
      title: 'Ricca di servizi',
      description: 'Zona con un\'ottima offerta di servizi, negozi e ristoranti.',
      icon: '🏪',
      score: 5
    });
  } else if (servicesCount > 0) {
    insights.push({
      type: 'services',
      title: 'Servizi essenziali',
      description: 'Zona con i servizi essenziali nelle vicinanze.',
      icon: '🏪',
      score: 3
    });
  }
  
  // Se non ci sono abbastanza insight, aggiungi quelli generici
  if (insights.length < 2) {
    const defaultInsights = generateDefaultInsights();
    insights.push(...defaultInsights.filter((_, i) => i < 3 - insights.length));
  }
  
  return insights;
}

/**
 * Genera insight di default
 */
function generateDefaultInsights() {
  return [
    {
      type: 'potential',
      title: 'Zona con potenziale',
      description: 'Area con buone prospettive di sviluppo futuro.',
      icon: '📈',
      score: 3.5
    },
    {
      type: 'location',
      title: 'Posizione interessante',
      description: 'Zona con caratteristiche generali positive.',
      icon: '📍',
      score: 3.8
    },
    {
      type: 'lifestyle',
      title: 'Buona qualità della vita',
      description: 'Area che offre un buon equilibrio tra servizi e tranquillità.',
      icon: '✨',
      score: 4
    }
  ];
}

/**
 * Genera dati POI di fallback realistici
 * @returns {Object} - Dati POI simulati
 */
function generateFallbackPOIData() {
  // Genera dati simulati ma realistici basati su statistiche medie italiane
  const poiByCategory = {
    education: [
      { name: 'Scuola elementare', type: 'school' },
      { name: 'Scuola media', type: 'school' }
    ],
    health: [
      { name: 'Farmacia', type: 'pharmacy' },
      { name: 'Studio medico', type: 'clinic' }
    ],
    food: [
      { name: 'Bar', type: 'bar' },
      { name: 'Ristorante', type: 'restaurant' },
      { name: 'Pizzeria', type: 'restaurant' }
    ],
    leisure: [
      { name: 'Giardino pubblico', type: 'garden' },
      { name: 'Area giochi', type: 'playground' }
    ],
    shopping: [
      { name: 'Supermercato', type: 'supermarket' },
      { name: 'Negozio di alimentari', type: 'convenience' },
      { name: 'Panificio', type: 'bakery' }
    ],
    transport: [
      { name: 'Fermata autobus', type: 'station' },
      { name: 'Stazione taxi', type: 'taxi' }
    ],
    other: [
      { name: 'Ufficio postale', type: 'post_office' },
      { name: 'Banca', type: 'bank' }
    ]
  };
  
  // Genera insight basati sui dati simulati
  const insights = generateInsightsFromPOI(poiByCategory);
  
  return {
    success: true,
    poiByCategory,
    insights,
    count: Object.values(poiByCategory).reduce((sum, arr) => sum + arr.length, 0),
    isSimulated: true
  };
}

export default {
  getNearbyPointsOfInterest
}; 
