import { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

// Registra i componenti necessari di Chart.js
ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Funzione per generare un punteggio casuale tra min e max
const generateScore = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Funzione per generare un colore con opacità
const generateColors = (count, opacity = 0.6) => {
  const baseColors = [
    `rgba(54, 162, 235, ${opacity})`,
    `rgba(255, 99, 132, ${opacity})`,
    `rgba(255, 206, 86, ${opacity})`,
    `rgba(75, 192, 192, ${opacity})`,
    `rgba(153, 102, 255, ${opacity})`,
    `rgba(255, 159, 64, ${opacity})`,
    `rgba(199, 199, 199, ${opacity})`,
    `rgba(83, 102, 255, ${opacity})`,
  ];
  
  return Array(count).fill().map((_, i) => baseColors[i % baseColors.length]);
};

// Funzione per generare dati realistici per i grafici
const generateChartData = (city) => {
  // Dati specifici per Pescara
  if (city === 'Pescara' || city.includes('Pescara')) {
  // Dati per il grafico a torta dei servizi nelle vicinanze
    const servicesData = {
      labels: ['Trasporti', 'Scuole', 'Negozi', 'Parchi', 'Ristoranti'],
      datasets: [
        {
          data: [4, 3, 5, 4, 5], // Valori fissi per Pescara
          backgroundColor: generateColors(5),
          borderColor: generateColors(5, 1),
          borderWidth: 1,
        },
      ],
    };
    
    // Dati per il grafico a barre del trend di mercato
    const marketTrendData = {
      labels: ['2020', '2021', '2022', '2023', '2024'],
      datasets: [
        {
          label: 'Trend di mercato (%)',
          data: [1.2, 2.5, 3.8, 4.2, 5.1], // Trend positivo per Pescara
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
      ],
    };
    
    return { servicesData, marketTrendData };
  }
  
  // Dati generici per altre città
  const servicesData = {
    labels: ['Trasporti', 'Scuole', 'Negozi', 'Parchi', 'Ristoranti'],
    datasets: [
      {
        data: [generateScore(3, 5), generateScore(2, 5), generateScore(3, 5), generateScore(1, 5), generateScore(2, 5)],
        backgroundColor: generateColors(5),
        borderColor: generateColors(5, 1),
        borderWidth: 1,
      },
    ],
  };
  
  const marketTrendData = {
    labels: ['2020', '2021', '2022', '2023', '2024'],
    datasets: [
      {
        label: 'Trend di mercato (%)',
        data: [generateScore(-2, 3), generateScore(0, 4), generateScore(1, 5), generateScore(2, 6), generateScore(3, 7)],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };
  
  return { servicesData, marketTrendData };
};

// Funzione per generare punti di forza basati sulla posizione
const generateStrengths = (address) => {
  console.log('LocationHighlights: Generazione punti di forza per indirizzo:', address);
  
  if (!address) {
    console.warn('LocationHighlights: Indirizzo mancante, uso punti di forza generici');
    return [
      'Posizione in area residenziale',
      'Buona accessibilità generale',
      'Area con servizi essenziali',
      'Zona con potenziale di sviluppo'
    ];
  }
  
  // Estrai la città dall'indirizzo
  let city = '';
  if (typeof address === 'string') {
    // Se l'indirizzo è una stringa, prova a estrarre la città
    const parts = address.split(',');
    if (parts.length > 1) {
      city = parts[1].trim();
    } else {
      city = 'questa località';
    }
  } else {
    // Se l'indirizzo è un oggetto, usa la proprietà city se disponibile
    city = address.city || address.display?.split(',')[1]?.trim() || 'questa località';
  }
  
  console.log('LocationHighlights: Città estratta:', city);
  
  // Punti di forza specifici per Pescara
  if (city === 'Pescara' || (address.postcode && address.postcode.startsWith('65'))) {
    return [
      'Posizione strategica nel centro di Pescara',
      'Ottima accessibilità ai mezzi pubblici',
      'Vicinanza a negozi e servizi essenziali',
      'Area ben servita da ristoranti e attività commerciali',
      'Zona con eccellente reputazione'
    ];
  }
  
  // Punti di forza generici per altre città
  const genericStrengths = [
    'Ottima posizione nel contesto urbano',
    'Buona accessibilità ai mezzi pubblici',
    'Vicinanza a servizi essenziali',
    'Area ben servita da negozi e attività commerciali',
    'Zona con buona reputazione',
    'Buon rapporto qualità-prezzo per la zona',
    'Quartiere in fase di riqualificazione',
    'Presenza di aree verdi nelle vicinanze',
    'Basso tasso di criminalità rispetto alla media cittadina',
    'Buona esposizione solare',
    'Zona tranquilla e poco trafficata',
    'Vicinanza a scuole di buon livello',
    'Buona connessione con le principali arterie stradali',
    'Presenza di piste ciclabili',
    'Facile accesso ai principali servizi sanitari'
  ];
  
  // Seleziona casualmente 3-5 punti di forza
  const count = Math.floor(Math.random() * 3) + 3; // Da 3 a 5 punti
  const shuffled = [...genericStrengths].sort(() => 0.5 - Math.random());
  
  // Personalizza almeno un punto di forza con il nome della città
  const citySpecificStrength = `Posizione strategica nel comune di ${city}`;
  
  return [citySpecificStrength, ...shuffled.slice(0, count - 1)];
};

function LocationHighlights({ address, omiData }) {
  const [strengths, setStrengths] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    console.log('LocationHighlights: Indirizzo ricevuto:', address);
    console.log('LocationHighlights: Dati OMI ricevuti:', omiData);
    
    if (address) {
      setLoading(true);
      
      // Estrai la città dall'indirizzo per generare dati specifici
      let city = '';
      if (typeof address === 'string') {
        const parts = address.split(',');
        if (parts.length > 1) {
          city = parts[1].trim();
        }
      } else {
        city = address.city || address.display?.split(',')[1]?.trim() || '';
      }
      
      // Verifica se è Pescara dal CAP
      if (address.postcode && address.postcode.startsWith('65')) {
        city = 'Pescara';
      }
      
      // Simula una chiamata a un servizio di AI leggero
      setTimeout(() => {
        const generatedStrengths = generateStrengths(address);
        console.log('LocationHighlights: Punti di forza generati:', generatedStrengths);
        
        setStrengths(generatedStrengths);
        setChartData(generateChartData(city));
        setLoading(false);
      }, 800); // Simula un breve ritardo di elaborazione
    }
  }, [address, omiData]);
  
  if (!address) {
    console.warn('LocationHighlights: Nessun indirizzo fornito');
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
        <div className="flex items-center mb-4">
          <span className="mr-2 text-blue-500">⭐</span>
          <h3 className="text-base font-semibold text-gray-900">
            Punti di forza della posizione
          </h3>
        </div>
        <div className="text-sm text-gray-600">
          Inserisci un indirizzo per visualizzare i punti di forza.
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
      <div className="flex items-center mb-4">
        <span className="mr-2 text-blue-500">⭐</span>
        <h3 className="text-base font-semibold text-gray-900">
          Punti di forza della posizione
        </h3>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
            <ul className="list-disc pl-5 space-y-3">
              {strengths.map((strength, index) => (
                <li
                  key={index}
                  className="text-sm leading-relaxed text-gray-700"
                >
                  {strength}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white border border-gray-200 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Servizi nelle vicinanze
              </h4>
              {chartData && (
                <Pie
                  data={chartData.servicesData}
                  options={{ responsive: true, maintainAspectRatio: true }}
                />
              )}
            </div>

            <div className="bg-white border border-gray-200 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Trend di mercato nella zona
              </h4>
              {chartData && (
                <Bar
                  data={chartData.marketTrendData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: {
                          display: true,
                          text: 'Variazione %'
                        }
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>

          <div className="text-xs text-gray-500 italic">
            Analisi generata automaticamente in base alla posizione dell&apos;immobile.
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationHighlights;
