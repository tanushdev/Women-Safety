import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from '@/config/api'
import { RefreshCw, CheckCircle2, Trash2, Search, Phone, User, ExternalLink, Volume2 } from 'lucide-react'
import { BlackboxAudioPlayer } from '@/components/audio/BlackboxAudioPlayer'

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
    audioRecordingUrl?: string
    audioUrl?: string
    sha256Checksum?: string
    digitalCertificate?: string
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
            if (!selectedIncident && data.length > 0) {
                setSelectedIncident(data[0])
            }
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
                setSelectedIncident(prev => prev ? { ...prev, status: 'RESOLVED' } : null)
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
            if (selectedIncident?._id === id) {
                setSelectedIncident(prev => prev ? { ...prev, status: 'IN_PROGRESS' } : null)
            }
        } catch (err) {
            console.error('Error updating incident:', err)
            alert('Failed to update incident')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this incident record?')) return
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
        return 'Citizen in Distress'
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
            return `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`
        }
        return 'Navi Mumbai Hub'
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
            case 'TRIGGERED': return 'bg-red-50 text-red-600 border border-red-200'
            case 'IN_PROGRESS': return 'bg-blue-50 text-blue-600 border border-blue-200'
            case 'RESOLVED': return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            case 'CANCELLED': return 'bg-amber-50 text-amber-700 border border-amber-200'
            default: return 'bg-slate-100 text-slate-700 border border-slate-200'
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500 font-mono text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-slate-700" />
                <span>QUERYING INCIDENT LEDGER & BLACKBOX RECORDS...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                        Incident Ledger & Forensic Audio Vault
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Historical distress archives, chain-of-custody recordings, and audit trails
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchIncidents}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        <span>Refresh Records</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                    {[
                        { label: 'All Incidents', value: null },
                        { label: 'Active SOS', value: 'TRIGGERED' },
                        { label: 'In Progress', value: 'IN_PROGRESS' },
                        { label: 'Resolved', value: 'RESOLVED' },
                    ].map(f => (
                        <button
                            key={f.label}
                            onClick={() => setSelectedStatus(f.value)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                                selectedStatus === f.value
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Filter by citizen or phone..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 shadow-sm"
                    />
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Incident List (5 Columns) */}
                <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                            Archived Incidents ({filteredIncidents.length})
                        </h2>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
                        {filteredIncidents.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 text-xs">
                                No incident records matching filter criteria.
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
                                                ? 'bg-rose-50/80 border-l-4 border-[#FF2D78]' 
                                                : 'hover:bg-slate-50/70'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="font-bold text-sm text-slate-900 flex items-center gap-2 truncate">
                                                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span className="truncate">{getUserName(incident)}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                                    <span>{getUserPhone(incident)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                                        <Volume2 className="w-3 h-3" />
                                                        <span>Audio Vault Sealed</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusBadge(incident.status)}`}>
                                                    {incident.status}
                                                </span>
                                                <div className="text-[10px] text-slate-400 mt-2">
                                                    {new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Selected Incident Dossier & Blackbox Audio (7 Columns) */}
                <div className="lg:col-span-7 space-y-4">
                    {selectedIncident ? (
                        <>
                            {/* Blackbox Audio Player */}
                            <BlackboxAudioPlayer
                                incidentId={selectedIncident._id}
                                citizenName={getUserName(selectedIncident)}
                                audioUrl={selectedIncident.audioRecordingUrl || selectedIncident.audioUrl}
                                isLive={selectedIncident.status === 'TRIGGERED' || selectedIncident.status === 'IN_PROGRESS'}
                                sha256Checksum={selectedIncident.sha256Checksum}
                                digitalCertificate={selectedIncident.digitalCertificate}
                                timestamp={selectedIncident.createdAt}
                            />

                            {/* Dossier Card */}
                            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4 text-xs">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">
                                            DOSSIER RECORD ID
                                        </span>
                                        <div className="font-mono text-xs font-bold text-slate-900 mt-0.5">
                                            {selectedIncident._id}
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusBadge(selectedIncident.status)}`}>
                                        {selectedIncident.status}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Citizen Identity</div>
                                        <div className="font-bold text-slate-900 mt-0.5">{getUserName(selectedIncident)}</div>
                                        <div className="text-[11px] text-slate-500">{getUserPhone(selectedIncident)}</div>
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Location Fix</div>
                                        <div className="font-bold text-slate-800 mt-0.5">{getLocation(selectedIncident)}</div>
                                        {selectedIncident.initialLocation?.coordinates && (
                                            <a
                                                href={`https://www.google.com/maps?q=${selectedIncident.initialLocation.coordinates[1]},${selectedIncident.initialLocation.coordinates[0]}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 text-[10px] inline-flex items-center gap-1 mt-1 font-semibold hover:underline"
                                            >
                                                <span>Satellite Map</span>
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Operational Actions */}
                                <div className="pt-2 flex items-center gap-3">
                                    {selectedIncident.status !== 'RESOLVED' && selectedIncident.status !== 'CANCELLED' && (
                                        <>
                                            <button
                                                onClick={() => handleInvestigate(selectedIncident._id)}
                                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors shadow-sm"
                                            >
                                                Dispatch Unit
                                            </button>
                                            <button
                                                onClick={() => handleResolve(selectedIncident._id)}
                                                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span>Mark Resolved</span>
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => handleDelete(selectedIncident._id)}
                                        className="px-4 py-2.5 rounded-xl bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Purge Record</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="p-16 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center text-slate-400 text-xs">
                            Select an incident record to review details, forensic audio, and chain-of-custody checksum.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
