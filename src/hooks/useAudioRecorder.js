import { useEffect, useRef, useState } from 'react'

export function useAudioRecorder({ maxSeconds = 120, onAudio, onTranscript } = {}) {
  const mountedRef = useRef(true)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const recognitionRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const intentionalStopRef = useRef(false)
  const cancelledRecordingRef = useRef(false)
  const transcriptHandlerRef = useRef(onTranscript)
  const audioHandlerRef = useRef(onAudio)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')

  transcriptHandlerRef.current = onTranscript
  audioHandlerRef.current = onAudio

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  function stop({ cancelled = false } = {}) {
    intentionalStopRef.current = true
    cancelledRecordingRef.current = cancelled
    window.clearInterval(timerRef.current)
    timerRef.current = null
    recognitionRef.current?.stop?.()
    recognitionRef.current = null
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    } else {
      recorderRef.current = null
      releaseStream()
    }
    if (mountedRef.current) setStatus(cancelled ? 'idle' : 'ready')
  }

  async function start() {
    if (['requesting', 'recording'].includes(status)) return
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      setError('Audio recording is not supported in this browser. Type your entry instead.')
      return
    }

    setStatus('requesting')
    intentionalStopRef.current = false
    cancelledRecordingRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      if (!mountedRef.current || intentionalStopRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      recorderRef.current = new MediaRecorder(stream)
      chunksRef.current = []
      recorderRef.current.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data)
      }
      recorderRef.current.onstop = () => {
        const chunks = chunksRef.current
        const mimeType = recorderRef.current?.mimeType || chunks[0]?.type || 'audio/webm'
        chunksRef.current = []
        recorderRef.current = null
        releaseStream()
        if (!cancelledRecordingRef.current && chunks.length) {
          audioHandlerRef.current?.(new Blob(chunks, { type: mimeType }))
        }
      }
      recorderRef.current.start(1000)

      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (Recognition) {
        const recognition = new Recognition()
        recognition.lang = 'en-US'
        recognition.continuous = true
        recognition.interimResults = true
        recognition.maxAlternatives = 1
        recognition.onresult = (event) => {
          const text = Array.from(event.results).map((result) => result?.[0]?.transcript ?? '').join(' ').trim()
          if (text) transcriptHandlerRef.current?.(text)
        }
        recognition.onerror = (event) => {
          if (!intentionalStopRef.current && event.error === 'not-allowed') {
            setError('Microphone access was denied. Enable it in this site\'s browser settings, then try again.')
            stop({ cancelled: true })
          }
        }
        recognition.onend = () => {
          if (!intentionalStopRef.current && recorderRef.current?.state === 'recording') {
            try {
              recognition.start()
            } catch {
              setError('Live transcription stopped. Your recording will still be transcribed after you stop.')
            }
          }
        }
        recognitionRef.current = recognition
        recognition.start()
      }

      setElapsedSeconds(0)
      setStatus('recording')
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((current) => {
          const next = current + 1
          if (next >= maxSeconds) window.setTimeout(() => stop(), 0)
          return next
        })
      }, 1000)
    } catch (startError) {
      releaseStream()
      setStatus('idle')
      if (['NotAllowedError', 'SecurityError'].includes(startError?.name)) setError('Microphone access was denied. Enable it in this site\'s browser settings, then try again.')
      else if (startError?.name === 'NotFoundError') setError('No microphone was found. Connect one or type your entry instead.')
      else if (startError?.name === 'NotReadableError') setError('The microphone is busy in another app. Close it there, then try again.')
      else setError('The microphone could not start. Check browser permissions or type your entry instead.')
    }
  }

  useEffect(() => () => {
    mountedRef.current = false
    intentionalStopRef.current = true
    window.clearInterval(timerRef.current)
    recognitionRef.current?.abort?.()
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    releaseStream()
  }, [])

  return { elapsedSeconds, error, isRecording: status === 'recording', start, status, stop }
}

export function formatRecordingTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
