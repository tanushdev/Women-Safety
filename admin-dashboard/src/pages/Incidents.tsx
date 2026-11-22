import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from '@/config/api'
import { RefreshCw, CheckCircle2, Trash2, Search, MapPin, Phone, User, ExternalLink } from 'lucide-react'

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
    const [, setError] = useState<string | null>(null)
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
    const [selectedIncident, setSelectedIncident] = useState<SosIncident | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    const fetchIncidents = async () => {
        try {
            setLoading(true)
            const response = await axios.get(`${API_URL}/sos`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
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

    const filteredIncidents = incidents.filter(i => {
        if (selectedStatus && i.status !== selectedStatus) return false
        if (searchTerm) {
            const name = getUserName(i).toLowerCase()
            const phone = getUserPhone(i)
            return name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm)
        }
        return true
    })

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'TRIGGERED': return 'tactical-badge-red'
            case 'IN_PROGRESS': return 'tactical-badge-blue'
            case 'RESOLVED': return 'tactical-badge-green'
            case 'CANCELLED': return 'tactical-badge-amber'
            default: return 'bg-slate-100 text-slate-700 border border-slate-200'
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500 font-mono text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-slate-700" />
                <span>QUERYING INCIDENT LEDGER...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="command-panel p-6 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-900" />
                        <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
                            Operational Audit Ledger
                        </span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase font-mono">
                        Incident Records & History
                    </h1>
                    <p className="text-xs text-slate-500 font-mono">Verified chronological audit logs of all emergency distress calls</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchIncidents}
                        className="command-button-secondary px-3.5 py-2 rounded-lg text-xs font-mono flex items-center gap-2"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        <span>REFRESH</span>
                    </button>
                </div>
            </div>

            {/* Status Filter Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
                {[
                    { label: 'ALL INCIDENTS', count: incidents.length, status: null, color: 'text-slate-900' },
                    { label: 'TRIGGERED', count: incidents.filter(i => i.status === 'TRIGGERED').length, status: 'TRIGGERED', color: 'text-red-600' },
                    { label: 'IN PROGRESS', count: incidents.filter(i => i.status === 'IN_PROGRESS').length, status: 'IN_PROGRESS', color: 'text-blue-600' },
                    { label: 'RESOLVED', count: incidents.filter(i => i.status === 'RESOLVED').length, status: 'RESOLVED', color: 'text-emerald-600' },
                    { label: 'CANCELLED', count: incidents.filter(i => i.status === 'CANCELLED').length, status: 'CANCELLED', color: 'text-slate-500' },
                ].map(item => {
                    const isSelected = selectedStatus === item.status
                    return (
                        <div
                            key={item.label}
                            onClick={() => setSelectedStatus(item.status)}
                            className={`p-4 rounded-xl cursor-pointer transition-all border ${
                                isSelected
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                    : 'bg-white border-slate-200 hover:bg-slate-50 shadow-sm'
                            }`}
                        >
                            <div className={`text-2xl font-bold tabular-nums ${isSelected ? 'text-white' : item.color}`}>
                                {item.count}
                            </div>
                            <div className={`text-[10px] font-semibold tracking-wider uppercase mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                                {item.label}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by victim name or contact number..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 shadow-sm"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Incidents Table / List */}
                <div className="lg:col-span-2 command-panel rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between font-mono">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                            Incident Queue ({filteredIncidents.length})
                        </h2>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                        {filteredIncidents.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 font-mono text-xs">
                                No incident records match current query.
                            </div>
                        ) : (
                            filteredIncidents.map(incident => {
                                const isSelected = selectedIncident?._id === incident._id
                                return (
                                    <div
                                        key={incident._id}
                                        onClick={() => setSelectedIncident(incident)}
                                        className={`p-4 cursor-pointer transition-all ${
                                            isSelected 
                                                ? 'bg-slate-50 border-l-4 border-slate-900' 
                                                : 'hover:bg-slate-50/70'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>{getUserName(incident)}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                                                    <Phone className="w-3 h-3 text-slate-400" />
                                                    <span>{getUserPhone(incident)}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                                                    <MapPin className="w-3 h-3 text-red-500" />
                                                    <span>{getLocation(incident)}</span>
                                                </div>
                                            </div>
                                            <div className="text-right space-y-1.5 font-mono">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusBadge(incident.status)}`}>
                                                    {incident.status}
                                                </span>
                                                <div className="text-[10px] text-slate-400">
                                                    {new Date(incident.createdAt).toLocaleTimeString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Selected Incident Telemetry */}
                <div className="command-panel rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/80">
                        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900">
                            Incident Dossier
                        </h2>
                    </div>
                    {selectedIncident ? (
                        <div className="p-5 space-y-4 font-mono text-xs">
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-1">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                    [ LOG ENTRY: {selectedIncident._id.slice(-6).toUpperCase()} ]
                                </span>
                                <div className="font-bold text-base text-slate-900">{getUserName(selectedIncident)}</div>
                                <div className="text-xs text-slate-500">{getUserPhone(selectedIncident)}</div>
                            </div>

                            <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-sm space-y-1">
                                <div className="text-[10px] text-slate-400 uppercase">Geographical Coordinates</div>
                                <div className="font-bold text-slate-800">{getLocation(selectedIncident)}</div>
                                {selectedIncident.initialLocation?.coordinates && (
                                    <a
                                        href={`https://www.google.com/maps?q=${selectedIncident.initialLocation.coordinates[1]},${selectedIncident.initialLocation.coordinates[0]}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 text-[11px] inline-flex items-center gap-1 mt-1 hover:underline font-semibold"
                                    >
                                        <span>Locate on Map</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
                                    <div className="text-[10px] text-slate-400 uppercase">Status</div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block mt-1 ${getStatusBadge(selectedIncident.status)}`}>
                                        {selectedIncident.status}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
                                    <div className="text-[10px] text-slate-400 uppercase">Recorded At</div>
                                    <div className="text-[11px] font-bold text-slate-800 mt-1">
                                        {new Date(selectedIncident.createdAt).toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 space-y-2">
                                {selectedIncident.status !== 'RESOLVED' && selectedIncident.status !== 'CANCELLED' && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleInvestigate(selectedIncident._id)}
                                            className="command-button-secondary py-2 rounded-lg text-xs font-semibold"
                                        >
                                            Investigate
                                        </button>
                                        <button
                                            onClick={() => handleResolve(selectedIncident._id)}
                                            className="command-button-primary py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Resolve</span>
                                        </button>
                                    </div>
                                )}
                                <button
                                    onClick={() => handleDelete(selectedIncident._id)}
                                    className="w-full py-2 rounded-lg bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Purge Incident Record</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-12 text-center text-slate-400 font-mono text-xs">
                            Select an incident record to review details and triage.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
