import { useEffect, useState } from 'react'
import { useSocket } from '../hooks/useSocket'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

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

    // Fetch SOS events from API
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
            // Play alert sound
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
        return 'Unknown'
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
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-tight">Live SOS</h1>
                    <p className="text-muted-foreground">Real-time emergency monitoring</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={fetchSOSEvents}
                        className="border-2 border-black px-4 py-2 font-medium hover:bg-secondary"
                    >
                        Refresh
                    </button>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                        <span className="text-sm font-medium">{isConnected ? 'Live' : 'Offline'}</span>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="border-2 border-black p-6 bg-red-50">
                    <div className="text-4xl font-black">{activeEvents.length}</div>
                    <div className="text-sm font-medium uppercase tracking-wide">Active Emergencies</div>
                </div>
                <div className="border-2 border-black p-6 bg-green-50">
                    <div className="text-4xl font-black">{resolvedEvents.length}</div>
                    <div className="text-sm font-medium uppercase tracking-wide">Resolved</div>
                </div>
                <div className="border-2 border-black p-6">
                    <div className="text-4xl font-black">{sosEvents.length}</div>
                    <div className="text-sm font-medium uppercase tracking-wide">Total Today</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Active SOS List */}
                <div className="border-2 border-black">
                    <div className="bg-red-600 text-white p-4 border-b-2 border-black">
                        <h2 className="font-bold uppercase flex items-center gap-2">
                            <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
                            Active Emergencies
                        </h2>
                    </div>
                    <div className="divide-y-2 divide-black max-h-[400px] overflow-y-auto">
                        {activeEvents.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                No active emergencies
                            </div>
                        ) : (
                            activeEvents.map(event => {
                                const eventId = event._id || event.id || ''
                                return (
                                    <div
                                        key={eventId}
                                        onClick={() => setSelectedEvent(event)}
                                        className={`p-4 cursor-pointer hover:bg-red-50 transition-colors ${selectedEvent && (selectedEvent._id || selectedEvent.id) === eventId ? 'bg-red-100' : ''}`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="font-bold">{getUserName(event) || 'Unknown User'}</div>
                                                <div className="text-sm text-muted-foreground">{getUserPhone(event)}</div>
                                            </div>
                                            <div className="text-right">
                                                <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold">
                                                    {event.triggerType || 'MANUAL'}
                                                </span>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {getTimeSince(event.createdAt)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Selected Event Details */}
                <div className="border-2 border-black">
                    <div className="bg-secondary p-4 border-b-2 border-black">
                        <h2 className="font-bold uppercase">Event Details</h2>
                    </div>
                    {selectedEvent ? (
                        <div className="p-4 space-y-4">
                            <div className="text-center py-4 border-b-2 border-black">
                                <div className="text-4xl mb-2">🚨</div>
                                <div className="font-black text-xl">{getUserName(selectedEvent)}</div>
                                <div className="text-muted-foreground">{getUserPhone(selectedEvent)}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="border-2 border-black p-3">
                                    <div className="text-xs text-muted-foreground uppercase">Status</div>
                                    <div className={`font-bold ${selectedEvent.status === 'RESOLVED' ? 'text-green-600' : 'text-red-600'}`}>
                                        {selectedEvent.status}
                                    </div>
                                </div>
                                <div className="border-2 border-black p-3">
                                    <div className="text-xs text-muted-foreground uppercase">Severity</div>
                                    <div className="font-bold">{selectedEvent.severity || 'HIGH'}</div>
                                </div>
                            </div>

                            <div className="border-2 border-black p-3">
                                <div className="text-xs text-muted-foreground uppercase">Location</div>
                                <div className="font-mono text-sm">
                                    {getLocation(selectedEvent).latitude.toFixed(4)}, {getLocation(selectedEvent).longitude.toFixed(4)}
                                </div>
                                <a
                                    href={`https://www.google.com/maps?q=${getLocation(selectedEvent).latitude},${getLocation(selectedEvent).longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 text-sm underline"
                                >
                                    View on Map →
                                </a>
                            </div>

                            <div className="border-2 border-black p-3">
                                <div className="text-xs text-muted-foreground uppercase">Triggered At</div>
                                <div className="font-bold">
                                    {new Date(selectedEvent.createdAt).toLocaleString()}
                                </div>
                            </div>

                            {/* User Details if available */}
                            {typeof selectedEvent.userId === 'object' && (
                                <div className="border-2 border-black p-3">
                                    <div className="text-xs text-muted-foreground uppercase mb-2">User Info</div>
                                    {selectedEvent.userId.email && (
                                        <div className="text-sm">Email: {selectedEvent.userId.email}</div>
                                    )}
                                    {selectedEvent.userId.age && (
                                        <div className="text-sm">Age: {selectedEvent.userId.age}</div>
                                    )}
                                    {selectedEvent.userId.aadharNumber && (
                                        <div className="text-sm">Aadhar: {selectedEvent.userId.aadharNumber}</div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-2">
                                {selectedEvent.status !== 'RESOLVED' && (
                                    <button
                                        onClick={() => resolveEvent(selectedEvent._id || selectedEvent.id || '')}
                                        className="flex-1 bg-green-600 text-white border-2 border-black px-4 py-3 font-bold uppercase hover:bg-green-700"
                                    >
                                        ✓ Mark Resolved
                                    </button>
                                )}
                                <button
                                    onClick={() => deleteEvent(selectedEvent._id || selectedEvent.id || '')}
                                    className="flex-1 bg-red-600 text-white border-2 border-black px-4 py-3 font-bold uppercase hover:bg-red-700"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-muted-foreground">
                            Select an event to view details
                        </div>
                    )}
                </div>
            </div>

            {/* Recent History */}
            <div className="border-2 border-black">
                <div className="bg-secondary p-4 border-b-2 border-black">
                    <h2 className="font-bold uppercase">Recent History</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2 border-black bg-gray-100">
                                <th className="text-left p-4 font-bold uppercase text-sm">User</th>
                                <th className="text-left p-4 font-bold uppercase text-sm">Type</th>
                                <th className="text-left p-4 font-bold uppercase text-sm">Status</th>
                                <th className="text-left p-4 font-bold uppercase text-sm">Time</th>
                                <th className="text-left p-4 font-bold uppercase text-sm">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-black">
                            {sosEvents.slice(0, 10).map(event => {
                                const eventId = event._id || event.id || ''
                                return (
                                    <tr key={eventId} className="hover:bg-secondary">
                                        <td className="p-4">
                                            <div className="font-medium">{getUserName(event) || 'Unknown User'}</div>
                                            <div className="text-sm text-muted-foreground">{getUserPhone(event)}</div>
                                        </td>
                                        <td className="p-4">{event.triggerType || 'MANUAL'}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 text-xs font-bold ${event.status === 'RESOLVED' ? 'bg-green-500 text-white' :
                                                event.status === 'CANCELLED' ? 'bg-gray-500 text-white' :
                                                    'bg-red-500 text-white'
                                                }`}>
                                                {event.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm">{getTimeSince(event.createdAt)}</td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => setSelectedEvent(event)}
                                                className="border border-black px-2 py-1 text-sm hover:bg-gray-100"
                                            >
                                                View
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
