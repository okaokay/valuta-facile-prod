/**
 * Servizio per l'analisi delle planimetrie
 * Simula l'analisi di planimetrie caricate
 */

/**
 * Applica i risultati dell'analisi della planimetria ai parametri dell'immobile
 * @param {Object} analysisResult - Risultati dell'analisi
 * @param {Object} propertyParams - Parametri attuali dell'immobile
 * @returns {Object} - Parametri aggiornati
 */
export const applyPlanimetryAnalysis = (analysisResult, propertyParams) => {
  if (!analysisResult) return propertyParams;
  
  // Copia i parametri originali
  const updatedParams = { ...propertyParams };
  
  // Applica il fattore di aggiustamento
  if (analysisResult.adjustmentFactor) {
    updatedParams.planimetryAdjustment = analysisResult.adjustmentFactor;
  }
  
  // Aggiorna le superfici se sono state rilevate dall'analisi
  if (analysisResult.details) {
    if (analysisResult.details.livingArea && analysisResult.details.livingArea > 0) {
      updatedParams.superficie = analysisResult.details.livingArea;
    }
    
    if (analysisResult.details.balconyArea && analysisResult.details.balconyArea > 0) {
      updatedParams.mqBalconi = analysisResult.details.balconyArea;
    }
    
    if (analysisResult.details.terraceArea && analysisResult.details.terraceArea > 0) {
      updatedParams.mqTerrazzi = analysisResult.details.terraceArea;
    }
  }
  
  return updatedParams;
};

/**
 * Analizza una planimetria caricata (simulazione)
 * @param {File} file - File della planimetria
 * @returns {Promise<Object>} - Risultati dell'analisi
 */
export const analyzePlanimetry = async (file) => {
  // Simulazione di un'analisi che richiede tempo
  console.log('🗺️ Analisi planimetria (simulazione), file ricevuto:', file);
  return new Promise((resolve) => {
    setTimeout(() => {
      // Genera risultati simulati
      const results = {
        success: true,
        adjustmentFactor: randomAdjustmentFactor(),
        details: {
          layout: randomLayout(),
          lightExposure: randomExposure(),
          roomDistribution: randomDistribution(),
          accessibilityScore: Math.floor(Math.random() * 5) + 1,
          // Superfici rilevate (opzionali)
          livingArea: null,
          balconyArea: null,
          terraceArea: null
        }
      };
      
      resolve(results);
    }, 2000); // Simula 2 secondi di elaborazione
  });
};

// Funzioni helper per generare dati casuali simulati

function randomAdjustmentFactor() {
  // Genera un fattore tra 0.9 e 1.1
  return 0.9 + Math.random() * 0.2;
}

function randomLayout() {
  const layouts = [
    'Ottimale',
    'Buono',
    'Standard',
    'Migliorabile',
    'Irregolare'
  ];
  return layouts[Math.floor(Math.random() * layouts.length)];
}

function randomExposure() {
  const exposures = [
    'Ottima (multipla)',
    'Buona (est-ovest)',
    'Media (sud)',
    'Limitata (nord)'
  ];
  return exposures[Math.floor(Math.random() * exposures.length)];
}

function randomDistribution() {
  const distributions = [
    'Ottimale',
    'Bilanciata',
    'Standard',
    'Migliorabile'
  ];
  return distributions[Math.floor(Math.random() * distributions.length)];
}

export default {
  applyPlanimetryAnalysis,
  analyzePlanimetry
};
