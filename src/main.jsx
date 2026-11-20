import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css' // Global Styles (Tailwind)
import './styles/j.css' // Board J screens and dark theme
import './firebase' // Initialize Firebase
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
