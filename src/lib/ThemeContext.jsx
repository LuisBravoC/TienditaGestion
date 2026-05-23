import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

const THEME_STORAGE_KEY = 'RifaGestion-theme'
const VALID_THEMES = ['dark', 'light', 'google']
const DEFAULT_THEME = 'dark'

/**
 * Provee { theme, setTheme } a toda la app.
 * - theme: 'dark' | 'light' | 'google'
 * - setTheme: función para cambiar el tema
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Cargar tema desde localStorage al iniciar
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    const validTheme = VALID_THEMES.includes(savedTheme) ? savedTheme : DEFAULT_THEME
    setThemeState(validTheme)
    applyTheme(validTheme)
    setIsLoading(false)
  }, [])

  const setTheme = (newTheme) => {
    if (!VALID_THEMES.includes(newTheme)) {
      console.warn(`Tema no válido: ${newTheme}`)
      return
    }
    setThemeState(newTheme)
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    applyTheme(newTheme)
  }

  const applyTheme = (themeName) => {
    // Remover todas las clases de tema
    document.documentElement.classList.remove(...VALID_THEMES)
    // Agregar la clase del tema actual
    document.documentElement.classList.add(themeName)
  }

  if (isLoading) {
    return null
  }

  const value = { theme, setTheme }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  return ctx
}
