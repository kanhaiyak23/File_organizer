import { createContext, useContext, useState, useCallback, useRef } from 'react'

// ── Event severity → display config ──────────────────────────────────
export const SEVERITY = {
    success: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.2)',  label: 'SUCCESS' },
    error:   { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)', label: 'ERROR'   },
    warning: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.2)',  label: 'WARN'    },
    info:    { color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.2)',  label: 'INFO'    },
    conflict:{ color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.2)',  label: 'CONFLICT'},
}

const ActivityContext = createContext(null)

let eventId = 0

export function ActivityProvider({ children }) {
    const [activities, setActivities] = useState([])
    const [toasts, setToasts] = useState([])
    const [feedOpen, setFeedOpen] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)

    const addActivity = useCallback((message, type = 'info', detail = null) => {
        const id = ++eventId
        const timestamp = new Date()
        const entry = { id, message, type, detail, timestamp }

        // Add to persistent activity log
        setActivities(prev => [entry, ...prev].slice(0, 200))

        // Unread badge (only when feed is closed)
        setUnreadCount(prev => feedOpen ? prev : prev + 1)

        // Toast notification – auto-dismiss after 4s
        setToasts(prev => [...prev, entry])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 4000)

        return id
    }, [feedOpen])

    const clearActivities = useCallback(() => setActivities([]), [])

    const openFeed = useCallback(() => {
        setFeedOpen(true)
        setUnreadCount(0)
    }, [])
    const closeFeed = useCallback(() => setFeedOpen(false), [])

    return (
        <ActivityContext.Provider value={{
            activities, toasts, feedOpen, unreadCount,
            addActivity, clearActivities, openFeed, closeFeed,
        }}>
            {children}
        </ActivityContext.Provider>
    )
}

export function useActivity() {
    const ctx = useContext(ActivityContext)
    if (!ctx) throw new Error('useActivity must be used inside ActivityProvider')
    return ctx
}
