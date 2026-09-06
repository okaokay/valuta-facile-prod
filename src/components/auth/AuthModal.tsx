import { useState } from 'react'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'
import ForgotPasswordForm from './ForgotPasswordForm'

interface AuthModalProps {
  onClose: () => void
  onSuccess: () => void
}

type Tab = 'login' | 'register' | 'forgot'

export default function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('login')

  function handleSuccess() {
    onSuccess()
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[82]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center z-[83] p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-[10px_10px_0_#1e293b] w-full max-w-md p-8 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 text-xl font-bold leading-none"
            aria-label="Chiudi"
          >
            ✕
          </button>

          {activeTab === 'login' && (
            <LoginForm
              onSuccess={handleSuccess}
              onSwitchToRegister={() => setActiveTab('register')}
              onForgotPassword={() => setActiveTab('forgot')}
            />
          )}
          {activeTab === 'register' && (
            <RegisterForm
              onSuccess={handleSuccess}
              onSwitchToLogin={() => setActiveTab('login')}
            />
          )}
          {activeTab === 'forgot' && (
            <ForgotPasswordForm
              onBack={() => setActiveTab('login')}
            />
          )}
        </div>
      </div>
    </>
  )
}
