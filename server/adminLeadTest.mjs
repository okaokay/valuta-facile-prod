import fs from 'fs'
import path from 'path'
import {
  insertLead,
  insertMediaRecords,
  insertAiAnalysis
} from './db.js'

const datiDir = path.join(process.cwd(), 'dati')
const uploadsDir = path.join(process.cwd(), 'uploads')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

function loadMediaFiles() {
  const files = fs.existsSync(datiDir) ? fs.readdirSync(datiDir) : []
  const floorplanFile = files.find(f =>
    f.toLowerCase().includes('piantina')
  )
  const photoFiles = files.filter(f =>
    f.toLowerCase().includes('whatsapp')
  )

  const mediaRecords = []

  if (floorplanFile) {
    const p = path.join(datiDir, floorplanFile)
    const s = fs.statSync(p)
    const destName = `test_${floorplanFile.replace(/\s+/g, '_')}`
    const destPath = path.join(uploadsDir, destName)
    try {
      fs.copyFileSync(p, destPath)
    } catch {}
    mediaRecords.push({
      type: 'planimetria',
      file_url: `/uploads/${destName}`,
      file_name: floorplanFile,
      mime: 'application/pdf',
      size: s.size
    })
  }

  photoFiles.forEach(name => {
    const p = path.join(datiDir, name)
    const s = fs.statSync(p)
    const destName = `test_${name.replace(/\s+/g, '_')}`
    const destPath = path.join(uploadsDir, destName)
    try {
      fs.copyFileSync(p, destPath)
    } catch {}
    mediaRecords.push({
      type: 'foto',
      file_url: `/uploads/${destName}`,
      file_name: name,
      mime: 'image/jpeg',
      size: s.size
    })
  })

  const mediaSummary = {
    hasFloorplan: mediaRecords.some(m => m.type === 'planimetria'),
    photosCount: mediaRecords.filter(m => m.type === 'foto').length
  }

  return { mediaRecords, mediaSummary }
}

const baseWizardData = {
  propertyType: 'appartamento',
  features: {
    rooms: 4,
    bathrooms: 2,
    heating: 'autonomo',
    yearBuilt: '2005',
    energyClass: 'B'
  },
  extra: {
    hasBalconyOrTerrace: true,
    hasGarden: true,
    hasGarage: true
  },
  lead: {
    profileType: 'PROPRIETARIO',
    saleTiming: 'entro_3_mesi',
    wantAgenciesValuation: true,
    marketingConsent: true
  }
}

const valuationData = {
  valutazione: {
    prezzoMinimo: 200000,
    prezzoMassimo: 260000,
    prezzoMedio: 230000,
    prezzoAlMetroQuadro: 2500
  }
}

const aiAnalysisSummary = {
  summary: {
    description: 'Appartamento ben tenuto con buone finiture.'
  },
  extracted_features: {
    tags: ['luminoso', 'ristrutturato', 'zona_tranquilla']
  },
  aiDeltaValue: 15000
}

const testLeads = [
  {
    regionLabel: 'Abruzzo',
    contact: {
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'mario.rossi.abruzzo@example.com',
      telefono: '3331111111'
    },
    address: {
      display: 'Via Primo Riccitelli 27, Pescara, Italia',
      street: 'Via Primo Riccitelli',
      housenumber: '27',
      city: 'Pescara',
      state: 'PE',
      postcode: '65126',
      lat: 42.4575,
      lon: 14.2204
    },
    property: {
      livingArea: 95,
      balconyArea: 10,
      terraceArea: 15,
      verandaArea: 5,
      loftArea: 0,
      atticArea: 0,
      basementArea: 8,
      gardenArea: 25,
      rooftopArea: 0,
      condition: 'Ristrutturato',
      floor: 3,
      hasElevator: true,
      rooms: 4,
      bedrooms: 3,
      bathrooms: 2,
      yearBuilt: '2005',
      parkingSpaces: 1
    }
  },
  {
    regionLabel: 'Lombardia',
    contact: {
      nome: 'Laura',
      cognome: 'Bianchi',
      email: 'laura.bianchi.lombardia@example.com',
      telefono: '3332222222'
    },
    address: {
      display: 'Via Garibaldi 10, Milano, Italia',
      street: 'Via Garibaldi',
      housenumber: '10',
      city: 'Milano',
      state: 'MI',
      postcode: '20121',
      lat: 45.472,
      lon: 9.184
    },
    property: {
      livingArea: 80,
      balconyArea: 8,
      terraceArea: 0,
      verandaArea: 0,
      loftArea: 0,
      atticArea: 0,
      basementArea: 4,
      gardenArea: 0,
      rooftopArea: 0,
      condition: 'Buono',
      floor: 4,
      hasElevator: true,
      rooms: 3,
      bedrooms: 2,
      bathrooms: 1,
      yearBuilt: '1995',
      parkingSpaces: 0
    }
  },
  {
    regionLabel: 'Lazio',
    contact: {
      nome: 'Giulia',
      cognome: 'Verdi',
      email: 'giulia.verdi.lazio@example.com',
      telefono: '3333333333'
    },
    address: {
      display: 'Via Appia Nuova 150, Roma, Italia',
      street: 'Via Appia Nuova',
      housenumber: '150',
      city: 'Roma',
      state: 'RM',
      postcode: '00179',
      lat: 41.872,
      lon: 12.516
    },
    property: {
      livingArea: 110,
      balconyArea: 12,
      terraceArea: 20,
      verandaArea: 0,
      loftArea: 0,
      atticArea: 0,
      basementArea: 10,
      gardenArea: 30,
      rooftopArea: 0,
      condition: 'Ottimo',
      floor: 2,
      hasElevator: true,
      rooms: 5,
      bedrooms: 3,
      bathrooms: 2,
      yearBuilt: '2010',
      parkingSpaces: 1
    }
  },
  {
    regionLabel: 'Sicilia',
    contact: {
      nome: 'Antonio',
      cognome: 'Neri',
      email: 'antonio.neri.sicilia@example.com',
      telefono: '3334444444'
    },
    address: {
      display: 'Via Etnea 45, Catania, Italia',
      street: 'Via Etnea',
      housenumber: '45',
      city: 'Catania',
      state: 'CT',
      postcode: '95124',
      lat: 37.5079,
      lon: 15.083
    },
    property: {
      livingArea: 90,
      balconyArea: 6,
      terraceArea: 10,
      verandaArea: 0,
      loftArea: 0,
      atticArea: 0,
      basementArea: 5,
      gardenArea: 15,
      rooftopArea: 0,
      condition: 'Da ristrutturare',
      floor: 1,
      hasElevator: false,
      rooms: 4,
      bedrooms: 2,
      bathrooms: 1,
      yearBuilt: '1975',
      parkingSpaces: 0
    }
  },
  {
    regionLabel: 'Toscana',
    contact: {
      nome: 'Sara',
      cognome: 'Galli',
      email: 'sara.galli.toscana@example.com',
      telefono: '3335555555'
    },
    address: {
      display: 'Via dei Colli 8, Firenze, Italia',
      street: 'Via dei Colli',
      housenumber: '8',
      city: 'Firenze',
      state: 'FI',
      postcode: '50125',
      lat: 43.7696,
      lon: 11.2558
    },
    property: {
      livingArea: 85,
      balconyArea: 5,
      terraceArea: 12,
      verandaArea: 0,
      loftArea: 0,
      atticArea: 0,
      basementArea: 6,
      gardenArea: 20,
      rooftopArea: 0,
      condition: 'Buono',
      floor: 3,
      hasElevator: false,
      rooms: 4,
      bedrooms: 2,
      bathrooms: 2,
      yearBuilt: '1990',
      parkingSpaces: 1
    }
  }
]

const { mediaRecords, mediaSummary } = loadMediaFiles()

const inserted = testLeads.map(def => {
  const wizardData = {
    ...baseWizardData,
    property: def.property,
    media: {
      aiFeatures: aiAnalysisSummary
    }
  }

  const leadId = insertLead({
    contact: def.contact,
    address: def.address,
    property: def.property,
    valuation: valuationData,
    wizardData,
    mediaSummary,
    aiAnalysisSummary
  })

  insertMediaRecords(leadId, mediaRecords)

  insertAiAnalysis(leadId, {
    summary: aiAnalysisSummary.summary || null,
    extracted_features: aiAnalysisSummary.extracted_features || null,
    delta_price: aiAnalysisSummary.aiDeltaValue || null
  })

  return {
    leadId,
    regionLabel: def.regionLabel,
    nome: def.contact.nome,
    cognome: def.contact.cognome,
    email: def.contact.email
  }
})

console.log(
  JSON.stringify(
    {
      inserted
    },
    null,
    2
  )
)
