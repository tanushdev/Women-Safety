import { useEffect, useState } from 'react'
import { useSocket } from '../hooks/useSocket'
import { CheckCircle, Trash2, ExternalLink, RefreshCw, Radio, MapPin, User, Phone, Clock } from 'lucide-react'
import { API_URL } from '@/config/api'

interface SOSEvent {
    _id: string
    id?: string
    userId: string | { _id: string; name: string; phone: string; email?: string; aadharNumber?: string; age?: number }
    userName?: string
    userPhone?: string
    status: 'TRIGGERED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED'
    triggerType: string
    severity: string
    initialLocation?: {
        type: string
        coordinates: [number, number]
    }
    location?: {
        latitude: number
        longitude: number
    }
    createdAt: string
    resolvedAt?: string
}

export function LiveSOS() {
    const { socket, isConnected } = useSocket()
    const [sosEvents, setSosEvents] = useState<SOSEvent[]>([])
    const [selectedEvent, setSelectedEvent] = useState<SOSEvent | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const fetchSOSEvents = async () => {
        try {
            const response = await fetch(`${API_URL}/sos`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            if (response.ok) {
                const data = await response.json()
                setSosEvents(Array.isArray(data) ? data : [])
            }
        } catch (error) {
            console.error('Failed to fetch SOS events:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchSOSEvents()
    }, [])

    useEffect(() => {
        if (!socket) return

        socket.on('sos:new', (event: SOSEvent) => {
            setSosEvents(prev => [event, ...prev])
            new Audio('/alert.mp3').play().catch(() => { })
        })

        socket.on('sos:updated', (data: { sosId: string; status: string }) => {
            setSosEvents(prev =>
                prev.map(e => (e._id || e.id) === data.sosId ? { ...e, status: data.status as SOSEvent['status'] } : e)
            )
        })

        socket.on('sos:status:changed', (data: { sosId: string; status: string }) => {
            setSosEvents(prev =>
                prev.map(e => (e._id || e.id) === data.sosId
                    ? { ...e, status: data.status as SOSEvent['status'], resolvedAt: new Date().toISOString() }
                    : e
                )
            )
        })

        return () => {
            socket.off('sos:new')
            socket.off('sos:updated')
            socket.off('sos:status:changed')
        }
    }, [socket])

    const getTimeSince = (dateString: string) => {
        const diff = Date.now() - new Date(dateString).getTime()
        const minutes = Math.floor(diff / 60000)
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h ago`
        return `${Math.floor(hours / 24)}d ago`
    }

    const getUserName = (event: SOSEvent) => {
        if (event.userName) return event.userName
        if (typeof event.userId === 'object' && event.userId !== null) return event.userId.name
        return 'Unknown User'
    }

    const getUserPhone = (event: SOSEvent) => {
        if (event.userPhone) return event.userPhone
        if (typeof event.userId === 'object' && event.userId !== null) return event.userId.phone
        return 'N/A'
    }

    const getLocation = (event: SOSEvent) => {
        if (event.location) return event.location
        if (event.initialLocation?.coordinates) {
            return {
                latitude: event.initialLocation.coordinates[1],
                longitude: event.initialLocation.coordinates[0],
            }
        }
        return { latitude: 0, longitude: 0 }
    }

    const resolveEvent = async (eventId: string) => {
        try {
            const response = await fetch(`${API_URL}/sos/${eventId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                body: JSON.stringify({ status: 'RESOLVED' }),
            })
            if (response.ok) {
                setSosEvents(prev =>
                    prev.map(e => (e._id || e.id) === eventId
                        ? { ...e, status: 'RESOLVED', resolvedAt: new Date().toISOString() }
                        : e
                    )
                )
                setSelectedEvent(null)
            }
        } catch (error) {
            console.error('Failed to resolve SOS:', error)
        }
    }

    const deleteEvent = async (eventId: string) => {
        if (!confirm('Are you sure you want to delete this SOS record?')) return

        try {
            const response = await fetch(`${API_URL}/sos/${eventId}`, {
                method: 'DELETE',
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            if (response.ok) {
                setSosEvents(prev => prev.filter(e => (e._id || e.id) !== eventId))
                setSelectedEvent(null)
            }
        } catch (error) {
            console.error('Failed to delete SOS:', error)
        }
    }

    const activeEvents = sosEvents.filter(e => e.status === 'TRIGGERED' || e.status === 'IN_PROGRESS')
    const resolvedEvents = sosEvents.filter(e => e.status === 'RESOLVED' || e.status === 'CANCELLED')

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500 font-mono text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-slate-700" />
                <span>INITIALIZING DISPATCH TERMINAL...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="command-panel p-6 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] font-mono font-semibold tracking-wider text-red-600 uppercase">
                            Emergency Response Unit
                        </span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase font-mono">
                        Live SOS Dispatch Feed
                    </h1>
                    <p className="text-xs text-slate-500 font-mono">Real-time distress beacon intercept & responder coordination</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchSOSEvents}
                        className="command-button-secondary px-3.5 py-2 rounded-lg text-xs font-mono flex items-center gap-2"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        <span>SYNC</span>
                    </button>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono">
                        <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-500 animate-pulse' : 'text-red-500'}`} />
                        <span className={isConnected ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>
                            {isConnected ? 'STREAM ONLINE' : 'DISCONNECTED'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Metrics Ticker */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
                <div className="command-card p-4 rounded-xl border border-red-200 bg-red-50/40">
                    <div className="text-[10px] uppercase tracking-wider text-red-700 font-bold mb-1">
                        Active Emergencies
                    </div>
                    <div className="text-3xl font-bold text-red-600 tabular-nums">{activeEvents.length}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Requiring immediate unit action</div>
                </div>
                <div className="command-card p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1">
                        Resolved Today
                    </div>
                    <div className="text-3xl font-bold text-emerald-600 tabular-nums">{resolvedEvents.length}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Successfully secured & closed</div>
                </div>
                <div className="command-card p-4 rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                        Total Recorded Today
                    </div>
                    <div className="text-3xl font-bold text-slate-900 tabular-nums">{sosEvents.length}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Cumulative signals logged</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active SOS List */}
                <div className="command-panel rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                            <span>Active Incident Queue ({activeEvents.length})</span>
                        </h2>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                        {activeEvents.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 font-mono text-xs">
                                NO ACTIVE DISTRESS SIGNALS DETECTED
                            </div>
                        ) : (
                            activeEvents.map(event => {
                                const eventId = event._id || event.id || ''
                                const isSelected = selectedEvent && (selectedEvent._id || selectedEvent.id) === eventId
                                return (
                                    <div
                                        key={eventId}
                                        onClick={() => setSelectedEvent(event)}
                                        className={`p-4 cursor-pointer transition-all ${
                                            isSelected 
                                                ? 'bg-red-50/80 border-l-4 border-red-500' 
                                                : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>{getUserName(event) || 'Unknown User'}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                                                    <Phone className="w-3 h-3 text-slate-400" />
                                                    <span>{getUserPhone(event)}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tactical-badge-red">
                                                    {event.triggerType || 'PANIC_SOS'}
                                                </span>
                                                <div className="text-[10px] font-mono text-slate-400 mt-1.5 flex items-center justify-end gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{getTimeSince(event.createdAt)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Selected Event Tactical Details */}
                <div className="command-panel rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/80">
                        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900">
                            Incident Telemetry Breakdown
                        </h2>
                    </div>
                    {selectedEvent ? (
                        <div className="p-5 space-y-4">
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-1">
                                <span className="text-[10px] font-mono text-red-600 uppercase tracking-widest font-bold">
                                    [ EMERGENCY TARGET ]
                                </span>
                                <div className="font-bold text-lg text-slate-900 font-mono">{getUserName(selectedEvent)}</div>
                                <div className="text-xs text-slate-500 font-mono">{getUserPhone(selectedEvent)}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                                <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
                                    <div className="text-[10px] text-slate-400 uppercase">Operational Status</div>
                                    <div className={`font-bold mt-1 ${selectedEvent.status === 'RESOLVED' ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {selectedEvent.status}
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
                                    <div className="text-[10px] text-slate-400 uppercase">Threat Priority</div>
                                    <div className="font-bold text-amber-600 mt-1">{selectedEvent.severity || 'P1 HIGH'}</div>
                                </div>
                            </div>

                            <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-sm font-mono text-xs">
                                <div className="text-[10px] text-slate-400 uppercase flex items-center justify-between">
                                    <span>GPS Coordinates</span>
                                    <MapPin className="w-3.5 h-3.5 text-red-500" />
                                </div>
                                <div className="text-sm font-bold text-slate-800 mt-1">
                                    {getLocation(selectedEvent).latitude.toFixed(5)}° N, {getLocation(selectedEvent).longitude.toFixed(5)}° E
                                </div>
                                <a
                                    href={`https://www.google.com/maps?q=${getLocation(selectedEvent).latitude},${getLocation(selectedEvent).longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 text-[11px] inline-flex items-center gap-1 mt-2 hover:underline font-semibold"
                                >
                                    <span>Open Tactical Satellite Map</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>

                            <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-sm font-mono text-xs">
                                <div className="text-[10px] text-slate-400 uppercase">Distress Timestamp</div>
                                <div className="font-bold text-slate-800 mt-1">
                                    {new Date(selectedEvent.createdAt).toLocaleString()}
                                </div>
                            </div>

                            <div className="flex gap-2.5 pt-2">
                                {selectedEvent.status !== 'RESOLVED' && (
                                    <button
                                        onClick={() => resolveEvent(selectedEvent._id || selectedEvent.id || '')}
                                        className="flex-1 command-button-primary py-2.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        <span>RESOLVE INCIDENT</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => deleteEvent(selectedEvent._id || selectedEvent.id || '')}
                                    className="px-4 py-2.5 rounded-lg bg-white text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 text-xs font-mono font-semibold transition-colors flex items-center gap-1.5"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Purge</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-12 text-center text-slate-400 font-mono text-xs">
                            Select an emergency event from the queue to inspect live telemetry.
                        </div>
                    )}
                </div>
            </div>

            {/* Recent History Table */}
            <div className="command-panel rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50/80">
                    <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900">
                        Incident Audit Log
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-left">
                                <th className="p-3.5 uppercase font-semibold">User Identity</th>
                                <th className="p-3.5 uppercase font-semibold">Trigger Mode</th>
                                <th className="p-3.5 uppercase font-semibold">Status</th>
                                <th className="p-3.5 uppercase font-semibold">Timestamp</th>
                                <th className="p-3.5 uppercase font-semibold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sosEvents.slice(0, 10).map(event => {
                                const eventId = event._id || event.id || ''
                                return (
                                    <tr key={eventId} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3.5">
                                            <div className="font-semibold text-slate-900">{getUserName(event)}</div>
                                            <div className="text-[11px] text-slate-500">{getUserPhone(event)}</div>
                                        </td>
                                        <td className="p-3.5 text-slate-700">{event.triggerType || 'MANUAL_SOS'}</td>
                                        <td className="p-3.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                event.status === 'RESOLVED' ? 'tactical-badge-green' :
                                                event.status === 'CANCELLED' ? 'tactical-badge-amber' :
                                                'tactical-badge-red'
                                            }`}>
                                                {event.status}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-slate-500">{getTimeSince(event.createdAt)}</td>
                                        <td className="p-3.5 text-right">
                                            <button
                                                onClick={() => setSelectedEvent(event)}
                                                className="command-button-secondary px-2.5 py-1 rounded text-[11px] font-semibold"
                                            >
                                                Inspect
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
