import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './lib/toast.jsx'
import { AuthProvider, useAuth } from './lib/AuthContext.jsx'
import { SidebarProvider } from './lib/SidebarContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Topbar from './components/Topbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Login from './pages/Login.jsx'
import MisBoletos from './pages/MisBoletos.jsx'
// Tiendita
import TienditaDashboard from './pages/tiendita/TienditaDashboard.jsx'
import ProductosList from './pages/tiendita/ProductosList.jsx'
import ProductoDetail from './pages/tiendita/ProductoDetail.jsx'
import PedidosList from './pages/tiendita/PedidosList.jsx'
import VentasList    from './pages/tiendita/VentasList.jsx'
import ClientesList  from './pages/tiendita/ClientesList.jsx'
import ApartadosList from './pages/tiendita/ApartadosList.jsx'
// Rifas
import Dashboard from './pages/Dashboard.jsx'
import Opciones from './pages/Opciones.jsx'
import Campanas from './pages/Campanas.jsx'
import SorteosList from './pages/SorteosList.jsx'
import BoletoGrid from './pages/BoletoGrid.jsx'
import ParticipantesList from './pages/ParticipantesList.jsx'
import ParticipanteDetail from './pages/ParticipanteDetail.jsx'
import HistorialPagos from './pages/HistorialPagos.jsx'
import Pendientes from './pages/Pendientes.jsx'
import Bitacora from './pages/Bitacora.jsx'

function AppShell() {
  const { session } = useAuth()
  return (
    <div className="app-shell">
      {session && <Topbar />}
      <div className="app-body">
        {session && <Sidebar />}
        <main className="app-main">
          <Routes>
          {/* ── Tiendita (módulo principal) ── */}
          <Route path="/"          element={<ProtectedRoute><TienditaDashboard /></ProtectedRoute>} />
          <Route path="/productos" element={<ProtectedRoute><ProductosList /></ProtectedRoute>} />
          <Route path="/productos/:productoId" element={<ProtectedRoute><ProductoDetail /></ProtectedRoute>} />
          <Route path="/pedidos"   element={<ProtectedRoute><PedidosList /></ProtectedRoute>} />
          <Route path="/ventas"    element={<ProtectedRoute><VentasList /></ProtectedRoute>} />
          <Route path="/clientes"  element={<ProtectedRoute><ClientesList /></ProtectedRoute>} />
          <Route path="/apartados" element={<ProtectedRoute><ApartadosList /></ProtectedRoute>} />

          {/* ── Rifas (módulo secundario) ── */}
          <Route path="/rifas/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/rifas"           element={<ProtectedRoute><Campanas /></ProtectedRoute>} />
          <Route path="/rifas/:campanaId" element={<ProtectedRoute><SorteosList /></ProtectedRoute>} />
          <Route path="/rifas/:campanaId/sorteos/:rifaId" element={<ProtectedRoute><BoletoGrid /></ProtectedRoute>} />

          {/* ── Compartidas ── */}
          <Route path="/participantes"       element={<ProtectedRoute><ParticipantesList /></ProtectedRoute>} />
          <Route path="/participantes/:partId" element={<ProtectedRoute><ParticipanteDetail /></ProtectedRoute>} />
          <Route path="/historial"  element={<ProtectedRoute><HistorialPagos /></ProtectedRoute>} />
          <Route path="/pendientes" element={<ProtectedRoute><Pendientes /></ProtectedRoute>} />
          <Route path="/bitacora"   element={<ProtectedRoute><Bitacora /></ProtectedRoute>} />
          <Route path="/opciones"   element={<ProtectedRoute><Opciones /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
    <SidebarProvider>
    <ToastProvider>
      <Routes>
        {/* Login fuera del app-shell — página completamente independiente */}
        <Route path="/login" element={<Login />} />
        {/* Perfil público del comprador — no requiere autenticación */}
        <Route path="/mis-boletos" element={<MisBoletos />} />
        {/* Todo lo demás dentro del app-shell */}
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </ToastProvider>
    </SidebarProvider>
    </AuthProvider>
    </ErrorBoundary>
  )
}
