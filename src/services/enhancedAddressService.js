/**
 * Servizio Avanzato per Autocompletamento Indirizzi
 * Combina più fonti di dati per garantire copertura completa d'Italia
 * con fallback intelligenti e cache ottimizzata
 */
import axios from 'axios';
import { validateItalianCAP, getCAPInfo } from './realOmiService.js';

// Cache per i risultati delle ricerche
const addressCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minuti

// Database locale delle vie principali italiane (campione)
const MAJOR_ITALIAN_STREETS = {
  'Roma': [
    'Via del Corso', 'Via Nazionale', 'Via Veneto', 'Via Appia Antica', 'Via Flaminia',
    'Via Aurelia', 'Via Cassia', 'Via Salaria', 'Via Nomentana', 'Via Tiburtina',
    'Via Casilina', 'Via Tuscolana', 'Via Cristoforo Colombo', 'Via Ostiense',
    'Via del Tritone', 'Via Condotti', 'Via Frattina', 'Via Borgognona',
    'Corso Vittorio Emanuele II', 'Largo Argentina', 'Piazza Venezia',
    'Via Giulia', 'Via dei Cappuccini', 'Via Sistina', 'Via Margutta'
  ],
  'Milano': [
    'Via Montenapoleone', 'Via della Spiga', 'Via Manzoni', 'Via Brera',
    'Corso Buenos Aires', 'Corso di Porta Ticinese', 'Via Torino',
    'Via Dante', 'Via Garibaldi', 'Corso Venezia', 'Corso Magenta',
    'Via Paolo Sarpi', 'Via Vigevano', 'Via Navigli', 'Via Isola',
    'Corso di Porta Romana', 'Via Washington', 'Via Moscova',
    'Via Sant\'Andrea', 'Via Verri', 'Corso Matteotti', 'Via Bagutta'
  ],
  'Napoli': [
    'Via Toledo', 'Via Chiaia', 'Via dei Mille', 'Corso Umberto I',
    'Via Partenope', 'Via Caracciolo', 'Via Posillipo', 'Via Mergellina',
    'Via del Tribunali', 'Via San Gregorio Armeno', 'Via Spaccanapoli',
    'Corso Garibaldi', 'Via Foria', 'Via Duomo', 'Via Marina',
    'Via Depretis', 'Via Medina', 'Via Monteoliveto', 'Via Port\'Alba'
  ],
  'Torino': [
    'Via Roma', 'Via Po', 'Via Garibaldi', 'Corso Francia', 'Corso Vittorio Emanuele II',
    'Via Pietro Micca', 'Via Lagrange', 'Via della Consolata', 'Via Montebello',
    'Corso Duca degli Abruzzi', 'Via Nizza', 'Corso Re Umberto',
    'Via Cavour', 'Via Accademia Albertina', 'Via del Carmine',
    'Corso San Maurizio', 'Via Maria Vittoria', 'Via Sant\'Anselmo'
  ],
  'Bologna': [
    'Via Indipendenza', 'Via Rizzoli', 'Via Ugo Bassi', 'Via Zamboni',
    'Via San Stefano', 'Via Castiglione', 'Via Farini', 'Via Marconi',
    'Via Massarenti', 'Via Saragozza', 'Via San Felice', 'Via del Pratello',
    'Via delle Belle Arti', 'Via Petroni', 'Via Mazzini'
  ],
  'Firenze': [
    'Via dei Calzaiuoli', 'Via Tornabuoni', 'Via Roma', 'Borgo Ognissanti',
    'Via Santo Spirito', 'Via Maggio', 'Via Guelfa', 'Via dei Servi',
    'Via Cavour', 'Borgo San Lorenzo', 'Via dell\'Agnolo', 'Lungarno',
    'Via de\' Benci', 'Via San Niccolò', 'Via Ghibellina'
  ]
};

// Mappature CAP specifiche per comuni critici in cui i servizi esterni
// non restituiscono sempre il codice postale ma per il nostro motore è essenziale
const CITY_CAP_OVERRIDES = {
  'poggio imperiale': '71010'
};

// Base URL del nostro backend, usato per proxare le chiamate di geocoding
// (Nominatim/Photon) — vedi searchViaBackend sotto per il motivo.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

/**
 * Cerca indirizzi utilizzando fonti multiple con fallback intelligenti
 * @param {string} query - Query di ricerca
 * @returns {Promise<Array>} - Array di suggerimenti formattati
 */
export const searchAddresses = async (query, options = {}) => {
  const { signal } = options;
  if (!query || query.length < 2) {
    return [];
  }

  const originalQuery = query.trim();

  const capMatch = originalQuery.match(/\b\d{5}\b/);
  const forcedCap = capMatch && validateItalianCAP(capMatch[0])
    ? capMatch[0]
    : null;

  const normalizedQuery = originalQuery.toLowerCase();
  console.log('🔍 Ricerca indirizzi avanzata per:', normalizedQuery, 'CAP forzato:', forcedCap);

  const houseNumberMatch = originalQuery.match(/\b\d+[A-Za-z/-]?\b/);
  const inputHouseNumber = houseNumberMatch ? houseNumberMatch[0].trim() : '';

  // Controlla cache
  const cacheKey = `search_${normalizedQuery}`;
  const cached = addressCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log('✅ Risultati recuperati dalla cache:', cached.results.length);
    return cached.results;
  }

  try {
    // Strategia 1: Ricerca locale nelle vie principali
    const localResults = searchInLocalDatabase(normalizedQuery);
    console.log('📚 Risultati locali:', localResults.length);
    
    // Strategia 2: Ricerca tramite API multiple in parallelo
    const apiPromises = [];
    
    apiPromises.push(searchViaBackend(originalQuery, signal));
    
    // Esegui tutte le ricerche in parallelo
    const apiResults = await Promise.allSettled(apiPromises);
    
    // Combina e deduplicare i risultati
    let allResults = [...localResults];
    
    apiResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        console.log(`🌐 API ${index} risultati:`, result.value.length);
        allResults = allResults.concat(result.value);
      } else {
        console.warn(`❌ API ${index} fallita:`, result.reason?.message);
      }
    });
    
    // Deduplicazione e ordinamento intelligente
    let deduplicatedResults = deduplicateAndRank(allResults, normalizedQuery);

    if (forcedCap) {
      deduplicatedResults = deduplicatedResults.map(result => {
        if (!result.postcode) {
          return { ...result, postcode: forcedCap };
        }
        return result;
      });
    }

    if (inputHouseNumber && deduplicatedResults.length > 0) {
      deduplicatedResults = deduplicatedResults.map((result, index) => {
        if (index > 0 && result.housenumber) {
          return result;
        }
        const currentHouseNumber =
          (result.housenumber && String(result.housenumber).trim()) || '';
        const houseNumberToUse =
          currentHouseNumber || inputHouseNumber;
        if (!houseNumberToUse) {
          return result;
        }
        let display = result.display || result.street || '';
        if (
          display &&
          !display.toLowerCase().includes(houseNumberToUse.toLowerCase())
        ) {
          display = `${display} ${houseNumberToUse}`;
        }
        return {
          ...result,
          display,
          housenumber: houseNumberToUse
        };
      });
    }

    if (deduplicatedResults.length === 0) {
      const fallbackResult = buildFallbackResult(originalQuery, forcedCap);
      deduplicatedResults = [fallbackResult];
    }

    const finalResults = deduplicatedResults.slice(0, 10);
    
    // Salva in cache
    addressCache.set(cacheKey, {
      results: finalResults,
      timestamp: Date.now()
    });
    
    console.log(`✅ Trovati ${finalResults.length} indirizzi da ${apiResults.length + 1} fonti`);
    
    // Verifica che i risultati abbiano le proprietà necessarie
    finalResults.forEach((result, index) => {
      if (!result.city && !result.display) {
        console.warn(`⚠️ Risultato ${index} senza city o display:`, result);
      }
    });
    
    return finalResults;
    
  } catch (error) {
    console.error('❌ Errore nella ricerca indirizzi:', error);
    const localResults = searchInLocalDatabase(normalizedQuery);
    if (localResults.length > 0) {
      return localResults;
    }
    const fallbackResult = buildFallbackResult(originalQuery, forcedCap);
    return [fallbackResult];
  }
};

/**
 * Ricerca nel database locale delle vie principali
 */
function searchInLocalDatabase(query) {
  const results = [];
  const queryLower = query.toLowerCase();
  
  // Cerca in tutte le città
  Object.entries(MAJOR_ITALIAN_STREETS).forEach(([city, streets]) => {
    streets.forEach(street => {
      if (street.toLowerCase().includes(queryLower)) {
        // Genera un risultato locale
        results.push({
          display: `${street}, ${city}, Italia`,
          street: street,
          city: city,
          country: 'Italia',
          source: 'local',
          confidence: calculateLocalConfidence(street, queryLower),
          // Coordinate approssimative per le principali città
          lat: getCityCoordinates(city).lat,
          lon: getCityCoordinates(city).lon,
          postcode: '', // Sarà popolato successivamente
          housenumber: ''
        });
      }
    });
  });
  
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Ricerca indirizzi tramite Nominatim + Photon, proxata dal nostro backend
 * (/api/geocode/search) invece di chiamare le due API direttamente dal
 * browser. Chiamandole direttamente dal browser, Nominatim rispondeva spesso
 * con un generico "Network Error" (la loro policy di fair-use scoraggia
 * l'uso client-side massivo senza uno User-Agent identificativo) e Photon
 * con 400 in modo non deterministico — entrambi i problemi spariscono
 * chiamando da server-to-server, dove possiamo impostare gli header
 * corretti e non siamo soggetti a CORS.
 */
export async function searchViaBackend(query, signal) {
  if (!API_BASE_URL) return [];
  try {
    const response = await axios.get(`${API_BASE_URL}/geocode/search`, {
      params: { q: query },
      timeout: 6000,
      signal
    });
    return Array.isArray(response.data?.results) ? response.data.results : [];
  } catch (error) {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      // Richiesta annullata perché l'utente ha continuato a scrivere: non è
      // un errore reale, non deve produrre un fallback silenzioso.
      throw error;
    }
    console.warn('Backend geocode/search fallito:', error.message);
    return [];
  }
}

/**
 * Deduplica e ordina i risultati per rilevanza
 */
function deduplicateAndRank(results) {
  // Rimuovi duplicati basati su vicinanza geografica e nome
  const unique = [];
  const tolerance = 0.001; // ~100m
  
  results.forEach(result => {
    const isDuplicate = unique.some(existing => {
      const distLat = Math.abs(existing.lat - result.lat);
      const distLon = Math.abs(existing.lon - result.lon);
      const nameMatch = existing.street === result.street && existing.city === result.city;
      
      return (distLat < tolerance && distLon < tolerance) || nameMatch;
    });
    
    if (!isDuplicate) {
      unique.push(result);
    }
  });
  
  // Ordina per confidence score
  return unique.sort((a, b) => {
    // Priorità: local > nominatim > photon
    const sourceWeight = { local: 3, nominatim: 2, photon: 1 };
    const aWeight = (sourceWeight[a.source] || 0) + (a.confidence || 0);
    const bWeight = (sourceWeight[b.source] || 0) + (b.confidence || 0);
    
    return bWeight - aWeight;
  });
}

function buildFallbackResult(query, cap) {
  // Il chiamante (es. AddressLanding) aggiunge sempre ", Italia" in coda
  // alla query prima di cercare: se questo fallback "grezzo" scatta (nessun
  // risultato reale da Nominatim/Photon) e l'utente non aveva scritto una
  // sua virgola prima del comune (es. "Corso Umberto 1 Anzano di Puglia",
  // tutto attaccato), lo split ingenuo sulla virgola finiva per interpretare
  // il nostro stesso ", Italia" come comune. Lo rimuoviamo prima di provare
  // a separare via e comune.
  const withoutCountrySuffix = query.replace(/,?\s*italia\s*$/i, '').trim();
  const parts = withoutCountrySuffix.split(',').map((p) => p.trim()).filter(Boolean);
  const streetPart = parts[0] || withoutCountrySuffix;
  // Con più di una virgola residua (es. "Via Roma, Anzano di Puglia") l'ultima
  // parte è quasi sempre il comune. Senza virgole (tutto attaccato) non
  // possiamo separare via e comune in modo affidabile: meglio lasciare il
  // comune vuoto che riportarne uno sbagliato.
  const cityPart = parts.length > 1 ? parts[parts.length - 1] : '';

  return {
    display: withoutCountrySuffix || query.trim(),
    street: streetPart,
    housenumber: '',
    city: cityPart,
    postcode: cap || '',
    state: '',
    country: 'Italia',
    lat: null,
    lon: null,
    source: 'raw-input',
    confidence: 0.4
  };
}

/**
 * Calcola il confidence score per i risultati locali
 */
function calculateLocalConfidence(street, query) {
  const streetLower = street.toLowerCase();
  
  if (streetLower === query) return 1.0;
  if (streetLower.startsWith(query)) return 0.9;
  if (streetLower.includes(query)) return 0.7;
  
  // Fuzzy matching semplice
  const words = query.split(' ');
  const matchingWords = words.filter(word => streetLower.includes(word));
  return matchingWords.length / words.length * 0.6;
}

/**
 * Ottiene coordinate approssimative delle principali città
 */
function getCityCoordinates(city) {
  const coords = {
    'Roma': { lat: 41.9028, lon: 12.4964 },
    'Milano': { lat: 45.4642, lon: 9.1900 },
    'Napoli': { lat: 40.8518, lon: 14.2681 },
    'Torino': { lat: 45.0703, lon: 7.6869 },
    'Bologna': { lat: 44.4949, lon: 11.3426 },
    'Firenze': { lat: 43.7696, lon: 11.2558 },
    'Genova': { lat: 44.4056, lon: 8.9463 },
    'Bari': { lat: 41.1171, lon: 16.8719 },
    'Palermo': { lat: 38.1157, lon: 13.3615 },
    'Catania': { lat: 37.5079, lon: 15.0830 }
  };
  
  return coords[city] || { lat: 41.9028, lon: 12.4964 }; // Default Roma
}

/**
 * Verifica e arricchisce un indirizzo con informazioni CAP
 * @param {Object} address - Indirizzo da verificare
 * @returns {Promise<Object>} - Indirizzo arricchito
 */
export const enrichAddressWithCAP = async (address) => {
  if (!address.postcode && address.lat && address.lon && API_BASE_URL) {
    try {
      // Reverse geocoding per ottenere il CAP, proxato dal backend (vedi
      // searchViaBackend sopra per il motivo: Nominatim chiamato
      // direttamente dal browser falliva spesso con "Network Error").
      const response = await axios.get(`${API_BASE_URL}/geocode/reverse`, {
        params: { lat: address.lat, lon: address.lon },
        timeout: 4000
      });

      if (response.data?.address?.postcode) {
        address.postcode = response.data.address.postcode;
        address.cap = response.data.address.postcode;
      }
    } catch (error) {
      console.warn('Errore nel reverse geocoding:', error.message);
    }
  }

  if (!address.postcode && address.city) {
    const cityKey = String(address.city).toLowerCase().trim();
    const overrideCap = CITY_CAP_OVERRIDES[cityKey];
    if (overrideCap) {
      console.log('✅ CAP imposto da CITY_CAP_OVERRIDES:', cityKey, overrideCap);
      address.postcode = overrideCap;
      address.cap = overrideCap;
    }
  }
  
  // Valida il CAP se presente
  if (address.postcode || address.cap) {
    const cap = address.postcode || address.cap;
    if (validateItalianCAP(cap)) {
      const capInfo = getCAPInfo(cap);
      if (capInfo) {
        address.cap = cap;
        address.comune = capInfo.comune;
        address.provincia = capInfo.provincia;
        address.regione = capInfo.regione;
        address.zona_omi = capInfo.zona;
        address.cap_valid = true;
      }
    } else {
      address.cap_valid = false;
    }
  }
  
  return address;
};

/**
 * Cerca coordinate precise per un indirizzo completo
 * @param {Object} address - Indirizzo con numero civico
 * @returns {Promise<Object>} - Indirizzo con coordinate aggiornate
 */
export const findPreciseCoordinates = async (address) => {
  if (!address.street || !address.housenumber || !API_BASE_URL) {
    return address;
  }

  const fullAddress = `${address.street} ${address.housenumber}, ${address.city || ''}, Italia`;

  try {
    // Proxato dal backend, stesso motivo di searchViaBackend sopra.
    const results = await searchViaBackend(fullAddress);
    if (results.length > 0) {
      const result = results[0];
      if (result.lat != null && result.lon != null) {
        address.lat = result.lat;
        address.lon = result.lon;
        address.precision = 'exact';
      }
      if (result.postcode) {
        address.postcode = result.postcode;
        address.cap = result.postcode;
      }
    }
  } catch (error) {
    console.warn('Errore nella ricerca coordinate precise:', error.message);
    address.precision = 'approximate';
  }

  return address;
};

export default {
  searchAddresses,
  enrichAddressWithCAP,
  findPreciseCoordinates,
  searchViaBackend
};
