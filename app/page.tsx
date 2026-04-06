import { supabase } from '@/lib/supabase'
import HabitList from '@/app/ui/habit-list'

export const dynamic = 'force-dynamic'

const TZ = 'America/Santiago'

/** Returns today's date as YYYY-MM-DD in the Santiago timezone. */
function todayInSantiago(): string {
  // en-CA locale produces YYYY-MM-DD which is the format we need
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

/** Add (or subtract) whole days from a YYYY-MM-DD string. */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function calcStreak(
  habits: { id: string }[],
  logs: { habit_id: string; date: string }[],
  today: string,
): number {
  if (!habits.length) return 0
  const ids = habits.map((h) => h.id)
  const byDate = new Map<string, Set<string>>()
  for (const l of logs) {
    if (!byDate.has(l.date)) byDate.set(l.date, new Set())
    byDate.get(l.date)!.add(l.habit_id)
  }
  let streak = 0
  let cur = today
  while (streak < 365) {
    const done = byDate.get(cur)
    if (!done || !ids.every((id) => done.has(id))) break
    streak++
    cur = addDays(cur, -1)
  }
  return streak
}

export default async function Page() {
  const today = todayInSantiago()

  // last 7 dates oldest→newest, all relative to today in Santiago
  const last7Dates = Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i)))

  // fetch last 60 days for streak + week history in one query
  const sixtyAgo = addDays(today, -59)

  const [{ data: rawHabits }, { data: rawLogs }] = await Promise.all([
    supabase.from('habits').select('id, name, emoji').order('created_at'),
    supabase
      .from('habit_logs')
      .select('habit_id, date')
      .gte('date', sixtyAgo)
      .lte('date', today),
  ])

  const habits      = rawHabits ?? []
  const allLogs     = rawLogs   ?? []
  const completedIds = allLogs.filter((l) => l.date === today).map((l) => l.habit_id)
  const weekLogs     = allLogs.filter((l) => l.date >= last7Dates[0])
  const streak       = calcStreak(habits, allLogs, today)

  return (
    <HabitList
      habits={habits}
      completedIds={completedIds}
      today={today}
      weekLogs={weekLogs}
      last7Dates={last7Dates}
      streak={streak}
    />
  )
}
