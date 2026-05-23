import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Store, Search, X, Settings, LogOut, Menu,
  Users, CreditCard, AlertCircle, ClipboardList, Ticket,
  Package, ShoppingCart, ShoppingBag, UserCheck, LayoutDashboard, ChevronDown, Clock,
} from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { buscarParticipantes } from '../lib/rifas-queries.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { signOut } from '../lib/auth.js'

const RIFAS_PATHS = ['/rifas', '/participantes', '/historial', '/bitacora', '/pendientes']

export default function Topbar() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isRifasActive = RIFAS_PATHS.some(p => location.pathname.startsWith(p))

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState([])
  const [open,      setOpen]      = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [rifasOpen, setRifasOpen] = useState(false)
  const wrapRef   = useRef(null)
  const menuRef   = useRef(null)
  const rifasRef  = useRef(null)
  const timerRef  = useRef(null)

  const doSearch = useCallback(async (v) => {
    if (!v || v.trim().length < 2) { setResults([]); setOpen(false); return }
    try {
      const r = await buscarParticipantes(v)
      setResults(r)
      setOpen(r.length > 0)
    } catch (e) {
      console.error(e)
    }
  }, [])

  function handleChange(e) {
    const v = e.target.value
    setQuery(v)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(v), 300)
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setOpen(false)
    clearTimeout(timerRef.current)
  }

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current  && !wrapRef.current.contains(e.target))  setOpen(false)
      if (menuRef.current  && !menuRef.current.contains(e.target))  setMenuOpen(false)
      if (rifasRef.current && !rifasRef.current.contains(e.target)) setRifasOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const navCls = ({ isActive }) => 'topbar-nav-link' + (isActive ? ' active' : '')

  return (
    <header className="topbar">
      <Link to="/" className="topbar-brand">
        <Store size={22} />
        <span className="nav-label">Tiendita</span>
      </Link>

      <div className="topbar-search" ref={wrapRef}>
        <Search size={15} className="search-icon" />
        <input
          type="text"
          placeholder="Buscar cliente…"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {query && (
          <button
            onClick={handleClear}
            style={{ position: 'absolute', right: '.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <X size={14} />
          </button>
        )}
        {open && (
          <div className="search-dropdown">
            {results.map(r => (
              <Link
                key={r.id}
                to={`/participantes/${r.id}`}
                className="search-item"
                onClick={handleClear}
              >
                <span className="search-item-name">{r.nombre_completo}</span>
                {r.telefono_whatsapp && (
                  <span className="search-item-meta">{r.telefono_whatsapp}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="topbar-nav-area" ref={menuRef}>
        <nav className="topbar-nav">
          {/* ── Tiendita ── */}
          <NavLink to="/" end className={navCls}>
            <LayoutDashboard size={15} /> <span className="nav-label">Inicio</span>
          </NavLink>
          <NavLink to="/productos" className={navCls}>
            <Package size={15} /> <span className="nav-label">Productos</span>
          </NavLink>
          <NavLink to="/pedidos" className={navCls}>
            <ShoppingCart size={15} /> <span className="nav-label">Pedidos</span>
          </NavLink>
          <NavLink to="/ventas" className={navCls}>
            <ShoppingBag size={15} /> <span className="nav-label">Ventas</span>
          </NavLink>
          <NavLink to="/apartados" className={navCls}>
            <Clock size={15} /> <span className="nav-label">Apartados</span>
          </NavLink>
          <NavLink to="/clientes" className={navCls}>
            <UserCheck size={15} /> <span className="nav-label">Clientes</span>
          </NavLink>

          {/* ── Rifas — dropdown ── */}
          <div style={{ position: 'relative' }} ref={rifasRef}>
            <button
              className={'topbar-nav-link' + (isRifasActive ? ' active' : '')}
              onClick={() => setRifasOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', gap: '.3rem' }}
            >
              <Ticket size={15} /> <span className="nav-label">Rifas</span> <ChevronDown size={12} />
            </button>
            {rifasOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '.35rem',
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', boxShadow: '0 4px 20px rgba(0,0,0,.2)',
                minWidth: '170px', zIndex: 300, overflow: 'hidden',
              }}>
                {[
                  { to: '/rifas/dashboard', icon: <LayoutDashboard size={14} />, label: 'Dashboard' },
                  { to: '/rifas',           icon: <Ticket size={14} />,          label: 'Campañas' },
                  { to: '/participantes',   icon: <Users size={14} />,           label: 'Participantes' },
                  { to: '/historial',       icon: <CreditCard size={14} />,      label: 'Historial' },
                  { to: '/bitacora',        icon: <ClipboardList size={14} />,   label: 'Bitácora' },
                  { to: '/pendientes',      icon: <AlertCircle size={14} />,     label: 'Pendientes' },
                ].map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/rifas/dashboard'}
                    className={({ isActive }) => 'search-item' + (isActive ? ' active' : '')}
                    onClick={() => setRifasOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.55rem .85rem', fontSize: '.875rem' }}
                  >
                    {item.icon} {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <NavLink to="/opciones" className={navCls}>
            <Settings size={15} /> <span className="nav-label">Opciones</span>
          </NavLink>
          {session && (
            <button className="topbar-nav-link btn-logout" onClick={handleLogout} title="Cerrar sesión">
              <LogOut size={15} /> <span className="nav-label">Salir</span>
            </button>
          )}
        </nav>

        <button
          className="topbar-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
        >
          <Menu size={22} />
        </button>

        {menuOpen && (
          <div className="mobile-nav">
            {/* Tiendita */}
            <div style={{ padding: '.4rem .75rem .15rem', fontSize: '.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.09em', textTransform: 'uppercase' }}>
              Tiendita
            </div>
            <NavLink to="/" end className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' active' : '')} onClick={() => setMenuOpen(false)}>
              <LayoutDashboard size={16} /> Inicio
            </NavLink>
            <NavLink to="/productos" className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' active' : '')} onClick={() => setMenuOpen(false)}>
              <Package size={16} /> Productos
            </NavLink>
            <NavLink to="/pedidos" className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' active' : '')} onClick={() => setMenuOpen(false)}>
              <ShoppingCart size={16} /> Pedidos
            </NavLink>
            <NavLink to="/ventas" className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' active' : '')} onClick={() => setMenuOpen(false)}>
              <ShoppingBag size={16} /> Ventas
            </NavLink>
            <NavLink to="/clientes" className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' active' : '')} onClick={() => setMenuOpen(false)}>
              <UserCheck size={16} /> Clientes
            </NavLink>

            {/* Rifas */}
            <div style={{ padding: '.5rem .75rem .15rem', fontSize: '.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.09em', textTransform: 'uppercase', borderTop: '1px solid var(--border)', marginTop: '.3rem' }}>
              Rifas
            </div>
            <NavLink to="/rifas/dashboard" className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' active' : '')} onClick={() => setMenuOpen(false)}>
              <LayoutDashboard size={16} /> Dashboard
            </NavLink>
            <NavLink to="/rifas" className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' active' : '')} onClick={() => setMenuOpen(false)}>
              <Ticket size={16} /> Campañas
            </NavLink>
            <NavLink to="/participantes" className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' active' : '')} onClick={() => setMenuOpen(false)}>
              <Users size={16} /> Participantes
            </NavLink>
            <NavLink to="/historial" className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' active' : '')} onClick={() => setMenuOpen(false)}>
              <CreditCard size={16} /> Historial
            </NavLink>
            <NavLink to="/bitacora" className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' active' : '')} onClick={() => setMenuOpen(false)}>
              <ClipboardList size={16} /> Bitácora
            </NavLink>
            <NavLink to="/pendientes" className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' active' : '')} onClick={() => setMenuOpen(false)}>
              <AlertCircle size={16} /> Pendientes
            </NavLink>

            <NavLink to="/opciones" className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' active' : '')} onClick={() => setMenuOpen(false)}>
              <Settings size={16} /> Opciones
            </NavLink>
            {session && (
              <button className="mobile-nav-link mobile-nav-logout" onClick={() => { setMenuOpen(false); handleLogout() }}>
                <LogOut size={16} /> Salir
              </button>
            )}
          </div>
        )}
      </div>

    </header>
  )
}
