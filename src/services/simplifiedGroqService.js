/**
 * Servizio Groq AI semplificato per valutazioni immobiliari
 * Funziona senza parsing di file KML, utilizzando solo i dati inseriti dall'utente
 */

class SimplifiedGroqService {
  constructor() {
    this.baseURL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
  }

  async getPropertyValuation(address, propertyData) {
    try {
      const response = await fetch(`${this.baseURL}/ai/valuation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, propertyData })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn('AI valuation backend non disponibile, uso fallback:', error.message);
      return this.getFallbackValuation(address, propertyData);
    }
  }

  /**
   * Costruisce il prompt per la valutazione
   */
  buildValuationPrompt(address, propertyData) {
    const city = address.city || 'Non specificata';
    const fullAddress = address.display || `${address.street || ''} ${address.housenumber || ''}, ${city}`;
    
    return `
VALUTAZIONE IMMOBILIARE

INDIRIZZO:
${fullAddress}
Città: ${city}
CAP: ${address.postcode || 'N/D'}

CARATTERISTICHE IMMOBILE:
- Superficie: ${propertyData.livingArea || propertyData.superficie || 'N/D'} mq
- Locali: ${propertyData.rooms || propertyData.locali || 'N/D'}
- Bagni: ${propertyData.bathrooms || propertyData.bagni || 'N/D'}
- Piano: ${propertyData.floor || propertyData.piano || 'N/D'}
- Stato: ${propertyData.condition || propertyData.stato || 'N/D'}
- Ascensore: ${propertyData.hasElevator ? 'Sì' : 'No'}
- Anno costruzione: ${propertyData.yearBuilt || propertyData.annoCostruzione || 'N/D'}

RICHIESTA:
Fornisci una valutazione immobiliare realistica per questa proprietà in formato JSON:

{
  "valutazione": {
    "prezzoMinimo": numero_in_euro,
    "prezzoMassimo": numero_in_euro, 
    "prezzoMedio": numero_in_euro,
    "prezzoAlMetroQuadro": numero_in_euro
  },
  "analisi": {
    "puntiForza": ["punto1", "punto2"],
    "puntiDebolezza": ["punto1", "punto2"],
    "motivazione": "spiegazione_dettagliata"
  },
  "raccomandazioni": {
    "venditore": "consiglio_per_vendita",
    "acquirente": "consiglio_per_acquisto"
  },
  "affidabilita": numero_da_1_a_10,
  "note": "considerazioni_aggiuntive"
}

Basa la valutazione sui prezzi di mercato reali per ${city} e le caratteristiche specifiche dell'immobile.
`;
  }

  /**
   * Parsa la risposta AI
   */
  parseAIResponse(aiResponse, address, propertyData) {
    try {
      // Cerca il JSON nella risposta
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedData = JSON.parse(jsonMatch[0]);
        
        return {
          success: true,
          source: 'groq-ai',
          timestamp: new Date().toISOString(),
          valutazione: parsedData.valutazione || {},
          analisiAI: {
            puntiForza: parsedData.analisi?.puntiForza || [],
            puntiDebolezza: parsedData.analisi?.puntiDebolezza || [],
            raccomandazioni: parsedData.raccomandazioni || {},
            affidabilita: parsedData.affidabilita || 8
          },
          metadati: {
            metodologia: 'Valutazione AI basata su dati di mercato',
            fonti: ['Groq AI', 'Prezzi mercato immobiliare 2024'],
            limitazioni: [],
            dataValutazione: new Date().toISOString().split('T')[0]
          },
          note: parsedData.note || 'Valutazione basata su analisi AI e dati di mercato',
          testoCompleto: aiResponse
        };
      }
    } catch (parseError) {
      console.error('❌ Errore parsing risposta AI:', parseError);
    }

    // Fallback: estrazione dati dalla risposta testuale
    return this.extractFromText(aiResponse, address, propertyData);
  }

  /**
   * Estrae dati dalla risposta testuale
   */
  extractFromText(aiResponse, address, propertyData) {
    // Cerca prezzi nel testo
    const prezziMatch = aiResponse.match(/(\d{1,3}(?:\.\d{3})*)\s*[€]?/g);
    let prezzoStimato = 0;
    
    if (prezziMatch) {
      const prezzi = prezziMatch.map(p => parseInt(p.replace(/\./g, '')))
                              .filter(p => p > 50000 && p < 5000000);
      if (prezzi.length > 0) {
        prezzoStimato = prezzi.reduce((a, b) => a + b) / prezzi.length;
      }
    }

    // Se non trova prezzi, stima in base alla città
    if (prezzoStimato === 0) {
      prezzoStimato = this.estimateByCity(address.city, propertyData.livingArea || 80);
    }

    return {
      success: true,
      source: 'groq-ai-textual',
      timestamp: new Date().toISOString(),
      valutazione: {
        prezzoMinimo: Math.round(prezzoStimato * 0.9),
        prezzoMassimo: Math.round(prezzoStimato * 1.1),
        prezzoMedio: Math.round(prezzoStimato),
        prezzoAlMetroQuadro: Math.round(prezzoStimato / (propertyData.livingArea || 80))
      },
      analisiAI: {
        puntiForza: ['Valutazione AI personalizzata', 'Analisi di mercato aggiornata'],
        puntiDebolezza: ['Necessaria verifica locale'],
        raccomandazioni: {
          venditore: 'Considera il posizionamento di mercato locale',
          acquirente: 'Verifica le condizioni dell\'immobile di persona'
        },
        affidabilita: 7
      },
      metadati: {
        metodologia: 'Analisi AI testuale + stima per città',
        fonti: ['Groq AI'],
        limitazioni: ['Parsing JSON fallito - usata estrazione testuale'],
        dataValutazione: new Date().toISOString().split('T')[0]
      },
      note: 'Valutazione estratta da analisi AI testuale',
      testoCompleto: aiResponse
    };
  }

  /**
   * Stima prezzo base per città
   */
  estimateByCity(city, superficie) {
    if (!city) return 160000; // Default

    const prezziCitta = {
      'milano': 5000,
      'roma': 4000,
      'napoli': 2500,
      'torino': 3000,
      'firenze': 4500,
      'bologna': 3500,
      'venezia': 4800,
      'genova': 2800,
      'pescara': 2200,
      'bari': 2000,
      'palermo': 1700,
      'catania': 1500,
      'verona': 3200,
      'padova': 2800,
      'trieste': 2600
    };

    const prezzoMq = prezziCitta[city.toLowerCase()] || 2000;
    return superficie * prezzoMq;
  }

  /**
   * Valutazione di fallback
   */
  getFallbackValuation(address, propertyData) {
    console.log('📊 Uso valutazione fallback');
    
    const superficie = propertyData.livingArea || propertyData.superficie || 80;
    const prezzoStimato = this.estimateByCity(address.city, superficie);

    return {
      success: true,
      source: 'fallback-city-based',
      timestamp: new Date().toISOString(),
      valutazione: {
        prezzoMinimo: Math.round(prezzoStimato * 0.85),
        prezzoMassimo: Math.round(prezzoStimato * 1.15),
        prezzoMedio: Math.round(prezzoStimato),
        prezzoAlMetroQuadro: Math.round(prezzoStimato / superficie)
      },
      analisiAI: {
        puntiForza: ['Posizione nella zona', 'Caratteristiche standard'],
        puntiDebolezza: ['Valutazione automatica', 'Necessaria verifica esperto'],
        raccomandazioni: {
          venditore: 'Considera una valutazione professionale dettagliata',
          acquirente: 'Verifica stato immobile e confronta prezzi locali'
        },
        affidabilita: 6
      },
      metadati: {
        metodologia: 'Stima automatica basata su città',
        fonti: ['Database prezzi interni'],
        limitazioni: ['AI non disponibile', 'Stima generica per città'],
        dataValutazione: new Date().toISOString().split('T')[0]
      },
      note: 'Valutazione automatica - consigliata consulenza professionale'
    };
  }

}

export default SimplifiedGroqService;
