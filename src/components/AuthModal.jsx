import { useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { isSupabaseEnabled } from '../lib/supabase'
import { Modal, Avatar, initialsOf } from './ui'

export default function AuthModal({ open, onClose }) {
  const auth = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    const ok = await (mode === 'signin'
      ? auth.signIn(email, password)
      : auth.signUp(email, password))
    setBusy(false)
    if (!ok) return
    if (mode === 'signup') {
      setNotice('Check your email to confirm your account, then sign in.')
      return
    }
    setEmail('')
    setPassword('')
    onClose()
  }

  const disabled = busy || !email || !password

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[16px] font-semibold text-soft">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </span>
          <span className="text-[12px] text-muted">
            Sync your workouts across devices
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-tile"
        >
          <X size={15} color="#A1A1AA" />
        </button>
      </div>

      {auth.user ? (
        <div className="mt-5 flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-[14px] bg-field px-3 py-3">
            <Avatar initials={initialsOf(auth.user.email ?? 'You')} size={36} />
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-semibold text-ink">{auth.user.email}</span>
              <span className="text-[12px] text-faint">Signed in</span>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await auth.signOut()
              onClose()
            }}
            className="h-11 rounded-[14px] bg-accent/15 text-[14px] font-semibold text-accent"
          >
            Sign out
          </button>
        </div>
      ) : !isSupabaseEnabled ? (
        <p className="mt-5 text-[13px] leading-relaxed text-faint">
          Accounts are disabled in this build. Set the Supabase environment
          variables to enable cross-device sync and the live leaderboard.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="h-11 rounded-[12px] bg-field px-3 text-[14px] text-ink outline outline-1 outline-white/10 placeholder:text-faint"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            className="h-11 rounded-[12px] bg-field px-3 text-[14px] text-ink outline outline-1 outline-white/10 placeholder:text-faint"
          />

          {auth.error && (
            <span className="text-[12px] text-[#FF7A7D]">{auth.error}</span>
          )}
          {notice && <span className="text-[12px] text-good">{notice}</span>}

          <button
            type="submit"
            disabled={disabled}
            className="mt-1 h-11 rounded-[14px] bg-accent text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setNotice(null)
            }}
            className="text-[12px] text-muted"
          >
            {mode === 'signin'
              ? 'No account yet? Create one'
              : 'Already have an account? Sign in'}
          </button>
        </form>
      )}
    </Modal>
  )
}
