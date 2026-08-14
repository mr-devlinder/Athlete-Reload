export const MOBILITY_CATALOG_VERSION = 'mobility-catalog-3.0.0'
export const RECOVERY_CATALOG_VERSION = MOBILITY_CATALOG_VERSION

export const MOBILITY_ROUTINE_TYPES = [
  'session_recovery',
  'full_body',
  'lower_body',
  'upper_body',
  'flexibility',
  'warm_up',
  'light_recovery',
  'custom_mobility',
]

const UNIVERSAL_STOP_CONDITIONS = [
  'Stop for sharp or worsening pain.',
  'Stop for numbness, tingling, instability, dizziness, or loss of balance.',
]

const GROUPS = [
  group('hips', ['hips'], ['hip_flexors', 'hip_rotators', 'adductors', 'glutes'], `
90/90 Hip Switch
90/90 Hip Hold
90/90 Forward Fold
Shin Box Switch
Seated Hip Internal Rotation
Seated Hip External Rotation
Standing Hip CAR
Quadruped Hip CAR
Figure-Four Stretch
Supine Figure-Four Stretch
Pigeon Stretch
Modified Pigeon Stretch
Half-Kneeling Hip Flexor Stretch
Half-Kneeling Hip Flexor Stretch with Side Bend
Couch Stretch
Standing Hip Flexor Stretch
Frog Stretch
Frog Rock-Back
Butterfly Stretch
Butterfly Forward Fold
Adductor Rock-Back
Wide-Knee Adductor Rock-Back
Half-Kneeling Adductor Rock
Lateral Lunge Mobility
Cossack Squat
Assisted Cossack Squat
Deep Squat Hold
Deep Squat Hip Shift
Deep Squat Pry
Knee-to-Chest Hip Stretch
Supine Hip Rotation
Windshield Wipers
Standing Hip Circles
Fire Hydrant
Controlled Fire Hydrant
Hip Airplane
Assisted Hip Airplane`),
  group('hamstrings', ['hamstrings', 'hips'], ['hamstrings'], `
Standing Hamstring Stretch
Seated Single-Leg Hamstring Stretch
Seated Double-Leg Hamstring Stretch
Supine Hamstring Stretch
Active Straight-Leg Raise
Dynamic Hamstring Sweep
Hamstring Scoop
Half-Split Stretch
Standing Toe Reach
Single-Leg Toe Reach
Downward Dog Hamstring Stretch
Inchworm
Walkout to Plank
Squat-to-Stand
Hamstring Rock-Back
Single-Leg Hamstring Rock-Back
Straight-Leg Kick
Controlled Front Leg Swing
Supine Leg Extension`),
  group('quadriceps', ['quadriceps', 'hips'], ['quadriceps', 'hip_flexors'], `
Standing Quad Stretch
Side-Lying Quad Stretch
Prone Quad Stretch
Half-Kneeling Quad Stretch
Couch Stretch with Glute Squeeze
Dynamic Quad Pull
Heel-to-Glute Hold
Kneeling Quad Lean
Reverse Nordic
Assisted Reverse Nordic
Standing Quad-to-Hip-Flexor Stretch`),
  group('ankles_feet', ['ankles', 'calves', 'feet'], ['ankles', 'calves', 'feet'], `
Standing Calf Stretch
Bent-Knee Soleus Stretch
Wall Calf Stretch
Wall Soleus Stretch
Downward Dog Calf Stretch
Single-Leg Calf Stretch
Knee-to-Wall Ankle Rock
Half-Kneeling Ankle Rock
Ankle Dorsiflexion Rock
Ankle Circles
Ankle Alphabet
Toe Raises
Tibialis Raises
Standing Calf Raise
Single-Leg Calf Raise
Bent-Knee Calf Raise
Seated Calf Raise
Heel Raise Hold
Toe Yoga
Big-Toe Lift
Four-Toe Lift
Toe Spread
Short-Foot Hold
Heel-to-Toe Weight Shift
Controlled Ankle Inversion
Controlled Ankle Eversion
Plantar Flexion Point-and-Flex
Single-Leg Ankle Balance`),
  group('glutes', ['glutes', 'hips'], ['glutes'], `
Glute Bridge
Glute Bridge Hold
Glute Bridge March
Single-Leg Glute Bridge
Frog Pump
Hip Thrust
Single-Leg Hip Thrust
Quadruped Hip Extension
Donkey Kick
Straight-Leg Donkey Kick
Side-Lying Hip Abduction
Side-Lying Hip Abduction Hold
Clamshell
Reverse Clamshell
Standing Hip Abduction
Standing Hip Extension
Bridge Abduction`),
  group('adductors_groin', ['adductors', 'groin', 'hips'], ['adductors', 'groin'], `
Side Lunge Hold
Wide-Stance Squat Hold
Standing Groin Shift
Supine Groin Stretch
Half-Kneeling Adductor Stretch
Seated Straddle Stretch
Straddle Side Reach
Straddle Forward Fold
Side-Lying Adductor Raise
Copenhagen Plank — Short Lever
Copenhagen Hold — Short Lever`),
  group('core', ['core', 'trunk'], ['abdominals', 'trunk_control'], `
Dead Bug
Dead Bug Hold
Alternating Dead Bug
Heel-Tap Dead Bug
Bird Dog
Bird Dog Hold
Bird Dog Crunch
Bear Plank
Bear Plank Shoulder Tap
Forearm Plank
High Plank
Side Plank
Side Plank from Knees
Side Plank Hip Lift
Plank Shoulder Tap
Plank Knee Tap
Hollow Body Hold
Tuck Hold
Supine Heel Tap
Reverse Crunch
Bent-Knee Leg Lower
Straight-Leg Leg Lower
McGill Curl-Up
Pallof Press
Pallof Hold
Standing Anti-Rotation Hold
Tall-Kneeling Anti-Rotation Press
Half-Kneeling Anti-Rotation Press`),
  group('thoracic_spine', ['thoracic_spine', 'upper_back'], ['thoracic_spine'], `
Open Book
Thread the Needle
Quadruped Thoracic Rotation
Half-Kneeling Thoracic Rotation
Seated Thoracic Rotation
Standing Thoracic Rotation
Side-Lying Thoracic Rotation
Child's Pose with Side Reach
Extended Child's Pose
Cat-Cow
Quadruped Spine Flexion-Extension
Thoracic Extension over Hands
Kneeling Lat-Thoracic Stretch
Wall Thoracic Rotation
Wall Thoracic Extension`),
  group('shoulders', ['shoulders', 'scapular_region'], ['shoulders', 'scapulae', 'chest'], `
Arm Circles
Controlled Arm Circles
Shoulder CAR
Cross-Body Shoulder Stretch
Overhead Triceps Stretch
Posterior Shoulder Stretch
Doorway Pec Stretch
Single-Arm Doorway Pec Stretch
Wall Pec Stretch
Wall Shoulder Flexion
Wall Slides
Floor Angels
Wall Angels
Scapular Wall Slide
Scapular Push-Up
Quadruped Scapular Push-Up
Prone Y
Prone T
Prone W
Prone I
Prone Y-T-W
Shoulder External Rotation
Shoulder Internal Rotation
Band External Rotation
Band Internal Rotation
Band Pull-Apart
Band Face Pull
Band Overhead Pull-Apart
Band Shoulder Pass-Through
Serratus Wall Slide`),
  group('neck_upper_back', ['neck', 'upper_back'], ['neck', 'upper_trapezius', 'scapulae'], `
Gentle Neck Rotation
Neck Side Bend
Upper-Trap Stretch
Levator Scapulae Stretch
Chin Tuck
Chin Tuck Hold
Shoulder Shrug
Shoulder Roll
Scapular Retraction
Scapular Depression
Wall Scapular Retraction`),
  group('wrists_forearms', ['wrists', 'forearms'], ['wrists', 'forearms', 'fingers'], `
Wrist Flexor Stretch
Wrist Extensor Stretch
Prayer Stretch
Reverse Prayer Stretch
Wrist Circles
Forearm Pronation-Supination
Finger Extension Stretch
Finger Flexion Stretch
Quadruped Wrist Rock
Backward-Hand Wrist Rock
Fist-to-Palm Wrist Mobility
Wrist Flexion-Extension Control
Radial-Ulnar Wrist Deviation
Finger Spread and Close`),
  group('full_body', ['full_body'], ['multiple_regions'], `
World's Greatest Stretch
World's Greatest Stretch with Rotation
Downward Dog to Plank
Downward Dog to Cobra
Cobra to Child's Pose
Lunge with Thoracic Rotation
Reverse Lunge with Reach
Lateral Lunge with Reach
Deep Squat with Reach
Deep Squat Thoracic Rotation
Spiderman Stretch
Spiderman Stretch with Rotation
Bear to Downward Dog
Quadruped Rock-Back
Tall-Kneeling Hip Hinge
Half-Kneeling Reach
Standing Side Bend
Standing Overhead Reach
Standing Rotation Reach`),
  group('dynamic_warm_up', ['full_body'], ['dynamic_preparation'], `
High Knees in Place
Butt Kicks in Place
A-March in Place
A-Skip in Place
Pogo Hops
Low Pogo Hops
Single-Leg Pogo
Lateral Pogo
Line Hops Forward-Back
Line Hops Side-to-Side
Jumping Jacks
Seal Jacks
Split Jacks
Fast Feet in Place
Lateral Quick Feet
Skater Step
Skater Hop
Squat to Calf Raise
Bodyweight Squat
Tempo Bodyweight Squat
Squat Hold
Reverse Lunge
Forward Lunge
Lateral Lunge
Curtsy Lunge
Split Squat
Split Squat Hold
Lunge Switch
Squat Jump
Snap Down
Snap Down to Athletic Stance
Ankle Bounce
Single-Leg Balance Reach
Dynamic Knee Hug
Standing Leg Swing — Front/Back
Standing Leg Swing — Side-to-Side
Hip Openers
Hip Closers
Standing Hamstring Kick`),
  group('balance_stability', ['balance', 'hips', 'ankles'], ['balance', 'stability'], `
Single-Leg Balance
Single-Leg Balance with Knee Drive
Single-Leg Balance with Reach
Single-Leg Balance with Rotation
Single-Leg RDL Reach
Bodyweight Single-Leg RDL
Supported Single-Leg RDL
Split-Stance Balance Hold
Tandem Balance Hold
Single-Leg Calf Raise Hold
Single-Leg Quarter-Squat Hold
Single-Leg Mini Squat
Clock Reach
Three-Way Reach
Single-Leg Toe Tap
Single-Leg Lateral Toe Tap
Single-Leg Forward Toe Tap
Single-Leg Posterior Toe Tap`),
  group('band', ['full_body'], ['activation', 'control'], `
Lateral Band Walk
Monster Walk
Banded Clamshell
Banded Glute Bridge
Banded Hip Abduction
Banded Hip Extension
Banded Squat
Banded Ankle Dorsiflexion
Band Row
Band Lat Stretch
Band Serratus Punch
Band No-Money Drill
Band Pallof Press
Band Pallof Hold`),
  group('bench_chair', ['full_body'], ['supported_mobility'], `
Bench Hip Flexor Stretch
Elevated Hamstring Stretch
Elevated Calf Stretch
Rear-Foot Elevated Hip Flexor Stretch
Supported Cossack Squat
Supported Deep Squat
Chair Figure-Four Stretch
Seated Figure-Four Stretch
Bench Glute Stretch
Elevated Pigeon Stretch
Step-Up
Lateral Step-Up`),
]

const ID_OVERRIDES = {
  '90/90 Hip Switch': 'hip_90_90_switch',
  '90/90 Hip Hold': 'hip_90_90_hold',
  '90/90 Forward Fold': 'hip_90_90_forward_fold',
  'Half-Kneeling Hip Flexor Stretch': 'half_kneeling_hip_flexor_stretch',
}

const INSTRUCTION_OVERRIDES = {
  '90/90 Hip Switch': 'Sit tall with both knees bent and feet planted wider than your hips. Lower both knees to one side, return through center, and switch sides without forcing the range.',
  'Half-Kneeling Hip Flexor Stretch': 'Kneel with one knee on the floor and the opposite foot in front. Gently tuck your pelvis, squeeze the glute of the kneeling side, and shift forward until the front of that hip stretches.',
  'Dead Bug': 'Lie on your back with hips and knees bent to 90 degrees and arms above your shoulders. Lower the opposite arm and leg without letting your low back lift, then return and alternate.',
  'Bird Dog': 'Start on hands and knees. Reach one arm and the opposite leg long while keeping your ribs and hips level, then return with control and alternate.',
  'Glute Bridge': 'Lie on your back with knees bent and feet flat. Press through both feet and squeeze your glutes to lift your hips without arching your low back.',
  'Open Book': 'Lie on your side with knees stacked and arms together in front. Sweep the top arm open as your upper back rotates while both knees stay together.',
  'Cat-Cow': 'Start on hands and knees. Slowly round your spine, then move through neutral into a gentle arch without forcing either end position.',
  'Side Plank': 'Lie on your side with your elbow below your shoulder. Lift your hips so your head, trunk, and legs form one line without rolling forward or backward.',
  'World\'s Greatest Stretch': 'Step into a long lunge and place both hands inside the front foot. Keep the back leg long and move only through a comfortable hip and upper-back range.',
  'Knee-to-Wall Ankle Rock': 'Face a wall with one foot flat a short distance away. Drive that knee toward the wall over the middle toes while the heel stays down.',
  'Pallof Press': 'Stand sideways to an anchored resistance band and hold it at your chest. Press your hands straight forward without letting the band rotate your trunk.',
}

const rawMovements = GROUPS.flatMap((entry) => entry.names.map((name) => ({ ...entry, name })))
const uniqueMovements = rawMovements.filter((movement, index) => rawMovements.findIndex((candidate) => candidate.name.toLowerCase() === movement.name.toLowerCase()) === index)

export const MOBILITY_MOVEMENTS = uniqueMovements.map(buildMovement)
export const MOBILITY_MOVEMENT_BY_ID = Object.fromEntries(MOBILITY_MOVEMENTS.map((movement) => [movement.id, movement]))

// Compatibility exports point to the same canonical objects. There is no second catalog.
export const RECOVERY_EXERCISE_LIST = MOBILITY_MOVEMENTS
export const RECOVERY_EXERCISES = MOBILITY_MOVEMENT_BY_ID
export const RECOVERY_CATEGORIES = [...new Set(MOBILITY_MOVEMENTS.map((movement) => movement.category))]
export const RECOVERY_ROUTINE_IDS = Object.fromEntries(MOBILITY_ROUTINE_TYPES.map((type) => [type, MOBILITY_MOVEMENTS.filter((movement) => movement.routineTypes.includes(type)).map((movement) => movement.id)]))

export function getMovementById(id) {
  return MOBILITY_MOVEMENT_BY_ID[String(id ?? '')] ?? null
}

export function getCatalogExercises(ids = []) {
  return ids.map(getMovementById).filter(Boolean).map(cloneMovement)
}

export function resolveVettedExerciseSelections(selections = []) {
  return selections.map((selection) => {
    const id = typeof selection === 'string' ? selection : selection?.movementId ?? selection?.id
    const movement = getMovementById(id)
    if (!movement) return null
    const prescription = normalizePrescription(selection?.prescription ?? selection?.dose, movement)
    return withPrescription(cloneMovement(movement), prescription)
  }).filter(Boolean)
}

export function estimateExerciseSeconds(exercise, transitionSeconds = exercise?.estimatedTransitionSeconds ?? 10) {
  const prescription = exercise?.prescription ?? exercise?.dose ?? {}
  const sides = exercise?.unilateral && !/left|right/i.test(String(exercise?.side ?? '')) ? 2 : 1
  const sets = Math.max(1, Number(prescription.sets ?? exercise?.sets) || 1)
  const active = prescription.type === 'time' || prescription.model === 'timer'
    ? Math.max(1, Number(prescription.durationSeconds ?? exercise?.durationSeconds) || 0)
    : Math.max(1, Number(prescription.reps ?? exercise?.reps) || 0) * Math.max(2, Number(prescription.secondsPerRep ?? prescription.tempoSecondsPerRep ?? exercise?.secondsPerRep) || 3)
  return sides * (sets * active + Math.max(0, sets - 1) * Math.max(0, Number(prescription.restSeconds ?? exercise?.restSeconds) || 0)) + Math.max(0, Number(transitionSeconds) || 0)
}

function buildMovement(seed) {
  const prescriptionType = inferPrescriptionType(seed.name)
  const unilateral = inferUnilateral(seed.name)
  const equipment = inferEquipment(seed.name)
  const categories = inferCategories(seed.name, seed.category)
  const routineTypes = inferRoutineTypes(seed.name, seed.category, categories)
  const defaults = prescriptionType === 'time'
    ? { durationSeconds: inferHoldSeconds(seed.name), reps: null, sets: 1, restSeconds: 0, secondsPerRep: null }
    : { durationSeconds: null, reps: inferReps(seed.name), sets: 1, restSeconds: 0, secondsPerRep: inferSecondsPerRep(seed.name) }
  const instruction = INSTRUCTION_OVERRIDES[seed.name] ?? inferInstruction(seed, prescriptionType)
  const shouldFeel = inferShouldFeel(seed, categories)
  const avoid = inferAvoid(seed.name, prescriptionType)
  const painSensitiveRegions = [...new Set(seed.bodyRegions.flatMap(expandPainRegion))]
  const id = ID_OVERRIDES[seed.name] ?? slugify(seed.name)
  const prescription = prescriptionType === 'time'
    ? { type: 'time', durationSeconds: defaults.durationSeconds, sets: 1, restSeconds: 0 }
    : { type: 'reps', reps: defaults.reps, sets: 1, restSeconds: 0, secondsPerRep: defaults.secondsPerRep }
  const laterality = unilateral ? 'each-side' : /alternat|switch|march|wiper|circle|openers|closers/i.test(seed.name) ? 'alternating' : 'bilateral'
  const targetAreas = seed.targetAreas[0] === 'multiple_regions' ? seed.bodyRegions : seed.targetAreas

  return {
    id,
    name: seed.name,
    canonicalName: seed.name,
    categories,
    category: humanize(seed.category),
    routineTypes,
    bodyRegions: seed.bodyRegions,
    bodyRegion: humanize(seed.bodyRegions[0]),
    targetAreas,
    targetBodyParts: seed.bodyRegions.map(humanize),
    targetMuscles: targetAreas.map(humanize),
    equipment,
    difficulty: /copenhagen|single-leg pogo|squat jump|skater hop|reverse nordic|hip airplane/i.test(seed.name) ? 'intermediate' : 'beginner',
    prescriptionType,
    defaults,
    prescription,
    dose: toLegacyDose(prescription),
    doseModels: [toLegacyDose(prescription)],
    doseModel: prescriptionType === 'time' ? 'timer' : 'reps',
    unilateral,
    laterality,
    side: unilateral ? 'Each side' : laterality === 'alternating' ? 'Alternating' : 'Both sides',
    instructions: instruction,
    instruction,
    setup: instruction.split(/(?<=[.!?])\s+/)[0],
    movement: instruction,
    completionCue: prescriptionType === 'time' ? 'Ease out of the position when the time ends.' : 'Return to the start under control to complete each repetition.',
    steps: [instruction, prescriptionType === 'time' ? 'Hold only in a comfortable range, then ease out slowly.' : 'Move smoothly and finish every repetition under control.'],
    shouldFeel,
    whatYouShouldFeel: shouldFeel,
    feel: shouldFeel[0],
    avoid,
    thingsToAvoid: avoid,
    stopConditions: UNIVERSAL_STOP_CONDITIONS,
    painSensitiveRegions,
    painExclusions: painSensitiveRegions.map((region) => `${region}_pain`),
    contraindications: painSensitiveRegions.map((region) => `${region}_symptoms`),
    tags: [...new Set([seed.category, ...seed.bodyRegions, ...targetAreas, ...categories, ...routineTypes])],
    movementType: inferMovementType(categories),
    position: inferPosition(seed.name),
    estimatedTransitionSeconds: 10,
    durationSeconds: defaults.durationSeconds ?? 0,
    reps: defaults.reps ?? 0,
    sets: 1,
    restSeconds: 0,
    secondsPerRep: defaults.secondsPerRep ?? 0,
    purpose: `Support comfortable ${humanize(seed.bodyRegions[0]).toLowerCase()} movement for this routine's goal.`,
    substitutions: [],
    catalogVersion: MOBILITY_CATALOG_VERSION,
  }
}

function group(category, bodyRegions, targetAreas, names) {
  return { category, bodyRegions, targetAreas, names: names.trim().split('\n').map((name) => name.trim()).filter(Boolean) }
}

function inferCategories(name, category) {
  const categories = []
  if (/stretch|fold|hold|pose|prayer/i.test(name)) categories.push('flexibility')
  if (/hop|skip|jump|jack|pogo|ankle bounce/i.test(name)) categories.push('plyometrics')
  if (/hop|skip|jump|jack|fast feet|high knees|butt kicks|snap down|a-march|lunge switch|ankle bounce/i.test(name)) categories.push('warm_up')
  if (/bridge|plank|raise|curl|press|row|walk|squat|lunge|thrust|kick|clamshell|hydrant|nordic|step-up/i.test(name)) categories.push('activation')
  if (/balance|stability|airplane|toe tap|clock reach|three-way reach/i.test(name)) categories.push('balance')
  if (category === 'dynamic_warm_up') categories.push('warm_up')
  if (categories.length === 0 || /mobility|rotation|circle|rock|switch|car|slide|reach|cat-cow|open book|thread|point-and-flex|yoga/i.test(name)) categories.unshift('mobility')
  return [...new Set(categories)]
}

function inferRoutineTypes(name, category, categories) {
  if (category === 'dynamic_warm_up') return ['warm_up']
  const types = ['custom_mobility']
  const upper = ['shoulders', 'neck_upper_back', 'wrists_forearms', 'thoracic_spine', 'core'].includes(category)
  const lower = ['hips', 'hamstrings', 'quadriceps', 'ankles_feet', 'glutes', 'adductors_groin', 'balance_stability'].includes(category)
  if (upper) types.push('upper_body')
  if (lower) types.push('lower_body')
  types.push('full_body')
  if (categories.includes('flexibility')) types.push('flexibility')
  if (!isDemanding(name)) types.push('session_recovery', 'light_recovery')
  if (!categories.includes('flexibility') || /dynamic|rock|switch|circle|car|reach|squat-to-stand|inchworm|leg swing/i.test(name)) types.push('warm_up')
  return [...new Set(types)]
}

function inferEquipment(name) {
  if (/band|pallof|anti-rotation/i.test(name)) return ['resistance_band']
  if (/bench|chair|elevated|rear-foot elevated|step-up/i.test(name)) return ['bench_or_chair']
  return []
}

function inferPrescriptionType(name) {
  return /stretch|hold|plank$|bear plank$|tuck hold|chin tuck hold|deep squat hold|split squat hold|prayer|child's pose|wall sit/i.test(name) ? 'time' : 'reps'
}

function inferUnilateral(name) {
  return /single[- ]leg|single[- ]arm|side-lying|half-kneeling|one arm|one leg|open book|figure-four|pigeon|couch|calf stretch|soleus stretch|hamstring stretch|quad stretch|hip flexor stretch|adductor stretch|upper-trap|levator|cross-body|triceps|posterior shoulder|doorway|pec stretch|wrist flexor|wrist extensor|straddle side reach|side plank|side lunge hold|cossack|lateral step-up|step-up|hip airplane/i.test(name)
}

function inferHoldSeconds(name) { return /flexibility|fold|pigeon|frog|couch|straddle|butterfly/i.test(name) ? 40 : 30 }
function inferReps(name) { return /circle|car|rotation|rock|switch|reach|raise|lunge|squat|bridge|kick|march|tap/i.test(name) ? 8 : 10 }
function inferSecondsPerRep(name) { return /hop|skip|jack|fast feet|high knees|butt kicks|pogo/i.test(name) ? 2 : /car|controlled|rotation|nordic/i.test(name) ? 4 : 3 }

function inferInstruction(seed, prescriptionType) {
  const { name } = seed
  const lower = name.toLowerCase()
  const region = humanize(seed.bodyRegions[0]).toLowerCase()

  if (/90\/90|shin box/.test(lower)) return 'Sit with both knees bent and feet wider than your hips. Lower both knees toward one side while keeping your chest tall, then return through center or hold the end position as named.'
  if (/dead bug/.test(lower)) return 'Lie on your back with your arms up and hips and knees bent to 90 degrees. Brace gently, lower the named arm-and-leg pattern without letting your low back lift, then return with control.'
  if (/bird dog/.test(lower)) return 'Start on hands and knees with your spine neutral. Reach one arm and the opposite leg long without rotating your hips, then return slowly or hold as named.'
  if (/glute bridge|frog pump/.test(lower)) return 'Lie on your back with knees bent and feet planted; for a frog pump, place the soles of your feet together. Press through your feet, squeeze your glutes, and lift your hips without arching your low back.'
  if (/hip thrust/.test(lower)) return 'Place your upper back against a stable bench or chair with your feet flat. Drive through your feet and lift your hips until your trunk and thighs form a straight line, then lower under control.'
  if (/clamshell/.test(lower)) return /reverse/.test(lower) ? 'Lie on your side with hips and knees bent and your knees together. Keep both knees touching as you lift the top foot, then lower it without rolling your pelvis backward.' : 'Lie on your side with hips and knees bent and feet together. Keep your pelvis stacked as you open the top knee, then close it slowly without rolling backward.'
  if (/fire hydrant/.test(lower)) return 'Start on hands and knees with your trunk still. Lift one bent knee out to the side without hiking or rotating your pelvis, then lower it with control.'
  if (/donkey kick|quadruped hip extension/.test(lower)) return 'Start on hands and knees and brace lightly. Drive one heel up and back by extending the hip while keeping your knee bent and low back quiet, then return slowly.'
  if (/side-lying hip abduction/.test(lower)) return 'Lie on your side with the bottom knee bent and top leg straight. Keep the top toes facing forward as you lift the leg from the outer hip, then lower without rolling backward.'
  if (/side-lying adductor raise/.test(lower)) return 'Lie on your side with the top leg crossed in front and the bottom leg straight. Lift the bottom leg a few inches using the inner thigh, then lower it slowly.'
  if (/copenhagen/.test(lower)) return 'Lie on your side with the top knee supported on a stable bench and your elbow beneath your shoulder. Lift your hips and press the supported inner thigh down so your trunk stays in one straight line.'
  if (/hip flexor/.test(lower)) return /standing/.test(lower) ? 'Take a short split stance and tuck your pelvis slightly. Squeeze the glute of the back leg and shift forward until you feel the front of that hip lengthen.' : 'Kneel with one foot in front and the other knee down. Tuck your pelvis, squeeze the glute of the kneeling side, and shift forward without arching your back.'
  if (/quad stretch|heel-to-glute|quad pull/.test(lower)) return /side-lying|prone/.test(lower) ? 'Lie in the named position, bend one knee, and hold that ankle or pant leg. Draw the heel toward your glute while keeping both knees close and your pelvis still.' : 'Stand tall near support, bend one knee, and hold that ankle or pant leg behind you. Keep your knees close and gently tuck your pelvis instead of arching your back.'
  if (/calf stretch|soleus stretch/.test(lower)) return `Face a wall in a split stance with both feet pointing forward. Keep the back heel down and ${/soleus|bent-knee/.test(lower) ? 'bend the back knee slightly' : 'keep the back knee straight'} as you shift toward the wall.`
  if (/hamstring stretch|half-split|toe reach|forward fold/.test(lower)) return /supine/.test(lower) ? 'Lie on your back and raise one leg, holding behind the thigh or using a strap. Gently straighten the knee until the back of the thigh lengthens while your pelvis stays heavy.' : 'Place the working leg straight in front of you with the heel down and toes up. Hinge forward from your hips with a long spine until you feel the back of the thigh lengthen.'
  if (/figure-four|glute stretch|pigeon/.test(lower)) return /chair|seated/.test(lower) ? 'Sit tall and cross one ankle over the opposite thigh. Keep the foot flexed and hinge forward from your hips until you feel the outside of the crossed-leg hip.' : 'Cross one ankle over the opposite thigh while lying down, or place the front shin across the floor for pigeon. Keep the front foot active and shift only far enough to feel the outside of the hip.'
  if (/adductor|groin|frog|butterfly|straddle/.test(lower) && /stretch|fold|hold|rock/.test(lower)) return /butterfly/.test(lower) ? 'Sit with the soles of your feet together and let your knees open comfortably. Hold your ankles and hinge forward with a long spine without pressing the knees down.' : /frog/.test(lower) ? 'Start on hands and knees, slide your knees apart, and keep your lower legs roughly parallel. Rock your hips backward or hold when you feel a comfortable inner-thigh stretch.' : 'Take a wide stance or seated straddle with toes pointing up or forward. Shift or hinge toward the named side while keeping the opposite leg long and both feet grounded.'
  if (/cross-body shoulder|posterior shoulder/.test(lower)) return 'Bring one arm across your chest at shoulder height. Use the other forearm to draw it closer while keeping the stretching shoulder down and away from your ear.'
  if (/triceps stretch/.test(lower)) return 'Reach one arm overhead, bend the elbow, and let the hand move down your upper back. Use the opposite hand to guide the elbow gently without flaring your ribs.'
  if (/doorway pec|doorway chest|wall pec|chest stretch/.test(lower)) return 'Place your forearm on a wall or doorway with the elbow near shoulder height. Step and rotate your chest away slowly while keeping the shoulder down and back.'
  if (/lat stretch|lat-thoracic/.test(lower)) return 'Place your hands on a wall, bench, or the floor and send your hips backward. Let your chest sink between your arms while keeping your ribs gently tucked.'
  if (/upper-trap/.test(lower)) return 'Sit or stand tall and hold the seat or reach the working arm toward the floor. Tilt the opposite ear toward the opposite shoulder without turning or forcing your neck.'
  if (/levator/.test(lower)) return 'Sit tall, turn your head about 45 degrees away, and look down toward the opposite front pocket. Use only light hand pressure while the working shoulder stays down.'
  if (/neck rotation/.test(lower)) return 'Sit or stand tall with your chin level. Turn your head slowly to look over one shoulder, return to center, and repeat without tipping or forcing the range.'
  if (/chin tuck/.test(lower)) return 'Sit or lie with your eyes level and the back of your head supported if needed. Slide your chin straight backward to make a small double chin without looking down.'
  if (/wrist flexor stretch/.test(lower)) return 'Extend one arm with the palm up and elbow straight. Use the other hand to guide the fingers down and back until the palm-side forearm stretches.'
  if (/wrist extensor stretch/.test(lower)) return 'Extend one arm with the palm down and elbow straight. Use the other hand to bend the wrist and fingers toward the floor until the top of the forearm stretches.'
  if (/wrist circle/.test(lower)) return 'Hold your forearms still with relaxed hands. Draw slow circles with both wrists through a comfortable range, then reverse direction.'
  if (/thread the needle/.test(lower)) return 'Start on hands and knees, slide one arm palm-up underneath the other, and lower that shoulder toward the floor. Return through center by pressing into the planted hand and rotating the chest open.'
  if (/open book|side-lying thoracic rotation/.test(lower)) return 'Lie on your side with hips and knees bent and both arms reaching forward. Sweep the top arm open as your upper back rotates, keeping both knees stacked.'
  if (/thoracic rotation/.test(lower)) return 'Set up in the named standing, seated, or kneeling position with your hips facing forward. Rotate your upper back toward the working side while your pelvis and low back stay quiet, then return to center.'
  if (/thoracic extension|wall shoulder flexion/.test(lower)) return 'Place your hands on a wall or bench and step back. Send your chest gently down between your arms while keeping your ribs from flaring and your low back neutral.'
  if (/cat-cow|spine flexion-extension/.test(lower)) return 'Start on hands and knees. Exhale as you round your spine, then inhale as you move through neutral into a gentle arch without forcing your neck or low back.'
  if (/child's pose/.test(lower)) return 'Start on hands and knees, sit your hips back toward your heels, and reach both arms forward. For a side reach, walk both hands to one side while keeping your hips heavy.'
  if (/cobra|sphinx|prone press-up/.test(lower)) return 'Lie face down with your hands or forearms beneath your shoulders. Press your chest up only as far as comfortable while your pelvis stays on the floor and your shoulders stay away from your ears.'
  if (/wall slide|wall angel|scapular wall slide/.test(lower)) return 'Stand with your back and forearms against a wall and ribs gently down. Slide your arms upward without shrugging or letting your low back arch, then return slowly.'
  if (/floor angel/.test(lower)) return 'Lie on your back with knees bent and arms on the floor in a goalpost shape. Slide your arms overhead while keeping your ribs down, then return without forcing your hands flat.'
  if (/scapular push-up/.test(lower)) return 'Begin in a high plank or on hands and knees with elbows straight. Let your chest sink slightly between your shoulders, then push the floor away to spread your shoulder blades.'
  if (/scapular retraction|band row/.test(lower)) return 'Hold the band or set your arms in front with your ribs stacked over your pelvis. Pull your elbows back and draw your shoulder blades gently together, then return without shrugging.'
  if (/serratus punch/.test(lower)) return 'Hold the band or reach one arm toward the ceiling with the elbow straight. Push the hand farther away by sliding the shoulder blade around your ribs, then return without shrugging.'
  if (/pallof|anti-rotation/.test(lower)) return 'Stand or kneel sideways to an anchored band and hold it at your chest. Press your hands straight forward while resisting the band’s pull to rotate you, then return slowly.'
  if (/plank/.test(lower)) return 'Place your elbows or hands beneath your shoulders and extend your body into one straight line. Brace your trunk and squeeze your glutes so your hips do not sag, hike, or rotate.'
  if (/reverse crunch/.test(lower)) return 'Lie on your back with hips and knees bent. Curl your pelvis toward your ribs to lift your tailbone slightly, then lower without swinging your legs.'
  if (/leg lower|heel tap/.test(lower)) return 'Lie on your back with your low back gently supported and hips and knees bent. Lower the named heel or leg without letting your ribs flare or back lift, then return with control.'
  if (/mcgill curl-up/.test(lower)) return 'Lie on your back with one knee bent, the other leg straight, and hands supporting the natural curve of your low back. Lift your head and shoulders slightly as one unit without flattening or rounding your lower spine.'
  if (/squat|cossack/.test(lower)) return /cossack|lateral/.test(lower) ? 'Take a wide stance and shift your hips toward one side as that knee bends and the opposite leg stays long. Keep the working foot flat and chest tall, using support if needed.' : 'Stand with feet about shoulder-width apart and brace lightly. Sit your hips down and back while your knees track over your toes, then press through your whole feet to stand.'
  if (/lunge/.test(lower)) return 'Step into the named lunge stance with both feet stable. Lower by bending both knees while keeping the front knee over the middle toes, then push through the front foot to return.'
  if (/single-leg rdl|hip airplane/.test(lower)) return 'Stand on one leg with a soft knee and hold support if needed. Hinge at the hip as the free leg reaches back, keeping your pelvis level before returning to tall.'
  if (/step-up/.test(lower)) return 'Place one whole foot on a stable step or bench. Drive through that foot to stand tall on the platform without pushing off the floor leg, then lower slowly.'
  if (/calf raise|heel raise/.test(lower)) return 'Stand tall with your feet flat and use support as needed. Press through the balls of your feet to lift your heels straight up, pause, then lower slowly.'
  if (/toe raise|tibialis raise/.test(lower)) return 'Stand with your back near a wall and heels planted. Lift the front of both feet toward your shins without rocking your hips, then lower with control.'
  if (/toe yoga|big-toe lift|four-toe lift|toe spread|short-foot/.test(lower)) return 'Keep your heel and the ball of your foot planted. Move only the named toes, or gently draw the ball of the big toe toward the heel, without curling all of the toes.'
  if (/ankle alphabet/.test(lower)) return 'Sit with one foot lifted off the floor and keep your lower leg still. Trace the alphabet in the air with your big toe, using the ankle rather than the whole leg.'
  if (/ankle circle|hip circle|arm circle|shoulder circle/.test(lower)) return `Keep the rest of your body still and draw slow circles with the ${/ankle/.test(lower) ? 'foot from the ankle' : /hip/.test(lower) ? 'knee from the hip' : 'arms from the shoulders'}. Use a smooth range, then reverse direction.`
  if (/\bcar\b/.test(lower)) return `Brace the rest of your body and slowly circle the working ${region.replace(/s$/, '')} through the largest pain-free range you can control. Move deliberately through every part of the circle before reversing direction.`
  if (/balance|clock reach|three-way reach|toe tap/.test(lower)) return 'Stand on one leg near a stable support with the knee softly bent. Keep your pelvis level as the free foot reaches or taps in the named directions, returning to center each time.'
  if (/leg swing/.test(lower)) return 'Stand tall beside a stable support and keep your trunk still. Swing one leg in the named direction with a small controlled range, gradually increasing only if it stays smooth.'
  if (/hamstring sweep|hamstring scoop/.test(lower)) return 'Step one heel forward with the toes lifted and keep that knee nearly straight. Push your hips back and sweep both hands past the foot, then stand and switch sides.'
  if (/knee hug/.test(lower)) return 'Stand tall, bring one knee toward your chest, and briefly hold the shin without leaning backward. Release, step forward, and repeat on the other side.'
  if (/inchworm|walkout/.test(lower)) return 'Hinge forward, place your hands on the floor, and walk them out to a strong high plank. Walk your hands back toward your feet and stand without rushing the transition.'
  if (/hop|skip|jump|jack|fast feet|high knees|butt kicks|pogo/.test(lower)) return `Begin in an athletic stance and perform ${name.toLowerCase()} with light, quiet contacts. Keep your knees aligned over your toes and stop before speed causes sloppy landings.`
  if (/rock/.test(lower)) return `Set up in the named position and keep the working joint aligned. Shift your weight slowly into the ${region} until you reach a comfortable limit, then return without bouncing.`
  if (/rotation|wiper|switch/.test(lower)) return `Set up in the named position with your trunk supported. Move through the ${name.toLowerCase()} slowly while the rest of your body stays quiet, then return through center.`
  if (/raise|abduction|extension|kick/.test(lower)) return `Use a stable position and keep your trunk and pelvis still. Move the working limb in the direction named by ${name.toLowerCase()}, pause briefly, then return without momentum.`
  if (prescriptionType === 'time') return `Move slowly into the ${name.toLowerCase()} position until you feel comfortable tension around the ${region}. Keep breathing and hold without bouncing, pinching, or forcing a deeper range.`
  return `Set your body in the starting position for ${name.toLowerCase()} and keep the ${region} aligned. Perform the named motion slowly through a pain-free range, pause with control, and return to the exact start position.`
}

function inferShouldFeel(seed, categories) {
  if (categories.includes('flexibility')) return [`gentle, broad tension around the ${humanize(seed.bodyRegions[0]).toLowerCase()}`, 'steady breathing with no pinching or sharp pain']
  if (categories.includes('warm_up')) return ['light, coordinated movement', 'gradually increasing warmth without fatigue']
  return [`controlled muscular work around the ${humanize(seed.bodyRegions[0]).toLowerCase()}`, 'smooth motion without joint pain']
}

function inferAvoid(name, prescriptionType) {
  const avoid = prescriptionType === 'time' ? ['bouncing or forcing a deeper range', 'holding your breath'] : ['rushing or using momentum', 'losing control of the starting position']
  if (/neck/i.test(name)) avoid.unshift('forcing or circling the neck aggressively')
  if (/hop|jump|pogo/i.test(name)) avoid.push('hard, noisy landings or continuing when coordination fades')
  return avoid.slice(0, 3)
}

function isDemanding(name) { return /jump|hop|pogo|fast feet|high knees|butt kicks|a-skip|lunge switch|copenhagen|reverse nordic|step-up/i.test(name) }
function inferMovementType(categories) { return categories.includes('flexibility') ? 'flexibility' : categories.includes('warm_up') ? 'dynamic' : categories.includes('activation') ? 'activation' : 'mobility' }
function inferPosition(name) { return /supine|dead bug|bridge|floor angel|reverse crunch|leg lower/i.test(name) ? 'lying' : /prone|pigeon|cobra/i.test(name) ? 'prone' : /quadruped|bird dog|cat-cow|thread|rock-back|fire hydrant|donkey kick/i.test(name) ? 'quadruped' : /seated|straddle|butterfly|90\/90|shin box/i.test(name) ? 'seated' : /kneeling|half-kneeling/i.test(name) ? 'kneeling' : 'standing' }

function expandPainRegion(region) {
  const map = { full_body: ['neck', 'shoulder', 'back', 'hip', 'knee', 'ankle'], thoracic_spine: ['back', 'rib'], upper_back: ['back', 'shoulder'], shoulders: ['shoulder'], scapular_region: ['shoulder', 'back'], quadriceps: ['thigh', 'knee'], hamstrings: ['hamstring', 'hip', 'knee'], hips: ['hip', 'groin'], adductors: ['groin', 'hip'], groin: ['groin', 'hip'], glutes: ['hip', 'back'], core: ['back', 'abdomen'], trunk: ['back', 'abdomen'], ankles: ['ankle'], calves: ['calf', 'ankle'], feet: ['foot', 'ankle'], wrists: ['wrist'], forearms: ['wrist', 'forearm'], neck: ['neck'], balance: ['ankle', 'knee', 'hip'] }
  return map[region] ?? [region.replace(/s$/, '')]
}

function normalizePrescription(value, movement) {
  const source = value && typeof value === 'object' ? value : {}
  if (movement.prescriptionType === 'time') return { type: 'time', durationSeconds: clamp(source.durationSeconds, 15, 90, movement.defaults.durationSeconds), sets: clamp(source.sets, 1, 3, 1), restSeconds: clamp(source.restSeconds, 0, 60, 0) }
  return { type: 'reps', reps: clamp(source.reps, 3, 20, movement.defaults.reps), sets: clamp(source.sets, 1, 3, 1), restSeconds: clamp(source.restSeconds, 0, 60, 0), secondsPerRep: movement.defaults.secondsPerRep }
}

function withPrescription(movement, prescription) {
  const dose = toLegacyDose(prescription)
  return { ...movement, prescription, dose, durationSeconds: prescription.durationSeconds ?? 0, reps: prescription.reps ?? 0, sets: prescription.sets, restSeconds: prescription.restSeconds }
}

function toLegacyDose(prescription) {
  return prescription.type === 'time'
    ? { model: 'timer', durationSeconds: prescription.durationSeconds, sets: prescription.sets, restSeconds: prescription.restSeconds }
    : { model: 'reps', reps: prescription.reps, sets: prescription.sets, restSeconds: prescription.restSeconds, tempoSecondsPerRep: prescription.secondsPerRep }
}

function cloneMovement(movement) {
  return { ...movement, categories: [...movement.categories], routineTypes: [...movement.routineTypes], bodyRegions: [...movement.bodyRegions], targetAreas: [...movement.targetAreas], equipment: [...movement.equipment], shouldFeel: [...movement.shouldFeel], avoid: [...movement.avoid], painSensitiveRegions: [...movement.painSensitiveRegions], tags: [...movement.tags], prescription: { ...movement.prescription }, defaults: { ...movement.defaults }, dose: { ...movement.dose }, doseModels: movement.doseModels.map((dose) => ({ ...dose })) }
}

function clamp(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback }
function slugify(value) { return String(value).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }
function humanize(value) { return String(value).replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) }
