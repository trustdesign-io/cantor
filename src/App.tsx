import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Home } from './routes/Home'
import { About } from './routes/About'
import { cn } from './lib/utils'

function Nav() {
  return (
    <nav className="border-b px-4 py-3 flex items-center gap-6">
      <span className="font-semibold text-sm">starter-local</span>
      <div className="flex gap-4">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn('text-sm', isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground')
          }
        >
          Home
        </NavLink>
        <NavLink
          to="/about"
          className={({ isActive }) =>
            cn('text-sm', isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground')
          }
        >
          About
        </NavLink>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  )
}
