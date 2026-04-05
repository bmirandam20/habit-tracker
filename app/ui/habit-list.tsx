'use client'

import { useState, useTransition, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────
type Habit    = { id: string; name: string; emoji: string }
type WeekLog  = { habit_id: string; date: string }
type Particle = {
  id: number; x: number; y: number; color: string; size: number
  shape: 'circle' | 'rect'; dx: string; dy: string; rot: string; duration: number
}
type Props = {
  habits:       Habit[]
  completedIds: string[]
  today:        string
  weekLogs:     WeekLog[]
  last7Dates:   string[]
  streak:       number
}

// ── Constants ─────────────────────────────────────────────────────────────
const ACCENTS = [
  { color: '#10b981', bg: 'rgba(16,185,129,0.07)',  border: 'rgba(16,185,129,0.2)',  doneBg: 'rgba(16,185,129,0.13)',  doneBorder: 'rgba(16,185,129,0.38)',  glow: 'rgba(16,185,129,0.28)',  textDone: '#6ee7b7' },
  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.07)',  border: 'rgba(139,92,246,0.2)',  doneBg: 'rgba(139,92,246,0.13)', doneBorder: 'rgba(139,92,246,0.38)', glow: 'rgba(139,92,246,0.28)', textDone: '#c4b5fd' },
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.2)',  doneBg: 'rgba(245,158,11,0.13)',  doneBorder: 'rgba(245,158,11,0.38)',  glow: 'rgba(245,158,11,0.28)',  textDone: '#fcd34d' },
  { color: '#60a5fa', bg: 'rgba(96,165,250,0.07)',  border: 'rgba(96,165,250,0.2)',  doneBg: 'rgba(96,165,250,0.13)',  doneBorder: 'rgba(96,165,250,0.38)',  glow: 'rgba(96,165,250,0.28)',  textDone: '#93c5fd' },
  { color: '#f472b6', bg: 'rgba(244,114,182,0.07)', border: 'rgba(244,114,182,0.2)', doneBg: 'rgba(244,114,182,0.13)', doneBorder: 'rgba(244,114,182,0.38)', glow: 'rgba(244,114,182,0.28)', textDone: '#f9a8d4' },
  { color: '#2dd4bf', bg: 'rgba(45,212,191,0.07)',  border: 'rgba(45,212,191,0.2)',  doneBg: 'rgba(45,212,191,0.13)',  doneBorder: 'rgba(45,212,191,0.38)',  glow: 'rgba(45,212,191,0.28)',  textDone: '#99f6e4' },
  { color: '#fb923c', bg: 'rgba(251,146,60,0.07)',  border: 'rgba(251,146,60,0.2)',  doneBg: 'rgba(251,146,60,0.13)',  doneBorder: 'rgba(251,146,60,0.38)',  glow: 'rgba(251,146,60,0.28)',  textDone: '#fdba74' },
]

const CONFETTI_COLORS = [
  '#10b981','#34d399','#6ee7b7','#fbbf24','#f59e0b',
  '#a78bfa','#8b5cf6','#60a5fa','#3b82f6','#f472b6','#ec4899',
]

const MOTIVATIONAL = [
  '¡Vas muy bien, sigue así!',
  'Cada hábito cuenta. ¡Tú puedes!',
  'Un paso más hacia tu mejor versión.',
  '¡La constancia es la clave del éxito!',
  '¡No te rindas, ya casi estás!',
  'Pequeños pasos, grandes resultados.',
  '¡Tu esfuerzo vale la pena!',
  'Estás construyendo algo grande.',
]

const EMOJI_OPTIONS = [
  '💪','🏃','🧘','📚','💧','🥗','😴','🎯','🧠','✍️',
  '🎸','🏋️','🚴','🧹','💊','🍎','🌿','☕','🌅','🏊',
  '🎨','📝','🎵','🌱','⚡','🦷','❤️','🧘‍♂️','🎭','🌊',
]

// Spanish day initials: JS getDay() → 0=Sun … 6=Sat
const DAY_LABEL = ['D','L','M','X','J','V','S']

function getGreeting() {
  const h = new Date().getHours()
  if (h < 6)  return { text: 'Madrugada de campeones' }
  if (h < 12) return { text: 'Buenos días, es hoy' }
  if (h < 17) return { text: 'La racha no se rompe sola' }
  if (h < 21) return { text: 'Un día más, una versión mejor' }
  return            { text: 'Termina el día con todo' }
}

let particleId = 0
function rand(min: number, max: number) { return min + Math.random() * (max - min) }

const RING_R = 42
const RING_C = 2 * Math.PI * RING_R

// ── Component ─────────────────────────────────────────────────────────────
export default function HabitList({
  habits: initHabits,
  completedIds,
  today,
  weekLogs,
  last7Dates,
  streak: initStreak,
}: Props) {
  // core state
  const [habits,         setHabits]         = useState<Habit[]>(initHabits)
  const [completed,      setCompleted]       = useState<Set<string>>(new Set(completedIds))
  const [pending,        setPending]         = useState<Set<string>>(new Set())
  const [justCompleted,  setJustCompleted]   = useState<Set<string>>(new Set())
  const [particles,      setParticles]       = useState<Particle[]>([])
  const [, startTransition] = useTransition()

  // add-habit form state
  const [showForm,   setShowForm]   = useState(false)
  const [newName,    setNewName]    = useState('')
  const [newEmoji,   setNewEmoji]   = useState('💪')
  const [addPending, setAddPending] = useState(false)

  // edit-habit state
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editName,    setEditName]    = useState('')
  const [editEmoji,   setEditEmoji]   = useState('💪')
  const [editPending, setEditPending] = useState(false)

  // ── derived ──────────────────────────────────────────────────────────────
  const doneCount = completed.size
  const total     = habits.length
  const pct       = total > 0 ? doneCount / total : 0
  const pctRound  = Math.round(pct * 100)
  const offset    = RING_C * (1 - pct)
  const greeting  = getGreeting()

  const motivationalMsg =
    pct === 0 ? '¿Listo para empezar?' :
    pct < 1   ? MOTIVATIONAL[doneCount % MOTIVATIONAL.length] : null

  /** habitId → Set<date> for the week, today reflects optimistic state */
  const historyMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const l of weekLogs) {
      if (l.date === today) continue
      if (!map.has(l.habit_id)) map.set(l.habit_id, new Set())
      map.get(l.habit_id)!.add(l.date)
    }
    for (const id of completed) {
      if (!map.has(id)) map.set(id, new Set())
      map.get(id)!.add(today)
    }
    return map
  }, [weekLogs, completed, today])

  // ── confetti ──────────────────────────────────────────────────────────────
  function spawnConfetti(cx: number, cy: number) {
    const burst: Particle[] = Array.from({ length: 28 }, () => ({
      id: ++particleId,
      x: cx, y: cy,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: rand(5, 11),
      shape: Math.random() > 0.45 ? 'rect' : 'circle',
      dx: `${rand(-150, 150)}px`,
      dy: `${rand(-210, -60)}px`,
      rot: `${rand(-540, 540)}deg`,
      duration: rand(550, 970),
    }))
    setParticles((p) => [...p, ...burst])
    setTimeout(() => setParticles((p) => p.filter((par) => !burst.some((b) => b.id === par.id))), 1050)
  }

  // ── toggle habit ─────────────────────────────────────────────────────────
  async function toggle(habitId: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (pending.has(habitId)) return
    const wasDone = completed.has(habitId)
    setPending((p) => new Set(p).add(habitId))
    setCompleted((prev) => {
      const next = new Set(prev)
      wasDone ? next.delete(habitId) : next.add(habitId)
      return next
    })
    if (!wasDone) {
      setJustCompleted((prev) => new Set(prev).add(habitId))
      setTimeout(() => setJustCompleted((prev) => { const n = new Set(prev); n.delete(habitId); return n }), 450)
      const r = e.currentTarget.getBoundingClientRect()
      spawnConfetti(r.left + r.width / 2, r.top + r.height / 2)
    }
    startTransition(async () => {
      if (wasDone) {
        await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', today)
      } else {
        await supabase.from('habit_logs').insert({ habit_id: habitId, date: today })
      }
      setPending((p) => { const n = new Set(p); n.delete(habitId); return n })
    })
  }

  // ── add habit ─────────────────────────────────────────────────────────────
  async function addHabit(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name || addPending) return
    setAddPending(true)
    const { data, error } = await supabase
      .from('habits')
      .insert({ name, emoji: newEmoji })
      .select('id, name, emoji')
      .single()
    setAddPending(false)
    if (!error && data) {
      setHabits((prev) => [...prev, data])
      setNewName('')
      setNewEmoji('💪')
      setShowForm(false)
    }
  }

  // ── delete / edit habit ──────────────────────────────────────────────────
  async function deleteHabit(habitId: string) {
    if (!window.confirm('¿Eliminar este hábito?')) return
    setHabits((prev) => prev.filter((h) => h.id !== habitId))
    await supabase.from('habits').delete().eq('id', habitId)
  }

  function startEdit(habit: Habit) {
    setEditingId(habit.id)
    setEditName(habit.name)
    setEditEmoji(habit.emoji)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditEmoji('💪')
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>, habitId: string) {
    e.preventDefault()
    const name = editName.trim()
    if (!name || editPending) return
    setEditPending(true)
    const { error } = await supabase
      .from('habits')
      .update({ name, emoji: editEmoji })
      .eq('id', habitId)
    setEditPending(false)
    if (!error) {
      setHabits((prev) => prev.map((h) => h.id === habitId ? { ...h, name, emoji: editEmoji } : h))
      cancelEdit()
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Keyframes ───────────────────────────────────────────────────── */}
      <style>{`
        @keyframes confetti-fly {
          0%   { opacity: 1;   transform: translate(0,0) rotate(0deg) scale(1); }
          80%  { opacity: 0.6; }
          100% { opacity: 0;   transform: translate(var(--dx),var(--dy)) rotate(var(--rot)) scale(0.3); }
        }
        @keyframes pop-in {
          0%   { transform: scale(0.15); }
          55%  { transform: scale(1.45); }
          78%  { transform: scale(0.86); }
          100% { transform: scale(1); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes float-orb {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(12px,-24px) scale(1.05); }
        }
        @keyframes celebration-bounce {
          0%,100% { transform: scale(1) rotate(0deg); }
          30%      { transform: scale(1.07) rotate(-2deg); }
          70%      { transform: scale(1.07) rotate(2deg); }
        }
        .ring-arc { transition: stroke-dashoffset 750ms cubic-bezier(0.34,1.56,0.64,1); }
        .habit-card { transition: transform 170ms ease, box-shadow 170ms ease; }
        .habit-card:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.016);
          box-shadow: 0 10px 36px var(--card-glow, rgba(0,0,0,0.25));
        }
        .habit-card:active:not(:disabled) { transform: scale(0.985); box-shadow: none; }
        .form-slide {
          animation: fade-up 0.25s ease forwards;
        }
        .emoji-btn { transition: transform 120ms ease, background 120ms ease; }
        .emoji-btn:hover { transform: scale(1.2); }
      `}</style>

      {/* ── Confetti particles ───────────────────────────────────────────── */}
      {particles.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'fixed', left: p.x, top: p.y,
            width: p.size, height: p.size,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            backgroundColor: p.color, pointerEvents: 'none', zIndex: 9999,
            '--dx': p.dx, '--dy': p.dy, '--rot': p.rot,
            animation: `confetti-fly ${p.duration}ms cubic-bezier(0.25,0.46,0.45,0.94) forwards`,
          } as React.CSSProperties}
        />
      ))}

      {/* ── Page shell ───────────────────────────────────────────────────── */}
      <div className="relative min-h-screen overflow-x-hidden text-zinc-100" style={{ background: '#07070e' }}>
        {/* Ambient orbs */}
        <div style={{ position:'absolute', top:-220, right:-200, width:560, height:560, borderRadius:'50%', pointerEvents:'none', background:'radial-gradient(circle,rgba(139,92,246,0.18) 0%,transparent 68%)', filter:'blur(48px)', animation:'float-orb 11s ease-in-out infinite' }} />
        <div style={{ position:'absolute', bottom:-240, left:-180, width:520, height:520, borderRadius:'50%', pointerEvents:'none', background:'radial-gradient(circle,rgba(16,185,129,0.15) 0%,transparent 68%)', filter:'blur(48px)', animation:'float-orb 14s ease-in-out infinite reverse' }} />
        <div style={{ position:'absolute', top:'50%', right:-80, width:280, height:280, borderRadius:'50%', pointerEvents:'none', background:'radial-gradient(circle,rgba(245,158,11,0.07) 0%,transparent 70%)', filter:'blur(40px)', animation:'float-orb 18s ease-in-out infinite 3s' }} />
        {/* Dot grid */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'radial-gradient(rgba(255,255,255,0.032) 1px,transparent 1px)', backgroundSize:'30px 30px' }} />

        <div className="relative mx-auto max-w-[1120px] px-5 lg:px-10 pt-10 pb-20">

          {/* ── Brand bar (full width) ─────────────────────────────────── */}
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background:'linear-gradient(135deg,#8b5cf6,#10b981)' }}>✦</div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-zinc-500">Habit Tracker</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', color:'#f59e0b' }}>
              <span>🔥</span>
              <span>{doneCount} hoy</span>
            </div>
          </div>

          {/* ── Two-column grid ────────────────────────────────────────── */}
          <div className="lg:grid lg:grid-cols-[2fr_3fr] lg:gap-12">

            {/* ════ LEFT COLUMN ══════════════════════════════════════════ */}
            <div className="lg:sticky lg:top-10 lg:self-start mb-10 lg:mb-0">

              {/* Greeting */}
              <header className="mb-7">
                {pct === 1 ? (
                  <h1
                    className="text-[3rem] font-black leading-[1.06] tracking-tight text-transparent bg-clip-text"
                    style={{ backgroundImage:'linear-gradient(135deg,#10b981 0%,#6ee7b7 45%,#a78bfa 100%)', display:'inline-block', animation:'celebration-bounce 1.5s ease-in-out infinite' }}
                  >
                    ¡Día<br />perfecto! 🎉
                  </h1>
                ) : (
                  <h1 className="text-[3rem] font-black leading-[1.06] tracking-tight text-white">
                    {greeting.text}.
                  </h1>
                )}
                <p className="mt-2.5 text-sm text-zinc-500 font-medium capitalize">
                  {new Date().toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
                </p>
              </header>

              {/* Progress card */}
              <div
                className="rounded-3xl p-5 mb-4"
                style={{ background:'linear-gradient(135deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.02) 100%)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(16px)' }}
              >
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-zinc-600 mb-4">Progreso de hoy</p>

                <div className="flex items-center gap-5">
                  {/* Ring */}
                  <div className="relative shrink-0" style={{ width:96, height:96 }}>
                    <svg width="96" height="96" viewBox="0 0 96 96" style={{ overflow:'visible' }}>
                      <defs>
                        <linearGradient id="ring-fill" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%"   stopColor="#10b981" />
                          <stop offset="50%"  stopColor="#6ee7b7" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                        <filter id="ring-glow">
                          <feGaussianBlur stdDeviation="2.5" result="blur" />
                          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                      </defs>
                      <circle cx="48" cy="48" r={RING_R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                      {pct > 0 && (
                        <circle
                          cx="48" cy="48" r={RING_R}
                          fill="none" stroke="url(#ring-fill)" strokeWidth="7"
                          strokeLinecap="round"
                          strokeDasharray={RING_C} strokeDashoffset={offset}
                          transform="rotate(-90 48 48)"
                          className="ring-arc"
                          filter="url(#ring-glow)"
                        />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[1.7rem] font-black tabular-nums leading-none" style={{ color: pct === 0 ? '#52525b' : 'white', transition:'color 400ms' }}>
                        {pctRound}
                      </span>
                      <span className="text-[9px] font-bold text-zinc-500 mt-0.5 tracking-wider">%</span>
                    </div>
                  </div>

                  {/* Right text */}
                  <div className="min-w-0 flex-1">
                    <p key={motivationalMsg ?? 'done'} className="text-sm font-bold leading-snug text-zinc-100 mb-1" style={{ animation:'fade-up 0.35s ease forwards' }}>
                      {pct === 1 ? '¡Todos completados! 🏆' : (motivationalMsg ?? '')}
                    </p>
                    <p className="text-xs text-zinc-500 mb-3">
                      <span className="text-zinc-200 font-bold">{doneCount}</span>
                      {' de '}
                      <span className="font-bold text-zinc-400">{total}</span>
                      {total === 1 ? ' hábito completado' : ' hábitos completados'}
                    </p>
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full" style={{ width:`${pctRound}%`, background: pct===1 ? 'linear-gradient(90deg,#10b981,#6ee7b7,#a78bfa)' : 'linear-gradient(90deg,#10b981,#34d399)', transition:'width 750ms cubic-bezier(0.34,1.56,0.64,1)', boxShadow: pct>0 ? '0 0 10px rgba(16,185,129,0.5)' : 'none' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Streak card */}
              <div
                className="rounded-2xl px-5 py-4 flex items-center gap-4"
                style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                  style={{ background: initStreak > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', border: initStreak > 0 ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.08)' }}
                >
                  {initStreak > 0 ? '🔥' : '💤'}
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Racha actual</p>
                  <p className="text-lg font-black text-white mt-0.5">
                    {initStreak > 0
                      ? <>{initStreak} <span className="text-sm font-semibold text-zinc-400">{initStreak === 1 ? 'día' : 'días consecutivos'}</span></>
                      : <span className="text-sm font-semibold text-zinc-500">Sin racha todavía</span>
                    }
                  </p>
                </div>
              </div>

            </div>
            {/* ════ END LEFT COLUMN ══════════════════════════════════════ */}

            {/* ════ RIGHT COLUMN ═════════════════════════════════════════ */}
            <div className="min-w-0">

              {/* Section: habits */}
              <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-zinc-600 px-1">
                Hábitos de hoy
              </p>

              {habits.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <span className="text-5xl">🌱</span>
                  <p className="text-zinc-500 text-sm">No hay hábitos todavía.<br />Agrega uno abajo.</p>
                </div>
              ) : (
                <ul className="space-y-2.5 mb-8">
                  {habits.map((habit, i) => {
                    const accent   = ACCENTS[i % ACCENTS.length]
                    const isDone   = completed.has(habit.id)
                    const isLoad   = pending.has(habit.id)
                    const popping  = justCompleted.has(habit.id)
                    const isEditing = editingId === habit.id

                    return (
                      <li key={habit.id}>

                        {/* ── Inline edit form ─────────────────────── */}
                        {isEditing ? (
                          <form
                            onSubmit={(e) => saveEdit(e, habit.id)}
                            className="form-slide rounded-2xl p-4"
                            style={{ background: accent.doneBg, border: `1px solid ${accent.doneBorder}` }}
                          >
                            <div className="grid grid-cols-10 gap-1 mb-3">
                              {EMOJI_OPTIONS.map((em) => (
                                <button
                                  key={em} type="button"
                                  onClick={() => setEditEmoji(em)}
                                  className="emoji-btn flex items-center justify-center h-7 w-7 rounded-lg text-base"
                                  style={{
                                    background: editEmoji === em ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${editEmoji === em ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.07)'}`,
                                  }}
                                >
                                  {em}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                              <span className="text-lg leading-none">{editEmoji}</span>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                maxLength={60}
                                autoFocus
                                className="flex-1 bg-transparent text-sm font-medium text-zinc-100 placeholder:text-zinc-600 outline-none"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={!editName.trim() || editPending}
                                className="flex-1 rounded-xl py-2 text-sm font-bold disabled:opacity-40"
                                style={{ background: 'linear-gradient(135deg,#8b5cf6,#10b981)', color: 'white' }}
                              >
                                {editPending ? 'Guardando…' : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </form>

                        ) : (

                          /* ── Normal card ─────────────────────────── */
                          <div className="group relative">
                            <button
                              onClick={(e) => toggle(habit.id, e)}
                              disabled={isLoad}
                              className={`habit-card w-full flex items-center gap-4 rounded-2xl px-5 py-[15px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${isLoad ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              style={{
                                background:    isDone ? accent.doneBg : accent.bg,
                                border:        `1px solid ${isDone ? accent.doneBorder : accent.border}`,
                                boxShadow:     isDone ? `0 4px 28px ${accent.glow}` : 'none',
                                '--card-glow': accent.glow,
                              } as React.CSSProperties}
                            >
                              <div className="relative shrink-0 leading-none">
                                <span className="text-[1.55rem] select-none">{habit.emoji}</span>
                                <span className="absolute -top-0.5 -right-0.5 h-[7px] w-[7px] rounded-full" style={{ background: accent.color, boxShadow: `0 0 6px ${accent.color}`, opacity: isDone ? 1 : 0.65 }} />
                              </div>
                              <span
                                className={`flex-1 text-[15px] font-semibold leading-snug transition-all duration-300 ${isDone ? 'line-through' : 'text-zinc-100'}`}
                                style={isDone ? { color: accent.textDone, textDecorationColor: accent.color + '55' } : undefined}
                              >
                                {habit.name}
                              </span>
                              <span
                                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2"
                                style={{
                                  borderColor: isDone ? accent.color : 'rgba(255,255,255,0.14)',
                                  background:  isDone ? accent.color : 'transparent',
                                  boxShadow:   isDone ? `0 0 12px ${accent.glow}` : 'none',
                                  transition:  'background 220ms, border-color 220ms, box-shadow 220ms',
                                  animation:   popping ? 'pop-in 0.44s cubic-bezier(0.34,1.56,0.64,1) forwards' : undefined,
                                }}
                              >
                                {isDone && (
                                  <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="1 5 4 8 11 1" />
                                  </svg>
                                )}
                              </span>
                            </button>

                            {/* Action icons — visible on hover */}
                            <div className="absolute right-[52px] top-1/2 -translate-y-1/2 z-10 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
                              <button
                                type="button"
                                onClick={() => startEdit(habit)}
                                title="Editar"
                                className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors duration-100"
                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.13)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                              >
                                <svg className="h-3.5 w-3.5 text-zinc-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5Z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteHabit(habit.id)}
                                title="Eliminar"
                                className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors duration-100"
                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.18)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                              >
                                <svg className="h-3.5 w-3.5 text-zinc-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4" />
                                </svg>
                              </button>
                            </div>

                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* ── 7-day history ──────────────────────────────────────── */}
              {habits.length > 0 && (
                <section className="mb-8">
                  <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-zinc-600 px-1">
                    Últimos 7 días
                  </p>

                  <div className="rounded-2xl overflow-hidden" style={{ border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.02)' }}>
                    {/* Day header row */}
                    <div className="grid px-4 py-2.5" style={{ gridTemplateColumns:'1fr repeat(7,32px)', gap:'0 6px' }}>
                      <div />
                      {last7Dates.map((date) => {
                        const isToday = date === today
                        return (
                          <div key={date} className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold" style={{ color: isToday ? '#10b981' : '#52525b' }}>
                              {DAY_LABEL[new Date(date + 'T12:00:00').getDay()]}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Habit rows */}
                    {habits.map((habit, i) => {
                      const accent  = ACCENTS[i % ACCENTS.length]
                      const doneSet = historyMap.get(habit.id) ?? new Set<string>()
                      return (
                        <div
                          key={habit.id}
                          className="grid px-4 py-3 items-center"
                          style={{ gridTemplateColumns:'1fr repeat(7,32px)', gap:'0 6px', borderTop:'1px solid rgba(255,255,255,0.05)' }}
                        >
                          <span className="text-[13px] font-medium text-zinc-400 truncate pr-2">
                            {habit.emoji} {habit.name}
                          </span>
                          {last7Dates.map((date) => {
                            const done    = doneSet.has(date)
                            const isToday = date === today
                            return (
                              <div key={date} className="flex items-center justify-center">
                                <div
                                  className="h-5 w-5 rounded-full"
                                  style={{
                                    background:  done ? accent.color : 'rgba(255,255,255,0.05)',
                                    border:      `1.5px solid ${done ? accent.color : isToday ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`,
                                    boxShadow:   done ? `0 0 8px ${accent.glow}` : 'none',
                                    transition:  'all 300ms',
                                  }}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* ── 100% celebration ───────────────────────────────────── */}
              {total > 0 && pct === 1 && (
                <div
                  className="mb-6 rounded-2xl px-6 py-5 text-center"
                  style={{ background:'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(139,92,246,0.1))', border:'1px solid rgba(16,185,129,0.22)', animation:'fade-up 0.5s ease forwards' }}
                >
                  <p className="text-3xl mb-2">🏆</p>
                  <p className="font-bold text-sm text-emerald-300 mb-0.5">¡Completaste todos tus hábitos hoy!</p>
                  <p className="text-zinc-500 text-xs">La disciplina de hoy es la libertad de mañana.</p>
                </div>
              )}

              {/* ── Add habit ──────────────────────────────────────────── */}
              <section>
                <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-zinc-600 px-1">
                  Nuevo hábito
                </p>

                {!showForm ? (
                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold text-zinc-400 transition-all duration-150 hover:text-zinc-200"
                    style={{ background:'rgba(255,255,255,0.03)', border:'1.5px dashed rgba(255,255,255,0.12)' }}
                  >
                    <span className="text-lg leading-none">+</span>
                    Agregar hábito
                  </button>
                ) : (
                  <form
                    onSubmit={addHabit}
                    className="form-slide rounded-2xl p-5"
                    style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)' }}
                  >
                    {/* Emoji picker */}
                    <div className="mb-4">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">Emoji</label>
                      <div className="grid grid-cols-10 gap-1">
                        {EMOJI_OPTIONS.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => setNewEmoji(em)}
                            className="emoji-btn flex items-center justify-center h-8 w-8 rounded-lg text-lg"
                            style={{
                              background: newEmoji === em ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
                              border:     `1px solid ${newEmoji === em ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.07)'}`,
                            }}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Name input */}
                    <div className="mb-5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">Nombre</label>
                      <div className="flex items-center gap-2 rounded-xl px-4 py-2.5" style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)' }}>
                        <span className="text-xl leading-none">{newEmoji}</span>
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Ej. Leer 30 minutos..."
                          maxLength={60}
                          className="flex-1 bg-transparent text-sm font-medium text-zinc-100 placeholder:text-zinc-600 outline-none"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={!newName.trim() || addPending}
                        className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-opacity disabled:opacity-40"
                        style={{ background:'linear-gradient(135deg,#8b5cf6,#10b981)', color:'white' }}
                      >
                        {addPending ? 'Guardando…' : 'Guardar hábito'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowForm(false); setNewName(''); setNewEmoji('💪') }}
                        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                        style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </section>

            </div>
            {/* ════ END RIGHT COLUMN ═════════════════════════════════════ */}

          </div>
        </div>
      </div>
    </>
  )
}
