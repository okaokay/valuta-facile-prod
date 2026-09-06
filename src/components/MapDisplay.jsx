import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { searchViaBackend } from '../services/enhancedAddressService'

// Fix per le icone di Leaflet in React
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Componente per aggiornare la vista della mappa quando cambiano le coordinate
function ChangeMapView({ center }) {
  const map = useMap()
  
  useEffect(() => {
    if (center && center[0] && center[1]) {
      console.log('ChangeMapView: Aggiornamento vista mappa a:', center);
      map.setView(center, 16) // Zoom a livello 16 per vedere bene la via
    }
  }, [center, map])
  
  return null
}

function MapDisplay({ address, variant = 'card' }) {
  const [position, setPosition] = useState([41.9028, 12.4964]) // Default: Roma
  const [key, setKey] = useState(0) // Chiave per forzare il re-rendering della mappa
  const [mapHeight, setMapHeight] = useState('300px')
  const [addressText, setAddressText] = useState('Indirizzo selezionato')
  const [isApproximate, setIsApproximate] = useState(false)
  const [, setError] = useState(null)
  const mapRef = useRef(null)

  // Ricerca coordinate precise per un indirizzo tramite il backend (proxy
  // verso Nominatim/Photon, vedi server/services/geocodeSearch.js). Prima
  // chiamava Nominatim direttamente dal browser, causando gli stessi
  // problemi di CORS/rate-limit già risolti per l'autocomplete indirizzi.
  const getCoordinatesFromAddress = async (addressStr) => {
    try {
      let searchQuery = '';

      if (typeof addressStr === 'string') {
        searchQuery = addressStr;
      } else {
        // Costruisci una stringa di ricerca completa dall'oggetto indirizzo
        const parts = [];
        if (addressStr.street) {
          let streetPart = addressStr.street;
          if (addressStr.housenumber) streetPart += ' ' + addressStr.housenumber;
          parts.push(streetPart);
        }
        if (addressStr.city) parts.push(addressStr.city);
        if (addressStr.postcode) parts.push(addressStr.postcode);
        parts.push('Italia'); // Aggiungi sempre Italia per migliorare la precisione

        searchQuery = parts.join(', ');
      }

      console.log('MapDisplay: Ricerca coordinate per indirizzo:', searchQuery);

      const results = await searchViaBackend(searchQuery);

      if (results.length > 0 && results[0].lat != null && results[0].lon != null) {
        console.log('MapDisplay: Coordinate trovate:', results[0]);
        return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
      } else {
        console.warn('MapDisplay: Nessun risultato trovato per l\'indirizzo');
        return null;
      }
    } catch (error) {
      console.error('MapDisplay: Errore nella geocodifica:', error);
      return null;
    }
  };
  
  useEffect(() => {
    // Imposta un'altezza minima per la mappa
    setMapHeight('350px')
    
    // Aggiorna la posizione quando cambiano le coordinate dell'indirizzo
    if (address) {
      console.log('🗺️ MapDisplay: Aggiornamento mappa con indirizzo:', address);
      
      const updateMapPosition = async () => {
        try {
          const lat = parseFloat(address.lat ?? address.latitude ?? 0);
          const lon = parseFloat(address.lon ?? address.longitude ?? address.lng ?? 0);

          if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
            console.log(`✅ MapDisplay: Coordinate dall'oggetto indirizzo: ${lat}, ${lon}`);
            setPosition([lat, lon]);
            setIsApproximate(false);
            setError(null);
            setKey(prevKey => prevKey + 1);
            return;
          }

          const geocodedCoords = await getCoordinatesFromAddress(address);

          if (geocodedCoords) {
            console.log('✅ MapDisplay: Coordinate ottenute da geocoding:', geocodedCoords);
            setPosition(geocodedCoords);
            setIsApproximate(false);
            setError(null);
            setKey(prevKey => prevKey + 1);
            return;
          }

          // Nessuna coordinata precisa disponibile: usiamo un centro
          // comune/CAP come ultima spiaggia, dichiarandolo esplicitamente
          // come approssimato (non è il punto reale del civico).
          console.warn('⚠️ MapDisplay: Coordinate non valide, uso posizione approssimata (centro comune/CAP)');
          const fallbackCoords = getPreciseCoordinates(address);
          setPosition(fallbackCoords);
          setIsApproximate(true);
          setError(null);
          setKey(prevKey => prevKey + 1);

        } catch (err) {
          console.error('❌ MapDisplay: Errore nel processare le coordinate:', err);
          const fallbackCoords = getPreciseCoordinates(address);
          setPosition(fallbackCoords);
          setIsApproximate(true);
          setKey(prevKey => prevKey + 1);
        }
      };
      
      updateMapPosition();
      
      // Imposta il testo dell'indirizzo
      try {
        if (typeof address === 'string') {
          setAddressText(address);
        } else if (address.display) {
          setAddressText(address.display);
        } else if (address.street) {
          let displayText = '';
          
          if (address.street) {
            displayText += address.street;
            if (address.housenumber) displayText += ' ' + address.housenumber;
          }
          
          if (address.city) {
            if (displayText) displayText += ', ';
            displayText += address.city;
          }
          
          if (!displayText && address.postcode) {
            displayText = `CAP: ${address.postcode}`;
          }
          
          setAddressText(displayText.trim() || 'Indirizzo selezionato');
        }
      } catch (err) {
        console.error('❌ MapDisplay: Errore nel formattare il testo dell\'indirizzo:', err);
        setAddressText('Indirizzo selezionato');
      }
    }
  }, [address])
  
  // Funzione per ottenere coordinate precise basate su CAP o città
  const getPreciseCoordinates = (address) => {
    // Database preciso di coordinate per le principali città italiane
    const cityCoordinates = {
      'Roma': [41.9028, 12.4964],
      'Milano': [45.4642, 9.1900],
      'Napoli': [40.8518, 14.2681],
      'Torino': [45.0703, 7.6869],
      'Palermo': [38.1157, 13.3615],
      'Bologna': [44.4949, 11.3426],
      'Firenze': [43.7696, 11.2558],
      'Pescara': [42.4617, 14.2160],
      'Bari': [41.1171, 16.8719],
      'Catania': [37.5079, 15.0830]
    };
    
    // Database preciso di coordinate per i CAP principali
    const capCoordinates = {
      '00100': [41.9028, 12.4964], // Roma
      '20100': [45.4642, 9.1900],  // Milano
      '80100': [40.8518, 14.2681], // Napoli
      '10100': [45.0703, 7.6869],  // Torino
      '90100': [38.1157, 13.3615], // Palermo
      '40100': [44.4949, 11.3426], // Bologna
      '50100': [43.7696, 11.2558], // Firenze
      '65100': [42.4617, 14.2160], // Pescara
      '65126': [42.461700, 14.216000], // Pescara specifico
      '70100': [41.1171, 16.8719], // Bari
      '95100': [37.5079, 15.0830]  // Catania
    };
    
    // Prova a trovare coordinate precise per il CAP esatto
    if (address.postcode && capCoordinates[address.postcode]) {
      return capCoordinates[address.postcode];
    }
    
    // Prova a trovare coordinate per la città
    if (address.city && cityCoordinates[address.city]) {
      return cityCoordinates[address.city];
    }
    
    // Se non troviamo il CAP esatto, proviamo con il prefisso
    if (address.postcode) {
      const prefix = address.postcode.substring(0, 3);
      
      // Mappa dei prefissi CAP alle città principali con coordinate precise
      const capPrefixToCoords = {
        '001': [41.9028, 12.4964], // Roma
        '201': [45.4642, 9.1900],  // Milano
        '801': [40.8518, 14.2681], // Napoli
        '101': [45.0703, 7.6869],  // Torino
        '901': [38.1157, 13.3615], // Palermo
        '401': [44.4949, 11.3426], // Bologna
        '501': [43.7696, 11.2558], // Firenze
        '651': [42.4617, 14.2160], // Pescara
        '701': [41.1171, 16.8719], // Bari
        '951': [37.5079, 15.0830]  // Catania
      };
      
      if (capPrefixToCoords[prefix]) {
        return capPrefixToCoords[prefix];
      }
    }
    
    // Coordinate precise per Pescara come fallback (dall'immagine)
    return [42.461700, 14.216000];
  };
  
  if (variant === 'bare' || variant === 'hero') {
    return (
      <div className={variant === 'hero' ? 'w-full h-full pointer-events-none' : 'w-full h-full'}>
        <div
          className="map-container"
          style={{ height: '100%' }}
          ref={mapRef}
        >
          <MapContainer
            key={key}
            center={position}
            zoom={16}
            scrollWheelZoom={variant === 'hero' ? false : true}
            doubleClickZoom={variant === 'hero' ? false : true}
            dragging={variant === 'hero' ? false : true}
            zoomControl={variant === 'hero' ? false : true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={position}>
              <Popup>
                <div className="font-medium">{addressText}</div>
                {address?.postcode && (
                  <div className="text-sm">CAP: {address.postcode}</div>
                )}
                {isApproximate && (
                  <div className="text-xs text-amber-600 mt-1">
                    Posizione approssimata (centro comune/CAP): il civico esatto non è stato trovato.
                  </div>
                )}
              </Popup>
            </Marker>
            <Circle
              center={position}
              radius={500}
              pathOptions={{
                fillColor: 'blue',
                fillOpacity: 0.1,
                weight: 1,
                color: 'blue'
              }}
            />
            <ChangeMapView center={position} />
          </MapContainer>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-blue-600 p-3 text-white">
        <h3 className="text-lg font-semibold flex items-center">
          <span className="mr-2">📍</span> Posizione dell&apos;immobile
        </h3>
      </div>
      
      <div 
        className="map-container relative" 
        style={{ height: mapHeight }}
        ref={mapRef}
      >
      <MapContainer 
        key={key} // Usa la chiave per forzare il re-rendering
        center={position} 
          zoom={16} // Aumentato il livello di zoom per maggiore precisione
        scrollWheelZoom={true} // Abilitato lo zoom con la rotella del mouse per una navigazione più facile
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>
              <div className="font-medium">{addressText}</div>
              {address?.postcode && <div className="text-sm">CAP: {address.postcode}</div>}
              {isApproximate && (
                <div className="text-xs text-amber-600 mt-1">
                  Posizione approssimata (centro comune/CAP): il civico esatto non è stato trovato.
                </div>
              )}
          </Popup>
        </Marker>
          
          {/* Cerchio che indica l'area di ricerca dei POI */}
          <Circle 
            center={position}
            radius={500}
            pathOptions={{ fillColor: 'blue', fillOpacity: 0.1, weight: 1, color: 'blue' }}
          />
          
        {/* Aggiungi il componente per aggiornare la vista quando cambiano le coordinate */}
        <ChangeMapView center={position} />
      </MapContainer>
        
        {/* Controlli personalizzati */}
        <div className="absolute bottom-2 right-2 bg-white rounded-lg shadow-md p-2 z-[1000]">
          <div className="text-xs text-gray-600">
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${position[0]},${position[1]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center hover:text-blue-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Apri in Google Maps
            </a>
          </div>
        </div>
      </div>
      
      <div className="p-3 bg-gray-50 text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium">Coordinate:</span> {position[0].toFixed(6)}, {position[1].toFixed(6)}
          </div>
          {address?.postcode && (
            <div>
              <span className="font-medium">CAP:</span> {address.postcode}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MapDisplay
