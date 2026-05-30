import { Link, useNavigate } from 'react-router-dom'
import {
  Search, X, Menu,
} from 'lucide-react'
import HappyCatIcon from '../assets/HappyCatIcon.jsx'
import { useState, useRef, useEffect, useCallback } from 'react'
import { buscarParticipantes } from '../lib/rifas-queries.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { useSidebar } from '../lib/SidebarContext.jsx'

export default function Topbar() {
  const { session } = useAuth()
  const { openMobile } = useSidebar()
  const navigate = useNavigate()

  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [open,    setOpen]    = useState(false)
  const wrapRef  = useRef(null)
  const timerRef = useRef(null)

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

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <header className="topbar">
      {/* Hamburger — solo visible en móvil */}
      <button className="topbar-hamburger" onClick={openMobile} aria-label="Abrir menú">
        <Menu size={22} />
      </button>

      <Link to="/" className="topbar-brand">
        <HappyCatIcon size={35} />
        <span className="nav-label">HappyTiendita</span>
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
    </header>
  )
}

