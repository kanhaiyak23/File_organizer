import { NavLink } from 'react-router-dom'
import { Home, FolderOpen, BarChart3 } from 'lucide-react'

export default function Navbar() {
    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <div className="navbar-logo">
                    <span className="logo-icon">◈</span>
                    <span className="logo-text">FileOS</span>
                </div>
            </div>
            <div className="navbar-links">
                <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Home size={15} />
                    <span>Home</span>
                </NavLink>
                <NavLink to="/explorer" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <FolderOpen size={15} />
                    <span>Explorer</span>
                </NavLink>
                <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <BarChart3 size={15} />
                    <span>Dashboard</span>
                </NavLink>
            </div>
        </nav>
    )
}
