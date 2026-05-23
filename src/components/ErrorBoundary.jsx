import { Component } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/**
 * Captura errores en el árbol de componentes hijo y muestra una pantalla
 * amigable en lugar de desmontar toda la app.
 *
 * Uso:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message ?? String(error) }
  }

  componentDidCatch(error, info) {
    // En producción aquí se podría enviar a Sentry / LogRocket / etc.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, message: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}>
        <AlertTriangle size={48} style={{ color: 'var(--deuda)', opacity: .85 }} />
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
          Algo salió mal
        </h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '28rem', margin: 0, fontSize: '.95rem' }}>
          Ocurrió un error inesperado. Puedes intentar reiniciar la vista o recargar la página.
        </p>
        {this.state.message && (
          <code style={{
            display: 'block',
            background: 'var(--deuda-bg)',
            border: '1px solid rgba(239,68,68,.25)',
            borderRadius: '.5rem',
            padding: '.6rem 1rem',
            fontSize: '.78rem',
            color: 'var(--deuda)',
            maxWidth: '32rem',
            wordBreak: 'break-word',
          }}>
            {this.state.message}
          </code>
        )}
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            className="btn btn-outline"
            onClick={this.handleReset}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}
          >
            <RotateCcw size={14} /> Reintentar
          </button>
          <a
            className="btn btn-primary"
            href={import.meta.env.BASE_URL}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem', textDecoration: 'none' }}
          >
            Ir al inicio
          </a>
        </div>
      </div>
    )
  }
}
