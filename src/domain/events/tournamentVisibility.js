import { format, parseISO, subDays } from 'date-fns'

export function isTournamentSummaryVisible(tournament, today = format(new Date(), 'yyyy-MM-dd')) {
  if (!tournament?.startDate || !tournament?.endDate) return false
  const visibleFrom = format(subDays(parseISO(tournament.startDate), 1), 'yyyy-MM-dd')
  return today >= visibleFrom && today <= tournament.endDate
}
