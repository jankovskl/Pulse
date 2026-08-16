import { useEffect, useRef, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useNav } from './ui'

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Pulse! 💪',
    description: 'Let\'s take a quick tour to get you started with your fitness journey.',
    target: null,
    position: 'center',
    tab: 'home',
  },
  {
    id: 'home-split',
    title: 'Your Workout Split',
    description: 'Create your workout days here. Each day can have multiple exercises targeting different muscle groups.',
    target: '[data-tutorial="home-split"]',
    position: 'top',
    tab: 'home',
  },
  {
    id: 'home-calendar',
    title: 'Weekly Calendar',
    description: 'See your week at a glance. Tap any day to schedule a workout from your split.',
    target: '[data-tutorial="home-week"]',
    position: 'top',
    tab: 'home',
  },
  {
    id: 'timer-ring',
    title: 'Rest Timer',
    description: 'Tap the ring to start timing your rest between sets. The circle fills up as time counts down.',
    target: '[data-tutorial="timer-ring"]',
    position: 'top',
    tab: 'timer',
  },
  {
    id: 'timer-presets',
    title: 'Quick Presets',
    description: 'Use preset buttons (30s, 60s, 90s, 2m, 3m) to instantly start common rest periods.',
    target: '[data-tutorial="timer-presets"]',
    position: 'top',
    tab: 'timer',
  },
  {
    id: 'progress-charts',
    title: 'Track Your Progress',
    description: 'View interactive charts showing your strength gains over time. See your PRs and workout history.',
    target: '[data-tutorial="progress-chart"]',
    position: 'top',
    tab: 'progress',
  },
  {
    id: 'leaderboard-compete',
    title: 'Compete & Connect',
    description: 'See top lifters in each exercise. Click profiles to view their stats and live workout status.',
    target: '[data-tutorial="leaderboard-top3"]',
    position: 'top',
    tab: 'leaderboard',
  },
  {
    id: 'leaderboard-status',
    title: 'Live Workout Status',
    description: 'When someone is working out, you\'ll see a 🟡 pulsing indicator showing their current exercise and progress in real-time!',
    target: '[data-tutorial="leaderboard-list"]',
    position: 'top',
    tab: 'leaderboard',
  },
  {
    id: 'calendar-plan',
    title: 'Plan Your Week',
    description: 'Schedule your workout days on the calendar. Tap any date to assign a workout from your split.',
    target: '[data-tutorial="calendar-grid"]',
    position: 'top',
    tab: 'calendar',
  },
  {
    id: 'calendar-streak',
    title: 'Track Consistency',
    description: 'See your training streak and patterns. Consistency is key to reaching your goals!',
    target: '[data-tutorial="calendar-grid"]',
    position: 'top',
    tab: 'calendar',
  },
  {
    id: 'settings-profile',
    title: 'Customize Your Profile',
    description: 'Set your nickname, avatar, and bio. Unlock badges and decorations by hitting milestones!',
    target: '[data-tutorial="settings-profile"]',
    position: 'top',
    tab: 'settings',
  },
  {
    id: 'settings-theme',
    title: 'Choose Your Theme',
    description: 'Pick your favorite color scheme and switch between light/dark mode.',
    target: '[data-tutorial="settings-theme"]',
    position: 'top',
    tab: 'settings',
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🎉',
    description: 'Start by creating your first workout day in the Home tab. Track your progress, compete with others, and crush your goals!',
    target: null,
    position: 'center',
    tab: 'home',
  },
]

export default function Tutorial({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [show, setShow] = useState(false)
  const [targetRect, setTargetRect] = useState(null)
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 })
  const tooltipRef = useRef(null)
  const nav = useNav()

  const step = TUTORIAL_STEPS[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === TUTORIAL_STEPS.length - 1

  useEffect(() => {
    // Animate in
    setTimeout(() => setShow(true), 100)
  }, [])

  useEffect(() => {
    // Navigate to the tab for this step
    if (step.tab && nav.name !== step.tab) {
      nav.go(step.tab)
    }
  }, [step.tab, nav])

  useEffect(() => {
    if (!step.target) {
      setTargetRect(null)
      return
    }

    function measureTarget() {
      const element = document.querySelector(step.target)
      if (!element) return
      const rect = element.getBoundingClientRect()
      setTargetRect(rect)
    }

    // Initial measure after navigation settles, then scroll it into view
    const timeout = setTimeout(() => {
      const element = document.querySelector(step.target)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      measureTarget()
    }, 300)

    // Re-measure on resize / scroll so the spotlight and tooltip stay correct
    function onResize() {
      measureTarget()
    }
    function onScroll() {
      measureTarget()
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)

    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [step.target, currentStep])

  useEffect(() => {
    if (!tooltipRef.current) return
    const el = tooltipRef.current
    function update() {
      setTooltipSize({ width: el.offsetWidth, height: el.offsetHeight })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [currentStep, show])

  const handleNext = () => {
    if (isLast) {
      handleComplete()
    } else {
      setShow(false)
      setTimeout(() => {
        setCurrentStep(currentStep + 1)
        setShow(true)
      }, 200)
    }
  }

  const handleSkip = () => {
    handleComplete()
  }

  const handleComplete = () => {
    setShow(false)
    setTimeout(() => {
      nav.go('home')
      onComplete()
    }, 200)
  }

  const getTooltipPosition = () => {
    // Center-positioned steps (welcome / complete) or steps with no target
    if (!targetRect || step.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    const vw = window.innerWidth
    const vh = window.innerHeight
    const padding = 16 // gap between highlighted element and tooltip
    const tooltipW = tooltipSize.width || Math.min(vw * 0.9, 400)
    const tooltipH = tooltipSize.height || 180
    // Mobile has the sticky tab dock at the bottom; keep tooltip clear of it
    const bottomSafe = vw < 768 ? 72 : 8
    const topSafe = 8

    const centerX = targetRect.left + targetRect.width / 2
    const spaceBelow = vh - targetRect.bottom - bottomSafe
    const spaceAbove = targetRect.top - topSafe

    let top, transform
    // Prefer placing below the element, then above, then fall back to center
    if (tooltipH + padding <= spaceBelow) {
      top = targetRect.bottom + padding
      transform = 'translateX(-50%)'
    } else if (tooltipH + padding <= spaceAbove) {
      top = targetRect.top - padding
      transform = 'translate(-50%, -100%)'
    } else {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    // Keep the tooltip inside the viewport horizontally
    const left = Math.max(
      tooltipW / 2 + 8,
      Math.min(vw - tooltipW / 2 - 8, centerX),
    )

    return { top: `${top}px`, left: `${left}px`, transform }
  }

  return (
    <>
      {/* Dimmed overlay with a spotlight cutout around the target so it stays
          fully visible on mobile instead of sitting behind a dark sheet. */}
      {targetRect ? (
        <>
          <div
            className="fixed left-0 right-0 top-0 z-[100] bg-black/60 transition-opacity duration-300"
            style={{ height: targetRect.top, opacity: show ? 1 : 0 }}
            onClick={handleSkip}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[100] bg-black/60 transition-opacity duration-300"
            style={{ top: targetRect.bottom, opacity: show ? 1 : 0 }}
            onClick={handleSkip}
          />
          <div
            className="fixed left-0 z-[100] bg-black/60 transition-opacity duration-300"
            style={{ top: targetRect.top, width: targetRect.left, height: targetRect.height, opacity: show ? 1 : 0 }}
            onClick={handleSkip}
          />
          <div
            className="fixed right-0 z-[100] bg-black/60 transition-opacity duration-300"
            style={{ top: targetRect.top, width: `calc(100% - ${targetRect.right}px)`, height: targetRect.height, opacity: show ? 1 : 0 }}
            onClick={handleSkip}
          />
          <div
            className="fixed z-[101] rounded-[12px] outline outline-4 outline-accent pointer-events-none"
            style={{
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
            }}
          />
        </>
      ) : (
        <div
          className={`fixed inset-0 z-[100] bg-black transition-opacity duration-300 ${
            show ? 'opacity-60' : 'opacity-0'
          }`}
          onClick={handleSkip}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`fixed z-[102] w-[90%] max-w-[400px] transition-all duration-300 ${
          show ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={getTooltipPosition()}
      >
        <div className="flex flex-col gap-4 rounded-[24px] bg-field p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-[20px] font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-sub">{step.description}</p>
            </div>
            <button
              onClick={handleSkip}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tile"
            >
              <X size={16} color="var(--color-sub)" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1">
              {TUTORIAL_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentStep
                      ? 'w-6 bg-accent'
                      : idx < currentStep
                        ? 'w-1.5 bg-good'
                        : 'w-1.5 bg-line/20'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              {!isFirst && !isLast && (
                <button
                  onClick={handleSkip}
                  className="flex h-10 items-center justify-center rounded-full px-5 text-[14px] font-medium text-sub"
                >
                  Skip
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-semibold text-white"
              >
                {isLast ? 'Get Started' : isFirst ? "Let's Go" : 'Next'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}


