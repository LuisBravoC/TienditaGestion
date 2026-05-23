import { useState, useEffect, useRef, useMemo } from 'react'
import { fmtNum } from '../lib/formatters.js'

export default function TombolaModal({ ganador, lugar, total, onClose }) {
  const winnerNum = ganador.numero_asignado
  const [displayNum, setDisplayNum] = useState(() => Math.floor(Math.random() * total) + 1)
  const [phase, setPhase] = useState('fast') // 'fast' | 'slow' | 'stop' | 'reveal'
  const onCloseRef = useRef(onClose)

  const floaters = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id:    i,
      num:   Math.floor(Math.random() * total) + 1,
      delay: +(i * 0.35).toFixed(2),
      dur:   +(1.3 + Math.random() * 0.9).toFixed(2),
      left:  +(5 + Math.random() * 90).toFixed(1),
    })), [total])

  useEffect(() => {
    let fastTick, slowTick, t1, t2, t3

    fastTick = setInterval(() =>
      setDisplayNum(Math.floor(Math.random() * total) + 1), 60)

    t1 = setTimeout(() => {
      clearInterval(fastTick)
      setPhase('slow')
      let slowCount = 0
      const SLOW_TICKS = 5
      slowTick = setInterval(() => {
        slowCount++
        setDisplayNum(slowCount >= SLOW_TICKS - 1
          ? winnerNum
          : Math.floor(Math.random() * total) + 1)
      }, 240)
      t2 = setTimeout(() => {
        clearInterval(slowTick)
        setDisplayNum(winnerNum)
        setPhase('stop')
        t3 = setTimeout(() => setPhase('reveal'), 900)
      }, 1200)
    }, 2600)

    return () => {
      clearInterval(fastTick)
      clearInterval(slowTick)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [total, winnerNum])

  const lugarLabel = ['', '1er', '2do', '3er'][lugar] ?? `${lugar}to`
  const isReveal = phase === 'reveal'

  return (
    <>
      <div className="modal-overlay" onClick={isReveal ? onCloseRef.current : undefined} />
      <div className={`tombola-stage${isReveal ? ' tombola-stage--reveal' : ''}`}>
        {!isReveal ? (
          <>
            <p className="tombola-title">🎟️ ¡Sorteando!</p>
            <div className={`tombola-drum tombola-drum--${phase}`}>
              {[0, 30, 60, 90, 120, 150].map(deg => (
                <div key={deg} className="tombola-bar" style={{ transform: `rotate(${deg}deg)` }} />
              ))}
              <div className={`tombola-numwrap tombola-numwrap--${phase}`}>
                <div className="tombola-num">{fmtNum(displayNum, total)}</div>
              </div>
            </div>
            <p className="tombola-caption">
              {phase === 'stop' ? '¡Tenemos ganador! 🎊' : 'Seleccionando ganador...'}
            </p>
            <div className="tombola-floaters" aria-hidden="true">
              {floaters.map(f => (
                <span
                  key={f.id}
                  className="tombola-ticket"
                  style={{ left: `${f.left}%`, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }}
                >
                  #{fmtNum(f.num, total)}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="tombola-winner">
            <div className="tombola-winner-emoji">🎊</div>
            <div className="tombola-winner-lugar">{lugarLabel} lugar</div>
            <div className="tombola-winner-num">#{fmtNum(winnerNum, total)}</div>
            <div className="tombola-winner-name">
              {ganador.participantes?.nombre_completo ?? ganador.nombre_participante ?? 'Desconocido'}
            </div>
            {ganador.participantes?.telefono_whatsapp && (
              <div className="tombola-winner-tel">{ganador.participantes.telefono_whatsapp}</div>
            )}
            <button className="btn btn-primary tombola-winner-btn" onClick={onCloseRef.current}>
              Continuar
            </button>
          </div>
        )}
      </div>
    </>
  )
}
