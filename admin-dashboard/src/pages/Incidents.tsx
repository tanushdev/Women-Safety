import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

interface SosIncident {
    _id: string
    userId: {
        _id: string
        name: string
        phone: string
        email?: string
    } | string
    status: 'TRIGGERED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED' | 'FALSE_ALARM'
    severity?: string
    triggerType?: string
    initialLocation?: {
        type: string
        coordinates: [number, number]
        address?: string
    }
    createdAt: string
    resolvedAt?: string
    resolvedBy?: string
}

export function Incidents() {
    const [incidents, setIncidents] = useState<SosIncident[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
    const [selectedIncident, setSelectedIncident] = useState<SosIncident | null>(null)

    const fetchIncidents = async () => {
        try {
            setLoading(true)
            const response = await axios.get(`${API_URL}/sos`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            // Ensure we always have an array
            const data = Array.isArray(response.data) ? response.data : []
            setIncidents(data)
            setError(null)
        } catch (err) {
            console.error('Error fetching incidents:', err)
            setError('Failed to load incidents')
            setIncidents([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchIncidents()
    }, [])

    const handleResolve = async (id: string) => {
        try {
            await axios.patch(`${API_URL}/sos/${id}/status`, { status: 'RESOLVED' }, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            fetchIncidents()
            if (selectedIncident?._id === id) {
                setSelectedIncident(null)
            }
        } catch (err) {
            console.error('Error resolving incident:', err)
            alert('Failed to resolve incident')
        }
    }

    const handleInvestigate = async (id: string) => {
        try {
            await axios.patch(`${API_URL}/sos/${id}/status`, { status: 'IN_PROGRESS' }, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            fetchIncidents()
        } catch (err) {
            console.error('Error updating incident:', err)
            alert('Failed to update incident')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this incident?')) return
        try {
            await axios.delete(`${API_URL}/sos/${id}`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            fetchIncidents()
            if (selectedIncident?._id === id) {
                setSelectedIncident(null)
            }
        } catch (err) {
            console.error('Error deleting incident:', err)
            alert('Failed to delete incident')
        }
    }

    const filteredIncidents = incidents.filter(i => {
        if (selectedStatus && i.status !== selectedStatus) return false
        return true
    })

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'TRIGGERED': return 'bg-red-500 text-white'
            case 'IN_PROGRESS': return 'bg-blue-500 text-white'
            case 'RESOLVED': return 'bg-green-500 text-white'
            case 'CANCELLED': return 'bg-gray-500 text-white'
            case 'FALSE_ALARM': return 'bg-yellow-500 text-black'
            default: return 'bg-gray-300'
        }
    }

    const getUserName = (incident: SosIncident) => {
        if (typeof incident.userId === 'object' && incident.userId?.name) {
            return incident.userId.name
        }
        return 'Unknown User'
    }

    const getUserPhone = (incident: SosIncident) => {
        if (typeof incident.userId === 'object' && incident.userId?.phone) {
            return incident.userId.phone
        }
        return 'N/A'
    }

    const getLocation = (incident: SosIncident) => {
        if (incident.initialLocation?.coordinates) {
            const [lng, lat] = incident.initialLocation.coordinates
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        }
        return 'Unknown'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-xl font-bold">Loading incidents...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="text-xl font-bold text-red-600">{error}</div>
                <button
                    onClick={fetchIncidents}
                    className="bg-black text-white px-4 py-2 font-bold"
                >
                    Retry
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-tight">Incidents</h1>
                    <p className="text-muted-foreground">SOS incident management - Real Data</p>
                </div>
                <button
                    onClick={fetchIncidents}
                    className="bg-black text-white border-2 border-black px-6 py-3 font-bold uppercase hover:bg-gray-800 transition-colors"
                >
                    ↻ Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-4">
                <div
                    onClick={() => setSelectedStatus(null)}
                    className={`border-2 border-black p-4 cursor-pointer transition-colors ${!selectedStatus ? 'bg-secondary' : 'hover:bg-secondary'}`}
                >
                    <div className="text-3xl font-black">{incidents.length}</div>
                    <div className="text-xs font-medium uppercase">Total</div>
                </div>
                <div
                    onClick={() => setSelectedStatus('TRIGGERED')}
                    className={`border-2 border-black p-4 cursor-pointer transition-colors ${selectedStatus === 'TRIGGERED' ? 'bg-red-100' : 'bg-red-50 hover:bg-red-100'}`}
                >
                    <div className="text-3xl font-black text-red-600">
                        {incidents.filter(i => i.status === 'TRIGGERED').length}
                    </div>
                    <div className="text-xs font-medium uppercase">Triggered</div>
                </div>
                <div
                    onClick={() => setSelectedStatus('IN_PROGRESS')}
                    className={`border-2 border-black p-4 cursor-pointer transition-colors ${selectedStatus === 'IN_PROGRESS' ? 'bg-blue-100' : 'bg-blue-50 hover:bg-blue-100'}`}
                >
                    <div className="text-3xl font-black text-blue-600">
                        {incidents.filter(i => i.status === 'IN_PROGRESS').length}
                    </div>
                    <div className="text-xs font-medium uppercase">In Progress</div>
                </div>
                <div
                    onClick={() => setSelectedStatus('RESOLVED')}
                    className={`border-2 border-black p-4 cursor-pointer transition-colors ${selectedStatus === 'RESOLVED' ? 'bg-green-100' : 'bg-green-50 hover:bg-green-100'}`}
                >
                    <div className="text-3xl font-black text-green-600">
                        {incidents.filter(i => i.status === 'RESOLVED').length}
                    </div>
                    <div className="text-xs font-medium uppercase">Resolved</div>
                </div>
                <div
                    onClick={() => setSelectedStatus('CANCELLED')}
                    className={`border-2 border-black p-4 cursor-pointer transition-colors ${selectedStatus === 'CANCELLED' ? 'bg-gray-200' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                    <div className="text-3xl font-black text-gray-600">
                        {incidents.filter(i => i.status === 'CANCELLED').length}
                    </div>
                    <div className="text-xs font-medium uppercase">Cancelled</div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Incidents List */}
                <div className="col-span-2 border-2 border-black">
                    <div className="bg-black text-white p-4 border-b-2 border-black flex items-center justify-between">
                        <h2 className="font-bold uppercase">Incident Log ({filteredIncidents.length})</h2>
                    </div>
                    <div className="divide-y-2 divide-black max-h-[500px] overflow-y-auto">
                        {filteredIncidents.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                No incidents found. Trigger SOS from mobile app to see data here.
                            </div>
                        ) : (
                            filteredIncidents.map(incident => (
                                <div
                                    key={incident._id}
                                    onClick={() => setSelectedIncident(incident)}
                                    className={`p-4 cursor-pointer hover:bg-secondary transition-colors ${selectedIncident?._id === incident._id ? 'bg-secondary' : ''}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            <span className="text-2xl">🚨</span>
                                            <div>
                                                <div className="font-bold">{getUserName(incident)}</div>
                                                <div className="text-sm text-muted-foreground">{getUserPhone(incident)}</div>
                                                <div className="text-sm text-muted-foreground mt-1">
                                                    📍 {getLocation(incident)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <span className={`px-2 py-1 text-xs font-bold ${getStatusColor(incident.status)}`}>
                                                {incident.status}
                                            </span>
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(incident.createdAt).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Incident Details */}
                <div className="border-2 border-black">
                    <div className="bg-secondary p-4 border-b-2 border-black">
                        <h2 className="font-bold uppercase">Incident Details</h2>
                    </div>
                    {selectedIncident ? (
                        <div className="p-4 space-y-4">
                            <div className="text-center py-4 border-b-2 border-black">
                                <span className="text-4xl">🚨</span>
                                <div className="font-bold uppercase mt-2">SOS ALERT</div>
                            </div>

                            <div className="border-2 border-black p-3">
                                <div className="text-xs font-medium uppercase text-muted-foreground">Reporter</div>
                                <div className="font-bold">{getUserName(selectedIncident)}</div>
                                <div className="text-sm text-muted-foreground">{getUserPhone(selectedIncident)}</div>
                            </div>

                            <div className="border-2 border-black p-3">
                                <div className="text-xs font-medium uppercase text-muted-foreground">Location</div>
                                <div className="text-sm font-mono">{getLocation(selectedIncident)}</div>
                                {selectedIncident.initialLocation?.coordinates && (
                                    <a
                                        href={`https://www.google.com/maps?q=${selectedIncident.initialLocation.coordinates[1]},${selectedIncident.initialLocation.coordinates[0]}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 text-sm underline"
                                    >
                                        Open in Maps →
                                    </a>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="border-2 border-black p-3">
                                    <div className="text-xs font-medium uppercase text-muted-foreground">Status</div>
                                    <span className={`px-2 py-1 text-xs font-bold ${getStatusColor(selectedIncident.status)}`}>
                                        {selectedIncident.status}
                                    </span>
                                </div>
                                <div className="border-2 border-black p-3">
                                    <div className="text-xs font-medium uppercase text-muted-foreground">Created</div>
                                    <div className="text-sm">{new Date(selectedIncident.createdAt).toLocaleString()}</div>
                                </div>
                            </div>

                            {selectedIncident.status !== 'RESOLVED' && selectedIncident.status !== 'CANCELLED' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleInvestigate(selectedIncident._id)}
                                        className="flex-1 bg-blue-500 text-white border-2 border-black px-3 py-2 font-bold uppercase text-sm hover:bg-blue-600"
                                    >
                                        Investigate
                                    </button>
                                    <button
                                        onClick={() => handleResolve(selectedIncident._id)}
                                        className="flex-1 bg-green-500 text-white border-2 border-black px-3 py-2 font-bold uppercase text-sm hover:bg-green-600"
                                    >
                                        Resolve
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={() => handleDelete(selectedIncident._id)}
                                className="w-full border-2 border-red-500 text-red-500 px-3 py-2 font-bold uppercase text-sm hover:bg-red-50"
                            >
                                Delete Record
                            </button>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-muted-foreground">
                            Select an incident to view details
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
