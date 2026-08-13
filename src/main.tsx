import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <App />
    </TooltipProvider>
  </StrictMode>,
)
