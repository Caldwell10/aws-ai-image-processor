import React from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import App from './App.jsx'


import './index.css';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#111418', paper: '#171A21' },
    primary: { main: '#4F8EF7' },
    success: { main: '#34d399' },
    warning: { main: '#f59e0b' },
    error: { main: '#ef4444' },
    divider: 'rgba(255,255,255,0.08)'
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: `'Inter', system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial`,
    h4: { fontWeight: 700 },
    h6: { fontWeight: 600 }
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
