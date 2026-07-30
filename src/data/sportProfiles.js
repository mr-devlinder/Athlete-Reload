export const sportProfiles = {
  Baseball: ['Pitcher', 'Catcher', 'First baseman', 'Second baseman', 'Third baseman', 'Shortstop', 'Left fielder', 'Center fielder', 'Right fielder'],
  Basketball: ['Point guard', 'Shooting guard', 'Small forward', 'Power forward', 'Center'],
  Football: ['Quarterback', 'Running back', 'Wide receiver', 'Tight end', 'Offensive line', 'Defensive line', 'Linebacker', 'Cornerback', 'Safety', 'Kicker / punter'],
  Golf: ['Player'],
  'General fitness': ['General training'],
  'Track and field': ['Sprints', 'Middle distance', 'Distance', 'Hurdles', 'Jumps', 'Throws', 'Multi-events'],
  'Weight training': ['Upper body', 'Lower body', 'Full body', 'Powerlifting', 'Olympic lifting'],
  Running: ['Road', 'Trail', 'Cross country', 'Marathon', 'Sprint training'],
  Soccer: ['Striker', 'Winger', 'Attacking midfielder', 'Central midfielder', 'Defensive midfielder', 'Outside back', 'Center back', 'Goalkeeper'],
  Swimming: ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual medley', 'Distance'],
  Volleyball: ['Setter', 'Outside hitter', 'Opposite hitter', 'Middle blocker', 'Libero / defensive specialist'],
  Wrestling: ['Wrestler'],
}

export const sportOptions = [...Object.keys(sportProfiles), 'Other']

export function getPositionOptions(sport) {
  return sportProfiles[sport] ?? []
}
