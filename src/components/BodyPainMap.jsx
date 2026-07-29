import { useMemo, useState } from 'react'
import Body from 'react-muscle-highlighter'
import { bodyPainAreas, createEmptyPainMap } from '../data/bodyPainMap'

export function BodyPainMap({
  affectedMovement,
  details = {},
  hurtsWhen,
  injuryType,
  onChange,
  onDetailsChange,
  painType,
  painTrend,
  value,
}) {
  const painMap = value ?? createEmptyPainMap()
  const [activeIndex, setActiveIndex] = useState(0)
  const activeArea = bodyPainAreas[activeIndex]
  const activeValue = Number(painMap[activeArea.id] ?? 0)
  const activePainScore = Math.round(activeValue / 10)
  const painfulAreas = useMemo(
    () => bodyPainAreas.filter((area) => Number(painMap[area.id] ?? 0) > 0),
    [painMap],
  )

  function updateArea(areaId, severity) {
    onChange({
      ...painMap,
      [areaId]: severity,
    })
  }

  function updateDetail(field, nextValue) {
    onDetailsChange?.({ ...details, [activeArea.id]: { ...(details[activeArea.id] ?? {}), [field]: nextValue } })
  }

  function goNext() {
    setActiveIndex((current) => Math.min(bodyPainAreas.length - 1, current + 1))
  }

  function goPrevious() {
    setActiveIndex((current) => Math.max(0, current - 1))
  }

  function getBodyData(view) {
    return bodyPainAreas
      .filter((area) => area.view === view)
      .map((area) => {
        const severity = Number(painMap[area.id] ?? 0)
        const isActive = area.id === activeArea.id

        if (!isActive && severity <= 0) return null

        return {
          slug: area.slug,
          side: area.side === 'center' ? undefined : area.side,
          styles: {
            fill: isActive ? '#5aa7ff' : getSeverityColor(severity),
            stroke: isActive ? '#1f78d8' : '#ff6f61',
            strokeWidth: isActive ? 2 : 1,
          },
        }
      })
      .filter(Boolean)
  }

  function selectBodyPart(part, side, view) {
    const nextIndex = bodyPainAreas.findIndex((area) =>
      area.view === view &&
      area.slug === part.slug &&
      (area.side === 'center' || area.side === side),
    )

    if (nextIndex >= 0) {
      setActiveIndex(nextIndex)
    }
  }

  return (
    <section className="body-pain-map">
      <div className="body-map-heading">
        <div>
          <strong>Body pain map</strong>
          <p>{activeIndex + 1} of {bodyPainAreas.length}: {activeArea.label}</p>
        </div>
        <span>{activePainScore}/10</span>
      </div>

      <div className="body-map-layout">
        <div className={`body-turn-stage ${activeArea.view}`}>
          <div className="body-turner">
            <div className="body-model-face body-model-front" aria-hidden={activeArea.view !== 'front'}>
              <span>Front</span>
              <Body
                border="#cfd5df"
                colors={['#ffd166', '#ffb347', '#ff6f61']}
                data={getBodyData('front')}
                defaultFill="#f5f7fb"
                defaultStroke="#dbe0e8"
                defaultStrokeWidth={1}
                gender="male"
                onBodyPartPress={(part, side) => selectBodyPart(part, side, 'front')}
                scale={1.16}
                side="front"
              />
            </div>
            <div className="body-model-face body-model-back" aria-hidden={activeArea.view !== 'back'}>
              <span>Back</span>
              <Body
                border="#cfd5df"
                colors={['#ffd166', '#ffb347', '#ff6f61']}
                data={getBodyData('back')}
                defaultFill="#f5f7fb"
                defaultStroke="#dbe0e8"
                defaultStrokeWidth={1}
                gender="male"
                onBodyPartPress={(part, side) => selectBodyPart(part, side, 'back')}
                scale={1.16}
                side="back"
              />
            </div>
          </div>
        </div>

        <div className="body-map-control">
          <label className="compact-field">
            Pain level (0-10)
            <input
              max="10"
              min="0"
              type="number"
              value={activePainScore}
              onChange={(event) => updateArea(activeArea.id, Number(event.target.value) * 10)}
            />
          </label>
          <input
            className="pain-percent-slider"
            max="10"
            min="0"
            style={{ '--range-progress': `${activePainScore * 10}%` }}
            type="range"
            value={activePainScore}
            onChange={(event) => updateArea(activeArea.id, Number(event.target.value) * 10)}
          />

          <div className="body-map-actions">
            <button className="ghost-close" disabled={activeIndex === 0} onClick={goPrevious} type="button">
              Previous
            </button>
            <button
              className="secondary-button compact-action"
              disabled={activeIndex === bodyPainAreas.length - 1}
              onClick={goNext}
              type="button"
            >
              Next area
            </button>
          </div>

          {activePainScore > 0 && (
            <div className="body-part-pain-details">
              <p className="eyebrow">{activeArea.label} details</p>
              <label className="compact-field">
                Injury type
                <select
                  value={details[activeArea.id]?.injuryType ?? injuryType}
                  onChange={(event) => updateDetail('injuryType', event.target.value)}
                >
                  {injuryTypeOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="compact-field">
                Pain type
                <select
                  value={details[activeArea.id]?.painType ?? painType}
                  onChange={(event) => updateDetail('painType', event.target.value)}
                >
                  {painTypeOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="compact-field">
                When it occurs
                <select
                  value={details[activeArea.id]?.hurtsWhen ?? hurtsWhen}
                  onChange={(event) => updateDetail('hurtsWhen', event.target.value)}
                >
                  {hurtsWhenOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="compact-field">
                Change since last session
                <select value={details[activeArea.id]?.painTrend ?? painTrend ?? 'New'} onChange={(event) => updateDetail('painTrend', event.target.value)}>
                  <option>New</option><option>Improving</option><option>Unchanged</option><option>Worsening</option>
                </select>
              </label>
              <label className="compact-field">
                Affected movement
                <select value={details[activeArea.id]?.affectedMovement ?? affectedMovement ?? 'None'} onChange={(event) => updateDetail('affectedMovement', event.target.value)}>
                  <option>None</option><option>Running</option><option>Jumping</option><option>Cutting</option><option>Kicking</option><option>Throwing</option><option>Other sport movement</option>
                </select>
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="pain-area-summary">
        {painfulAreas.length === 0 ? (
          <p>No pain areas selected.</p>
        ) : (
          painfulAreas.slice(0, 5).map((area) => (
            <span key={area.id}>
              {area.label} <strong>{Math.round(Number(painMap[area.id] ?? 0) / 10)}/10</strong>
            </span>
          ))
        )}
      </div>
    </section>
  )
}

const injuryTypeOptions = [
  'Muscle strain',
  'Ligament sprain',
  'Tendon irritation',
  'Joint irritation',
  'Impact bruise',
  'Overuse soreness',
  'Cramp',
  'Bone stress',
  'Cut / scrape',
  'Blister',
  'Swelling',
  'Concussion concern',
  'Unknown',
]

const painTypeOptions = [
  'Tight / pulling',
  'Dull ache',
  'Sharp / stabbing',
  'Burning',
  'Throbbing',
  'Pinching',
  'Pressure',
  'Cramping',
  'Shooting',
  'Tingling',
  'Swelling',
  'Instability',
  'Numbness',
  'Headache / dizziness',
]

const hurtsWhenOptions = [
  'At rest',
  'Walking',
  'Jogging',
  'Sprinting',
  'Acceleration',
  'Deceleration',
  'Cutting',
  'Jumping',
  'Landing',
  'Kicking',
  'Throwing',
  'Lifting',
  'Squatting',
  'Twisting',
  'Contact',
  'Headers',
  'Stretching',
  'Bending',
  'Breathing',
  'After activity',
]

function getSeverityColor(severity) {
  if (severity >= 70) return '#ff6f61'
  if (severity >= 35) return '#ffb347'

  return '#ffd166'
}
