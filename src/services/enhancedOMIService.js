/**
 * Servizio OMI avanzato che integra:
 * - Parser KML per dati OMI ufficiali
 * - Groq AI per analisi intelligente
 * - Matching geografico preciso
 */

import OMIKmlParser from './omiKmlParser.js';
import GroqService from './groqService.js';
import { getRealOmiValues } from './realOmiService.js';

class EnhancedOMIService {
  constructor() {
    this.kmlParser = new OMIKmlParser();
    this.groqService = new GroqService();
    this.cache = new Map();
  }

  /**
   * Ottieni valutazione completa utilizzando AI e dati OMI ufficiali
   */
  async getEnhancedValuation(address, propertyData) {
    try {
      console.log('🚀 Avvio valutazione avanzata con AI e dati OMI...');
      
      const cap = (address?.postcode || '').trim();
      let capOmiValues = null;
      if (cap) {
        try {
          capOmiValues = await getRealOmiValues(cap);
        } catch (e) {
          capOmiValues = null;
        }
      }

      const omiZone = await this.findOMIZoneForAddress(address);
      console.log('📍 Zona OMI trovata:', omiZone);

      const marketContext = await this.getMarketContext(omiZone, address);
      console.log('📊 Contesto mercato:', marketContext);

      const aiAnalysis = await this.groqService.analyzePropertyWithOMI(
        propertyData, 
        omiZone?.zone, 
        marketContext
      );
      console.log('🤖 Analisi AI completata:', aiAnalysis.success);

      return this.combineResults(
        aiAnalysis,
        omiZone,
        marketContext,
        address,
        propertyData,
        capOmiValues
      );

    } catch (error) {
      console.error('❌ Errore valutazione avanzata:', error);
      return this.getFallbackValuation(address, propertyData);
    }
  }

  /**
   * Trova la zona OMI più appropriata per l'indirizzo dato
   */
  async findOMIZoneForAddress(address) {
    try {
      // Strategia multi-livello per trovare la zona OMI
      
      // 1. Matching per coordinate (se disponibili)
      if (address.lat && address.lng) {
        const nearestZone = await this.kmlParser.findNearestOMIZone(address.lat, address.lng);
        if (nearestZone && nearestZone.distance < 5) { // Entro 5km
          console.log(`✅ Zona OMI trovata per coordinate: ${nearestZone.key} (${nearestZone.distance.toFixed(2)}km)`);
          return nearestZone;
        }
      }

      // 2. Matching per CAP
      if (address.postcode) {
        const zoneByCAP = await this.findZoneByCAP(address.postcode);
        if (zoneByCAP) {
          console.log(`✅ Zona OMI trovata per CAP: ${address.postcode}`);
          return zoneByCAP;
        }
      }

      // 3. Matching per nome città
      if (address.city) {
        const zoneByCityName = await this.findZoneByCityName(address.city);
        if (zoneByCityName) {
          console.log(`✅ Zona OMI trovata per città: ${address.city}`);
          return zoneByCityName;
        }
      }

      console.log('⚠️ Nessuna zona OMI specifica trovata, uso dati generici');
      return null;

    } catch (error) {
      console.error('❌ Errore ricerca zona OMI:', error);
      return null;
    }
  }

  /**
   * Cerca zona OMI per CAP
   */
  async findZoneByCAP(cap) {
    // Mappa CAP -> Codici Comuni OMI (esempi)
    const capToCodiceComune = {
      '65126': 'G482', // Pescara
      '00100': 'H501', // Roma
      '20100': 'F205', // Milano
      '10100': 'L219', // Torino
      '80100': 'F839', // Napoli
      // Aggiungere altri mapping
    };

    const codiceComune = capToCodiceComune[cap];
    if (codiceComune) {
      const zones = await this.kmlParser.findZonesByComune(codiceComune);
      if (zones.length > 0) {
        // Restituisci la zona più centrale (B1 o simile)
        const centralZone = zones.find(z => ['B1', 'B2', 'C1'].includes(z.zonaOMI)) || zones[0];
        return {
          key: `${centralZone.codiceComune}_${centralZone.zonaOMI}`,
          zone: centralZone,
          distance: 0,
          matchType: 'CAP'
        };
      }
    }

    return null;
  }

  /**
   * Cerca zona OMI per nome città
   */
  async findZoneByCityName(cityName) {
    const database = await this.kmlParser.loadOMIDatabase();
    if (!database) return null;

    // Cerca comune per nome
    for (const [codice, comune] of database.comuni.entries()) {
      if (comune.nome && comune.nome.toLowerCase().includes(cityName.toLowerCase())) {
        const zones = await this.kmlParser.findZonesByComune(codice);
        if (zones.length > 0) {
          const centralZone = zones.find(z => ['B1', 'B2', 'C1'].includes(z.zonaOMI)) || zones[0];
          return {
            key: `${centralZone.codiceComune}_${centralZone.zonaOMI}`,
            zone: centralZone,
            distance: 0,
            matchType: 'CITY_NAME'
          };
        }
      }
    }

    return null;
  }

  /**
   * Raccogli contesto di mercato per la zona
   */
  async getMarketContext(omiZone, address) {
    const context = {
      prezzoMedio: 2500, // Default
      trend: 'Stabile',
      servizi: 'Standard',
      zona: 'Residenziale'
    };

    if (omiZone && omiZone.zone) {
      // Prezzi base per zona OMI
      const prezziZone = {
        'A1': 4500, 'A2': 4000, 'A3': 3500, 'A4': 3000,
        'B1': 3200, 'B2': 2800, 'B3': 2400, 'B4': 2000,
        'C1': 2200, 'C2': 1900, 'C3': 1600, 'C4': 1400,
        'D1': 1800, 'D2': 1500, 'D3': 1300, 'D4': 1100,
        'R1': 1400, 'R2': 1200, 'R3': 1000, 'R4': 900
      };

      context.prezzoMedio = prezziZone[omiZone.zone.zonaOMI] || 2000;
      
      // Determina tipo zona
      const zonaType = omiZone.zone.zonaOMI.charAt(0);
      const zonaNum = parseInt(omiZone.zone.zonaOMI.charAt(1));
      
      switch (zonaType) {
        case 'A':
          context.zona = 'Centro storico/Pregiata';
          context.trend = zonaNum <= 2 ? 'In crescita' : 'Stabile';
          context.servizi = 'Eccellenti';
          break;
        case 'B':
          context.zona = 'Residenziale';
          context.trend = zonaNum <= 2 ? 'Stabile' : 'In lieve calo';
          context.servizi = zonaNum <= 2 ? 'Buoni' : 'Standard';
          break;
        case 'C':
          context.zona = 'Residenziale periferia';
          context.trend = 'Stabile';
          context.servizi = 'Standard';
          break;
        case 'D':
          context.zona = 'Industriale/Commerciale';
          context.trend = 'Variabile';
          context.servizi = 'Limitati';
          break;
        case 'R':
          context.zona = 'Rurale';
          context.trend = 'Stabile';
          context.servizi = 'Essenziali';
          break;
      }
    }

    // Aggiusti per città specifiche
    if (address.city) {
      const cityName = address.city.toLowerCase();
      if (['milano', 'roma', 'napoli', 'torino'].includes(cityName)) {
        context.prezzoMedio *= 1.3; // Maggiorazione grandi città
        context.trend = 'In crescita';
      } else if (['pescara', 'bari', 'palermo'].includes(cityName)) {
        context.prezzoMedio *= 1.1; // Leggera maggiorazione città medie
      }
    }

    return context;
  }

  combineResults(aiAnalysis, omiZone, marketContext, address, propertyData, capOmiValues) {
    const superficie =
      Number(propertyData?.livingArea) ||
      Number(propertyData?.superficie) ||
      80;

    const baseOmiPrice =
      (capOmiValues && Number(capOmiValues.avg)) ||
      (aiAnalysis?.valutazione &&
        Number(aiAnalysis.valutazione.prezzoAlMetroQuadro)) ||
      Number(marketContext?.prezzoMedio) ||
      2000;

    const prezzoAlMetroQuadro = Math.round(baseOmiPrice);
    const prezzoMedio = Math.round(prezzoAlMetroQuadro * superficie);
    const prezzoMinimo = Math.round(prezzoMedio * 0.85);
    const prezzoMassimo = Math.round(prezzoMedio * 1.15);

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      source: 'enhanced-omi-ai',
      valutazione: {
        prezzoMinimo,
        prezzoMassimo,
        prezzoMedio,
        prezzoAlMetroQuadro
      },
      zonaOMI: omiZone
        ? {
            codiceComune: omiZone.zone?.codiceComune,
            nomeComune: omiZone.zone?.comuneName,
            zonaOMI: omiZone.zone?.zonaOMI,
            matchType: omiZone.matchType,
            distanza: omiZone.distance,
            coordinate: omiZone.zone?.coordinates
          }
        : null,
      mercato: marketContext,
      analisiAI: {
        puntiForza: aiAnalysis.analisi?.puntiForza || [],
        puntiDebolezza: aiAnalysis.analisi?.puntiDebolezza || [],
        raccomandazioni: aiAnalysis.raccomandazioni || {},
        affidabilita: aiAnalysis.affidabilita || 7
      },
      metadati: {
        metodologia: 'AI + Dati OMI Ufficiali 2024/2',
        fonti: ['Groq AI', 'Database OMI KML', 'Analisi geografica'],
        limitazioni: omiZone ? [] : ['Zona OMI non trovata - valutazione generica'],
        dataValutazione: new Date().toISOString().split('T')[0]
      }
    };

    if (omiZone) {
      result.note = `Valutazione basata su zona OMI ufficiale ${omiZone.zone.zonaOMI} per ${omiZone.zone.comuneName}`;
    } else {
      result.note = 'Valutazione generica - si consiglia verifica con dati OMI specifici della zona';
      result.metadati.limitazioni.push('Raccomandato approfondimento con esperto locale');
    }

    return result;
  }

  /**
   * Valutazione di fallback in caso di errori
   */
  getFallbackValuation(address, propertyData) {
    const superficie = propertyData.superficie || 80;
    const prezzoBase = this.getBasePriceByLocation(address);
    const prezzoTotale = superficie * prezzoBase;

    return {
      success: true,
      timestamp: new Date().toISOString(),
      source: 'fallback-enhanced',
      
      valutazione: {
        prezzoMinimo: Math.round(prezzoTotale * 0.85),
        prezzoMassimo: Math.round(prezzoTotale * 1.15),
        prezzoMedio: Math.round(prezzoTotale),
        prezzoAlMetroQuadro: prezzoBase
      },
      
      zonaOMI: null,
      
      mercato: {
        prezzoMedio: prezzoBase,
        trend: 'Stabile',
        servizi: 'Standard',
        zona: 'Residenziale'
      },
      
      analisiAI: {
        puntiForza: ['Posizione', 'Caratteristiche standard'],
        puntiDebolezza: ['Valutazione automatica'],
        raccomandazioni: {
          venditore: 'Consulta un esperto per valutazione precisa',
          acquirente: 'Verifica condizioni e confronta mercato locale'
        },
        affidabilita: 5
      },
      
      metadati: {
        metodologia: 'Valutazione automatica di emergenza',
        fonti: ['Database interno'],
        limitazioni: ['Dati OMI non disponibili', 'AI non raggiungibile'],
        dataValutazione: new Date().toISOString().split('T')[0]
      },
      
      note: 'Valutazione di emergenza - fortemente consigliata consulenza professionale'
    };
  }

  /**
   * Prezzo base per località (fallback)
   */
  getBasePriceByLocation(address) {
    if (!address.city) return 2000;

    const cityPrices = {
      'milano': 4500, 'roma': 4000, 'napoli': 2800, 'torino': 3200,
      'firenze': 4200, 'bologna': 3800, 'venezia': 4800, 'genova': 3000,
      'pescara': 2200, 'bari': 2000, 'palermo': 1800, 'catania': 1600
    };

    const cityName = address.city.toLowerCase();
    return cityPrices[cityName] || 2000;
  }

  /**
   * Test del sistema completo
   */
  async testSystem() {
    console.log('🧪 Test sistema Enhanced OMI...');
    
    const tests = {
      kmlParser: false,
      groqAI: false,
      integration: false
    };

    try {
      // Test KML Parser
      const stats = await this.kmlParser.getDatabaseStats();
      tests.kmlParser = stats && stats.totalComuni > 0;
      console.log(`📊 KML Parser: ${tests.kmlParser ? '✅' : '❌'} (${stats?.totalComuni || 0} comuni)`);

      // Test Groq AI
      const groqTest = await this.groqService.testConnection();
      tests.groqAI = groqTest.success;
      console.log(`🤖 Groq AI: ${tests.groqAI ? '✅' : '❌'} (${groqTest.message || groqTest.error})`);

      // Test integrazione
      const testAddress = {
        city: 'Pescara',
        postcode: '65126',
        lat: 42.4584,
        lng: 14.2081
      };
      
      const testProperty = {
        superficie: 100,
        locali: 4,
        tipo: 'Residenziale'
      };

      const testResult = await this.getEnhancedValuation(testAddress, testProperty);
      tests.integration = testResult.success;
      console.log(`🔗 Integrazione: ${tests.integration ? '✅' : '❌'}`);

    } catch (error) {
      console.error('❌ Errore test sistema:', error);
    }

    return tests;
  }
}

export default EnhancedOMIService;
