import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Sparkles, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { compareVersions } from '../lib/changelog'
import { BUNDLED_ENTRIES, loadChangelog } from '../lib/changelog-bundled'
import { TUTORIAL_STEPS, newStepsSince } from '../lib/tutorialSteps'
import { getAcknowledged, setAcknowledged, setSeenNews, startWhatsNewTour } from '../lib/tutorial'
import { WHATS_NEW_ITEMS, UNRELEASED, itemsForVersion } from '../lib/whatsNew'
import { Modal } from './ui'

// The one What's new screen (see ADR 0009): App pops it up when the bundled
// notes changed since the last dismissal, Settings opens it on demand.
// Content is visual cards — icon, headline, blurb — never raw changelog
// prose, with the full changelog collapsed underneath as "Past releases".
//
// Seeing means dismissing: the dismissal (Got it, X, Esc, tap-outside)
// records the notes' content fingerprint, so the popup returns on the next
// launch only if the news itself changed again. Force-quitting mid-read
// shows it again, because nothing was recorded.
//
// Two shapes of news, often at once: staged items (`since: UNRELEASED`) are
// what just landed and rides the next cut; the released group is what the
// device missed since its acknowledged version. Staged leads when present.

const CARD_LIMIT = 5

function Card({ item, onShowMe }) {
  return (
    <div className="flex gap-3 rounded-[16px] bg-tile p-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-accent/15 text-[17px]">
        {item.icon}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 leading-tight">
        <span className="text-[14px] font-semibold text-ink">{item.title}</span>
        <span className="text-[12px] text-sub">{item.body}</span>
        {item.image && (
          <img
            src={item.image}
            alt=""
            className="mt-2 w-full rounded-[12px] outline outline-1 outline-line/10"
          />
        )}
        {item.tutorial && (
          <button
            onClick={() => onShowMe(item.tutorial)}
            className="mt-2 flex h-7 w-fit items-center gap-1.5 rounded-full bg-accent/15 px-3 text-[12px] font-semibold text-accent-light"
          >
            <Sparkles size={12} />
            Show me
          </button>
        )}
      </div>
    </div>
  )
}

function MiniRow({ item }) {
  return (
    <div className="flex items-start gap-2 text-[12px] leading-snug text-soft">
      <span className="shrink-0">{item.icon}</span>
      <span>{item.title}</span>
    </div>
  )
}

function GroupLabel({ children }) {
  return <span className="text-[11px] font-semibold tracking-[1.4px] text-muted">{children}</span>
}

export default function WhatsNewScreen({ open, payload, onClose }) {
  const auth = useAuth()
  const [pastOpen, setPastOpen] = useState(false)
  const [changelog, setChangelog] = useState(null)
  const version = payload?.version ?? null

  const staged = useMemo(() => itemsForVersion(WHATS_NEW_ITEMS, UNRELEASED), [])
  const released = useMemo(
    () => (version ? itemsForVersion(WHATS_NEW_ITEMS, version) : []),
    [version],
  )
  const entry = useMemo(
    () => BUNDLED_ENTRIES.find((e) => e.version === version),
    [version],
  )

  // The device's state as it was when the screen opened: dismissing writes
  // the ack, and recomputing with post-dismiss values would gut the panel
  // mid exit-animation. Same snapshot pattern as the tour steps below.
  const [opening, setOpening] = useState(null)
  useEffect(() => {
    if (open) setOpening(getAcknowledged(auth.user?.id))
  }, [open, auth.user?.id])

  const tourSteps = useMemo(
    () => (open ? newStepsSince(TUTORIAL_STEPS, opening) : []),
    [open, opening],
  )

  // The released group only counts as news while its version is newer than
  // the acknowledged one — otherwise the change that re-fired the popup is
  // purely staged content, and replaying v-latest would be old news.
  const releasedIsNews =
    !!version && (opening == null || compareVersions(version, opening) > 0)

  const headline = staged.length ? staged : releasedIsNews ? released : []
  const cards = headline.slice(0, CARD_LIMIT)
  const overflow = headline.slice(CARD_LIMIT)
  const missed = staged.length && releasedIsNews ? released : []

  function dismiss() {
    if (version) setAcknowledged(auth.user?.id, version)
    if (payload?.fingerprint) setSeenNews(auth.user?.id, payload.fingerprint)
    onClose()
  }

  function launchTour(steps) {
    // The tour spotlights real UI, so the modal must be gone before it starts.
    dismiss()
    startWhatsNewTour(steps)
  }

  function showStep(id) {
    const step = TUTORIAL_STEPS.find((s) => s.id === id)
    if (step) launchTour([step])
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payload?.fingerprint, auth.user?.id])

  function togglePast() {
    const next = !pastOpen
    setPastOpen(next)
    // The live changelog is fetched lazily — the popup itself is fully
    // bundled (ADR 0009), history is the only thing that reaches the network.
    if (next && !changelog) loadChangelog().then(setChangelog)
  }

  if (!payload) return null

  return (
    <Modal open={open} onClose={dismiss}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[16px] font-semibold text-soft">What's new 🎉</span>
            <span className="text-[12px] text-muted">
              {version ? `v${version}` : 'First look'}
              {version && entry?.date ? ` · ${entry.date}` : ''}
            </span>
          </div>
          <button
            onClick={dismiss}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tile"
          >
            <X size={15} color="var(--color-sub)" />
          </button>
        </div>

        {staged.length > 0 && <GroupLabel>JUST LANDED</GroupLabel>}
        {cards.map((item, i) => (
          <Card key={i} item={item} onShowMe={showStep} />
        ))}
        {overflow.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-[16px] bg-tile/60 p-3.5">
            {overflow.map((item, i) => (
              <MiniRow key={i} item={item} />
            ))}
          </div>
        )}

        {missed.length > 0 && (
          <div className="flex flex-col gap-2">
            <GroupLabel>ALSO NEW IN v{version}</GroupLabel>
            <div className="flex flex-col gap-1.5 rounded-[16px] bg-tile/60 p-3.5">
              {missed.map((item, i) => (
                <MiniRow key={i} item={item} />
              ))}
            </div>
          </div>
        )}

        {tourSteps.length > 0 && (
          <button
            onClick={() => launchTour(tourSteps)}
            className="flex h-10 items-center justify-center gap-2 rounded-full bg-accent/15 px-5 text-[14px] font-semibold text-accent-light"
          >
            <Sparkles size={15} />
            Take the tour
          </button>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={togglePast}
            className="flex items-center justify-between rounded-[16px] bg-tile/60 px-3.5 py-2.5 text-left"
          >
            <span className="text-[13px] font-semibold text-sub">Past releases</span>
            <ChevronDown
              size={14}
              color="var(--color-muted)"
              style={{ transform: pastOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
            />
          </button>
          {pastOpen && (
            <div className="flex flex-col gap-4 px-1 pb-1">
              {!changelog ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-tile border-t-accent" />
                  <span className="text-[13px] text-sub">Loading…</span>
                </div>
              ) : (
                changelog.map((e) => (
                  <div key={e.version} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] font-semibold tracking-[1.4px] text-accent-light">
                        v{e.version}
                      </span>
                      {e.date && <span className="text-[11px] text-faint">{e.date}</span>}
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {e.items.map((line, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-soft">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <button
          onClick={dismiss}
          className="flex h-11 items-center justify-center rounded-full bg-accent px-5 text-[14px] font-semibold text-white"
        >
          Got it
        </button>
      </div>
    </Modal>
  )
}
