import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, FolderOpen, BarChart3, Bell, Trash2 } from 'lucide-react'
import { useActivity } from './ActivityContext.jsx'
import { recycleBinListeners } from './RecycleBin.jsx'

export default function Navbar({ onOpenTrash }) {
    const { unreadCount, openFeed } = useActivity()
    const [trashCount, setTrashCount] = useState(0)

    // Subscribe to live trash count updates from RecycleBin
    useEffect(() => {
        const listener = (n) => setTrashCount(n)
        recycleBinListeners.add(listener)
        return () => recycleBinListeners.delete(listener)
    }, [])

    return (
        <nav className="lp-nav">
            <div className="lp-nav-brand">
                <div className="lp-nav-logo-icon">◈</div>
                <span className="lp-nav-logo-text">FileOS</span>
            </div>
            <div className="lp-nav-links">
                <NavLink to="/" end className={({ isActive }) => `lp-nav-link ${isActive ? 'lp-nav-active' : ''}`}>
                    <Home size={15} />
                    <span>Home</span>
                </NavLink>
                <NavLink to="/explorer" className={({ isActive }) => `lp-nav-link ${isActive ? 'lp-nav-active' : ''}`}>
                    <FolderOpen size={15} />
                    <span>Explorer</span>
                </NavLink>
                <NavLink to="/dashboard" className={({ isActive }) => `lp-nav-link ${isActive ? 'lp-nav-active' : ''}`}>
                    <BarChart3 size={15} />
                    <span>Dashboard</span>
                </NavLink>

                {/* Recycle Bin button */}
                <button
                    className="nav-bell-btn nav-trash-btn"
                    onClick={onOpenTrash}
                    title="Recycle Bin"
                    aria-label="Open Recycle Bin"
                >
                    <Trash2 size={15} />
                    {trashCount > 0 && (
                        <span className="nav-bell-badge nav-trash-badge" key={trashCount}>
                            {trashCount > 99 ? '99+' : trashCount}
                        </span>
                    )}
                </button>

                {/* Activity feed bell */}
                <button
                    className="nav-bell-btn"
                    onClick={openFeed}
                    title="Activity Feed"
                    aria-label="Open Activity Feed"
                >
                    <Bell size={15} />
                    {unreadCount > 0 && (
                        <span className="nav-bell-badge" key={unreadCount}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            </div>
        </nav>
    )
}
