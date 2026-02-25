import { useEffect as _ue, useRef as _ur } from 'react' // unused here but keeps bundler happy
import { useActivity, SEVERITY } from './ActivityContext.jsx'
import {
    CheckCircle2, XCircle, AlertTriangle, Info, AlertOctagon, X,
} from 'lucide-react'

const ICONS = {
    success:  CheckCircle2,
    error:    XCircle,
    warning:  AlertTriangle,
    info:     Info,
    conflict: AlertOctagon,
}

export default function ToastSystem() {
    const { toasts } = useActivity()

    if (toasts.length === 0) return null

    return (
        <div className="toast-stack" role="region" aria-label="Notifications">
            {toasts.map(toast => {
                const sev = SEVERITY[toast.type] || SEVERITY.info
                const Icon = ICONS[toast.type] || Info
                return (
                    <div
                        key={toast.id}
                        className={`toast-item toast-${toast.type}`}
                        style={{
                            '--toast-color':  sev.color,
                            '--toast-bg':     sev.bg,
                            '--toast-border': sev.border,
                        }}
                    >
                        <div className="toast-icon">
                            <Icon size={16} />
                        </div>
                        <div className="toast-body">
                            <span className="toast-type-label">{sev.label}</span>
                            <span className="toast-message">{toast.message}</span>
                            {toast.detail && (
                                <span className="toast-detail">{toast.detail}</span>
                            )}
                        </div>
                        <div className="toast-progress" />
                    </div>
                )
            })}
        </div>
    )
}
