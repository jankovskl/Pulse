// GitHub-style sleep contribution graph.
// - Embedded view: ~22 weeks centered on today (no scroll)
// - Cells are colored by the night's sleep score, not raw hours — the same
//   red→green gradient as the hero score bar (see sleepColor in sleepUtils)
// - Tapping a day opens the sleep log sheet
// - No full-year toggle

import { useEffect, useMemo, useRef, useState } from 'react'
import { dateKey } from '../lib/data'
import { sleepColor, weekOf } from '../screens/sleepUtils'

export function getSleepColor(hours) {
  if (hours === undefined || hours <= 0) return null
  if (hours < 4) return 'rgba(14,68,41,1)'
  if (hours < 6) return 'rgba(0,109,50,1)'
  if (hours < 8) return 'rgba(38,166,65,1)'
  return 'rgba(57,211,83,1)'
}

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_LABELS = ['Mon','','Wed','','Fri','','']

// --- Snake mini-game helpers -------------------------------------------------
// A snake hides in one random heatmap cell, disguised as an apple; tapping it
// starts a game played directly on the grid (week columns × day rows).
// Best score is device-local.
const SNAKE_BEST_KEY = 'pulse.snakeBest'
const SNAKE_ROWS = 7

function rand(n) { return Math.floor(Math.random() * n) }
function keyOf(x, y) { return `${x},${y}` }
function readSnakeBest() {
  try {
    const n = Number(localStorage.getItem(SNAKE_BEST_KEY))
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch { return 0 }
}
// Random cell not occupied by the snake; null when the board is full (win).
function freeCell(cols, rows, occupied) {
  const free = []
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      if (!occupied.has(keyOf(x, y))) free.push({ x, y })
    }
  }
  return free.length ? free[rand(free.length)] : null
}

function buildYearMatrix(year, sleepMap, scoreMap) {
  const weeks = []
  const jan1 = new Date(year, 0, 1)
  const start = new Date(jan1)
  const dow = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - dow)

  let week = Array.from({ length: 7 }, () => null)
  let dayInWeek = 0
  let iter = new Date(start)

  while (iter.getFullYear() <= year || dayInWeek < 6) {
    const key = dateKey(iter)
    week[dayInWeek] = {
      key,
      date: new Date(iter),
      hours: iter.getFullYear() === year ? sleepMap[key] : undefined,
      score: iter.getFullYear() === year ? scoreMap?.[key] : undefined,
    }
    dayInWeek++
    iter.setDate(iter.getDate() + 1)
    if (dayInWeek === 7) {
      weeks.push(week)
      week = Array.from({ length: 7 }, () => null)
      dayInWeek = 0
    }
    if (iter.getFullYear() > year && dayInWeek === 0 && weeks.length > 0) break
  }
  return weeks
}

function labelMonths(weeks, year) {
  if (!weeks?.length) return []
  const labels = []
  for (let w = 0; w < weeks.length; w++) {
    const firstDate = weeks[w]?.find(c => c?.date?.getFullYear() === year)?.date
    if (!firstDate) { labels.push(null); continue }
    const m = firstDate.getMonth()
    const prev = w > 0 ? (weeks[w-1]?.find(c => c?.date?.getFullYear() === year)?.date?.getMonth() ?? -1) : -1
    labels.push(m !== prev ? MONTH_ABBR[m] : null)
  }
  return labels
}

function DayLabels({ cellSize }) {
  return (
    <div className="flex flex-col justify-between pr-1" style={{ height: cellSize * 7 + 18 }}>
      {DAY_LABELS.map((label, i) => (
        <div key={i} style={{ height: cellSize, fontSize: cellSize - 4 }} className="text-faint">
          {label}
        </div>
      ))}
    </div>
  )
}

function MonthLabels({ labels, cellSize }) {
  return (
    <div className="flex" style={{ paddingLeft: 28 }}>
      <div className="flex" style={{ gap: 3 }}>
        {labels.map((label, i) => (
          <div key={i} style={{ width: cellSize, fontSize: cellSize - 3 }} className="text-center text-faint">
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

function WeekColumns({ weeks, cellSize, gap, todayKey, overlay }) {
  return (
    <div className="flex" style={{ gap }}>
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col" style={{ gap }}>
          {week.map((cell, di) => {
            if (!cell) return <div key={di} style={{ width: cellSize, height: cellSize, background: 'var(--color-tile)' }} />
            const isToday = cell.key === todayKey
            // Color by the night's sleep score (0–100) on the shared
            // red→green gradient; falls back to hours-color for legacy data.
            const baseBg = cell.score != null ? sleepColor(cell.score) : getSleepColor(cell.hours)
            const title = cell.hours != null
              ? `${cell.hours}h · score ${cell.score != null ? cell.score : '—'}`
              : 'No data'
            // Snake overlay: the hidden apple is the only per-cell marker;
            // the snake body itself is drawn as one smooth SVG path on top.
            const ck = `${wi},${di}`
            const isApple = overlay.playing && ck === overlay.appleKey
            const isHome = !overlay.playing && ck === overlay.hiddenKey
            const bg = baseBg ?? 'var(--color-tile)'
            return (
              <div
                key={cell.key}
                title={title}
                onClick={isHome ? overlay.onStart : undefined}
                className="rounded-[2px] flex items-center justify-center select-none"
                style={{
                  width: cellSize,
                  height: cellSize,
                  background: bg,
                  border: '1px solid transparent',
                  outline: isToday ? '1px solid var(--color-accent)' : undefined,
                  cursor: isHome ? 'pointer' : undefined,
                  fontSize: cellSize - 4,
                  lineHeight: 1,
                }}
              >
                {isApple || isHome ? '🍎' : null}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// Draws the snake as one continuous rounded body over the grid, like a
// pixel-art snake: dark outline, green fill, a dashed scale line down the
// middle, and a head with two eyes looking where it's going.
function SnakeOverlay({ snake, cellSize, gap, cols, rows }) {
  if (!snake || snake.length < 2) return null
  const step = cellSize + gap
  const pts = snake.map((c) => [c.x * step + cellSize / 2, c.y * step + cellSize / 2])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')
  const [hx, hy] = pts[0]
  // Facing direction from head toward the neck (unit axis vector).
  const dx = Math.sign(pts[0][0] - pts[1][0])
  const dy = Math.sign(pts[0][1] - pts[1][1])
  const px = -dy // perpendicular axis for the eyes
  const py = dx
  const eyes = [
    [hx + dx * 1.5 + px * 2.4, hy + dy * 1.5 + py * 2.4],
    [hx + dx * 1.5 - px * 2.4, hy + dy * 1.5 - py * 2.4],
  ]
  const width = cols * step - gap
  const height = rows * step - gap
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      {/* outline */}
      <path d={d} fill="none" stroke="#1e4d40" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
      {/* body */}
      <path d={d} fill="none" stroke="#9fbe55" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      {/* scale hint */}
      <path d={d} fill="none" stroke="#7da244" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1.5 3.5" />
      {/* head */}
      <circle cx={hx} cy={hy} r={6} fill="#9fbe55" stroke="#1e4d40" strokeWidth={2} />
      {eyes.map(([ex, ey], i) => (
        <circle key={i} cx={ex} cy={ey} r={1.4} fill="#fff" />
      ))}
    </svg>
  )
}

function Legend({ cellSize = 12, weekAvg, width }) {
  // Same red→green score gradient as the cells themselves (0/33/67/100).
  // Right side shows the running week average, divided only by the days
  // elapsed so far this week — upcoming days never drag the number down.
  // The row is capped at the grid's width (width prop) so the average text
  // ends flush with the last day column instead of running off the edge.
  return (
    <div className="flex items-center justify-between mt-2" style={{ width }}>
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-faint">Low</span>
        {[0, 33, 67, 100].map((score, i) => (
          <div key={i} style={{ width: cellSize - 2, height: cellSize - 2, background: sleepColor(score) }} className="rounded-[2px]" />
        ))}
        <span className="text-[9px] text-faint">High</span>
      </div>
      <span className="text-[10px] text-faint tabular-nums">Avg {weekAvg}h this week</span>
    </div>
  )
}

export default function SleepCalendar({ sleepMap, scoreMap }) {
  const year = new Date().getFullYear()
  const todayKey = dateKey(new Date())

  const allWeeks = useMemo(() => buildYearMatrix(year, sleepMap, scoreMap), [year, sleepMap, scoreMap])
  const allMonthLabels = useMemo(() => labelMonths(allWeeks, year), [allWeeks, year])

  // Running average for the current Mon–Sun week: sum the logged hours and
  // divide by the days elapsed so far (Mon through today), so a week that
  // just started isn't diluted by days that haven't happened yet. Unlogged
  // elapsed nights still count as 0h.
  const weekAvg = useMemo(() => {
    const now = new Date()
    const elapsed = (now.getDay() + 6) % 7 + 1
    const days = weekOf(now).slice(0, elapsed)
    const total = days.reduce((sum, d) => sum + (sleepMap?.[dateKey(d)] ?? 0), 0)
    return Math.round((total / elapsed) * 10) / 10
  }, [sleepMap])

  // Centered on today: 22 weeks (computed unconditionally — see hook rules)
  const todayWi = useMemo(() => {
    if (allWeeks.length === 0) return 0
    const tk = dateKey(new Date())
    for (let w = 0; w < allWeeks.length; w++) {
      if (allWeeks[w]?.find(c => c?.key === tk)) return w
    }
    return Math.floor(allWeeks.length / 2)
  }, [allWeeks])

  const viewWidth = 22

  const startWeek = Math.max(0, Math.min(allWeeks.length - viewWidth, todayWi - Math.floor(viewWidth / 2)))
  const endWeek = Math.min(allWeeks.length, startWeek + viewWidth)
  const weeks = allWeeks.slice(startWeek, endWeek)
  const monthLabels = allMonthLabels.slice(startWeek, endWeek)

  // Legend width = day-label gutter (28, same constant MonthLabels uses)
  // + visible week columns, so it spans exactly the grid and nothing beyond.
  const legendWidth = 28 + weeks.length * 12 + (weeks.length - 1) * 3

  // --- Snake mini-game state ---
  // game: { snake: [{x,y}...] (head first), apple: {x,y}|null, score, status }
  const cols = weeks.length
  const [hiddenKey, setHiddenKey] = useState(null)
  const [game, setGame] = useState(null)
  const [snakeBest, setSnakeBest] = useState(readSnakeBest)
  const dirRef = useRef({ x: 1, y: 0 })
  const queueRef = useRef([])
  const touchRef = useRef(null)
  const stepRef = useRef(() => {})

  const playing = game?.status === 'playing'

  // Hide the snake in a random visible cell once per mount (kept ≥2 columns
  // off the edges so the starting body of three always fits). When a game
  // ends and the state clears, this re-hides it somewhere new.
  useEffect(() => {
    if (hiddenKey || game || cols < 5) return
    setHiddenKey(keyOf(2 + rand(Math.max(1, cols - 4)), rand(SNAKE_ROWS)))
  }, [hiddenKey, game, cols])

  // Buffer direction changes (max 2 taps ahead); a 180° reversal is dropped
  // against the last queued direction, not just the current one.
  function queueDir(d) {
    const last = queueRef.current[queueRef.current.length - 1] || dirRef.current
    if (d.x === last.x && d.y === last.y) return
    if (d.x === -last.x && d.y === -last.y) return
    if (queueRef.current.length < 2) queueRef.current.push(d)
  }

  function step() {
    setGame((g) => {
      if (!g || g.status !== 'playing') return g
      let dir = dirRef.current
      while (queueRef.current.length) {
        const next = queueRef.current.shift()
        if (!(next.x === -dir.x && next.y === -dir.y)) { dir = next; break }
      }
      dirRef.current = dir
      const head = { x: g.snake[0].x + dir.x, y: g.snake[0].y + dir.y }
      // The panel edges are walls.
      if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= SNAKE_ROWS) {
        return { ...g, status: 'over' }
      }
      const ate = g.apple && head.x === g.apple.x && head.y === g.apple.y
      const body = ate ? g.snake : g.snake.slice(0, -1)
      if (body.some((c) => c.x === head.x && c.y === head.y)) {
        return { ...g, status: 'over' }
      }
      const snake = [head, ...body]
      if (!ate) return { ...g, snake }
      const apple = freeCell(cols, SNAKE_ROWS, new Set(snake.map((c) => keyOf(c.x, c.y))))
      // Board completely filled counts as a win — same game-over screen.
      return { ...g, snake, apple, score: g.score + 1, status: apple ? 'playing' : 'over' }
    })
  }
  stepRef.current = step

  // Tick speeds up every 5 apples, floored so it stays humanly playable.
  const tickMs = playing ? Math.max(80, 140 - Math.floor(game.score / 5) * 10) : null
  useEffect(() => {
    if (!tickMs) return
    const id = setInterval(() => stepRef.current(), tickMs)
    return () => clearInterval(id)
  }, [tickMs])

  // Persist a new best score device-locally.
  useEffect(() => {
    if (game?.status === 'over' && game.score > snakeBest) {
      setSnakeBest(game.score)
      try { localStorage.setItem(SNAKE_BEST_KEY, String(game.score)) } catch { /* private mode */ }
    }
  }, [game, snakeBest])

  // Arrow keys / WASD steer on desktop.
  useEffect(() => {
    if (!playing) return
    const DIRS = {
      ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 },
    }
    function onKey(e) {
      const d = DIRS[e.code]
      if (!d) return
      e.preventDefault()
      queueDir(d)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing])

  // Swipe steering on touch devices (touch-action:none blocks scrolling).
  function onTouchStart(e) {
    if (!playing) return
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY }
  }
  function onTouchEnd(e) {
    if (!playing || !touchRef.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchRef.current.x
    const dy = t.clientY - touchRef.current.y
    touchRef.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    queueDir(Math.abs(dx) > Math.abs(dy)
      ? { x: Math.sign(dx), y: 0 }
      : { x: 0, y: Math.sign(dy) })
  }

  function startGame(spawnKey) {
    const key = spawnKey ?? hiddenKey
    if (!key || cols < 5) return
    const [x, y] = key.split(',').map(Number)
    // Head toward the farther half of the board so the body fits behind it.
    const dir = x < cols / 2 ? { x: 1, y: 0 } : { x: -1, y: 0 }
    const snake = Array.from({ length: 3 }, (_, i) => ({ x: x - dir.x * i, y }))
    dirRef.current = dir
    queueRef.current = []
    const apple = freeCell(cols, SNAKE_ROWS, new Set(snake.map((c) => keyOf(c.x, c.y))))
    setHiddenKey(null)
    setGame({ snake, apple, score: 0, status: 'playing' })
  }

  // Closing the game clears state; the effect above re-hides the snake.
  function endGame() { setGame(null) }

  // Early return only after every hook above has run (rules of hooks).
  if (allWeeks.length === 0) {
    return <div className="text-center py-4 text-faint text-[12px]">No sleep data yet</div>
  }

  const appleKey = game?.apple ? keyOf(game.apple.x, game.apple.y) : null

  return (
    <div className="flex flex-col gap-2">
      {playing && (
        <div className="flex items-center justify-between text-[10px] text-faint tabular-nums" style={{ width: legendWidth }}>
          <span>🍎 {game.score}</span>
          <span>Best {Math.max(snakeBest, game.score)}</span>
        </div>
      )}
      <div
        className="relative flex flex-col gap-1"
        style={{ touchAction: playing ? 'none' : undefined }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <MonthLabels labels={monthLabels} cellSize={12} />
        <div className="flex">
          <DayLabels cellSize={12} />
          <div className="relative">
            <WeekColumns
              weeks={weeks}
              cellSize={12}
              gap={3}
              todayKey={todayKey}
              overlay={{ playing, appleKey, hiddenKey, onStart: () => startGame() }}
            />
            {playing && <SnakeOverlay snake={game.snake} cellSize={12} gap={3} cols={weeks.length} rows={SNAKE_ROWS} />}
          </div>
        </div>
        {game?.status === 'over' && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[8px]"
            style={{ background: 'color-mix(in srgb, var(--color-bg) 80%, transparent)', backdropFilter: 'blur(3px)' }}
          >
            <span className="text-[13px] font-semibold text-soft">Game over · {game.score} 🍎</span>
            <span className="text-[10px] text-faint">Best {Math.max(snakeBest, game.score)}</span>
            <div className="flex gap-2">
              <button
                onClick={() => startGame(keyOf(2 + rand(Math.max(1, cols - 4)), rand(SNAKE_ROWS)))}
                className="h-8 rounded-[16px] bg-accent px-3.5 text-[12px] font-semibold text-white"
              >
                Play again
              </button>
              <button
                onClick={endGame}
                className="h-8 rounded-[16px] bg-tile px-3.5 text-[12px] text-soft"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
      <Legend cellSize={12} weekAvg={weekAvg} width={legendWidth} />
    </div>
  )
}