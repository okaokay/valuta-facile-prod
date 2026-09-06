/**
 * Servizio per leggere e parsare i file KML OMI ufficiali
 * Estrae informazioni su codici comuni, zone OMI e coordinate geografiche
 */

import fs from 'fs';
import path from 'path';

class OMIKmlParser {
  constructor(kmlDataPath) {
    this.kmlDataPath =
      kmlDataPath ||
      process.env.OMI_KML_PATH ||
      path.join(process.cwd(), 'omi');
    this.cache = new Map();
  }

  /**
   * Legge tutti i file KML e crea un database delle zone OMI
   */
  async loadOMIDatabase() {
    if (this.cache.has('omi_database')) {
      return this.cache.get('omi_database');
    }

    console.log('🔍 Caricamento database OMI da file KML...');
    const database = {
      comuni: new Map(),
      zone: new Map(),
      coordinates: new Map()
    };

    try {
      const files = fs.readdirSync(this.kmlDataPath);
      const kmlFiles = files.filter((file) => file.endsWith('.kml'));

      console.log(`📁 Trovati ${kmlFiles.length} file KML`);

      for (const file of kmlFiles) {
        const filePath = path.join(this.kmlDataPath, file);
        await this.parseKMLFile(filePath, database);
      }

      this.cache.set('omi_database', database);
      console.log(`✅ Database OMI caricato: ${database.comuni.size} comuni, ${database.zone.size} zone`);
      
      return database;
    } catch (error) {
      console.error('❌ Errore nel caricamento database OMI:', error);
      return null;
    }
  }

  /**
   * Parsa un singolo file KML ed estrae le informazioni OMI
   */
  async parseKMLFile(filePath, database) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Estrai nome del comune dal documento
      const comuneMatch = content.match(/<name>([^(]+)\s*\([^)]+\)/);
      const comuneName = comuneMatch ? comuneMatch[1].trim() : null;

      // Estrai tutti i Placemark (zone OMI)
      const placemarkRegex = /<Placemark>(.*?)<\/Placemark>/gs;
      const placemarks = content.match(placemarkRegex) || [];

      for (const placemark of placemarks) {
        const zoneData = this.parsePlacemark(placemark, comuneName);
        if (zoneData) {
          // Aggiungi al database
          const key = `${zoneData.codiceComune}_${zoneData.zonaOMI}`;
          database.zone.set(key, zoneData);
          
          if (!database.comuni.has(zoneData.codiceComune)) {
            database.comuni.set(zoneData.codiceComune, {
              nome: comuneName,
              codice: zoneData.codiceComune,
              zone: []
            });
          }
          
          database.comuni.get(zoneData.codiceComune).zone.push(zoneData.zonaOMI);
          
          // Salva coordinate per matching geografico
          if (zoneData.coordinates) {
            database.coordinates.set(key, zoneData.coordinates);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Errore parsing file ${filePath}:`, error.message);
    }
  }

  /**
   * Parsa un singolo Placemark ed estrae i dati della zona OMI
   */
  parsePlacemark(placemark, comuneName) {
    try {
      // Estrai nome zona
      const nameMatch = placemark.match(/<name>([^<]+)<\/name>/);
      const name = nameMatch ? nameMatch[1].trim() : null;

      // Estrai codice comune
      const codComMatch = placemark.match(/<Data name="CODCOM">.*?<value>([^<]+)<\/value>/s);
      const codiceComune = codComMatch ? codComMatch[1].trim() : null;

      // Estrai zona OMI
      const codZonaMatch = placemark.match(/<Data name="CODZONA">.*?<value>([^<]+)<\/value>/s);
      const zonaOMI = codZonaMatch ? codZonaMatch[1].trim() : null;

      // Estrai coordinate (semplificato - prende solo il primo punto)
      const coordMatch = placemark.match(/<coordinates>\s*([^<]+)\s*<\/coordinates>/);
      let coordinates = null;
      if (coordMatch) {
        const coordString = coordMatch[1].trim();
        const firstPoint = coordString.split(' ')[0];
        const [lng, lat] = firstPoint.split(',').map(parseFloat);
        if (!isNaN(lng) && !isNaN(lat)) {
          coordinates = { lng, lat };
        }
      }

      if (codiceComune && zonaOMI) {
        return {
          nome: name,
          comuneName,
          codiceComune,
          zonaOMI,
          coordinates,
          anno: '2024',
          semestre: '2'
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Errore parsing placemark:', error.message);
      return null;
    }
  }

  /**
   * Trova la zona OMI più vicina alle coordinate fornite
   */
  async findNearestOMIZone(lat, lng) {
    const database = await this.loadOMIDatabase();
    if (!database) return null;

    let nearestZone = null;
    let minDistance = Infinity;

    for (const [key, coords] of database.coordinates.entries()) {
      if (coords && coords.lat && coords.lng) {
        const distance = this.calculateDistance(lat, lng, coords.lat, coords.lng);
        if (distance < minDistance) {
          minDistance = distance;
          nearestZone = {
            key,
            zone: database.zone.get(key),
            distance: distance
          };
        }
      }
    }

    return nearestZone;
  }

  /**
   * Cerca zone OMI per codice comune
   */
  async findZonesByComune(codiceComune) {
    const database = await this.loadOMIDatabase();
    if (!database) return [];

    const zones = [];
    for (const [, zoneData] of database.zone.entries()) {
      if (zoneData.codiceComune === codiceComune) {
        zones.push(zoneData);
      }
    }

    return zones;
  }

  /**
   * Calcola la distanza tra due punti geografici (in km)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Raggio della Terra in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRad(value) {
    return value * Math.PI / 180;
  }

  /**
   * Ottieni statistiche del database
   */
  async getDatabaseStats() {
    const database = await this.loadOMIDatabase();
    if (!database) return null;

    return {
      totalComuni: database.comuni.size,
      totalZone: database.zone.size,
      totalCoordinates: database.coordinates.size,
      comuniList: Array.from(database.comuni.values()).slice(0, 10) // Prime 10 per esempio
    };
  }
}

export default OMIKmlParser;
