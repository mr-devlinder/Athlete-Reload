import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LazyMotion } from 'motion/react'
import '@fontsource-variable/instrument-sans'
import './index.css'
import App from './App.jsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.jsx'

const loadMotionFeatures = () => import('./lib/motionFeatures.js').then((module) => module.default)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LazyMotion features={loadMotionFeatures} strict>
      <AppErrorBoundary feature="app-shell"><App /></AppErrorBoundary>
    </LazyMotion>
  </StrictMode>,
)
