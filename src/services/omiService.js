/**
 * Servizio OMI MIGLIORATO - NESSUN ERRORE CAP GARANTITO
 * Utilizza il nuovo servizio OMI reale con fallback che funziona SEMPRE
 */
import { getRealOmiValues, getCAPInfo } from './realOmiService.js';

/**
 * Recupera i valori OMI con priorità ai dati reali - NON FALLISCE MAI
 * @param {string} cap - Codice di Avviamento Postale
 * @returns {Promise<Object>} - Valori OMI completi e affidabili
 */
export const getOmiValues = async (cap) => {
  console.log('🏠 Servizio OMI MIGLIORATO - Ricerca per CAP:', cap);
  
  try {
    // Validazione CAP base (solo formato)
    if (!cap || cap === 'N/A' || !/^\d{5}$/.test(cap)) {
      console.warn('⚠️ Formato CAP non valido o mancante:', cap);
      // Anche con formato sbagliato, proviamo comunque
      if (cap && cap.length >= 2) {
        return await getFallbackOmiValuesForced(cap);
      } else {
        // Se CAP completamente mancante, usiamo un fallback generico
        return await getFallbackOmiValuesForced('00100'); // Default Roma
      }
    }
    
    // Strategia 1: Utilizza il servizio OMI reale (NON fallisce mai)
    try {
      const realData = await getRealOmiValues(cap);
      console.log('✅ Dati OMI REALI ottenuti:', realData);
      return realData;
    } catch (realError) {
      console.warn('⚠️ Servizio OMI reale fallito, uso fallback esteso:', realError.message);
      
      // Strategia 2: Fallback esteso che funziona SEMPRE
      return await getFallbackOmiValuesForced(cap);
    }
    
  } catch (error) {
    console.error('❌ Errore generale servizio OMI:', error);
    
    // Fallback finale - GARANTITO che non fallisce mai
    return {
      min: 1200,
      avg: 1600,
      max: 2000,
      zona: 'Semicentrale',
      tipologia: 'Abitazioni civili',
      semestre: '2',
      anno: '2024',
      comune: 'N/A',
      provincia: 'N/A',
      regione: 'Italia',
      reliability: 'STIMA_NAZIONALE'
    };
  }
};

/**
 * Fallback forzato che NON può fallire - funziona per TUTTI i CAP italiani
 * @param {string} cap - Codice di Avviamento Postale
 * @returns {Promise<Object>} - Valori OMI stimati GARANTITI
 */
export const getFallbackOmiValuesForced = async (cap) => {
  console.log('🔄 Fallback FORZATO per CAP:', cap);
  
  try {
    // Usa il sistema avanzato di inferenza geografica
    const capInfo = getCAPInfo(cap);
    
    // Ottieni prezzi basati sulla regione inferita
    const regionalData = getRegionalOMIData(capInfo.regione, capInfo.zona);
    
    return {
      min: regionalData.min,
      avg: regionalData.avg,
      max: regionalData.max,
      zona: capInfo.zona,
      tipologia: 'Abitazioni civili',
      semestre: '2',
      anno: '2024',
      comune: capInfo.comune,
      provincia: capInfo.provincia,
      regione: capInfo.regione,
      reliability: 'STIMATO_REGIONALE'
    };
    
  } catch (error) {
    console.warn('⚠️ Anche il fallback forzato ha avuto problemi, uso valori nazionali');
    
    // Ultimo fallback basato solo sui primi 2 numeri del CAP
    const prefix = cap.substring(0, 2);
    const regionFromPrefix = inferRegionFromPrefix(prefix);
    
    return {
      min: 1200,
      avg: 1600,
      max: 2000,
      zona: 'Semicentrale',
      tipologia: 'Abitazioni civili',
      semestre: '2',
      anno: '2024',
      comune: regionFromPrefix.comune || 'N/A',
      provincia: regionFromPrefix.provincia || 'N/A',
      regione: regionFromPrefix.regione || 'Italia',
      reliability: 'STIMA_NAZIONALE'
    };
  }
};

/**
 * Database regionale dei prezzi OMI per fallback
 */
function getRegionalOMIData(regione, zona) {
  const regionalPrices = {
    'Lombardia': { base: 4000, min: 3200, max: 4800 },
    'Lazio': { base: 3800, min: 3000, max: 4600 },
    'Toscana': { base: 3000, min: 2400, max: 3600 },
    'Emilia-Romagna': { base: 2600, min: 2100, max: 3100 },
    'Veneto': { base: 2400, min: 1900, max: 2900 },
    'Piemonte': { base: 2200, min: 1800, max: 2600 },
    'Liguria': { base: 2500, min: 2000, max: 3000 },
    'Campania': { base: 2200, min: 1800, max: 2600 },
    'Puglia': { base: 1400, min: 900, max: 1800 },
    'Sicilia': { base: 1700, min: 1400, max: 2000 },
    'Calabria': { base: 1400, min: 1100, max: 1700 },
    'Sardegna': { base: 1600, min: 1300, max: 1900 },
    'Abruzzo': { base: 1600, min: 1300, max: 1900 },
    'Marche': { base: 1900, min: 1500, max: 2300 },
    'Umbria': { base: 1800, min: 1400, max: 2200 },
    'Basilicata': { base: 1300, min: 1000, max: 1600 },
    'Molise': { base: 1200, min: 900, max: 1500 },
    'Friuli-Venezia Giulia': { base: 2100, min: 1700, max: 2500 },
    'Trentino-Alto Adige': { base: 3000, min: 2400, max: 3600 },
    'Valle d\'Aosta': { base: 2600, min: 2100, max: 3100 }
  };
  
  const regionData = regionalPrices[regione] || regionalPrices['Abruzzo']; // Default Abruzzo per CAP mancanti
  
  // Modifica i prezzi in base alla zona
  const zoneMultipliers = {
    'Centrale': 1.2,
    'Semicentrale': 1.0,
    'Periferica': 0.8,
    'Rurale': 0.7
  };
  
  const multiplier = zoneMultipliers[zona] || 1.0;
  
  return {
    min: Math.round(regionData.min * multiplier),
    avg: Math.round(regionData.base * multiplier),
    max: Math.round(regionData.max * multiplier)
  };
}

/**
 * Inferisce regione dal prefisso CAP
 */
function inferRegionFromPrefix(prefix) {
  const prefixMapping = {
    '00': { regione: 'Lazio', provincia: 'RM', comune: 'Roma', zona: 'Semicentrale' },
    '20': { regione: 'Lombardia', provincia: 'MI', comune: 'Milano', zona: 'Semicentrale' },
    '65': { regione: 'Abruzzo', provincia: 'PE', comune: 'Pescara', zona: 'Centrale' },
    '80': { regione: 'Campania', provincia: 'NA', comune: 'Napoli', zona: 'Semicentrale' },
    '90': { regione: 'Sicilia', provincia: 'PA', comune: 'Palermo', zona: 'Semicentrale' },
    '50': { regione: 'Toscana', provincia: 'FI', comune: 'Firenze', zona: 'Semicentrale' },
    '40': { regione: 'Emilia-Romagna', provincia: 'BO', comune: 'Bologna', zona: 'Semicentrale' },
    '30': { regione: 'Veneto', provincia: 'VE', comune: 'Venezia', zona: 'Semicentrale' },
    '10': { regione: 'Piemonte', provincia: 'TO', comune: 'Torino', zona: 'Semicentrale' },
    '16': { regione: 'Liguria', provincia: 'GE', comune: 'Genova', zona: 'Semicentrale' },
    '70': { regione: 'Puglia', provincia: 'BA', comune: 'Bari', zona: 'Semicentrale' },
    '71': { regione: 'Puglia', provincia: 'FG', comune: 'Foggia', zona: 'Rurale' },
    '60': { regione: 'Marche', provincia: 'AN', comune: 'Ancona', zona: 'Semicentrale' },
    '06': { regione: 'Umbria', provincia: 'PG', comune: 'Perugia', zona: 'Semicentrale' },
    '38': { regione: 'Trentino-Alto Adige', provincia: 'TN', comune: 'Trento', zona: 'Semicentrale' },
    '33': { regione: 'Friuli-Venezia Giulia', provincia: 'UD', comune: 'Udine', zona: 'Semicentrale' },
    '11': { regione: "Valle d'Aosta", provincia: 'AO', comune: 'Aosta', zona: 'Semicentrale' },
    '09': { regione: 'Sardegna', provincia: 'CA', comune: 'Cagliari', zona: 'Semicentrale' },
    '85': { regione: 'Basilicata', provincia: 'PZ', comune: 'Potenza', zona: 'Semicentrale' },
    '88': { regione: 'Calabria', provincia: 'CZ', comune: 'Catanzaro', zona: 'Semicentrale' },
    '86': { regione: 'Molise', provincia: 'CB', comune: 'Campobasso', zona: 'Semicentrale' }
  };
  
  return prefixMapping[prefix] || {
    regione: 'Italia',
    provincia: 'N/A',
    comune: 'N/A',
    zona: 'Semicentrale'
  };
}

/**
 * Funzione di fallback originale mantenuta per compatibilità
 */
export const getFallbackOmiValues = (cap) => {
  console.log('🔄 Fallback OMI classico per CAP:', cap);
  return getFallbackOmiValuesForced(cap);
};

/**
 * Ottiene informazioni complete su un CAP
 */
export const getCapInfo = (cap) => {
  try {
    return getCAPInfo(cap);
  } catch (error) {
    // Fallback anche per le info CAP
    const prefix = cap.substring(0, 2);
    const info = inferRegionFromPrefix(prefix);
    return {
      comune: info.comune,
      provincia: info.provincia,
      regione: info.regione,
      zona: info.zona || 'Semicentrale'
    };
  }
};

export default {
  getOmiValues,
  getFallbackOmiValues,
  getFallbackOmiValuesForced,
  getCapInfo
};
