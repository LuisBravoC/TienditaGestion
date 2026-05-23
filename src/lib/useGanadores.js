import { useState, useEffect, useRef } from 'react'
import * as q from './rifas-queries.js'

/**
 * Encapsula el estado y la lógica del sorteo de ganadores.
 *
 * @param {string} rifaId
 * @param {object|null} rifaData  – rifaQ.data (null mientras carga)
 * @param {function} showErr      – función de error del componente padre
 */
export function useGanadores(rifaId, rifaData, showErr) {
  const [ganadores,     setGanadores]     = useState([])
  const [tombola,       setTombola]       = useState(false)
  const [ultimoGanador, setUltimoGanador] = useState(null)
  const ganadoresSeedRef = useRef(null)

  // Cargar ganadores guardados cuando llega la data de la rifa
  useEffect(() => {
    if (rifaData && ganadoresSeedRef.current !== rifaId) {
      ganadoresSeedRef.current = rifaId
      setGanadores(rifaData.ganadores ?? [])
    }
  }, [rifaId, rifaData])

  async function handleElegirGanador() {
    try {
      const excluir = ganadores.map(g => g.id)
      const winner  = await q.elegirGanador(rifaId, excluir)
      if (!winner) { showErr('No hay boletos pagados disponibles para el sorteo.'); return }
      setUltimoGanador(winner)
      setTombola(true)
      // Guardar en BD pero NO añadir a la lista hasta que el usuario cierre la ruleta
      await q.saveGanadores(rifaId, [...ganadores, winner])
    } catch (e) { showErr(e) }
  }

  function handleTombolaClose() {
    // Ahora sí añadir el ganador a la lista visible
    if (ultimoGanador) setGanadores(prev => [...prev, ultimoGanador])
    setTombola(false)
  }

  async function handleRemoveGanador(ganadorId) {
    const newGanadores = ganadores.filter(g => g.id !== ganadorId)
    setGanadores(newGanadores)
    try { await q.saveGanadores(rifaId, newGanadores) } catch (e) { showErr(e) }
  }

  async function handleResetSorteo() {
    setGanadores([])
    try { await q.saveGanadores(rifaId, []) } catch (e) { showErr(e) }
  }

  return {
    ganadores,
    tombola,
    handleTombolaClose,
    ultimoGanador,
    handleElegirGanador,
    handleRemoveGanador,
    handleResetSorteo,
  }
}
