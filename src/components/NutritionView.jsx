import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { findFoodByBarcode, getFoodCuratorStatus, isSameSavedFood, loadSavedFoods, removeSavedFood, saveFood, searchFoods, verifyFood } from '../lib/foodApi'
import { getHydrationTarget, getNutritionTargets, getNutritionTotals, mealOptions } from '../lib/nutrition'
import { SectionHeading } from './SectionHeading'

const quickWaterAmounts = [8, 16, 20, 32, 64]
const mealCards = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']

export function NutritionView({ athleteProfile, nutritionHistory = [], onSaveWellness, schedule }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [selectedDate, setSelectedDate] = useState(today)
  const [isDateOpen, setIsDateOpen] = useState(false)
  const [loggingMeal, setLoggingMeal] = useState(null)
  const [selectedFood, setSelectedFood] = useState(null)
  const [openMeal, setOpenMeal] = useState(null)
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
        <div className="nutrition-meal-grid">{mealCards.map((meal) => <MealCard key={meal} meal={meal} entries={entries} onOpen={() => setOpenMeal(meal === 'Snacks' ? 'Snack' : meal)} onLog={() => setLoggingMeal(meal === 'Snacks' ? 'Snack' : meal)} />)}</div>
      </section>

      <p className="nutrition-target-note">{targets.reason}</p>

      {loggingMeal && <NutritionModalPortal><FoodLogModal initialMeal={loggingMeal} onClose={() => setLoggingMeal(null)} onSelectFood={(food, meal) => setSelectedFood({ food, meal })} onSave={(food) => { save({ nutritionEntries: [...entries, { ...food, id: `food-${Date.now()}`, loggedAt: new Date().toISOString() }] }); setLoggingMeal(null) }} /></NutritionModalPortal>}
      {selectedFood && <NutritionModalPortal><ServingModal canSaveReusable={Boolean(selectedFood.entryId)} food={selectedFood.food} meal={selectedFood.meal} onClose={() => setSelectedFood(null)} onSave={(food) => { save({ nutritionEntries: selectedFood.entryId ? entries.map((entry) => entry.id === selectedFood.entryId ? { ...food, id: entry.id, loggedAt: entry.loggedAt } : entry) : [...entries, { ...food, id: `food-${Date.now()}`, loggedAt: new Date().toISOString() }] }); setSelectedFood(null); setLoggingMeal(null) }} /></NutritionModalPortal>}
      {openMeal && <NutritionModalPortal><MealDetailModal date={selectedDate} entries={entries} meal={openMeal} onClose={() => setOpenMeal(null)} onDateChange={setSelectedDate} onDelete={removeFood} onEdit={(entry) => { setOpenMeal(null); setSelectedFood({ food: entry, meal: openMeal, entryId: entry.id }) }} /></NutritionModalPortal>}
      {detailsOpen && <NutritionModalPortal><NutritionDetailsModal entries={entries} hydrationOz={wellness.hydrationOz} onClose={() => setDetailsOpen(false)} targets={targets} totals={totals} /></NutritionModalPortal>}
    </div>
  )
}

function NutritionModalPortal({ children }) {
  return createPortal(children, document.body)
}

function MealCard({ entries, meal, onLog, onOpen }) {
  const mealEntries = entries.filter((entry) => entry.meal === (meal === 'Snacks' ? 'Snack' : meal))
  return <article className="nutrition-meal-card nutrition-meal-card-clickable" onClick={onOpen}><div className="nutrition-meal-icon" aria-hidden="true"><MealIcon meal={meal} /></div><div className="nutrition-meal-content"><h3>{meal}</h3>{mealEntries.length === 0 ? <p>Nothing logged yet</p> : <p>{mealEntries.length} food{mealEntries.length === 1 ? '' : 's'} · {Math.round(getNutritionTotals(mealEntries).calories)} cal</p>}</div><button className="nutrition-log-button" onClick={(event) => { event.stopPropagation(); onLog() }} type="button">Log</button></article>
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
  const [isScanning, setIsScanning] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [savedFoods, setSavedFoods] = useState([])
  const [isFoodCurator, setIsFoodCurator] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scanTimerRef = useRef(null)
  const readerRef = useRef(null)

  useEffect(() => {
    Promise.all([loadSavedFoods(), getFoodCuratorStatus()]).then(([foods, isCurator]) => { setSavedFoods(foods); setIsFoodCurator(isCurator) }).catch(() => {})
    return () => stopScanner()
  }, [])

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

  function startVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { setMessage('Voice search is not supported in this browser.'); return }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setMessage('Voice search could not hear a food. Try again.')
    recognition.onresult = (event) => { const value = event.results?.[0]?.[0]?.transcript?.trim() ?? ''; setQuery(value); if (value) search(value) }
    recognition.start()
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

  return <div className="modal-backdrop" onClick={onClose}><section className="food-log-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><div className="schedule-header"><div className="food-meal-select-wrap"><span>Log food to</span><label><select value={meal} onChange={(event) => setMeal(event.target.value)}>{mealOptions.filter((option) => option !== 'Custom').map((option) => <option key={option} value={option}>{option === 'Snack' ? 'Snacks' : option}</option>)}</select><Icon name="chevron" /></label></div><button className="ghost-close" onClick={onClose} type="button">Close</button></div><div className="food-modal-search"><Icon name="search" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && search()} placeholder="Search foods, brands, and flavors..." /><button aria-label="Search" onClick={() => search()} type="button"><Icon name="search" /></button></div><div className="food-modal-actions"><button onClick={isScanning ? stopScanner : startScanner} type="button"><Icon name="barcode" />{isScanning ? 'Stop Scan' : 'Barcode Scan'}</button><button onClick={startVoiceSearch} type="button"><Icon name="mic" />{isListening ? 'Listening...' : 'Voice Search'}</button><button onClick={() => { setQuery(''); setResults(savedFoods); setMessage('') }} type="button"><Icon name="bookmark" />Saved Foods</button></div>{isScanning && <div className="barcode-scanner"><video ref={videoRef} muted playsInline /><p>Point the camera at the barcode.</p></div>}{message && <p className="form-message">{message}</p>}{results.length > 0 && <div className="food-results">{results.map((food, index) => <FoodResult food={food} isCurator={isFoodCurator} key={`${foodResultKey(food)}-${index}`} onPromote={promoteFood} onSave={toggleSaved} onSelect={selectFood} />)}</div>}</section></div>
}

function FoodResult({ food, isCurator, onPromote, onSave, onSelect }) {
  const suggestions = getServingOptions(food).filter((option) => option !== food.servingSize && option !== '100 g').slice(0, 2)
  return <div className="food-result-row"><button className="food-result-main" onClick={() => onSelect(food)} type="button"><strong>{food.name}{food.isVerified ? ' ✓' : ''}</strong><span>{[food.brand, food.servingSize].filter(Boolean).join(' · ')}</span>{suggestions.length > 0 && <small>Serving options: {suggestions.join(' or ')}</small>}<em>{food.calories} kcal · P {food.protein}g · C {food.carbohydrates}g · F {food.fats}g</em></button><div className="food-result-actions"><button onClick={() => onSave(food)} type="button">{food.isSaved ? 'Saved' : 'Save'}</button>{isCurator && !food.isVerified && <button onClick={() => onPromote(food)} type="button">Verify</button>}</div></div>
}

function foodResultKey(food) { return String(food.barcode || `${food.name}|${food.brand}|${food.servingSize}`).toLowerCase() }

function Icon({ name }) {
  const common = { 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.8, viewBox: '0 0 24 24' }
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
  if (name === 'barcode') return <svg {...common}><path d="M4 5v14M7 5v14M11 5v14M14 5v14M16.5 5v14M20 5v14" /></svg>
  if (name === 'mic') return <svg {...common}><rect height="11" rx="3.5" width="7" x="8.5" y="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" /></svg>
  if (name === 'bookmark') return <svg {...common}><path d="M6.5 4.5A1.5 1.5 0 0 1 8 3h8a1.5 1.5 0 0 1 1.5 1.5V21L12 17l-5.5 4V4.5Z" /></svg>
  return <svg {...common}><path d="m7 9 5 5 5-5" /></svg>
}

function normalizeBarcode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 14)
}

function ServingModal({ canSaveReusable = false, food, meal, onClose, onSave }) {
  const options = getServingOptions(food)
  const [servingSize, setServingSize] = useState(options[0])
  const [servings, setServings] = useState(1)
  const [savedFoods, setSavedFoods] = useState([])
  const [saveMessage, setSaveMessage] = useState('')
  const [isSavingFood, setIsSavingFood] = useState(false)
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

function MealDetailModal({ date, entries, meal, onClose, onDateChange, onDelete, onEdit }) {
  const mealEntries = entries.filter((entry) => entry.meal === meal)
  const totals = getNutritionTotals(mealEntries)
  return <div className="modal-backdrop" onClick={onClose}><section className="meal-detail-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><div className="schedule-header"><div><span className="meal-detail-eyebrow">{meal === 'Snack' ? 'Snacks' : meal}</span><label className="meal-detail-date"><input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /><Icon name="chevron" /></label></div><button className="ghost-close" onClick={onClose} type="button">Close</button></div><div className="meal-detail-totals"><span>Calories<strong>{Math.round(totals.calories)}</strong></span><span>Protein<strong>{roundNutrient(totals.protein)}g</strong></span><span>Carbs<strong>{roundNutrient(totals.carbohydrates)}g</strong></span><span>Fat<strong>{roundNutrient(totals.fats)}g</strong></span></div><div className="meal-detail-list">{mealEntries.length === 0 ? <p>No foods logged for this meal.</p> : mealEntries.map((entry) => <article key={entry.id}><button className="meal-entry-main" onClick={() => onEdit(entry)} type="button"><strong>{entry.name}</strong><span>{entry.servingSize}</span><em>{entry.calories} calories · P {entry.protein}g · C {entry.carbohydrates}g · F {entry.fats}g</em></button><div><button onClick={() => onEdit(entry)} type="button">Edit</button><button className="remove" onClick={() => onDelete(entry.id)} type="button">Delete</button></div></article>)}</div></section></div>
}

function NutritionDetailsModal({ entries, hydrationOz, onClose, targets, totals }) {
  const mealTotals = Object.entries(entries.reduce((result, entry) => { const meal = entry.meal || 'Other'; result[meal] = (result[meal] || 0) + Number(entry.calories || 0); return result }, {})).map(([name, calories]) => ({ name, calories })).filter((item) => item.calories > 0)
  const colors = ['#2f8cff', '#6aa76d', '#e8b04f', '#f08b46', '#a878d8', '#6b879f']
  const nutrients = [['Fiber', totals.fiber, 'g'], ['Sugar', totals.sugar, 'g'], ['Saturated fat', totals.saturatedFat, 'g'], ['Polyunsaturated fat', totals.polyunsaturatedFat, 'g'], ['Monounsaturated fat', totals.monounsaturatedFat, 'g'], ['Trans fat', totals.transFat, 'g'], ['Cholesterol', totals.cholesterol, 'mg'], ['Sodium', totals.sodium, 'mg'], ['Potassium', totals.potassium, 'mg'], ['Vitamin A', totals.vitaminA, 'mcg'], ['Vitamin C', totals.vitaminC, 'mg'], ['Vitamin D', totals.vitaminD, 'mcg'], ['Vitamin E', totals.vitaminE, 'mg'], ['Vitamin K', totals.vitaminK, 'mcg'], ['Calcium', totals.calcium, 'mg'], ['Iron', totals.iron, 'mg']]
  return <div className="modal-backdrop" onClick={onClose}><section className="nutrition-details-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><div className="schedule-header"><SectionHeading eyebrow="Nutrition details" title="Your day at a glance." /><button className="ghost-close" onClick={onClose} type="button">Close</button></div><div className="nutrition-detail-list"><span>Calories<strong>{totals.calories} / {targets.calories ?? '—'}</strong></span><span>Protein<strong>{totals.protein}g / {targets.protein ?? '—'}g</strong></span><span>Carbohydrates<strong>{totals.carbohydrates}g / {targets.carbohydrates ?? '—'}g</strong></span><span>Fat<strong>{totals.fats}g / {targets.fats ?? '—'}g</strong></span><span>Water<strong>{hydrationOz} fl oz</strong></span><span>Foods logged<strong>{entries.length}</strong></span></div><div className="nutrition-meal-chart"><h3>Calories by meal</h3>{mealTotals.length ? <ResponsiveContainer height={210} width="100%"><PieChart><Pie data={mealTotals} dataKey="calories" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3}>{mealTotals.map((item, index) => <Cell fill={colors[index % colors.length]} key={item.name} />)}</Pie><Tooltip formatter={(value) => [`${value} calories`, '']} /></PieChart></ResponsiveContainer> : <p>No calorie breakdown yet.</p>}<div className="nutrition-chart-legend">{mealTotals.map((item, index) => <span key={item.name}><i style={{ background: colors[index % colors.length] }} />{item.name}: {item.calories} cal</span>)}</div></div><div className="nutrition-detail-list expanded">{nutrients.map(([label, value, unit]) => <span key={label}>{label}<strong>{Math.round(Number(value || 0) * 10) / 10}{unit}</strong></span>)}</div></section></div>
}
