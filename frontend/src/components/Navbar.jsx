import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/analyze-epoch', label: 'Epochs' },
  { to: '/trust-graph', label: 'Trust Graph' },
  { to: '/simulate', label: 'Simulate' },
  { to: '/analyze-project', label: 'Projects' },
  { to: '/about', label: 'About' },
]

export default function Navbar() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="backdrop-blur-md bg-white/5 border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <span className="text-2xl font-bold text-white tracking-tight">Tessera</span>
            <span className="text-xs text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded-full font-medium">
              v1.0
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-2 rounded-lg text-sm font-medium no-underline transition-all duration-200 ${
                  location.pathname === link.to
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/8'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://github.com/yeheskieltame/Tessera"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-3 text-white/70 hover:text-white transition-colors no-underline text-sm"
            >
              GitHub
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden backdrop-blur-md bg-white/5 border-t border-white/10 px-4 py-3 space-y-1">
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-2 rounded-lg text-sm font-medium no-underline ${
                location.pathname === link.to
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
