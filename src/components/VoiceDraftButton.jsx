import { createPortal } from 'react-dom'
import { useRef, useState } from 'react'
import { generateAiRecommendation } from '../lib/aiRecommendations'

export function VoiceDraftButton({ logType = 'check_in', onApply, onQuickSave }) {
  const recognitionRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [message, setMessage] = useState('')

  function openModal() {
    setMessage('')
    setOpen(true)
  }

  function start() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setMessage('Voice input is not available in this browser. You can type the check-in below.')
      return
    }

    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition
    setMessage('Speak naturally about how you feel before this event.')
    setStatus('listening')
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result?.[0]?.transcript ?? '')
        .join(' ')
        .trim()
      if (text) setTranscript(text)
    }
    recognition.onerror = () => {
      setMessage('Voice input stopped. You can try again or edit the text below.')
      setStatus('idle')
    }
    recognition.onend = () => setStatus('idle')
    recognition.start()
  }

  function stop() {
    recognitionRef.current?.stop?.()
    setStatus('idle')
  }

  async function generateDraft() {
    if (!transcript.trim()) {
      setMessage('Record or type something first.')
      return
    }

    setStatus('processing')
    setMessage('Reading the information you shared…')
    try {
      const recommendation = await generateAiRecommendation({
        requestType: 'quick_checkin',
        logType,
        quickTranscript: transcript.trim(),
      })
      onApply?.({ quickRecommendation: recommendation, inputMethod: 'quick', voiceTranscript: transcript.trim() })
      onQuickSave?.({ quickRecommendation: recommendation, inputMethod: 'quick', voiceTranscript: transcript.trim() })
      setOpen(false)
      setMessage('')
      setStatus('idle')
    } catch (error) {
      setMessage(error.message || 'The quick recommendation could not be generated.')
      setStatus('idle')
    }
  }

  function close() {
    stop()
    setOpen(false)
  }

  return (
    <>
      <button className="secondary-button compact-action" onClick={openModal} type="button">Quick check-in</button>
      {open && createPortal(
        <div className="modal-backdrop" onClick={close}>
          <section className="voice-checkin-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="schedule-header">
              <div><p className="eyebrow">Quick check-in</p><h2>Tell us how you feel.</h2></div>
              <button className="ghost-close" onClick={close} type="button">Close</button>
            </div>
            <p className="field-description">Speak or type your quick check-in. You can edit anything the voice capture heard before the AI uses it to build your recommendation.</p>
            <button className={status === 'listening' ? 'primary-button listening' : 'primary-button'} disabled={status === 'processing' || status === 'ready'} onClick={status === 'listening' ? stop : start} type="button">
              {status === 'listening' ? 'Stop listening' : status === 'processing' ? 'Reading voice…' : status === 'ready' ? 'Draft added' : 'Start voice'}
            </button>
            <label className="voice-transcript-field">Edit what was captured
              <textarea value={transcript} onChange={(event) => { setTranscript(event.target.value); setStatus('idle') }} placeholder="Your words will appear here. You can type or edit them." rows={7} />
            </label>
            {message && <p className="form-message">{message}</p>}
            <button className="secondary-button" disabled={!transcript.trim() || status === 'processing' || status === 'ready'} onClick={generateDraft} type="button">Generate recommendation input</button>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
