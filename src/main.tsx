import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@mdxeditor/editor/style.css'
import './index.css'
import App from './App'

registerSW({ immediate: true })

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root was not found.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
