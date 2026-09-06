/**
 * Servizio per integrazione con Groq AI
 * Utilizza l'AI per analizzare dati OMI e fornire valutazioni immobiliari intelligenti
 */

class GroqService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || null;
    this.baseURL = 'https://api.groq.com/openai/v1';
    this.model = 'llama3-8b-8192'; // Modello Groq più adatto per analisi dati
  }

  /**
   * Analizza i dati OMI con AI per fornire una valutazione intelligente
   */
  async analyzePropertyWithOMI(propertyData, omiZoneData, marketContext = {}) {
    try {
      console.log('🤖 Analisi proprietà con Groq AI...');
      
      if (!this.apiKey) {
        console.warn('⚠️ Groq API Key non configurata, uso valutazione fallback');
        return this.getFallbackAnalysis(propertyData, omiZoneData);
      }

      const prompt = this.buildAnalysisPrompt(propertyData, omiZoneData, marketContext);
      
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `Sei un esperto valutatore immobiliare italiano con accesso ai dati OMI ufficiali. 
              Analizza le proprietà considerando:
              - Dati OMI ufficiali (Osservatorio del Mercato Immobiliare)
              - Caratteristiche specifiche dell'immobile
              - Contesto di mercato locale
              - Tendenze di zona
              
              Fornisci sempre valutazioni realistiche e ben motivate in formato JSON.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3, // Bassa creatività per valutazioni precise
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API Error: ${response.status}`);
      }

      const result = await response.json();
      const aiAnalysis = result.choices[0].message.content;
      
      return this.parseAIAnalysis(aiAnalysis, propertyData, omiZoneData);

    } catch (error) {
      console.error('❌ Errore Groq AI:', error);
      return this.getFallbackAnalysis(propertyData, omiZoneData);
    }
  }

  /**
   * Costruisce il prompt per l'analisi AI
   */
  buildAnalysisPrompt(propertyData, omiZoneData, marketContext) {
    return `
ANALISI VALUTAZIONE IMMOBILIARE

DATI IMMOBILE:
- Tipologia: ${propertyData.tipo || 'Residenziale'}
- Superficie: ${propertyData.superficie || 'N/D'} mq
- Locali: ${propertyData.locali || 'N/D'}
- Piano: ${propertyData.piano || 'N/D'}
- Stato: ${propertyData.stato || 'N/D'}
- Anno costruzione: ${propertyData.annoCostruzione || 'N/D'}
- Classe energetica: ${propertyData.classeEnergetica || 'N/D'}

DATI ZONA OMI UFFICIALI:
- Comune: ${omiZoneData?.comuneName || 'N/D'}
- Codice Comune: ${omiZoneData?.codiceComune || 'N/D'}
- Zona OMI: ${omiZoneData?.zonaOMI || 'N/D'}
- Anno/Semestre: ${omiZoneData?.anno || '2024'}/${omiZoneData?.semestre || '2'}

CONTESTO MERCATO:
- Prezzi medi zona: €${marketContext.prezzoMedio || 'N/D'}/mq
- Trend mercato: ${marketContext.trend || 'Stabile'}
- Servizi zona: ${marketContext.servizi || 'Standard'}

RICHIESTA:
Fornisci una valutazione immobiliare dettagliata in formato JSON con:
{
  "valutazione": {
    "prezzoMinimo": numero,
    "prezzoMassimo": numero,
    "prezzoMedio": numero,
    "prezzoAlMetroQuadro": numero
  },
  "analisi": {
    "puntiForza": [array di stringhe],
    "puntiDebolezza": [array di stringhe],
    "fattoriPrezzo": "spiegazione dettagliata"
  },
  "raccomandazioni": {
    "venditore": "consigli per vendita",
    "acquirente": "consigli per acquisto"
  },
  "affidabilita": numero_da_1_a_10,
  "note": "considerazioni aggiuntive"
}

Basa la valutazione sui dati OMI ufficiali e sulle caratteristiche specifiche dell'immobile.
`;
  }

  /**
   * Parsa la risposta dell'AI e la struttura
   */
  parseAIAnalysis(aiResponse, propertyData, omiZoneData) {
    try {
      // Cerca il JSON nella risposta
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedAnalysis = JSON.parse(jsonMatch[0]);
        
        return {
          success: true,
          source: 'groq-ai',
          timestamp: new Date().toISOString(),
          valutazione: parsedAnalysis.valutazione || {},
          analisi: parsedAnalysis.analisi || {},
          raccomandazioni: parsedAnalysis.raccomandazioni || {},
          affidabilita: parsedAnalysis.affidabilita || 7,
          note: parsedAnalysis.note || 'Valutazione basata su AI e dati OMI ufficiali',
          datiOriginali: {
            proprieta: propertyData,
            zonaOMI: omiZoneData
          }
        };
      }
    } catch (parseError) {
      console.error('❌ Errore parsing risposta AI:', parseError);
    }

    // Se il parsing fallisce, estrai informazioni testuali
    return this.extractTextualAnalysis(aiResponse, propertyData);
  }

  /**
   * Estrae informazioni dall'analisi testuale quando il JSON parsing fallisce
   */
  extractTextualAnalysis(aiResponse, propertyData) {
    // Cerca prezzi nel testo
    const prezziMatch = aiResponse.match(/(\d{1,3}(?:\.\d{3})*)\s*[€]?/g);
    let prezzoStimato = 0;
    
    if (prezziMatch) {
      const prezzi = prezziMatch.map(p => parseInt(p.replace(/\./g, '')))
                              .filter(p => p > 50000 && p < 10000000); // Range realistico
      if (prezzi.length > 0) {
        prezzoStimato = prezzi.reduce((a, b) => a + b) / prezzi.length;
      }
    }

    return {
      success: true,
      source: 'groq-ai-textual',
      timestamp: new Date().toISOString(),
      valutazione: {
        prezzoMinimo: Math.round(prezzoStimato * 0.9),
        prezzoMassimo: Math.round(prezzoStimato * 1.1),
        prezzoMedio: Math.round(prezzoStimato),
        prezzoAlMetroQuadro: propertyData.superficie ? 
          Math.round(prezzoStimato / propertyData.superficie) : 0
      },
      analisi: {
        puntiForza: this.extractListFromText(aiResponse, /punti?\s+forza|vantaggi/i),
        puntiDebolezza: this.extractListFromText(aiResponse, /punti?\s+debolezza|svantaggi/i),
        fattoriPrezzo: 'Analisi basata su valutazione AI e dati OMI'
      },
      raccomandazioni: {
        venditore: 'Valutazione competitiva basata sui dati di mercato',
        acquirente: 'Verifica le condizioni dell\'immobile prima dell\'acquisto'
      },
      affidabilita: 7,
      note: 'Valutazione estratta da analisi AI testuale',
      testoCompleto: aiResponse
    };
  }

  /**
   * Estrae liste dal testo AI
   */
  extractListFromText(text, pattern) {
    const section = text.match(new RegExp(`${pattern.source}[:\\s]*([^\\n]*(?:\\n[^\\n]*)*?)(?=\\n\\n|$)`, 'i'));
    if (section) {
      return section[1].split(/[,;\n]/).map(item => item.trim()).filter(item => item.length > 0);
    }
    return [];
  }

  /**
   * Valutazione di fallback quando Groq AI non è disponibile
   */
  getFallbackAnalysis(propertyData, omiZoneData) {
    console.log('📊 Uso valutazione fallback (senza AI)');
    
    // Stima base sulla superficie e zona
    const superficieBase = propertyData.superficie || 80;
    const prezzoBase = this.getBasePriceForZone(omiZoneData?.zonaOMI);
    const prezzoStimato = superficieBase * prezzoBase;

    return {
      success: true,
      source: 'fallback-logic',
      timestamp: new Date().toISOString(),
      valutazione: {
        prezzoMinimo: Math.round(prezzoStimato * 0.85),
        prezzoMassimo: Math.round(prezzoStimato * 1.15),
        prezzoMedio: Math.round(prezzoStimato),
        prezzoAlMetroQuadro: prezzoBase
      },
      analisi: {
        puntiForza: ['Posizione nella zona', 'Caratteristiche standard'],
        puntiDebolezza: ['Valutazione automatica', 'Necessita verifica esperto'],
        fattoriPrezzo: 'Valutazione basata su dati OMI e caratteristiche base'
      },
      raccomandazioni: {
        venditore: 'Considera una valutazione professionale per ottimizzare il prezzo',
        acquirente: 'Verifica lo stato dell\'immobile e confronta con il mercato locale'
      },
      affidabilita: 6,
      note: 'Valutazione automatica - si consiglia consulenza professionale'
    };
  }

  /**
   * Ottieni prezzo base per zona OMI
   */
  getBasePriceForZone(zonaOMI) {
    const prezziBase = {
      'A1': 4500, 'A2': 4000, 'A3': 3500, 'A4': 3000, 'A5': 2800,
      'B1': 3200, 'B2': 2800, 'B3': 2400, 'B4': 2000, 'B5': 1800,
      'C1': 2200, 'C2': 1900, 'C3': 1600, 'C4': 1400, 'C5': 1200,
      'D1': 1800, 'D2': 1500, 'D3': 1300, 'D4': 1100, 'D5': 1000,
      'R1': 1400, 'R2': 1200, 'R3': 1000, 'R4': 900, 'R5': 800
    };

    return prezziBase[zonaOMI] || 2000; // Default se zona non trovata
  }

  /**
   * Test connessione Groq AI
   */
  async testConnection() {
    try {
      if (!this.apiKey) {
        return { success: false, error: 'API Key non configurata' };
      }

      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return { 
          success: true, 
          models: data.data?.length || 0,
          message: 'Connessione Groq AI attiva'
        };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default GroqService;
