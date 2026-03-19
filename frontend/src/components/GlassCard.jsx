export default function GlassCard({ children, className = '', hover = true, ...props }) {
  return (
    <div
      className={`
        backdrop-blur-md bg-white/8 border border-white/15 rounded-2xl p-6
        shadow-lg shadow-black/10
        ${hover ? 'transition-all duration-300 hover:bg-white/12 hover:border-white/25 hover:shadow-xl hover:shadow-black/15' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}
