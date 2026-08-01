import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { findFoodByBarcode, searchFoods } from '../lib/foodApi'
import { getHydrationTarget, getNutritionTargets, getNutritionTotals, mealOptions } from '../lib/nutrition'
import { SectionHeading } from './SectionHeading'

const quickWaterAmounts = [8, 16, 20, 32, 64]
const mealCards = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
const emptyFood = { calories: '', carbohydrates: '', fats: '', name: '', protein: '', servingSize: '1 serving' }

export function NutritionView({ athleteProfile, nutritionHistory = [], onSaveWellness, schedule }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [selectedDate, setSelectedDate] = useState(today)
  const [isDateOpen, setIsDateOpen] = useState(false)
  const [loggingMeal, setLoggingMeal] = useState(null)
  const [selectedFood, setSelectedFood] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const wellness = nutritionHistory.find((entry) => entry.date === selectedDate) ?? { date: selectedDate, hydrationOz: 0, nutritionEntries: [] }
  const entries = wellness.nutritionEntries ?? []
  const totals = getNutritionTotals(entries)
  const targets = useMemo(() => getNutritionTargets(athleteProfile, schedule, selectedDate), [athleteProfile, schedule, selectedDate])
  const hydrationTarget = getHydrationTarget(athleteProfile, schedule, selectedDate)

  function save(next) {
    onSaveWellness?.({ ...wellness, ...next, date: selectedDate })
  }

  function changeWater(amount) {
    save({ hydrationOz: Math.max(0, Number(wellness.hydrationOz ?? 0) + amount) })
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
        <button className="nutrition-detail-button" onClick={() => setDetailsOpen(true)} type="button" aria-label="View nutrition details">↔</button>
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
        <div><span>Water</span><strong>{wellness.hydrationOz} / {hydrationTarget} fl oz</strong></div>
        <div className="nutrition-water-actions"><button onClick={() => changeWater(-1)} type="button" aria-label="Subtract one fluid ounce">−</button>{quickWaterAmounts.map((amount) => <button key={amount} onClick={() => changeWater(amount)} type="button">+{amount}</button>)}<button onClick={() => changeWater(1)} type="button" aria-label="Add one fluid ounce">+</button></div>
      </section>

      <section className="nutrition-meals-section">
        <div className="nutrition-section-title"><h2>Meals</h2><span>{entries.length} logged</span></div>
        <div className="nutrition-meal-grid">{mealCards.map((meal) => <MealCard key={meal} meal={meal} entries={entries} onLog={() => setLoggingMeal(meal === 'Snacks' ? 'Snack' : meal)} onRemove={removeFood} />)}</div>
      </section>

      <p className="nutrition-target-note">{targets.reason}</p>

      {loggingMeal && <NutritionModalPortal><FoodLogModal initialMeal={loggingMeal} onClose={() => setLoggingMeal(null)} onSelectFood={(food) => setSelectedFood({ food, meal: loggingMeal })} onSave={(food) => { save({ nutritionEntries: [...entries, { ...food, id: `food-${Date.now()}`, loggedAt: new Date().toISOString() }] }); setLoggingMeal(null) }} /></NutritionModalPortal>}
      {selectedFood && <NutritionModalPortal><ServingModal food={selectedFood.food} meal={selectedFood.meal} onClose={() => setSelectedFood(null)} onSave={(food) => { save({ nutritionEntries: [...entries, { ...food, id: `food-${Date.now()}`, loggedAt: new Date().toISOString() }] }); setSelectedFood(null); setLoggingMeal(null) }} /></NutritionModalPortal>}
      {detailsOpen && <NutritionModalPortal><NutritionDetailsModal entries={entries} hydrationOz={wellness.hydrationOz} onClose={() => setDetailsOpen(false)} targets={targets} totals={totals} /></NutritionModalPortal>}
    </div>
  )
}

function NutritionModalPortal({ children }) {
  return createPortal(children, document.body)
}

function MealCard({ entries, meal, onLog, onRemove }) {
  const mealEntries = entries.filter((entry) => entry.meal === (meal === 'Snacks' ? 'Snack' : meal))
  return <article className="nutrition-meal-card"><div className="nutrition-meal-icon" aria-hidden="true"><MealIcon meal={meal} /></div><div className="nutrition-meal-content"><h3>{meal}</h3>{mealEntries.length === 0 ? <p>Nothing logged yet</p> : <div>{mealEntries.map((entry) => <span key={entry.id}>{entry.name} · {entry.calories} cal<button onClick={() => onRemove(entry.id)} type="button" aria-label={`Remove ${entry.name}`}>×</button></span>)}</div>}</div><button className="nutrition-log-button" onClick={onLog} type="button">Log</button></article>
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
  const [barcode, setBarcode] = useState('')
  const [results, setResults] = useState([])
  const [manualFood, setManualFood] = useState(emptyFood)
  const [showManual, setShowManual] = useState(false)
  const [message, setMessage] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scanTimerRef = useRef(null)
  const readerRef = useRef(null)

  useEffect(() => () => stopScanner(), [])

  function stopScanner() {
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current)
    scanTimerRef.current = null
    readerRef.current?.reset?.()
    readerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setIsScanning(false)
  }

  async function startScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Camera scanning is not available here. Enter the barcode number below instead.')
      return
    }

    try {
      setMessage('')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamRef.current = stream
      setIsScanning(true)
      requestAnimationFrame(async () => {
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
        readerRef.current = reader
        reader.decodeFromStream(stream, videoRef.current, async (result) => {
        if (!result || !streamRef.current) return
        const normalizedBarcode = normalizeBarcode(result.getText())
        if (!normalizedBarcode) return
        setBarcode(normalizedBarcode)
        stopScanner()
        try {
          const food = await findFoodByBarcode(normalizedBarcode)
          setResults(food ? [food] : [])
          if (!food) setMessage('No food found for that barcode.')
        } catch (error) {
          setMessage(error.message)
        }
        })
      })
      return
      /*
      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          const value = codes[0]?.rawValue
          if (value) {
            const normalizedBarcode = normalizeBarcode(value)
            setBarcode(normalizedBarcode)
            stopScanner()
            try {
              const food = await findFoodByBarcode(normalizedBarcode)
              setResults(food ? [food] : [])
              if (!food) setMessage('No food found for that barcode.')
            } catch (error) {
              setMessage(error.message)
            }
            return
          }
        } catch {
          // Keep scanning until the camera produces a usable barcode.
        }
        scanTimerRef.current = window.setTimeout(scan, 250)
      }
      scan()
      */
    } catch {
      setMessage('Camera access was unavailable. Enter the barcode number below instead.')
      stopScanner()
    }
  }

  async function search() {
    try { setMessage(''); setResults(await searchFoods(query)) } catch (error) { setMessage(error.message) }
  }

  async function barcodeSearch() {
    const normalizedBarcode = normalizeBarcode(barcode)
    setBarcode(normalizedBarcode)
    if (!normalizedBarcode) {
      setMessage('Enter a valid barcode number.')
      return
    }
    try { setMessage(''); const food = await findFoodByBarcode(normalizedBarcode); setResults(food ? [food] : []); if (!food) setMessage('No food found for that barcode.') } catch (error) { setMessage(error.message) }
  }

  function selectFood(food) { if (onSelectFood) onSelectFood(food); else onSave({ ...food, meal }) }

  function saveManual() {
    if (!manualFood.name.trim()) return
    onSave({ ...manualFood, meal, foodSource: 'Manual entry', calories: Number(manualFood.calories || 0), protein: Number(manualFood.protein || 0), carbohydrates: Number(manualFood.carbohydrates || 0), fats: Number(manualFood.fats || 0) })
  }

  return <div className="modal-backdrop" onClick={onClose}><section className="food-log-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><div className="schedule-header"><SectionHeading eyebrow="Log food" title="Add to your day." /><button className="ghost-close" onClick={onClose} type="button">Close</button></div><div className="food-meal-switcher">{mealOptions.map((option) => <button className={meal === option ? 'active' : ''} key={option} onClick={() => setMeal(option)} type="button">{option}</button>)}</div><div className="food-modal-search"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && search()} placeholder="Search foods, brands, flavors…" /><button className="primary-button compact-action" onClick={search} type="button">Search</button></div><div className="food-modal-actions"><button className="secondary-button compact-action" onClick={isScanning ? stopScanner : startScanner} type="button">{isScanning ? 'Stop scan' : 'Barcode scan'}</button><input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(normalizeBarcode(event.target.value))} onKeyDown={(event) => event.key === 'Enter' && barcodeSearch()} placeholder="Barcode number" /><button className="secondary-button compact-action" onClick={barcodeSearch} type="button">Look up</button><button className="secondary-button compact-action" onClick={() => setShowManual((current) => !current)} type="button">Manual entry</button></div>{isScanning && <div className="barcode-scanner"><video ref={videoRef} muted playsInline /><p>Point the camera at the barcode.</p></div>}{message && <p className="form-error">{message}</p>}{results.length > 0 && <div className="food-results">{results.map((food, index) => <button key={`${food.barcode}-${index}`} onClick={() => selectFood(food)} type="button"><strong>{food.name}</strong><span>{[food.brand, food.servingSize].filter(Boolean).join(' · ')}</span><em>{food.calories} kcal · P {food.protein}g · C {food.carbohydrates}g · F {food.fats}g</em></button>)}</div>}{showManual && <div className="manual-food-grid">{[['name', 'Food name'], ['servingSize', 'Serving size'], ['calories', 'Calories'], ['protein', 'Protein (g)'], ['carbohydrates', 'Carbs (g)'], ['fats', 'Fat (g)']].map(([field, label]) => <label key={field}>{label}<input type={field === 'name' || field === 'servingSize' ? 'text' : 'number'} value={manualFood[field]} onChange={(event) => setManualFood((current) => ({ ...current, [field]: event.target.value }))} /></label>)}<button className="primary-button compact-action" onClick={saveManual} type="button">Add manually</button></div>}</section></div>
}

function normalizeBarcode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 14)
}

function ServingModal({ food, meal, onClose, onSave }) {
  const options = getServingOptions(food)
  const [servingSize, setServingSize] = useState(options[0])
  const [servings, setServings] = useState(1)
  const factor = getServingFactor(food, servingSize) * Math.max(0, Number(servings) || 0)
  const scaledFood = {
    ...food,
    meal,
    servingSize: `${servings} x ${servingSize}`,
    calories: Math.round(Number(food.calories || 0) * factor),
    protein: roundNutrient(Number(food.protein || 0) * factor),
    carbohydrates: roundNutrient(Number(food.carbohydrates || 0) * factor),
    fats: roundNutrient(Number(food.fats || 0) * factor),
  }

  return <div className="modal-backdrop" onClick={onClose}><section className="serving-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><div className="schedule-header"><SectionHeading eyebrow="Add food" title={food.name} /><button className="ghost-close" onClick={onClose} type="button">Close</button></div><div className="serving-preview"><strong>{scaledFood.calories} cal</strong><span>{food.brand || food.foodSource}</span></div><label className="serving-field">Serving size<select value={servingSize} onChange={(event) => setServingSize(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label><label className="serving-field">Number of servings<input min="0.25" step="0.25" type="number" value={servings} onChange={(event) => setServings(event.target.value)} /></label><div className="serving-total"><span>Total added</span><strong>{scaledFood.calories} calories</strong><small>{scaledFood.protein}g protein · {scaledFood.carbohydrates}g carbs · {scaledFood.fats}g fat</small></div><button className="primary-button" onClick={() => onSave(scaledFood)} type="button">Add to {meal}</button></section></div>
}

function getServingFactor(food, selectedServing) {
  const baseGrams = parseServingGrams(food.servingSize) || estimateServingGrams(food.name, food.servingSize)
  const selectedGrams = parseServingGrams(selectedServing) || estimateServingGrams(food.name, selectedServing)
  if (!baseGrams || !selectedGrams) return 1
  return selectedGrams / baseGrams
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
  return [food.servingSize || '1 serving', '1 cup', '1 tbsp', '1 oz', '100 g']
}

function roundNutrient(value) { return Math.round(value * 10) / 10 }

function Macro({ label, tone, target, unit, value }) { return <div className={`nutrition-macro ${tone}`}><span>{label}</span><strong>{Math.round(value)} <small>/ {target ?? '—'}{unit}</small></strong><Progress value={value} target={target} tone={tone} /></div> }
function Progress({ target, tone, value }) { return <div className={`nutrition-progress ${tone}`}><span style={{ width: `${target ? Math.min(100, (Number(value) / Number(target)) * 100) : 0}%` }} /></div> }
function NutritionDetailsModal({ entries, hydrationOz, onClose, targets, totals }) {
  const mealTotals = Object.entries(entries.reduce((result, entry) => { const meal = entry.meal || 'Other'; result[meal] = (result[meal] || 0) + Number(entry.calories || 0); return result }, {})).map(([name, calories]) => ({ name, calories })).filter((item) => item.calories > 0)
  const colors = ['#2f8cff', '#6aa76d', '#e8b04f', '#f08b46', '#a878d8', '#6b879f']
  const nutrients = [['Fiber', totals.fiber, 'g'], ['Sugar', totals.sugar, 'g'], ['Saturated fat', totals.saturatedFat, 'g'], ['Polyunsaturated fat', totals.polyunsaturatedFat, 'g'], ['Monounsaturated fat', totals.monounsaturatedFat, 'g'], ['Trans fat', totals.transFat, 'g'], ['Cholesterol', totals.cholesterol, 'mg'], ['Sodium', totals.sodium, 'mg'], ['Potassium', totals.potassium, 'mg'], ['Vitamin A', totals.vitaminA, 'mcg'], ['Vitamin C', totals.vitaminC, 'mg'], ['Vitamin D', totals.vitaminD, 'mcg'], ['Vitamin E', totals.vitaminE, 'mg'], ['Vitamin K', totals.vitaminK, 'mcg'], ['Calcium', totals.calcium, 'mg'], ['Iron', totals.iron, 'mg']]
  return <div className="modal-backdrop" onClick={onClose}><section className="nutrition-details-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><div className="schedule-header"><SectionHeading eyebrow="Nutrition details" title="Your day at a glance." /><button className="ghost-close" onClick={onClose} type="button">Close</button></div><div className="nutrition-detail-list"><span>Calories<strong>{totals.calories} / {targets.calories ?? '—'}</strong></span><span>Protein<strong>{totals.protein}g / {targets.protein ?? '—'}g</strong></span><span>Carbohydrates<strong>{totals.carbohydrates}g / {targets.carbohydrates ?? '—'}g</strong></span><span>Fat<strong>{totals.fats}g / {targets.fats ?? '—'}g</strong></span><span>Water<strong>{hydrationOz} fl oz</strong></span><span>Foods logged<strong>{entries.length}</strong></span></div><div className="nutrition-meal-chart"><h3>Calories by meal</h3>{mealTotals.length ? <ResponsiveContainer height={210} width="100%"><PieChart><Pie data={mealTotals} dataKey="calories" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3}>{mealTotals.map((item, index) => <Cell fill={colors[index % colors.length]} key={item.name} />)}</Pie><Tooltip formatter={(value) => [`${value} calories`, '']} /></PieChart></ResponsiveContainer> : <p>No calorie breakdown yet.</p>}<div className="nutrition-chart-legend">{mealTotals.map((item, index) => <span key={item.name}><i style={{ background: colors[index % colors.length] }} />{item.name}: {item.calories} cal</span>)}</div></div><div className="nutrition-detail-list expanded">{nutrients.map(([label, value, unit]) => <span key={label}>{label}<strong>{Math.round(Number(value || 0) * 10) / 10}{unit}</strong></span>)}</div></section></div>
}
