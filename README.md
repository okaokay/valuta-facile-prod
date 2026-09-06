# 🏠 Valutatore Immobiliare con AI

Un'applicazione web moderna per la valutazione immobiliare automatica con integrazione AI, sviluppata in React con Vite.

## ✨ Caratteristiche Principali

- **🤖 Valutazione AI**: Integrazione con Groq AI per analisi intelligenti
- **📍 Ricerca Indirizzi**: Sistema avanzato di ricerca indirizzi con autocompletamento
- **🗺️ Mappa Interattiva**: Visualizzazione precisa della proprietà con Leaflet
- **📊 Dati OMI Reali**: Database completo dei valori OMI italiani
- **📱 Design Responsive**: Interfaccia moderna e mobile-friendly
- **🔒 Privacy Compliant**: Raccolta dati con consenso privacy

## 🚀 Tecnologie Utilizzate

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Mappe**: Leaflet + React-Leaflet
- **AI**: Groq API (modelli Gemma/Llama)
- **Geocoding**: Nominatim + Photon APIs
- **Dati**: OMI (Osservatorio Mercato Immobiliare)

## 📦 Installazione

```bash
# Clona il repository
git clone https://github.com/okaokay/valutatore.git

# Entra nella directory
cd valutatore

# Installa le dipendenze
npm install

# Copia il file di configurazione
cp .env.example .env

# Configura la tua API key Groq in .env
VITE_GROQ_API_KEY=your_groq_api_key_here

# Avvia il server di sviluppo
npm run dev
```

## 🔧 Configurazione

1. **API Key Groq**: Registrati su [Groq](https://console.groq.com/) e ottieni la tua API key
2. **File .env**: Configura le variabili d'ambiente necessarie

## 🏗️ Struttura del Progetto

```
src/
├── components/           # Componenti React
│   ├── StepByStepAddressForm.jsx
│   ├── ValuationBox.jsx
│   ├── MapDisplay.jsx
│   └── ...
├── services/            # Servizi e API
│   ├── simplifiedGroqService.js
│   ├── omiService.js
│   └── ...
└── App.jsx             # Componente principale
```

## 🎯 Funzionalità

### 📍 Ricerca Indirizzo
- Autocompletamento intelligente
- Validazione CAP automatica
- Geocoding preciso

### 🤖 Valutazione AI
- Analisi con modelli Groq (Gemma/Llama)
- Punti di forza e debolezza
- Raccomandazioni personalizzate
- Sistema di fallback robusto

### 📊 Dati di Mercato
- Database OMI completo
- Valori differenziati per zona
- Dati aggiornati per tutta Italia

### 🗺️ Visualizzazione
- Mappa interattiva Leaflet
- Coordinate precise
- Punti di interesse (POI)

## 🔄 Sistema di Fallback

L'applicazione utilizza un sistema di fallback intelligente:
1. **Groq AI** (modelli multipli)
2. **Valutazione tradizionale** (se AI non disponibile)
3. **Dati cached** per performance ottimali

## 📱 UX/UI

- Design ispirato a RealAdvisor
- Form step-by-step intuitivo
- Modal popup per contatti
- Feedback visivo in tempo reale

## 🛠️ Sviluppo

```bash
# Modalità sviluppo
npm run dev

# Build per produzione
npm run build

# Preview build
npm run preview
```

## 📄 Licenza

Questo progetto è sotto licenza MIT.

## 🤝 Contributi

I contributi sono benvenuti! Apri una issue o invia una pull request.

## 📞 Supporto

Per supporto o domande, apri una issue su GitHub.

---

Sviluppato con ❤️ per il mercato immobiliare italiano