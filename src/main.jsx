import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css' // Global Styles (Tailwind)
import './styles/j.css' // Board J screens and dark theme
import './firebase' // Initialize Firebase
import App from './App.jsx'
import { Capacitor } from '@capacitor/core'

// Inside the Android app: behave like an app, not a web page (see j.css .in-app).
if (Capacitor.isNativePlatform()) document.documentElement.classList.add('in-app')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
