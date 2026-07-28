import { useMemo, useState } from 'react'
import { bodyPainAreas, createEmptyPainMap } from '../data/bodyPainMap'

export function BodyPainMap({ value, onChange }) {
  const painMap = value ?? createEmptyPainMap()
  const [activeIndex, setActiveIndex] = useState(0)
  const activeArea = bodyPainAreas[activeIndex]
  const activeValue = Number(painMap[activeArea.id] ?? 0)
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

  function goNext() {
    setActiveIndex((current) => Math.min(bodyPainAreas.length - 1, current + 1))
  }

  function goPrevious() {
    setActiveIndex((current) => Math.max(0, current - 1))
  }

  return (
    <section className="body-pain-map">
      <div className="body-map-heading">
        <div>
          <strong>Body pain map</strong>
          <p>{activeIndex + 1} of {bodyPainAreas.length}: {activeArea.label}</p>
        </div>
        <span>{activeValue}%</span>
      </div>

      <div className="body-map-layout">
        <svg className="body-outline" viewBox="0 0 224 532" role="img" aria-label="Body pain map">
          <path
            className="body-silhouette"
            d="M93 35c0-23 38-23 38 0 0 18-4 31-12 36l4 20 23 2c18 2 32 15 36 33l15 79 11 50 19 40-21 14-28-47-10-73-12 113 24 199h-43l-25-169-25 169H44l24-199-12-113-10 73-28 47-21-14 19-40 11-50 15-79c4-18 18-31 36-33l23-2 4-20c-8-5-12-18-12-36Z"
          />
          <path className="body-detail" d="M88 96h48M75 137c18-11 56-11 74 0M82 226h60M77 272h70M65 386h94M62 422h100" />
          <path className="body-detail" d="M112 96v176M112 272l-25 60M112 272l25 60M94 332l-18 169M130 332l18 169" />

          {bodyPainAreas.map((area, index) => {
            const severity = Number(painMap[area.id] ?? 0)
            const isActive = area.id === activeArea.id

            return (
              <g
                className={[
                  'body-region',
                  isActive ? 'active' : '',
                  severity > 0 ? 'has-pain' : '',
                ].filter(Boolean).join(' ')}
                key={area.id}
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    setActiveIndex(index)
                  }
                }}
                role="button"
                style={{
                  '--severity-opacity': severity / 100,
                }}
                tabIndex={0}
              >
                <path d={area.path} />
                {isActive && (
                  <text x={area.labelPoint[0]} y={area.labelPoint[1]}>
                    {area.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        <div className="body-map-control">
          <label className="compact-field">
            Pain percentage
            <input
              max="100"
              min="0"
              type="number"
              value={activeValue}
              onChange={(event) => updateArea(activeArea.id, Number(event.target.value))}
            />
          </label>
          <input
            className="pain-percent-slider"
            max="100"
            min="0"
            style={{ '--range-progress': `${activeValue}%` }}
            type="range"
            value={activeValue}
            onChange={(event) => updateArea(activeArea.id, Number(event.target.value))}
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
        </div>
      </div>

      <div className="pain-area-summary">
        {painfulAreas.length === 0 ? (
          <p>No pain areas selected.</p>
        ) : (
          painfulAreas.slice(0, 5).map((area) => (
            <span key={area.id}>
              {area.label} <strong>{painMap[area.id]}%</strong>
            </span>
          ))
        )}
      </div>
    </section>
  )
}
