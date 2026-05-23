import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react'
import logo from '../assets/logo.svg'
import { signIn } from '../lib/auth.js'

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const destino   = location.state?.from?.pathname ?? '/'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) { setError('Completa todos los campos.'); return }
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      navigate(destino, { replace: true })
    } catch (err) {
      setError('Correo o contraseña incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">

        {/* Logo */}
        <div className="login-logo">
          <img src={logo} alt="Logo" className="login-logo-img" />
        </div>
        <h1 className="login-title">RifaGestión</h1>
        <p className="login-sub">Inicio de sesión</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>

          <div className="field">
            <label>Correo electrónico</label>
            <div className="login-input-wrap">
              <Mail size={15} className="login-input-icon" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                autoFocus
                disabled={loading}
              />
            </div>
          </div>

          <div className="field">
            <label>Contraseña</label>
            <div className="login-input-wrap">
              <Lock size={15} className="login-input-icon" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="login-pwd-toggle"
                onClick={() => setShowPwd(v => !v)}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
            {loading
              ? <span className="login-spinner" />
              : <><LogIn size={16} /> Entrar</>
            }
          </button>

        </form>
      </div>
      <footer className="login-footer">Sitio diseñado por Luis Bravo</footer>
    </div>
  )
}
