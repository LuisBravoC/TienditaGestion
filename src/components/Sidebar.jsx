import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ShoppingCart, ShoppingBag,
  Clock, UserCheck, Ticket, Users, CreditCard,
  ClipboardList, AlertCircle, Settings, LogOut,
  ChevronLeft, Store,
} from 'lucide-react'
import { useSidebar } from '../lib/SidebarContext.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { signOut } from '../lib/auth.js'

const TIENDITA = [
  { to: '/',          end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/productos',            icon: Package,         label: 'Productos'  },
  { to: '/pedidos',              icon: ShoppingCart,    label: 'Mis pedidos'    },
  { to: '/ventas',               icon: ShoppingBag,     label: 'Ventas'     },
  { to: '/apartados',            icon: Clock,           label: 'Apartados'  },
  { to: '/clientes',             icon: UserCheck,       label: 'Clientes'   },
]

const RIFAS = [
  { to: '/rifas/dashboard', end: true, icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/rifas',                      icon: Ticket,          label: 'Campañas'     },
  { to: '/participantes',              icon: Users,           label: 'Participantes'},
  { to: '/historial',                  icon: CreditCard,      label: 'Historial'    },
  { to: '/bitacora',                   icon: ClipboardList,   label: 'Bitácora'     },
  { to: '/pendientes',                 icon: AlertCircle,     label: 'Pendientes'   },
]

export default function Sidebar() {
  const { collapsed, toggle, mobileOpen, closeMobile } = useSidebar()
  const { session } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    closeMobile()
    await signOut()
    navigate('/login', { replace: true })
  }

  function navCls({ isActive }) {
    return 'sb-link' + (isActive ? ' active' : '')
  }

  function renderContent(isMobile = false) {
    const isCollapsed = !isMobile && collapsed
    return (
      <aside className={`sidebar${isCollapsed ? ' collapsed' : ''}`}>
        {/* Header: logo + toggle (solo en desktop) */}
        <div className="sb-header">
          <div className="sb-brand">
            <Store size={22} />
            <span className="sb-label">Opciones</span>
          </div>
          {!isMobile && (
            <button className="sb-toggle" onClick={toggle} title={isCollapsed ? 'Expandir' : 'Colapsar'}>
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Sección Tiendita */}
        <div className="sb-section">
          <span className="sb-section-label">Tiendita</span>
        </div>
        {TIENDITA.map(({ to, end, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={end} className={navCls} onClick={closeMobile} title={isCollapsed ? label : undefined}>
            <Icon size={17} className="sb-icon" />
            <span className="sb-label">{label}</span>
          </NavLink>
        ))}

        {/* Sección Rifas */}
        <div className="sb-section">
          <span className="sb-section-label">Rifas</span>
        </div>
        {RIFAS.map(({ to, end, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={end} className={navCls} onClick={closeMobile} title={isCollapsed ? label : undefined}>
            <Icon size={17} className="sb-icon" />
            <span className="sb-label">{label}</span>
          </NavLink>
        ))}

        {/* Footer */}
      <div className="sb-footer">
        <NavLink to="/opciones" className={navCls} onClick={closeMobile} title={isCollapsed ? 'Opciones' : undefined}>
          <Settings size={17} className="sb-icon" />
          <span className="sb-label">Opciones</span>
        </NavLink>
        {session && (
          <button className="sb-link sb-logout" onClick={handleLogout} title={isCollapsed ? 'Cerrar sesión' : undefined}>
            <LogOut size={17} className="sb-icon" />
            <span className="sb-label">Salir</span>
          </button>
        )}
      </div>
    </aside>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <div className="sidebar-desktop">
        {renderContent(false)}
      </div>

      {/* Mobile overlay + drawer */}
      {mobileOpen && (
        <>
          <div className="sidebar-overlay" onClick={closeMobile} />
          <div className="sidebar-mobile">
            {renderContent(true)}
          </div>
        </>
      )}
    </>
  )
}
