import { useState } from 'react'
import { authClient } from '../../lib/auth-client'

interface UserMenuProps {
  onNavigateToProfile?: () => void
}

export default function UserMenu({ onNavigateToProfile }: UserMenuProps) {
  const { data: session } = authClient.useSession()
  const [isOpen, setIsOpen] = useState(false)

  if (!session?.user) return null

  async function handleSignOut() {
    await authClient.signOut()
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="flex items-center gap-2 border-2 border-slate-900 rounded-full px-4 py-2 text-sm font-bold text-slate-900 bg-white hover:bg-slate-50 shadow-[3px_3px_0_#1e293b] hover:shadow-[1px_1px_0_#1e293b] transition-all"
      >
        <span className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-black">
          {session.user.name?.charAt(0).toUpperCase() || '?'}
        </span>
        <span className="max-w-[120px] truncate">{session.user.name || session.user.email}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 mt-2 w-56 bg-white border-2 border-slate-900 rounded-xl shadow-[6px_6px_0_#1e293b] z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <p className="text-sm font-black text-slate-900 truncate">{session.user.name}</p>
              <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
            </div>
            {onNavigateToProfile && (
              <button
                onClick={() => { setIsOpen(false); onNavigateToProfile() }}
                className="w-full text-left px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50 transition-colors"
              >
                Il mio profilo
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
            >
              Esci
            </button>
          </div>
        </>
      )}
    </div>
  )
}
