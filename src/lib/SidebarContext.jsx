import { createContext, useContext, useState, useEffect } from 'react'

const SidebarContext = createContext(null)

export function SidebarProvider({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true' }
    catch { return false }
  })

  // Mobile: sidebar oculto por defecto
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', String(collapsed)) }
    catch {}
  }, [collapsed])

  function toggle()       { setCollapsed(c => !c) }
  function openMobile()   { setMobileOpen(true) }
  function closeMobile()  { setMobileOpen(false) }

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, mobileOpen, openMobile, closeMobile }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
