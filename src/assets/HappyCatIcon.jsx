export default function HappyCatIcon({ size = 24, className, style }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {/* Orejas puntiagudas */}
      <path d="M7.5 9L6 4L4 9" />
      <path d="M16.5 9L18 4L20 9" />

      {/* Caja */}
      <rect x="4" y="9" width="16" height="11" rx="2" />

      {/* Tapa */}
      <path d="M4 12H20" />

      {/* Ojos */}
      <path d="M9 15.5v.6" />
      <path d="M15 15.5v.6" />

      {/* Nariz */}
      <path d="M11.25 17.25h1.5L12 18.25l-.75-1Z" />

      {/* Bigotes */}
      <path d="M4.5 16.5h3" />
      <path d="M16.5 16.5h3" />
    </svg>
  )
}
