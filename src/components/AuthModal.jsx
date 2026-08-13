import { useEffect, useRef, useState } from 'react'
import { Pencil, Trash2, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { isSupabaseEnabled, supabase } from '../lib/supabase'
import { uploadAvatar, removeAvatar } from '../lib/profile'
import { Modal, Avatar, initialsOf } from './ui'

export default function AuthModal({ open, onClose }) {
  const auth = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const fileRef = useRef(null)
  const [nickname, setNickname] = useState(auth.profile?.nickname ?? '')
  const [nickBusy, setNickBusy] = useState(false)
  const [nickOk, setNickOk] = useState(false)
  const [pfpBusy, setPfpBusy] = useState(false)
  const [pfpError, setPfpError] = useState(null)
  const [pfpRemoveBusy, setPfpRemoveBusy] = useState(false)
  const [pfpMenuOpen, setPfpMenuOpen] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)
  const pwMismatch = showPw && confirmPassword.length > 0 && newPassword !== confirmPassword

  useEffect(() => {
    setNickname(auth.profile?.nickname ?? '')
    setNickOk(false)
  }, [auth.profile])

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPfpBusy(true)
    setPfpError(null)
    try {
      const url = await uploadAvatar(supabase, auth.user.id, file)
      await auth.updateProfile({ pfp: url })
    }        catch (err) {
      setPfpError(err.message || 'Upload failed.')
    } finally {
      setPfpBusy(false)
    }
  }

  async function removePfp() {
    if (!supabase || !auth.user) return
    setPfpRemoveBusy(true)
    setPfpError(null)
    try {
      await removeAvatar(supabase, auth.user.id)
      await auth.updateProfile({ pfp: null })
    } catch (err) {
      setPfpError(err.message || 'Could not remove photo.')
    } finally {
      setPfpRemoveBusy(false)
    }
  }

  async function saveNick() {
    setNickBusy(true)
    setNickOk(false)
    const ok = await auth.updateProfile({ nickname: nickname.trim() })
    setNickBusy(false)
    setNickOk(ok)
  }

  async function savePw() {
    setPwBusy(true)
    setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwBusy(false)
    setPwMsg(error ? error.message : 'Password updated.')
    if (!error) {
      setNewPassword('')
      setConfirmPassword('')
    }
  }

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
            {auth.user ? 'Account' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </span>
          <span className="text-[12px] text-muted">
            Sync your workouts across devices
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-tile"
        >
          <X size={15} color="var(--color-sub)" />
        </button>
      </div>

      {auth.user ? (
        <div className="mt-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-[14px] bg-field px-3 py-3">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPfpMenuOpen((v) => !v)}
                className="relative shrink-0 rounded-full outline-none"
                aria-label="Profile photo"
                title={auth.profile?.pfp ? 'Tap to change or remove photo' : 'Set profile photo'}
              >
                {pfpBusy && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-overlay">
                    <span className="animate-spin text-[10px] text-white">…</span>
                  </span>
                )}
                <Avatar
                  initials={initialsOf(auth.profile?.nickname || auth.user.email || 'You')}
                  src={auth.profile?.pfp || null}
                  size={44}
                />
              </button>

              {pfpMenuOpen && (
                <>
                  <button
                    type="button"
                    onClick={() => setPfpMenuOpen(false)}
                    className="fixed inset-0 z-40"
                    aria-hidden="true"
                  />
                  <div className="absolute top-1/2 left-full -translate-y-1/2 z-50 ml-2 w-40 rounded-[14px] bg-card py-1.5 shadow-[0px_8px_24px_0px_#00000059] outline outline-1 outline-line/10">
                    <button
                      type="button"
                      onClick={() => {
                        setPfpMenuOpen(false)
                        fileRef.current?.click()
                      }}
                      disabled={pfpBusy || pfpRemoveBusy}
                      className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2 text-left text-[13px] text-ink hover:bg-accent/10 disabled:opacity-50"
                    >
                      <Pencil size={14} color="var(--color-accent)" />
                      Change photo
                    </button>
                    {auth.profile?.pfp && (
                      <button
                        type="button"
                        onClick={() => {
                          setPfpMenuOpen(false)
                          void removePfp()
                        }}
                        disabled={pfpRemoveBusy}
                        className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2 text-left text-[13px] text-ink hover:bg-[#DB3B3E]/10 disabled:opacity-50"
                      >
                        <Trash2 size={14} color="#DB3B3E" />
                        Remove photo
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-semibold text-ink">
                {auth.profile?.nickname || auth.user.email}
              </span>
              <span className="text-[12px] text-faint">{auth.user.email}</span>
            </div>
          </div>

          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[1px] text-muted">NICKNAME</span>
            <div className="flex gap-2">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Display name"
                maxLength={24}
                className="h-11 flex-1 rounded-[12px] bg-field px-3 text-[14px] text-ink outline outline-1 outline-line/10 placeholder:text-faint"
              />
              <button
                type="button"
                onClick={saveNick}
                disabled={nickBusy}
                className="h-11 rounded-[12px] bg-accent/15 px-4 text-[13px] font-semibold text-accent disabled:opacity-50"
              >
                {nickBusy ? '…' : 'Save'}
              </button>
            </div>
            {nickOk && <span className="text-[11px] text-good">Saved</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[1px] text-muted">PASSWORD</span>
            {!showPw ? (
        <button
          type="button"
          onClick={() => setShowPw(true)}
          className="h-12 w-full rounded-[14px] bg-accent text-center text-[15px] font-bold text-white"
        >
          Change password
        </button>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  className="h-11 rounded-[12px] bg-field px-3 text-[14px] text-ink outline outline-1 outline-line/10 placeholder:text-faint"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className="h-11 rounded-[12px] bg-field px-3 text-[14px] text-ink outline outline-1 outline-line/10 placeholder:text-faint"
                />
                {pwMismatch && (
                  <span className="text-[12px] text-[#FF7A7D]">Passwords don't match</span>
                )}
                <button
                  type="button"
                  onClick={savePw}
                  disabled={
                    pwBusy ||
                    !newPassword ||
                    !confirmPassword ||
                    newPassword !== confirmPassword
                  }
                  className="h-11 rounded-[14px] bg-accent text-[14px] font-semibold text-white disabled:opacity-50"
                >
                  {pwBusy ? 'Please wait…' : 'Update password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPw(false)
                    setPwMsg(null)
                    setNewPassword('')
                    setConfirmPassword('')
                  }}
                  className="self-start text-[12px] text-muted"
                >
                  Cancel
                </button>
                {pwMsg && (
                  <span className={newPassword || pwMismatch ? 'text-[12px] text-[#FF7A7D]' : 'text-[12px] text-good'}>
                    {pwMsg}
                  </span>
                )}
              </div>
            )}
          </div>

          {pfpError && <span className="text-[12px] text-[#FF7A7D]">{pfpError}</span>}
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
            className="h-11 rounded-[12px] bg-field px-3 text-[14px] text-ink outline outline-1 outline-line/10 placeholder:text-faint"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            className="h-11 rounded-[12px] bg-field px-3 text-[14px] text-ink outline outline-1 outline-line/10 placeholder:text-faint"
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
