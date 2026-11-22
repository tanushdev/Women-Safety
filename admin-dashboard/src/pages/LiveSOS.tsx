import { useEffect, useState } from 'react'
import { useSocket } from '../hooks/useSocket'
import { CheckCircle, Trash2, ExternalLink, RefreshCw, Radio, MapPin, User, Phone, Clock, Volume2 } from 'lucide-react'
import { API_URL } from '@/config/api'
import { BlackboxAudioPlayer } from '@/components/audio/BlackboxAudioPlayer'

interface SOSEvent {
    _id: string
    id?: string
    userId: string | { _id: string; name: string; phone: string; email?: string }
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
                if (!selectedEvent && list.length > 0) {
                    const firstActive = list.find(e => e.status === 'TRIGGERED' || e.status === 'IN_PROGRESS')
                    if (firstActive) setSelectedEvent(firstActive)
                }
            }
        } catch (error) {
            console.error('Failed to fetch alerts:', error)
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

        socket.on('sos:updated', (data: { sosId: string; status: string; audioRecordingUrl?: string; audioUrl?: string }) => {
            setSosEvents(prev =>
                prev.map(e => {
                    if ((e._id || e.id) === data.sosId) {
                        return {
                            ...e,
                            status: data.status as SOSEvent['status'],
                            audioRecordingUrl: data.audioRecordingUrl || data.audioUrl || e.audioRecordingUrl,
                            audioUrl: data.audioUrl || data.audioRecordingUrl || e.audioUrl,
                        }
                    }
                    return e
                })
            )
            if (selectedEvent && (selectedEvent._id || selectedEvent.id) === data.sosId) {
                setSelectedEvent(prev => prev ? {
                    ...prev,
                    status: (data.status as any) || prev.status,
                    audioRecordingUrl: data.audioRecordingUrl || data.audioUrl || prev.audioRecordingUrl,
                    audioUrl: data.audioUrl || data.audioRecordingUrl || prev.audioUrl,
                } : null)
            }
        })

        socket.on('sos:audio:uploaded', (data: { sosId: string; audioRecordingUrl: string }) => {
            setSosEvents(prev =>
                prev.map(e => (e._id || e.id) === data.sosId ? { ...e, audioRecordingUrl: data.audioRecordingUrl, audioUrl: data.audioRecordingUrl } : e)
            )
            if (selectedEvent && (selectedEvent._id || selectedEvent.id) === data.sosId) {
                setSelectedEvent(prev => prev ? { ...prev, audioRecordingUrl: data.audioRecordingUrl, audioUrl: data.audioRecordingUrl } : null)
            }
        })

        return () => {
            socket.off('sos:new')
            socket.off('sos:updated')
            socket.off('sos:audio:uploaded')
        }
    }, [socket, selectedEvent])

    const getTimeSince = (dateString: string) => {
        const diff = Date.now() - new Date(dateString).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 60) return `${mins}m ago`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h ago`
        return `${Math.floor(hrs / 24)}d ago`
    }

    const getUserName = (event: SOSEvent) => {
        if (event.userName) return event.userName
        if (typeof event.userId === 'object' && event.userId !== null) return event.userId.name
        return 'Citizen'
    }

    const getUserPhone = (event: SOSEvent) => {
        if (event.userPhone) return event.userPhone
        if (typeof event.userId === 'object' && event.userId !== null) return event.userId.phone
        return 'N/A'
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
            const res = await fetch(`${API_URL}/sos/${eventId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                body: JSON.stringify({ status: 'RESOLVED' }),
            })
            if (res.ok) {
                setSosEvents(prev =>
                    prev.map(e => (e._id || e.id) === eventId ? { ...e, status: 'RESOLVED' } : e)
                )
                if (selectedEvent && (selectedEvent._id || selectedEvent.id) === eventId) {
                    setSelectedEvent(prev => prev ? { ...prev, status: 'RESOLVED' } : null)
                }
            }
        } catch (err) {
            console.error('Resolve error:', err)
        }
    }

    const deleteEvent = async (eventId: string) => {
        if (!confirm('Delete this alert record?')) return
        try {
            const res = await fetch(`${API_URL}/sos/${eventId}`, {
                method: 'DELETE',
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            if (res.ok) {
                setSosEvents(prev => prev.filter(e => (e._id || e.id) !== eventId))
                if (selectedEvent && (selectedEvent._id || selectedEvent.id) === eventId) {
                    setSelectedEvent(null)
                }
            }
        } catch (err) {
            console.error('Delete error:', err)
        }
    }

    const activeEvents = sosEvents.filter(e => e.status === 'TRIGGERED' || e.status === 'IN_PROGRESS')
    const resolvedEvents = sosEvents.filter(e => e.status === 'RESOLVED' || e.status === 'CANCELLED')

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-500 text-xs font-medium">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                <span>Loading alerts...</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header (Clean & Simple) */}
            <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-base font-bold text-slate-900">
                        Live SOS Alerts
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Active distress signals and audio recording
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchSOSEvents}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-1.5"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                        <span>Refresh</span>
                    </button>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-xs font-semibold text-emerald-700">
                        <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
                        <span>{isConnected ? 'Connected' : 'Offline'}</span>
                    </div>
                </div>
            </div>

            {/* 3 Metric Cards (Simple, Compact) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/40">
                    <div className="text-xs font-medium text-red-600">Active Alerts</div>
                    <div className="text-2xl font-bold text-red-600 mt-1">{activeEvents.length}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Needing response</div>
                </div>
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40">
                    <div className="text-xs font-medium text-emerald-700">Resolved Alerts</div>
                    <div className="text-2xl font-bold text-emerald-600 mt-1">{resolvedEvents.length}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Marked safe</div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                    <div className="text-xs font-medium text-slate-500">Total Alerts</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{sosEvents.length}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Logged in system</div>
                </div>
            </div>

            {/* Main Content (Responsive 12-col) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Active Alerts Queue (5 Cols) */}
                <div className="lg:col-span-5 rounded-xl bg-white border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
                    <div className="p-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                            Active Queue ({activeEvents.length})
                        </span>
                        <span className="text-[11px] text-slate-400">Click to view</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                        {activeEvents.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs">
                                No active alerts right now
                            </div>
                        ) : (
                            activeEvents.map(event => {
                                const eventId = event._id || event.id || ''
                                const isSelected = selectedEvent && (selectedEvent._id || selectedEvent.id) === eventId
                                return (
                                    <div
                                        key={eventId}
                                        onClick={() => setSelectedEvent(event)}
                                        className={`p-3.5 cursor-pointer transition-colors ${
                                            isSelected ? 'bg-rose-50/80 border-l-4 border-rose-500' : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5 truncate">
                                                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span className="truncate">{getUserName(event)}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                                                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                                    <span>{getUserPhone(event)}</span>
                                                </div>
                                                {(event.audioRecordingUrl || event.audioUrl) && (
                                                    <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200">
                                                        <Volume2 className="w-3 h-3 text-emerald-600" />
                                                        <span>Phone Audio Available</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
                                                    {event.triggerType || 'SOS'}
                                                </span>
                                                <div className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-end gap-1">
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

                {/* Details & Audio Player (7 Cols) */}
                <div className="lg:col-span-7 space-y-3">
                    {selectedEvent ? (
                        <>
                            {/* Blackbox Audio Component */}
                            <BlackboxAudioPlayer
                                incidentId={selectedEvent._id || selectedEvent.id || ''}
                                citizenName={getUserName(selectedEvent)}
                                audioUrl={selectedEvent.audioRecordingUrl || selectedEvent.audioUrl}
                                isLive={selectedEvent.status === 'TRIGGERED' || selectedEvent.status === 'IN_PROGRESS'}
                                sha256Checksum={selectedEvent.sha256Checksum}
                                digitalCertificate={selectedEvent.digitalCertificate}
                                timestamp={selectedEvent.createdAt}
                            />

                            {/* Details Card */}
                            <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                                        <span>Alert Information</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        selectedEvent.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                                    }`}>
                                        {selectedEvent.status}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2.5 rounded-lg bg-slate-50">
                                        <div className="text-[10px] text-slate-400">Citizen</div>
                                        <div className="font-semibold text-slate-900 mt-0.5">{getUserName(selectedEvent)}</div>
                                        <div className="text-[11px] text-slate-500">{getUserPhone(selectedEvent)}</div>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-slate-50">
                                        <div className="text-[10px] text-slate-400">Alert Mode</div>
                                        <div className="font-semibold text-slate-900 mt-0.5">{selectedEvent.triggerType || 'Emergency SOS'}</div>
                                        <div className="text-[11px] text-slate-500">{selectedEvent.severity || 'High Priority'}</div>
                                    </div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-slate-50 text-xs flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] text-slate-400">GPS Location</div>
                                        <div className="font-mono text-xs font-semibold text-slate-800 mt-0.5">
                                            {getLocation(selectedEvent).latitude.toFixed(4)}° N, {getLocation(selectedEvent).longitude.toFixed(4)}° E
                                        </div>
                                    </div>
                                    <a
                                        href={`https://www.google.com/maps?q=${getLocation(selectedEvent).latitude},${getLocation(selectedEvent).longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-blue-600 text-xs font-medium hover:bg-slate-50 flex items-center gap-1"
                                    >
                                        <span>View Map</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>

                                <div className="flex gap-2 pt-1">
                                    {selectedEvent.status !== 'RESOLVED' && (
                                        <button
                                            onClick={() => resolveEvent(selectedEvent._id || selectedEvent.id || '')}
                                            className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                                        >
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            <span>Mark Resolved</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => deleteEvent(selectedEvent._id || selectedEvent.id || '')}
                                        className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 text-xs font-medium transition-colors flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Delete</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="p-10 rounded-xl bg-white border border-slate-200/90 text-center text-slate-400 text-xs">
                            Select an alert from the queue to view details and listen to audio
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Table (Simple) */}
            <div className="rounded-xl bg-white border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Recent Alerts</span>
                    <span className="text-[11px] text-slate-500">{sosEvents.length} total</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-slate-100 text-slate-400 text-left">
                                <th className="p-3 font-semibold text-[11px]">User</th>
                                <th className="p-3 font-semibold text-[11px]">Mode</th>
                                <th className="p-3 font-semibold text-[11px]">Status</th>
                                <th className="p-3 font-semibold text-[11px]">Time</th>
                                <th className="p-3 font-semibold text-[11px] text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sosEvents.slice(0, 8).map(event => {
                                const eventId = event._id || event.id || ''
                                return (
                                    <tr key={eventId} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3">
                                            <div className="font-semibold text-slate-900">{getUserName(event)}</div>
                                            <div className="text-[10px] text-slate-400">{getUserPhone(event)}</div>
                                        </td>
                                        <td className="p-3 text-slate-600">{event.triggerType || 'SOS'}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                event.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                                            }`}>
                                                {event.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-400">{getTimeSince(event.createdAt)}</td>
                                        <td className="p-3 text-right">
                                            <button
                                                onClick={() => {
                                                    setSelectedEvent(event)
                                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                                }}
                                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px]"
                                            >
                                                Open
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
