import { Routes, Route } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import LandingPage from './LandingPage.jsx'
import Explorer from './App.jsx'
import Dashboard from './Dashboard.jsx'

// ── Floating Particles Canvas ────────────────────────────────────────
function ParticleBackground() {
    const canvasRef = { current: null }

    return null // We'll use CSS animated background instead for better perf
}

export default function AppShell() {
    return (
        <div className="app-shell">
            {/* Animated gradient background */}
            <div className="animated-bg" />
            <div className="noise-overlay" />

            {/* Navbar */}
            <Navbar />

            {/* Routes */}
            <div className="page-content">
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/explorer" element={<Explorer />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                </Routes>
            </div>
        </div>
    )
}
