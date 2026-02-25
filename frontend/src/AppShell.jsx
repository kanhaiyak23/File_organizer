import { useState, useCallback } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import LandingPage from './LandingPage.jsx'
import Explorer from './App.jsx'
import Dashboard from './Dashboard.jsx'
import { ActivityProvider } from './ActivityContext.jsx'
import ToastSystem from './ToastSystem.jsx'
import ActivityFeed from './ActivityFeed.jsx'
import RecycleBin from './RecycleBin.jsx'

export default function AppShell() {
    const location = useLocation()
    const isHome = location.pathname === '/'
    const [trashOpen, setTrashOpen] = useState(false)

    const openTrash = useCallback(() => setTrashOpen(true), [])
    const closeTrash = useCallback(() => setTrashOpen(false), [])

    return (
        <ActivityProvider>
            <Navbar onOpenTrash={openTrash} />

            {/* ── Landing page: full cosmic shell ──────── */}
            {isHome && <LandingPage />}

            {/* ── Inner pages: original glass shell ────── */}
            {!isHome && (
                <div className="app-shell">
                    <div className="animated-bg" />
                    <div className="noise-overlay" />
                    <div className="page-content">
                        <Routes>
                            <Route path="/explorer"  element={<Explorer />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                        </Routes>
                    </div>
                </div>
            )}

            {/* ── Global overlays (always mounted) ─────── */}
            <ToastSystem />
            <ActivityFeed />
            <RecycleBin
                open={trashOpen}
                onClose={closeTrash}
                onRestored={closeTrash}
            />
        </ActivityProvider>
    )
}
