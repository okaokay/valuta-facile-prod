import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './index.css'
import MapDisplay from './components/MapDisplay'
import ContactForm from './components/ContactForm'
import ContactFormPopup from './components/ContactFormPopup'
import MatterCtaPlayground from './components/MatterCtaPlayground'
import ContactsDashboard from './components/ContactsDashboard'
import { getOmiValues } from './services/omiService'
import WizardStepperSidebar from './components/WizardStepperSidebar'
import AddressLanding from './components/AddressLanding'
import AddressConfirmWithMap from './components/AddressConfirmWithMap'
import PropertyTypeCards from './components/PropertyTypeCards'
import FeaturesFormCompetitor from './components/FeaturesFormCompetitor'
import UploadMediaStep from './components/UploadMediaStep'
import LeadQualificationWizard from './components/LeadQualificationWizard'
import ResultSummaryCompetitor from './components/ResultSummaryCompetitor'
import AdminLogin from './components/AdminLogin'
import ContactsGroupsDashboard from './components/ContactsGroupsDashboard'
import { submitLead } from './services/leadsService'
import { clearAdminToken, getAdminToken } from './services/adminLeadsService'
import { searchAddresses, enrichAddressWithCAP } from './services/enhancedAddressService'
import { authClient } from './lib/auth-client'
import AuthModal from './components/auth/AuthModal'
import UserMenu from './components/auth/UserMenu'
import ReportUnlockModal from './components/report/ReportUnlockModal'
import ValuationAdGateModal from './components/ValuationAdGateModal'
import AdBanner from './components/ads/AdBanner'
import ProfilePage from './pages/ProfilePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import InviteGate, { INVITE_TOKEN_STORAGE_KEY } from './components/InviteGate'
import InviteAdminDashboard from './components/InviteAdminDashboard'

gsap.registerPlugin(ScrollTrigger)
const TEST_HOME_COPY_VARIANTS = {
  caide: {
    brand: 'Caide',
    nav: {
      features: 'Features',
      pricing: 'Pricing',
      contact: 'Contact us',
      login: 'Log in',
      cta: 'Start for free'
    },
    heroTitleLines: ['Get Hot Leads', 'Without Breaking', 'a Sweat'],
    heroSubtitle:
      "Caide is your AI-powered virtual campaign manager, built to make sure cold outreach doesn't feel cold.",
    heroCta: 'Try for free',
    marquee: [
      'Built for agencies, solopreneurs, and lean teams',
      'Effortless outreach that puts you on the map',
      'GDPR compliant outreach'
    ]
  },
  valuta: {
    brand: 'Valuta Facile',
    nav: {
      home: 'Home',
      features: 'Valutazione immobiliare',
      pricing: 'Prezzi immobili',
      blog: 'Blog',
      faq: 'Domande frequenti',
      support: 'Centro assistenza',
      contact: 'Contatti',
      login: 'Il mio account',
      cta: 'Inizia la valutazione'
    },
    heroTitleLines: [
      'Valuta il tuo immobile',
      'online in pochi minuti,',
      'senza impegno'
    ],
    heroSubtitle:
      'Uno strumento pensato con esperti del settore per darti una stima realistica del valore di mercato, guidandoti passo dopo passo e mantenendo sempre il controllo sui tuoi dati.',
    heroCta: 'Inizia ora',
    marquee: [
      'Dati OMI reali e aggiornati',
      'Pensato per privati, investitori e agenzie',
      'Stima online trasparente, senza obblighi'
    ]
  }
}

const ACTIVE_TEST_HOME_COPY = 'valuta'

const HERO_SLIDES = [
  {
    id: 1,
    icon: '💡',
    text: 'L’AI migliora la precisione fino al +18% rispetto alle stime standard.'
  },
  {
    id: 2,
    icon: '📊',
    text: 'I dati OMI sono integrati con analisi avanzata e trend di mercato.'
  },
  {
    id: 3,
    icon: '🏠',
    text: 'Oltre 3.000 immobili analizzati nel tuo CAP.'
  },
  {
    id: 4,
    icon: '🔎',
    text: 'Scopri il prezzo minimo, medio e massimo del tuo immobile.'
  }
]

const TEST_HOME_REVIEW_CARDS = [
  {
    id: 1,
    label: 'RECENSIONE',
    title: '“Valutazione precisa e spiegata in modo chiarissimo.”',
    meta: 'Giulia · Pescara · 5.0 ★★★★★'
  },
  {
    id: 2,
    label: 'RECENSIONE',
    title: '“In pochi minuti avevo una stima realistica del mio appartamento.”',
    meta: 'Marco · Milano · 4.9 ★★★★★'
  },
  {
    id: 3,
    label: 'RECENSIONE',
    title: '“Perfetto per farsi un’idea prima di parlare con un agente.”',
    meta: 'Sara · Roma · 4.8 ★★★★☆'
  }
]

const DEFAULT_A11Y_SETTINGS = {
  textScale: 1,
  grayscale: false,
  highContrast: false,
  negativeContrast: false,
  lightBackground: false,
  underlineLinks: false,
  readableFont: false
}

function ValuationWizardPage({
  currentPage,
  wizardStep,
  loading,
  error,
  draftAddress,
  setDraftAddress,
  selectedAddress,
  omiData,
  wizardData,
  setWizardData,
  propertyDraft,
  setPropertyDraft,
  valuationResult,
  contactData,
  isValuationUnlocked,
  adMode,
  valuationId,
  setCurrentPage,
  setWizardStep,
  setIsLeadModalOpen,
  onReportUnlocked,
  savedLeadId,
  onOpenContactForm,
  handlePrimaryCtaClick,
  handleAddressSelect,
  handlePropertySubmit,
  goBack,
  trackWizardEvent,
  restart
}) {
  return (
    <>
      {currentPage === 'address' && wizardStep === 'landing_address' && (
        <div className="py-12 sm:py-16 lg:py-20 bg-[#F5F3FF] border-t-2 border-b-2 border-slate-900">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <AddressLandingSecondaryFormSection
              loading={loading}
              error={error}
              draftAddress={draftAddress}
              setDraftAddress={setDraftAddress}
              onNext={() => setWizardStep('confirm_address')}
            />
          </div>
        </div>
      )}

      {currentPage === 'address' && wizardStep === 'confirm_address' && (
        <div className="min-h-screen bg-[#F5F3FF] border-t-2 border-b-2 border-slate-900">
          <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
            <div className="px-6 sm:px-10 lg:px-20 pt-[60px] pb-12 flex items-start">
              <AddressConfirmWithMap
                draftAddress={draftAddress}
                onBack={() => {
                  // Non tornare più alla vecchia schermata di ricerca
                  // indirizzo legacy (wizardStep 'landing_address' su
                  // currentPage 'address'): si torna invece alla home, che è
                  // l'unico punto di ingresso attuale per inserire l'indirizzo.
                  setCurrentPage('test_home')
                  setWizardStep('landing_address')
                }}
                onConfirm={handleAddressSelect}
              />
            </div>
            <div className="h-full min-h-[360px] border-t-2 lg:border-t-0 lg:border-l-2 border-slate-900">
              <MapDisplay address={draftAddress} variant="bare" />
            </div>
          </div>
        </div>
      )}

      {currentPage === 'property' && selectedAddress && omiData && (
        <PropertyWizardTwoColumnLayout wizardStep={wizardStep} address={selectedAddress}>
          {wizardStep === 'property_type' && (
            <PropertyTypeCards
              value={wizardData.propertyType}
              onChange={(type) =>
                setWizardData((prev) => ({ ...prev, propertyType: type }))
              }
              onNext={() => setWizardStep('main_features')}
              onBack={goBack}
            />
          )}
          {wizardStep !== 'property_type' && (
            <PropertyWizardInnerContent goBack={goBack}>
              {wizardStep === 'main_features' && (
                <FeaturesFormCompetitor
                  propertyDraft={propertyDraft}
                  setPropertyDraft={setPropertyDraft}
                  wizardData={wizardData}
                  setWizardData={setWizardData}
                  onBack={() => setWizardStep('property_type')}
                  onNext={() => setWizardStep('media_upload')}
                />
              )}
              {wizardStep === 'media_upload' && (
                <UploadMediaStep
                  wizardData={wizardData}
                  setWizardData={setWizardData}
                  onNext={() => setWizardStep('lead_profile')}
                  onBack={() => setWizardStep('main_features')}
                  onTrackEvent={trackWizardEvent}
                  valuationId={valuationId}
                />
              )}
              {(wizardStep === 'lead_profile' ||
                wizardStep === 'ownership_and_timing' ||
                wizardStep === 'agency_offer_and_marketing') && (
                <LeadQualificationWizard
                  wizardStep={wizardStep}
                  setWizardStep={setWizardStep}
                  wizardData={wizardData}
                  setWizardData={setWizardData}
                  onBackToMedia={() => setWizardStep('media_upload')}
                  onSubmit={() => handlePropertySubmit(propertyDraft)}
                />
              )}
            </PropertyWizardInnerContent>
          )}
        </PropertyWizardTwoColumnLayout>
      )}

      {currentPage === 'valuation' && valuationResult && (
        <ResultSummaryCompetitor
          valuationResult={valuationResult}
          contactData={contactData}
          selectedAddress={selectedAddress}
          isValuationUnlocked={isValuationUnlocked}
          adMode={adMode}
          onBackToEdit={() => {
            setCurrentPage('property')
            setWizardStep('main_features')
          }}
          onRestart={restart}
          onOpenContactForm={onOpenContactForm}
          onReportUnlocked={onReportUnlocked}
          leadId={savedLeadId}
          profileType={wizardData?.lead?.profileType}
        />
      )}
    </>
  )
}

function AddressLandingHero({
  loading,
  error,
  draftAddress,
  setDraftAddress,
  onNext,
  handlePrimaryCtaClick,
  heroSlideIndex,
  setHeroSlideIndex
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="mb-5">
        <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-[11px] font-medium text-blue-700">
          Stima gratuita · Nessun obbligo
        </span>
      </div>
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
          Valuta il tuo immobile online in pochi minuti, senza impegno
        </h1>
        <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
          Uno strumento pensato con esperti del settore per darti una stima realistica del valore di
          mercato, guidandoti passo dopo passo e mantenendo sempre il controllo sui tuoi dati.
        </p>
      </div>
      <div className="mt-8 w-full max-w-3xl">
        <div className="bg-white/90 backdrop-blur rounded-3xl border border-gray-200/80 shadow-lg shadow-gray-200/60 px-4 sm:px-6 py-5 sm:py-6">
          {!loading && (
            <AddressLanding
              draftAddress={draftAddress}
              setDraftAddress={setDraftAddress}
              onNext={onNext}
            />
          )}
          {loading && (
            <div className="flex justify-center items-center py-6">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
                <p className="text-sm text-gray-700">Recupero dati OMI...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="mt-4">
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs sm:text-sm">
                ⚠️ {error}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-7 w-full max-w-3xl">
        <div className="hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          <button
            type="button"
            onClick={handlePrimaryCtaClick}
            className="flex flex-col items-start justify-between h-full rounded-2xl border border-blue-600 bg-blue-600 text-white px-5 py-5 sm:px-6 sm:py-6 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 hover:scale-[1.02] transition-all duration-200"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[13px] sm:text-sm font-semibold">
                Valuta con AI
              </span>
              <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                New
              </span>
            </div>
            <span className="mt-2 text-[11px] text-blue-50">
              Valutazione standard potenziata dall&apos;AI.
            </span>
          </button>
          <button
            type="button"
            disabled
            className="flex flex-col items-start justify-between h-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-5 sm:px-6 sm:py-6 text-gray-700 cursor-not-allowed"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[13px] sm:text-sm font-semibold">
                Valuta la tua ristrutturazione
              </span>
              <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-800">
                In arrivo
              </span>
            </div>
            <span className="mt-2 text-[11px] text-gray-500">
              Rimani connesso, stiamo preparando questa funzione.
            </span>
          </button>
          <button
            type="button"
            onClick={handlePrimaryCtaClick}
            className="flex flex-col items-start justify-between h-full rounded-2xl border border-gray-200 bg-white px-5 py-5 sm:px-6 sm:py-6 text-gray-900 shadow-sm hover:border-blue-200 hover:bg-blue-50/60 hover:shadow-md transition-all duration-200"
          >
            <span className="text-[13px] sm:text-sm font-semibold">
              Analizza il prezzo al mq della tua zona
            </span>
            <span className="mt-1 text-[11px] text-gray-500">
              Usa la stessa valutazione standard come base di confronto.
            </span>
          </button>
          <button
            type="button"
            onClick={handlePrimaryCtaClick}
            className="flex flex-col items-start justify-between h-full rounded-2xl border border-gray-200 bg-white px-5 py-5 sm:px-6 sm:py-6 text-gray-900 shadow-sm hover:border-blue-200 hover:bg-blue-50/60 hover:shadow-md transition-all duration-200"
          >
            <span className="text-[13px] sm:text-sm font-semibold">
              Confronta con vendite recenti
            </span>
            <span className="mt-1 text-[11px] text-gray-500">
              Placeholder, collegato alla valutazione corrente.
            </span>
          </button>
        </div>
      </div>
      <div className="mt-10 w-full max-w-3xl">
        <div className="rounded-3xl border border-gray-200 bg-white/90 px-4 sm:px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-lg">
                {HERO_SLIDES[heroSlideIndex].icon}
              </div>
              <p className="text-sm sm:text-[15px] text-gray-800">
                {HERO_SLIDES[heroSlideIndex].text}
              </p>
            </div>
            <div className="hidden sm:flex items-center space-x-1">
              {HERO_SLIDES.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setHeroSlideIndex(index)}
                  className={`h-1.5 rounded-full transition-all ${
                    index === heroSlideIndex ? 'w-5 bg-blue-600' : 'w-2 bg-gray-300'
                  }`}
                  aria-label={`Mostra slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
          <div className="mt-3 flex sm:hidden justify-center space-x-1">
            {HERO_SLIDES.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setHeroSlideIndex(index)}
                className={`h-1.5 rounded-full transition-all ${
                  index === heroSlideIndex ? 'w-4 bg-blue-600' : 'w-2 bg-gray-300'
                }`}
                aria-label={`Mostra slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function AddressLandingFaqSection() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">
        Domande frequenti
      </h3>
      <div className="mt-3 space-y-3 text-sm text-gray-700">
        <div>
          <p className="font-semibold text-gray-900">
            La valutazione è davvero gratuita?
          </p>
          <p className="text-gray-600">
            Sì. Utilizzare Valuta Facile per ottenere una stima non ha costi e non comporta obblighi di affidarti a un&apos;agenzia o a un professionista.
          </p>
        </div>
        <div>
          <p className="font-semibold text-gray-900">
            Cosa succede dopo che ho ricevuto la valutazione?
          </p>
          <p className="text-gray-600">
            Puoi semplicemente tenerla per te, usarla come riferimento oppure chiederci supporto per capire come valorizzare al meglio il tuo immobile. Nessun passaggio è automatico o imposto.
          </p>
        </div>
        <div>
          <p className="font-semibold text-gray-900">
            Devo lasciare per forza il mio numero di telefono?
          </p>
          <p className="text-gray-600">
            No. Puoi decidere quali recapiti indicarci e come preferisci essere ricontattato. Se non vuoi telefonate, lo rispettiamo.
          </p>
        </div>
        <div>
          <p className="font-semibold text-gray-900">
            La stima è uguale a quella di un perito o di un agente?
          </p>
          <p className="text-gray-600">
            La nostra è una valutazione online, pensata come base di partenza. È molto utile per orientarti e può essere poi approfondita insieme a un professionista, se lo desideri.
          </p>
        </div>
      </div>
    </div>
  )
}

function AddressLandingSecondaryFormSection({
  loading,
  error,
  draftAddress,
  setDraftAddress,
  onNext
}) {
  return (
    <section className="rounded-3xl border border-blue-200 bg-white px-4 sm:px-8 py-8 sm:py-10 shadow-sm">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-blue-700 uppercase">
          PROVA SUBITO
        </p>
        <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-gray-900 leading-tight">
          Inserisci l&apos;indirizzo e ottieni la tua stima
        </h2>
        <p className="mt-3 text-sm sm:text-base text-gray-700">
          Usa lo stesso motore di valutazione dell&apos;inizio pagina: inserisci la via del tuo immobile e prosegui con pochi passaggi guidati.
        </p>
      </div>
      <div className="mt-6 w-full max-w-3xl mx-auto">
        <div className="bg-white/90 backdrop-blur rounded-3xl border border-gray-200/80 shadow-lg shadow-gray-200/60 px-4 sm:px-6 py-5 sm:py-6">
          {!loading && (
            <AddressLanding
              draftAddress={draftAddress}
              setDraftAddress={setDraftAddress}
              onNext={onNext}
            />
          )}
          {loading && (
            <div className="flex justify-center items-center py-6">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
                <p className="text-sm text-gray-700">Recupero dati OMI...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="mt-4">
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs sm:text-sm">
                ⚠️ {error}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function AddressLandingInfoSections({
  handlePrimaryCtaClick,
  loading,
  error,
  draftAddress,
  setDraftAddress,
  onNext
}) {
  return (
    <div className="mt-14 border-t border-gray-200 bg-white/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.3fr,1fr] items-start">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
              Come funziona Valuta Facile
            </h2>
            <p className="mt-2 text-sm sm:text-base text-gray-600">
              Ti guidiamo in tre semplici passi, senza tecnicismi e senza obblighi.
            </p>
            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                  1
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Inserisci i dati dell&apos;immobile
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Ti chiediamo solo le informazioni davvero utili: indirizzo, caratteristiche principali e qualche dettaglio in più se vuoi rendere la stima ancora più precisa.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                  2
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Lascia che il sistema lavori per te
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Il motore di valutazione incrocia i tuoi dati con valori di zona, caratteristiche simili e analisi interne per costruire una stima realistica del prezzo.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                  3
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Ricevi una stima chiara, pronta da usare
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Vedi subito una fascia di valore spiegata con parole semplici. Puoi salvarla, confrontarla e – solo se vuoi – chiederci supporto per fare il passo successivo.
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-gray-500">
                La valutazione non ti vincola a nulla: sei tu a decidere se parlarne con un professionista o usarla solo per orientarti.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Perché sempre più persone si affidano a Valuta Facile
            </p>
            <p className="mt-2 text-sm text-gray-700">
              Non promettiamo miracoli: ti offriamo un quadro chiaro per decidere con consapevolezza.
            </p>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div>
                <p className="font-semibold text-gray-900">
                  Semplifichiamo ciò che è complesso
                </p>
                <p className="text-gray-600">
                  Traduciamo dati e modelli in indicazioni chiare, che puoi comprendere e spiegare anche ad altri.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  Percorso pensato con esperti
                </p>
                <p className="text-gray-600">
                  Le domande che ti facciamo derivano da uno studio UX dedicato: meno frizioni, più chiarezza, più controllo per te.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  Trasparenza sul risultato
                </p>
                <p className="text-gray-600">
                  Ti spieghiamo quali fattori pesano di più sul valore (zona, stato, metratura, piano, ecc.), così la stima non è un numero “magico” ma uno strumento che puoi usare in modo intelligente.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  Rispetto per tempo e dati
                </p>
                <p className="text-gray-600">
                  Riduciamo le richieste superflue, non ti bombardiamo di telefonate e ti diamo sempre la possibilità di scegliere come essere ricontattato.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-white/80 to-blue-50/70 border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-10">
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
              Per chi è pensato Valuta Facile
            </h2>
            <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-3xl">
              Il servizio è utile se ti riconosci almeno in una di queste situazioni.
            </p>
            <div className="mt-6 grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
                <p className="text-sm font-semibold text-gray-900">
                  Stai valutando se vendere
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Vuoi capire se è il momento giusto, senza essere subito contattato da agenzie e senza impegni.
                </p>
              </div>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
                <p className="text-sm font-semibold text-gray-900">
                  Vuoi una base per ragionare
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Ti serve un primo numero per confrontare preventivi, quote tra eredi o proposte d&apos;acquisto.
                </p>
              </div>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
                <p className="text-sm font-semibold text-gray-900">
                  Vuoi parlare con un&apos;agenzia preparato
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Prima di affidarti a un professionista vuoi avere un&apos;idea autonoma del valore del tuo immobile.
                </p>
              </div>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
                <p className="text-sm font-semibold text-gray-900">
                  Gestisci più immobili o lavori nel settore
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Hai bisogno di uno strumento rapido per generare valutazioni preliminari da affinare con la tua esperienza.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
              Cosa dicono le persone che hanno usato Valuta Facile
            </h2>
            <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-3xl">
              Le frasi sono esempi rappresentativi del tipo di feedback che raccogliamo dagli utenti.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col">
                <p className="text-sm font-semibold text-gray-900">
                  Francesca, proprietaria a Milano
                </p>
                <p className="mt-2 text-sm text-gray-600 flex-1">
                  “Avevo già chiesto una valutazione a un&apos;agenzia, ma non mi era chiaro come ci fossero arrivati. Con Valuta Facile ho potuto vedere passo per passo quali fattori incidevano sul valore e mi sono sentita più sicura nel trattare.”
                </p>
              </div>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col">
                <p className="text-sm font-semibold text-gray-900">
                  Marco, erede di un appartamento a Torino
                </p>
                <p className="mt-2 text-sm text-gray-600 flex-1">
                  “Dovevamo accordarci tra fratelli sul prezzo di vendita. La stima online ci ha dato un riferimento neutrale e spiegato bene su cui costruire una decisione condivisa.”
                </p>
              </div>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col">
                <p className="text-sm font-semibold text-gray-900">
                  Sara, futura venditrice a Roma
                </p>
                <p className="mt-2 text-sm text-gray-600 flex-1">
                  “Mi preoccupava lasciare i miei dati. Qui mi è stato spiegato chiaramente come sarebbero stati usati, e ho potuto scegliere io se farmi ricontattare o no.”
                </p>
              </div>
            </div>
          </section>

          <section>
            <div className="grid gap-8 lg:grid-cols-[1.1fr,1fr] items-start">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
                  I tuoi dati restano sotto il tuo controllo
                </h2>
                <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-3xl">
                  Per costruire una valutazione credibile servono informazioni reali. Per questo proteggere i tuoi dati è una priorità, non un dettaglio tecnico.
                </p>
                <div className="mt-4 space-y-2 text-sm text-gray-700">
                  <p>
                    • Usiamo i tuoi dati solo per fornirti la valutazione e i servizi che richiedi.
                  </p>
                  <p>
                    • Non vendiamo le tue informazioni: eventuali contatti con agenzie o professionisti avvengono solo se ci autorizzi esplicitamente.
                  </p>
                  <p>
                    • Puoi chiederci in ogni momento di aggiornare o cancellare i tuoi dati, come previsto dalla normativa sulla privacy.
                  </p>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Vuoi saperne di più? Puoi consultare la privacy policy completa e il registro dei trattamenti direttamente dall&apos;applicazione.
                </p>
              </div>
              <AddressLandingFaqSection />
            </div>
          </section>

          <section className="rounded-3xl border border-blue-100 bg-blue-50/70 px-4 sm:px-8 py-6 sm:py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                Fai il primo passo con Valuta Facile
              </h2>
              <p className="mt-2 text-sm sm:text-base text-gray-700 max-w-2xl">
                In pochi minuti puoi avere una stima del valore del tuo immobile, spiegata in modo chiaro e pensata per aiutarti a decidere con più consapevolezza.
              </p>
            </div>
            <div className="w-full sm:w-auto">
              <button
                type="button"
                onClick={handlePrimaryCtaClick}
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Inizia la tua valutazione ora
              </button>
              <p className="mt-1.5 text-[11px] text-gray-600">
                Nessun impegno, nessun vincolo: solo uno strumento in più per prendere la decisione giusta per te.
              </p>
            </div>
          </section>

          <AddressLandingSecondaryFormSection
            loading={loading}
            error={error}
            draftAddress={draftAddress}
            setDraftAddress={setDraftAddress}
            onNext={onNext}
          />
        </div>
      </div>
    </div>
  )
}

function PropertyWizardTwoColumnLayout({ wizardStep, address, children }) {
  return (
    <div className="min-h-screen bg-[#F5F3FF] border-t-2 border-b-2 border-slate-900">
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr,0.85fr] min-h-screen">
        <div className="min-w-0 px-6 sm:px-10 lg:px-20 py-10 lg:py-16 flex items-center justify-center">
          {children}
        </div>
        <div className="hidden lg:flex bg-[#EAF2F8] px-6 lg:px-12 py-12 items-center justify-center border-l-2 border-slate-900">
          <WizardStepperSidebar wizardStep={wizardStep} address={address} />
        </div>
      </div>
    </div>
  )
}

function PropertyWizardInnerContent({ goBack, children }) {
  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-6">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center text-xs sm:text-sm font-semibold text-slate-900 hover:underline"
        >
          ← Cambia indirizzo
        </button>
      </div>
      <div className="space-y-8">
        <div>{children}</div>
      </div>
    </div>
  )
}

function App() {
  const [selectedAddress, setSelectedAddress] = useState(null)
  const [draftAddress, setDraftAddress] = useState(null)
  const [propertyDraft, setPropertyDraft] = useState({
    livingArea: 75,
    balconyArea: 0,
    terraceArea: 0,
    verandaArea: 0,
    loftArea: 0,
    atticArea: 0,
    basementArea: 0,
    gardenArea: 0,
    rooftopArea: 0,
    condition: 'Buono',
    floor: 1,
    hasElevator: false,
    rooms: 1,
    bathrooms: 1,
    yearBuilt: ''
  })
  const [propertyData, setPropertyData] = useState(null)
  const [valuationResult, setValuationResult] = useState(null)
  // Rif "specchio" di propertyData/valuationResult: gli state React sono aggiornati in
  // modo asincrono (batching), quindi una closure creata prima del re-render (es. il
  // form di contatto aperto subito dopo handlePropertySubmit) può leggere un valore
  // ancora vecchio o nullo. I ref invece sono sempre letti "live" al momento dell'uso,
  // quindi eliminano la race condition che causava report con dati sballati/di default
  // (superficie a 80mq invece di quella reale, piano/ascensore persi, prezzo diverso
  // tra anteprima gratuita e report finale).
  const propertyDataRef = useRef(null)
  const valuationResultRef = useRef(null)
  const [loading, setLoading] = useState(false)
  // Default 'test_home' (non 'address'): con 'address' il primo render, prima
  // che l'effetto di parsing dell'URL (poco sotto) corregga la pagina in base
  // al path reale, mostrava per un istante la vecchia schermata di ricerca
  // indirizzo legacy (currentPage 'address' + wizardStep 'landing_address').
  const [currentPage, setCurrentPage] = useState('test_home')
  const [omiData, setOmiData] = useState(null)
  const [error, setError] = useState('')
  const [contactData, setContactData] = useState(null)
  const [contactPageMessage, setContactPageMessage] = useState('')
  const [supportPageMessage, setSupportPageMessage] = useState('')
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterMessage, setNewsletterMessage] = useState('')
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [savedLeadId, setSavedLeadId] = useState(null)
  const { data: session } = authClient.useSession()
  const [isValuationUnlocked, setIsValuationUnlocked] = useState(false)
  // Modalità pubblicità: 'off' | 'banner' | 'demo_rewarded' | 'live_rewarded'
  const [adMode, setAdMode] = useState('off')
  const [isAdModeSaving, setIsAdModeSaving] = useState(false)
  const [isAdGateOpen, setIsAdGateOpen] = useState(false)
  const [isAdminDashboard, setIsAdminDashboard] = useState(false)
  const [isAdminLogin, setIsAdminLogin] = useState(false)
  const [adminTab, setAdminTab] = useState('overview')
  const [wizardStep, setWizardStep] = useState('landing_address')
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem('valutatore_maintenance_mode') === 'on'
    } catch (e) {
      return false
    }
  })
  const [valuationId] = useState(() => `val_${Date.now()}`)
  // Fase pre-lancio: gate con codice invito (vedi InviteGate.jsx). Di
  // default 'disabled' (nessun blocco) finché non arriva la risposta dal
  // backend, così se il gate non è configurato o l'endpoint non risponde
  // il sito continua a funzionare normalmente ("fail open").
  const [inviteGateState, setInviteGateState] = useState('disabled')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const base = (
      import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
    ).replace(/\/+$/, '')
    fetch(`${base}/invite/status`)
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then(async (data) => {
        if (!data?.enabled) {
          setInviteGateState('disabled')
          return
        }
        const token = window.localStorage.getItem(INVITE_TOKEN_STORAGE_KEY)
        if (!token) {
          setInviteGateState('locked')
          return
        }
        try {
          const statusRes = await fetch(`${base}/invite/token-status?token=${encodeURIComponent(token)}`)
          const statusData = statusRes.ok ? await statusRes.json() : { valid: false }
          if (!statusData.valid) {
            window.localStorage.removeItem(INVITE_TOKEN_STORAGE_KEY)
            setInviteGateState('locked')
          } else if (statusData.remaining <= 0) {
            // Limite di valutazioni raggiunto: l'utente può comunque
            // navigare il sito, si blocca solo l'avvio di nuove valutazioni
            // (vedi handlePropertySubmit).
            setInviteGateState('limit_reached')
          } else {
            setInviteGateState('unlocked')
          }
        } catch (e) {
          // Errore di rete sul controllo token: non blocchiamo chi ha già
          // un token plausibile, meglio lasciar passare che bloccare un
          // tester legittimo per un problema temporaneo di connessione.
          setInviteGateState('unlocked')
        }
      })
      .catch(() => {
        setInviteGateState('disabled')
      })
  }, [])
  const [currentProvinceSlug, setCurrentProvinceSlug] = useState(null)
  const currentProvinceName = currentProvinceSlug ? slugToProvinceName(currentProvinceSlug) : ''
  const [provinceMarketData, setProvinceMarketData] = useState(null)
  const [provinceMarketDataLoading, setProvinceMarketDataLoading] = useState(false)
  const [wizardData, setWizardData] = useState({
    propertyType: null,
    features: {
      rooms: 1,
      bathrooms: 1,
      heating: '',
      yearBuilt: '',
      energyClass: '',
      mansardaLowCeilingPercent: '',
      loftCeilingHeight: ''
    },
    extra: {
      hasBalconyOrTerrace: false,
      hasGarden: false,
      hasGarage: false,
      hasCantina: false,
      hasPiscina: false,
      terraceArea: '',
      gardenArea: '',
      garageArea: '',
      garageAddress: null,
      cantinaArea: ''
    },
    lead: {
      profileType: 'PROPRIETARIO', // 'PROPRIETARIO' | 'CLIENTE_ACQUIRENTE' | 'PROFESSIONISTA'
      // Proprietario
      saleTiming: '',
      wantAgenciesValuation: false,
      // Cliente Acquirente
      buyerStage: '',
      buyerFinancing: '',
      buyerTimeline: '',
      buyerWantsSupport: false,
      // Professionista
      proRole: '',
      proAgencyName: '',
      proPurpose: '',
      proHasMandate: '',
      // Comune a tutti i profili
      marketingConsent: false
    },
    media: {
      floorPlanFile: null,
      photos: [],
      skippedUploadStep: false,
      aiFeatures: null,
      mediaId: null
    }
  })
  const [isTestHomeMenuOpen, setIsTestHomeMenuOpen] = useState(false)
  const [isA11yPanelOpen, setIsA11yPanelOpen] = useState(false)
  const [a11ySettings, setA11ySettings] = useState(DEFAULT_A11Y_SETTINGS)
  const [openFaqIndex, setOpenFaqIndex] = useState(0)
  const [cookieConsent, setCookieConsent] = useState(() => {
    if (typeof window === 'undefined') return { statistiche: false, marketing: false }
    try {
      const raw = window.localStorage.getItem('valutatore_cookie_consent_v2')
      const parsed = raw ? JSON.parse(raw) : null
      return parsed && typeof parsed === 'object'
        ? { statistiche: !!parsed.statistiche, marketing: !!parsed.marketing }
        : { statistiche: false, marketing: false }
    } catch (e) {
      return { statistiche: false, marketing: false }
    }
  })
  const [hasDecidedCookieConsent, setHasDecidedCookieConsent] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem('valutatore_cookie_consent_v2') !== null
    } catch (e) {
      return false
    }
  })
  const [isCookiePanelExpanded, setIsCookiePanelExpanded] = useState(false)
  const [isCookieSettingsForcedOpen, setIsCookieSettingsForcedOpen] = useState(false)

  const persistCookieConsent = (next) => {
    setCookieConsent(next)
    setHasDecidedCookieConsent(true)
    setIsCookieSettingsForcedOpen(false)
    setIsCookiePanelExpanded(false)
    try {
      window.localStorage.setItem(
        'valutatore_cookie_consent_v2',
        JSON.stringify({ ...next, decidedAt: new Date().toISOString() })
      )
    } catch (e) {
      console.error('Errore salvataggio preferenze cookie:', e)
    }
  }

  const handleAcceptAllCookies = () => persistCookieConsent({ statistiche: true, marketing: true })
  const handleRejectNonEssentialCookies = () => persistCookieConsent({ statistiche: false, marketing: false })
  const handleSaveCustomCookies = () => persistCookieConsent(cookieConsent)
  const handleOpenCookieSettings = () => {
    setIsCookieSettingsForcedOpen(true)
    setIsCookiePanelExpanded(true)
  }
  const [currentBlogSlug, setCurrentBlogSlug] = useState(null)
  const [blogCategoryFilter, setBlogCategoryFilter] = useState('Tutte')
  const [testHomeQuery, setTestHomeQuery] = useState('')
  const [testHomeSuggestions, setTestHomeSuggestions] = useState([])
  const [testHomeLoading, setTestHomeLoading] = useState(false)
  const [testHomeError, setTestHomeError] = useState('')
  const testHomeTimeoutRef = useRef(null)
  const provinceViewStartRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        'valutatore_maintenance_mode',
        isMaintenanceMode ? 'on' : 'off'
      )
    } catch (e) {
    }
  }, [isMaintenanceMode])

  // Legge la modalità pubblicità attiva (off / banner / demo_rewarded / live_rewarded)
  useEffect(() => {
    const base = (
      import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
    ).replace(/\/+$/, '')
    fetch(`${base}/config`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.adMode) setAdMode(data.adMode)
      })
      .catch(e => {
        console.error('Errore lettura configurazione pubblicità:', e)
      })
  }, [])

  // Intercetta ritorno da Stripe Checkout (?session_id=...) — SOLO per il vecchio
  // flusso di acquisto anonimo, che reindirizzava alla home perché l'utente non aveva
  // ancora una sessione autenticata (l'account veniva creato in background dal webhook
  // Stripe con una password casuale). Il flusso attivo oggi richiede il login PRIMA del
  // pagamento e reindirizza sempre a /profilo con ?session_id=..., che deve restare
  // intatto: lo gestisce ProfilePage stesso (chiama /payment/confirm-session). Se
  // intercettassimo session_id qui per QUALSIASI pagina, lo distruggeremmo prima che
  // ProfilePage riesca a leggerlo — per questo escludiamo esplicitamente /profilo.
  const [showPaymentSuccessBanner, setShowPaymentSuccessBanner] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const path = window.location.pathname
    if (path === '/profilo' || path === '/profilo/') return
    const params = new URLSearchParams(window.location.search)
    const stripeSessionId = params.get('session_id')
    if (stripeSessionId) {
      window.history.replaceState({}, '', window.location.pathname)
      setShowPaymentSuccessBanner(true)
    }
  }, [])

  const BLOG_DEFAULT_CATEGORY = 'Tutte'
  const blogCategories = [
    BLOG_DEFAULT_CATEGORY,
    ...Array.from(new Set(BLOG_ARTICLES_PLACEHOLDER.map((article) => article.tag)))
  ]
  const filteredBlogArticles =
    blogCategoryFilter === BLOG_DEFAULT_CATEGORY
      ? BLOG_ARTICLES_PLACEHOLDER
      : BLOG_ARTICLES_PLACEHOLDER.filter((article) => article.tag === blogCategoryFilter)
  const currentBlogArticle = currentBlogSlug
    ? BLOG_ARTICLES_PLACEHOLDER.find((article) => article.slug === currentBlogSlug)
    : null
  const relatedBlogArticles =
    currentBlogArticle
      ? BLOG_ARTICLES_PLACEHOLDER.filter(
          (article) =>
            article.id !== currentBlogArticle.id &&
            (article.tag === currentBlogArticle.tag || article.level === currentBlogArticle.level)
        ).slice(0, 3)
      : []

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    let title = 'Valuta Facile – Valutazione immobiliare online'
    let description =
      'Calcola la valutazione del tuo immobile online in pochi minuti, con un percorso guidato e spiegazioni chiare.'

    if (currentPage === 'blog') {
      title = 'Blog Valuta Facile – Guide sulla valutazione immobiliare e sul mercato'
      description =
        'Articoli semplici e pratici per capire meglio il valore del tuo immobile, il mercato e le strategie di vendita.'
    } else if (currentPage === 'blog-detail' && currentBlogArticle) {
      title =
        currentBlogArticle.seoTitle ||
        `${currentBlogArticle.title} | Blog Valuta Facile`
      description =
        currentBlogArticle.seoDescription ||
        'Approfondimenti pratici per orientarti nella valutazione e nella vendita del tuo immobile.'
    } else if (currentPage === 'province-landing' && currentProvinceSlug) {
      const provinceName = slugToProvinceName(currentProvinceSlug)
      title = `Valutazione casa a ${provinceName} | Valuta Facile`
      description = `Pagina dedicata a chi vuole una valutazione immobiliare a ${provinceName} e provincia, con esempi pratici e accesso diretto alla stima online.`
    } else if (currentPage === 'privacy') {
      title = 'Privacy policy | Valuta Facile'
      description =
        'Informazioni dettagliate su come Valuta Facile tratta i tuoi dati personali in modo trasparente.'
    } else if (currentPage === 'terms') {
      title = 'Termini di utilizzo | Valuta Facile'
      description =
        'Condizioni di utilizzo del servizio di valutazione immobiliare online Valuta Facile.'
    } else if (currentPage === 'cookies') {
      title = 'Cookie & consenso | Valuta Facile'
      description =
        'Informazioni su cookie, tecnologie simili e gestione del consenso su Valuta Facile.'
    } else if (currentPage === 'contact') {
      title = 'Contatti | Valuta Facile'
      description =
        'Scrivi al team Valuta Facile per collaborazioni, domande sulla valutazione o partnership immobiliari.'
    } else if (currentPage === 'support') {
      title = 'Centro assistenza | Valuta Facile'
      description =
        'Richiedi assistenza tecnica, supporto sull’account o chiarimenti sull’utilizzo di Valuta Facile.'
    } else if (currentPage === 'faq') {
      title = 'Domande frequenti | Valuta Facile'
      description =
        'Risposte rapide alle domande più comuni su valutazioni, dati e funzionamento di Valuta Facile.'
    }

    document.title = title

    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = description

    let canonicalPath = '/'
    if (currentPage === 'blog') canonicalPath = '/blog'
    else if (currentPage === 'blog-detail' && currentBlogArticle) {
      canonicalPath = `/blog/${currentBlogArticle.slug}`
    } else if (currentPage === 'province-landing' && currentProvinceSlug) {
      canonicalPath = `/valutazione-casa-${currentProvinceSlug}`
    } else if (currentPage === 'privacy') canonicalPath = '/privacy'
    else if (currentPage === 'terms') canonicalPath = '/termini-di-utilizzo'
    else if (currentPage === 'cookies') canonicalPath = '/cookie-consenso'
    else if (currentPage === 'contact') canonicalPath = '/contatti'
    else if (currentPage === 'support') canonicalPath = '/centro-assistenza'
    else if (currentPage === 'faq') canonicalPath = '/domande-frequenti'
    else if (currentPage === 'test_home') canonicalPath = '/home'

    let canonicalLink = document.querySelector('link[rel="canonical"]')
    if (!canonicalLink) {
      canonicalLink = document.createElement('link')
      canonicalLink.rel = 'canonical'
      document.head.appendChild(canonicalLink)
    }
    canonicalLink.href = `https://valutafacile.it${canonicalPath}`

    const setOgMeta = (property, content) => {
      let tag = document.querySelector(`meta[property="${property}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('property', property)
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', content)
    }
    setOgMeta('og:title', title)
    setOgMeta('og:description', description)
    setOgMeta('og:url', `https://valutafacile.it${canonicalPath}`)
    setOgMeta('og:type', canonicalPath.startsWith('/blog/') ? 'article' : 'website')
  }, [currentPage, currentBlogArticle, currentProvinceSlug])

  // JSON-LD (schema.org): Organization + WebSite sempre presenti; BreadcrumbList
  // e FAQPage aggiunti/rimossi in base alla pagina corrente. Iniettati come
  // <script> nel <head> (identificati da id, un solo tag per tipo) invece che
  // nella JSX di ogni pagina, così funzionano per qualunque pagina senza dover
  // toccare ogni singolo blocco di render.
  useEffect(() => {
    if (typeof document === 'undefined') return

    const upsertLdJson = (id, data) => {
      if (!data) {
        const existing = document.getElementById(id)
        if (existing) existing.remove()
        return
      }
      let script = document.getElementById(id)
      if (!script) {
        script = document.createElement('script')
        script.type = 'application/ld+json'
        script.id = id
        document.head.appendChild(script)
      }
      script.textContent = JSON.stringify(data)
    }

    const SITE_URL = 'https://valutafacile.it'

    upsertLdJson('ld-organization', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Valuta Facile',
      legalName: "Marconi 138 S.r.l.",
      url: SITE_URL,
      logo: `${SITE_URL}/assets/Risorsa 2.png`,
      email: 'info@valutafacile.it',
      address: {
        '@type': 'PostalAddress',
        streetAddress: "Via F. Ferdinando D'Avalos 66",
        postalCode: '65126',
        addressLocality: 'Pescara',
        addressRegion: 'PE',
        addressCountry: 'IT'
      }
    })

    upsertLdJson('ld-website', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Valuta Facile',
      publisher: { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/blog?q={search_term_string}`
        },
        'query-input': 'required name=search_term_string'
      }
    })

    const breadcrumbList = (items) => ({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: `${SITE_URL}${item.path}`
      }))
    })

    if (currentPage === 'blog') {
      upsertLdJson('ld-breadcrumb', breadcrumbList([
        { name: 'Home', path: '/home' },
        { name: 'Blog', path: '/blog' }
      ]))
    } else if (currentPage === 'blog-detail' && currentBlogArticle) {
      upsertLdJson('ld-breadcrumb', breadcrumbList([
        { name: 'Home', path: '/home' },
        { name: 'Blog', path: '/blog' },
        { name: currentBlogArticle.title, path: `/blog/${currentBlogArticle.slug}` }
      ]))
    } else if (currentPage === 'province-landing' && currentProvinceSlug) {
      const provinceName = slugToProvinceName(currentProvinceSlug)
      upsertLdJson('ld-breadcrumb', breadcrumbList([
        { name: 'Home', path: '/home' },
        { name: `Valutazione casa a ${provinceName}`, path: `/valutazione-casa-${currentProvinceSlug}` }
      ]))
    } else if (currentPage === 'faq') {
      upsertLdJson('ld-breadcrumb', breadcrumbList([
        { name: 'Home', path: '/home' },
        { name: 'Domande frequenti', path: '/domande-frequenti' }
      ]))
    } else {
      upsertLdJson('ld-breadcrumb', null)
    }

    if (currentPage === 'faq') {
      upsertLdJson('ld-faq', {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ_PAGE_ITEMS.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer
          }
        }))
      })
    } else if (
      currentPage === 'blog-detail' &&
      currentBlogArticle &&
      Array.isArray(currentBlogArticle.faq) &&
      currentBlogArticle.faq.length > 0
    ) {
      upsertLdJson('ld-faq', {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: currentBlogArticle.faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer
          }
        }))
      })
    } else {
      upsertLdJson('ld-faq', null)
    }
  }, [currentPage, currentBlogArticle, currentProvinceSlug])

  useEffect(() => {
    if (currentPage !== 'province-landing' || !currentProvinceSlug) {
      setProvinceMarketData(null)
      return
    }
    let cancelled = false
    setProvinceMarketDataLoading(true)
    const base = (
      import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
    ).replace(/\/+$/, '')
    fetch(`${base}/mercato/${encodeURIComponent(currentProvinceSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setProvinceMarketData(data?.market || null)
      })
      .catch(() => {
        if (!cancelled) setProvinceMarketData(null)
      })
      .finally(() => {
        if (!cancelled) setProvinceMarketDataLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentPage, currentProvinceSlug])

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const path = url.pathname
      const adminParam = url.searchParams.get('admin')
      const pathIsRoot = path === '/' || path === ''
      const pathIsPrivacy = path === '/privacy' || path === '/privacy/'
      const pathIsTerms =
        path === '/termini-di-utilizzo' || path === '/termini-di-utilizzo/'
      const pathIsCookies =
        path === '/cookie-consenso' || path === '/cookie-consenso/'
      const pathIsPre = path === '/pre' || path === '/pre/'
      const pathIsHome = path === '/home' || path === '/home/'
      const pathIsVecchiaHome = path === '/vecchiahome' || path === '/vecchiahome/'
      const pathIsValutazione =
        path === '/valutazione' || path === '/valutazione/'
      const pathIsProfilo = path === '/profilo' || path === '/profilo/'
      const pathIsResetPassword = path === '/reset-password' || path === '/reset-password/'
      const pathIsCreaPassword = path === '/crea-password' || path === '/crea-password/'
      const pathIsContact = path === '/contatti' || path === '/contatti/'
      const pathIsSupport =
        path === '/centro-assistenza' || path === '/centro-assistenza/'
      const pathIsFaq =
        path === '/domande-frequenti' || path === '/domande-frequenti/'
      const pathIsAdminLogin =
        path === '/admin/login' || path === '/admin/login/'
      const pathIsAdminDashboardPath =
        path === '/admin' ||
        path === '/admin/' ||
        path.startsWith('/admin/contatti') ||
        path.startsWith('/admin/gruppi') ||
        path.startsWith('/admin/analytics')
      const blogDetailMatch = path.match(/^\/blog\/([^/]+)/)
      const pathIsBlogRoot = path === '/blog' || path === '/blog/'
      const provinceLandingMatch = path.match(/^\/landing\/([^/]+)/)
      const legacyProvinceLandingMatch = path.match(/^\/valutazione-casa-([^/]+)/)
      const provinceAliasMatch = path.match(/^\/province\/([^/]+)/)
      const provinceSlug = provinceLandingMatch
        ? provinceLandingMatch[1]
        : legacyProvinceLandingMatch
          ? legacyProvinceLandingMatch[1]
          : provinceAliasMatch
            ? provinceAliasMatch[1]
            : null
      const hasToken = !!getAdminToken()

      if (adminParam || pathIsAdminLogin || pathIsAdminDashboardPath) {
        if (hasToken && (pathIsAdminDashboardPath || adminParam)) {
          setIsAdminDashboard(true)
          setIsAdminLogin(false)
          if (path.startsWith('/admin/contatti')) {
            setAdminTab('contacts')
          } else if (path.startsWith('/admin/gruppi')) {
            setAdminTab('groups-auto')
          } else if (path.startsWith('/admin/analytics')) {
            setAdminTab('analytics')
          } else {
            setAdminTab('overview')
          }
        } else {
          setIsAdminLogin(true)
          setIsAdminDashboard(false)
        }
      } else if (isMaintenanceMode) {
        setCurrentPage('pre')
        setWizardStep('landing_address')
        if (typeof window !== 'undefined') {
          try {
            window.history.replaceState({}, '', '/pre')
          } catch (e) {
          }
          window.scrollTo(0, 0)
        }
      } else if (pathIsRoot) {
        setCurrentPage('test_home')
        setWizardStep('landing_address')
        if (typeof window !== 'undefined') {
          try {
            window.history.replaceState({}, '', '/home')
          } catch (e) {
          }
        }
      } else if (pathIsPrivacy) {
        setCurrentPage('privacy')
        setWizardStep('landing_address')
      } else if (pathIsTerms) {
        setCurrentPage('terms')
        setWizardStep('landing_address')
      } else if (pathIsCookies) {
        setCurrentPage('cookies')
        setWizardStep('landing_address')
      } else if (pathIsPre) {
        setCurrentPage('test_home')
        setWizardStep('landing_address')
        if (typeof window !== 'undefined') {
          try {
            window.history.replaceState({}, '', '/home')
          } catch (e) {
          }
        }
      } else if (pathIsHome) {
        setCurrentPage('test_home')
        setWizardStep('landing_address')
      } else if (pathIsVecchiaHome) {
        setCurrentPage('test_home')
        setWizardStep('landing_address')
        if (typeof window !== 'undefined') {
          try {
            window.history.replaceState({}, '', '/home')
          } catch (e) {
          }
        }
      } else if (pathIsValutazione) {
        setCurrentPage('test_home')
        setCurrentProvinceSlug(null)
        setCurrentBlogSlug(null)
        setWizardStep('landing_address')
        if (typeof window !== 'undefined') {
          try {
            window.history.replaceState({}, '', '/home')
          } catch (e) {
            console.error('Errore aggiornamento URL /home da /valutazione:', e)
          }
          window.scrollTo(0, 0)
        }
      } else if (pathIsContact) {
        setCurrentPage('contact')
        setWizardStep('landing_address')
      } else if (pathIsSupport) {
        setCurrentPage('support')
        setWizardStep('landing_address')
      } else if (pathIsFaq) {
        setCurrentPage('faq')
        setWizardStep('landing_address')
      } else if (provinceSlug) {
        setCurrentPage('province-landing')
        setCurrentProvinceSlug(provinceSlug.toLowerCase())
        setCurrentBlogSlug(null)
        setWizardStep('landing_address')
      } else if (blogDetailMatch) {
        const slug = decodeURIComponent(blogDetailMatch[1])
        setCurrentBlogSlug(slug)
        setCurrentPage('blog-detail')
        setWizardStep('landing_address')
      } else if (pathIsBlogRoot) {
        setCurrentPage('blog')
        setCurrentBlogSlug(null)
        setWizardStep('landing_address')
      } else if (pathIsProfilo) {
        setCurrentPage('profilo')
        if (typeof window !== 'undefined') {
          // Manteniamo eventuali query string (es. ?session_id=... di ritorno da
          // Stripe): servono a ProfilePage per confermare il pagamento. Normalizziamo
          // solo il path (es. /profilo/ -> /profilo), senza buttare via il search.
          window.history.replaceState({}, '', '/profilo' + url.search)
        }
      } else if (pathIsResetPassword) {
        setCurrentPage('reset-password')
      } else if (pathIsCreaPassword) {
        setCurrentPage('crea-password')
      }
    } catch (e) {
      console.error('Errore inizializzazione admin dashboard / routing iniziale:', e)
    }
  }, [isMaintenanceMode])

  // Gestisce la selezione dell'indirizzo e passa alla pagina delle proprietà
  const handleAddressSelect = async (address) => {
    console.log('📍 Indirizzo selezionato dall\'utente:', address)
    setDraftAddress(null)
    setWizardStep('property_type')
    setSelectedAddress(address)
    setError('')
    setLoading(true)

    try {
      const cap = address.postcode || 'N/A'
      console.log('🏠 Recupero dati OMI per CAP:', cap)
      
      const omiValues = await getOmiValues(cap)
      setOmiData(omiValues)
      
      console.log('✅ Dati OMI recuperati:', omiValues)
      
      setTimeout(() => {
        setCurrentPage('property')
        setLoading(false)
      }, 500)
      
    } catch (error) {
      console.error('❌ Errore nel recupero dati OMI:', error)
      setError(`Errore nel recupero dei dati OMI: ${error.message}`)
      setLoading(false)
    }
  }

  const handleTestHomeSearch = (value) => {
    if (testHomeTimeoutRef.current) {
      clearTimeout(testHomeTimeoutRef.current)
    }
    setTestHomeQuery(value)
    setTestHomeError('')
    if (!value || value.length < 2) {
      setTestHomeSuggestions([])
      return
    }
    testHomeTimeoutRef.current = setTimeout(async () => {
      setTestHomeLoading(true)
      try {
        const results = await searchAddresses(value + ', Italia')
        const base = results.slice(0, 8)
        const enriched = await Promise.all(
          base.map((item, index) => {
            if (
              index === 0 &&
              !item.postcode &&
              item.lat != null &&
              item.lon != null
            ) {
              return enrichAddressWithCAP({ ...item }).catch(() => item)
            }
            return item
          })
        )
        setTestHomeSuggestions(enriched)
      } catch (e) {
        setTestHomeSuggestions([])
      } finally {
        setTestHomeLoading(false)
      }
    }, 200)
  }

  const handleTestHomeSelect = (suggestion) => {
    const address = {
      display: suggestion.display || '',
      street: suggestion.street || '',
      housenumber: suggestion.housenumber || '',
      city: suggestion.city || '',
      state: suggestion.state || suggestion.province || '',
      postcode: suggestion.postcode || '',
      lat: suggestion.lat,
      lon: suggestion.lon,
      country: 'Italia',
      source: 'test-home-autocomplete'
    }
    setDraftAddress(address)
    setTestHomeQuery(address.display)
    setTestHomeSuggestions([])
    setTestHomeError('')
  }

  const handleTestHomeSubmit = () => {
    if (!draftAddress || !draftAddress.display) {
      setTestHomeError('Seleziona un indirizzo dai suggerimenti prima di procedere')
      return
    }
    setCurrentPage('address')
    setWizardStep('confirm_address')
  }

  // Gestisce l'invio dei dati della proprietà
  const handlePropertySubmit = async (property) => {
    // Fase pre-lancio: chi ha raggiunto il numero massimo di valutazioni di
    // test con questo codice invito può continuare a navigare il sito, ma
    // non può generarne altre.
    if (inviteGateState === 'limit_reached') {
      setError(
        'Hai raggiunto il numero massimo di valutazioni di test previste per il tuo codice invito. Puoi continuare a navigare il sito, ma non puoi generarne altre.'
      )
      return
    }
    const propertyWithType = {
      ...property,
      propertyType: wizardData.propertyType || null,
      // Locali/bagni/anno costruzione: l'utente li modifica nello step
      // "Caratteristiche principali", che scrive in wizardData.features, NON
      // in propertyDraft (l'oggetto "property" qui sopra) — che quindi
      // restava sempre ai valori di default (1, 1, ''), a prescindere da
      // cosa l'utente avesse effettivamente scelto. Sovrascriviamo qui con la
      // fonte vera, altrimenti sia il calcolo (testo AI) sia il report PDF
      // mostrano dati sbagliati.
      rooms: wizardData.features?.rooms || property.rooms || 1,
      bathrooms: wizardData.features?.bathrooms || property.bathrooms || 1,
      yearBuilt: wizardData.features?.yearBuilt || property.yearBuilt || '',
      // Riscaldamento e classe energetica: raccolti nello stesso step ma
      // finora non venivano forwardati affatto al backend/report.
      heating: wizardData.features?.heating || '',
      energyClass: wizardData.features?.energyClass || '',
      // Mq di terrazzo/giardino: incidono sulla superficie usata per il
      // calcolo del prezzo (vedi buildCapBasedValuation lato backend).
      hasBalconyOrTerrace: !!wizardData.extra?.hasBalconyOrTerrace,
      terraceArea: Number(wizardData.extra?.terraceArea) || 0,
      hasGarden: !!wizardData.extra?.hasGarden,
      gardenArea: Number(wizardData.extra?.gardenArea) || 0,
      // Garage/posto auto: valutato a parte lato backend (valori OMI "Box"),
      // non incide sulla superficie/prezzo dell'abitazione.
      hasGarage: !!wizardData.extra?.hasGarage,
      garageArea: Number(wizardData.extra?.garageArea) || 0,
      // Indirizzo del garage, se diverso da quello dell'abitazione (usato
      // lato backend per risolvere il comune/zona OMI corretti del box).
      garageAddress: wizardData.extra?.garageAddress || null,
      // Cantina: stesso meccanismo di terrazzo/giardino (aggiunge mq alla
      // superficie di calcolo). Piscina: bonus fisso sul prezzo, solo per
      // tipologie con terreno proprio (validato anche lato server).
      hasCantina: !!wizardData.extra?.hasCantina,
      cantinaArea: Number(wizardData.extra?.cantinaArea) || 0,
      hasPiscina: !!wizardData.extra?.hasPiscina,
      // Zona di pregio (es. centro storico): annulla i malus età/stato/no
      // ascensore/mansarda e limita il bonus complessivo a un tetto massimo
      // (vedi ZONA_DI_PREGIO_MAX_BONUS_MULTIPLIER lato server).
      zonaDiPregio: !!wizardData.extra?.zonaDiPregio,
      // Mansarda: % di superficie con soffitto basso (<1,5m), conteggiata al
      // 20% ai fini del calcolo.
      mansardaLowCeilingPercent:
        Number(wizardData.features?.mansardaLowCeilingPercent) || 0,
      // Loft/Open space: altezza soffitti (m), bonus se superiore allo
      // standard di 2,70m.
      loftCeilingHeight: Number(wizardData.features?.loftCeilingHeight) || 0,
      // Attico/Mansarda: il campo "Piano" non viene più chiesto nel wizard
      // (l'attico è per definizione sempre all'ultimo piano, la mansarda non
      // ha un piano significativo da indicare). Forziamo qui il valore
      // corretto invece di lasciare il default "1" di propertyDraft, che
      // altrimenti finirebbe nel calcolo/report come se fosse un piano
      // basso qualsiasi.
      floor:
        String(wizardData.propertyType || '').toUpperCase() === 'ATTICO'
          ? 6
          : String(wizardData.propertyType || '').toUpperCase() === 'MANSARDA'
            ? null
            : property.floor
    }
    console.log('🏡 Dati proprietà ricevuti:', propertyWithType)
    propertyDataRef.current = propertyWithType
    setPropertyData(propertyWithType)
    setLoading(true)

    try {
      const baseResult = await calculateEnhancedValuation(
        propertyWithType,
        selectedAddress
      )
      const adjustedResult = applyMediaDeltaToValuation(
        baseResult,
        wizardData.media?.aiFeatures || null
      )

      valuationResultRef.current = adjustedResult
      setValuationResult(adjustedResult)
      setCurrentPage('valuation')

      // Fase pre-lancio: appena l'utente ottiene la sua valutazione,
      // incrementiamo il contatore del token invito (max INVITE_MAX_EVALUATIONS,
      // vedi server/db.js). Non blocca mai l'utente: se il limite viene
      // raggiunto, semplicemente le prossime valutazioni verranno rifiutate
      // (handlePropertySubmit) senza impedire la navigazione del sito.
      if (inviteGateState === 'unlocked' && typeof window !== 'undefined') {
        const inviteToken = window.localStorage.getItem(INVITE_TOKEN_STORAGE_KEY)
        if (inviteToken) {
          const base = (
            import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
          ).replace(/\/+$/, '')
          fetch(`${base}/invite/consume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: inviteToken })
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data && data.remaining <= 0) {
                setInviteGateState('limit_reached')
              }
            })
            .catch(() => {})
        }
      }

      // Utente già loggato: cattura automaticamente i dati dall'account invece di
      // mostrargli di nuovo il popup (vedi handleOpenContactForm). Altrimenti,
      // mostra il popup del form di contatto come prima.
      setTimeout(() => {
        if (session?.user) {
          handleOpenContactForm()
        } else {
          setIsLeadModalOpen(true)
        }
      }, 500)

      // Resetta i dati di contatto quando si passa alla pagina di valutazione
      setContactData(null)
    } catch (error) {
      console.error('❌ Errore nella valutazione:', error)
      setError('Errore nel calcolo della valutazione. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  const handleContactSubmit = async (data) => {
    console.log('👤 Dati di contatto ricevuti:', data)
    // Con la pubblicità in modalità "video demo" o "video reale" la valutazione
    // si sblocca solo dopo aver visto l'annuncio obbligatorio (vedi ValuationAdGateModal).
    // Nota: il vecchio flusso ReportUnlockModal (pagamento/video per il PDF completo)
    // resta nel codice ma non viene più aperto automaticamente da qui.
    const needsAdGate = adMode === 'demo_rewarded' || adMode === 'live_rewarded'
    // Usiamo i ref (sempre aggiornati "live") invece dello state come fonte primaria:
    // vedi commento su propertyDataRef/valuationResultRef più sopra. Lo state resta
    // come fallback per sicurezza, ma non dovrebbe mai essere l'unico disponibile.
    const propertyToSubmit = propertyDataRef.current || propertyData
    const valuationToSubmit = valuationResultRef.current || valuationResult
    if (!propertyToSubmit || !valuationToSubmit) {
      console.error('⚠️ Invio lead senza dati immobile/valutazione completi', {
        hasProperty: !!propertyToSubmit,
        hasValuation: !!valuationToSubmit
      })
    }
    try {
      const result = await submitLead({
        contact: data,
        address: selectedAddress,
        property: propertyToSubmit,
        valuation: valuationToSubmit,
        wizardData
      })
      if (result?.leadId) setSavedLeadId(result.leadId)
      setContactData(data)
      setIsLeadModalOpen(false)
      // Impostiamo sempre esplicitamente ENTRAMBI gli stati (mai solo uno dei due):
      // se serve il gate video, la valutazione deve risultare bloccata anche se in
      // precedenza (stessa sessione, valutazione precedente) era rimasta sbloccata.
      if (needsAdGate) {
        setIsValuationUnlocked(false)
        setIsAdGateOpen(true)
      } else {
        setIsAdGateOpen(false)
        setIsValuationUnlocked(true)
      }
    } catch (error) {
      console.error('❌ Errore salvataggio lead:', error)
      setError(
        'Non siamo riusciti a salvare la tua richiesta sul server, ma la valutazione è comunque disponibile.'
      )
      setContactData(data)
      setIsLeadModalOpen(false)
      if (needsAdGate) {
        setIsValuationUnlocked(false)
        setIsAdGateOpen(true)
      } else {
        setIsAdGateOpen(false)
        setIsValuationUnlocked(true)
      }
    }
  }

  // Utente già loggato: non ha senso richiedergli di nuovo nome/cognome/email in un
  // popup — li prendiamo dal suo account e inviamo subito (il telefono, se manca,
  // viene recuperato lato server dalla sua ultima valutazione salvata).
  const handleOpenContactForm = () => {
    if (session?.user) {
      const nameParts = (session.user.name || '').trim().split(/\s+/).filter(Boolean)
      handleContactSubmit({
        nome: nameParts[0] || '',
        cognome: nameParts.slice(1).join(' ') || '',
        email: session.user.email || '',
        telefono: '',
        privacyAccepted: true
      })
    } else {
      setIsLeadModalOpen(true)
    }
  }

  const handleNewsletterSubmit = async (event) => {
    event.preventDefault()
    if (!newsletterEmail.trim()) {
      return
    }
    setNewsletterMessage('')
    try {
      await submitLead({
        contact: {
          nome: '',
          cognome: '',
          email: newsletterEmail.trim(),
          telefono: ''
        },
        address: null,
        property: null,
        valuation: null,
        wizardData: {
          lead: {
            profileType: 'NEWSLETTER',
            isOwner: false,
            saleTiming: '',
            wantAgenciesValuation: false,
            marketingConsent: true,
            source: 'newsletter'
          }
        }
      })
      setNewsletterEmail('')
      setNewsletterMessage(
        'Iscrizione registrata correttamente. Riceverai aggiornamenti periodici.'
      )
    } catch (e) {
      setNewsletterMessage(
        'Non siamo riusciti a registrare l’iscrizione. Riprova tra qualche minuto.'
      )
    }
  }

  const handleContactPageSubmit = async (data) => {
    setContactPageMessage('')
    try {
      await submitLead({
        contact: {
          ...data,
          source: 'contact-page'
        },
        address: null,
        property: null,
        valuation: null,
        wizardData: {
          lead: {
            profileType: 'AGENZIA',
            isOwner: false,
            saleTiming: '',
            wantAgenciesValuation: false,
            marketingConsent: data.privacyAccepted || false,
            source: 'contact-page'
          }
        }
      })
      setContactPageMessage(
        'Richiesta inviata correttamente. Ti ricontatteremo al più presto.'
      )
    } catch (e) {
      setContactPageMessage(
        'Non siamo riusciti a inviare la richiesta. Riprova tra qualche minuto.'
      )
    }
  }

  const API_BASE_URL = (
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
  ).replace(/\/+$/, '')
  const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

  const calculateEnhancedValuation = async (property, address) => {
    console.log(
      '🚀 Calcolo valutazione con OMI ufficiale (backend, con fallback tradizionale)...'
    )

    const hasBackend = !!API_BASE_URL && !USE_MOCKS

    if (!hasBackend) {
      console.warn(
        '⚠️ Backend OMI ufficiale non configurato, uso calcolo tradizionale locale'
      )
      return calculateTraditionalValuation(property, omiData, address)
    }

    try {
      const response = await fetch(`${API_BASE_URL}/valuation/enhanced-omi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address,
          property
        })
      })

      if (!response.ok) {
        console.warn(
          '⚠️ Backend enhanced-omi ha risposto con errore:',
          response.status
        )
        let errorPayload = null
        try {
          errorPayload = await response.json()
        } catch (e) {
          console.error('Errore nel parsing della risposta di errore enhanced-omi:', e)
        }
        const message =
          (errorPayload && errorPayload.error) ||
          `Errore backend enhanced-omi (${response.status})`
        throw new Error(message)
      }

      const enhancedResult = await response.json()
      if (
        !enhancedResult ||
        !enhancedResult.success ||
        !enhancedResult.valutazione
      ) {
        console.warn(
          '⚠️ Risposta backend enhanced-omi senza valutazione valida',
          enhancedResult
        )
        throw new Error('Risposta backend enhanced-omi senza valutazione')
      }

      console.log(
        '✅ Valutazione Enhanced OMI ottenuta dal backend:',
        enhancedResult
      )
      return enhancedResult
    } catch (error) {
      console.warn(
        '⚠️ Errore durante la chiamata al backend OMI, uso calcolo tradizionale locale',
        error
      )
      return calculateTraditionalValuation(property, omiData, address)
    }
  }

  const trackWizardEvent = (name, payload) => {
    try {
      console.log('📊 Evento wizard:', name, payload || {})
    } catch (e) {
      console.error('Errore nel tracciamento evento wizard:', e)
    }
  }

  const applyMediaDeltaToValuation = (valuation, mediaAnalysis) => {
    if (!valuation || !valuation.valutazione) {
      return valuation || null
    }

    const basePrice = valuation.valutazione.prezzoMedio || 0

    if (!mediaAnalysis || !basePrice) {
      return {
        ...valuation,
        mediaAI: {
          aiDeltaPercent: 0,
          aiDeltaValue: 0,
          analysis: mediaAnalysis || null
        }
      }
    }

    let deltaPercent = 0

    if (typeof mediaAnalysis.conditionScore === 'number') {
      deltaPercent = (mediaAnalysis.conditionScore - 0.5) * 0.16
    }

    if (mediaAnalysis.renovationNeeded && deltaPercent > 0) {
      deltaPercent = deltaPercent / 2
    }

    const minDelta = -0.08
    const maxDelta = 0.08
    if (deltaPercent < minDelta) deltaPercent = minDelta
    if (deltaPercent > maxDelta) deltaPercent = maxDelta

    const aiDelta = Math.round(basePrice * deltaPercent)

    const newValutazione = {
      ...valuation.valutazione,
      prezzoMedio: (valuation.valutazione.prezzoMedio || 0) + aiDelta,
      prezzoMinimo: (valuation.valutazione.prezzoMinimo || 0) + aiDelta,
      prezzoMassimo: (valuation.valutazione.prezzoMassimo || 0) + aiDelta
    }

    return {
      ...valuation,
      valutazione: newValutazione,
      mediaAI: {
        ...mediaAnalysis,
        aiDeltaPercent: deltaPercent,
        aiDeltaValue: aiDelta
      }
    }
  }

  const detectDeviceType = () => {
    if (typeof navigator === 'undefined') return 'unknown'
    const ua = navigator.userAgent || ''
    const uaLower = ua.toLowerCase()
    if (/tablet|ipad/.test(uaLower)) return 'tablet'
    if (/mobile|iphone|android/.test(uaLower)) return 'mobile'
    return 'desktop'
  }

  const detectTrafficSource = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return 'unknown'
    }
    try {
      const url = new URL(window.location.href)
      const utmSource = url.searchParams.get('utm_source')
      if (utmSource) {
        return utmSource.toLowerCase()
      }
      const ref = document.referrer || ''
      if (!ref) return 'direct'
      const refUrl = new URL(ref)
      const host = refUrl.hostname.toLowerCase()
      if (host.includes('google.') || host.includes('bing.') || host.includes('yahoo.')) {
        return 'organic'
      }
      if (
        host.includes('facebook.') ||
        host.includes('instagram.') ||
        host.includes('twitter.') ||
        host.includes('x.com') ||
        host.includes('linkedin.')
      ) {
        return 'social'
      }
      return 'referral'
    } catch (e) {
      return 'unknown'
    }
  }

  const getOrCreateAnalyticsSessionId = () => {
    if (typeof window === 'undefined') return null
    try {
      const key = 'valutatore_analytics_session_id'
      let current = window.sessionStorage.getItem(key)
      if (!current) {
        current = `sess_${Date.now()}_${Math.round(Math.random() * 1e9)}`
        window.sessionStorage.setItem(key, current)
      }
      return current
    } catch (e) {
      return null
    }
  }

  const getOrCreateAnalyticsVisitorId = () => {
    if (typeof window === 'undefined') return null
    try {
      const key = 'valutatore_analytics_visitor_id'
      let current = window.localStorage.getItem(key)
      if (!current) {
        current = `vis_${Date.now()}_${Math.round(Math.random() * 1e9)}`
        window.localStorage.setItem(key, current)
      }
      return current
    } catch (e) {
      return null
    }
  }

  const trackProvinceAnalyticsEvent = useCallback(
    async (payload) => {
      if (!API_BASE_URL || USE_MOCKS) return
      try {
        await fetch(`${API_BASE_URL}/analytics/province/pageview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })
      } catch (e) {
        console.error('Errore invio evento analytics provincia:', e)
      }
    },
    [API_BASE_URL, USE_MOCKS]
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const isProvinceLanding = currentPage === 'province-landing' && currentProvinceSlug
    if (isProvinceLanding) {
      provinceViewStartRef.current = Date.now()
    } else if (provinceViewStartRef.current) {
      const durationMs = Date.now() - provinceViewStartRef.current
      const sessionId = getOrCreateAnalyticsSessionId()
      const visitorId = getOrCreateAnalyticsVisitorId()
      const deviceType = detectDeviceType()
      const trafficSource = detectTrafficSource()
      const path = window.location.pathname
      const referer = document.referrer || ''
      const slug = currentProvinceSlug
      provinceViewStartRef.current = null
      if (slug) {
        trackProvinceAnalyticsEvent({
          provinceSlug: slug,
          path,
          eventType: 'view',
          sessionId,
          visitorId,
          deviceType,
          trafficSource,
          durationMs,
          userAgent:
            typeof navigator !== 'undefined' ? navigator.userAgent : '',
          referer
        })
      }
    }
  }, [currentPage, currentProvinceSlug, trackProvinceAnalyticsEvent])

  // Funzione di calcolo valutazione tradizionale (fallback)
  const calculateTraditionalValuation = (property, omiData, address) => {
    console.log('💰 Calcolo valutazione tradizionale con dati:', { property, omiData, address })
    
    // Utilizziamo i dati OMI reali specifici per la zona
    const basePrice = omiData?.avg || 2000 // Prezzo base al mq dal servizio OMI
    console.log('📊 Prezzo base al mq:', basePrice, '€/mq per', omiData?.comune, '-', omiData?.zona)
    
    // Coefficienti di stato aggiornati 2024
    const stateMultipliers = {
      'Nuovo': 1.15,
      'Buono': 1.0,
      'Da ristrutturare': 0.75
    }
    
    // Modificatori zona OMI
    const zoneMultipliers = {
      'Centrale': 1.05,
      'Semicentrale': 1.0,
      'Periferica': 0.95,
      'Rurale': 0.90
    }
    
    // Penalità piano
    let floorMultiplier = 1.0
    if (property.floor > 3) {
      floorMultiplier = property.hasElevator ? 1.03 : 0.92
    } else if (property.floor === 0) {
      floorMultiplier = 0.95
    }
    
    // Calcolo del prezzo al metro quadro con tutti i modificatori
    const stateMultiplier = stateMultipliers[property.condition] || 1.0
    const zoneMultiplier = zoneMultipliers[property.zone] || 1.0
    
    const pricePerSqm = basePrice * stateMultiplier * zoneMultiplier * floorMultiplier
    
    // Calcolo del prezzo totale
    const totalPrice = (property.area || property.livingArea || 80) * pricePerSqm
    
    const result = {
      success: true,
      source: 'traditional-calculation',
      timestamp: new Date().toISOString(),
      valutazione: {
        prezzoMinimo: Math.round(totalPrice * 0.9),
        prezzoMassimo: Math.round(totalPrice * 1.1),
        prezzoMedio: Math.round(totalPrice),
        prezzoAlMetroQuadro: Math.round(pricePerSqm)
      },
      analisiAI: {
        puntiForza: ['Posizione nella zona', 'Caratteristiche standard'],
        puntiDebolezza: ['Valutazione automatica', 'Necessita verifica esperto'],
        raccomandazioni: {
          venditore: 'Considera una valutazione professionale per ottimizzare il prezzo',
          acquirente: 'Verifica lo stato dell\'immobile e confronta con il mercato locale'
        },
        affidabilita: 6
      },
      metadati: {
        metodologia: 'Calcolo tradizionale con dati OMI',
        fonti: ['Database OMI interno'],
        limitazioni: ['Valutazione automatica'],
        dataValutazione: new Date().toISOString().split('T')[0]
      },
      note: 'Valutazione tradizionale - si consiglia consulenza professionale per maggiore precisione'
    }
    
    console.log('✅ Valutazione tradizionale calcolata:', result)
    return result
  }

  // Torna alla pagina precedente
  const goBack = () => {
    if (currentPage === 'valuation') {
      setCurrentPage('property')
      setWizardStep('main_features')
    } else if (currentPage === 'property') {
      // Torna alla schermata di conferma indirizzo (mappa) con lo stesso
      // indirizzo già inserito, invece della vecchia schermata di ricerca
      // indirizzo legacy (wizardStep 'landing_address'), ormai sostituita
      // dalla home. Vedi anche il fix analogo nel pulsante "indietro" di
      // AddressConfirmWithMap qui sotto.
      setCurrentPage('address')
      setDraftAddress(selectedAddress)
      setSelectedAddress(null)
      setOmiData(null)
      setWizardStep('confirm_address')
    }
  }

  // Azzera tutto lo stato di una valutazione in corso (indirizzo, dati
  // immobile, risultato, casella di ricerca in home). Condivisa tra restart()
  // (nuova valutazione esplicita) e la navigazione verso la home/landing
  // (goToHomePage/goToValuationPage): senza questo reset, tornando in home
  // dopo aver visitato un'altra pagina (es. il profilo) restava visibile il
  // testo e i dati della valutazione precedente, perché lo stato di App.jsx
  // non viene mai smontato passando da una "pagina" all'altra (non è un vero
  // routing con unmount, solo un cambio di variabile currentPage).
  const resetValuationState = () => {
    setSelectedAddress(null)
    setDraftAddress(null)
    setTestHomeQuery('')
    setTestHomeSuggestions([])
    setTestHomeLoading(false)
    setTestHomeError('')
    setPropertyDraft({
      livingArea: 75,
      balconyArea: 0,
      terraceArea: 0,
      verandaArea: 0,
      loftArea: 0,
      atticArea: 0,
      basementArea: 0,
      gardenArea: 0,
      rooftopArea: 0,
      condition: 'Buono',
      floor: 1,
      hasElevator: false,
      rooms: 1,
      bathrooms: 1,
      yearBuilt: ''
    })
    setWizardData({
      propertyType: null,
      features: {
        rooms: 1,
        bathrooms: 1,
        heating: '',
        yearBuilt: '',
        energyClass: '',
        mansardaLowCeilingPercent: '',
        loftCeilingHeight: ''
      },
      extra: {
        hasBalconyOrTerrace: false,
        hasGarden: false,
        hasGarage: false,
        hasCantina: false,
        hasPiscina: false,
        terraceArea: '',
        gardenArea: '',
        garageArea: '',
        garageAddress: null,
        cantinaArea: ''
      },
      lead: {
        profileType: 'PROPRIETARIO',
        saleTiming: '',
        wantAgenciesValuation: false,
        buyerStage: '',
        buyerFinancing: '',
        buyerTimeline: '',
        buyerWantsSupport: false,
        proRole: '',
        proAgencyName: '',
        proPurpose: '',
        proHasMandate: '',
        marketingConsent: false
      }
    })
    propertyDataRef.current = null
    valuationResultRef.current = null
    setPropertyData(null)
    setValuationResult(null)
    setOmiData(null)
    setError('')
    setContactData(null)
    setIsLeadModalOpen(false)
    setIsValuationUnlocked(false)
    setIsAdGateOpen(false)
  }

  // Ricomincia il processo
  const restart = () => {
    resetValuationState()
    goToValuationPage()
  }

  const goToPrivacyPage = () => {
    if (isMaintenanceMode) {
      setCurrentPage('pre')
      setCurrentBlogSlug(null)
      setWizardStep('landing_address')
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0)
        try {
          window.history.pushState({}, '', '/pre')
        } catch (e) {
        }
      }
      return
    }
    setCurrentPage('privacy')
    setCurrentBlogSlug(null)
    setWizardStep('landing_address')
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      try {
        window.history.pushState({}, '', '/privacy')
      } catch (e) {
        console.error('Errore aggiornamento URL /privacy:', e)
      }
    }
  }

  const goToTermsPage = () => {
    if (isMaintenanceMode) {
      setCurrentPage('pre')
      setCurrentBlogSlug(null)
      setWizardStep('landing_address')
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0)
        try {
          window.history.pushState({}, '', '/pre')
        } catch (e) {
        }
      }
      return
    }
    setCurrentPage('terms')
    setCurrentBlogSlug(null)
    setWizardStep('landing_address')
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      try {
        window.history.pushState({}, '', '/termini-di-utilizzo')
      } catch (e) {
        console.error('Errore aggiornamento URL /termini-di-utilizzo:', e)
      }
    }
  }

  const goToCookiesPage = () => {
    if (isMaintenanceMode) {
      setCurrentPage('pre')
      setCurrentBlogSlug(null)
      setWizardStep('landing_address')
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0)
        try {
          window.history.pushState({}, '', '/pre')
        } catch (e) {
        }
      }
      return
    }
    setCurrentPage('cookies')
    setCurrentBlogSlug(null)
    setWizardStep('landing_address')
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      try {
        window.history.pushState({}, '', '/cookie-consenso')
      } catch (e) {
        console.error('Errore aggiornamento URL /cookie-consenso:', e)
      }
    }
  }

  const goToHomePage = () => {
    resetValuationState()
    if (isMaintenanceMode) {
      setCurrentPage('pre')
      setCurrentProvinceSlug(null)
      setCurrentBlogSlug(null)
      setWizardStep('landing_address')
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0)
        try {
          window.history.pushState({}, '', '/pre')
        } catch (e) {
        }
      }
      return
    }
    setCurrentPage('test_home')
    setCurrentProvinceSlug(null)
    setCurrentBlogSlug(null)
    setWizardStep('landing_address')
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      try {
        window.history.pushState({}, '', '/home')
      } catch (e) {
        console.error('Errore aggiornamento URL /home dalla navbar:', e)
      }
    }
  }

  const goToValuationPage = () => {
    resetValuationState()
    if (isMaintenanceMode) {
      setCurrentPage('pre')
      setCurrentProvinceSlug(null)
      setCurrentBlogSlug(null)
      setWizardStep('landing_address')
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0)
        try {
          window.history.pushState({}, '', '/pre')
        } catch (e) {
        }
      }
      return
    }
    setCurrentPage('test_home')
    setCurrentProvinceSlug(null)
    setCurrentBlogSlug(null)
    setWizardStep('landing_address')
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      try {
        window.history.pushState({}, '', '/home')
      } catch (e) {
        console.error('Errore aggiornamento URL /home da goToValuationPage:', e)
      }
    }
  }

  const goToContactPage = () => {
    if (isMaintenanceMode) {
      setCurrentPage('pre')
      setCurrentBlogSlug(null)
      setWizardStep('landing_address')
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0)
        try {
          window.history.pushState({}, '', '/pre')
        } catch (e) {
        }
      }
      return
    }
    setCurrentPage('contact')
    setCurrentBlogSlug(null)
    setWizardStep('landing_address')
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      try {
        window.history.pushState({}, '', '/contatti')
      } catch (e) {
        console.error('Errore aggiornamento URL /contatti:', e)
      }
    }
  }

  const goToHelpCenterPage = () => {
    if (isMaintenanceMode) {
      setCurrentPage('pre')
      setCurrentBlogSlug(null)
      setWizardStep('landing_address')
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0)
        try {
          window.history.pushState({}, '', '/pre')
        } catch (e) {
        }
      }
      return
    }
    setCurrentPage('support')
    setCurrentBlogSlug(null)
    setWizardStep('landing_address')
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      try {
        window.history.pushState({}, '', '/centro-assistenza')
      } catch (e) {
        console.error('Errore aggiornamento URL /centro-assistenza:', e)
      }
    }
  }

  const goToFaqPage = () => {
    if (isMaintenanceMode) {
      setCurrentPage('pre')
      setCurrentBlogSlug(null)
      setWizardStep('landing_address')
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0)
        try {
          window.history.pushState({}, '', '/pre')
        } catch (e) {
        }
      }
      return
    }
    setCurrentPage('faq')
    setCurrentBlogSlug(null)
    setWizardStep('landing_address')
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      try {
        window.history.pushState({}, '', '/domande-frequenti')
      } catch (e) {
        console.error('Errore aggiornamento URL /domande-frequenti:', e)
      }
    }
  }

  const goToBlogPage = () => {
    if (isMaintenanceMode) {
      setCurrentPage('pre')
      setCurrentBlogSlug(null)
      setWizardStep('landing_address')
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0)
        try {
          window.history.pushState({}, '', '/pre')
        } catch (e) {
        }
      }
      return
    }
    setCurrentPage('blog')
    setCurrentBlogSlug(null)
    setWizardStep('landing_address')
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      try {
        window.history.pushState({}, '', '/blog')
      } catch (e) {
        console.error('Errore aggiornamento URL /blog:', e)
      }
    }
  }

  const goToBlogArticle = (article) => {
    if (!article || !article.slug) {
      return
    }
    if (isMaintenanceMode) {
      setCurrentPage('pre')
      setCurrentBlogSlug(null)
      setWizardStep('landing_address')
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0)
        try {
          window.history.pushState({}, '', '/pre')
        } catch (e) {
        }
      }
      return
    }
    setCurrentBlogSlug(article.slug)
    setCurrentPage('blog-detail')
    setWizardStep('landing_address')
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      try {
        window.history.pushState({}, '', `/blog/${encodeURIComponent(article.slug)}`)
      } catch (e) {
        console.error('Errore aggiornamento URL articolo blog:', e)
      }
    }
  }

  const handlePrimaryCtaClick = () => {
    try {
      const button = document.getElementById('landing-submit-button')
      if (button) {
        button.click()
      }
    } catch (e) {
      console.error('Errore nel click del CTA principale landing:', e)
    }
  }

  // Fase pre-lancio: gate con codice invito. Il pannello admin (login e
  // dashboard) deve restare sempre accessibile, altrimenti nessuno potrebbe
  // più configurare/disattivare il gate stesso. Blocchiamo l'intero sito
  // solo se manca ancora un codice valido ('locked'): chi ha raggiunto il
  // limite di valutazioni ('limit_reached') può continuare a navigare
  // liberamente — solo l'avvio di una nuova valutazione viene bloccato
  // altrove (vedi handlePropertySubmit).
  const isAdminRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
  if (!isAdminRoute && inviteGateState === 'locked') {
    return <InviteGate onUnlocked={() => setInviteGateState('unlocked')} />
  }

  if (currentPage === 'profilo') {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <MainHeader variant={TEST_HOME_COPY_VARIANTS[ACTIVE_TEST_HOME_COPY] || TEST_HOME_COPY_VARIANTS.caide} />
        <ProfilePage onNavigate={setCurrentPage} adMode={adMode} />
        <MainFooter
          onOpenPrivacy={goToPrivacyPage}
          onOpenContact={goToContactPage}
          onOpenHelp={goToHelpCenterPage}
          onOpenFaq={goToFaqPage}
          onOpenTerms={goToTermsPage}
          onOpenCookies={goToCookiesPage}
          onOpenCookieSettings={handleOpenCookieSettings}
        />
      </div>
    )
  }

  if (currentPage === 'reset-password') {
    return <ResetPasswordPage onNavigate={setCurrentPage} />
  }

  if (currentPage === 'crea-password') {
    return <ResetPasswordPage mode="create" onNavigate={setCurrentPage} />
  }

  if (isAdminLogin && !isAdminDashboard) {
    const handleLoginSuccess = () => {
      setIsAdminLogin(false)
      setIsAdminDashboard(true)
    }

    return <AdminLogin onSuccess={handleLoginSuccess} />
  }

  if (isAdminDashboard) {
    const handleAdminResetLeads = async () => {
      console.log('Admin settings: richiesta reset completo contatti e valutazioni')
      if (
        !window.confirm(
          'Sei sicuro di voler cancellare tutti i contatti e le valutazioni dal database di sviluppo?'
        )
      ) {
        return
      }
      try {
        const token = getAdminToken()
        const res = await fetch(`${API_BASE_URL}/admin/tools/reset-leads`, {
          method: 'POST',
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          }
        })
        if (!res.ok) {
          console.error('Errore HTTP reset lead e valutazioni:', res.status)
          alert(
            `Errore durante il reset dei contatti e delle valutazioni (HTTP ${res.status}).`
          )
          return
        }
        alert('Tutti i contatti e le valutazioni sono stati cancellati.')
        window.location.reload()
      } catch (e) {
        console.error('Errore reset lead e valutazioni:', e)
        alert('Errore durante il reset dei contatti e delle valutazioni.')
      }
    }

    const handleSetAdMode = async (newMode) => {
      if (newMode === adMode || isAdModeSaving) return
      setIsAdModeSaving(true)
      try {
        const token = getAdminToken()
        const res = await fetch(`${API_BASE_URL}/admin/settings/ad-mode`, {
          method: 'PUT',
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ adMode: newMode })
        })
        const responseData = await res.json().catch(() => null)
        if (!res.ok) {
          console.error('Errore HTTP salvataggio modalità pubblicità:', res.status)
          alert('Errore durante il salvataggio della modalità pubblicità.')
          return
        }
        setAdMode(responseData?.adMode || newMode)
      } catch (e) {
        console.error('Errore salvataggio modalità pubblicità:', e)
        alert('Errore durante il salvataggio della modalità pubblicità.')
      } finally {
        setIsAdModeSaving(false)
      }
    }

    const handleAdminClose = () => {
      setIsAdminDashboard(false)
      setIsAdminLogin(false)
      clearAdminToken()
      try {
        const url = new URL(window.location.href)
        url.searchParams.delete('admin')
        window.history.replaceState({}, '', url.toString())
      } catch (e) {
        console.error('Errore chiusura admin dashboard:', e)
      }
    }

    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex">
        <aside className="hidden md:flex md:w-64 lg:w-72 flex-col border-r border-gray-200 bg-white">
          <div className="h-16 flex items-center px-6 border-b border-gray-100">
            <div className="flex items-center">
              <div className="text-xl font-semibold text-indigo-600 flex items-center">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="mr-2"
                >
                  <circle cx="16" cy="16" r="16" fill="#4F46E5" />
                  <path
                    d="M16 6C10.48 6 6 10.48 6 16C6 21.52 10.48 26 16 26C21.52 26 26 21.52 26 16C26 10.48 21.52 6 16 6ZM16 24C11.59 24 8 20.41 8 16C8 11.59 11.59 8 16 8C20.41 8 24 11.59 24 16C24 20.41 20.41 24 16 24Z"
                    fill="white"
                  />
                  <path d="M17 11H15V17H21V15H17V11Z" fill="white" />
                </svg>
                Valutatore Staff
              </div>
            </div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
            <div className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Pannello
            </div>
            <button
              type="button"
              onClick={() => setAdminTab('overview')}
              className={`w-full flex items-center rounded-lg px-3 py-2.5 text-left ${
                adminTab === 'overview'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">🏠</span>
              <span>Dashboard</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('contacts')}
              className={`w-full flex items-center rounded-lg px-3 py-2.5 text-left ${
                adminTab === 'contacts'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">👥</span>
              <span>Contatti</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('inbound')}
              className={`w-full flex items-center rounded-lg px-3 py-2.5 text-left ${
                adminTab === 'inbound'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">✉️</span>
              <span>Contatti & newsletter</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('analytics')}
              className={`w-full flex items-center rounded-lg px-3 py-2.5 text-left ${
                adminTab === 'analytics'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">📊</span>
              <span>Statistiche</span>
            </button>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() =>
                  setAdminTab(prev =>
                    prev === 'groups' ? 'groups-auto' : 'groups'
                  )
                }
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left ${
                  adminTab === 'groups' || adminTab === 'groups-auto'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  <span className="mr-2">🗺️</span>
                  <span>Raggruppa</span>
                </div>
                <span className="text-xs">
                  {adminTab === 'groups' || adminTab === 'groups-auto'
                    ? '▾'
                    : '▸'}
                </span>
              </button>
              {(adminTab === 'groups' || adminTab === 'groups-auto') && (
                <div className="ml-7 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => setAdminTab('groups')}
                    className={`w-full flex items-center rounded-md px-3 py-1.5 text-left text-xs ${
                      adminTab === 'groups'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="mr-2">🗺️</span>
                    <span>Mappa comuni italiani</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminTab('groups-auto')}
                    className={`w-full flex items-center rounded-md px-3 py-1.5 text-left text-xs ${
                      adminTab === 'groups-auto'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="mr-2">🔁</span>
                    <span>Raggruppamento automatico</span>
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAdminTab('gdpr-registry')}
              className={`w-full flex items-center rounded-lg px-3 py-2.5 text-left ${
                adminTab === 'gdpr-registry'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">⚖️</span>
              <span>Registro trattamenti</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('settings')}
              className={`w-full flex items-center rounded-lg px-3 py-2.5 text-left ${
                adminTab === 'settings'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">⚙️</span>
              <span>Impostazioni</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('invite')}
              className={`w-full flex items-center rounded-lg px-3 py-2.5 text-left ${
                adminTab === 'invite'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">🎟️</span>
              <span>Codice invito</span>
            </button>
          </nav>
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Accesso riservato
              </span>
              <button
                onClick={handleAdminClose}
                className="text-xs font-medium text-gray-500 hover:text-gray-900"
              >
                Esci
              </button>
            </div>
          </div>
        </aside>
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b border-gray-200 bg-white">
            <div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-4">
                <img
                  src="/assets/Risorsa 2.png"
                  alt="Valuta Facile"
                  className="h-8 w-auto object-contain"
                />
                <div className="text-sm font-semibold text-gray-500">
                  {adminTab === 'contacts'
                    ? 'Contatti'
                    : adminTab === 'inbound'
                    ? 'Contatti da pagina e newsletter'
                    : adminTab === 'analytics'
                    ? 'Statistiche landing province'
                    : adminTab === 'groups'
                    ? 'Mappa comuni italiani'
                    : adminTab === 'groups-auto'
                    ? 'Raggruppamento automatico'
                  : adminTab === 'gdpr-registry'
                    ? 'Registro trattamenti'
                    : adminTab === 'settings'
                    ? 'Impostazioni'
                    : adminTab === 'invite'
                    ? 'Codice invito (pre-lancio)'
                    : 'Dashboard contatti'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-500">
                  <span className="mr-2">🔍</span>
                  <span>Ricerca avanzata contatti</span>
                </div>
                <button
                  onClick={handleAdminClose}
                  className="text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-md"
                >
                  Torna all&apos;app utente
                </button>
              </div>
            </div>
          </header>
          <main className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
            {adminTab === 'overview' && (
              <ContactsDashboard
                onClose={handleAdminClose}
                onGoToAutoGroups={() => setAdminTab('groups-auto')}
              />
            )}
            {adminTab === 'contacts' && (
              <ContactsDashboard
                onClose={handleAdminClose}
                mode="contactsOnly"
              />
            )}
            {adminTab === 'inbound' && (
              <ContactsDashboard
                onClose={handleAdminClose}
                mode="sources"
              />
            )}
            {adminTab === 'analytics' && (
              <ContactsDashboard
                onClose={handleAdminClose}
                mode="analytics"
              />
            )}
            {adminTab === 'invite' && <InviteAdminDashboard />}
            {adminTab === 'groups' && <ContactsGroupsDashboard />}
            {adminTab === 'groups-auto' && (
              <ContactsGroupsDashboard mode="autoGrouping" />
            )}
            {adminTab === 'gdpr-registry' && (
              <section className="max-w-5xl">
                <h2 className="text-lg font-semibold text-gray-900">
                  Registro dei trattamenti (vista interna)
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Questa sezione riepiloga in modo sintetico le principali attività di trattamento gestite
                  tramite il valutatore immobiliare, utile come supporto operativo al registro formale ai
                  sensi dell&apos;art. 30 GDPR.
                </p>
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full text-xs sm:text-sm text-left text-gray-700">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Finalità</th>
                        <th className="px-3 py-2 font-semibold">Categorie dati</th>
                        <th className="px-3 py-2 font-semibold">Interessati</th>
                        <th className="px-3 py-2 font-semibold">Base giuridica</th>
                        <th className="px-3 py-2 font-semibold">Conservazione indicativa</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2">
                          Valutazione immobiliare online
                        </td>
                        <td className="px-3 py-2">
                          Dati immobile, indirizzo, CAP, dati tecnici di valutazione, eventuali file caricati
                          (planimetrie/foto)
                        </td>
                        <td className="px-3 py-2">
                          Utenti che richiedono la valutazione
                        </td>
                        <td className="px-3 py-2">
                          Art. 6.1.b GDPR (misure precontrattuali); art. 6.1.f GDPR (legittimo interesse
                          miglioramento servizio)
                        </td>
                        <td className="px-3 py-2">
                          Circa 12–24 mesi dalla valutazione, salvo ulteriori obblighi di legge
                        </td>
                      </tr>
                      <tr className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2">
                          Gestione contatti e lead
                        </td>
                        <td className="px-3 py-2">
                          Nome, cognome, email, telefono, dati immobile, preferenze raccolte nel wizard
                        </td>
                        <td className="px-3 py-2">
                          Utenti che chiedono di essere ricontattati
                        </td>
                        <td className="px-3 py-2">
                          Art. 6.1.b GDPR; art. 6.1.f GDPR (organizzazione commerciale dei contatti)
                        </td>
                        <td className="px-3 py-2">
                          Circa 12–24 mesi dall&apos;ultima interazione significativa
                        </td>
                      </tr>
                      <tr className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2">
                          Analisi interne e dashboard staff
                        </td>
                        <td className="px-3 py-2">
                          Dati di valutazione aggregati, CAP/comune, indicatori statistici interni
                        </td>
                        <td className="px-3 py-2">
                          Utenti del servizio (in forma prevalentemente aggregata)
                        </td>
                        <td className="px-3 py-2">
                          Art. 6.1.f GDPR (legittimo interesse allo sviluppo e controllo del servizio)
                        </td>
                        <td className="px-3 py-2">
                          Allineata alla conservazione dei lead, con preferenza per aggregazione/pseudonimizzazione
                        </td>
                      </tr>
                      <tr className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2">
                          Marketing diretto e agenzie di zona
                        </td>
                        <td className="px-3 py-2">
                          Dati contatto, dati immobile rilevanti per proposte commerciali
                        </td>
                        <td className="px-3 py-2">
                          Utenti che hanno espresso consenso specifico
                        </td>
                        <td className="px-3 py-2">
                          Art. 6.1.a GDPR (consenso); art. 130 Codice Privacy per comunicazioni elettroniche
                        </td>
                        <td className="px-3 py-2">
                          Fino a revoca del consenso e comunque non oltre 24 mesi per il marketing
                        </td>
                      </tr>
                      <tr className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2">
                          Sicurezza, log tecnici e adempimenti legali
                        </td>
                        <td className="px-3 py-2">
                          Log accessi area admin, dati tecnici di utilizzo, eventuali riferimenti a eventi di
                          sicurezza
                        </td>
                        <td className="px-3 py-2">
                          Utenti admin e, in casi limitati, utenti finali coinvolti in eventi di sicurezza
                        </td>
                        <td className="px-3 py-2">
                          Art. 6.1.f GDPR (legittimo interesse alla sicurezza); art. 6.1.c GDPR (obblighi di
                          legge)
                        </td>
                        <td className="px-3 py-2">
                          Circa 6–12 mesi per i log tecnici, salvo necessità di ulteriore conservazione in
                          caso di contenziosi
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Questa tabella ha valore di supporto operativo interno e non sostituisce il registro
                  formale dei trattamenti ai sensi dell&apos;art. 30 GDPR. Le informazioni qui riportate
                  devono essere allineate con la documentazione privacy ufficiale del titolare.
                </p>
                <h3 className="mt-8 text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Registro formale dei trattamenti (art. 30 GDPR)
                </h3>
                <p className="mt-2 text-xs text-gray-600">
                  Questa sezione riepiloga in forma più estesa gli elementi richiesti dal registro formale dei
                  trattamenti per i principali processi legati al valutatore immobiliare. I dati sul titolare e
                  sui fornitori devono essere coerenti con la documentazione contrattuale effettiva.
                </p>
                <div className="mt-3 text-xs text-gray-700 space-y-1">
                  <p>
                    <span className="font-semibold">Titolare del trattamento:</span>{' '}
                    soggetto che gestisce la presente applicazione di valutazione immobiliare, come indicato
                    nell&apos;informativa privacy ufficiale.
                  </p>
                  <p>
                    <span className="font-semibold">Luogo di conservazione principale:</span>{' '}
                    database e sistemi IT utilizzati per l&apos;applicazione (hosting / infrastruttura
                    documentata nei contratti del titolare).
                  </p>
                  <p>
                    <span className="font-semibold">Ultimo aggiornamento registro formale:</span>{' '}
                    da mantenere coerente con la versione ufficiale del registro (es. file PDF interno).
                  </p>
                </div>
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full text-[11px] sm:text-xs text-left text-gray-700">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Trattamento</th>
                        <th className="px-3 py-2 font-semibold">Finalità</th>
                        <th className="px-3 py-2 font-semibold">Interessati</th>
                        <th className="px-3 py-2 font-semibold">Categorie di dati</th>
                        <th className="px-3 py-2 font-semibold">Destinatari / Fornitori</th>
                        <th className="px-3 py-2 font-semibold">Trasferimenti extra-UE</th>
                        <th className="px-3 py-2 font-semibold">Conservazione</th>
                        <th className="px-3 py-2 font-semibold">Misure di sicurezza principali</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2">
                          Valutazione immobiliare online
                        </td>
                        <td className="px-3 py-2">
                          Fornire una stima del valore dell&apos;immobile richiesta dall&apos;utente.
                        </td>
                        <td className="px-3 py-2">
                          Utenti che utilizzano il servizio di valutazione.
                        </td>
                        <td className="px-3 py-2">
                          Dati immobile, indirizzo, CAP, dati tecnici di valutazione, file planimetrie/foto.
                        </td>
                        <td className="px-3 py-2">
                          Fornitori IT e hosting; eventuali servizi di geocoding e AI utilizzati dal titolare.
                        </td>
                        <td className="px-3 py-2">
                          Possibili verso fornitori di AI/geocoding; soggetti alle garanzie contrattuali
                          previste (es. SCC, decisioni di adeguatezza).
                        </td>
                        <td className="px-3 py-2">
                          12–24 mesi dalla valutazione, salvo diversi obblighi di legge.
                        </td>
                        <td className="px-3 py-2">
                          Accesso controllato all&apos;area admin, autenticazione, uso di protocolli sicuri,
                          limitazione permessi e logging.
                        </td>
                      </tr>
                      <tr className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2">
                          Gestione contatti e lead
                        </td>
                        <td className="px-3 py-2">
                          Gestire le richieste di contatto e follow-up commerciale.
                        </td>
                        <td className="px-3 py-2">
                          Utenti che chiedono di essere ricontattati.
                        </td>
                        <td className="px-3 py-2">
                          Nome, cognome, email, telefono, dati immobile, informazioni wizard e note interne.
                        </td>
                        <td className="px-3 py-2">
                          Fornitori di servizi email/CRM, fornitori IT e hosting incaricati dal titolare.
                        </td>
                        <td className="px-3 py-2">
                          In base ai fornitori coinvolti; da dettagliare nel registro ufficiale e nei contratti.
                        </td>
                        <td className="px-3 py-2">
                          12–24 mesi dall&apos;ultima interazione significativa con l&apos;utente.
                        </td>
                        <td className="px-3 py-2">
                          Autenticazione area admin, policy interne su accessi e cancellazioni, backup controllati.
                        </td>
                      </tr>
                      <tr className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2">
                          Analisi interne e dashboard staff
                        </td>
                        <td className="px-3 py-2">
                          Elaborare statistiche aggregate e controllare l&apos;andamento del servizio.
                        </td>
                        <td className="px-3 py-2">
                          Utenti del servizio, in forma prevalentemente aggregata.
                        </td>
                        <td className="px-3 py-2">
                          Dati di valutazione aggregati, CAP/comune, indicatori statistici.
                        </td>
                        <td className="px-3 py-2">
                          Fornitori di analytics/BI eventualmente utilizzati dal titolare.
                        </td>
                        <td className="px-3 py-2">
                          In base alla localizzazione dei fornitori; da indicare nel registro formale.
                        </td>
                        <td className="px-3 py-2">
                          Allineata ai tempi dei lead, privilegiando anonimizzazione/pseudonimizzazione dove possibile.
                        </td>
                        <td className="px-3 py-2">
                          Controlli di accesso, separazione tra dati identificativi e dati aggregati, logging.
                        </td>
                      </tr>
                      <tr className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2">
                          Marketing diretto e agenzie di zona
                        </td>
                        <td className="px-3 py-2">
                          Invio comunicazioni commerciali e condivisione lead con agenzie partner.
                        </td>
                        <td className="px-3 py-2">
                          Utenti che hanno espresso consenso specifico al marketing e alle agenzie.
                        </td>
                        <td className="px-3 py-2">
                          Dati di contatto, dati immobile rilevanti per proposte commerciali.
                        </td>
                        <td className="px-3 py-2">
                          Agenzie immobiliari partner, fornitori strumenti email marketing, fornitori IT.
                        </td>
                        <td className="px-3 py-2">
                          Dipende dai fornitori marketing; da indicare nel registro ufficiale e nei contratti.
                        </td>
                        <td className="px-3 py-2">
                          Fino a revoca del consenso e comunque non oltre 24 mesi per finalità marketing.
                        </td>
                        <td className="px-3 py-2">
                          Gestione opt-out, controllo consensi, uso sicuro degli strumenti di invio campagne.
                        </td>
                      </tr>
                      <tr className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2">
                          Sicurezza, log tecnici e adempimenti legali
                        </td>
                        <td className="px-3 py-2">
                          Garantire sicurezza dei sistemi, prevenire abusi e adempiere ad obblighi legali.
                        </td>
                        <td className="px-3 py-2">
                          Utenti admin e, in casi limitati, utenti finali coinvolti in eventi di sicurezza.
                        </td>
                        <td className="px-3 py-2">
                          Log accessi area admin, log tecnici di errore, dati legati a eventi di sicurezza.
                        </td>
                        <td className="px-3 py-2">
                          Fornitori di logging/monitoring, consulenti legali/fiscali se coinvolti in contenziosi.
                        </td>
                        <td className="px-3 py-2">
                          Possibili verso fornitori di logging/monitoring; da descrivere nel registro ufficiale.
                        </td>
                        <td className="px-3 py-2">
                          6–12 mesi per i log tecnici, salvo ulteriore conservazione per contenziosi o indagini.
                        </td>
                        <td className="px-3 py-2">
                          Sistemi di autenticazione, gestione delle credenziali, monitoraggio accessi e procedure
                          di risposta agli incidenti.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {adminTab === 'settings' && (
              <section className="max-w-xl space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Impostazioni area test
                </h2>
                <p className="text-sm text-gray-600">
                  Qui puoi azzerare i dati di test cancellando tutti i contatti e le
                  relative valutazioni salvate nel database di sviluppo.
                </p>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-indigo-900">
                    Modalità manutenzione sito
                  </p>
                  <p className="text-xs text-indigo-800">
                    Quando attiva, tutti gli utenti vedono solo la pagina di manutenzione
                    e la home ufficiale viene disattivata.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsMaintenanceMode(prev => !prev)}
                    className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-xs font-semibold shadow-sm ${
                      isMaintenanceMode
                        ? 'bg-indigo-900 text-white hover:bg-indigo-950'
                        : 'bg-white text-indigo-900 border border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    {isMaintenanceMode
                      ? 'Disattiva modalità manutenzione'
                      : 'Attiva modalità manutenzione'}
                  </button>
                  <p className="text-[11px] text-indigo-700">
                    Stato attuale:{' '}
                    {isMaintenanceMode
                      ? 'ATTIVA – il sito mostra solo la pagina pre'
                      : 'DISATTIVATA – il sito mostra la home ufficiale'}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-emerald-900">
                    Pubblicità (monetizzazione Google AdSense)
                  </p>
                  <p className="text-xs text-emerald-800">
                    Scegli come si comporta il sito quando un utente clicca su
                    &quot;Visualizza valore immobile&quot;. Passa a &quot;Video reale&quot; solo
                    dopo che Google ha approvato l&apos;account e sono state create le
                    unità Rewarded.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      {
                        value: 'off',
                        label: 'Nessuna pubblicità',
                        desc: 'Comportamento attuale: la valutazione appare subito.'
                      },
                      {
                        value: 'banner',
                        label: 'Banner pubblicitari',
                        desc: 'Mostra i riquadri Display nelle posizioni concordate, nessun blocco.'
                      },
                      {
                        value: 'demo_rewarded',
                        label: 'Video demo',
                        desc: 'Video finto/placeholder: serve solo per collaudare il flusso.'
                      },
                      {
                        value: 'live_rewarded',
                        label: 'Video reale',
                        desc: 'Google Rewarded Ads vero (richiede approvazione Google).'
                      }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isAdModeSaving}
                        onClick={() => handleSetAdMode(opt.value)}
                        className={`text-left rounded-lg border-2 px-3 py-2 transition-colors disabled:opacity-60 ${
                          adMode === opt.value
                            ? 'border-emerald-700 bg-emerald-100'
                            : 'border-emerald-200 bg-white hover:border-emerald-400'
                        }`}
                      >
                        <span className="block text-xs font-semibold text-emerald-900">
                          {opt.label}
                          {adMode === opt.value ? ' — attiva' : ''}
                        </span>
                        <span className="block text-[11px] text-emerald-800 mt-0.5">
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-red-800">
                    Cancellazione completa contatti e valutazioni
                  </p>
                  <p className="text-xs text-red-700">
                    Questa azione rimuove tutti i contatti e le valutazioni associate
                    dal database. Non può essere annullata. Usala solo per pulire
                    l&apos;ambiente di test.
                  </p>
                  <button
                    type="button"
                    onClick={handleAdminResetLeads}
                    className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 focus:outline-none"
                  >
                    Cancella tutti i contatti e le valutazioni
                  </button>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    )
  }

  function MainHeader({ variant }) {
    return (
      <>
        <header className="relative border-b-2 border-slate-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 relative">
            <div className="hidden lg:flex items-center justify-between">
              <button
                type="button"
                onClick={goToHomePage}
                className="flex items-center"
                aria-label="Vai alla home"
              >
                <img
                  src="/assets/Risorsa 2.png"
                  alt="Valuta Facile"
                  className="h-8 w-auto object-contain"
                />
              </button>
              <nav className="flex items-center space-x-8 text-sm">
                <button
                  type="button"
                  onClick={goToHomePage}
                  className="text-gray-800 hover:text-gray-900"
                >
                  {variant.nav.home || 'Home'}
                </button>
                <button
                  type="button"
                  onClick={goToBlogPage}
                  className="text-gray-800 hover:text-gray-900"
                >
                  {variant.nav.blog || 'Blog'}
                </button>
                <button
                  type="button"
                  onClick={goToFaqPage}
                  className="text-gray-800 hover:text-gray-900"
                >
                  {variant.nav.faq || 'Domande frequenti'}
                </button>
                <button
                  type="button"
                  onClick={goToHelpCenterPage}
                  className="text-gray-800 hover:text-gray-900"
                >
                  {variant.nav.support || 'Centro assistenza'}
                </button>
                <button
                  type="button"
                  onClick={goToContactPage}
                  className="text-gray-800 hover:text-gray-900"
                >
                  {variant.nav.contact}
                </button>
                {session?.user ? (
                  <UserMenu onNavigateToProfile={() => setCurrentPage('profilo')} />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="text-gray-700 hover:text-gray-900"
                  >
                    {variant.nav.login}
                  </button>
                )}
                <button
                  type="button"
                  onClick={goToValuationPage}
                  className="inline-flex items-center rounded-md bg-indigo-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-950"
                >
                  {variant.nav.cta}
                  <span className="ml-2 text-base leading-none">➜</span>
                </button>
              </nav>
            </div>

            <div className="flex items-center justify-between lg:hidden">
              <button
                type="button"
                onClick={() => setIsTestHomeMenuOpen(prev => !prev)}
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-slate-300 bg-white text-slate-900"
                aria-label="Apri menu di navigazione"
                aria-expanded={isTestHomeMenuOpen ? 'true' : 'false'}
              >
                {isTestHomeMenuOpen ? (
                  <span className="text-xl leading-none">&times;</span>
                ) : (
                  <span className="flex flex-col space-y-1">
                    <span className="block w-4 h-[1.5px] bg-slate-900 rounded-sm" />
                    <span className="block w-4 h-[1.5px] bg-slate-900 rounded-sm" />
                    <span className="block w-4 h-[1.5px] bg-slate-900 rounded-sm" />
                  </span>
                )}
              </button>
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={goToHomePage}
                    aria-label="Vai alla home"
                    className="flex items-center"
                  >
                    <img
                      src="/assets/Risorsa 2.png"
                      alt="Valuta Facile"
                      className="h-7 w-auto object-contain"
                    />
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsA11yPanelOpen(true)}
                className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-blue-600 text-white shadow-md"
                aria-label="Apri pannello accessibilità"
              >
                <span className="text-lg leading-none">♿</span>
              </button>
            </div>
            <div
              className={`absolute inset-x-0 top-full z-40 lg:hidden test-home-menu-panel ${
                isTestHomeMenuOpen ? 'test-home-menu-open' : 'test-home-menu-close'
              }`}
            >
              <div className="bg-white border-b-2 border-l-2 border-r-2 border-t-0 border-slate-900 rounded-b-2xl shadow-[6px_6px_0_rgba(15,23,42,1)] overflow-hidden">
                <nav className="px-5 py-4 space-y-3 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTestHomeMenuOpen(false)
                      goToHomePage()
                    }}
                    className="block w-full text-left text-gray-800 hover:text-gray-900"
                  >
                    {variant.nav.home || 'Home'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTestHomeMenuOpen(false)
                      goToBlogPage()
                    }}
                    className="block w-full text-left text-gray-800 hover:text-gray-900"
                  >
                    {variant.nav.blog || 'Blog'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTestHomeMenuOpen(false)
                      goToFaqPage()
                    }}
                    className="block w-full text-left text-gray-800 hover:text-gray-900"
                  >
                    {variant.nav.faq || 'Domande frequenti'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTestHomeMenuOpen(false)
                      goToHelpCenterPage()
                    }}
                    className="block w-full text-left text-gray-800 hover:text-gray-900"
                  >
                    {variant.nav.support || 'Centro assistenza'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTestHomeMenuOpen(false)
                      goToContactPage()
                    }}
                    className="block w-full text-left text-gray-800 hover:text-gray-900"
                  >
                    {variant.nav.contact}
                  </button>
                  {session?.user ? (
                    <>
                      {/* Nel menu mobile evitiamo il dropdown assoluto di UserMenu: il
                          pannello del menu ha overflow-hidden (per gli angoli arrotondati
                          e l'animazione), quindi un dropdown flottante nato al suo interno
                          veniva tagliato e "Il mio profilo"/"Esci" risultavano irraggiungibili.
                          Qui usiamo voci semplici in linea, come le altre. */}
                      <div className="flex items-center gap-2 pt-1 pb-1 text-gray-500 text-xs uppercase tracking-wide">
                        <span className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-black">
                          {session.user.name?.charAt(0).toUpperCase() || '?'}
                        </span>
                        <span className="truncate normal-case text-sm text-gray-800 font-semibold">
                          {session.user.name || session.user.email}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setIsTestHomeMenuOpen(false); setCurrentPage('profilo') }}
                        className="block w-full text-left text-gray-800 hover:text-gray-900"
                      >
                        Il mio profilo
                      </button>
                      <button
                        type="button"
                        onClick={async () => { setIsTestHomeMenuOpen(false); await authClient.signOut() }}
                        className="block w-full text-left text-red-600 hover:text-red-700"
                      >
                        Esci
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="block w-full text-left text-gray-700 hover:text-gray-900"
                      onClick={() => { setIsTestHomeMenuOpen(false); setIsAuthModalOpen(true) }}
                    >
                      {variant.nav.login}
                    </button>
                  )}
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsTestHomeMenuOpen(false)
                        goToValuationPage()
                      }}
                      className="inline-flex w-full items-center justify-center rounded-md bg-indigo-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-950"
                    >
                      {variant.nav.cta}
                      <span className="ml-2 text-base leading-none">➜</span>
                    </button>
                  </div>
                </nav>
              </div>
            </div>
          </div>
        </header>

        {isA11yPanelOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <button
              type="button"
              onClick={() => setIsA11yPanelOpen(false)}
              className="flex-1 bg-slate-900/35"
              aria-label="Chiudi pannello accessibilità"
            />
            <aside className="relative h-full w-72 max-w-[80%] bg-sky-50 border-l border-slate-200 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center">
                    <span className="text-xl leading-none">♿</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Accessibility</div>
                    <div className="text-xs text-slate-600">(EAA)</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsA11yPanelOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700"
                  aria-label="Chiudi pannello"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 text-sm">
                <button
                  type="button"
                  onClick={() =>
                    setA11ySettings(prev => ({
                      ...prev,
                      textScale: Math.min(prev.textScale + 0.1, 1.6)
                    }))
                  }
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-slate-800 hover:bg-sky-100"
                >
                  <span>Ingrandisci testi</span>
                  <span className="text-base">＋</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setA11ySettings(prev => ({
                      ...prev,
                      textScale: Math.max(prev.textScale - 0.1, 0.8)
                    }))
                  }
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-slate-800 hover:bg-sky-100"
                >
                  <span>Rimpicciolisci testi</span>
                  <span className="text-base">−</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setA11ySettings(prev => ({
                      ...prev,
                      grayscale: !prev.grayscale
                    }))
                  }
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-slate-800 hover:bg-sky-100"
                >
                  <span>Scala di grigi</span>
                  <span className="text-base">▤</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setA11ySettings(prev => ({
                      ...prev,
                      highContrast: !prev.highContrast,
                      negativeContrast: prev.highContrast ? prev.negativeContrast : false
                    }))
                  }
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-slate-800 hover:bg-sky-100"
                >
                  <span>Alto contrasto</span>
                  <span className="text-base">◑</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setA11ySettings(prev => ({
                      ...prev,
                      negativeContrast: !prev.negativeContrast,
                      highContrast: prev.negativeContrast ? prev.highContrast : false
                    }))
                  }
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-slate-800 hover:bg-sky-100"
                >
                  <span>Contrasto negativo</span>
                  <span className="text-base">🌓</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setA11ySettings(prev => ({
                      ...prev,
                      lightBackground: !prev.lightBackground
                    }))
                  }
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-slate-800 hover:bg-sky-100"
                >
                  <span>Sfondo chiaro</span>
                  <span className="text-base">💡</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setA11ySettings(prev => ({
                      ...prev,
                      underlineLinks: !prev.underlineLinks
                    }))
                  }
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-slate-800 hover:bg-sky-100"
                >
                  <span>Links sottolineati</span>
                  <span className="text-base">🔗</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setA11ySettings(prev => ({
                      ...prev,
                      readableFont: !prev.readableFont
                    }))
                  }
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-slate-800 hover:bg-sky-100"
                >
                  <span>Caratteri leggibili</span>
                  <span className="text-base">A</span>
                </button>
                <button
                  type="button"
                  onClick={() => setA11ySettings(DEFAULT_A11Y_SETTINGS)}
                  className="mt-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-slate-800 hover:bg-sky-100"
                >
                  <span>Reimposta</span>
                  <span className="text-base">↺</span>
                </button>
              </div>
            </aside>
          </div>
        )}
      </>
    )
  }

  const testHomeCopyVariant =
    TEST_HOME_COPY_VARIANTS[ACTIVE_TEST_HOME_COPY] || TEST_HOME_COPY_VARIANTS.caide

  if (currentPage === 'test_home') {
    const variant = testHomeCopyVariant
    const lines = variant.heroTitleLines
    const accessibilityClasses = [
      a11ySettings.underlineLinks ? 'a11y-underline-links' : '',
      a11ySettings.readableFont ? 'a11y-readable-font' : '',
      a11ySettings.highContrast ? 'a11y-high-contrast' : '',
      a11ySettings.negativeContrast ? 'a11y-negative-contrast' : '',
      a11ySettings.lightBackground ? 'a11y-light-bg' : ''
    ]
      .filter(Boolean)
      .join(' ')
    const accessibilityStyle = {
      fontSize: `${a11ySettings.textScale * 100}%`,
      filter: a11ySettings.grayscale ? 'grayscale(1)' : undefined
    }
    return (
      <div
        className={`min-h-screen flex flex-col bg-white ${accessibilityClasses}`}
        style={accessibilityStyle}
      >
        <MainHeader variant={variant} />

        {showPaymentSuccessBanner && (
          <div className="bg-emerald-50 border-b-2 border-slate-900 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-sm sm:text-base text-slate-900 font-medium">
              ✅ Pagamento ricevuto! Ti abbiamo inviato una email per creare la password e accedere al tuo report. Controlla anche lo spam.
            </p>
            <button
              type="button"
              onClick={() => setShowPaymentSuccessBanner(false)}
              className="text-sm font-bold text-slate-900 underline shrink-0"
            >
              Chiudi
            </button>
          </div>
        )}

        <main>
          <div className="border-b-2 border-slate-900">
            <div className="flex flex-col lg:flex-row min-h-[70vh]">
              <section className="w-full lg:flex-1 bg-[#E3C9FF] px-6 sm:px-10 lg:px-16 py-10 sm:py-14 lg:py-16 flex relative">
                <div className="w-full max-w-3xl flex flex-col justify-center relative z-10">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
                    {lines[0]}
                    <br />
                    {lines[1]}
                    <br />
                    {lines[2]}
                  </h1>
                  <p className="mt-4 sm:mt-5 text-sm sm:text-base text-gray-800">
                    {variant.heroSubtitle}
                  </p>
                  <div className="mt-7 sm:mt-8">
                    <div className="bg-white border-2 border-slate-900 rounded-none shadow-[6px_6px_0_rgba(15,23,42,1)]">
                      <div className="flex items-stretch">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={testHomeQuery}
                            onChange={(e) => handleTestHomeSearch(e.target.value)}
                            placeholder="Es. Via Benedetto Croce 297 Pescara"
                            className="w-full px-4 sm:px-5 py-2.5 sm:py-3 text-sm text-gray-900 placeholder-gray-400 border-none focus:outline-none focus:ring-0"
                          />
                          {testHomeSuggestions.length > 0 && (
                            <div className="absolute left-0 right-0 mt-0 bg-white border-b-2 border-l-2 border-r-2 border-t-0 border-slate-900 rounded-b-2xl shadow-[6px_6px_0_rgba(15,23,42,1)] max-h-60 overflow-auto scroll-thin z-30 text-left px-2 py-2 space-y-2">
                              {testHomeSuggestions.map((s, index) => (
                                <button
                                  type="button"
                                  key={index}
                                  className="w-full rounded-xl border-2 border-slate-900 bg-white text-slate-900 text-left px-4 py-2 text-sm flex flex-col items-start gap-0.5 hover:bg-slate-900 hover:text-white transition-colors focus:outline-none focus:ring-0 focus:border-slate-900"
                                  onClick={() => handleTestHomeSelect(s)}
                                >
                                  <div className="font-medium">
                                    {s.display || s.street || ''}
                                  </div>
                                  <div className="text-xs opacity-80">
                                    {s.city || ''}
                                    {s.postcode ? ` • ${s.postcode}` : ''}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {testHomeLoading && (
                          <div className="flex items-center pr-3">
                            <div className="h-4 w-4 border-b-2 border-indigo-900 rounded-full animate-spin" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleTestHomeSubmit}
                          className="px-5 sm:px-7 bg-indigo-900 text-white text-xs sm:text-sm font-semibold uppercase tracking-wide"
                        >
                          Valuta
                        </button>
                      </div>
                    </div>
                    {testHomeError && (
                      <p className="mt-2 text-xs text-red-600">
                        {testHomeError}
                      </p>
                    )}
                  </div>
                </div>
                <div className="hidden sm:block absolute inset-0 z-0 flex items-end">
                  <MatterCtaPlayground />
                </div>
              </section>
              <section
                className="relative w-full lg:flex-1 border-t-2 lg:border-t-0 lg:border-l-2 border-slate-900 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-14 sm:py-16 overflow-hidden min-h-[360px] sm:min-h-[420px]"
                style={{
                  backgroundColor: '#FFD76A',
                  backgroundImage:
                    'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)',
                  backgroundSize: '32px 32px'
                }}
              >
                <div className="relative z-10 w-full max-w-md">
                  <TestHomeReviewSwiper />
                </div>
                <img
                  src="/assets/Risorsa 4.svg"
                  alt="Illustrazione Valuta Facile"
                  className="pointer-events-none select-none absolute bottom-0 left-2 sm:left-4 w-24 sm:w-28 md:w-32 lg:w-40 z-0"
                />
              </section>
            </div>
          </div>
          <div className="border-b-2 border-slate-900 bg-white">
            <div className="overflow-hidden">
              <div
                className="flex items-center gap-16 whitespace-nowrap px-10 py-6 md:py-8 text-base md:text-lg text-gray-900"
                style={{
                  animation: 'marquee 22s linear infinite',
                  fontFamily:
                    "'Unbounded', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                }}
              >
                {Array.from({ length: 6 }).map((_, repeatIndex) =>
                  variant.marquee.map((text, index) => (
                    <div
                      key={`${text}-${repeatIndex}-${index}`}
                      className="flex items-center space-x-2"
                    >
                      <span className="text-base">🏳️</span>
                      <span>{text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="border-b-2 border-slate-900">
            <div className="flex flex-col lg:flex-row">
              <section className="w-full lg:flex-1 bg-[#F5F3FF] px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
                <div className="w-full max-w-3xl">
                  <p className="text-sm font-semibold tracking-[0.18em] uppercase text-indigo-700">
                    Per chi è pensato Valuta Facile
                  </p>
                  <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900">
                    Il servizio è utile se ti riconosci in queste situazioni
                  </h2>
                  <p className="mt-4 text-sm sm:text-base text-gray-700 max-w-xl">
                    Che tu stia vendendo, dividendo quote tra eredi o semplicemente valutando opzioni,
                    Valuta Facile ti dà una base solida per prendere decisioni con calma.
                  </p>
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div className="h-full">
                      <div className="h-full sm:min-h-[9rem] rounded-2xl border-2 border-slate-900 bg-white px-4 py-3 shadow-[4px_4px_0_rgba(15,23,42,1)] flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Stai valutando se vendere
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-700">
                            Vuoi capire se è il momento giusto, senza essere subito contattato da agenzie
                            e senza impegni.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="h-full">
                      <div className="h-full sm:min-h-[9rem] rounded-2xl border-2 border-slate-900 bg-white px-4 py-3 shadow-[4px_4px_0_rgba(15,23,42,1)] flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Vuoi una base per ragionare
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-700">
                            Ti serve un primo numero per confrontare preventivi, quote tra eredi o proposte
                            d&apos;acquisto.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="h-full">
                      <div className="h-full sm:min-h-[9rem] rounded-2xl border-2 border-slate-900 bg-white px-4 py-3 shadow-[4px_4px_0_rgba(15,23,42,1)] flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Vuoi parlare con un&apos;agenzia preparato
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-700">
                            Prima di affidarti a un professionista vuoi avere un&apos;idea autonoma del valore
                            del tuo immobile.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="h-full">
                      <div className="h-full sm:min-h-[9rem] rounded-2xl border-2 border-slate-900 bg-white px-4 py-3 shadow-[4px_4px_0_rgba(15,23,42,1)] flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Gestisci più immobili o lavori nel settore
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-700">
                            Hai bisogno di uno strumento rapido per generare valutazioni preliminari da
                            affinare con la tua esperienza.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              <section className="w-full lg:flex-1 bg-[#F5F3FF] border-t-2 lg:border-t-0 lg:border-l-2 border-slate-900 px-6 sm:px-10 lg:px-16 py-10 sm:py-12 flex items-center justify-center">
                <div className="w-full max-w-md lg:max-w-lg">
                  <TargetAudienceVisual />
                </div>
              </section>
            </div>
          </div>
          <div className="border-b-2 border-slate-900">
            <div className="flex flex-col lg:flex-row">
              <section className="w-full lg:flex-1 bg-[#FFF7EB] px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
                <div className="w-full max-w-3xl">
                  <p className="text-sm font-semibold tracking-[0.18em] uppercase text-orange-700">
                    Come funziona Valuta Facile
                  </p>
                  <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900">
                    Ti guidiamo in tre semplici passi, senza tecnicismi e senza obblighi.
                  </h2>
                  <div className="mt-8 space-y-4">
                    <div className="rounded-2xl border-2 border-slate-900 bg-white px-4 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)]">
                      <div className="flex gap-4">
                        <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                          1
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-slate-900">
                            Inserisci i dati dell&apos;immobile
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-700">
                            Ti chiediamo solo le informazioni davvero utili: indirizzo, caratteristiche principali
                            e qualche dettaglio in più se vuoi rendere la stima ancora più precisa.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border-2 border-slate-900 bg-white px-4 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)]">
                      <div className="flex gap-4">
                        <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                          2
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-slate-900">
                            Lascia che il sistema lavori per te
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-700">
                            Il motore di valutazione incrocia i tuoi dati con valori di zona, caratteristiche
                            simili e analisi interne per costruire una stima realistica del prezzo.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border-2 border-slate-900 bg-white px-4 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)]">
                      <div className="flex gap-4">
                        <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                          3
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-slate-900">
                            Ricevi una stima chiara, pronta da usare
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-700">
                            Vedi subito una fascia di valore spiegata con parole semplici. Puoi salvarla,
                            confrontarla e – solo se vuoi – chiederci supporto per fare il passo successivo.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="mt-6 text-sm sm:text-base text-gray-700 max-w-xl">
                    La valutazione non ti vincola a nulla: sei tu a decidere se parlarne con un professionista
                    o usarla solo per orientarti.
                  </p>
                </div>
              </section>
              <section className="w-full lg:flex-1 bg-[#FFF7EB] border-t-2 lg:border-t-0 lg:border-l-2 border-slate-900 px-6 sm:px-10 lg:px-16 py-10 sm:py-12 flex items-center justify-center">
                <div className="w-full max-w-md lg:max-w-lg">
                  <HowItWorksVisual />
                </div>
              </section>
            </div>
          </div>
          <div className="border-b-2 border-slate-900">
            <div className="flex flex-col lg:flex-row">
              <section className="w-full lg:flex-1 bg-[#EEF2FF] px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
                <div className="w-full max-w-3xl">
                  <p className="text-sm font-semibold tracking-[0.18em] uppercase text-indigo-700">
                    Perché scegliere Valuta Facile
                  </p>
                  <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900">
                    Perché sempre più persone si affidano a Valuta Facile
                  </h2>
                  <p className="mt-4 text-sm sm:text-base text-gray-700 max-w-xl">
                    Non promettiamo miracoli: ti offriamo un quadro chiaro per decidere con consapevolezza.
                  </p>
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div className="h-full">
                      <div className="h-full sm:min-h-[9rem] rounded-2xl border-2 border-slate-900 bg-white px-4 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Semplifichiamo ciò che è complesso
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-700">
                            Traduciamo dati e modelli in indicazioni chiare, che puoi comprendere e spiegare anche ad altri.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="h-full">
                      <div className="h-full sm:min-h-[9rem] rounded-2xl border-2 border-slate-900 bg-white px-4 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Percorso pensato con esperti
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-700">
                            Le domande derivano da uno studio UX dedicato: meno frizioni, più chiarezza, più controllo per te.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="h-full">
                      <div className="h-full sm:min-h-[9rem] rounded-2xl border-2 border-slate-900 bg-white px-4 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Trasparenza sul risultato
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-700">
                            Ti spieghiamo quali fattori pesano di più sul valore (zona, stato, metratura, piano, ecc.).
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="h-full">
                      <div className="h-full sm:min-h-[9rem] rounded-2xl border-2 border-slate-900 bg-white px-4 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Rispetto per tempo e dati
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-700">
                            Riduciamo le richieste superflue, non ti bombardiamo di telefonate e puoi scegliere come essere ricontattato.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              <section className="w-full lg:flex-1 bg-[#EEF2FF] border-t-2 lg:border-t-0 lg:border-l-2 border-slate-900 px-6 sm:px-10 lg:px-16 py-10 sm:py-12 flex items-center justify-center">
                <div className="w-full max-w-md lg:max-w-lg">
                  <WhyChooseVisual />
                </div>
              </section>
            </div>
          </div>
          <div className="border-b-2 border-slate-900">
            <div className="flex flex-col lg:flex-row">
              <section className="w-full lg:flex-1 bg-[#ECFEF3] px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
                <div className="w-full max-w-3xl">
                  <p className="text-sm font-semibold tracking-[0.18em] uppercase text-emerald-700">
                    Dati e privacy
                  </p>
                  <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900">
                    I tuoi dati restano sotto il tuo controllo
                  </h2>
                  <p className="mt-4 text-sm sm:text-base text-gray-700 max-w-xl">
                    Per costruire una valutazione credibile servono informazioni reali. Per questo proteggere i tuoi
                    dati è una priorit&agrave;, non un dettaglio tecnico.
                  </p>
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 text-sm text-slate-700">
                    <div className="rounded-2xl border-2 border-slate-900 bg-white px-4 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)]">
                      <p>
                        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 align-middle" />
                        Usiamo i tuoi dati solo per fornirti la valutazione e i servizi che richiedi.
                      </p>
                    </div>
                    <div className="rounded-2xl border-2 border-slate-900 bg-white px-4 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)]">
                      <p>
                        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 align-middle" />
                        Non vendiamo le tue informazioni: eventuali contatti con agenzie o professionisti avvengono
                        solo se ci autorizzi esplicitamente.
                      </p>
                    </div>
                    <div className="rounded-2xl border-2 border-slate-900 bg-white px-4 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)]">
                      <p>
                        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 align-middle" />
                        Puoi chiederci in ogni momento di aggiornare o cancellare i tuoi dati, come previsto dalla
                        normativa sulla privacy.
                      </p>
                    </div>
                  </div>
                  <p className="mt-6 text-sm sm:text-base text-gray-700 max-w-xl">
                    Vuoi saperne di pi&ugrave;? Puoi consultare la privacy policy completa e il registro dei trattamenti
                    direttamente dall&apos;applicazione.
                  </p>
                </div>
              </section>
              <section className="w-full lg:flex-1 bg-[#ECFEF3] border-t-2 lg:border-t-0 lg:border-l-2 border-slate-900 px-6 sm:px-10 lg:px-16 py-10 sm:py-12 flex items-center justify-center">
                <div className="w-full max-w-md lg:max-w-lg">
                  <DataPrivacyVisual />
                </div>
              </section>
            </div>
          </div>

          <div className="bg-[#FFF7EB]">
            <div className="flex flex-col lg:flex-row">
              <section className="w-full lg:flex-1 px-6 sm:px-10 lg:px-16 py-10 lg:py-16">
                <div className="w-full max-w-3xl lg:pr-8 xl:sticky xl:top-24">
                  <p className="text-sm font-semibold tracking-[0.18em] uppercase text-orange-700">
                    Domande frequenti
                  </p>
                  <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900">
                    Hai ancora dubbi? Possiamo chiarirli insieme.
                  </h2>
                  <p className="mt-4 text-sm sm:text-base text-gray-700 max-w-xl">
                    Se non trovi qui la risposta che cerchi, puoi contattarci direttamente: ti aiutiamo a capire se Valuta
                    Facile è lo strumento giusto per te.
                  </p>
                  <div
                    className="mt-8 rounded-3xl border-2 border-slate-900 bg-[#EDE9FE] px-6 py-6 shadow-[6px_6px_0_rgba(15,23,42,1)]"
                  >
                    <h3 className="text-sm font-bold text-slate-900">
                      Hai altre domande?
                    </h3>
                    <p className="mt-2 text-sm text-slate-700">
                      Scrivici o prenota una chiamata: possiamo vedere insieme il tuo caso.
                    </p>
                    <div className="mt-4">
                      <a
                        href="#contatti"
                        className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-[4px_4px_0_rgba(15,23,42,1)] hover:bg-slate-800"
                      >
                        Vai ai contatti
                        <span className="ml-2 text-base" aria-hidden="true">
                          →
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              </section>
              <section className="w-full lg:flex-1 px-6 sm:px-10 lg:px-16 py-12 lg:py-16 bg-[#FFF7EB]">
                <div className="w-full max-w-3xl lg:max-w-none lg:ml-auto">
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(openFaqIndex === 0 ? -1 : 0)}
                      className="w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-slate-900">
                            La valutazione è davvero gratuita?
                          </h3>
                          {openFaqIndex === 0 && (
                            <p className="mt-1.5 text-sm text-slate-700">
                              Sì. Utilizzare Valuta Facile per ottenere una stima non ha costi e non comporta obblighi di
                              affidarti a un&apos;agenzia o a un professionista.
                            </p>
                          )}
                        </div>
                        <span className="ml-2 text-base leading-none">
                          {openFaqIndex === 0 ? '↓' : '→'}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(openFaqIndex === 1 ? -1 : 1)}
                      className="w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-slate-900">
                            Cosa succede dopo che ho ricevuto la valutazione?
                          </h3>
                          {openFaqIndex === 1 && (
                            <p className="mt-1.5 text-sm text-slate-700">
                              Puoi semplicemente tenerla per te, usarla come riferimento oppure chiederci supporto per capire
                              come valorizzare al meglio il tuo immobile. Nessun passaggio è automatico o imposto.
                            </p>
                          )}
                        </div>
                        <span className="ml-2 text-base leading-none">
                          {openFaqIndex === 1 ? '↓' : '→'}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(openFaqIndex === 2 ? -1 : 2)}
                      className="w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-slate-900">
                            Devo lasciare per forza il mio numero di telefono?
                          </h3>
                          {openFaqIndex === 2 && (
                            <p className="mt-1.5 text-sm text-slate-700">
                              No. Puoi decidere quali recapiti indicarci e come preferisci essere ricontattato. Se non vuoi
                              telefonate, lo rispettiamo.
                            </p>
                          )}
                        </div>
                        <span className="ml-2 text-base leading-none">
                          {openFaqIndex === 2 ? '↓' : '→'}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(openFaqIndex === 3 ? -1 : 3)}
                      className="w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-slate-900">
                            La stima è uguale a quella di un perito o di un agente?
                          </h3>
                          {openFaqIndex === 3 && (
                            <p className="mt-1.5 text-sm text-slate-700">
                              La nostra è una valutazione online, pensata come base di partenza. È molto utile per orientarti e
                              può essere poi approfondita insieme a un professionista, se lo desideri.
                            </p>
                          )}
                        </div>
                        <span className="ml-2 text-base leading-none">
                          {openFaqIndex === 3 ? '↓' : '→'}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(openFaqIndex === 4 ? -1 : 4)}
                      className="w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-slate-900">
                            Quanto è precisa la valutazione rispetto al mercato attuale?
                          </h3>
                          {openFaqIndex === 4 && (
                            <p className="mt-1.5 text-sm text-slate-700">
                              Usiamo dati ufficiali e analisi aggiornate per costruire una fascia di valore realistica. La
                              stima non sostituisce una perizia, ma ti dà un riferimento affidabile per orientare le tue scelte.
                            </p>
                          )}
                        </div>
                        <span className="ml-2 text-base leading-none">
                          {openFaqIndex === 4 ? '↓' : '→'}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(openFaqIndex === 5 ? -1 : 5)}
                      className="w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-slate-900">
                            Posso usare Valuta Facile anche se sto solo pensando di vendere?
                          </h3>
                          {openFaqIndex === 5 && (
                            <p className="mt-1.5 text-sm text-slate-700">
                              Certo. Molte persone usano la valutazione per farsi un&apos;idea del valore prima di prendere
                              qualsiasi decisione. Non ci sono vincoli né obblighi di mettere in vendita l&apos;immobile.
                            </p>
                          )}
                        </div>
                        <span className="ml-2 text-base leading-none">
                          {openFaqIndex === 5 ? '↓' : '→'}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {adMode === 'banner' && (
            <div className="border-t-2 border-slate-900 bg-white">
              <div className="max-w-5xl mx-auto px-6 sm:px-10 lg:px-16 py-6">
                <AdBanner
                  slotEnvVar="VITE_ADSENSE_SLOT_HOME"
                  placeholderLabel="Spazio pubblicitario"
                />
              </div>
            </div>
          )}

          <div className="border-t-2 border-slate-900 bg-white hero-sky">
            <section className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 lg:px-16 py-14 lg:py-20">
              <div className="w-full max-w-4xl mx-auto">
                <div className="rounded-3xl border-2 border-slate-900 bg-white px-6 sm:px-10 py-8 sm:py-10 shadow-[8px_8px_0_rgba(15,23,42,1)] flex flex-col items-center text-center">
                  <p className="text-xs sm:text-sm font-semibold tracking-[0.22em] uppercase text-indigo-700">
                    Inizia da qui
                  </p>
                  <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
                    {lines[0]}
                    <br />
                    {lines[1]}
                    <br />
                    {lines[2]}
                  </h2>
                  <p className="mt-4 text-sm sm:text-base text-gray-800 max-w-2xl">
                    {variant.heroSubtitle}
                  </p>
                  <div className="mt-8 sm:mt-9 w-full max-w-3xl">
                    <div className="bg-white border-2 border-slate-900 rounded-none shadow-[6px_6px_0_rgba(15,23,42,1)]">
                      <div className="flex items-stretch">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={testHomeQuery}
                            onChange={(e) => handleTestHomeSearch(e.target.value)}
                            placeholder="Es. Via Benedetto Croce 297 Pescara"
                            className="w-full px-4 sm:px-6 py-3 sm:py-3.5 text-sm sm:text-base text-gray-900 placeholder-gray-400 border-none focus:outline-none focus:ring-0"
                          />
                          {testHomeSuggestions.length > 0 && (
                            <div className="absolute left-0 right-0 mt-0 bg-white border-b-2 border-l-2 border-r-2 border-t-0 border-slate-900 rounded-b-2xl shadow-[6px_6px_0_rgba(15,23,42,1)] max-h-60 overflow-auto scroll-thin z-30 text-left px-2 py-2 space-y-2">
                              {testHomeSuggestions.map((s, index) => (
                                <button
                                  type="button"
                                  key={index}
                                  className="w-full rounded-xl border-2 border-slate-900 bg-white text-slate-900 text-left px-4 py-2 text-sm flex flex-col items-start gap-0.5 hover:bg-slate-900 hover:text-white transition-colors focus:outline-none focus:ring-0 focus:border-slate-900"
                                  onClick={() => handleTestHomeSelect(s)}
                                >
                                  <div className="font-medium">
                                    {s.display || s.street || ''}
                                  </div>
                                  <div className="text-xs opacity-80">
                                    {s.city || ''}
                                    {s.postcode ? ` • ${s.postcode}` : ''}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {testHomeLoading && (
                          <div className="flex items-center pr-3">
                            <div className="h-4 w-4 border-b-2 border-indigo-900 rounded-full animate-spin" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleTestHomeSubmit}
                          className="px-6 sm:px-9 bg-indigo-900 text-white text-xs sm:text-sm font-semibold uppercase tracking-[0.18em]"
                        >
                          Valuta
                        </button>
                      </div>
                    </div>
                    {testHomeError && (
                      <p className="mt-2 text-xs text-red-600">
                        {testHomeError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="border-t-2 border-slate-900 bg-white">
            <div className="flex flex-col lg:flex-row">
              <section className="w-full lg:flex-1 bg-white px-6 sm:px-10 lg:px-16 py-14 lg:py-20">
                <div className="w-full max-w-3xl">
                  <div className="rounded-3xl border-2 border-slate-900 bg-indigo-50 px-6 sm:px-8 py-7 sm:py-8 shadow-[8px_8px_0_rgba(15,23,42,1)]">
                    <p className="text-xs sm:text-sm font-semibold tracking-[0.22em] uppercase text-indigo-700">
                      Newsletter
                    </p>
                    <h3 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
                      Ricevi consigli e dati sul mercato immobiliare
                    </h3>
                    <p className="mt-3 text-sm sm:text-base text-gray-800">
                      Una volta al mese, niente spam: solo idee pratiche per capire quando vendere,
                      come valutare meglio il tuo immobile e come evitare errori costosi.
                    </p>
                    <form
                      className="mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4"
                      onSubmit={handleNewsletterSubmit}
                    >
                      <input
                        type="email"
                        required
                        placeholder="Inserisci la tua email"
                        value={newsletterEmail}
                        onChange={e => setNewsletterEmail(e.target.value)}
                        className="flex-1 px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-slate-900 rounded-none focus:outline-none focus:ring-0 text-gray-900 placeholder-gray-400"
                      />
                      <button
                        type="submit"
                        className="px-5 sm:px-7 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] bg-indigo-900 text-white border-2 border-slate-900"
                      >
                        Iscriviti
                      </button>
                    </form>
                    <p className="mt-3 text-xs text-gray-500">
                      Iscrivendoti accetti di ricevere email informative da Valuta Facile. Nessuna
                      rivendita dei tuoi dati.
                    </p>
                    {newsletterMessage && (
                      <p className="mt-2 text-xs text-gray-700">{newsletterMessage}</p>
                    )}
                  </div>
                </div>
              </section>

              <section className="w-full lg:flex-1 bg-white border-t-2 lg:border-t-0 lg:border-l-2 border-slate-900 px-6 sm:px-10 lg:px-16 py-14 lg:py-20">
                <div className="w-full max-w-3xl">
                  <div className="h-full rounded-3xl border-2 border-slate-900 bg-slate-50 px-4 sm:px-6 py-6 sm:py-7 shadow-[8px_8px_0_rgba(15,23,42,1)]">
                    <div className="flex items-center justify-between gap-3 mb-5">
                      <div className="text-left">
                        <p className="text-xs sm:text-sm font-semibold tracking-[0.22em] uppercase text-indigo-700">
                          Dal nostro blog
                        </p>
                        <h3 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
                          Idee rapide sul mercato immobiliare
                        </h3>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
                        <span>Scorri gli articoli</span>
                        <button
                          type="button"
                          onClick={goToBlogPage}
                          className="inline-flex items-center rounded-full border border-slate-900 bg-white px-3 py-1.5 font-semibold text-[11px] text-slate-900 shadow-[2px_2px_0_rgba(15,23,42,1)] hover:bg-slate-900 hover:text-white transition-colors"
                        >
                          Vai al blog
                        </button>
                      </div>
                    </div>
                    <BlogArticlesSlider onOpenArticle={goToBlogArticle} />
                    <div className="mt-4 sm:hidden">
                      <button
                        type="button"
                        onClick={goToBlogPage}
                        className="inline-flex w-full items-center justify-center rounded-full border border-slate-900 bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-[2px_2px_0_rgba(15,23,42,1)] hover:bg-slate-900 hover:text-white transition-colors"
                      >
                        Vai alla pagina blog
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>

        <MainFooter
          onOpenPrivacy={goToPrivacyPage}
          onOpenContact={goToContactPage}
          onOpenHelp={goToHelpCenterPage}
          onOpenFaq={goToFaqPage}
          onOpenTerms={goToTermsPage}
          onOpenCookies={goToCookiesPage}
          onOpenCookieSettings={handleOpenCookieSettings}
        />

        {isAuthModalOpen && (
          <AuthModal
            onClose={() => setIsAuthModalOpen(false)}
            onSuccess={() => setIsAuthModalOpen(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {(!hasDecidedCookieConsent || isCookieSettingsForcedOpen) &&
        currentPage !== 'privacy' &&
        currentPage !== 'test_home' && (
        <div className="fixed inset-x-0 bottom-0 z-50">
          <div className="max-w-2xl mx-auto mb-4 px-4">
            <div className="bg-slate-900/95 border border-slate-700 rounded-2xl shadow-xl backdrop-blur px-4 py-4 md:px-5 md:py-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex-1 md:mr-4">
                  <p className="text-sm font-medium text-slate-50">
                    Usiamo cookie tecnici necessari al funzionamento del sito. Con il tuo consenso possiamo
                    usarne anche per statistiche e marketing.
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    Per dettagli consulta la nostra{' '}
                    <button
                      type="button"
                      onClick={goToCookiesPage}
                      className="underline underline-offset-2 text-sky-300 hover:text-sky-200"
                    >
                      cookie policy
                    </button>
                    .
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCookiePanelExpanded((prev) => !prev)}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
                  >
                    Personalizza
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectNonEssentialCookies}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
                  >
                    Rifiuta non necessari
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptAllCookies}
                    className="inline-flex items-center justify-center rounded-lg bg-sky-500 hover:bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm"
                  >
                    Accetta tutti
                  </button>
                </div>
              </div>

              {isCookiePanelExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                  <label className="flex items-start gap-2 text-xs text-slate-200">
                    <input type="checkbox" checked disabled className="mt-0.5" />
                    <span>
                      <span className="font-semibold text-slate-50">Cookie tecnici (sempre attivi)</span>
                      <br />
                      Necessari al funzionamento del sito, non richiedono consenso.
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={cookieConsent.statistiche}
                      onChange={(e) =>
                        setCookieConsent((prev) => ({ ...prev, statistiche: e.target.checked }))
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-semibold text-slate-50">Cookie di analisi statistica</span>
                      <br />
                      Ci aiutano a capire come viene usato il sito (es. Google Analytics o soluzioni equivalenti).
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={cookieConsent.marketing}
                      onChange={(e) =>
                        setCookieConsent((prev) => ({ ...prev, marketing: e.target.checked }))
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-semibold text-slate-50">Cookie di profilazione e marketing</span>
                      <br />
                      Usati, se presenti, per proporti contenuti pubblicitari in linea con i tuoi interessi.
                    </span>
                  </label>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveCustomCookies}
                      className="inline-flex items-center justify-center rounded-lg bg-sky-500 hover:bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm"
                    >
                      Salva preferenze
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <MainHeader variant={testHomeCopyVariant} />

      {currentPage === 'contact' && (
        <div className="border-t-2 border-slate-900 bg-white">
          <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.2fr,1fr] items-start">
              <div>
                <p className="text-xs font-semibold tracking-[0.25em] uppercase text-indigo-700">
                  Contatti
                </p>
                <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
                  Parla con il team Valuta Facile
                </h1>
                <p className="mt-4 text-sm sm:text-base text-slate-700 max-w-xl">
                  Se sei un&apos;agenzia, un investitore o hai bisogno di chiarimenti
                  sulla valutazione del tuo immobile, compila il modulo per essere
                  ricontattato. Usiamo i tuoi dati solo per rispondere alla tua richiesta.
                </p>
                <div className="mt-6 space-y-3 text-sm text-slate-700">
                  <div className="flex items-start gap-3">
                    <span className="mt-1">🏠</span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Collaborazioni e agenzie immobiliari
                      </p>
                      <p className="text-slate-700">
                        Valutiamo progetti pilota, integrazioni con CRM e flussi
                        dedicati per reti agenziali.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1">📊</span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Domande sulla valutazione
                      </p>
                      <p className="text-slate-700">
                        Se hai dubbi sui risultati ottenuti o vuoi capire meglio come
                        vengono usati i dati OMI, scrivici senza impegno.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1">🔐</span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Supporto e privacy
                      </p>
                      <p className="text-slate-700">
                        Per richieste su dati, privacy o uso dell&apos;app possiamo
                        fornirti indicazioni operative rapide.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="rounded-3xl border-2 border-slate-900 bg-white shadow-[10px_10px_0_rgba(15,23,42,1)] px-5 sm:px-6 py-6 sm:py-7">
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                    Invia una richiesta di contatto
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-700">
                    Ti risponderemo il prima possibile, usando l&apos;email o il
                    numero che inserisci qui sotto.
                  </p>
                  <div className="mt-5">
                    <ContactForm
                      onSubmit={handleContactPageSubmit}
                      onOpenPrivacy={goToPrivacyPage}
                    />
                  </div>
                  {contactPageMessage && (
                    <p className="mt-4 text-xs sm:text-sm text-slate-800">
                      {contactPageMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {currentPage === 'support' && (
        <div className="border-t-2 border-slate-900 bg-white">
          <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.1fr,1fr] items-start">
              <div>
                <p className="text-xs font-semibold tracking-[0.25em] uppercase text-indigo-700">
                  Centro assistenza
                </p>
                <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
                  Hai bisogno di aiuto con Valuta Facile?
                </h1>
                <p className="mt-4 text-sm sm:text-base text-slate-700 max-w-xl">
                  Qui puoi chiedere supporto per problemi tecnici, accesso all&apos;account,
                  dubbi sul funzionamento della piattaforma o richieste di assistenza dedicate.
                </p>
                <div className="mt-6 space-y-3 text-sm text-slate-700">
                  <div className="flex items-start gap-3">
                    <span className="mt-1">🛠️</span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Problemi tecnici o errori
                      </p>
                      <p className="text-slate-700">
                        Segnalaci anomalie nella valutazione, problemi di caricamento o bug nel flusso guidato.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1">👤</span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Accesso, account e dati
                      </p>
                      <p className="text-slate-700">
                        Richiedi assistenza per accessi, modifiche ai tuoi dati o cancellazione di informazioni.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1">📨</span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Supporto personalizzato
                      </p>
                      <p className="text-slate-700">
                        Se hai esigenze particolari o vuoi integrare Valuta Facile nei tuoi processi, descrivici il caso.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="rounded-3xl border-2 border-slate-900 bg-white shadow-[10px_10px_0_rgba(15,23,42,1)] px-5 sm:px-6 py-6 sm:py-7">
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                    Apri una richiesta di assistenza
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-700">
                    Raccontaci in modo chiaro il problema: ti risponderemo via email il prima possibile.
                  </p>
                  <form
                    className="mt-5 space-y-4"
                    onSubmit={async event => {
                      event.preventDefault()
                      const form = event.currentTarget
                      const formData = new FormData(form)
                      const nome = String(formData.get('nome') || '').trim()
                      const email = String(formData.get('email') || '').trim()
                      const categoria = String(formData.get('categoria') || '').trim()
                      const messaggio = String(formData.get('messaggio') || '').trim()
                      const privacyAccepted = formData.get('privacy') === 'on'
                      if (!nome || !email || !categoria || !messaggio || !privacyAccepted) {
                        setSupportPageMessage(
                          'Compila tutti i campi obbligatori e accetta la privacy per inviare la richiesta.'
                        )
                        return
                      }
                      setSupportPageMessage('')
                      try {
                        await submitLead({
                          contact: {
                            nome,
                            cognome: '',
                            email,
                            telefono: ''
                          },
                          address: null,
                          property: null,
                          valuation: null,
                          wizardData: {
                            lead: {
                              profileType: 'SUPPORT',
                              isOwner: false,
                              saleTiming: '',
                              wantAgenciesValuation: false,
                              marketingConsent: true,
                              source: 'support',
                              supportCategory: categoria,
                              supportMessage: messaggio
                            }
                          }
                        })
                        form.reset()
                        setSupportPageMessage(
                          'Richiesta di assistenza inviata correttamente. Ti risponderemo via email appena possibile.'
                        )
                      } catch (e) {
                        setSupportPageMessage(
                          'Non siamo riusciti a inviare la richiesta di assistenza. Riprova tra qualche minuto.'
                        )
                      }
                    }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="support-nome"
                          className="block text-sm font-semibold text-slate-900 mb-1"
                        >
                          Nome *
                        </label>
                        <input
                          id="support-nome"
                          name="nome"
                          type="text"
                          required
                          className="w-full px-3 py-2 rounded-xl border-2 border-slate-900 text-sm bg-white text-slate-900 focus:outline-none focus:ring-0 focus:border-slate-900"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="support-email"
                          className="block text-sm font-semibold text-slate-900 mb-1"
                        >
                          Email *
                        </label>
                        <input
                          id="support-email"
                          name="email"
                          type="email"
                          required
                          className="w-full px-3 py-2 rounded-xl border-2 border-slate-900 text-sm bg-white text-slate-900 focus:outline-none focus:ring-0 focus:border-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="support-categoria"
                        className="block text-sm font-semibold text-slate-900 mb-1"
                      >
                        Tipo di richiesta *
                      </label>
                      <select
                        id="support-categoria"
                        name="categoria"
                        required
                        className="w-full px-3 py-2 rounded-xl border-2 border-slate-900 text-sm bg-white text-slate-900 focus:outline-none focus:ring-0 focus:border-slate-900"
                      >
                        <option value="">Seleziona un&apos;opzione</option>
                        <option value="problemi-tecnici">Problemi tecnici o errori</option>
                        <option value="accesso-account">Accesso e account</option>
                        <option value="dati-e-privacy">Dati personali e privacy</option>
                        <option value="integrazioni">Integrazioni e uso avanzato</option>
                        <option value="altro">Altro</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="support-messaggio"
                        className="block text-sm font-semibold text-slate-900 mb-1"
                      >
                        Descrivi il problema o la richiesta *
                      </label>
                      <textarea
                        id="support-messaggio"
                        name="messaggio"
                        required
                        rows={4}
                        className="w-full px-3 py-2 rounded-xl border-2 border-slate-900 text-sm bg-white text-slate-900 focus:outline-none focus:ring-0 focus:border-slate-900 resize-none"
                      />
                    </div>

                    <div className="pt-2">
                      <label className="flex items-start text-xs sm:text-sm text-slate-700">
                        <input
                          type="checkbox"
                          name="privacy"
                          className="mt-0.5 h-4 w-4 rounded border-2 border-slate-900 text-slate-900 focus:ring-0"
                          required
                        />
                        <span className="ml-3">
                          Dichiaro di aver letto e compreso la{' '}
                          <button
                            type="button"
                            onClick={goToPrivacyPage}
                            className="font-semibold text-slate-900 underline underline-offset-2"
                          >
                            privacy policy
                          </button>{' '}
                          e acconsento al trattamento dei miei dati per finalità di assistenza.
                        </span>
                      </label>
                    </div>

                    <div className="pt-3">
                      <button
                        type="submit"
                        className="w-full h-11 inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-sm font-semibold shadow-[4px_4px_0_rgba(15,23,42,1)] hover:bg-slate-800 transition-colors"
                      >
                        Invia richiesta di assistenza
                      </button>
                    </div>
                  </form>
                  {supportPageMessage && (
                    <p className="mt-4 text-xs sm:text-sm text-slate-800">
                      {supportPageMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {currentPage === 'faq' && (
        <div className="border-t-2 border-slate-900 bg-white">
          <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.1fr,1fr] items-start">
              <div>
                <p className="text-xs font-semibold tracking-[0.25em] uppercase text-indigo-700">
                  Domande frequenti
                </p>
                <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
                  Dubbi sulla valutazione o sull&apos;uso di Valuta Facile?
                </h1>
                <p className="mt-4 text-sm sm:text-base text-slate-700 max-w-xl">
                  Qui trovi le risposte alle domande più comuni su come funziona la valutazione,
                  quali dati utilizziamo e come gestiamo le tue informazioni.
                </p>
                <p className="mt-4 text-sm sm:text-base text-slate-700 max-w-xl">
                  Se non trovi quello che cerchi, puoi sempre aprire una richiesta dal{' '}
                  <button
                    type="button"
                    onClick={goToHelpCenterPage}
                    className="font-semibold text-slate-900 underline underline-offset-2"
                  >
                    Centro assistenza
                  </button>
                  .
                </p>
              </div>

              <div className="bg-[#FFF7EB] rounded-3xl border-2 border-slate-900 px-4 sm:px-6 py-6 sm:py-7 shadow-[8px_8px_0_rgba(15,23,42,1)]">
                <p className="text-xs sm:text-sm font-semibold tracking-[0.22em] uppercase text-indigo-700">
                  Panoramica rapida
                </p>
                <p className="mt-3 text-sm sm:text-base text-slate-800">
                  Valuta Facile ti aiuta a ottenere una stima ragionata del valore del tuo immobile,
                  guidandoti passo dopo passo. Le risposte qui sotto ti aiutano a capire meglio cosa succede
                  dietro le quinte.
                </p>
              </div>
            </div>
          </section>

          <section className="border-t-2 border-slate-900 bg-[#FFF7EB]">
            <div className="max-w-5xl mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === 0 ? -1 : 0)}
                  className="w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-slate-900">
                        La valutazione è davvero gratuita?
                      </h3>
                      {openFaqIndex === 0 && (
                        <p className="mt-1.5 text-sm text-slate-700">
                          Sì. Utilizzare Valuta Facile per ottenere una stima non ha costi e non comporta obblighi di
                          affidarti a un&apos;agenzia o a un professionista.
                        </p>
                      )}
                    </div>
                    <span className="ml-2 text-base leading-none">
                      {openFaqIndex === 0 ? '↓' : '→'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === 1 ? -1 : 1)}
                  className="w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-slate-900">
                        Cosa succede dopo che ho ricevuto la valutazione?
                      </h3>
                      {openFaqIndex === 1 && (
                        <p className="mt-1.5 text-sm text-slate-700">
                          Puoi semplicemente tenerla per te, usarla come riferimento oppure chiederci supporto per capire
                          come valorizzare al meglio il tuo immobile. Nessun passaggio è automatico o imposto.
                        </p>
                      )}
                    </div>
                    <span className="ml-2 text-base leading-none">
                      {openFaqIndex === 1 ? '↓' : '→'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === 2 ? -1 : 2)}
                  className="w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-slate-900">
                        Devo lasciare per forza il mio numero di telefono?
                      </h3>
                      {openFaqIndex === 2 && (
                        <p className="mt-1.5 text-sm text-slate-700">
                          No. Puoi decidere quali recapiti indicarci e come preferisci essere ricontattato. Se non vuoi
                          telefonate, lo rispettiamo.
                        </p>
                      )}
                    </div>
                    <span className="ml-2 text-base leading-none">
                      {openFaqIndex === 2 ? '↓' : '→'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === 3 ? -1 : 3)}
                  className="w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-slate-900">
                        La stima è uguale a quella di un perito o di un agente?
                      </h3>
                      {openFaqIndex === 3 && (
                        <p className="mt-1.5 text-sm text-slate-700">
                          La nostra è una valutazione online, pensata come base di partenza. È molto utile per orientarti e
                          può essere poi approfondita insieme a un professionista, se lo desideri.
                        </p>
                      )}
                    </div>
                    <span className="ml-2 text-base leading-none">
                      {openFaqIndex === 3 ? '↓' : '→'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === 4 ? -1 : 4)}
                  className="w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-slate-900">
                        Quanto è precisa la valutazione rispetto al mercato attuale?
                      </h3>
                      {openFaqIndex === 4 && (
                        <p className="mt-1.5 text-sm text-slate-700">
                          Usiamo dati ufficiali e analisi aggiornate per costruire una fascia di valore realistica. La
                          stima non sostituisce una perizia, ma ti dà un riferimento affidabile per orientare le tue scelte.
                        </p>
                      )}
                    </div>
                    <span className="ml-2 text-base leading-none">
                      {openFaqIndex === 4 ? '↓' : '→'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === 5 ? -1 : 5)}
                  className="w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-slate-900">
                        Posso usare Valuta Facile anche se sto solo pensando di vendere?
                      </h3>
                      {openFaqIndex === 5 && (
                        <p className="mt-1.5 text-sm text-slate-700">
                          Certo. Molte persone usano la valutazione per farsi un&apos;idea del valore prima di prendere
                          qualsiasi decisione. Non ci sono vincoli né obblighi di mettere in vendita l&apos;immobile.
                        </p>
                      )}
                    </div>
                    <span className="ml-2 text-base leading-none">
                      {openFaqIndex === 5 ? '↓' : '→'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === 6 ? -1 : 6)}
                  className="w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-slate-900">
                        Come vengono utilizzati i miei dati?
                      </h3>
                      {openFaqIndex === 6 && (
                        <p className="mt-1.5 text-sm text-slate-700">
                          I dati che inserisci servono solo per calcolare la valutazione o rispondere alle tue
                          richieste di contatto/assistenza. Non vendiamo i tuoi dati a terzi e non li usiamo
                          per campagne massicce di marketing.
                        </p>
                      )}
                    </div>
                    <span className="ml-2 text-base leading-none">
                      {openFaqIndex === 6 ? '↓' : '→'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === 7 ? -1 : 7)}
                  className="w-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[4px_4px_0_rgba(15,23,42,1)] text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-slate-900">
                        Posso chiedere la cancellazione dei miei dati?
                      </h3>
                      {openFaqIndex === 7 && (
                        <p className="mt-1.5 text-sm text-slate-700">
                          Sì. In qualsiasi momento puoi scriverci dal Centro assistenza per chiedere la
                          cancellazione o l&apos;aggiornamento dei tuoi dati. Ti daremo riscontro nel minor
                          tempo possibile, nel rispetto della normativa privacy.
                        </p>
                      )}
                    </div>
                    <span className="ml-2 text-base leading-none">
                      {openFaqIndex === 7 ? '↓' : '→'}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {currentPage === 'pre' && (
        <div className="border-t-2 border-slate-900 bg-white hero-sky">
          <section className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 lg:px-16 py-24 lg:py-32">
            <div className="w-full max-w-4xl mx-auto">
              <div className="rounded-3xl border-2 border-slate-900 bg-white px-6 sm:px-10 py-10 sm:py-12 shadow-[10px_10px_0_rgba(15,23,42,1)] flex flex-col items-center text-center">
                <div className="flex flex-col items-center">
                  <img
                    src="/assets/Risorsa 2.png"
                    alt="Valuta Facile"
                    className="h-9 w-auto object-contain mb-4"
                  />
                  <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-indigo-700">
                    STIAMO PREPARANDO LA NUOVA ESPERIENZA
                  </p>
                </div>
                <p className="mt-5 text-sm sm:text-base text-slate-800 max-w-2xl">
                  Stiamo lavorando a una versione ancora più chiara del percorso di valutazione.
                  Esplora come stimiamo il valore del tuo immobile e preparati alla nuova esperienza Valuta Facile.
                </p>
                <div className="mt-6 w-full max-w-3xl">
                  <div className="overflow-hidden">
                    <div
                      className="flex items-center gap-16 whitespace-nowrap px-6 sm:px-8 py-4 text-xs sm:text-sm md:text-base text-gray-900"
                      style={{
                        animation: 'marquee 24s linear infinite',
                        fontFamily:
                          "'Unbounded', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                      }}
                    >
                      {Array.from({ length: 4 }).map((_, repeatIndex) => (
                        <div
                          key={`kf-block-${repeatIndex}`}
                          className="flex items-center gap-16"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">🏳️</span>
                            <span>Valutazione gratuita e senza impegno</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">🏳️</span>
                            <span>Prezzo minimo · medio · massimo spiegati in chiaro</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">🏳️</span>
                            <span>Dati OMI reali e contesto di zona</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">🏳️</span>
                            <span>Nessuna chiamata obbligatoria con agenzie</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-8 sm:mt-9">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage('test_home')
                      setWizardStep('landing_address')
                      if (typeof window !== 'undefined') {
                        try {
                          window.history.pushState({}, '', '/home')
                        } catch (e) {
                          console.error('Errore aggiornamento URL /home:', e)
                        }
                        window.scrollTo(0, 0)
                      }
                    }}
                    className="inline-flex items-center justify-center rounded-full bg-indigo-900 px-10 sm:px-12 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-[0_6px_0_rgba(15,23,42,1)] hover:translate-y-[1px] hover:shadow-[0_4px_0_rgba(15,23,42,1)] transition-transform"
                  >
                    INIZIA LA TUA VALUTAZIONE
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {(currentPage === 'address' ||
        currentPage === 'property' ||
        currentPage === 'valuation') && (
        <ValuationWizardPage
          currentPage={currentPage}
          wizardStep={wizardStep}
          loading={loading}
          error={error}
          draftAddress={draftAddress}
          setDraftAddress={setDraftAddress}
          selectedAddress={selectedAddress}
          omiData={omiData}
          wizardData={wizardData}
          setWizardData={setWizardData}
          propertyDraft={propertyDraft}
          setPropertyDraft={setPropertyDraft}
          valuationResult={valuationResult}
          contactData={contactData}
          isValuationUnlocked={isValuationUnlocked}
          adMode={adMode}
          valuationId={valuationId}
          setCurrentPage={setCurrentPage}
          setWizardStep={setWizardStep}
          setIsLeadModalOpen={setIsLeadModalOpen}
          onReportUnlocked={() => {
            setCurrentPage('profilo')
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, '', '/profilo')
            }
          }}
          savedLeadId={savedLeadId}
          onOpenContactForm={handleOpenContactForm}
          handlePrimaryCtaClick={handlePrimaryCtaClick}
          handleAddressSelect={handleAddressSelect}
          handlePropertySubmit={handlePropertySubmit}
          goBack={goBack}
          trackWizardEvent={trackWizardEvent}
          restart={restart}
        />
      )}

      {currentPage !== 'address' &&
        currentPage !== 'property' &&
        currentPage !== 'valuation' && (
        <main>
          {currentPage === 'privacy' && (
            <section className="py-10 sm:py-12 lg:py-16">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                      Privacy policy e registro dei trattamenti
                    </h1>
                    <p className="mt-1 text-sm text-gray-600">
                      Informativa completa sul trattamento dei dati personali e riepilogo dei trattamenti ai sensi
                      del GDPR.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={goToValuationPage}
                    className="hidden sm:inline-flex items-center rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Torna alla valutazione
                  </button>
                </div>

                <div className="space-y-10">
                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100 flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          Informativa sul trattamento dei dati personali
                        </h2>
                        <p className="mt-1 text-xs sm:text-sm text-gray-600">
                          Ai sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 (&quot;GDPR&quot;) e del
                          Codice Privacy.
                        </p>
                      </div>
                    </div>
                    <div className="px-5 sm:px-6 py-4 text-sm text-gray-800 space-y-3">
                      <p>
                        La presente informativa descrive le modalità di trattamento dei dati personali degli utenti
                        che utilizzano il servizio di valutazione immobiliare online, ai sensi del Regolamento (UE)
                        2016/679 (&quot;GDPR&quot;) e del D.lgs. 196/2003 come modificato dal D.lgs. 101/2018.
                      </p>
                      <p className="font-semibold">
                        1. Titolare del trattamento
                      </p>
                      <p>
                        Il titolare del trattamento è Valuta Facile, che determina finalità e mezzi del trattamento
                        dei dati personali raccolti tramite il servizio di valutazione immobiliare online. Il Titolare
                        può essere contattato per questioni privacy all&apos;indirizzo e-mail info@valutafacile.it e
                        agli ulteriori recapiti indicati nella documentazione ufficiale.
                      </p>
                      <p className="font-semibold">
                        2. Eventuale Responsabile della Protezione dei Dati (RPD/DPO)
                      </p>
                      <p>
                        Alla data di aggiornamento dell&apos;informativa, il Titolare non ha nominato un Responsabile
                        della Protezione dei Dati (RPD/DPO), non rientrando nei casi di obbligo previsti dall&apos;art.
                        37 GDPR.
                      </p>
                      <p className="font-semibold">
                        3. Tipologie di dati trattati
                      </p>
                      <p>
                        Tramite il servizio vengono raccolti: dati anagrafici e di contatto (nome, cognome, email,
                        telefono); dati relativi all&apos;immobile (indirizzo, CAP, comune, provincia, regione,
                        superficie, numero di locali e bagni, piano, stato dell&apos;immobile, anno di costruzione,
                        presenza di ascensore, spazi esterni e pertinenze); dati forniti nel percorso guidato di
                        qualificazione (profilo utente, rapporto con l&apos;immobile, tempistiche di vendita,
                        preferenza per valutazioni da agenzie di zona, eventuale consenso marketing); dati contenuti in
                        planimetrie e fotografie caricate; dati tecnici di utilizzo del servizio e della dashboard
                        staff (log di accesso, timestamp, filtri di ricerca).
                      </p>
                      <p className="font-semibold">
                        4. Finalità del trattamento e basi giuridiche
                      </p>
                      <p>
                        I dati sono trattati per: a) fornire la valutazione immobiliare richiesta dall&apos;utente,
                        anche tramite algoritmi e sistemi di intelligenza artificiale, sulla base dell&apos;esecuzione
                        di misure precontrattuali adottate su richiesta dell&apos;interessato (art. 6, par. 1, lett. b
                        GDPR); b) gestire le richieste di contatto e di consulenza personalizzata, organizzare i lead
                        in un database interno e ricontattare l&apos;utente, sempre sulla base dell&apos;art. 6, par. 1,
                        lett. b e del legittimo interesse del titolare a gestire efficacemente tali richieste (art. 6,
                        par. 1, lett. f); c) effettuare analisi interne e migliorare il servizio tramite dashboard e
                        strumenti di raggruppamento per area geografica, con legittimo interesse del titolare allo
                        sviluppo del servizio (art. 6, par. 1, lett. f); d) svolgere attività di marketing diretto o
                        mettere in contatto l&apos;utente con agenzie immobiliari di zona solo in presenza di consenso
                        esplicito, libero e specifico (art. 6, par. 1, lett. a e art. 130 Codice Privacy); e) adempiere
                        ad obblighi di legge, contabili e fiscali (art. 6, par. 1, lett. c); f) garantire la sicurezza
                        dei sistemi, prevenire abusi e difendere i diritti del titolare in giudizio (art. 6, par. 1,
                        lett. f).
                      </p>
                      <p className="font-semibold">
                        5. Modalità del trattamento
                      </p>
                      <p>
                        Il trattamento avviene prevalentemente con strumenti elettronici (applicazione web, server,
                        database, sistemi di storage file) nel rispetto dei principi di liceità, correttezza,
                        trasparenza, minimizzazione dei dati, limitazione della conservazione, integrità e
                        riservatezza. I sistemi sono ospitati su infrastruttura VPS fornita da Hostinger
                        (hostinger.com) o da altri fornitori equivalenti scelti dal Titolare. Accedono ai dati solo
                        soggetti autorizzati e istruiti dal Titolare o fornitori terzi nominati responsabili del
                        trattamento ai sensi dell&apos;art. 28 GDPR.
                      </p>
                      <p className="font-semibold">
                        6. Natura del conferimento dei dati
                      </p>
                      <p>
                        Il conferimento dei dati indicati come obbligatori (es. dati di base sull&apos;immobile, CAP,
                        talvolta dati di contatto) è necessario per ottenere la valutazione e per consentire al
                        titolare di dare seguito alle richieste. Il mancato conferimento comporta l&apos;impossibilità di
                        fornire il servizio o di ricontattare l&apos;utente. Il conferimento di dati aggiuntivi (es.
                        planimetrie, foto, informazioni facoltative) è opzionale ma può migliorare la qualità della
                        valutazione. Il consenso per finalità di marketing e condivisione con agenzie di zona è
                        facoltativo e la sua mancata prestazione non impedisce l&apos;uso della valutazione base.
                      </p>
                      <p className="font-semibold">
                        7. Tempi di conservazione dei dati
                      </p>
                      <p>
                        I dati di contatto e di valutazione sono conservati per un periodo limitato e proporzionato
                        alle finalità perseguite, di norma per un massimo di 12-24 mesi dall&apos;ultima interazione
                        significativa, salvo diversi obblighi di legge. I dati tecnici di log e di sicurezza sono
                        conservati per periodi più brevi (ad esempio 6-12 mesi), salvo necessità di ulteriore
                        conservazione in caso di incidenti di sicurezza o contenziosi. Decorso il periodo di
                        conservazione, i dati sono cancellati, anonimizzati o resi non riconducibili all&apos;interessato.
                      </p>
                      <p className="font-semibold">
                        8. Ambito di comunicazione dei dati
                      </p>
                      <p>
                        I dati possono essere comunicati a personale interno del titolare debitamente autorizzato, a
                        fornitori di servizi IT e di hosting, a consulenti e professionisti (ad esempio legali e
                        commercialisti) e, in presenza di specifico consenso, ad agenzie immobiliari partner per
                        l&apos;invio di valutazioni personalizzate o offerte di servizio. I dati possono inoltre essere
                        comunicati ad autorità pubbliche e organismi di vigilanza in adempimento ad obblighi di legge o
                        ordini delle autorità. In particolare, a seconda delle funzionalità utilizzate dall&apos;utente,
                        possono essere coinvolti i seguenti fornitori terzi, che trattano i dati in qualità di
                        responsabili del trattamento o titolari autonomi secondo i rispettivi ruoli: Stripe (per la
                        gestione dei pagamenti online, quando l&apos;utente acquista un report); Geoapify e, in via
                        residuale, Nominatim/OpenStreetMap (per la ricerca e geolocalizzazione degli indirizzi
                        inseriti); Listmonk (per l&apos;invio di email transazionali, ad esempio la consegna del
                        report); Groq AI (per l&apos;elaborazione tramite intelligenza artificiale di alcuni contenuti
                        della valutazione).
                      </p>
                      <p className="font-semibold">
                        9. Trasferimenti di dati verso Paesi terzi
                      </p>
                      <p>
                        L&apos;utilizzo di alcuni fornitori indicati al punto precedente (in particolare Groq AI e,
                        limitatamente ad alcune richieste, i servizi di geocoding Geoapify e Nominatim/OpenStreetMap)
                        può comportare il trasferimento di alcuni dati tecnici o di contenuto verso Paesi non
                        appartenenti allo Spazio Economico Europeo. In tali casi il titolare verifica l&apos;esistenza di
                        una decisione di adeguatezza della Commissione Europea oppure adotta garanzie adeguate come le
                        clausole contrattuali tipo (Standard Contractual Clauses) o altri strumenti previsti dagli
                        artt. 44 e ss. GDPR.
                      </p>
                      <p className="font-semibold">
                        10. Diritti dell&apos;interessato
                      </p>
                      <p>
                        L&apos;interessato può esercitare in qualsiasi momento i diritti previsti dagli artt. 15-22
                        GDPR: diritto di accesso, rettifica, cancellazione, limitazione del trattamento, portabilità
                        dei dati, opposizione per motivi connessi alla propria situazione particolare e revoca del
                        consenso prestato, senza pregiudicare la liceità del trattamento basata sul consenso prima
                        della revoca. In caso di marketing diretto, l&apos;opposizione può essere esercitata in ogni
                        momento e senza motivazione.
                      </p>
                      <p className="font-semibold">
                        11. Modalità di esercizio dei diritti e reclami
                      </p>
                      <p>
                        Per esercitare i propri diritti l&apos;interessato può rivolgersi ai recapiti del titolare
                        indicati nella documentazione ufficiale o nella sezione contatti del sito. L&apos;interessato ha
                        inoltre il diritto di proporre reclamo all&apos;Autorità di controllo competente, in Italia il
                        Garante per la Protezione dei Dati Personali, qualora ritenga che il trattamento violi la
                        normativa applicabile.
                      </p>
                      <p className="font-semibold">
                        12. Processi decisionali automatizzati e profilazione
                      </p>
                      <p>
                        Il servizio utilizza algoritmi automatizzati, inclusi modelli di intelligenza artificiale, per
                        stimare il valore dell&apos;immobile e generare analisi. Tali processi non determinano decisioni
                        con effetti giuridici o simili in modo esclusivamente automatizzato ai sensi dell&apos;art. 22
                        GDPR. La valutazione prodotta ha natura indicativa e l&apos;utente è invitato a considerarla come
                        supporto, eventualmente integrato da una consulenza professionale.
                      </p>
                      <p className="font-semibold">
                        13. Sicurezza dei dati
                      </p>
                      <p>
                        Il titolare adotta misure tecniche ed organizzative adeguate per proteggere i dati personali da
                        perdita, uso improprio, accesso non autorizzato, divulgazione o modifica non autorizzata. Tra
                        queste rientrano il controllo degli accessi all&apos;area riservata staff, sistemi di
                        autenticazione e gestione dei token, limitazioni dei permessi, protocolli sicuri di
                        comunicazione, logging e monitoraggio degli accessi rilevanti.
                      </p>
                      <p className="font-semibold">
                        14. Aggiornamenti della presente informativa
                      </p>
                      <p>
                        La presente privacy policy può essere aggiornata o modificata per adeguarsi a cambiamenti
                        normativi o evoluzioni del servizio. Le modifiche sostanziali saranno rese disponibili
                        all&apos;interno dell&apos;applicazione o tramite gli altri canali di comunicazione del titolare. Si
                        invita l&apos;utente a consultare periodicamente questa sezione.
                      </p>
                      <p className="text-xs text-gray-500">
                        Questa versione della privacy policy è messa a disposizione in forma elettronica
                        all&apos;interno dell&apos;applicazione ed è da intendersi come informativa generale ai sensi degli
                        artt. 13 e 14 GDPR.
                      </p>
                    </div>
                  </section>

                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Registro dei trattamenti
                      </h2>
                      <p className="mt-1 text-xs sm:text-sm text-gray-600">
                        Vista sintetica e struttura del registro formale dei trattamenti relativi al valutatore
                        immobiliare, ai sensi dell&apos;art. 30 GDPR.
                      </p>
                    </div>
                    <div className="px-5 sm:px-6 py-4 space-y-6 text-xs sm:text-sm text-gray-800">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          Registro sintetico (vista interna)
                        </h3>
                        <p className="mt-1 text-xs text-gray-600">
                          Tabella riepilogativa delle principali attività di trattamento gestite tramite il
                          valutatore immobiliare, utile come supporto operativo al registro formale ai sensi
                          dell&apos;art. 30 GDPR.
                        </p>
                        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                          <table className="min-w-full text-[11px] sm:text-xs text-left text-gray-700">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 font-semibold">Finalità</th>
                                <th className="px-3 py-2 font-semibold">Categorie dati</th>
                                <th className="px-3 py-2 font-semibold">Interessati</th>
                                <th className="px-3 py-2 font-semibold">Base giuridica</th>
                                <th className="px-3 py-2 font-semibold">Conservazione indicativa</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-t border-gray-100 align-top">
                                <td className="px-3 py-2">
                                  Valutazione immobiliare online
                                </td>
                                <td className="px-3 py-2">
                                  Dati immobile, indirizzo, CAP, dati tecnici di valutazione, eventuali file caricati
                                  (planimetrie/foto)
                                </td>
                                <td className="px-3 py-2">
                                  Utenti che richiedono la valutazione
                                </td>
                                <td className="px-3 py-2">
                                  Art. 6.1.b GDPR (misure precontrattuali); art. 6.1.f GDPR (legittimo interesse
                                  miglioramento servizio)
                                </td>
                                <td className="px-3 py-2">
                                  Circa 12–24 mesi dalla valutazione, salvo ulteriori obblighi di legge
                                </td>
                              </tr>
                              <tr className="border-t border-gray-100 align-top">
                                <td className="px-3 py-2">
                                  Gestione contatti e lead
                                </td>
                                <td className="px-3 py-2">
                                  Nome, cognome, email, telefono, dati immobile, preferenze raccolte nel wizard
                                </td>
                                <td className="px-3 py-2">
                                  Utenti che chiedono di essere ricontattati
                                </td>
                                <td className="px-3 py-2">
                                  Art. 6.1.b GDPR; art. 6.1.f GDPR (organizzazione commerciale dei contatti)
                                </td>
                                <td className="px-3 py-2">
                                  Circa 12–24 mesi dall&apos;ultima interazione significativa
                                </td>
                              </tr>
                              <tr className="border-t border-gray-100 align-top">
                                <td className="px-3 py-2">
                                  Analisi interne e dashboard staff
                                </td>
                                <td className="px-3 py-2">
                                  Dati di valutazione aggregati, CAP/comune, indicatori statistici interni
                                </td>
                                <td className="px-3 py-2">
                                  Utenti del servizio (in forma prevalentemente aggregata)
                                </td>
                                <td className="px-3 py-2">
                                  Art. 6.1.f GDPR (legittimo interesse allo sviluppo e controllo del servizio)
                                </td>
                                <td className="px-3 py-2">
                                  Allineata alla conservazione dei lead, con preferenza per aggregazione/pseudonimizzazione
                                </td>
                              </tr>
                              <tr className="border-t border-gray-100 align-top">
                                <td className="px-3 py-2">
                                  Marketing diretto e agenzie di zona
                                </td>
                                <td className="px-3 py-2">
                                  Dati contatto, dati immobile rilevanti per proposte commerciali
                                </td>
                                <td className="px-3 py-2">
                                  Utenti che hanno espresso consenso specifico
                                </td>
                                <td className="px-3 py-2">
                                  Art. 6.1.a GDPR (consenso); art. 130 Codice Privacy per comunicazioni elettroniche
                                </td>
                                <td className="px-3 py-2">
                                  Fino a revoca del consenso e comunque non oltre 24 mesi per il marketing
                                </td>
                              </tr>
                              <tr className="border-t border-gray-100 align-top">
                                <td className="px-3 py-2">
                                  Sicurezza, log tecnici e adempimenti legali
                                </td>
                                <td className="px-3 py-2">
                                  Log accessi area admin, dati tecnici di utilizzo, eventuali riferimenti a eventi di
                                  sicurezza
                                </td>
                                <td className="px-3 py-2">
                                  Utenti admin e, in casi limitati, utenti finali coinvolti in eventi di sicurezza
                                </td>
                                <td className="px-3 py-2">
                                  Art. 6.1.f GDPR (legittimo interesse alla sicurezza); art. 6.1.c GDPR (obblighi di
                                  legge)
                                </td>
                                <td className="px-3 py-2">
                                  Circa 6–12 mesi per i log tecnici, salvo necessità di ulteriore conservazione in
                                  caso di contenziosi
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p className="mt-3 text-[11px] text-gray-500">
                          Questa tabella ha valore di supporto operativo interno e non sostituisce il registro
                          formale dei trattamenti ai sensi dell&apos;art. 30 GDPR. Le informazioni qui riportate
                          devono essere allineate con la documentazione privacy ufficiale del titolare.
                        </p>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          Registro formale dei trattamenti (struttura)
                        </h3>
                        <p className="mt-1 text-xs text-gray-600">
                          Struttura di dettaglio del registro formale dei trattamenti. I dati specifici sul titolare,
                          sui fornitori e sui trasferimenti sono da mantenere coerenti con il registro ufficiale
                          interno (es. PDF).
                        </p>
                        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                          <table className="min-w-full text-[11px] sm:text-xs text-left text-gray-700">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 font-semibold">Trattamento</th>
                                <th className="px-3 py-2 font-semibold">Finalità</th>
                                <th className="px-3 py-2 font-semibold">Interessati</th>
                                <th className="px-3 py-2 font-semibold">Categorie di dati</th>
                                <th className="px-3 py-2 font-semibold">Destinatari / Fornitori</th>
                                <th className="px-3 py-2 font-semibold">Trasferimenti extra-UE</th>
                                <th className="px-3 py-2 font-semibold">Conservazione</th>
                                <th className="px-3 py-2 font-semibold">Misure di sicurezza principali</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-t border-gray-100 align-top">
                                <td className="px-3 py-2">
                                  Valutazione immobiliare online
                                </td>
                                <td className="px-3 py-2">
                                  Fornire una stima del valore dell&apos;immobile richiesta dall&apos;utente.
                                </td>
                                <td className="px-3 py-2">
                                  Utenti che utilizzano il servizio di valutazione.
                                </td>
                                <td className="px-3 py-2">
                                  Dati immobile, indirizzo, CAP, dati tecnici di valutazione, file planimetrie/foto.
                                </td>
                                <td className="px-3 py-2">
                                  Fornitori IT e hosting; Geoapify e Nominatim/OpenStreetMap (geocoding indirizzi);
                                  Groq AI (elaborazione AI dei contenuti della valutazione).
                                </td>
                                <td className="px-3 py-2">
                                  Verso Groq AI e, in parte, verso Geoapify/Nominatim; soggetti alle garanzie
                                  contrattuali previste (es. SCC, decisioni di adeguatezza).
                                </td>
                                <td className="px-3 py-2">
                                  12–24 mesi dalla valutazione, salvo diversi obblighi di legge.
                                </td>
                                <td className="px-3 py-2">
                                  Accesso controllato all&apos;area admin, autenticazione, uso di protocolli sicuri,
                                  limitazione permessi e logging.
                                </td>
                              </tr>
                              <tr className="border-t border-gray-100 align-top">
                                <td className="px-3 py-2">
                                  Gestione contatti e lead
                                </td>
                                <td className="px-3 py-2">
                                  Gestire le richieste di contatto e follow-up commerciale.
                                </td>
                                <td className="px-3 py-2">
                                  Utenti che chiedono di essere ricontattati.
                                </td>
                                <td className="px-3 py-2">
                                  Nome, cognome, email, telefono, dati immobile, informazioni wizard e note interne.
                                </td>
                                <td className="px-3 py-2">
                                  Listmonk (invio email transazionali), Stripe (pagamenti, se il lead acquista un
                                  report), fornitori IT e hosting incaricati dal titolare.
                                </td>
                                <td className="px-3 py-2">
                                  Possibile verso Stripe (garanzie contrattuali del fornitore); da dettagliare nel
                                  registro ufficiale e nei contratti per gli altri fornitori.
                                </td>
                                <td className="px-3 py-2">
                                  12–24 mesi dall&apos;ultima interazione significativa con l&apos;utente.
                                </td>
                                <td className="px-3 py-2">
                                  Autenticazione area admin, policy interne su accessi e cancellazioni, backup controllati.
                                </td>
                              </tr>
                              <tr className="border-t border-gray-100 align-top">
                                <td className="px-3 py-2">
                                  Analisi interne e dashboard staff
                                </td>
                                <td className="px-3 py-2">
                                  Elaborare statistiche aggregate e controllare l&apos;andamento del servizio.
                                </td>
                                <td className="px-3 py-2">
                                  Utenti del servizio, in forma prevalentemente aggregata.
                                </td>
                                <td className="px-3 py-2">
                                  Dati di valutazione aggregati, CAP/comune, indicatori statistici.
                                </td>
                                <td className="px-3 py-2">
                                  Fornitori di analytics/BI eventualmente utilizzati dal titolare.
                                </td>
                                <td className="px-3 py-2">
                                  In base alla localizzazione dei fornitori; da indicare nel registro formale.
                                </td>
                                <td className="px-3 py-2">
                                  Allineata ai tempi dei lead, privilegiando anonimizzazione/pseudonimizzazione dove possibile.
                                </td>
                                <td className="px-3 py-2">
                                  Controlli di accesso, separazione tra dati identificativi e dati aggregati, logging.
                                </td>
                              </tr>
                              <tr className="border-t border-gray-100 align-top">
                                <td className="px-3 py-2">
                                  Marketing diretto e agenzie di zona
                                </td>
                                <td className="px-3 py-2">
                                  Invio comunicazioni commerciali e condivisione lead con agenzie partner.
                                </td>
                                <td className="px-3 py-2">
                                  Utenti che hanno espresso consenso specifico al marketing e alle agenzie.
                                </td>
                                <td className="px-3 py-2">
                                  Dati di contatto, dati immobile rilevanti per proposte commerciali.
                                </td>
                                <td className="px-3 py-2">
                                  Agenzie immobiliari partner, fornitori strumenti email marketing, fornitori IT.
                                </td>
                                <td className="px-3 py-2">
                                  Dipende dai fornitori marketing; da indicare nel registro ufficiale e nei contratti.
                                </td>
                                <td className="px-3 py-2">
                                  Fino a revoca del consenso e comunque non oltre 24 mesi per finalità marketing.
                                </td>
                                <td className="px-3 py-2">
                                  Gestione opt-out, controllo consensi, uso sicuro degli strumenti di invio campagne.
                                </td>
                              </tr>
                              <tr className="border-t border-gray-100 align-top">
                                <td className="px-3 py-2">
                                  Sicurezza, log tecnici e adempimenti legali
                                </td>
                                <td className="px-3 py-2">
                                  Garantire sicurezza dei sistemi, prevenire abusi e adempiere ad obblighi legali.
                                </td>
                                <td className="px-3 py-2">
                                  Utenti admin e, in casi limitati, utenti finali coinvolti in eventi di sicurezza.
                                </td>
                                <td className="px-3 py-2">
                                  Log accessi area admin, log tecnici di errore, dati legati a eventi di sicurezza.
                                </td>
                                <td className="px-3 py-2">
                                  Fornitori di logging/monitoring, consulenti legali/fiscali se coinvolti in contenziosi.
                                </td>
                                <td className="px-3 py-2">
                                  Possibili verso fornitori di logging/monitoring; da descrivere nel registro ufficiale.
                                </td>
                                <td className="px-3 py-2">
                                  6–12 mesi per i log tecnici, salvo ulteriore conservazione per contenziosi o indagini.
                                </td>
                                <td className="px-3 py-2">
                                  Sistemi di autenticazione, gestione delle credenziali, monitoraggio accessi e procedure
                                  di risposta agli incidenti.
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="mt-6 sm:hidden">
                  <button
                    type="button"
                    onClick={goToValuationPage}
                    className="inline-flex w-full items-center justify-center rounded-full border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Torna alla valutazione
                  </button>
                </div>
              </div>
            </section>
          )}

          {currentPage === 'terms' && (
            <section className="py-10 sm:py-12 lg:py-16">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                      Termini di utilizzo del servizio
                    </h1>
                    <p className="mt-1 text-sm text-gray-600">
                      Condizioni d&apos;uso della piattaforma di valutazione immobiliare Valuta Facile.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={goToValuationPage}
                    className="hidden sm:inline-flex items-center rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Torna alla valutazione
                  </button>
                </div>

                <div className="space-y-10">
                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900">
                        1. Oggetto del servizio e natura delle valutazioni
                      </h2>
                    </div>
                    <div className="px-5 sm:px-6 py-4 text-sm text-gray-800 space-y-3">
                      <p>
                        Valuta Facile mette a disposizione degli utenti una piattaforma online che consente di ottenere
                        una stima indicativa del valore di un immobile residenziale, basata su dati di mercato,
                        informazioni di zona (inclusi, ove disponibili, dati OMI) e modelli di analisi automatizzata.
                      </p>
                      <p>
                        La valutazione generata dal sistema ha natura meramente orientativa e non costituisce in alcun
                        caso perizia giurata, stima redatta da professionista iscritto ad albi, consulenza finanziaria o
                        offerta al pubblico ai sensi dell&apos;art. 1336 c.c. né impegno contrattuale di acquisto o
                        vendita da parte di Valuta Facile o di eventuali partner.
                      </p>
                      <p>
                        L&apos;utente è tenuto a considerare la valutazione come uno strumento informativo di supporto:
                        per decisioni di compravendita, locazione, finanziamento o altra operazione economica è sempre
                        raccomandabile il confronto con professionisti qualificati (es. agenti immobiliari, periti,
                        consulenti legali o fiscali).
                      </p>
                    </div>
                  </section>

                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900">
                        2. Condizioni d&apos;uso e responsabilità dell&apos;utente
                      </h2>
                    </div>
                    <div className="px-5 sm:px-6 py-4 text-sm text-gray-800 space-y-3">
                      <p>
                        L&apos;accesso e l&apos;utilizzo del servizio presuppongono la maggiore età dell&apos;utente e
                        l&apos;accettazione integrale dei presenti Termini di utilizzo. L&apos;utente si impegna a
                        fornire dati veritieri, corretti e aggiornati sull&apos;immobile e sui propri recapiti, evitando
                        l&apos;inserimento di informazioni di terzi senza averne titolo.
                      </p>
                      <p>
                        È espressamente vietato utilizzare la piattaforma per finalità illecite o contrarie alla
                        normativa vigente, per attività automatizzate massive non autorizzate (ad esempio scraping
                        sistematico, utilizzo di bot o script di interrogazione continua) o per analizzare immobili di
                        soggetti terzi in assenza di un legittimo interesse o di idonea base giuridica.
                      </p>
                      <p>
                        L&apos;utente è responsabile del corretto utilizzo del servizio e delle decisioni assunte sulla
                        base delle informazioni ottenute tramite la piattaforma e si impegna a manlevare e tenere
                        indenne Valuta Facile da qualsiasi pretesa o richiesta di risarcimento avanzata da terzi in
                        conseguenza di un uso improprio o illecito del servizio.
                      </p>
                    </div>
                  </section>

                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900">
                        3. Proprietà intellettuale e uso dei contenuti
                      </h2>
                    </div>
                    <div className="px-5 sm:px-6 py-4 text-sm text-gray-800 space-y-3">
                      <p>
                        Il marchio &quot;Valuta Facile&quot;, il nome a dominio, la grafica, l&apos;interfaccia utente,
                        i testi, gli elementi multimediali, le logiche di funzionamento del valutatore, gli algoritmi e
                        in generale tutti i contenuti disponibili sulla piattaforma sono protetti dalle norme in materia
                        di diritto d&apos;autore, marchi e proprietà intellettuale.
                      </p>
                      <p>
                        Fatti salvi gli usi consentiti dalla legge, è vietata la riproduzione, anche parziale, la
                        distribuzione, la comunicazione al pubblico, la modifica, la decompilazione o l&apos;utilizzo
                        dei contenuti e dei risultati delle valutazioni per finalità diverse dall&apos;uso personale o
                        interno all&apos;organizzazione dell&apos;utente, senza il previo consenso scritto di Valuta
                        Facile.
                      </p>
                    </div>
                  </section>

                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900">
                        4. Limitazioni di responsabilità e modifiche del servizio
                      </h2>
                    </div>
                    <div className="px-5 sm:px-6 py-4 text-sm text-gray-800 space-y-3">
                      <p>
                        Valuta Facile adotta misure ragionevoli per mantenere il servizio disponibile e per garantire
                        l&apos;aggiornamento delle basi dati e dei modelli di calcolo, ma non può escludere
                        completamente la presenza di errori, approssimazioni, interruzioni o malfunzionamenti tecnici.
                      </p>
                      <p>
                        Nella misura massima consentita dalla legge applicabile, Valuta Facile non risponde, a
                        qualunque titolo, di danni indiretti, consequenziali, perdita di chance, mancati guadagni o
                        decisioni economiche assunte esclusivamente sulla base della valutazione automatica fornita
                        dalla piattaforma.
                      </p>
                      <p>
                        Valuta Facile si riserva la facoltà di modificare, sospendere o interrompere, anche
                        parzialmente, il servizio o le sue funzionalità, nonché di aggiornare in qualsiasi momento i
                        presenti Termini di utilizzo. Le modifiche sostanziali saranno rese disponibili tramite
                        aggiornamento di questa sezione e, ove opportuno, comunicate con avvisi dedicati all&apos;interno
                        dell&apos;applicazione.
                      </p>
                    </div>
                  </section>

                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900">
                        5. Legge applicabile e foro competente
                      </h2>
                    </div>
                    <div className="px-5 sm:px-6 py-4 text-sm text-gray-800 space-y-3">
                      <p>
                        I presenti Termini di utilizzo sono regolati dalla legge italiana, fatto salvo quanto previsto
                        dalle norme inderogabili a tutela dei consumatori applicabili in base al luogo di residenza
                        dell&apos;utente.
                      </p>
                      <p>
                        Qualsiasi controversia relativa all&apos;interpretazione, esecuzione o validità dei presenti
                        Termini, in assenza di un accordo bonario o di specifiche previsioni inderogabili sulla
                        competenza territoriale a favore del consumatore, è devoluta in via esclusiva al Foro del luogo
                        in cui ha sede il Titolare del trattamento indicato nella privacy policy.
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </section>
          )}

          {currentPage === 'cookies' && (
            <section className="py-10 sm:py-12 lg:py-16">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                      Cookie &amp; consenso
                    </h1>
                    <p className="mt-1 text-sm text-gray-600">
                      Informazioni sull&apos;uso di cookie e tecnologie simili e sulla gestione del consenso.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={goToValuationPage}
                    className="hidden sm:inline-flex items-center rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Torna alla valutazione
                  </button>
                </div>

                <div className="space-y-10">
                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900">
                        1. Cosa sono i cookie e tecnologie simili
                      </h2>
                    </div>
                    <div className="px-5 sm:px-6 py-4 text-sm text-gray-800 space-y-3">
                      <p>
                        I cookie sono piccoli file di testo che i siti visitati inviano al dispositivo dell&apos;utente,
                        dove vengono memorizzati per essere poi ritrasmessi agli stessi siti alla visita successiva.
                        Sono utilizzati per diverse finalità, come l&apos;esecuzione di autenticazioni informatiche, il
                        monitoraggio di sessioni, la memorizzazione di informazioni su specifiche configurazioni
                        riguardanti gli utenti, nonché per profilare l&apos;utente e proporre contenuti personalizzati.
                      </p>
                      <p>
                        Oltre ai cookie possono essere utilizzate tecnologie similari (ad esempio local storage,
                        pixel, tag o script di tracciamento) che perseguono le medesime finalità. In questa sezione, per
                        semplicità, ci si riferisce a tali strumenti complessivamente come &quot;cookie&quot;.
                      </p>
                    </div>
                  </section>

                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900">
                        2. Tipologie di cookie utilizzati sul servizio
                      </h2>
                    </div>
                    <div className="px-5 sm:px-6 py-4 text-sm text-gray-800 space-y-3">
                      <p className="font-semibold">
                        Cookie tecnici (necessari)
                      </p>
                      <p>
                        Sono cookie necessari al corretto funzionamento della piattaforma e alla fornitura del servizio
                        richiesto dall&apos;utente (ad esempio per mantenere la sessione attiva, salvare alcune scelte
                        tecniche, garantire la sicurezza della navigazione). Per il loro utilizzo non è richiesto il
                        consenso dell&apos;utente.
                      </p>
                      <p className="font-semibold">
                        Cookie di analisi statistica
                      </p>
                      <p>
                        Possono essere utilizzati cookie o strumenti di analisi, anche di terze parti (ad esempio
                        servizi come Google Analytics o soluzioni equivalenti), per raccogliere in forma aggregata
                        informazioni statistiche sull&apos;utilizzo del servizio (ad esempio numero di accessi, pagine
                        visitate, tempo di permanenza). Nel caso in cui tali strumenti permettano di identificare
                        l&apos;utente, vengono attivati solo in presenza di idonea base giuridica (ad esempio
                        anonimizzazione dell&apos;indirizzo IP o raccolta del consenso).
                      </p>
                      <p className="font-semibold">
                        Cookie di profilazione e marketing
                      </p>
                      <p>
                        Sono cookie finalizzati a tracciare la navigazione dell&apos;utente in rete e creare profili
                        sui suoi interessi, allo scopo di inviare messaggi pubblicitari in linea con le preferenze
                        manifestate (incluse, ove presenti, tecnologie messe a disposizione dalle principali piattaforme
                        social e pubblicitarie, come i pixel di Meta, Google, LinkedIn, TikTok o servizi analoghi).
                        Questi cookie vengono utilizzati, se presenti, solo previo consenso libero, specifico e
                        revocabile in qualsiasi momento.
                      </p>
                    </div>
                  </section>

                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900">
                        3. Gestione del consenso e preferenze cookie
                      </h2>
                    </div>
                    <div className="px-5 sm:px-6 py-4 text-sm text-gray-800 space-y-3">
                      <p>
                        Al primo accesso alla piattaforma viene mostrato un banner che consente all&apos;utente di
                        accettare tutti i cookie, rifiutare quelli non tecnici oppure personalizzare la propria scelta
                        per singola categoria (cookie tecnici, sempre attivi; cookie di analisi statistica; cookie di
                        profilazione e marketing) tramite il pulsante &quot;Personalizza&quot;. Le preferenze espresse
                        vengono salvate sul dispositivo dell&apos;utente e possono essere modificate in qualsiasi
                        momento tramite la voce &quot;Impostazioni cookie&quot; presente nel footer dell&apos;applicazione,
                        che riapre il banner con le scelte già effettuate.
                      </p>
                      <p>
                        Il consenso eventualmente prestato costituisce base giuridica per l&apos;utilizzo dei cookie non
                        tecnici e delle tecnologie di tracciamento correlate. La revoca del consenso non pregiudica la
                        liceità dei trattamenti effettuati prima della revoca stessa, ma può influire sull&apos;esperienza
                        di utilizzo e sulle funzionalità disponibili.
                      </p>
                    </div>
                  </section>

                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900">
                        4. Cookie di terze parti
                      </h2>
                    </div>
                    <div className="px-5 sm:px-6 py-4 text-sm text-gray-800 space-y-3">
                      <p>
                        All&apos;interno della piattaforma possono essere presenti cookie e altre tecnologie di
                        tracciamento gestite da soggetti terzi (ad esempio fornitori di servizi di analisi come Google
                        Analytics, strumenti di advertising come Google Ads o pixel e plugin messi a disposizione dalle
                        principali piattaforme social quali, a titolo esemplificativo, Meta/Facebook, Instagram,
                        LinkedIn, TikTok). L&apos;utilizzo di tali strumenti è disciplinato dalle informative privacy e
                        cookie dei rispettivi terzi, alle quali si rinvia per ogni approfondimento.
                      </p>
                      <p>
                        Valuta Facile adotta misure per configurare tali strumenti, per quanto possibile, in modo da
                        ridurre il rischio di identificazione diretta dell&apos;utente e per attivarli solo in presenza di
                        una base giuridica adeguata (ad esempio consenso tramite il banner cookie).
                      </p>
                    </div>
                  </section>

                  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900">
                        5. Diritti dell&apos;utente e riferimenti normativi
                      </h2>
                    </div>
                    <div className="px-5 sm:px-6 py-4 text-sm text-gray-800 space-y-3">
                      <p>
                        In relazione ai trattamenti effettuati mediante l&apos;utilizzo di cookie e strumenti analoghi,
                        l&apos;utente può esercitare i diritti previsti dalla normativa in materia di protezione dei
                        dati personali, come descritti in dettaglio nella privacy policy (accesso, cancellazione,
                        limitazione, opposizione, revoca del consenso, ecc.).
                      </p>
                      <p>
                        Ulteriori informazioni sui trattamenti, sulle basi giuridiche e sui tempi di conservazione dei
                        dati sono disponibili nella sezione &quot;Privacy policy e registro dei trattamenti&quot; della
                        presente applicazione, che integra la presente informativa cookie. Il quadro normativo di
                        riferimento comprende, tra gli altri, il Regolamento (UE) 2016/679 (&quot;GDPR&quot;) e la
                        disciplina nazionale applicabile in materia di cookie e comunicazioni elettroniche.
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </section>
          )}

          {currentPage === 'blog' && (
            <section className="py-10 sm:py-12 lg:py-16">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between gap-4 mb-8">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold tracking-[0.22em] uppercase text-indigo-700">
                      Blog Valuta Facile
                    </p>
                    <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-gray-900">
                      Tutti gli articoli in un unico posto
                    </h1>
                    <p className="mt-2 text-sm text-gray-600 max-w-2xl">
                      Guide pratiche, scenari di mercato e consigli per capire meglio il valore del tuo immobile.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={goToHomePage}
                    className="hidden sm:inline-flex items-center rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Torna alla home
                  </button>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {blogCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setBlogCategoryFilter(category)}
                      className={[
                        'inline-flex items-center px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors',
                        blogCategoryFilter === category
                          ? 'border-slate-900 bg-slate-900 text-white shadow-[2px_2px_0_rgba(15,23,42,1)]'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-900 hover:text-white'
                      ].join(' ')}
                    >
                      {category === BLOG_DEFAULT_CATEGORY ? 'Tutti gli articoli' : category}
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredBlogArticles.map((article) => (
                    <article
                      key={article.id}
                      className="h-full rounded-2xl border-2 border-slate-900 bg-white px-5 py-5 flex flex-col justify-between shadow-[6px_6px_0_rgba(15,23,42,1)]"
                    >
                      <div>
                        <div className="inline-flex items-center rounded-full border border-slate-900 px-3 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-900 bg-slate-50">
                          {article.tag}
                        </div>
                        <h2 className="mt-3 text-sm sm:text-base md:text-lg font-semibold text-gray-900 leading-snug">
                          {article.title}
                        </h2>
                        <p className="mt-2 text-xs text-gray-600">
                          {article.level} · {article.readTime}
                        </p>
                      </div>
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => goToBlogArticle(article)}
                          className="inline-flex items-center text-xs font-semibold text-indigo-900 hover:text-indigo-950"
                        >
                          Leggi l&apos;articolo
                          <span className="ml-1 text-sm">→</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="mt-10 rounded-3xl border-2 border-slate-900 bg-indigo-50 px-5 py-5 sm:px-6 sm:py-6 shadow-[6px_6px_0_rgba(15,23,42,1)]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-indigo-900">
                        Vuoi una valutazione per il tuo immobile?
                      </p>
                      <p className="mt-1 text-xs sm:text-sm text-indigo-900/80">
                        Dal blog puoi passare in pochi secondi alla stima gratuita, senza obblighi e con dati aggiornati.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={goToValuationPage}
                      className="inline-flex items-center justify-center rounded-full bg-indigo-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-indigo-950"
                    >
                      Inizia la valutazione
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {currentPage === 'province-landing' && (
            <section className="py-10 sm:py-12 lg:py-16 bg-gradient-to-b from-white to-sky-50">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between gap-4 mb-8">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold tracking-[0.22em] uppercase text-indigo-700">
                      {currentProvinceName
                        ? `Valutazione casa a ${currentProvinceName}`
                        : 'Valutazione casa nella tua provincia'}
                    </p>
                    <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-gray-900">
                      {currentProvinceName
                        ? `Vuoi capire quanto vale la tua casa a ${currentProvinceName}?`
                        : 'Vuoi capire quanto vale la tua casa nella tua zona?'}
                    </h1>
                    <p className="mt-2 text-sm text-gray-600 max-w-2xl">
                      {currentProvinceName
                        ? `Questa pagina è pensata per chi ha un immobile a ${currentProvinceName} o in provincia e vuole una stima chiara, basata su dati aggiornati e spiegazioni semplici.`
                        : 'Questa pagina è pensata per chi ha un immobile nella propria provincia e vuole una stima chiara, basata su dati aggiornati e spiegazioni semplici.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={goToValuationPage}
                    className="hidden sm:inline-flex items-center rounded-full bg-indigo-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-indigo-950"
                  >
                    Inizia la valutazione
                  </button>
                </div>
                <div className="grid gap-8 lg:grid-cols-[1.25fr,0.9fr] items-start">
                  <div className="space-y-5 text-sm sm:text-base text-gray-800">
                    <p>
                    {currentProvinceName
                      ? `A ${currentProvinceName} il prezzo al metro quadro cambia molto da zona a zona: le vie centrali, i quartieri residenziali e le aree più periferiche seguono andamenti diversi. Per questo una stima seria non può basarsi solo su una media cittadina.`
                      : 'Il prezzo al metro quadro cambia molto da zona a zona: le vie centrali, i quartieri residenziali e le aree più periferiche seguono andamenti diversi. Per questo una stima seria non può basarsi solo su una media cittadina.'}
                    </p>
                    <p>
                      Con Valuta Facile ottieni in pochi minuti una stima del valore del tuo immobile
                      basata sui dati ufficiali OMI della tua zona, non su medie generiche. Inserisci
                      l'indirizzo e qualche dettaglio sull'immobile: il risultato è una fascia di prezzo
                      realistica, spiegata in modo chiaro, utile per decidere se vendere, affittare o
                      tenere l'immobile.
                    </p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>
                        {currentProvinceName
                          ? `Dati aggiornati sui prezzi al metro quadro a ${currentProvinceName}, zona per zona.`
                          : 'Dati aggiornati sui prezzi al metro quadro nella tua zona.'}
                      </li>
                      <li>Valori ufficiali dell'Osservatorio del Mercato Immobiliare (OMI), non stime a occhio.</li>
                      <li>Nessun obbligo di parlare con un'agenzia: decidi tu i passi successivi.</li>
                    </ul>
                    <p>
                      Se vuoi, dopo la valutazione puoi richiedere un confronto con professionisti che
                      conoscono il territorio, per leggere insieme il risultato e capire come muoverti.
                    </p>
                  </div>
                  <div className="rounded-3xl border-2 border-slate-900 bg-white px-5 py-5 sm:px-6 sm:py-6 shadow-[6px_6px_0_rgba(15,23,42,1)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
                      Come funziona
                    </p>
                    <ol className="mt-3 space-y-3 text-sm text-gray-800 list-decimal list-inside">
                    <li>
                      {currentProvinceName
                        ? `Inserisci l'indirizzo del tuo immobile a ${currentProvinceName} o provincia.`
                        : "Inserisci l'indirizzo del tuo immobile nella tua provincia."}
                    </li>
                      <li>Aggiungi pochi dettagli su metratura, stato e caratteristiche principali.</li>
                      <li>Ricevi subito una fascia di valore con spiegazioni chiare.</li>
                    </ol>
                    <button
                      type="button"
                      onClick={goToValuationPage}
                      className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-indigo-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-indigo-950"
                    >
                    {currentProvinceName
                      ? `Inizia dalla tua via a ${currentProvinceName}`
                      : 'Inizia dalla tua via'}
                    </button>
                    <p className="mt-2 text-[11px] text-gray-500">
                      Puoi usare la stima anche solo per orientarti: nessun impegno e nessun costo.
                    </p>
                  </div>
                </div>

                {provinceMarketDataLoading && (
                  <div className="mt-10 text-sm text-gray-500">
                    Carico i dati di mercato aggiornati{currentProvinceName ? ` per ${currentProvinceName}` : ''}...
                  </div>
                )}

                {!provinceMarketDataLoading && provinceMarketData && (
                  <div className="mt-10 rounded-3xl border-2 border-slate-900 bg-white px-5 py-6 sm:px-8 sm:py-8 shadow-[6px_6px_0_rgba(15,23,42,1)]">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                      <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                        {currentProvinceName
                          ? `Prezzi immobiliari a ${currentProvinceName}`
                          : 'Prezzi immobiliari nella zona'}
                      </h2>
                      {provinceMarketData.referencePeriod && (
                        <p className="text-xs text-gray-500">
                          Aggiornato a {provinceMarketData.referencePeriod}
                        </p>
                      )}
                    </div>

                    {provinceMarketData.pricePerSqm && (
                      <p className="mt-3 text-sm text-gray-700">
                        Il prezzo medio degli immobili {currentProvinceName ? `a ${currentProvinceName}` : 'in zona'}{' '}
                        è di <span className="font-semibold text-gray-900">{provinceMarketData.pricePerSqm.toLocaleString('it-IT')} €/m²</span>
                        {provinceMarketData.priceRange && (
                          <>
                            {' '}(fascia tipica tra {provinceMarketData.priceRange.min.toLocaleString('it-IT')} €
                            e {provinceMarketData.priceRange.max.toLocaleString('it-IT')} € al m²)
                          </>
                        )}.
                      </p>
                    )}

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {provinceMarketData.salePrices?.appartamenti && (
                        <div className="rounded-2xl border border-gray-200 px-4 py-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
                            Appartamenti in vendita
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-gray-900">
                            {provinceMarketData.salePrices.appartamenti.pricePerSqm?.toLocaleString('it-IT')} €/m²
                          </p>
                          <p className="mt-1 text-xs text-gray-600">
                            Prezzo mediano di vendita:{' '}
                            {provinceMarketData.salePrices.appartamenti.medianPrice?.toLocaleString('it-IT')} €
                          </p>
                          {typeof provinceMarketData.trend?.appartamenti?.oneYearPct === 'number' && (
                            <p className="mt-2 text-xs font-semibold text-emerald-700">
                              {provinceMarketData.trend.appartamenti.oneYearPct > 0 ? '+' : ''}
                              {provinceMarketData.trend.appartamenti.oneYearPct}% negli ultimi 12 mesi
                            </p>
                          )}
                        </div>
                      )}
                      {provinceMarketData.salePrices?.case && (
                        <div className="rounded-2xl border border-gray-200 px-4 py-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
                            Case in vendita
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-gray-900">
                            {provinceMarketData.salePrices.case.pricePerSqm?.toLocaleString('it-IT')} €/m²
                          </p>
                          <p className="mt-1 text-xs text-gray-600">
                            Prezzo mediano di vendita:{' '}
                            {provinceMarketData.salePrices.case.medianPrice?.toLocaleString('it-IT')} €
                          </p>
                          {typeof provinceMarketData.trend?.case?.oneYearPct === 'number' && (
                            <p className="mt-2 text-xs font-semibold text-emerald-700">
                              {provinceMarketData.trend.case.oneYearPct > 0 ? '+' : ''}
                              {provinceMarketData.trend.case.oneYearPct}% negli ultimi 12 mesi
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {(provinceMarketData.rentPrices?.appartamenti || provinceMarketData.rentPrices?.case) && (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {provinceMarketData.rentPrices?.appartamenti && (
                          <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                              Affitto appartamenti
                            </p>
                            <p className="mt-1 text-sm text-gray-800">
                              circa {provinceMarketData.rentPrices.appartamenti.medianRent?.toLocaleString('it-IT')} €/mese
                            </p>
                          </div>
                        )}
                        {provinceMarketData.rentPrices?.case && (
                          <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                              Affitto case
                            </p>
                            <p className="mt-1 text-sm text-gray-800">
                              circa {provinceMarketData.rentPrices.case.medianRent?.toLocaleString('it-IT')} €/mese
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {FEATURED_CITIES.filter((city) => city.slug !== currentProvinceSlug).length > 0 && (
                  <div className="mt-8 rounded-3xl border border-gray-200 bg-white px-5 py-5 sm:px-6 sm:py-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                      Valutazione casa in altre città
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {FEATURED_CITIES.filter((city) => city.slug !== currentProvinceSlug).map((city) => (
                        <a
                          key={city.slug}
                          href={`/valutazione-casa-${city.slug}`}
                          onClick={(event) => {
                            event.preventDefault()
                            setCurrentPage('province-landing')
                            setCurrentProvinceSlug(city.slug)
                            setCurrentBlogSlug(null)
                            setWizardStep('landing_address')
                            if (typeof window !== 'undefined') {
                              try {
                                window.history.pushState({}, '', `/valutazione-casa-${city.slug}`)
                              } catch (e) {
                                console.error('Errore aggiornamento URL valutazione-casa:', e)
                              }
                              window.scrollTo(0, 0)
                            }
                          }}
                          className="inline-flex items-center rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-slate-900 hover:text-slate-900"
                        >
                          {city.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {adMode === 'banner' && (
                  <div className="mt-10">
                    <AdBanner
                      slotEnvVar="VITE_ADSENSE_SLOT_PROVINCE"
                      placeholderLabel="Spazio pubblicitario"
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {currentPage === 'blog-detail' && currentBlogArticle && (
            <section className="py-10 sm:py-12 lg:py-16">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <nav aria-label="Percorso" className="mb-4 text-xs text-gray-500">
                  <button
                    type="button"
                    onClick={() => {
                      goToBlogPage()
                    }}
                    className="inline-flex items-center text-xs font-medium text-indigo-900 hover:text-indigo-950"
                  >
                    ← Torna al blog
                  </button>
                </nav>

                <article itemScope itemType="https://schema.org/Article">
                  <header>
                    <p className="text-xs sm:text-sm font-semibold tracking-[0.22em] uppercase text-indigo-700">
                      {currentBlogArticle.tag}
                    </p>
                    <h1
                      className="mt-3 text-2xl sm:text-3xl font-semibold text-gray-900 leading-tight"
                      itemProp="headline"
                    >
                      {currentBlogArticle.title}
                    </h1>
                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-600">
                      <span itemProp="author" itemScope itemType="https://schema.org/Organization">
                        <span itemProp="name">Valuta Facile</span>
                      </span>
                      <span aria-hidden="true">•</span>
                      <time itemProp="datePublished" dateTime={currentBlogArticle.publishedAt}>
                        {new Date(currentBlogArticle.publishedAt).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </time>
                      <span aria-hidden="true">•</span>
                      <span>{currentBlogArticle.readTime} di lettura</span>
                    </div>
                  </header>

                  <div className="mt-6 space-y-4 text-sm sm:text-base text-gray-800" itemProp="articleBody">
                    {currentBlogArticle.body.split('\n\n').map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>

                  {adMode === 'banner' && (
                    <div className="mt-8">
                      <AdBanner
                        slotEnvVar="VITE_ADSENSE_SLOT_BLOG_MID"
                        placeholderLabel="Spazio pubblicitario"
                      />
                    </div>
                  )}

                  {currentBlogArticle.keyPoints && currentBlogArticle.keyPoints.length > 0 && (
                    <div className="mt-8 border-t border-gray-200 pt-6">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                        In sintesi
                      </h2>
                      <ul className="mt-3 space-y-2 text-sm sm:text-base text-gray-800 list-disc list-inside">
                        {currentBlogArticle.keyPoints.map((point, index) => (
                          <li key={index}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {currentBlogArticle.faq && currentBlogArticle.faq.length > 0 && (
                    <div className="mt-8 border-t border-gray-200 pt-6">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                        Domande frequenti
                      </h2>
                      <div className="mt-3 space-y-4">
                        {currentBlogArticle.faq.map((item, index) => (
                          <div key={index}>
                            <p className="text-sm sm:text-base font-semibold text-gray-900">
                              {item.question}
                            </p>
                            <p className="mt-1 text-sm sm:text-base text-gray-700">
                              {item.answer}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>

                <div className="mt-10 rounded-3xl border-2 border-slate-900 bg-indigo-50 px-5 py-5 sm:px-6 sm:py-6 shadow-[6px_6px_0_rgba(15,23,42,1)]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-indigo-900">
                        Vuoi capire quanto vale il tuo immobile?
                      </p>
                      <p className="mt-1 text-xs sm:text-sm text-indigo-900/80">
                        Passa in pochi minuti dalla lettura dell&apos;articolo alla tua stima gratuita, senza
                        obblighi e con dati aggiornati.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={goToValuationPage}
                      className="inline-flex items-center justify-center rounded-full bg-indigo-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-indigo-950"
                    >
                      Inizia la valutazione
                    </button>
                  </div>
                </div>

                {adMode === 'banner' && (
                  <div className="mt-10">
                    <AdBanner
                      slotEnvVar="VITE_ADSENSE_SLOT_BLOG_END"
                      placeholderLabel="Spazio pubblicitario"
                    />
                  </div>
                )}

                {relatedBlogArticles.length > 0 && (
                  <div className="mt-10">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                      Articoli correlati
                    </h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {relatedBlogArticles.map((article) => (
                        <article
                          key={article.id}
                          className="rounded-2xl border-2 border-slate-900 bg-white px-4 py-4 flex flex-col justify-between shadow-[4px_4px_0_rgba(15,23,42,1)]"
                        >
                          <div>
                            <div className="inline-flex items-center rounded-full border border-slate-900 px-3 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-900 bg-slate-50">
                              {article.tag}
                            </div>
                            <h3 className="mt-3 text-sm font-semibold text-gray-900 leading-snug">
                              {article.title}
                            </h3>
                            <p className="mt-1 text-[11px] text-gray-600">
                              {article.level} · {article.readTime}
                            </p>
                          </div>
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => goToBlogArticle(article)}
                              className="inline-flex items-center text-xs font-semibold text-indigo-900 hover:text-indigo-950"
                            >
                              Leggi anche
                              <span className="ml-1 text-sm">→</span>
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                <script
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                      '@context': 'https://schema.org',
                      '@type': 'Article',
                      headline: currentBlogArticle.title,
                      description:
                        currentBlogArticle.seoDescription ||
                        'Articolo del blog di Valuta Facile sulla valutazione immobiliare.',
                      author: {
                        '@type': 'Organization',
                        name: 'Valuta Facile'
                      },
                      datePublished: currentBlogArticle.publishedAt,
                      dateModified: currentBlogArticle.updatedAt,
                      mainEntityOfPage: {
                        '@type': 'WebPage',
                        '@id': `https://valutafacile.it/blog/${currentBlogArticle.slug}`
                      }
                    })
                  }}
                />
              </div>
            </section>
          )}
        </main>
      )}

      <MainFooter
        onOpenPrivacy={goToPrivacyPage}
        onOpenContact={goToContactPage}
        onOpenHelp={goToHelpCenterPage}
        onOpenFaq={goToFaqPage}
        onOpenTerms={goToTermsPage}
        onOpenCookies={goToCookiesPage}
        onOpenCookieSettings={handleOpenCookieSettings}
      />

      <ContactFormPopup
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        onSubmit={handleContactSubmit}
        onOpenPrivacy={() => {
          setIsLeadModalOpen(false)
          goToPrivacyPage()
        }}
      />

      {isAuthModalOpen && (
        <AuthModal
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={() => setIsAuthModalOpen(false)}
        />
      )}

      {isReportModalOpen && (
        <ReportUnlockModal
          onClose={() => setIsReportModalOpen(false)}
          leadId={savedLeadId}
          valuationId={valuationId}
        />
      )}

      {isAdGateOpen && (
        <ValuationAdGateModal
          mode={adMode}
          onUnlock={() => {
            setIsAdGateOpen(false)
            setIsValuationUnlocked(true)
          }}
          onClose={() => setIsAdGateOpen(false)}
        />
      )}

    </div>
  )
}

function TestHomeReviewSwiper() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const autoplayRef = useRef(null)
  const cardRef = useRef(null)
  const isAnimatingRef = useRef(false)

  const goToNext = () => {
    if (!cardRef.current || isAnimatingRef.current) {
      return
    }
    isAnimatingRef.current = true
    gsap.to(cardRef.current, {
      duration: 0.35,
      yPercent: -5,
      xPercent: -4,
      rotation: -2,
      opacity: 0,
      ease: 'expo.in',
      onComplete: () => {
        setActiveIndex((prev) => (prev + 1) % TEST_HOME_REVIEW_CARDS.length)
      }
    })
  }

  const goToIndex = (targetIndex) => {
    setActiveIndex(targetIndex)
  }

  useLayoutEffect(() => {
    if (!cardRef.current) {
      return
    }
    gsap.fromTo(
      cardRef.current,
      { yPercent: 20, xPercent: 0, rotation: 0, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: 0.45,
        ease: 'expo.out',
        onComplete: () => {
          isAnimatingRef.current = false
        }
      }
    )
  }, [activeIndex])

  useEffect(() => {
    if (isHovered) return undefined
    autoplayRef.current = setInterval(() => {
      goToNext()
    }, 5000)
    return () => {
      if (autoplayRef.current) {
        clearInterval(autoplayRef.current)
      }
    }
  }, [isHovered])

  const activeCard = TEST_HOME_REVIEW_CARDS[activeIndex]

  return (
    <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center justify-center">
      <div
        className="absolute inset-x-0 top-1 sm:top-1.5 flex items-center justify-center pointer-events-none"
      >
        <div className="w-full bg-[#FFF6C7] border border-slate-900/30 rounded-xl shadow-[1px_1px_0_0_rgba(15,23,42,0.5)] px-4 py-3 scale-[0.9] translate-y-3 opacity-60" />
      </div>
      <div
        className="absolute inset-x-0 top-1.5 sm:top-2 flex items-center justify-center pointer-events-none"
      >
        <div className="w-full bg-[#FFF6C7] border border-slate-900/40 rounded-xl shadow-[2px_2px_0_0_rgba(15,23,42,0.6)] px-4 py-3 scale-[0.93] translate-y-2 opacity-75" />
      </div>
      <div
        className="absolute inset-x-0 top-2 sm:top-3 flex items-center justify-center pointer-events-none"
      >
        <div className="w-full bg-[#FFF6C7] border border-slate-900/60 rounded-xl shadow-[3px_3px_0_0_rgba(15,23,42,0.7)] px-4 py-3 scale-[0.96] translate-y-1.5 opacity-90" />
      </div>
      <div
        ref={cardRef}
        className="relative w-full bg-[#FFF6C7] border border-slate-900 rounded-xl shadow-[4px_4px_0_0_rgba(15,23,42,1)] px-4 py-3 cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={goToNext}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-slate-900 flex items-center justify-center">
              <span className="text-[11px] text-white">★</span>
            </div>
            <span className="text-[10px] sm:text-xs tracking-[0.14em] uppercase text-slate-700">
              {activeCard.label}
            </span>
          </div>
          <span className="text-[10px] sm:text-xs text-slate-500">Ora</span>
        </div>
        <p className="mt-2 text-sm md:text-base font-semibold text-slate-900 leading-snug">
          {activeCard.title}
        </p>
        <p className="mt-2 text-xs text-slate-600">{activeCard.meta}</p>
      </div>
      <div className="mt-4 sm:mt-5 flex items-center justify-center gap-1.5">
        {TEST_HOME_REVIEW_CARDS.map((card, i) => (
          <button
            key={card.id}
            type="button"
            onClick={() => goToIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === activeIndex ? 'w-4 bg-slate-900' : 'w-2 bg-slate-500/40'
            }`}
            aria-label={`Mostra recensione ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

function TargetAudienceVisual() {
  const containerRef = useRef(null)
  const cardsRef = useRef([])

  useLayoutEffect(() => {
    if (!containerRef.current) {
      return
    }
    const cards = cardsRef.current.filter(Boolean)
    if (!cards.length) {
      return
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cards,
        { yPercent: 40, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.9,
          ease: 'expo.out',
          stagger: 0.15,
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        }
      )
    }, containerRef)

    return () => {
      ctx.revert()
    }
  }, [])

  const setCardRef = (index) => (el) => {
    cardsRef.current[index] = el
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-72 sm:h-80 lg:h-96 rounded-3xl border-2 border-slate-900 overflow-hidden"
      style={{
        backgroundColor: '#E6E4FF',
        backgroundImage:
          'linear-gradient(to right, rgba(15,23,42,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.08) 1px, transparent 1px)',
        backgroundSize: '32px 32px'
      }}
    >
      <div className="absolute inset-6 sm:inset-8 flex flex-col justify-center">
        <div
          ref={setCardRef(0)}
          className="w-full max-w-sm bg-white/90 border border-slate-900 rounded-2xl shadow-[8px_8px_0_rgba(15,23,42,1)] px-5 py-4"
        >
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-indigo-700">
            Scenario reale
          </p>
          <p className="mt-2 text-sm text-slate-900">
            Stime rapide e coerenti per ogni tipologia di immobile, pronte da confrontare con il
            mercato reale.
          </p>
        </div>
        <div
          ref={setCardRef(1)}
          className="mt-5 ml-8 w-[calc(100%-2rem)] max-w-xs bg-[#F3E8FF] border border-slate-900 rounded-2xl shadow-[6px_6px_0_rgba(15,23,42,0.9)] px-4 py-3"
        >
          <p className="text-xs font-medium text-slate-900">
            Visuale pensata per affiancare la tua esperienza, non per sostituirla.
          </p>
        </div>
        <div
          ref={setCardRef(2)}
          className="mt-4 ml-16 w-[calc(100%-4rem)] max-w-xs bg-[#DBEAFE] border border-slate-900 rounded-2xl shadow-[4px_4px_0_rgba(15,23,42,0.8)] px-4 py-3"
        >
          <p className="text-xs font-medium text-slate-900">
            Adatta a privati, investitori e professionisti che gestiscono più immobili.
          </p>
        </div>
      </div>
    </div>
  )
}

function HowItWorksVisual() {
  const containerRef = useRef(null)
  const layersRef = useRef([])

  useLayoutEffect(() => {
    if (!containerRef.current) {
      return
    }
    const layers = layersRef.current.filter(Boolean)
    if (!layers.length) {
      return
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        layers,
        { yPercent: 40, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          stagger: 0.18,
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        }
      )
    }, containerRef)

    return () => {
      ctx.revert()
    }
  }, [])

  const setLayerRef = (index) => (el) => {
    layersRef.current[index] = el
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-72 sm:h-80 lg:h-96 rounded-3xl border-2 border-slate-900 overflow-hidden"
      style={{
        backgroundColor: '#FFEFD6',
        backgroundImage:
          'linear-gradient(to right, rgba(15,23,42,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.08) 1px, transparent 1px)',
        backgroundSize: '32px 32px'
      }}
    >
      <div className="absolute inset-5 sm:inset-8 flex flex-col justify-center">
        <div
          ref={setLayerRef(0)}
          className="w-full max-w-sm bg-white/90 border border-slate-900 rounded-2xl shadow-[8px_8px_0_rgba(15,23,42,1)] px-5 py-4"
        >
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-slate-900">
            Step di valutazione
          </p>
          <p className="mt-2 text-sm text-slate-900">
            Ogni passo è pensato per raccogliere solo i dati necessari, senza sovraccaricarti.
          </p>
        </div>
        <div
          ref={setLayerRef(1)}
          className="mt-5 ml-10 w-[calc(100%-2.5rem)] max-w-xs bg-[#FEE2E2] border border-slate-900 rounded-2xl shadow-[6px_6px_0_rgba(15,23,42,0.9)] px-4 py-3"
        >
          <p className="text-xs font-medium text-slate-900">
            Il motore incrocia valori di zona, storico e caratteristiche simili.
          </p>
        </div>
        <div
          ref={setLayerRef(2)}
          className="mt-4 ml-20 w-[calc(100%-5rem)] max-w-xs bg-[#E0F2FE] border border-slate-900 rounded-2xl shadow-[4px_4px_0_rgba(15,23,42,0.8)] px-4 py-3"
        >
          <p className="text-xs font-medium text-slate-900">
            Il risultato finale è una fascia di valore leggibile, pronta da condividere.
          </p>
        </div>
      </div>
    </div>
  )
}

function WhyChooseVisual() {
  const containerRef = useRef(null)
  const tilesRef = useRef([])

  useLayoutEffect(() => {
    if (!containerRef.current) {
      return
    }
    const tiles = tilesRef.current.filter(Boolean)
    if (!tiles.length) {
      return
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        tiles,
        { yPercent: 40, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          stagger: 0.18,
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        }
      )
    }, containerRef)

    return () => {
      ctx.revert()
    }
  }, [])

  const setTileRef = (index) => (el) => {
    tilesRef.current[index] = el
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-72 sm:h-80 lg:h-96 rounded-3xl border-2 border-slate-900 overflow-hidden"
      style={{
        backgroundColor: '#E0F2FE',
        backgroundImage:
          'linear-gradient(to right, rgba(15,23,42,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.08) 1px, transparent 1px)',
        backgroundSize: '32px 32px'
      }}
    >
      <div className="absolute inset-3 sm:inset-6 lg:inset-8 grid grid-cols-2 gap-2 sm:gap-4 items-stretch">
        <div
          ref={setTileRef(0)}
          className="bg-white/90 border border-slate-900 rounded-xl sm:rounded-2xl shadow-[4px_4px_0_rgba(15,23,42,1)] sm:shadow-[6px_6px_0_rgba(15,23,42,1)] px-2 py-2 sm:px-4 sm:py-4 flex flex-col justify-between overflow-hidden"
        >
          <p className="text-[10px] sm:text-xs font-semibold tracking-[0.1em] sm:tracking-[0.16em] uppercase text-slate-900">
            Chiarezza
          </p>
          <p className="mt-1 sm:mt-2 text-[10px] sm:text-sm text-slate-900 line-clamp-3 sm:line-clamp-none">
            Una vista sintetica dei fattori che pesano sulla valutazione, sempre spiegati in modo leggibile.
          </p>
        </div>
        <div
          ref={setTileRef(1)}
          className="bg-[#F5F3FF] border border-slate-900 rounded-xl sm:rounded-2xl shadow-[3px_3px_0_rgba(15,23,42,0.9)] sm:shadow-[4px_4px_0_rgba(15,23,42,0.9)] px-2 py-2 sm:px-4 sm:py-4 flex flex-col justify-between overflow-hidden"
        >
          <p className="text-[10px] sm:text-xs font-semibold tracking-[0.1em] sm:tracking-[0.16em] uppercase text-slate-900">
            Controllo
          </p>
          <p className="mt-1 sm:mt-2 text-[10px] sm:text-sm text-slate-900 line-clamp-3 sm:line-clamp-none">
            Decidi tu quando essere ricontattato: lo strumento funziona anche se vuoi solo orientarti.
          </p>
        </div>
        <div
          ref={setTileRef(2)}
          className="bg-[#ECFDF3] border border-slate-900 rounded-xl sm:rounded-2xl shadow-[3px_3px_0_rgba(15,23,42,0.9)] sm:shadow-[4px_4px_0_rgba(15,23,42,0.9)] px-2 py-2 sm:px-4 sm:py-4 flex flex-col justify-between overflow-hidden"
        >
          <p className="text-[10px] sm:text-xs font-semibold tracking-[0.1em] sm:tracking-[0.16em] uppercase text-slate-900">
            Metodo
          </p>
          <p className="mt-1 sm:mt-2 text-[10px] sm:text-sm text-slate-900 line-clamp-3 sm:line-clamp-none">
            Un percorso costruito con esperti UX e del settore, per ridurre attriti e dubbi.
          </p>
        </div>
        <div
          ref={setTileRef(3)}
          className="bg-[#FEF3C7] border border-slate-900 rounded-xl sm:rounded-2xl shadow-[3px_3px_0_rgba(15,23,42,0.9)] sm:shadow-[4px_4px_0_rgba(15,23,42,0.9)] px-2 py-2 sm:px-4 sm:py-4 flex flex-col justify-between overflow-hidden"
        >
          <p className="text-[10px] sm:text-xs font-semibold tracking-[0.1em] sm:tracking-[0.16em] uppercase text-slate-900">
            Rispetto
          </p>
          <p className="mt-1 sm:mt-2 text-[10px] sm:text-sm text-slate-900 line-clamp-3 sm:line-clamp-none">
            Raccogliamo solo i dati necessari e non ti bombardiamo di chiamate indesiderate.
          </p>
        </div>
      </div>
    </div>
  )
}

// Città con una pagina /valutazione-casa-:slug dedicata e collegata dal
// blocco "altre città" più sotto. Lo slug deve combaciare con quello passato
// a getMarketData nel backend (server/services/realAdvisorMarketData.js) e
// con l'elenco CITY_SLUGS in scripts/prerender.mjs (tenuto in sync a mano,
// stesso pattern già usato per FAQ_PAGE_ITEMS).
const FEATURED_CITIES = [
  { slug: 'pescara', name: 'Pescara' },
  { slug: 'roma', name: 'Roma' },
  { slug: 'milano', name: 'Milano' },
  { slug: 'napoli', name: 'Napoli' },
  { slug: 'torino', name: 'Torino' },
  { slug: 'bologna', name: 'Bologna' },
  { slug: 'firenze', name: 'Firenze' },
  { slug: 'bari', name: 'Bari' },
  { slug: 'chieti', name: 'Chieti' },
  { slug: 'teramo', name: 'Teramo' }
]

const BLOG_ARTICLES_PLACEHOLDER = [
  {
    id: 1,
    slug: 'come-capire-valutazione-immobile-realistica',
    tag: 'Valutazione',
    title: 'Come capire se la valutazione del tuo immobile è realistica',
    readTime: '5 min',
    level: 'Guida base',
    seoTitle:
      'Come capire se la valutazione del tuo immobile è realistica | Blog Valuta Facile',
    seoDescription:
      'Scopri come leggere le stime, confrontare i dati di mercato e capire se il valore proposto per il tuo immobile è davvero in linea con la realtà.',
    publishedAt: '2024-01-15',
    updatedAt: '2026-09-06',
    body:
      'Una valutazione è realistica se rientra nella fascia di prezzo al metro quadro indicata dai dati ufficiali OMI (Osservatorio del Mercato Immobiliare, Agenzia delle Entrate) per la zona esatta dell’immobile, corretta poi in base a stato di conservazione, piano e caratteristiche specifiche. Se lo scostamento dalla media di zona supera il 15-20% senza una spiegazione precisa, è il primo segnale che qualcosa non torna.\n\nPer verificarlo in pratica confronta tre cose: il semestre OMI usato (i valori vengono aggiornati due volte l’anno, e una stima basata su dati vecchi di 2-3 anni non è più affidabile), il modo in cui sono stati considerati eventuali lavori o difetti dell’immobile, e se il numero proposto è un valore singolo o una fascia. Una valutazione seria dà sempre un intervallo minimo-massimo, non una cifra unica: una fascia stretta (differenza del 5-10% tra minimo e massimo) indica dati di zona solidi, una fascia molto larga (oltre il 25-30%) indica maggiore incertezza, non un errore.\n\nSe hai ricevuto due valutazioni diverse per lo stesso immobile, la differenza quasi sempre nasce da una di queste tre cose: dati di mercato di periodi diversi, un diverso peso dato allo stato dell’immobile, oppure una definizione diversa di "zona" (una via specifica rispetto a una media dell’intero comune). Chiedere di vedere queste ipotesi è il modo più veloce per capire quale stima fidarsi di più.\n\nUna buona pratica è aggiornare la valutazione ogni 6-12 mesi, o subito dopo un cambiamento rilevante nella zona (nuove infrastrutture, variazioni significative di prezzo nelle vendite comparabili) o nell’immobile stesso (ristrutturazioni, cambio di classe energetica).',
    keyPoints: [
      'Confronta sempre la stima con immobili simili nella stessa zona.',
      'Verifica come sono stati considerati elementi di pregio e lavori recenti.',
      'Ricorda che la valutazione è una fascia, non un numero fisso immutabile.'
    ],
    faq: [
      {
        question: 'Cosa posso fare se ho ricevuto due valutazioni molto diverse?',
        answer:
          'Analizza nel dettaglio le ipotesi alla base delle due stime: dati di mercato utilizzati, stato dell’immobile, prospettive della zona. In caso di dubbi, chiedi che ti vengano spiegati i criteri in modo semplice.'
      },
      {
        question: 'Ogni quanto ha senso aggiornare la valutazione della casa?',
        answer:
          'In mercati dinamici è utile aggiornare la stima ogni 6–12 mesi o quando ci sono cambiamenti importanti nella zona o nella situazione dell’immobile.'
      }
    ]
  },
  {
    id: 2,
    slug: 'prezzi-case-italia-2024',
    tag: 'Mercato',
    title: 'Cosa sta succedendo ai prezzi delle case in Italia',
    readTime: '4 min',
    level: 'Panoramica',
    seoTitle: 'Cosa sta succedendo ai prezzi delle case in Italia | Blog Valuta Facile',
    seoDescription:
      'Uno sguardo semplice ma concreto ai movimenti recenti del mercato immobiliare italiano e a cosa significano per chi vuole vendere o comprare casa.',
    publishedAt: '2024-01-22',
    updatedAt: '2026-09-06',
    body:
      'Non esiste un’unica tendenza nazionale dei prezzi delle case: alcune città e zone turistiche o ad alta domanda continuano a crescere, mentre altre realtà si sono stabilizzate o mostrano prezzi in leggero calo. La variabile che conta davvero per orientarti non è il titolo di giornale, ma il prezzo al metro quadro OMI aggiornato al semestre più recente per il tuo comune e la tua zona specifica.\n\nQuesto succede perché il mercato immobiliare italiano è fatto di tanti mercati locali che rispondono a fattori diversi: disponibilità di lavoro nella zona, nuove infrastrutture, pressione turistica, tasso di invecchiamento della popolazione locale. Due comuni a 20 km di distanza possono avere andamenti opposti nello stesso anno, quindi un dato nazionale o regionale serve solo come contesto generale, non come riferimento per il prezzo del tuo immobile.\n\nOltre al prezzo, guarda anche ai tempi medi di vendita nella tua zona: se sul mercato locale un immobile simile al tuo impiega tipicamente 3-4 mesi per vendersi e la tua aspettativa di prezzo implica tempi doppi o tripli, è un segnale che il prezzo richiesto è probabilmente troppo alto rispetto a quanto il mercato è disposto ad assorbire ora.\n\nSe stai per vendere o comprare, usa sempre i dati aggiornati al semestre più recente: valori di oltre un anno fa possono già essere superati, soprattutto in zone dove il mercato si sta muovendo rapidamente in una direzione o nell’altra.',
    keyPoints: [
      'Non esiste un unico mercato immobiliare: ogni zona ha dinamiche proprie.',
      'Prezzi e tempi di vendita vanno letti insieme per capire la domanda reale.',
      'Una buona valutazione parte sempre da dati aggiornati e non da impressioni.'
    ],
    faq: [
      {
        question: 'Perché sento opinioni opposte sul momento del mercato?',
        answer:
          'Spesso chi parla si riferisce alla propria città o al proprio segmento di immobili. Per orientarti davvero è meglio guardare dati specifici sulla tua zona e sulla tipologia di casa che vuoi vendere.'
      }
    ]
  },
  {
    id: 3,
    slug: 'errori-che-abbassano-valore-immobile',
    tag: 'Vendita',
    title: 'Tre errori che abbassano subito il valore percepito',
    readTime: '6 min',
    level: 'Strategia',
    seoTitle: 'Tre errori che abbassano subito il valore percepito | Blog Valuta Facile',
    seoDescription:
      'Scopri gli errori più comuni che fanno sembrare un immobile meno interessante agli occhi di chi lo visita e come evitarli.',
    publishedAt: '2024-01-29',
    updatedAt: '2026-09-06',
    body:
      'I tre errori che abbassano più velocemente il valore percepito di una casa sono: un annuncio incompleto (meno di 8-10 foto, planimetria o metratura mancante), ambienti troppo personalizzati che impediscono a chi visita di immaginarsi nella casa, e piccoli difetti visibili (infissi datati, crepe da assestamento, macchie di umidità) che fanno pensare a lavori molto più grandi e costosi di quelli reali.\n\nL’annuncio incompleto è il primo filtro: un annuncio con poche foto scure o senza planimetria riceve tipicamente molte meno richieste di visita, perché chi cerca casa oggi scarta rapidamente gli annunci poco chiari prima ancora di contattare l’agenzia. Foto luminose, planimetria aggiornata e metratura precisa (verificabile in visura) sono il minimo per non perdere contatti già in questa fase.\n\nGli ambienti troppo personali - foto di famiglia ovunque, arredi molto specifici, colori molto marcati - rendono più difficile per chi visita proiettarsi nella casa come sua. Non serve svuotare tutto: basta ridurre gli oggetti personali nelle stanze principali (soggiorno, camera da letto, ingresso) durante il periodo delle visite.\n\nI piccoli difetti visibili sono ingannevoli: una crepa da assestamento o un infisso vecchio, che magari costano poche centinaia di euro da sistemare, nella mente di chi visita si trasformano facilmente in "quanti altri problemi nascosti avrà questa casa?" - un dubbio che pesa sulla trattativa più del costo reale della riparazione. Sistemare questi dettagli prima delle visite è spesso più efficace, ed economico, di uno sconto sul prezzo richiesto.',
    keyPoints: [
      'Annunci confusi o incompleti abbassano le aspettative ancora prima della visita.',
      'Troppi oggetti personali rendono difficile immaginarsi dentro la casa.',
      'Piccoli difetti visibili fanno pensare a lavori più grandi e costosi.'
    ],
    faq: [
      {
        question: 'Ha senso fare foto professionali per l’annuncio?',
        answer:
          'In molti casi sì: immagini chiare e luminose aumentano le richieste di visita e ti aiutano ad attirare persone realmente interessate, che percepiscono meglio il valore dell’immobile.'
      }
    ]
  },
  {
    id: 4,
    slug: 'cosa-cercano-acquirenti-in-casa',
    tag: 'Acquirenti',
    title: 'Cosa cercano davvero le persone quando visitano una casa',
    readTime: '5 min',
    level: 'Insight',
    seoTitle:
      'Cosa cercano davvero le persone quando visitano una casa | Blog Valuta Facile',
    seoDescription:
      'Dal primo sguardo all’ingresso fino alla luce in soggiorno: ecco cosa colpisce davvero chi entra in un immobile in vendita.',
    publishedAt: '2024-02-05',
    updatedAt: '2026-09-06',
    body:
      'Durante una visita le persone giudicano una casa in gran parte nei primi 30-60 secondi, e lo fanno più sulle sensazioni - ordine, luce, odore, temperatura - che sui numeri tecnici come metri quadri o numero di stanze, che di solito hanno già valutato leggendo l’annuncio prima di prenotare la visita.\n\nI tre elementi che pesano di più sono: la luminosità naturale (una stanza luminosa viene percepita come più grande e più curata anche a parità di metratura reale), l’ordine e l’assenza di ingombri (un corridoio libero o un piano cucina sgombro comunicano "casa pronta da vivere" molto più di qualsiasi descrizione nell’annuncio), e la disposizione degli spazi (poter immaginare dove mettere il proprio divano o il proprio letto conta più della forma esatta della stanza).\n\nDettagli apparentemente minori come l’odore (arieggiare prima delle visite, evitare odori di cucina o di animali) e la temperatura (una casa troppo fredda in inverno o soffocante in estate lascia un ricordo negativo indipendentemente da come è arredata) fanno spesso la differenza tra una visita che lascia indifferenti e una che genera una proposta concreta nei giorni successivi.\n\nNon serve arredare la casa da zero: basta lavorare su questi punti specifici prima di ogni visita, con un investimento di tempo minimo rispetto al beneficio sulla percezione di valore.',
    keyPoints: [
      'Le persone reagiscono prima alle sensazioni che ai numeri.',
      'Luce, ordine e disposizione degli ambienti guidano la percezione di valore.',
      'Piccoli dettagli come odore e temperatura influenzano molto il ricordo della visita.'
    ],
    faq: [
      {
        question: 'Devo svuotare completamente la casa per venderla meglio?',
        answer:
          'Non serve svuotare tutto: è più utile togliere il superfluo, rendere gli ambienti ordinati e lasciare spazio a chi visita per immaginare la propria vita dentro la casa.'
      }
    ]
  },
  {
    id: 5,
    slug: 'lavori-che-aumentano-valore-casa',
    tag: 'Ristrutturazione',
    title: 'Piccoli lavori che aumentano il valore prima di vendere',
    readTime: '7 min',
    level: 'Checklist',
    seoTitle:
      'Piccoli lavori che aumentano il valore prima di vendere casa | Blog Valuta Facile',
    seoDescription:
      'Una lista ragionata di interventi leggeri ma efficaci per presentare meglio il tuo immobile e sostenerne il valore in fase di trattativa.',
    publishedAt: '2024-02-12',
    updatedAt: '2026-09-06',
    body:
      'I lavori con il miglior rapporto tra costo e aumento del valore percepito, prima di vendere, sono di solito: tinteggiatura delle pareti (indicativamente 5-15 €/mq, a seconda della zona e dell’impresa), sostituzione di dettagli usurati come maniglie, prese e placche (pochi euro a pezzo, ma visibili subito), e un miglioramento dell’illuminazione con punti luce o lampadine a LED più performanti. Non serve una ristrutturazione completa per ottenere un salto percepito importante.\n\nQuesti interventi funzionano perché riducono la sensazione di "lavori da fare" che l’acquirente mette mentalmente in conto come sconto sul prezzo: una parete scrostata o un infisso datato, anche se costano poco da sistemare, vengono spesso sovrastimati da chi visita, che tende a immaginare un costo di riparazione superiore a quello reale.\n\nPrima di decidere se fare lavori più impegnativi (bagno, cucina, impianti), conviene chiedersi se il costo verrà recuperato nel prezzo di vendita: in generale una ristrutturazione parziale mirata (es. solo il bagno) ha un ritorno migliore di un rifacimento completo, soprattutto se l’immobile è già in una fascia di prezzo competitiva per la zona.\n\nSe il budget è limitato, l’ordine di priorità più efficace è: pulizia profonda e tinteggiatura, sistemazione dei piccoli difetti visibili (crepe, infissi, prese), poi solo se il budget lo consente interventi più strutturali come impianti o pavimenti.',
    keyPoints: [
      'Interventi leggeri possono migliorare molto la percezione dell’immobile.',
      'Lavori mirati riducono la sensazione di spese future per chi compra.',
      'È utile scegliere interventi con buon rapporto tra costo e beneficio.'
    ],
    faq: [
      {
        question: 'Conviene ristrutturare prima di mettere in vendita?',
        answer:
          'Dipende dal tipo di immobile e dalla zona. In molti casi bastano lavori mirati per migliorare la presentazione senza impegnarsi in ristrutturazioni pesanti e costose.'
      }
    ]
  },
  {
    id: 6,
    slug: 'tasso-mutuo-e-prezzo-di-vendita',
    tag: 'Mutuo',
    title: 'Perché il tasso del mutuo influenza il prezzo di vendita',
    readTime: '4 min',
    level: 'Scenario',
    seoTitle:
      'Perché il tasso del mutuo influenza il prezzo di vendita | Blog Valuta Facile',
    seoDescription:
      'Capire come i movimenti dei tassi dei mutui incidono sulla capacità di spesa degli acquirenti e quindi sul valore di mercato degli immobili.',
    publishedAt: '2024-02-19',
    updatedAt: '2026-09-06',
    body:
      'Quando il tasso di un mutuo sale, la rata mensile aumenta più di quanto sembri: su un mutuo trentennale di 200.000 €, passare da un tasso fisso del 3% al 4% fa salire la rata di circa 110 € al mese (da circa 843 € a circa 955 €), circa 55 € al mese ogni 100.000 € finanziati. Questo calcolo è puramente illustrativo (la rata reale dipende da importo, durata e condizioni specifiche del mutuo) ma rende l’idea di perché i tassi contano così tanto per il mercato immobiliare.\n\nQuando la rata sale, molte famiglie si avvicinano al limite di sostenibilità stabilito dalle banche (in genere la rata non dovrebbe superare un terzo del reddito netto), quindi si riducono sia il numero di famiglie che possono ottenere il mutuo, sia l’importo massimo che possono permettersi. Il risultato è una platea di acquirenti più piccola e più selettiva, il che spinge alcuni venditori a rendersi più disponibili a negoziare sul prezzo.\n\nQuando i tassi scendono, succede l’opposto: la stessa rata mensile permette di finanziare un importo più alto, più famiglie tornano nella fascia di acquirenti solvibili, e questo tende a sostenere o far salire i prezzi, soprattutto nelle fasce di prezzo più sensibili al mutuo (prima casa, tagli medio-piccoli).\n\nSe stai vendendo in un periodo di tassi alti, una valutazione realistica e aggiornata ti aiuta a fissare un prezzo che tenga conto di questa platea più selettiva, invece di basarti su offerte ricevute mesi prima in condizioni di mercato diverse.',
    keyPoints: [
      'Tassi più alti riducono il numero di acquirenti potenziali.',
      'Quando i tassi scendono è più facile sostenere una rata e comprare casa.',
      'Conoscere il contesto dei tassi aiuta a leggere meglio le offerte ricevute.'
    ],
    faq: [
      {
        question: 'Ha senso vendere quando i tassi dei mutui sono alti?',
        answer:
          'Può avere senso, ma bisogna considerare che molti acquirenti saranno più selettivi. Una buona valutazione ti aiuta a posizionare il prezzo in modo coerente con il momento del mercato.'
      }
    ]
  },
  {
    id: 7,
    slug: 'vendere-o-mettere-a-reddito',
    tag: 'Affitto',
    title: 'Meglio vendere o mettere a reddito? Pro e contro',
    readTime: '8 min',
    level: 'Analisi',
    seoTitle:
      'Meglio vendere o mettere a reddito il tuo immobile? | Blog Valuta Facile',
    seoDescription:
      'Un confronto ragionato tra vendita e affitto per aiutarti a scegliere la strada più adatta alle tue esigenze e al contesto di mercato.',
    publishedAt: '2024-02-26',
    updatedAt: '2026-09-06',
    body:
      'In Italia il rendimento lordo da affitto (canone annuo diviso valore dell’immobile) si colloca tipicamente tra il 3% e il 6% a seconda della città e della zona, contro un investimento in liquidità o in altri strumenti che va confrontato al netto di tasse (cedolare secca 21% o 10% per canone concordato) e costi di gestione (manutenzione, eventuali sfitti, amministratore). Se il rendimento netto stimato è vicino o inferiore a quello di alternative a basso rischio, la vendita diventa spesso più conveniente della rendita.\n\nOltre al rendimento va considerato il tempo: mettere a reddito richiede gestione continuativa (ricerca inquilino, manutenzione, eventuali contenziosi), mentre vendere libera capitale subito ma chiude la possibilità di beneficiare di una futura rivalutazione dell’immobile. Chi ha bisogno di liquidità a breve termine, o non vuole occuparsi di gestione, tende a orientarsi verso la vendita anche con un rendimento da affitto teoricamente interessante.\n\nUn modo pratico per decidere è simulare entrambi gli scenari con numeri reali: prezzo di vendita realistico (basato su una valutazione aggiornata) da un lato, canone di affitto atteso meno costi e tasse dall’altro, proiettato su un orizzonte di 5-10 anni includendo un’ipotesi prudente di rivalutazione o svalutazione dell’immobile.\n\nNon esiste una risposta valida per tutti: dipende dal tuo bisogno di liquidità, dalla tua disponibilità a gestire un affitto nel tempo e dalle prospettive specifiche della zona in cui si trova l’immobile.',
    keyPoints: [
      'Vendita e affitto rispondono a bisogni diversi e tempi diversi.',
      'È utile confrontare rendimento da affitto e prezzo di vendita realistico.',
      'Una buona valutazione iniziale aiuta a simulare scenari nel tempo.'
    ],
    faq: [
      {
        question: 'Come scelgo tra vendita e affitto del mio immobile?',
        answer:
          'Metti a confronto obiettivi personali, bisogno di liquidità, rendimento potenziale dell’affitto e andamento del mercato nella tua zona. Una stima aggiornata è la base per fare questo ragionamento.'
      }
    ]
  },
  {
    id: 8,
    slug: 'documenti-per-vendita-casa',
    tag: 'Documenti',
    title: 'Quali documenti servono davvero per una vendita serena',
    readTime: '5 min',
    level: 'Pratica',
    seoTitle:
      'Quali documenti servono davvero per vendere casa in serenità | Blog Valuta Facile',
    seoDescription:
      'Una panoramica essenziale dei documenti chiave da avere pronti quando decidi di vendere il tuo immobile, senza tecnicismi inutili.',
    publishedAt: '2024-03-04',
    updatedAt: '2026-09-06',
    body:
      'I documenti essenziali per vendere casa senza intoppi sono cinque: visura catastale aggiornata, planimetria catastale conforme allo stato di fatto dell’immobile, atto di provenienza (rogito, successione o donazione), attestato di prestazione energetica (APE, obbligatorio per legge fin dalla pubblicazione dell’annuncio) e, se l’immobile è in condominio, il regolamento condominiale insieme all’ultimo verbale di assemblea.\n\nLa planimetria conforme è quella che crea più problemi in fase finale: se negli anni sono stati fatti lavori (spostamento di una parete, chiusura di un balcone, cambio di destinazione d’uso di una stanza) senza aggiornare gli atti catastali, la difformità va sanata prima del rogito, con tempi che possono richiedere alcune settimane. Verificarla in anticipo evita di scoprirlo a trattativa già avviata.\n\nL’attestato di prestazione energetica ha una validità di 10 anni e va rifatto se sono stati eseguiti interventi che cambiano la classe energetica dell’immobile (es. sostituzione infissi, caldaia, isolamento). È obbligatorio indicarne la classe già nell’annuncio, quindi va richiesto prima di pubblicare, non solo prima del rogito.\n\nAvere questi documenti pronti prima ancora di ricevere la prima offerta accorcia i tempi tra proposta e rogito e comunica alla controparte un livello di serietà che spesso facilita anche la trattativa sul prezzo.',
    keyPoints: [
      'Documenti incompleti sono una delle prime cause di ritardi nelle vendite.',
      'Preparare in anticipo la documentazione riduce stress e imprevisti.',
      'Sapere cosa serve aiuta a scegliere meglio consulenti e professionisti.'
    ],
    faq: [
      {
        question: 'Cosa succede se manca un documento importante in fase di vendita?',
        answer:
          'Di solito la vendita si rallenta e può creare sfiducia nella controparte. Per questo è utile preparare i documenti in anticipo con l’aiuto di un professionista o della tua agenzia di fiducia.'
      }
    ]
  },
  {
    id: 9,
    slug: 'preparare-casa-per-le-visite',
    tag: 'Consigli',
    title: 'Come preparare casa alle visite senza stravolgere la tua routine',
    readTime: '6 min',
    level: 'Suggerimenti',
    seoTitle:
      'Come preparare casa alle visite senza stravolgere la tua routine | Blog Valuta Facile',
    seoDescription:
      'Piccoli accorgimenti quotidiani per rendere la tua casa più accogliente agli occhi di chi la visita, senza trasformare tutto in un lavoro a tempo pieno.',
    publishedAt: '2024-03-11',
    updatedAt: '2026-09-06',
    body:
      'Per gestire le visite senza vivere in una casa "da fotografia" tutti i giorni, la soluzione più efficace è una routine di 10-15 minuti da fare solo prima di ogni visita confermata, non una perfezione costante: sistemare le zone che l’acquirente vede per prime (ingresso, soggiorno, cucina), aprire le tapparelle per la luce naturale e arieggiare gli ambienti.\n\nOrganizzare in anticipo 1-2 "zone di appoggio" (un cesto, un armadio, una stanza meno visitata) dove spostare velocemente oggetti in vista - vestiti, giocattoli, posta - rende questa routine gestibile anche con preavviso breve, ed evita l’effetto "casa messa a soqquadro" che si nota subito.\n\nLe stanze che pesano di più sulla prima impressione sono ingresso, soggiorno e cucina: se il tempo è poco, concentra lo sforzo lì piuttosto che distribuirlo su tutta la casa. Camere da letto e bagni secondari possono restare a un livello di ordine "normale", purché puliti.\n\nQuesta routine funziona meglio se concordata con l’agenzia: chiedere un preavviso minimo di qualche ora per le visite ti permette di applicarla senza stress, mantenendo comunque la casa vivibile nella quotidianità.',
    keyPoints: [
      'Piccole abitudini quotidiane rendono più gestibili le visite improvvise.',
      'Ridurre il superfluo aiuta a mantenere la casa più ordinata e accogliente.',
      'Una semplice routine pre-visita abbassa lo stress e migliora la percezione.'
    ],
    faq: [
      {
        question: 'Come gestisco le visite quando ho poco tempo per preparare la casa?',
        answer:
          'Puoi organizzare in anticipo alcune zone “di appoggio” dove spostare velocemente oggetti in vista e tenere sempre in ordine gli ambienti principali che l’acquirente vedrà per primi.'
      }
    ]
  },
  {
    id: 10,
    slug: 'prima-impressione-nella-vendita-di-casa',
    tag: 'Strategia',
    title: 'Perché una buona prima impressione vale più di uno sconto',
    readTime: '5 min',
    level: 'Mindset',
    seoTitle:
      'Perché una buona prima impressione vale più di uno sconto | Blog Valuta Facile',
    seoDescription:
      'Capire il peso della prima impressione nelle decisioni di acquisto ti aiuta a usare meglio il prezzo come leva di trattativa.',
    publishedAt: '2024-03-18',
    updatedAt: '2026-09-06',
    body:
      'Le prime 2-3 settimane di pubblicazione di un annuncio sono statisticamente le più importanti: è il periodo in cui l’immobile riceve più visualizzazioni e più richieste di visita, perché intercetta tutti gli acquirenti già attivi nella ricerca. Un annuncio con foto scure o poche informazioni brucia questa finestra, e recuperarla dopo (con foto migliori pubblicate in un secondo momento) non genera lo stesso numero di contatti iniziali.\n\nPer questo motivo curare foto, planimetria, descrizione e preparazione degli spazi prima ancora di pubblicare l’annuncio ha spesso un impatto maggiore sul risultato finale di uno sconto sul prezzo deciso in fretta dopo le prime settimane senza riscontri. Un prezzo leggermente più alto ma un annuncio ben presentato genera più richieste di visita di un prezzo scontato ma con un annuncio poco curato.\n\nQuesto non significa che il prezzo non conti: significa che prezzo e presentazione lavorano insieme. Un prezzo coerente con i dati di zona, comunicato attraverso un annuncio curato, arriva a un numero di acquirenti potenziali più ampio e con aspettative più allineate, il che riduce anche il tempo delle trattative.\n\nSe dopo 4-6 settimane di pubblicazione curata le richieste restano poche, allora il problema è più probabilmente il prezzo che la presentazione: a quel punto conviene rivedere la valutazione con dati aggiornati, prima di continuare ad aspettare.',
    keyPoints: [
      'La prima impressione può valere più di uno sconto sul prezzo.',
      'Presentare bene casa aumenta richieste e qualità delle visite.',
      'Prezzo e presentazione funzionano meglio quando sono coerenti tra loro.'
    ],
    faq: [
      {
        question: 'È meglio abbassare subito il prezzo o lavorare sulla presentazione?',
        answer:
          'Spesso è più efficace migliorare prima presentazione, annuncio e foto. Una casa curata genera più interesse e ti permette di usare il prezzo con maggiore consapevolezza nella trattativa.'
      }
    ]
  }
]

// Testo delle FAQ della pagina /domande-frequenti, tenuto in sync a mano con
// l'accordion JSX più sotto (currentPage === 'faq'): usato solo per generare
// lo schema.org FAQPage, non per il rendering visivo (che resta invariato).
const FAQ_PAGE_ITEMS = [
  {
    question: 'La valutazione è davvero gratuita?',
    answer:
      "Sì. Utilizzare Valuta Facile per ottenere una stima non ha costi e non comporta obblighi di affidarti a un'agenzia o a un professionista."
  },
  {
    question: 'Cosa succede dopo che ho ricevuto la valutazione?',
    answer:
      'Puoi semplicemente tenerla per te, usarla come riferimento oppure chiederci supporto per capire come valorizzare al meglio il tuo immobile. Nessun passaggio è automatico o imposto.'
  },
  {
    question: 'Devo lasciare per forza il mio numero di telefono?',
    answer:
      'No. Puoi decidere quali recapiti indicarci e come preferisci essere ricontattato. Se non vuoi telefonate, lo rispettiamo.'
  },
  {
    question: 'La stima è uguale a quella di un perito o di un agente?',
    answer:
      'La nostra è una valutazione online, pensata come base di partenza. È molto utile per orientarti e può essere poi approfondita insieme a un professionista, se lo desideri.'
  },
  {
    question: 'Quanto è precisa la valutazione rispetto al mercato attuale?',
    answer:
      'Usiamo dati ufficiali e analisi aggiornate per costruire una fascia di valore realistica. La stima non sostituisce una perizia, ma ti dà un riferimento affidabile per orientare le tue scelte.'
  },
  {
    question: 'Posso usare Valuta Facile anche se sto solo pensando di vendere?',
    answer:
      "Certo. Molte persone usano la valutazione per farsi un'idea del valore prima di prendere qualsiasi decisione. Non ci sono vincoli né obblighi di mettere in vendita l'immobile."
  },
  {
    question: 'Come vengono utilizzati i miei dati?',
    answer:
      'I dati che inserisci servono solo per calcolare la valutazione o rispondere alle tue richieste di contatto/assistenza. Non vendiamo i tuoi dati a terzi e non li usiamo per campagne massicce di marketing.'
  },
  {
    question: 'Posso chiedere la cancellazione dei miei dati?',
    answer:
      "Sì. In qualsiasi momento puoi scriverci dal Centro assistenza per chiedere la cancellazione o l'aggiornamento dei tuoi dati. Ti daremo riscontro nel minor tempo possibile, nel rispetto della normativa privacy."
  }
]

function BlogArticlesSlider({ onOpenArticle }) {
  const trackRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [visibleSlides, setVisibleSlides] = useState(1)

  useEffect(() => {
    function updateVisibleSlides() {
      if (typeof window === 'undefined') {
        return
      }
      const width = window.innerWidth
      if (width >= 1280) {
        setVisibleSlides(3)
      } else if (width >= 900) {
        setVisibleSlides(2)
      } else {
        setVisibleSlides(1)
      }
    }

    updateVisibleSlides()
    window.addEventListener('resize', updateVisibleSlides)
    return () => window.removeEventListener('resize', updateVisibleSlides)
  }, [])

  useLayoutEffect(() => {
    if (!trackRef.current) {
      return
    }

    const ctx = gsap.context(() => {
      gsap.to(trackRef.current, {
        opacity: 1,
        yPercent: 0,
        duration: 0.7,
        ease: 'power2.out',
        from: {
          opacity: 0,
          yPercent: 6
        }
      })
    }, trackRef)

    return () => {
      ctx.revert()
    }
  }, [activeIndex, visibleSlides])

  const totalArticles = BLOG_ARTICLES_PLACEHOLDER.length

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % totalArticles)
  }

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + totalArticles) % totalArticles)
  }

  const displayedArticles = []
  for (let i = 0; i < visibleSlides; i += 1) {
    const index = (activeIndex + i) % totalArticles
    displayedArticles.push(BLOG_ARTICLES_PLACEHOLDER[index])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrev}
            className="h-8 w-8 rounded-full border border-slate-900 flex items-center justify-center bg-white text-slate-900 hover:bg-slate-900 hover:text-white transition-colors text-xs"
            aria-label="Articolo precedente"
          >
            ←
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="h-8 w-8 rounded-full border border-slate-900 flex items-center justify-center bg-white text-slate-900 hover:bg-slate-900 hover:text-white transition-colors text-xs"
            aria-label="Articolo successivo"
          >
            →
          </button>
        </div>
        <div className="text-xs text-gray-500">
          {visibleSlides > 1
            ? `${visibleSlides} articoli su ${totalArticles}`
            : `${activeIndex + 1}/${totalArticles}`}
        </div>
      </div>

      <div className="relative overflow-hidden">
        <div
          ref={trackRef}
          className="flex -mx-2"
        >
          {displayedArticles.map((article) => (
            <div
              key={article.id}
              className="shrink-0 px-2"
              style={{ width: `${100 / visibleSlides}%` }}
            >
              <article
                className="h-full rounded-2xl border-2 border-slate-900 bg-white px-4 py-4 flex flex-col justify-between cursor-pointer"
                onClick={() => onOpenArticle && onOpenArticle(article)}
              >
                <div>
                  <div className="inline-flex items-center rounded-full border border-slate-900 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-900 bg-slate-50">
                    {article.tag}
                  </div>
                  <h4 className="mt-3 text-xs sm:text-sm md:text-base font-semibold text-gray-900 leading-snug blog-card-title-clamp">
                    {article.title}
                  </h4>
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px] text-gray-600">
                  <span>{article.level}</span>
                  <span>{article.readTime}</span>
                </div>
              </article>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DataPrivacyVisual() {
  const containerRef = useRef(null)
  const layersRef = useRef([])

  useLayoutEffect(() => {
    if (!containerRef.current) {
      return
    }
    const layers = layersRef.current.filter(Boolean)
    if (!layers.length) {
      return
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        layers,
        { yPercent: 40, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          stagger: 0.18,
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        }
      )
    }, containerRef)

    return () => {
      ctx.revert()
    }
  }, [])

  const setLayerRef = (index) => (el) => {
    layersRef.current[index] = el
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-72 sm:h-80 lg:h-96 rounded-3xl border-2 border-slate-900 overflow-hidden"
      style={{
        backgroundColor: '#DCFCE7',
        backgroundImage:
          'linear-gradient(to right, rgba(15,23,42,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.08) 1px, transparent 1px)',
        backgroundSize: '32px 32px'
      }}
    >
      <div className="absolute inset-6 sm:inset-8 flex flex-col justify-center gap-4">
        <div
          ref={setLayerRef(0)}
          className="w-full max-w-sm bg-white/95 border border-slate-900 rounded-2xl shadow-[8px_8px_0_rgba(15,23,42,1)] px-5 py-4"
        >
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-slate-900">
            Privacy first
          </p>
          <p className="mt-2 text-sm text-slate-900">
            I dati vengono usati solo per la valutazione e i servizi che scegli di attivare.
          </p>
        </div>
        <div
          ref={setLayerRef(1)}
          className="w-[calc(100%-2.5rem)] max-w-xs bg-[#ECFDF3] border border-slate-900 rounded-2xl shadow-[6px_6px_0_rgba(15,23,42,0.9)] px-4 py-3 ml-10"
        >
          <p className="text-xs font-medium text-slate-900">
            Nessuna vendita di dati a terzi: eventuali contatti avvengono solo con il tuo consenso.
          </p>
        </div>
        <div
          ref={setLayerRef(2)}
          className="w-[calc(100%-5rem)] max-w-xs bg-[#FEF9C3] border border-slate-900 rounded-2xl shadow-[4px_4px_0_rgba(15,23,42,0.8)] px-4 py-3 ml-20"
        >
          <p className="text-xs font-medium text-slate-900">
            Puoi sempre aggiornare o chiedere la cancellazione dei tuoi dati in modo trasparente.
          </p>
        </div>
      </div>
    </div>
  )
}

function MainFooter({
  onOpenPrivacy,
  onOpenContact,
  onOpenHelp,
  onOpenFaq,
  onOpenTerms,
  onOpenCookies,
  onOpenCookieSettings
}) {
  return (
    <footer className="border-t-2 border-slate-900 bg-[#FFF7EB]">
      <div className="w-full px-4 sm:px-8 lg:px-16 py-10 lg:py-12">
        <div className="w-full rounded-3xl border-2 border-slate-900 bg-[#EDE9FE] px-6 sm:px-8 py-7 sm:py-8 shadow-[8px_8px_0_rgba(15,23,42,1)]">
          <div className="grid gap-8 lg:gap-10 md:grid-cols-2 lg:grid-cols-4 items-start">
            <div>
              <div className="flex items-center justify-center md:justify-start gap-2">
                <img
                  src="/assets/Risorsa 2.png"
                  alt="Valuta Facile"
                  className="h-7 w-auto object-contain"
                />
              </div>
              <p className="mt-4 text-sm text-gray-800 max-w-md text-center md:text-left">
                Valuta Facile è un marchio di Marconi 138 S.r.l. – Piattaforma per la valutazione immobiliare semplice e guidata.
              </p>
              <p className="mt-2 text-xs text-gray-600 text-center md:text-left">
                Via F. Ferdinando D'Avalos 66, 65126 Pescara (PE) · P.IVA 02227840689
              </p>
              <p className="mt-1 text-xs text-gray-600 text-center md:text-left">
                Email: info@valutafacile.it
              </p>
            </div>

            <div aria-labelledby="footer-newsletter-heading" className="max-w-sm">
              <h3
                id="footer-newsletter-heading"
                className="text-xs sm:text-sm font-semibold tracking-[0.22em] uppercase text-indigo-700"
              >
                Newsletter
              </h3>
              <p className="mt-4 text-sm text-gray-800">
                Ricevi aggiornamenti su funzionalità e consigli per capire il mercato immobiliare.
              </p>
              <form className="mt-4 space-y-3" aria-label="Iscrizione newsletter footer">
                <label className="sr-only" htmlFor="footer-newsletter-email">
                  Inserisci la tua email per iscriverti alla newsletter
                </label>
                <input
                  id="footer-newsletter-email"
                  type="email"
                  required
                  placeholder="tuaemail@example.com"
                  className="w-full px-3 py-2.5 text-sm border-2 border-slate-900 rounded-none focus:outline-none focus:ring-0 text-gray-900 placeholder-gray-400 bg-white"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] bg-indigo-900 text-white border-2 border-slate-900 w-full sm:w-auto"
                >
                  Iscriviti
                </button>
              </form>
            </div>

            <div aria-labelledby="footer-support-heading">
              <h3
                id="footer-support-heading"
                className="text-xs sm:text-sm font-semibold tracking-[0.22em] uppercase text-indigo-700"
              >
                Support
              </h3>
              <ul className="mt-4 space-y-2 text-sm text-gray-800">
                <li>
                  <button
                    type="button"
                    onClick={onOpenHelp}
                    className="hover:text-slate-900"
                  >
                    Centro assistenza
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onOpenContact}
                    className="hover:text-slate-900"
                  >
                    Contatta il team
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onOpenFaq}
                    className="hover:text-slate-900"
                  >
                    Domande frequenti
                  </button>
                </li>
              </ul>
            </div>

            <div aria-labelledby="footer-trust-heading">
              <h3
                id="footer-trust-heading"
                className="text-xs sm:text-sm font-semibold tracking-[0.22em] uppercase text-indigo-700"
              >
                Trust &amp; Legal
              </h3>
              <ul className="mt-4 space-y-2 text-sm text-gray-800">
                <li>
                  <button type="button" onClick={onOpenPrivacy} className="hover:text-slate-900">
                    Privacy policy
                  </button>
                </li>
                <li>
                  <button type="button" onClick={onOpenTerms} className="hover:text-slate-900">
                    Termini di utilizzo
                  </button>
                </li>
                <li>
                  <button type="button" onClick={onOpenCookies} className="hover:text-slate-900">
                    Cookie &amp; consenso
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between text-xs text-gray-700">
            <p className="text-center sm:text-left">
              © {new Date().getFullYear()} Valuta Facile S.r.l. · Tutti i diritti riservati.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={onOpenPrivacy}
                className="underline underline-offset-2 hover:text-slate-900"
              >
                Informativa privacy
              </button>
              <button
                type="button"
                onClick={onOpenCookieSettings}
                className="hover:text-slate-900"
              >
                Impostazioni cookie
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

function slugToProvinceName(slug) {
  if (!slug) {
    return ''
  }
  const normalized = slug.replace(/-/g, ' ')
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export default App
