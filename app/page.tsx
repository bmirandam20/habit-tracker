import { supabase } from '@/lib/supabase'
import HabitList from '@/app/ui/habit-list'

/** Format a local Date as YYYY-MM-DD without UTC shift */
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  const cur = new Date(today + 'T12:00:00')
  while (streak < 365) {
    const ds = fmt(cur)
    const done = byDate.get(ds)
    if (!done || !ids.every((id) => done.has(id))) break
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

export default async function Page() {
  const today = fmt(new Date())

  // last 7 dates oldest→newest
  const last7Dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return fmt(d)
  })

  // fetch last 60 days for streak + week history in one query
  const sixtyAgo = fmt(new Date(Date.now() - 59 * 86_400_000))

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
