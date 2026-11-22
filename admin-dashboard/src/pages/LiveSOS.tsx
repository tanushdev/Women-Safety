import { useEffect, useState } from 'react'
import { useSocket } from '../hooks/useSocket'
import { CheckCircle, Trash2, ExternalLink, RefreshCw, Radio, MapPin, User, Phone, Clock, Headphones, ShieldAlert, Volume2 } from 'lucide-react'
import { API_URL } from '@/config/api'
import { BlackboxAudioPlayer } from '@/components/audio/BlackboxAudioPlayer'

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
    audioRecordingUrl?: string
    audioUrl?: string
    sha256Checksum?: string
    digitalCertificate?: string
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
                const list = Array.isArray(data) ? data : []
                setSosEvents(list)
                // Default select the first active distress if none selected
                if (!selectedEvent && list.length > 0) {
                    const firstActive = list.find(e => e.status === 'TRIGGERED' || e.status === 'IN_PROGRESS')
                    if (firstActive) setSelectedEvent(firstActive)
                }
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
            setSelectedEvent(event)
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
        return 'Citizen in Distress'
    }

    const getUserPhone = (event: SOSEvent) => {
        if (event.userPhone) return event.userPhone
        if (typeof event.userId === 'object' && event.userId !== null) return event.userId.phone
        return 'Emergency Direct Line'
    }

    const getLocation = (event: SOSEvent) => {
        if (event.location && event.location.latitude && event.location.longitude) {
            return event.location
        }
        if (event.initialLocation?.coordinates) {
            return {
                latitude: event.initialLocation.coordinates[1],
                longitude: event.initialLocation.coordinates[0],
            }
        }
        return { latitude: 18.9400, longitude: 73.1650 }
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
                if (selectedEvent && (selectedEvent._id || selectedEvent.id) === eventId) {
                    setSelectedEvent(prev => prev ? { ...prev, status: 'RESOLVED' } : null)
                }
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
                if (selectedEvent && (selectedEvent._id || selectedEvent.id) === eventId) {
                    setSelectedEvent(null)
                }
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
                <span>INITIALIZING DISPATCH & BLACKBOX INTERCEPT...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[11px] font-bold tracking-wider text-red-600 uppercase">
                            Emergency Response & Surveillance Unit
                        </span>
                    </div>
                    <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                        Live SOS Intercept & Blackbox Audio Feed
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">Real-time distress beacon tracking, tamper-proof audio monitoring & dispatch</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchSOSEvents}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        <span>Sync Telemetry</span>
                    </button>
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
                        <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-500 animate-pulse' : 'text-red-500'}`} />
                        <span>{isConnected ? 'LIVE FEED ACTIVE' : 'DISCONNECTED'}</span>
                    </div>
                </div>
            </div>

            {/* Metrics Ticker */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border border-red-200 bg-gradient-to-br from-red-50/60 to-white shadow-sm">
                    <div className="text-[10px] uppercase tracking-wider text-red-700 font-bold mb-1">
                        Active Emergencies
                    </div>
                    <div className="text-3xl font-extrabold text-red-600 tabular-nums">{activeEvents.length}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Live beacons requiring immediate unit dispatch</div>
                </div>
                <div className="p-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white shadow-sm">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1">
                        Resolved Signals
                    </div>
                    <div className="text-3xl font-extrabold text-emerald-600 tabular-nums">{resolvedEvents.length}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Successfully secured & closed</div>
                </div>
                <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-sm">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                        Blackbox Evidence Logs
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 tabular-nums">{sosEvents.length}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Cryptographically sealed audio recordings</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Active SOS List (5 Columns) */}
                <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                            <span>Active Incident Queue ({activeEvents.length})</span>
                        </h2>
                        <span className="text-[11px] text-slate-400 font-medium">Click to inspect & listen</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
                        {activeEvents.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 text-xs font-medium">
                                <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <div>No Active Distress Signals Detected</div>
                                <div className="text-[11px] text-slate-400 mt-1">All sectors currently report normal</div>
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
                                                ? 'bg-rose-50/80 border-l-4 border-[#FF2D78]' 
                                                : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="font-bold text-sm text-slate-900 flex items-center gap-2 truncate">
                                                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span className="truncate">{getUserName(event)}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                                    <span>{getUserPhone(event)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                                                        <Volume2 className="w-3 h-3" />
                                                        <span>Blackbox Audio Available</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-50 text-red-600 border border-red-200">
                                                    {event.triggerType || 'PANIC_SOS'}
                                                </span>
                                                <div className="text-[10px] text-slate-400 mt-2 flex items-center justify-end gap-1">
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

                {/* Selected Event Details & Blackbox Audio Player (7 Columns) */}
                <div className="lg:col-span-7 space-y-4">
                    {selectedEvent ? (
                        <>
                            {/* 🎧 Dedicated Blackbox Ambient Audio Player Card */}
                            <BlackboxAudioPlayer
                                incidentId={selectedEvent._id || selectedEvent.id || 'INCIDENT_001'}
                                citizenName={getUserName(selectedEvent)}
                                audioUrl={selectedEvent.audioRecordingUrl || selectedEvent.audioUrl}
                                isLive={selectedEvent.status === 'TRIGGERED' || selectedEvent.status === 'IN_PROGRESS'}
                                sha256Checksum={selectedEvent.sha256Checksum}
                                digitalCertificate={selectedEvent.digitalCertificate}
                                timestamp={selectedEvent.createdAt}
                            />

                            {/* Telemetry Breakdown Card */}
                            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-rose-500" />
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                            Incident Telemetry & Dispatch Target
                                        </h3>
                                    </div>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                        selectedEvent.status === 'RESOLVED' 
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                            : 'bg-red-50 text-red-600 border border-red-200 animate-pulse'
                                    }`}>
                                        {selectedEvent.status}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Distress User</div>
                                        <div className="font-bold text-slate-900 mt-0.5">{getUserName(selectedEvent)}</div>
                                        <div className="text-[11px] text-slate-500">{getUserPhone(selectedEvent)}</div>
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Priority & Severity</div>
                                        <div className="font-bold text-rose-600 mt-0.5">{selectedEvent.severity || 'CRITICAL LEVEL 1'}</div>
                                        <div className="text-[11px] text-slate-500">{selectedEvent.triggerType || 'INSTANT_SOS'}</div>
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Exact GPS Fix</div>
                                        <div className="font-bold text-slate-800 font-mono mt-0.5">
                                            {getLocation(selectedEvent).latitude.toFixed(5)}° N, {getLocation(selectedEvent).longitude.toFixed(5)}° E
                                        </div>
                                    </div>
                                    <a
                                        href={`https://www.google.com/maps?q=${getLocation(selectedEvent).latitude},${getLocation(selectedEvent).longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 rounded-xl bg-white text-blue-600 border border-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm hover:bg-slate-50 transition-colors"
                                    >
                                        <span>Satellite View</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-2">
                                    {selectedEvent.status !== 'RESOLVED' && (
                                        <button
                                            onClick={() => resolveEvent(selectedEvent._id || selectedEvent.id || '')}
                                            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            <span>Mark Incident Resolved</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => deleteEvent(selectedEvent._id || selectedEvent.id || '')}
                                        className="px-4 py-2.5 rounded-xl bg-white text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Purge</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="p-16 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center text-slate-400 text-xs">
                            <Headphones className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <div className="font-semibold text-slate-700">No Incident Selected</div>
                            <div className="mt-1">Select an active emergency signal from the queue to stream Blackbox ambient audio.</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Recent History Table */}
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Distress Audit & Blackbox Custody Log
                    </h2>
                    <span className="text-[11px] text-slate-500 font-medium">{sosEvents.length} Total Signals Logged</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/40 text-slate-400 text-left">
                                <th className="p-3.5 uppercase font-bold text-[10px]">Citizen Identity</th>
                                <th className="p-3.5 uppercase font-bold text-[10px]">Trigger Mode</th>
                                <th className="p-3.5 uppercase font-bold text-[10px]">Status</th>
                                <th className="p-3.5 uppercase font-bold text-[10px]">Audio Status</th>
                                <th className="p-3.5 uppercase font-bold text-[10px]">Time</th>
                                <th className="p-3.5 uppercase font-bold text-[10px] text-right">Inspect</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sosEvents.slice(0, 10).map(event => {
                                const eventId = event._id || event.id || ''
                                return (
                                    <tr key={eventId} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="p-3.5">
                                            <div className="font-bold text-slate-900">{getUserName(event)}</div>
                                            <div className="text-[11px] text-slate-400">{getUserPhone(event)}</div>
                                        </td>
                                        <td className="p-3.5 text-slate-600 font-medium">{event.triggerType || 'MANUAL_SOS'}</td>
                                        <td className="p-3.5">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                event.status === 'RESOLVED' 
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                    : event.status === 'CANCELLED' 
                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                                        : 'bg-red-50 text-red-600 border border-red-200'
                                            }`}>
                                                {event.status}
                                            </span>
                                        </td>
                                        <td className="p-3.5">
                                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                                                <Volume2 className="w-3 h-3" />
                                                <span>Sealed (SHA-256)</span>
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-slate-400">{getTimeSince(event.createdAt)}</td>
                                        <td className="p-3.5 text-right">
                                            <button
                                                onClick={() => {
                                                    setSelectedEvent(event)
                                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                                }}
                                                className="px-3 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px] transition-colors shadow-sm"
                                            >
                                                Playback
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
