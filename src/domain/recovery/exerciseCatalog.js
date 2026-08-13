export const RECOVERY_CATALOG_VERSION = 'recovery-catalog-2.0.0'

const UNIVERSAL_STOP_CONDITIONS = [
  'Sharp or worsening pain',
  'Numbness, tingling, or spreading symptoms',
  'Dizziness, unusual shortness of breath, or loss of balance',
  'A feeling that a joint is unstable or giving way',
]

const CATEGORY_PROFILES = {
  'Neck / upper trap': profile(['Neck', 'Upper traps'], ['upper trapezius', 'levator scapulae'], ['upper-body', 'posture']),
  Shoulder: profile(['Shoulders'], ['deltoids', 'scapular stabilizers'], ['upper-body', 'overhead']),
  'Rotator cuff': profile(['Shoulders'], ['rotator cuff'], ['upper-body', 'throwing', 'overhead']),
  Chest: profile(['Chest', 'Shoulders'], ['pectorals'], ['upper-body', 'pushing']),
  'Thoracic spine': profile(['Upper back'], ['thoracic extensors', 'obliques'], ['trunk', 'rotation']),
  Lats: profile(['Lats', 'Shoulders'], ['latissimus dorsi'], ['upper-body', 'overhead']),
  'Upper back': profile(['Upper back', 'Shoulder blades'], ['rhomboids', 'middle trapezius'], ['upper-body', 'posture']),
  'Lower back / trunk': profile(['Lower back', 'Trunk'], ['spinal erectors', 'obliques'], ['trunk', 'rotation']),
  Core: profile(['Trunk'], ['abdominals', 'deep core'], ['trunk', 'control']),
  'Hip flexors': profile(['Front of hips'], ['iliopsoas', 'rectus femoris'], ['lower-body', 'running']),
  Glutes: profile(['Glutes', 'Hips'], ['gluteus maximus', 'gluteus medius'], ['lower-body', 'running']),
  'Hip rotation': profile(['Hips'], ['deep hip rotators'], ['lower-body', 'change-of-direction']),
  Adductors: profile(['Inner thighs', 'Groin'], ['adductors'], ['lower-body', 'change-of-direction']),
  Abductors: profile(['Outer hips'], ['gluteus medius', 'hip abductors'], ['lower-body', 'lateral-movement']),
  Quadriceps: profile(['Front of thighs'], ['quadriceps'], ['lower-body', 'running', 'jumping']),
  Hamstrings: profile(['Back of thighs'], ['hamstrings'], ['lower-body', 'sprinting']),
  'Knees / knee control': profile(['Knees'], ['quadriceps', 'glutes'], ['lower-body', 'landing']),
  Calves: profile(['Calves'], ['gastrocnemius', 'soleus'], ['lower-body', 'running', 'jumping']),
  Ankles: profile(['Ankles'], ['ankle stabilizers'], ['lower-body', 'change-of-direction']),
  Feet: profile(['Feet'], ['intrinsic foot muscles'], ['lower-body', 'running']),
  'Full body': profile(['Full body'], ['multiple muscle groups'], ['full-body', 'general']),
}

// Each entry is a recognized movement with an explicit execution cue. The catalog
// stores one canonical movement; laterality is expanded only when composing a routine.
const SEEDS = [
  seed('neck-nods', 'Supine neck nods', 'Neck / upper trap', 'bilateral', 'control', [], 'Lie on your back and make a small yes motion, lengthening the back of the neck without lifting the head.'),
  seed('neck-rotation', 'Gentle neck rotation', 'Neck / upper trap', 'each-side', 'mobility', [], 'Sit tall and slowly turn your head toward one shoulder, return to center, then change sides without tipping the chin.'),
  seed('upper-trap-stretch', 'Upper trap stretch', 'Neck / upper trap', 'each-side', 'flexibility', [], 'Sit tall, hold the chair with one hand, and tip the opposite ear toward the opposite shoulder without rotating.'),
  seed('levator-scapulae-stretch', 'Levator scapulae stretch', 'Neck / upper trap', 'each-side', 'flexibility', [], 'Turn your head about 45 degrees, look toward the armpit, and add only light hand pressure.'),
  seed('shoulder-shrugs', 'Shoulder shrugs and release', 'Neck / upper trap', 'bilateral', 'mobility', [], 'Lift both shoulders toward the ears, pause briefly, then let them settle down and back.'),
  seed('scapular-clock', 'Scapular clock', 'Neck / upper trap', 'each-side', 'control', [], 'With one hand on a wall, glide that shoulder blade up, down, toward, and away from the spine without bending the elbow.'),

  seed('arm-circles', 'Arm circles', 'Shoulder', 'bilateral', 'mobility', [], 'Circle straight arms from small to comfortable larger arcs while keeping the ribs stacked over the hips.'),
  seed('shoulder-cars', 'Shoulder CARs', 'Shoulder', 'each-side', 'mobility', [], 'Move one straight arm slowly through the largest pain-free circle you can control without turning the trunk.'),
  seed('wall-angels', 'Wall angels', 'Shoulder', 'bilateral', 'control', ['Wall'], 'Keep the head, ribs, and hips quiet as the arms slide up and down the wall through a comfortable range.'),
  seed('scapular-wall-slide', 'Scapular wall slide', 'Shoulder', 'bilateral', 'control', ['Wall'], 'Press forearms lightly into the wall and slide them upward while the shoulder blades rotate smoothly.'),
  seed('wall-shoulder-flexion', 'Wall Shoulder Flexion', 'Shoulder', 'bilateral', 'mobility', ['Wall'], 'Slide both hands up the wall while the ribs stay stacked, stopping before the shoulders pinch or shrug.'),
  seed('serratus-wall-slide', 'Serratus Wall Slide', 'Shoulder', 'bilateral', 'activation', ['Wall'], 'Press the forearms into the wall and slide upward while reaching the shoulder blades around the rib cage.'),
  seed('cross-body-shoulder-stretch', 'Cross-body shoulder stretch', 'Shoulder', 'each-side', 'flexibility', [], 'Bring one arm across the chest and use the other forearm to draw it closer without hiking the shoulder.'),
  seed('sleeper-stretch', 'Sleeper stretch', 'Shoulder', 'each-side', 'flexibility', ['Mat'], 'Lie on one side with the shoulder and elbow at 90 degrees and gently rotate the forearm toward the floor without forcing.'),

  seed('band-external-rotation', 'Band external rotation', 'Rotator cuff', 'each-side', 'activation', ['Resistance band'], 'Keep the elbow against your side and rotate the forearm outward while the shoulder stays down.'),
  seed('band-internal-rotation', 'Band internal rotation', 'Rotator cuff', 'each-side', 'activation', ['Resistance band'], 'Keep the elbow against your side and draw the forearm toward the abdomen without turning the trunk.'),
  seed('band-no-money', 'Band no-money drill', 'Rotator cuff', 'bilateral', 'activation', ['Resistance band'], 'Hold elbows at your sides with palms up and separate the hands while gently setting the shoulder blades.'),
  seed('side-lying-external-rotation', 'Side-lying external rotation', 'Rotator cuff', 'each-side', 'activation', ['Light dumbbell', 'Mat'], 'Lie on your side with the top elbow tucked and rotate the forearm upward without rolling the torso back.'),
  seed('wall-isometric-external-rotation', 'Wall external-rotation isometric', 'Rotator cuff', 'each-side', 'isometric', ['Wall'], 'Press the back of the hand gently into a wall while the elbow stays tucked and the shoulder remains relaxed.'),
  seed('scaption-raise', 'Scaption raise', 'Rotator cuff', 'bilateral', 'activation', ['Light dumbbells'], 'Raise the arms in a shallow V with thumbs up, stopping below any painful or pinching range.'),

  seed('doorway-pec-stretch', 'Doorway pec stretch', 'Chest', 'each-side', 'flexibility', ['Doorway'], 'Place one forearm below shoulder height on a doorway and turn the chest away while keeping the shoulder down.'),
  seed('corner-chest-stretch', 'Corner chest stretch', 'Chest', 'bilateral', 'flexibility', ['Wall'], 'Place both forearms on adjacent walls and lean the body forward as one unit until the chest gently stretches.'),
  seed('floor-chest-opener', 'Floor chest opener', 'Chest', 'each-side', 'flexibility', ['Mat'], 'Lie face down with one arm out to the side and roll gently away from that arm without forcing the shoulder.'),
  seed('foam-roller-chest-opener', 'Foam roller chest opener', 'Chest', 'bilateral', 'flexibility', ['Foam roller'], 'Lie lengthwise on the roller with head supported and let the arms open only as far as the shoulders stay comfortable.'),
  seed('hands-behind-back-opener', 'Hands-behind-back chest opener', 'Chest', 'bilateral', 'mobility', [], 'Hold the hands or a strap behind you, lengthen the arms, and lift slightly without arching the low back.'),
  seed('bench-pec-stretch', 'Bench pec stretch', 'Chest', 'each-side', 'flexibility', ['Chair or bench'], 'Place one forearm on a bench and lower the chest slightly while keeping the shoulder away from the ear.'),

  seed('cat-cow', 'Cat-Cow', 'Thoracic spine', 'bilateral', 'mobility', ['Mat'], 'From hands and knees, round the spine slowly, then pass through neutral into a gentle extension.'),
  seed('thread-the-needle', 'Thread the Needle', 'Thoracic spine', 'each-side', 'mobility', ['Mat'], 'From hands and knees, slide one arm under the other, rotate through the upper back, then return and reach upward.'),
  seed('open-book', 'Open Book', 'Thoracic spine', 'each-side', 'mobility', ['Mat'], 'Lie on your side with knees stacked and open the top arm as the upper back rotates while the knees stay together.'),
  seed('thoracic-extension-roller', 'Thoracic extension on foam roller', 'Thoracic spine', 'bilateral', 'mobility', ['Foam roller'], 'Support the head, place the roller across the upper back, and extend over it without flaring the ribs.'),
  seed('quadruped-thoracic-rotation', 'Quadruped thoracic rotation', 'Thoracic spine', 'each-side', 'mobility', ['Mat'], 'Place one hand behind the head and rotate that elbow toward the supporting arm, then open toward the ceiling.'),
  seed('seated-thoracic-rotation', 'Seated thoracic rotation', 'Thoracic spine', 'each-side', 'mobility', ['Chair or bench'], 'Sit tall with arms crossed and rotate the rib cage while the hips and knees continue facing forward.'),

  seed('standing-lat-stretch', 'Standing lat stretch', 'Lats', 'each-side', 'flexibility', ['Wall'], 'Hold a stable support with one hand and sit the hips back while reaching that side long.'),
  seed('prayer-lat-stretch', 'Prayer lat stretch', 'Lats', 'bilateral', 'flexibility', ['Chair or bench'], 'Kneel with elbows on a bench and send the chest down while keeping the ribs gently controlled.'),
  seed('side-bend-lat-stretch', 'Side-bend lat stretch', 'Lats', 'each-side', 'flexibility', [], 'Reach one arm overhead and arc the trunk away without rotating or collapsing forward.'),
  seed('foam-roller-lat-roll', 'Foam roller lat roll', 'Lats', 'each-side', 'self-massage', ['Foam roller'], 'Lie partly on your side with the roller below the armpit and make short slow passes along the outer upper back.'),
  seed('childs-pose-side-reach', "Child's Pose side reach", 'Lats', 'each-side', 'flexibility', ['Mat'], 'From Child’s Pose, walk both hands to one side and breathe into the lengthened side of the trunk.'),
  seed('bench-lat-rock', 'Bench lat rock-back', 'Lats', 'bilateral', 'mobility', ['Chair or bench'], 'Place hands on a bench and rock the hips back while the spine stays long and shoulders remain comfortable.'),

  seed('band-pull-apart', 'Band pull-apart', 'Upper back', 'bilateral', 'activation', ['Resistance band'], 'Hold the band at chest height and separate the hands until the shoulder blades gently draw together.'),
  seed('foam-roller-thoracic-roll', 'Foam roller thoracic roll', 'Upper back', 'bilateral', 'self-massage', ['Foam roller'], 'Cross the arms and make short slow rolls from the lower shoulder blades to the upper back, avoiding the neck.'),
  seed('prone-y-raise', 'Prone Y raise', 'Upper back', 'bilateral', 'activation', ['Mat'], 'Lie face down and lift the arms in a Y using the shoulder blades without lifting the ribs.'),
  seed('prone-t-raise', 'Prone T raise', 'Upper back', 'bilateral', 'activation', ['Mat'], 'Lie face down with arms out to the sides and lift them slightly as the shoulder blades move together.'),
  seed('scapular-push-up', 'Scapular push-up', 'Upper back', 'bilateral', 'control', ['Mat'], 'From a wall or plank position, keep elbows straight while the chest moves between and then away from the hands.'),
  seed('wall-reach', 'Wall reach with scapular protraction', 'Upper back', 'bilateral', 'control', ['Wall'], 'Press forearms into a wall and reach the shoulder blades forward without rounding the low back.'),
  seed('band-face-pull', 'Band Face Pull', 'Upper back', 'bilateral', 'activation', ['Resistance band'], 'Pull the band toward eye level with elbows high enough to rotate comfortably, then return without shrugging.'),
  seed('prone-w-raise', 'Prone W Raise', 'Upper back', 'bilateral', 'activation', ['Mat'], 'Lie face down with elbows bent into a W and lift the arms slightly by drawing the shoulder blades down and together.'),

  seed('supine-trunk-rotation', 'Supine trunk rotation', 'Lower back / trunk', 'alternating', 'mobility', ['Mat'], 'Lie on your back with knees bent and lower both knees side to side through a comfortable range.'),
  seed('pelvic-tilt', 'Pelvic tilt', 'Lower back / trunk', 'bilateral', 'control', ['Mat'], 'Lie on your back and gently alternate between flattening and releasing the low back without pushing through the feet.'),
  seed('childs-pose', "Child's Pose", 'Lower back / trunk', 'bilateral', 'flexibility', ['Mat'], 'Sit the hips toward the heels and reach forward, stopping before knee, hip, or back discomfort.'),
  seed('gentle-press-up', 'Cobra / gentle press-up', 'Lower back / trunk', 'bilateral', 'mobility', ['Mat'], 'Lie face down and use the forearms or hands to lift the chest only as far as the low back remains comfortable.'),
  seed('knees-to-chest', 'Single knee-to-chest', 'Lower back / trunk', 'each-side', 'mobility', ['Mat'], 'Lie on your back and draw one thigh toward the trunk while the other leg remains relaxed.'),
  seed('standing-trunk-rotation', 'Standing trunk rotation', 'Lower back / trunk', 'alternating', 'mobility', [], 'Stand with soft knees and rotate the rib cage gently side to side while the pelvis stays mostly forward.'),

  seed('dead-bug', 'Dead Bug', 'Core', 'alternating', 'control', ['Mat'], 'Brace gently with hips and knees at 90 degrees, then lower opposite arm and leg without the low back lifting.'),
  seed('bird-dog', 'Bird Dog', 'Core', 'alternating', 'control', ['Mat'], 'From hands and knees, reach opposite arm and leg long while keeping the pelvis and rib cage level.'),
  seed('heel-slide', 'Supine heel slide', 'Core', 'alternating', 'control', ['Mat'], 'Brace gently and slide one heel away without letting the pelvis tip or the low back arch.'),
  seed('bent-knee-fallout', 'Bent-knee fallout', 'Core', 'alternating', 'control', ['Mat'], 'Lie with knees bent and let one knee open outward while the opposite side of the pelvis stays still.'),
  seed('bear-hover-breathing', 'Bear hover breathing', 'Core', 'bilateral', 'isometric', ['Mat'], 'From hands and knees, hover the knees slightly and take controlled breaths without rounding or sagging.'),
  seed('side-plank-knees', 'Side plank from knees', 'Core', 'each-side', 'isometric', ['Mat'], 'Support on one forearm and bent knees, then lift the hips so shoulders, hips, and knees align.'),
  seed('pallof-press', 'Pallof Press', 'Core', 'each-side', 'control', ['Resistance band'], 'Stand perpendicular to an anchored band and press the hands forward without letting the trunk rotate.'),
  seed('dead-bug-heel-tap', 'Dead Bug Heel Tap', 'Core', 'alternating', 'control', ['Mat'], 'Hold the hips and knees near 90 degrees and tap one heel down at a time while the trunk stays braced.'),

  seed('half-kneeling-hip-flexor', 'Half-kneeling hip flexor stretch', 'Hip flexors', 'each-side', 'flexibility', ['Mat'], 'Tuck the pelvis slightly in a half-kneeling stance and shift forward without arching the low back.'),
  seed('couch-stretch', 'Couch stretch', 'Hip flexors', 'each-side', 'flexibility', ['Wall', 'Mat'], 'Set the rear shin near a wall, squeeze that glute, and bring the torso upright only as comfort allows.'),
  seed('standing-hip-flexor-stretch', 'Standing hip flexor stretch', 'Hip flexors', 'each-side', 'flexibility', [], 'Take a split stance, tuck the pelvis, and shift forward while the rear heel may lift.'),
  seed('rear-foot-elevated-hip-flexor-rock', 'Rear-foot-elevated hip flexor rock', 'Hip flexors', 'each-side', 'mobility', ['Chair or bench'], 'Place the rear foot on a low support and make small forward rocks while the pelvis stays tucked.'),
  seed('walking-knee-hug', 'Walking knee hug', 'Hip flexors', 'alternating', 'mobility', [], 'Stand tall, draw one knee toward the chest briefly, step through, and alternate without leaning back.'),
  seed('marching-hip-flexion', 'Controlled marching', 'Hip flexors', 'alternating', 'activation', [], 'Lift one knee to a comfortable height while staying tall, lower quietly, and alternate.'),

  seed('glute-bridge', 'Glute Bridge', 'Glutes', 'bilateral', 'activation', ['Mat'], 'Drive through both feet and lift the hips until the trunk and thighs align without arching the back.'),
  seed('single-leg-glute-bridge', 'Single-leg glute bridge', 'Glutes', 'each-side', 'activation', ['Mat'], 'Keep one thigh lifted and raise the hips using the planted leg without allowing the pelvis to rotate.'),
  seed('figure-four-stretch', 'Figure-Four Stretch', 'Glutes', 'each-side', 'flexibility', ['Mat'], 'Cross one ankle over the opposite thigh and draw the supporting thigh toward you while the pelvis stays level.'),
  seed('pigeon-variation', 'Supported pigeon variation', 'Glutes', 'each-side', 'flexibility', ['Mat', 'Yoga blocks'], 'Support the front hip as needed and hinge forward only until the outer hip feels a mild stretch.'),
  seed('quadruped-hip-extension', 'Quadruped hip extension', 'Glutes', 'each-side', 'activation', ['Mat'], 'From hands and knees, press one heel back and slightly up without rotating the pelvis or arching the back.'),
  seed('standing-glute-squeeze', 'Standing glute squeeze', 'Glutes', 'bilateral', 'isometric', [], 'Stand tall, gently contract both glutes, hold without clenching the low back, then fully release.'),

  seed('hip-switches-90-90', '90/90 Hip Switch', 'Hip rotation', 'alternating', 'mobility', ['Mat'], 'Sit with knees bent and rotate both knees from one side to the other while the feet stay planted.'),
  seed('hip-stretch-90-90', '90/90 Hip Stretch', 'Hip rotation', 'each-side', 'flexibility', ['Mat'], 'Set both knees near 90 degrees and hinge over the front shin while keeping the spine long.'),
  seed('hip-cars', 'Hip CARs', 'Hip rotation', 'each-side', 'mobility', [], 'Use support and move one knee through a slow controlled circle without turning the pelvis.'),
  seed('prone-hip-rotation', 'Prone hip rotation', 'Hip rotation', 'alternating', 'mobility', ['Mat'], 'Lie face down with knees bent and let the feet move apart and together while the pelvis remains heavy.'),
  seed('shin-box-get-up', 'Shin-box transition', 'Hip rotation', 'alternating', 'control', ['Mat'], 'Move between 90/90 positions and lift the hips slightly using control rather than momentum.'),
  seed('standing-hip-openers', 'Standing hip openers', 'Hip rotation', 'alternating', 'mobility', [], 'Lift one knee, guide it outward in a controlled circle, place the foot down, and alternate.'),
  seed('quadruped-hip-cars', 'Quadruped Hip CARs', 'Hip rotation', 'each-side', 'mobility', ['Mat'], 'From hands and knees, move one knee through a slow controlled circle while the pelvis stays level.'),
  seed('supported-hip-airplane', 'Supported Hip Airplane', 'Hip rotation', 'each-side', 'control', ['Stable support'], 'Balance with light support, hinge over one leg, and rotate the pelvis open and closed without losing foot pressure.'),

  seed('adductor-rock-back', 'Adductor Rock-Back', 'Adductors', 'each-side', 'mobility', ['Mat'], 'Extend one leg to the side from hands and knees and rock the hips back toward the bent-leg heel.'),
  seed('frog-stretch', 'Frog Stretch', 'Adductors', 'bilateral', 'flexibility', ['Mat'], 'Widen the knees from hands and knees and rock back only until the inner thighs gently stretch.'),
  seed('butterfly-stretch', 'Butterfly Stretch', 'Adductors', 'bilateral', 'flexibility', ['Mat'], 'Sit with soles together, keep the spine long, and hinge forward without pressing on the knees.'),
  seed('cossack-shift', 'Cossack Shift', 'Adductors', 'alternating', 'mobility', [], 'Use a wide stance and shift the hips toward one bent knee while the other leg lengthens, then change sides.'),
  seed('lateral-lunge-shift', 'Lateral lunge shift', 'Adductors', 'alternating', 'mobility', [], 'Step wide and move the hips side to side while each working knee tracks over the toes.'),
  seed('standing-adductor-stretch', 'Standing adductor stretch', 'Adductors', 'each-side', 'flexibility', [], 'Take a wide stance, bend one knee, and sit toward it while the other leg remains long.'),
  seed('half-kneeling-adductor-shift', 'Half-Kneeling Adductor Shift', 'Adductors', 'each-side', 'mobility', ['Mat'], 'Extend one leg to the side from a half-kneeling position and shift the hips back while the long foot stays planted.'),

  seed('clamshell', 'Clamshell', 'Abductors', 'each-side', 'activation', ['Mini band', 'Mat'], 'Lie on your side with knees bent and open the top knee without rolling the pelvis backward.'),
  seed('side-lying-hip-abduction', 'Side-Lying Hip Abduction', 'Abductors', 'each-side', 'activation', ['Mat'], 'Keep the top leg long and slightly behind you as it lifts without the toes turning toward the ceiling.'),
  seed('mini-band-lateral-walk', 'Mini-Band Lateral Walk', 'Abductors', 'alternating', 'activation', ['Mini band'], 'Stay in a shallow athletic stance and take controlled side steps while keeping constant band tension.'),
  seed('monster-walk', 'Monster Walk', 'Abductors', 'alternating', 'activation', ['Mini band'], 'Maintain a shallow squat and take diagonal steps forward and backward without the knees collapsing inward.'),
  seed('standing-hip-abduction', 'Standing hip abduction', 'Abductors', 'each-side', 'activation', [], 'Use support and move one straight leg slightly outward without leaning or rotating the toes up.'),
  seed('lateral-step-down-control', 'Lateral step-down control', 'Abductors', 'each-side', 'control', ['Low step'], 'Stand on a low step and lower the free heel toward the floor while the stance knee tracks over the foot.'),
  seed('quadruped-fire-hydrant', 'Quadruped Fire Hydrant', 'Abductors', 'each-side', 'activation', ['Mat'], 'From hands and knees, lift one bent knee to the side without rotating the pelvis or shifting through the trunk.'),

  seed('standing-quad-stretch', 'Standing Quad Stretch', 'Quadriceps', 'each-side', 'flexibility', [], 'Hold the ankle behind you, keep knees close, and tuck the pelvis without pulling the heel forcefully.'),
  seed('side-lying-quad-stretch', 'Side-Lying Quad Stretch', 'Quadriceps', 'each-side', 'flexibility', ['Mat'], 'Lie on your side, hold the top ankle, and bring the thigh slightly behind without arching the back.'),
  seed('prone-quad-stretch-strap', 'Prone quad stretch with strap', 'Quadriceps', 'each-side', 'flexibility', ['Stretching strap', 'Mat'], 'Lie face down and use a strap to bend one knee until the front thigh gently stretches.'),
  seed('walking-quad-pull', 'Walking Quad Pull', 'Quadriceps', 'alternating', 'mobility', [], 'Briefly hold one ankle behind you while standing tall, release, step forward, and alternate.'),
  seed('reverse-lunge-mobility', 'Reverse Lunge Mobility', 'Quadriceps', 'alternating', 'mobility', [], 'Step backward into a shallow lunge, keep the front knee tracking over the foot, then return and alternate.'),
  seed('quad-foam-roll', 'Quadriceps foam roll', 'Quadriceps', 'each-side', 'self-massage', ['Foam roller'], 'Support on the forearms and make slow passes along one front thigh, avoiding direct pressure on the kneecap.'),
  seed('quad-set-isometric', 'Quad Set Isometric', 'Quadriceps', 'each-side', 'isometric', ['Mat'], 'Sit or lie with one leg straight and tighten the thigh to gently press the back of the knee toward the floor.'),

  seed('supine-hamstring-stretch', 'Supine Hamstring Stretch', 'Hamstrings', 'each-side', 'flexibility', ['Stretching strap', 'Mat'], 'Lift one thigh and slowly straighten the knee while the pelvis and opposite leg stay relaxed.'),
  seed('seated-hamstring-stretch', 'Seated Hamstring Stretch', 'Hamstrings', 'each-side', 'flexibility', [], 'Extend one leg, keep the spine long, and hinge from the hips toward that thigh.'),
  seed('standing-hamstring-stretch', 'Standing Hamstring Stretch', 'Hamstrings', 'each-side', 'flexibility', ['Chair or bench'], 'Place one heel on a low support and hinge forward with a long spine and soft knee.'),
  seed('hamstring-floss', 'Hamstring Floss', 'Hamstrings', 'each-side', 'mobility', ['Mat'], 'Support the thigh, alternate slowly between straightening the knee with toes pointed and bending it with toes drawn back.'),
  seed('hamstring-sweeps', 'Walking hamstring sweep', 'Hamstrings', 'alternating', 'mobility', [], 'Place one heel forward, sit the hips back, sweep the hands toward the toes, then step through.'),
  seed('hamstring-bridge-walkout', 'Hamstring bridge walkout', 'Hamstrings', 'bilateral', 'activation', ['Mat'], 'Lift into a bridge and take small heel steps away and back while keeping the hips controlled.'),
  seed('hamstring-heel-dig', 'Hamstring Heel-Dig Isometric', 'Hamstrings', 'each-side', 'isometric', ['Mat'], 'Lie with one knee bent, press that heel down and back without sliding it, and hold the pelvis steady.'),
  seed('active-straight-leg-raise', 'Active Straight-Leg Raise', 'Hamstrings', 'each-side', 'control', ['Mat'], 'Keep one leg long on the floor and lift the other straight leg without bending the knee or tipping the pelvis.'),

  seed('bodyweight-squat', 'Bodyweight Squat to Comfortable Depth', 'Knees / knee control', 'bilateral', 'control', [], 'Sit between the hips to a comfortable depth while knees track with the toes, then stand evenly.'),
  seed('supported-deep-squat-hold', 'Supported Deep Squat Hold', 'Knees / knee control', 'bilateral', 'flexibility', ['Stable support'], 'Hold a stable support and settle into a comfortable squat while heels stay grounded as able.'),
  seed('terminal-knee-extension-band', 'Band terminal knee extension', 'Knees / knee control', 'each-side', 'activation', ['Resistance band'], 'Place a band behind one knee, bend slightly, then straighten the knee by tightening the thigh.'),
  seed('step-up-control', 'Low step-up control', 'Knees / knee control', 'each-side', 'control', ['Low step'], 'Step onto a low platform, stand tall through the whole foot, and lower slowly without the knee collapsing inward.'),
  seed('split-squat-isometric', 'Supported split-squat isometric', 'Knees / knee control', 'each-side', 'isometric', ['Stable support'], 'Use support, lower into a shallow split stance, and hold with the front knee tracking over the foot.'),
  seed('wall-sit-comfortable', 'Comfortable wall sit', 'Knees / knee control', 'bilateral', 'isometric', ['Wall'], 'Slide down a wall to a shallow comfortable angle and hold while pressure stays even through both feet.'),
  seed('spanish-squat-isometric', 'Spanish Squat Isometric', 'Knees / knee control', 'bilateral', 'isometric', ['Resistance band'], 'Lean back against a strong band behind the knees and hold a comfortable squat with the torso upright.'),

  seed('calf-stretch-straight-knee', 'Calf Stretch — Straight Knee', 'Calves', 'each-side', 'flexibility', ['Wall'], 'Step one foot back, keep that knee straight and heel down, and shift toward the wall.'),
  seed('soleus-stretch-bent-knee', 'Soleus Stretch — Bent Knee', 'Calves', 'each-side', 'flexibility', ['Wall'], 'Step one foot back, bend that knee while keeping the heel down, and shift forward gently.'),
  seed('calf-raises', 'Calf Raises', 'Calves', 'bilateral', 'activation', [], 'Rise through the balls of both feet, pause without rolling the ankles, and lower slowly.'),
  seed('single-leg-calf-raise', 'Supported single-leg calf raise', 'Calves', 'each-side', 'activation', ['Stable support'], 'Use light support, rise through one forefoot with the ankle aligned, then lower under control.'),
  seed('seated-calf-raise', 'Seated calf raise', 'Calves', 'bilateral', 'activation', ['Chair or bench'], 'Sit with feet flat, lift both heels while the toes stay down, pause, and lower slowly.'),
  seed('calf-foam-roll', 'Calf foam roll', 'Calves', 'each-side', 'self-massage', ['Foam roller'], 'Support with the hands and make slow passes along one calf, avoiding direct pressure behind the knee.'),
  seed('eccentric-calf-lower', 'Eccentric Calf Lower', 'Calves', 'each-side', 'control', ['Stable support'], 'Rise using both feet, shift to one foot, and lower that heel slowly while using support for balance.'),

  seed('ankle-knee-to-wall', 'Ankle Knee-to-Wall', 'Ankles', 'each-side', 'mobility', ['Wall'], 'Keep the heel down and guide the knee toward the wall in line with the middle toes, then return.'),
  seed('ankle-circles', 'Ankle Circles', 'Ankles', 'each-side', 'mobility', [], 'Lift one foot and draw slow circles with the toes while the lower leg stays still.'),
  seed('ankle-cars', 'Ankle CARs', 'Ankles', 'each-side', 'mobility', [], 'Trace the largest controlled ankle circle you can without moving the knee.'),
  seed('heel-to-toe-rock', 'Heel-to-Toe Rock', 'Ankles', 'bilateral', 'mobility', [], 'Rock from heels to forefeet slowly while the body stays tall and movement remains controlled.'),
  seed('band-ankle-eversion', 'Band ankle eversion', 'Ankles', 'each-side', 'activation', ['Resistance band'], 'Anchor a band inward and turn the forefoot outward without rotating the knee.'),
  seed('single-leg-balance', 'Supported single-leg balance', 'Ankles', 'each-side', 'control', ['Stable support'], 'Stand on one foot with light fingertip support and keep the arch, knee, and hip aligned.'),
  seed('banded-ankle-dorsiflexion', 'Banded Ankle Dorsiflexion', 'Ankles', 'each-side', 'mobility', ['Resistance band'], 'Anchor a band low around the front of the ankle and guide the knee forward over the toes while the heel stays down.'),

  seed('toe-raises', 'Toe Raises', 'Feet', 'bilateral', 'activation', [], 'Keep both heels down, lift the forefeet and toes, then lower quietly.'),
  seed('tibialis-raises', 'Tibialis Raises', 'Feet', 'bilateral', 'activation', ['Wall'], 'Lean lightly against a wall with heels down and lift both forefeet toward the shins.'),
  seed('short-foot', 'Foot Doming / Short Foot', 'Feet', 'each-side', 'activation', [], 'Keep toes relaxed and gently draw the ball of the big toe toward the heel to raise the arch.'),
  seed('toe-yoga', 'Toe Yoga', 'Feet', 'each-side', 'control', [], 'Alternate lifting the big toe alone and the four smaller toes alone without rolling the foot.'),
  seed('toe-spread', 'Toe spread and relax', 'Feet', 'bilateral', 'control', [], 'Spread all toes without curling them, hold briefly, then let the feet fully relax.'),
  seed('ball-foot-roll', 'Massage ball foot roll', 'Feet', 'each-side', 'self-massage', ['Massage ball'], 'Roll the sole slowly over a ball with light pressure, avoiding any sharp or bruised area.'),
  seed('foot-tripod-balance', 'Foot Tripod Balance', 'Feet', 'each-side', 'control', ['Stable support'], 'Balance with light support while keeping pressure under the heel, big-toe base, and little-toe base.'),

  seed('worlds-greatest-stretch', "World's Greatest Stretch", 'Full body', 'each-side', 'mobility', ['Mat'], 'Step into a long lunge, place the inside hand down, rotate the other arm upward, then return with control.'),
  seed('inchworm', 'Inchworm', 'Full body', 'alternating', 'mobility', [], 'Hinge forward, walk the hands to a comfortable plank, pause, and walk back without rushing.'),
  seed('leg-swings-front-back', 'Leg Swings Front/Back', 'Full body', 'each-side', 'mobility', ['Stable support'], 'Use support and swing one leg forward and back from the hip while the trunk stays tall.'),
  seed('leg-swings-side', 'Leg Swings Side-to-Side', 'Full body', 'each-side', 'mobility', ['Stable support'], 'Use support and swing one leg across and away from the body without twisting the pelvis.'),
  seed('walking-lunge-reach', 'Walking lunge with reach', 'Full body', 'alternating', 'mobility', [], 'Step into a shallow lunge and reach overhead without arching, then step through and alternate.'),
  seed('squat-to-stand', 'Squat to stand', 'Full body', 'bilateral', 'mobility', [], 'Hinge to hold the shins or toes, lower into a comfortable squat, lift the chest, then stand.'),
  seed('lunge-with-rotation', 'Reverse Lunge with Rotation', 'Full body', 'alternating', 'mobility', [], 'Step back into a shallow lunge and rotate the trunk toward the front leg before returning to stand.'),
  seed('lateral-squat-reach', 'Lateral Squat to Reach', 'Full body', 'alternating', 'mobility', [], 'Shift into a comfortable lateral squat and reach both hands forward while the working knee tracks over the foot.'),
  seed('a-march-in-place', 'A-March in Place', 'Full body', 'alternating', 'activation', [], 'Drive one knee up with the opposite arm, pause in a tall posture, and switch sides with quiet foot contacts.'),
  seed('high-knees-in-place', 'High Knees in Place', 'Full body', 'alternating', 'activation', [], 'Run lightly in place with quick knee lifts while staying tall and keeping foot contacts under the hips.'),
]

export const RECOVERY_EXERCISES = Object.freeze(Object.fromEntries(SEEDS.map((item) => [item.id, Object.freeze(buildExercise(item))])))
export const RECOVERY_EXERCISE_LIST = Object.freeze(Object.values(RECOVERY_EXERCISES))
export const RECOVERY_CATEGORIES = Object.freeze([...new Set(RECOVERY_EXERCISE_LIST.map((item) => item.category))])

const ATHLETIC_ROUTINE_IDS = RECOVERY_EXERCISE_LIST
  .filter((item) => !['breathing', 'active-recovery'].includes(item.movementType))
  .map((item) => item.id)

export const RECOVERY_ROUTINE_IDS = Object.freeze({
  session: ATHLETIC_ROUTINE_IDS,
  competition: RECOVERY_EXERCISE_LIST.filter((item) => !['breathing', 'active-recovery', 'self-massage'].includes(item.movementType) && item.sportDemandTags.some((tag) => ['lower-body', 'running', 'jumping', 'landing', 'change-of-direction', 'full-body'].includes(tag))).map((item) => item.id),
  quick: ['cat-cow', 'hip-switches-90-90', 'ankle-knee-to-wall', 'shoulder-cars', 'glute-bridge', 'cossack-shift', 'toe-raises', 'dead-bug'],
  'full-body': ['cat-cow', 'thread-the-needle', 'shoulder-cars', 'worlds-greatest-stretch', 'cossack-shift', 'ankle-knee-to-wall', 'glute-bridge', 'dead-bug'],
  flexibility: idsByType('flexibility'),
  targeted: ATHLETIC_ROUTINE_IDS,
  'recovery-day': ATHLETIC_ROUTINE_IDS,
  'pre-event': RECOVERY_EXERCISE_LIST.filter((item) => !['flexibility', 'self-massage', 'breathing'].includes(item.movementType)).map((item) => item.id),
  mobility: idsByType('mobility'),
  general: ATHLETIC_ROUTINE_IDS,
})

export function getCatalogExercises(ids = RECOVERY_ROUTINE_IDS.general) {
  return ids.map((id) => RECOVERY_EXERCISES[id]).filter(Boolean).map(cloneExercise)
}

export function resolveVettedExerciseSelections(selections = []) {
  return selections.map((selection, sequenceIndex) => {
    const id = typeof selection === 'string' ? selection : selection?.id
    const vetted = RECOVERY_EXERCISES[id]
    if (!vetted) return null
    const requestedDose = typeof selection === 'object' ? (selection.dose ?? selection) : null
    const allowedDose = resolveRequestedDose(requestedDose, vetted.doseModels)
    const side = normalizeRequestedSide(selection?.side, vetted.laterality)
    return { ...cloneExercise(vetted), dose: allowedDose, rationale: String(selection?.rationale ?? '').trim(), sequenceIndex, ...(side ? { side } : {}) }
  }).filter(Boolean)
}

function resolveRequestedDose(requested, doseModels) {
  const fallback = { ...doseModels[0] }
  if (!requested || !doseModels.some((dose) => dose.model === requested.model)) return fallback
  if (requested.model === 'timer') return {
    model: 'timer',
    durationSeconds: clamp(Number(requested.durationSeconds), 15, 90, fallback.durationSeconds),
    sets: clamp(Number(requested.sets), 1, 4, fallback.sets),
    restSeconds: clamp(Number(requested.restSeconds), 0, 90, fallback.restSeconds),
  }
  return {
    model: 'reps',
    reps: clamp(Number(requested.reps), 3, 20, fallback.reps),
    sets: clamp(Number(requested.sets), 1, 4, fallback.sets),
    restSeconds: clamp(Number(requested.restSeconds), 0, 90, fallback.restSeconds),
    tempoSecondsPerRep: clamp(Number(requested.tempoSecondsPerRep), 2, 8, fallback.tempoSecondsPerRep),
  }
}

function normalizeRequestedSide(value, laterality) {
  if (laterality !== 'each-side') return ''
  const side = String(value ?? '').toLowerCase()
  if (side.startsWith('left')) return 'Left side'
  if (side.startsWith('right')) return 'Right side'
  return ''
}

function clamp(value, minimum, maximum, fallback) {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Math.round(value))) : fallback
}

export function estimateExerciseSeconds(exercise, transitionSeconds = exercise.estimatedTransitionSeconds ?? 12) {
  const dose = exercise.dose ?? exercise.doseModels?.[0] ?? exercise
  const sides = exercise.laterality === 'each-side' && !/left|right/i.test(exercise.side ?? '') ? 2 : 1
  const sets = Math.max(1, Number(dose.sets) || 1)
  const active = dose.model === 'timer'
    ? Math.max(1, Number(dose.durationSeconds) || 0)
    : Math.max(1, Number(dose.reps) || 0) * Math.max(1, Number(dose.tempoSecondsPerRep) || 4)
  return sides * (sets * active + Math.max(0, sets - 1) * Math.max(0, Number(dose.restSeconds) || 0)) + Number(transitionSeconds || 0)
}

function buildExercise(item) {
  const category = CATEGORY_PROFILES[item.category]
  const isTimed = ['flexibility', 'isometric', 'breathing', 'self-massage', 'active-recovery'].includes(item.movementType)
  const doseModels = isTimed
    ? [timerDose(item.movementType === 'active-recovery' ? 120 : item.movementType === 'breathing' ? 60 : 30), timerDose(item.movementType === 'active-recovery' ? 180 : 45)]
    : [repDose(item.movementType === 'activation' ? 10 : 6), repDose(item.movementType === 'activation' ? 12 : 8)]
  const setup = setupFor(item)
  return {
    id: item.id,
    name: item.name,
    canonicalName: item.name,
    aliases: item.aliases,
    category: item.category,
    bodyRegion: item.category,
    area: item.category,
    targetBodyParts: category.targetBodyParts,
    targetMuscles: category.targetMuscles,
    movementType: item.movementType,
    laterality: item.laterality,
    side: item.laterality === 'each-side' ? 'Each side' : item.laterality === 'alternating' ? 'Alternating' : 'Both sides',
    equipment: item.equipment,
    sportDemandTags: category.sportDemandTags,
    activityDemandTags: category.sportDemandTags,
    recoveryGoalTags: recoveryTags(item),
    target: [...category.sportDemandTags, ...recoveryTags(item)],
    difficulty: 'Foundational',
    position: positionFor(item),
    contraindications: contraindicationsFor(item),
    painExclusions: painExclusionsFor(item),
    setup: [setup],
    steps: [item.action, completionCue(item)],
    movement: item.action,
    completionCue: completionCue(item),
    whatYouShouldFeel: [feelFor(item)],
    expectedSensation: feelFor(item),
    feel: feelFor(item),
    thingsToAvoid: avoidFor(item),
    stopConditions: UNIVERSAL_STOP_CONDITIONS,
    substitutions: [],
    progressions: ['Use the second allowed dose only when every repetition or breath remains smooth and symptom-free.'],
    regressions: ['Reduce the range, use stable support, or stop and choose a different body area.'],
    purpose: `Support ${item.category.toLowerCase()} recovery with controlled ${item.movementType.replace('-', ' ')} work.`,
    doseModels,
    dose: doseModels[0],
    doseModel: doseModels[0].model,
    durationSeconds: doseModels[0].durationSeconds ?? 0,
    reps: doseModels[0].reps ?? 0,
    sets: doseModels[0].sets,
    restSeconds: doseModels[0].restSeconds,
    estimatedTransitionSeconds: item.movementType === 'active-recovery' ? 20 : 12,
    catalogVersion: RECOVERY_CATALOG_VERSION,
  }
}

function seed(id, name, category, laterality, movementType, equipment, action, aliases = []) {
  return { id, name, category, laterality, movementType, equipment, action, aliases }
}

function profile(targetBodyParts, targetMuscles, sportDemandTags) { return { targetBodyParts, targetMuscles, sportDemandTags } }
function timerDose(durationSeconds, sets = 1, restSeconds = 0) { return { model: 'timer', durationSeconds, sets, restSeconds } }
function repDose(reps, sets = 1, tempoSecondsPerRep = 4, restSeconds = 0) { return { model: 'reps', reps, sets, tempoSecondsPerRep, restSeconds } }
function idsByTags(tags) { return RECOVERY_EXERCISE_LIST.filter((item) => tags.some((tag) => item.target.includes(tag))).map((item) => item.id) }
function idsByType(type) { return RECOVERY_EXERCISE_LIST.filter((item) => item.movementType === type).map((item) => item.id) }
function cloneExercise(item) { return { ...item, dose: { ...item.dose }, doseModels: item.doseModels.map((dose) => ({ ...dose })), setup: [...item.setup], steps: [...item.steps], whatYouShouldFeel: [...item.whatYouShouldFeel], thingsToAvoid: [...item.thingsToAvoid], stopConditions: [...item.stopConditions] } }
function sameDose(first, second) { return ['model', 'durationSeconds', 'reps', 'sets', 'restSeconds', 'tempoSecondsPerRep'].every((key) => (first[key] ?? null) === (second[key] ?? null)) }

function recoveryTags(item) {
  const tags = ['recovery']
  if (['mobility', 'control'].includes(item.movementType)) tags.push('mobility', 'pre-event')
  if (item.movementType === 'flexibility') tags.push('flexibility', 'post-session')
  if (item.movementType === 'breathing') tags.push('downshift', 'post-session')
  if (item.movementType === 'active-recovery') tags.push('active-recovery', 'recovery-day')
  if (item.movementType === 'activation') tags.push('activation', 'pre-event')
  return tags
}

function setupFor(item) {
  if (item.movementType === 'active-recovery') return 'Choose a safe, level environment and begin at an effort where you can speak in full sentences.'
  if (item.position === 'lying') return `Use a mat or comfortable surface and set up for ${item.name.toLowerCase()} with the head and spine supported.`
  if (item.position === 'quadruped') return 'Start on hands and knees with hands below shoulders and knees below hips; add padding as needed.'
  if (item.position === 'seated') return 'Sit on a stable surface with both feet supported and the trunk comfortably tall.'
  return `Use ${item.equipment.length ? item.equipment.join(' and ').toLowerCase() : 'a stable support if needed'} and begin in a balanced, pain-free position.`
}

function positionFor(item) {
  if (/supine|dead bug|heel slide|bridge|90\/90 breathing|legs-up|floor chest/.test(item.name.toLowerCase())) return 'lying'
  if (/prone|crocodile|cobra/.test(item.name.toLowerCase())) return 'lying'
  if (/quadruped|cat-cow|bird dog|thread|rock-back/.test(item.name.toLowerCase())) return 'quadruped'
  if (/seated|butterfly|90\/90 hip|shin-box/.test(item.name.toLowerCase())) return 'seated'
  return 'standing or supported'
}

function completionCue(item) {
  if (['flexibility', 'isometric', 'breathing', 'self-massage', 'active-recovery'].includes(item.movementType)) return 'Continue only for the prescribed time, then exit the position or slow down gradually.'
  if (item.laterality === 'alternating') return 'Complete both directions with the same controlled range.'
  return 'Return to the starting position under control to complete the repetition.'
}

function feelFor(item) {
  if (item.movementType === 'flexibility') return `Mild, broad tension around the ${item.category.toLowerCase()}, never pinching or joint pain.`
  if (item.movementType === 'self-massage') return 'Tolerable pressure in soft tissue that eases when pressure is reduced.'
  if (item.movementType === 'breathing') return 'Quiet expansion through the lower ribs with the neck and shoulders staying relaxed.'
  if (item.movementType === 'active-recovery') return 'Easy whole-body movement that leaves breathing controlled and symptoms unchanged or better.'
  return `Smooth muscular work and controlled motion around the ${item.category.toLowerCase()} without joint pain.`
}

function avoidFor(item) {
  const avoid = ['Forcing range or using momentum', 'Holding your breath unless the movement is a breathing drill']
  if (item.laterality === 'each-side') avoid.push('Using a visibly different range on one side to push through symptoms')
  if (item.movementType === 'flexibility') avoid.push('Bouncing or turning mild tension into pain')
  if (item.movementType === 'active-recovery') avoid.push('Letting the effort rise above an easy conversational pace')
  return avoid
}

function contraindicationsFor(item) {
  const values = ['medical-restriction-for-target-area']
  if (item.movementType === 'self-massage') values.push('acute-swelling', 'bruising')
  if (item.equipment.includes('Pool')) values.push('open-wound', 'unsafe-water-access')
  return values
}

function painExclusionsFor(item) {
  const words = item.category.toLowerCase().split(/\s+|\//).filter((word) => word.length > 3)
  return [...new Set(words.map((word) => `${word.replace(/s$/, '')}-pain`))]
}
