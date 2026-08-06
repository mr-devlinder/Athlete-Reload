import { createPortal } from 'react-dom'
import { useState } from 'react'
import { generateAiRecommendation } from '../lib/aiRecommendations'
import { formatRecordingTime, useAudioRecorder } from '../hooks/useAudioRecorder'

export function VoiceDraftButton({ logType = 'check_in', onApply, onQuickSave }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [message, setMessage] = useState('')
  const recorder = useAudioRecorder({ onTranscript: setTranscript })

  function openModal() {
    setMessage('')
    setOpen(true)
  }

  async function generateDraft() {
    if (!transcript.trim()) {
      setMessage('Record or type something first.')
      return
    }
    recorder.stop()
    setStatus('processing')
    setMessage('Reading the information you shared...')
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
    recorder.stop({ cancelled: true })
    setOpen(false)
  }

  return (
    <>
      <button className="secondary-button compact-action" onClick={openModal} type="button">{logType === 'post_checkout' ? 'Quick checkout' : 'Quick check-in'}</button>
      {open && createPortal(
        <div className="modal-backdrop" onClick={close}>
          <section className="voice-checkin-modal glass-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="schedule-header">
              <div><p className="eyebrow">{logType === 'post_checkout' ? 'Quick checkout' : 'Quick check-in'}</p><h2>Tell us how you feel.</h2></div>
              <button className="ghost-close" onClick={close} type="button">Close</button>
            </div>
            <p className="field-description">Speak or type your entry. You can edit the transcript before it is used.</p>
            <button className={recorder.isRecording ? 'primary-button listening' : 'primary-button'} disabled={status === 'processing' || recorder.status === 'requesting'} onClick={recorder.isRecording ? () => recorder.stop() : recorder.start} type="button">
              {recorder.isRecording ? `Stop recording (${formatRecordingTime(recorder.elapsedSeconds)})` : recorder.status === 'requesting' ? 'Waiting for permission...' : status === 'processing' ? 'Reading voice...' : 'Start voice'}
            </button>
            {recorder.isRecording && <p className="recording-indicator" role="status"><span aria-hidden="true" />Recording {formatRecordingTime(recorder.elapsedSeconds)}</p>}
            <label className="voice-transcript-field">Edit what was captured
              <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Your words will appear here. You can type or edit them." rows={7} />
            </label>
            {(recorder.error || message) && <p className="form-message">{recorder.error || message}</p>}
            <button className="secondary-button" disabled={!transcript.trim() || status === 'processing'} onClick={generateDraft} type="button">Generate recommendation input</button>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
