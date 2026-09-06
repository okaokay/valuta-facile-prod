import { useState, useEffect, useRef } from 'react'
import ContactForm from './ContactForm'

function ContactFormPopup({ isOpen, onClose, onSubmit, onOpenPrivacy }) {
  const [isVisible, setIsVisible] = useState(false)
  const modalRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setTimeout(() => setIsVisible(true), 20)
    } else {
      setIsVisible(false)
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }

      if (event.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault()
            last.focus()
          }
        } else if (document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div
        className={`fixed inset-0 bg-slate-900/55 backdrop-blur-sm transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      <div
        ref={modalRef}
        className={`relative z-[81] w-full mx-3 sm:mx-4 md:mx-0 max-w-md sm:max-w-lg md:max-w-xl max-h-[calc(100vh-24px)] md:max-h-[80vh] rounded-3xl border-2 border-slate-900 bg-white shadow-[10px_10px_0_rgba(15,23,42,1)] flex flex-col overflow-hidden transition-all duration-200 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b-2 border-slate-900 bg-slate-50/70">
          <div>
            <h2 className="text-xl md:text-2xl font-semibold text-slate-900 tracking-tight">
              Visualizza la valutazione completa
            </h2>
            <p className="mt-1 text-xs md:text-sm text-slate-700 max-w-md">
              Inserisci i tuoi dati per visualizzare il valore stimato
              dell&apos;immobile.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-white text-slate-700 hover:bg-slate-900 hover:text-white shadow-[3px_3px_0_rgba(15,23,42,1)] focus:outline-none focus:ring-0"
            aria-label="Chiudi"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>

        <div className="px-6 pt-5 pb-6 overflow-y-auto">
          <ContactForm onSubmit={onSubmit} onOpenPrivacy={onOpenPrivacy} />
        </div>
      </div>
    </div>
  )
}

export default ContactFormPopup
