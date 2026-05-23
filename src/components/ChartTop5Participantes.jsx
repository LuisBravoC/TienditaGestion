import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['var(--accent-light)', '#a78bfa', '#38bdf8', '#34d399', '#fb923c']

export default function ChartTop5Participantes({ data, loading, error, height = 300 }) {
  if (loading) return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Cargando gráfica...</div>
  if (error)   return <div style={{ color: 'var(--deuda)', padding: '1rem' }}>Error al cargar datos</div>
  if (!data || data.length === 0) return <div style={{ color: 'var(--text-muted)', padding: '1rem' }}>Sin datos</div>

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" horizontal={false} />
          <XAxis type="number" stroke="var(--text-muted)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis dataKey="name" type="category" stroke="var(--text-muted)" tick={{ fontSize: 11 }} width={110} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'rgba(15,23,42,.92)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.08)', borderRadius: '.5rem', fontSize: '.82rem', padding: '.5rem .75rem' }}
            labelStyle={{ color: '#94a3b8', marginBottom: '.2rem', fontSize: '.75rem' }}
            itemStyle={{ color: '#f1f5f9' }}
            formatter={(value) => [`${value} boletos`, 'Total']}
            cursor={{ fill: 'transparent' }}
          />
          <Bar dataKey="value" name="Boletos" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
