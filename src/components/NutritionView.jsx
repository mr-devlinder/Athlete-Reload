import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { findFoodByBarcode, getFoodCuratorStatus, isSameSavedFood, loadSavedFoods, removeSavedFood, saveFood, searchFoods, verifyFood } from '../lib/foodApi'
import { getHydrationTarget, getNutritionTargets, getNutritionTotals, mealOptions } from '../lib/nutrition'
import { SectionHeading } from './SectionHeading'
import { fluidOuncesToMilliliters, formatHydration } from '../utils/units'
import { formatRecordingTime, useAudioRecorder } from '../hooks/useAudioRecorder'
import { useModalAccessibility } from '../hooks/useModalAccessibility'

const imperialWaterAmounts = [8, 16, 20, 32, 64]
const metricWaterAmounts = [250, 500, 750, 1000]
const mealCards = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']

export function NutritionView({ athleteProfile, isGuidedTour = false, nutritionHistory = [], onSaveWellness, schedule }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [selectedDate, setSelectedDate] = useState(today)
  const [isDateOpen, setIsDateOpen] = useState(false)
  const [loggingMeal, setLoggingMeal] = useState(null)
  const [selectedFood, setSelectedFood] = useState(null)
  const [openMeal, setOpenMeal] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const wellness = nutritionHistory.find((entry) => entry.date === selectedDate) ?? { date: selectedDate, hydrationMl: 0, nutritionEntries: [] }
  const entries = wellness.nutritionEntries ?? []
  const totals = getNutritionTotals(entries)
  const targets = useMemo(() => getNutritionTargets(athleteProfile, schedule, selectedDate), [athleteProfile, schedule, selectedDate])
  const hydrationTarget = getHydrationTarget(athleteProfile, schedule, selectedDate)
  const unitSystem = athleteProfile?.unitSystem ?? 'imperial'
  const quickWaterAmounts = unitSystem === 'metric' ? metricWaterAmounts : imperialWaterAmounts

  function save(next) {
    onSaveWellness?.({ ...wellness, ...next, date: selectedDate })
  }

  function changeWater(amount) {
    const amountMl = unitSystem === 'metric' ? amount : fluidOuncesToMilliliters(amount)
    save({ hydrationMl: Math.max(0, Number(wellness.hydrationMl ?? 0) + amountMl) })
  }

  function removeFood(id) {
    save({ nutritionEntries: entries.filter((entry) => entry.id !== id) })
  }

  const displayedDate = selectedDate === today ? 'Today' : format(parseISO(selectedDate), 'EEE, MMM d')

  return (
    <div className="nutrition-view" data-tour="nutrition-page">
      <section className="nutrition-dashboard-heading">
        <div>
          <SectionHeading eyebrow="Nutrition" title="Fuel for the day." />
          <div className="nutrition-date-menu">
            <button className="nutrition-date-button" onClick={() => setIsDateOpen((current) => !current)} type="button">{displayedDate}<span>⌄</span></button>
            {isDateOpen && <div className="nutrition-date-popover"><label>Choose a date<input autoFocus type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setIsDateOpen(false) }} /></label><button onClick={() => { setSelectedDate(today); setIsDateOpen(false) }} type="button">Jump to today</button></div>}
          </div>
        </div>
        <button className="nutrition-detail-button" disabled={isGuidedTour} onClick={() => setDetailsOpen(true)} type="button" aria-label="View nutrition details">↔</button>
      </section>

      <section className="nutrition-calorie-card">
        <div><span>Calories</span><strong>{Math.round(totals.calories)} <small>/ {targets.calories ?? '—'}</small></strong></div>
        <span className="nutrition-calorie-remaining">{targets.calories ? `${Math.max(0, Math.round(targets.calories - totals.calories))} left` : 'Add profile details'}</span>
        <Progress value={totals.calories} target={targets.calories} tone="calories" />
      </section>

      <section className="nutrition-macro-card">
        <Macro label="Carbs" value={totals.carbohydrates} target={targets.carbohydrates} unit="g" tone="carbs" />
        <Macro label="Fat" value={totals.fats} target={targets.fats} unit="g" tone="fat" />
        <Macro label="Protein" value={totals.protein} target={targets.protein} unit="g" tone="protein" />
      </section>

      <section className="nutrition-water-strip">
        <div><span>Water</span><strong>{formatHydration(wellness.hydrationMl, unitSystem)} / {formatHydration(hydrationTarget, unitSystem)}</strong></div>
        <div className="nutrition-water-actions"><button onClick={() => changeWater(unitSystem === 'metric' ? -50 : -1)} type="button" aria-label="Subtract water">−</button>{quickWaterAmounts.map((amount) => <button key={amount} onClick={() => changeWater(amount)} type="button">+{amount}{unitSystem === 'metric' ? ' mL' : ''}</button>)}<button onClick={() => changeWater(unitSystem === 'metric' ? 50 : 1)} type="button" aria-label="Add water">+</button></div>
      </section>

      <section className="nutrition-meals-section">
        <div className="nutrition-section-title"><h2>Meals</h2><span>{entries.length} logged</span></div>
        <div className="nutrition-meal-grid">{mealCards.map((meal) => <MealCard disabled={isGuidedTour} key={meal} meal={meal} entries={entries} onOpen={() => setOpenMeal(meal === 'Snacks' ? 'Snack' : meal)} onLog={() => setLoggingMeal(meal === 'Snacks' ? 'Snack' : meal)} />)}</div>
      </section>

      <p className="nutrition-target-note">{targets.reason}</p>

      {loggingMeal && <NutritionModalPortal><FoodLogModal initialMeal={loggingMeal} onClose={() => setLoggingMeal(null)} onSelectFood={(food, meal) => setSelectedFood({ food, meal })} onSave={(food) => { save({ nutritionEntries: [...entries, { ...food, id: `food-${Date.now()}`, loggedAt: new Date().toISOString() }] }); setLoggingMeal(null) }} /></NutritionModalPortal>}
      {selectedFood && <NutritionModalPortal><ServingModal canSaveReusable={Boolean(selectedFood.entryId)} food={selectedFood.food} meal={selectedFood.meal} onClose={() => setSelectedFood(null)} onSave={(food) => { save({ nutritionEntries: selectedFood.entryId ? entries.map((entry) => entry.id === selectedFood.entryId ? { ...food, id: entry.id, loggedAt: entry.loggedAt } : entry) : [...entries, { ...food, id: `food-${Date.now()}`, loggedAt: new Date().toISOString() }] }); setSelectedFood(null); setLoggingMeal(null) }} /></NutritionModalPortal>}
      {openMeal && <NutritionModalPortal><MealDetailModal date={selectedDate} entries={entries} meal={openMeal} onClose={() => setOpenMeal(null)} onDateChange={setSelectedDate} onDelete={removeFood} onEdit={(entry) => { setOpenMeal(null); setSelectedFood({ food: entry, meal: openMeal, entryId: entry.id }) }} /></NutritionModalPortal>}
      {detailsOpen && <NutritionModalPortal><NutritionDetailsModal entries={entries} hydrationMl={wellness.hydrationMl} onClose={() => setDetailsOpen(false)} targets={targets} totals={totals} unitSystem={unitSystem} /></NutritionModalPortal>}
    </div>
  )
}

function NutritionModalPortal({ children }) {
  return createPortal(children, document.body)
}

function MealCard({ disabled = false, entries, meal, onLog, onOpen }) {
  const mealEntries = entries.filter((entry) => entry.meal === (meal === 'Snacks' ? 'Snack' : meal))
  return <article className="nutrition-meal-card nutrition-meal-card-clickable" onClick={disabled ? undefined : onOpen}><div className="nutrition-meal-icon" aria-hidden="true"><MealIcon meal={meal} /></div><div className="nutrition-meal-content"><h3>{meal}</h3>{mealEntries.length === 0 ? <p>Nothing logged yet</p> : <p>{mealEntries.length} food{mealEntries.length === 1 ? '' : 's'} · {Math.round(getNutritionTotals(mealEntries).calories)} cal</p>}</div><button className="nutrition-log-button" disabled={disabled} onClick={(event) => { event.stopPropagation(); if (!disabled) onLog() }} type="button">Log</button></article>
}

function MealIcon({ meal }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.8, viewBox: '0 0 24 24' }
  if (meal === 'Breakfast') return <svg {...common}><path d="M4 10h13a3 3 0 0 1 0 6H6a2 2 0 0 1-2-2v-4ZM17 11h2.2a2 2 0 0 1 0 4H17M7 19h9M6 7c0-1.4 1-2.3 2-3M11 7c0-1.4 1-2.3 2-3" /></svg>
  if (meal === 'Lunch') return <svg {...common}><path d="M3.5 8.5c1.8-2 4.1-3 8.5-3s6.7 1 8.5 3M4.5 11h15M5.5 14h13M7 17h10M5 19h14" /></svg>
  if (meal === 'Dinner') return <svg {...common}><path d="M4 13h16a6 6 0 0 1-16 0ZM3 13h18M8 19h8M12 4v4M9 6l3 2 3-2" /></svg>
  if (meal === 'Snacks') return <svg {...common}><path d="M5 8h14l-1 11H6L5 8ZM7 8V6a5 5 0 0 1 10 0v2M9 12h.01M12 15h.01M15 12h.01" /></svg>
  return <svg {...common}><path d="M4 18h16M6 14h12M8 10h8M10 6h4M12 4v14" /></svg>
}

function FoodLogModal({ initialMeal, onClose, onSave, onSelectFood }) {
  const [meal, setMeal] = useState(initialMeal)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [message, setMessage] = useState('')
  const [scannerStatus, setScannerStatus] = useState('idle')
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false)
  const [savedFoods, setSavedFoods] = useState([])
  const [isFoodCurator, setIsFoodCurator] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scanTimerRef = useRef(null)
  const readerRef = useRef(null)
  const scannerControlsRef = useRef(null)
  const scannerSessionRef = useRef(0)
  const mountedRef = useRef(true)
  const voiceRecorderRef = useRef(null)
  useModalAccessibility(true, closeModal)
  const isScanning = !['idle', 'error'].includes(scannerStatus)
  const voiceRecorder = useAudioRecorder({
    maxSeconds: 45,
    onTranscript: (value) => setQuery(value),
  })
  voiceRecorderRef.current = voiceRecorder

  useEffect(() => {
    Promise.all([loadSavedFoods(), getFoodCuratorStatus()]).then(([foods, isCurator]) => { setSavedFoods(foods); setIsFoodCurator(isCurator) }).catch(() => {})
    return () => {
      mountedRef.current = false
      stopScanner(false)
      voiceRecorderRef.current?.stop({ cancelled: true })
    }
  }, [])

  function releaseCamera() {
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current)
    scanTimerRef.current = null
    scannerControlsRef.current?.stop?.()
    scannerControlsRef.current = null
    readerRef.current?.reset?.()
    readerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
  }

  function stopScanner(updateState = true) {
    scannerSessionRef.current += 1
    releaseCamera()
    if (updateState && mountedRef.current) setScannerStatus('idle')
  }

  async function startScanner() {
    stopScanner(false)
    await initializeScanner(0)
  }

  async function initializeScanner(attempt) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Camera scanning is not available here. Enter the barcode number below instead.')
      setScannerStatus('error')
      return
    }

    const sessionId = scannerSessionRef.current
    try {
      setMessage(attempt ? 'Camera did not start. Retrying...' : 'Waiting for camera permission...')
      setScannerStatus(attempt ? 'retrying' : 'requesting')
      const constraints = attempt
        ? { facingMode: 'environment' }
        : { facingMode: { ideal: 'environment' }, height: { ideal: 720 }, width: { ideal: 1280 } }
      const stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false })
      if (sessionId !== scannerSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      setMessage('Starting camera...')
      setScannerStatus('starting')
      const videoElement = await waitForVideoElement(videoRef, sessionId, scannerSessionRef)
      videoElement.srcObject = stream
      await waitForVideoPlayback(videoElement, sessionId, scannerSessionRef)
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      if (sessionId !== scannerSessionRef.current) return
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader
      scannerControlsRef.current = await reader.decodeFromStream(stream, videoElement, async (result) => {
        if (!result || sessionId !== scannerSessionRef.current) return
        const normalizedBarcode = normalizeBarcode(result.getText())
        if (!normalizedBarcode) return
        stopScanner()
        try {
          const food = await findFoodByBarcode(normalizedBarcode)
          setResults(food ? [food] : [])
          if (!food) setMessage('No food found for that barcode.')
        } catch (error) {
          setMessage(error.message)
        }
      })
      if (sessionId === scannerSessionRef.current) {
        setMessage('Camera ready. Point it at the barcode.')
        setScannerStatus('scanning')
      }
    } catch (error) {
      if (sessionId !== scannerSessionRef.current) return
      releaseCamera()
      if (!attempt && isRetryableCameraError(error)) {
        setScannerStatus('retrying')
        scanTimerRef.current = window.setTimeout(() => initializeScanner(1), 300)
        return
      }
      setScannerStatus('error')
      setMessage(getCameraErrorMessage(error))
    }
  }

  function closeModal() {
    stopScanner(false)
    onClose()
  }

  async function search(searchValue = query) {
    try {
      setMessage('')
      const found = await searchFoods(searchValue)
      const terms = searchValue.toLowerCase().match(/[a-z0-9]+/g) ?? []
      const savedMatches = savedFoods.filter((food) => terms.every((term) => food.name.toLowerCase().includes(term)))
      const keys = new Set(savedMatches.map(foodResultKey))
      setResults([...savedMatches, ...found.filter((food) => !keys.has(foodResultKey(food)))])
    } catch (error) { setMessage(error.message) }
  }

  function selectFood(food) { if (onSelectFood) onSelectFood(food, meal); else onSave({ ...food, meal }) }

  async function toggleVoiceSearch() {
    if (voiceRecorder.isRecording) {
      voiceRecorder.stop()
      if (query.trim()) await search(query)
      return
    }
    stopScanner(false)
    await voiceRecorder.start()
  }

  async function toggleSaved(food) {
    try {
      if (food.isSaved) {
        await removeSavedFood(food.savedFoodId)
        setSavedFoods((current) => current.filter((item) => item.savedFoodId !== food.savedFoodId))
        setResults((current) => current.map((item) => item.savedFoodId === food.savedFoodId ? { ...item, isSaved: false, savedFoodId: undefined } : item))
      } else {
        const saved = await saveFood(food)
        setSavedFoods((current) => [saved, ...current.filter((item) => foodResultKey(item) !== foodResultKey(saved))])
        setResults((current) => current.map((item) => foodResultKey(item) === foodResultKey(food) ? saved : item))
      }
    } catch (error) { setMessage(error.message) }
  }

  async function promoteFood(food) {
    try {
      const verified = await verifyFood(food)
      setResults((current) => current.map((item) => foodResultKey(item) === foodResultKey(food) ? { ...item, ...verified, isVerified: true } : item))
      setMessage(`${food.name} added to verified foods.`)
    } catch (error) { setMessage(error.message) }
  }

  return <div className="modal-backdrop" onClick={closeModal}><section className="food-log-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><div className="schedule-header"><div className="food-meal-select-wrap"><span>Log food to</span><label><select value={meal} onChange={(event) => setMeal(event.target.value)}>{mealOptions.filter((option) => option !== 'Custom').map((option) => <option key={option} value={option}>{option === 'Snack' ? 'Snacks' : option}</option>)}</select><Icon name="chevron" /></label></div><button className="ghost-close" onClick={closeModal} type="button">Close</button></div><div className="food-modal-search"><Icon name="search" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && search()} placeholder="Search foods, brands, and flavors..." /><button aria-label="Search" onClick={() => search()} type="button"><Icon name="search" /></button></div><div className="food-modal-actions"><button disabled={scannerStatus === 'retrying'} onClick={isScanning ? stopScanner : startScanner} type="button"><Icon name="barcode" />{getScannerButtonLabel(scannerStatus)}</button><button disabled={voiceRecorder.status === 'requesting'} onClick={toggleVoiceSearch} type="button"><Icon name="mic" />{voiceRecorder.isRecording ? `Stop (${formatRecordingTime(voiceRecorder.elapsedSeconds)})` : voiceRecorder.status === 'requesting' ? 'Waiting...' : 'Voice Search'}</button><button onClick={() => { setQuery(''); setResults(savedFoods); setMessage(''); setIsManualEntryOpen(false) }} type="button"><Icon name="bookmark" />Saved Foods</button><button className={isManualEntryOpen ? 'active' : ''} onClick={() => { stopScanner(false); setIsManualEntryOpen((current) => !current); setMessage('') }} type="button"><Icon name="plus" />Manual Add</button></div>{voiceRecorder.isRecording && <p className="recording-indicator" role="status"><span aria-hidden="true" />Recording {formatRecordingTime(voiceRecorder.elapsedSeconds)}</p>}{voiceRecorder.error && <p className="form-message">{voiceRecorder.error}</p>}{isManualEntryOpen && <ManualFoodForm meal={meal} onCancel={() => setIsManualEntryOpen(false)} onSave={onSave} />}{isScanning && <div className={`barcode-scanner ${scannerStatus}`}><video autoPlay ref={videoRef} muted playsInline /><p>{message}</p></div>}{!isScanning && !isManualEntryOpen && message && <p className="form-message">{message}</p>}{!isManualEntryOpen && results.length > 0 && <div className="food-results">{results.map((food, index) => <FoodResult food={food} isCurator={isFoodCurator} key={`${foodResultKey(food)}-${index}`} onPromote={promoteFood} onSave={toggleSaved} onSelect={selectFood} />)}</div>}</section></div>
}

const manualNutrientFields = [
  ['fiber', 'Fiber', 'g'], ['sugar', 'Sugar', 'g'], ['saturatedFat', 'Saturated fat', 'g'],
  ['polyunsaturatedFat', 'Polyunsaturated fat', 'g'], ['monounsaturatedFat', 'Monounsaturated fat', 'g'], ['transFat', 'Trans fat', 'g'],
  ['cholesterol', 'Cholesterol', 'mg'], ['sodium', 'Sodium', 'mg'], ['potassium', 'Potassium', 'mg'],
  ['vitaminA', 'Vitamin A', 'mcg RAE'], ['vitaminC', 'Vitamin C', 'mg'], ['vitaminD', 'Vitamin D', 'mcg'],
  ['vitaminE', 'Vitamin E', 'mg'], ['vitaminK', 'Vitamin K', 'mcg'], ['calcium', 'Calcium', 'mg'], ['iron', 'Iron', 'mg'],
]

function ManualFoodForm({ meal, onCancel, onSave }) {
  const [draft, setDraft] = useState({ brand: '', calories: '', carbohydrates: '', fats: '', name: '', protein: '', servingWeight: '', servingWeightUnit: 'g', standardServingSize: '1 serving' })

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function submit(event) {
    event.preventDefault()
    const standardServingSize = draft.standardServingSize.trim() || '1 serving'
    const food = { brand: draft.brand.trim(), foodSource: 'Manual entry', meal, name: draft.name.trim(), servingSize: standardServingSize, standardServingSize, servingWeightUnit: draft.servingWeightUnit, servings: 1 }
    if (draft.servingWeight !== '') food.servingWeight = Number(draft.servingWeight)
    ;['calories', 'protein', 'carbohydrates', 'fats', ...manualNutrientFields.map(([key]) => key)].forEach((key) => {
      if (draft[key] !== '') food[key] = Number(draft[key])
    })
    onSave(food)
  }

  return (
    <form className="manual-food-form" onSubmit={submit}>
      <div className="manual-food-heading"><div><strong>Manual food entry</strong><span>Add the values for one serving.</span></div><button onClick={onCancel} type="button">Cancel</button></div>
      <div className="manual-food-grid identity">
        <label>Food name<input autoFocus required value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Homemade granola" /></label>
        <label>Brand (optional)<input value={draft.brand} onChange={(event) => update('brand', event.target.value)} placeholder="Brand or restaurant" /></label>
        <label>Standard serving size<input value={draft.standardServingSize} onChange={(event) => update('standardServingSize', event.target.value)} placeholder="e.g. 1 large egg" /></label>
        <label>Weight for standard serving<span><input min="0" step="0.1" type="number" value={draft.servingWeight} onChange={(event) => update('servingWeight', event.target.value)} /><select aria-label="Serving weight unit" value={draft.servingWeightUnit} onChange={(event) => update('servingWeightUnit', event.target.value)}><option value="g">g</option><option value="mL">mL</option></select></span></label>
      </div>
      <div className="manual-food-grid macros">
        <NutrientInput field="calories" label="Calories" required unit="kcal" value={draft.calories} onChange={update} />
        <NutrientInput field="carbohydrates" label="Carbohydrates" unit="g" value={draft.carbohydrates} onChange={update} />
        <NutrientInput field="fats" label="Fats" unit="g" value={draft.fats} onChange={update} />
        <NutrientInput field="protein" label="Protein" unit="g" value={draft.protein} onChange={update} />
      </div>
      <details className="manual-nutrients"><summary>More nutrients <span>Optional</span></summary><div className="manual-food-grid nutrients">{manualNutrientFields.map(([field, label, unit]) => <NutrientInput field={field} key={field} label={label} unit={unit} value={draft[field] ?? ''} onChange={update} />)}</div></details>
      <button className="primary-button" type="submit">Add to {meal === 'Snack' ? 'Snacks' : meal}</button>
    </form>
  )
}

function NutrientInput({ field, label, onChange, required = false, unit, value }) {
  return <label>{label}<span><input min="0" required={required} step="0.1" type="number" value={value} onChange={(event) => onChange(field, event.target.value)} /><em>{unit}</em></span></label>
}

async function waitForVideoElement(videoRef, sessionId, sessionRef) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (sessionId !== sessionRef.current) throw new DOMException('Scanner stopped', 'AbortError')
    if (videoRef.current) return videoRef.current
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
  throw new DOMException('Camera preview did not mount', 'AbortError')
}

async function waitForVideoPlayback(video, sessionId, sessionRef) {
  await Promise.race([
    video.play(),
    new Promise((_, reject) => window.setTimeout(() => reject(new DOMException('Camera preview timed out', 'AbortError')), 2500)),
  ])
  if (sessionId !== sessionRef.current) throw new DOMException('Scanner stopped', 'AbortError')
}

function isRetryableCameraError(error) {
  return !['NotAllowedError', 'SecurityError', 'NotFoundError'].includes(error?.name)
}

function getCameraErrorMessage(error) {
  if (['NotAllowedError', 'SecurityError'].includes(error?.name)) return 'Camera permission was denied. Allow camera access in your browser settings, then try again.'
  if (error?.name === 'NotFoundError') return 'No camera was found on this device. Search for the food instead.'
  if (error?.name === 'NotReadableError') return 'The camera is busy in another app. Close it there, then try again.'
  return 'The camera could not start. Try again or search for the food instead.'
}

function getScannerButtonLabel(status) {
  if (status === 'requesting') return 'Waiting for Permission'
  if (status === 'starting') return 'Starting Camera'
  if (status === 'retrying') return 'Retrying Camera'
  if (status === 'scanning') return 'Stop Scan'
  return 'Barcode Scan'
}

function FoodResult({ food, isCurator, onPromote, onSave, onSelect }) {
  const suggestions = getServingOptions(food).filter((option) => option !== food.servingSize && option !== '100 g').slice(0, 2)
  const servingWeight = food.servingWeight ? `${food.servingWeight} ${food.servingWeightUnit ?? 'g'}` : ''
  return <div className="food-result-row"><button className="food-result-main" onClick={() => onSelect(food)} type="button"><strong>{food.name}{food.isVerified ? ' ✓' : ''}</strong><span>{[food.brand, food.standardServingSize ?? food.servingSize, servingWeight].filter(Boolean).join(' · ')}</span>{suggestions.length > 0 && <small>Serving options: {suggestions.join(' or ')}</small>}<em>{food.calories} kcal · P {food.protein}g · C {food.carbohydrates}g · F {food.fats}g</em></button><div className="food-result-actions"><button onClick={() => onSave(food)} type="button">{food.isSaved ? 'Saved' : 'Save'}</button>{isCurator && !food.isVerified && <button onClick={() => onPromote(food)} type="button">Verify</button>}</div></div>
}

function foodResultKey(food) { return String(food.barcode || `${food.name}|${food.brand}|${food.servingSize}`).toLowerCase() }

function Icon({ name }) {
  const common = { 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.8, viewBox: '0 0 24 24' }
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
  if (name === 'barcode') return <svg {...common}><path d="M4 5v14M7 5v14M11 5v14M14 5v14M16.5 5v14M20 5v14" /></svg>
  if (name === 'mic') return <svg {...common}><rect height="11" rx="3.5" width="7" x="8.5" y="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" /></svg>
  if (name === 'bookmark') return <svg {...common}><path d="M6.5 4.5A1.5 1.5 0 0 1 8 3h8a1.5 1.5 0 0 1 1.5 1.5V21L12 17l-5.5 4V4.5Z" /></svg>
  if (name === 'plus') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
  return <svg {...common}><path d="m7 9 5 5 5-5" /></svg>
}

function normalizeBarcode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 14)
}

function ServingModal({ canSaveReusable = false, food, meal, onClose, onSave }) {
  useModalAccessibility(true, onClose)
  const existingServing = parseStoredServing(food)
  const nutrientKeys = ['calories', 'protein', 'carbohydrates', 'fats', 'fiber', 'sugar', 'saturatedFat', 'polyunsaturatedFat', 'monounsaturatedFat', 'transFat', 'cholesterol', 'sodium', 'potassium', 'vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK', 'calcium', 'iron']
  const baseFood = { ...food, servingSize: existingServing.servingSize }
  nutrientKeys.forEach((key) => {
    if (food[key] != null && Number.isFinite(Number(food[key]))) baseFood[key] = Number(food[key]) / existingServing.servings
  })
  const options = getServingOptions(baseFood)
  const [servingSize, setServingSize] = useState(options[0])
  const [servings, setServings] = useState(existingServing.servings)
  const [savedFoods, setSavedFoods] = useState([])
  const [saveMessage, setSaveMessage] = useState('')
  const [isSavingFood, setIsSavingFood] = useState(false)
  const factor = getServingFactor(baseFood, servingSize) * Math.max(0, Number(servings) || 0)
  const micronutrientKeys = nutrientKeys.slice(4)
  const scaledFood = {
    ...baseFood,
    meal,
    servingSize,
    servings: Math.max(0, Number(servings) || 0),
    calories: Math.round(Number(baseFood.calories || 0) * factor),
    protein: roundNutrient(Number(baseFood.protein || 0) * factor),
    carbohydrates: roundNutrient(Number(baseFood.carbohydrates || 0) * factor),
    fats: roundNutrient(Number(baseFood.fats || 0) * factor),
  }
  micronutrientKeys.forEach((key) => {
    if (baseFood[key] != null && Number.isFinite(Number(baseFood[key]))) scaledFood[key] = roundNutrient(Number(baseFood[key]) * factor)
  })

  const isAlreadySaved = savedFoods.some((savedFood) => isSameSavedFood(savedFood, scaledFood))

  useEffect(() => {
    if (!canSaveReusable) return
    loadSavedFoods().then(setSavedFoods).catch((error) => setSaveMessage(error.message))
  }, [canSaveReusable])

  async function saveReusableFood() {
    if (isAlreadySaved || isSavingFood) return
    setIsSavingFood(true)
    setSaveMessage('')
    try {
      const savedFood = await saveFood(scaledFood)
      setSavedFoods((current) => [savedFood, ...current.filter((item) => !isSameSavedFood(item, savedFood))])
      setSaveMessage('Saved to Saved Foods')
    } catch (error) {
      setSaveMessage(error.message)
    } finally {
      setIsSavingFood(false)
    }
  }

  return <div className="modal-backdrop" onClick={onClose}><section className="serving-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><div className="schedule-header"><SectionHeading eyebrow={canSaveReusable ? 'Edit food' : 'Add food'} title={food.name} /><button className="ghost-close" onClick={onClose} type="button">Close</button></div><div className="serving-preview"><strong>{scaledFood.calories} cal</strong><span>{food.brand || food.foodSource}</span></div><label className="serving-field">Serving size<select value={servingSize} onChange={(event) => { setServingSize(event.target.value); setSaveMessage('') }}>{options.map((option) => <option key={option}>{option}</option>)}</select></label><label className="serving-field">Number of servings<input min="0.25" step="0.25" type="number" value={servings} onChange={(event) => { setServings(event.target.value); setSaveMessage('') }} /></label><div className="serving-total"><span>Total added</span><strong>{scaledFood.calories} calories</strong><small>{scaledFood.protein}g protein · {scaledFood.carbohydrates}g carbs · {scaledFood.fats}g fat</small></div>{canSaveReusable && <><button className="secondary-button" disabled={isAlreadySaved || isSavingFood} onClick={saveReusableFood} type="button">{isAlreadySaved ? 'Already in Saved Foods' : isSavingFood ? 'Saving...' : 'Save to Saved Foods'}</button>{saveMessage && <p className="form-message">{saveMessage}</p>}</>}<button className="primary-button" onClick={() => onSave(scaledFood)} type="button">{canSaveReusable ? 'Save meal changes' : `Add to ${meal}`}</button></section></div>
}

function getServingFactor(food, selectedServing) {
  const baseGrams = parseServingGrams(food.servingSize) || estimateServingGrams(food.name, food.servingSize)
  const selectedGrams = parseServingGrams(selectedServing) || estimateServingGrams(food.name, selectedServing)
  if (!baseGrams || !selectedGrams) return 1
  return selectedGrams / baseGrams
}

function parseStoredServing(food) {
  if (food.servings != null) return { servingSize: food.servingSize || '1 serving', servings: Number(food.servings) || 1 }
  const match = String(food.servingSize || '').match(/^(\d+(?:\.\d+)?)\s*x\s*(.+)$/i)
  return match ? { servingSize: match[2], servings: Number(match[1]) } : { servingSize: food.servingSize || '1 serving', servings: 1 }
}

function parseServingGrams(serving) {
  const match = String(serving || '').match(/(\d+(?:\.\d+)?)\s*g\b/i)
  return match ? Number(match[1]) : 0
}

function estimateServingGrams(foodName, serving) {
  const text = `${foodName || ''} ${serving || ''}`.toLowerCase()
  const count = Number(String(serving || '').match(/^(\d+(?:\.\d+)?)/)?.[1] || 1)
  if (text.includes('oz')) return count * 28.35
  if (text.includes('tbsp')) return count * 15
  if (text.includes('tsp')) return count * 5
  if (text.includes('cup')) return count * 240
  if (text.includes('egg')) return count * 50
  if (text.includes('grape')) return count * 5
  return 0
}

function getServingOptions(food) {
  const name = food.name.toLowerCase()
  if (name.includes('egg')) return ['1 egg', '1 large egg', '2 eggs', '100 g']
  if (name.includes('grape')) return ['1 grape', '10 grapes', '1 cup', '100 g']
  if (name.includes('peanut butter') || name.includes('syrup')) return ['1 tbsp', '2 tbsp', '1 tsp', '100 g']
  return [...new Set([food.servingSize || '1 serving', '1 cup', '1 tbsp', '1 oz', '100 g'])]
}

function roundNutrient(value) { return Math.round(value * 10) / 10 }

function Macro({ label, tone, target, unit, value }) { return <div className={`nutrition-macro ${tone}`}><span>{label}</span><strong>{Math.round(value)} <small>/ {target ?? '—'}{unit}</small></strong><Progress value={value} target={target} tone={tone} /></div> }
function Progress({ target, tone, value }) { return <div className={`nutrition-progress ${tone}`}><span style={{ width: `${target ? Math.min(100, (Number(value) / Number(target)) * 100) : 0}%` }} /></div> }

function MealDetailModal({ date, entries, meal, onClose, onDateChange, onDelete, onEdit }) {
  useModalAccessibility(true, onClose)
  const mealEntries = entries.filter((entry) => entry.meal === meal)
  const totals = getNutritionTotals(mealEntries)
  return <div className="modal-backdrop" onClick={onClose}><section className="meal-detail-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><div className="schedule-header"><div><span className="meal-detail-eyebrow">{meal === 'Snack' ? 'Snacks' : meal}</span><label className="meal-detail-date"><input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /><Icon name="chevron" /></label></div><button className="ghost-close" onClick={onClose} type="button">Close</button></div><div className="meal-detail-totals"><span>Calories<strong>{Math.round(totals.calories)}</strong></span><span>Protein<strong>{roundNutrient(totals.protein)}g</strong></span><span>Carbs<strong>{roundNutrient(totals.carbohydrates)}g</strong></span><span>Fat<strong>{roundNutrient(totals.fats)}g</strong></span></div><div className="meal-detail-list">{mealEntries.length === 0 ? <p>No foods logged for this meal.</p> : mealEntries.map((entry) => { const serving = parseStoredServing(entry); return <article key={entry.id}><button className="meal-entry-main" onClick={() => onEdit(entry)} type="button"><strong>{entry.name}</strong><span>{serving.servingSize} · {serving.servings} serving{serving.servings === 1 ? '' : 's'}</span><em>{entry.calories} calories · P {entry.protein}g · C {entry.carbohydrates}g · F {entry.fats}g</em></button><div><button onClick={() => onEdit(entry)} type="button">Edit</button><button className="remove" onClick={() => onDelete(entry.id)} type="button">Delete</button></div></article> })}</div></section></div>
}

function NutritionDetailsModal({ entries, hydrationMl, onClose, targets, totals, unitSystem }) {
  useModalAccessibility(true, onClose)
  const mealTotals = Object.entries(entries.reduce((result, entry) => { const meal = entry.meal || 'Other'; result[meal] = (result[meal] || 0) + Number(entry.calories || 0); return result }, {})).map(([name, calories]) => ({ name, calories })).filter((item) => item.calories > 0)
  const colors = ['#2f8cff', '#6aa76d', '#e8b04f', '#f08b46', '#a878d8', '#6b879f']
  const nutrients = [['Fiber', totals.fiber, 'g'], ['Sugar', totals.sugar, 'g'], ['Saturated fat', totals.saturatedFat, 'g'], ['Polyunsaturated fat', totals.polyunsaturatedFat, 'g'], ['Monounsaturated fat', totals.monounsaturatedFat, 'g'], ['Trans fat', totals.transFat, 'g'], ['Cholesterol', totals.cholesterol, 'mg'], ['Sodium', totals.sodium, 'mg'], ['Potassium', totals.potassium, 'mg'], ['Vitamin A', totals.vitaminA, 'mcg RAE'], ['Vitamin C', totals.vitaminC, 'mg'], ['Vitamin D', totals.vitaminD, 'mcg'], ['Vitamin E', totals.vitaminE, 'mg'], ['Vitamin K', totals.vitaminK, 'mcg'], ['Calcium', totals.calcium, 'mg'], ['Iron', totals.iron, 'mg']]
  return <div className="modal-backdrop" onClick={onClose}><section className="nutrition-details-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><div className="schedule-header"><SectionHeading eyebrow="Nutrition details" title="Your day at a glance." /><button className="ghost-close" onClick={onClose} type="button">Close</button></div><div className="nutrition-detail-list"><span>Calories<strong>{totals.calories} / {targets.calories ?? '—'}</strong></span><span>Protein<strong>{totals.protein}g / {targets.protein ?? '—'}g</strong></span><span>Carbohydrates<strong>{totals.carbohydrates}g / {targets.carbohydrates ?? '—'}g</strong></span><span>Fat<strong>{totals.fats}g / {targets.fats ?? '—'}g</strong></span><span>Water<strong>{formatHydration(hydrationMl, unitSystem)}</strong></span><span>Foods logged<strong>{entries.length}</strong></span></div><div className="nutrition-meal-chart"><h3>Calories by meal</h3>{mealTotals.length ? <ResponsiveContainer height={210} width="100%"><PieChart><Pie data={mealTotals} dataKey="calories" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3}>{mealTotals.map((item, index) => <Cell fill={colors[index % colors.length]} key={item.name} />)}</Pie><Tooltip formatter={(value) => [`${value} calories`, '']} /></PieChart></ResponsiveContainer> : <p>No calorie breakdown yet.</p>}<div className="nutrition-chart-legend">{mealTotals.map((item, index) => <span key={item.name}><i style={{ background: colors[index % colors.length] }} />{item.name}: {item.calories} cal</span>)}</div></div><div className="nutrition-detail-list expanded">{nutrients.map(([label, value, unit]) => <span key={label}>{label}<strong>{Math.round(Number(value || 0) * 10) / 10}{unit}</strong></span>)}</div></section></div>
}
