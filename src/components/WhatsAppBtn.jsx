import { MessageCircle } from 'lucide-react'
import { fmt } from '../lib/formatters.js'

/**
 * Botón de acceso rápido a WhatsApp con mensaje predefinido.
 * @param {string} nombre    - Nombre del participante
 * @param {string} telefono  - Teléfono (10 dígitos sin código de país)
 * @param {number} saldo     - Saldo pendiente a recordar
 */
export default function WhatsAppBtn({ nombre, telefono, saldo }) {
  const phone = '52' + (telefono ?? '').replace(/\D/g, '')
  if (phone.length < 12) return null
  const msg = encodeURIComponent(
    `Hola ${nombre}, te recordamos que tu saldo pendiente para la rifa es de *${fmt(saldo)}*. ¡Gracias por participar!`
  )
  return (
    <a
      href={`https://wa.me/${phone}?text=${msg}`}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-wa"
      title={`WhatsApp a ${nombre}`}
    >
      <MessageCircle size={15} />
    </a>
  )
}
