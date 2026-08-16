import { useEffect, useRef, useState } from 'react'
import { Camera, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { uploadAvatar, removeAvatar } from '../lib/profile'
import { Avatar, initialsOf } from './ui'
import AvatarCropper from './AvatarCropper'

// Decodes formats the browser can't draw natively (HEIC/HEIF from iPhones)
// into a JPEG blob; everything else passes through untouched. heic2any is
// loaded lazily so it only costs bandwidth when actually needed.
async function normalizeImage(file) {
  const name = (file.name || '').toLowerCase()
  const isHeic = /heic|heif/i.test(file.type || '') || name.endsWith('.heic') || name.endsWith('.heif')
  if (isHeic) {
    const heic2any = (await import('heic2any')).default
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
    return Array.isArray(out) ? out[0] : out
  }
  return file
}

// Account editor: avatar, nickname and password. Shared by the Settings
// "Customize profile" view and the Auth modal. Requires a signed-in user.
export default function AccountEditor() {
  const auth = useAuth()
  const fileRef = useRef(null)
  const [nickname, setNickname] = useState(auth.profile?.nickname ?? '')
  const [nickBusy, setNickBusy] = useState(false)
  const [nickOk, setNickOk] = useState(false)
  const [pfpBusy, setPfpBusy] = useState(false)
  const [pfpError, setPfpError] = useState(null)
  const [pfpRemoveBusy, setPfpRemoveBusy] = useState(false)
  const [pfpMenuOpen, setPfpMenuOpen] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)
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

  if (!auth.user) return null

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPfpError(null)
    try {
      const blob = await normalizeImage(file)
      setCropSrc((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(blob)
      })
    } catch {
      setPfpError('Could not read that image — try a different format.')
    }
  }

  function closeCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  async function onCropConfirm(blob) {
    closeCrop()
    setPfpBusy(true)
    setPfpError(null)
    try {
      const url = await uploadAvatar(supabase, auth.user.id, blob)
      await auth.updateProfile({ pfp: url })
    } catch (err) {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-[14px] bg-field px-3 py-3">
        <div className="relative shrink-0">
          {pfpBusy && (
            <span className="absolute inset-0 z-10 flex items-center justify-center rounded-full bg-overlay">
              <span className="animate-spin text-[10px] text-white">…</span>
            </span>
          )}
          <Avatar
            initials={initialsOf(auth.profile?.nickname || auth.user.email || 'You')}
            src={auth.profile?.pfp || null}
            size={44}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[14px] font-semibold text-ink">
            {auth.profile?.nickname || auth.user.email}
          </span>
          <span className="truncate text-[12px] text-faint">{auth.user.email}</span>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setPfpMenuOpen((v) => !v)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-accent/15 px-3 text-[12px] font-semibold text-accent"
            title={auth.profile?.pfp ? 'Change or remove photo' : 'Set profile photo'}
          >
            <Camera size={13} color="var(--color-accent)" />
            Photo
          </button>

          {pfpMenuOpen && (
            <>
              <button
                type="button"
                onClick={() => setPfpMenuOpen(false)}
                className="fixed inset-0 z-40"
                aria-hidden="true"
              />
              <div className="glass-panel absolute right-0 top-full z-50 mt-2 w-40 rounded-[14px] bg-card py-1.5 shadow-[0px_8px_24px_0px_#00000059] outline outline-1 outline-line/10">
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
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,image/svg+xml,.heic,.heif"
        hidden
        onChange={onFile}
      />

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

      {cropSrc && (
        <AvatarCropper
          src={cropSrc}
          busy={pfpBusy}
          onConfirm={onCropConfirm}
          onCancel={closeCrop}
        />
      )}
    </div>
  )
}
