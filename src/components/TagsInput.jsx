import { useState } from 'react'
import { X } from 'lucide-react'

/**
 * TagsInput — editor de arreglo de texto (ej. que_incluye de paquetes).
 * Presiona Enter o coma para agregar un tag.
 */
export default function TagsInput({ value = [], onChange }) {
  const [input, setInput] = useState('')

  function addTag(raw) {
    const tag = raw.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setInput('')
  }

  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && input === '' && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  function removeTag(t) { onChange(value.filter(v => v !== t)) }

  return (
    <div>
      <div className="tags-wrap" onClick={() => document.getElementById('tags-inp')?.focus()}>
        {value.map(t => (
          <span key={t} className="tag">
            {t}
            <button type="button" className="tag-del" onClick={() => removeTag(t)}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          id="tags-inp"
          className="tags-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => input.trim() && addTag(input)}
          placeholder={value.length === 0 ? 'Escribe y presiona Enter…' : ''}
        />
      </div>
      <p className="tags-hint">Enter o coma para agregar · Backspace para borrar el último</p>
    </div>
  )
}
