import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from '@/config/api'
import { CheckCircle2, RefreshCw, Phone, Mail } from 'lucide-react'

interface Volunteer {
    _id: string
    userId: {
        _id: string
        name: string
        phone: string
        email?: string
    } | null
    governmentId?: string
    status: 'available' | 'busy' | 'offline' | 'on_mission'
    verificationStatus: 'pending' | 'verified' | 'rejected'
    currentLocation?: {
        coordinates: [number, number]
    }
    skills: string[]
    languages: string[]
    maxResponseDistance: number
    stats: {
        totalMissions: number
        completed: number
        averageRating: number
    }
    isActive: boolean
    createdAt: string
}

export function Volunteers() {
    const [volunteers, setVolunteers] = useState<Volunteer[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedFilter, setSelectedFilter] = useState<string | null>(null)
    const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0, available: 0 })
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const fetchVolunteers = async () => {
        const headers = { 'ngrok-skip-browser-warning': 'true' }
        try {
            setLoading(true)
            const [volunteersRes, statsRes] = await Promise.all([
                axios.get(`${API_URL}/volunteers`, { headers }),
                axios.get(`${API_URL}/volunteers/stats`, { headers }),
            ])
            const volData = Array.isArray(volunteersRes.data) ? volunteersRes.data : []
            setVolunteers(volData)
            setStats(statsRes.data || { total: 0, pending: 0, verified: 0, available: 0 })
            setError(null)
        } catch (err) {
            console.error('Error fetching volunteers:', err)
            setError('Failed to load volunteers')
            setVolunteers([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchVolunteers()
    }, [])

    const handleApprove = async (id: string) => {
        try {
            setActionLoading(id)
            await axios.patch(`${API_URL}/volunteers/${id}/verify`, { status: 'verified' }, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            fetchVolunteers()
        } catch (err) {
            console.error('Error approving volunteer:', err)
            alert('Failed to approve volunteer')
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async (id: string) => {
        try {
            setActionLoading(id)
            await axios.patch(`${API_URL}/volunteers/${id}/verify`, { status: 'rejected' }, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            fetchVolunteers()
        } catch (err) {
            console.error('Error rejecting volunteer:', err)
            alert('Failed to reject volunteer')
        } finally {
            setActionLoading(null)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this volunteer?')) return
        try {
            setActionLoading(id)
            await axios.delete(`${API_URL}/volunteers/${id}`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            fetchVolunteers()
        } catch (err) {
            console.error('Error deleting volunteer:', err)
            alert('Failed to delete volunteer')
        } finally {
            setActionLoading(null)
        }
    }

    const filteredVolunteers = volunteers.filter(v => {
        if (selectedFilter === 'pending') return v.verificationStatus === 'pending'
        if (selectedFilter === 'verified') return v.verificationStatus === 'verified'
        if (selectedFilter === 'available') return v.status === 'available'
        return true
    })

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'available': return 'tactical-badge-green'
            case 'busy': return 'tactical-badge-amber'
            case 'on_mission': return 'tactical-badge-blue'
            default: return 'bg-slate-100 text-slate-600 border border-slate-200'
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500 font-mono text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-slate-700" />
                <span>QUERYING RESPONDER SQUADRON...</span>
            </div>
        )
    }

    const pendingVolunteers = volunteers.filter(v => v.verificationStatus === 'pending')

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="command-panel p-6 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        <span className="text-[10px] font-mono font-semibold tracking-wider text-blue-600 uppercase">
                            Tactical Unit Management
                        </span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase font-mono">
                        Guardian Volunteer Units
                    </h1>
                    <p className="text-xs text-slate-500 font-mono">Deployable emergency responders, credentials, and verification clearance</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchVolunteers}
                        className="command-button-secondary px-3.5 py-2 rounded-lg text-xs font-mono flex items-center gap-2"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        <span>SYNC</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-mono">
                    {error}
                </div>
            )}

            {/* Filter Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
                {[
                    { label: 'TOTAL UNITS', count: stats.total, filter: null, color: 'text-slate-900' },
                    { label: 'PENDING CLEARANCE', count: stats.pending, filter: 'pending', color: 'text-amber-600' },
                    { label: 'VERIFIED UNITS', count: stats.verified, filter: 'verified', color: 'text-emerald-600' },
                    { label: 'READY ON PATROL', count: stats.available, filter: 'available', color: 'text-blue-600' },
                ].map(item => {
                    const isSelected = selectedFilter === item.filter
                    return (
                        <div
                            key={item.label}
                            onClick={() => setSelectedFilter(item.filter)}
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

            {/* Pending Approvals Section */}
            {pendingVolunteers.length > 0 && (
                <div className="command-panel rounded-xl p-5 border border-amber-300 bg-amber-50/50 space-y-4 font-mono shadow-sm">
                    <h2 className="font-bold text-xs uppercase tracking-wider text-amber-800 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>Pending Clearance Approvals ({pendingVolunteers.length})</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pendingVolunteers.map(volunteer => (
                            <div key={volunteer._id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="font-bold text-sm text-slate-900">
                                            {volunteer.userId?.name || 'Unknown Unit'}
                                        </div>
                                        {volunteer.governmentId && (
                                            <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block mt-1 font-semibold">
                                                GOVT ID: {volunteer.governmentId}
                                            </span>
                                        )}
                                    </div>
                                    <span className="tactical-badge-amber px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                                        PENDING
                                    </span>
                                </div>

                                <div className="text-xs text-slate-600 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{volunteer.userId?.phone || 'No phone'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{volunteer.userId?.email || 'No email'}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => handleApprove(volunteer._id)}
                                        disabled={actionLoading === volunteer._id}
                                        className="flex-1 command-button-primary py-2 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-1.5"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Approve Unit</span>
                                    </button>
                                    <button
                                        onClick={() => handleReject(volunteer._id)}
                                        disabled={actionLoading === volunteer._id}
                                        className="px-4 py-2 rounded-lg bg-white text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 text-xs font-semibold"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Volunteers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
                {filteredVolunteers.filter(v => v.verificationStatus !== 'pending').map(volunteer => (
                    <div key={volunteer._id} className="command-card p-5 rounded-xl border border-slate-200 space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-bold text-sm text-slate-900">
                                    {volunteer.userId?.name || 'Guardian Unit'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">{volunteer.userId?.phone}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${getStatusBadge(volunteer.status)}`}>
                                {volunteer.status.replace('_', ' ')}
                            </span>
                        </div>

                        {volunteer.governmentId && (
                            <div className="text-[10px] text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                                ID: {volunteer.governmentId}
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 text-center text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <div>
                                <div className="font-bold text-slate-800">{volunteer.stats?.totalMissions || 0}</div>
                                <div className="text-[10px] text-slate-400 uppercase mt-0.5">Missions</div>
                            </div>
                            <div>
                                <div className="font-bold text-slate-800">{volunteer.stats?.completed || 0}</div>
                                <div className="text-[10px] text-slate-400 uppercase mt-0.5">Done</div>
                            </div>
                            <div>
                                <div className="font-bold text-slate-800">{volunteer.stats?.averageRating?.toFixed(1) || '5.0'}</div>
                                <div className="text-[10px] text-slate-400 uppercase mt-0.5">Rating</div>
                            </div>
                        </div>

                        {volunteer.skills && volunteer.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {volunteer.skills.slice(0, 3).map(skill => (
                                    <span key={skill} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 uppercase font-medium">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2 pt-1 text-xs">
                            {volunteer.verificationStatus === 'verified' && (
                                <button
                                    onClick={() => handleReject(volunteer._id)}
                                    disabled={actionLoading === volunteer._id}
                                    className="flex-1 command-button-secondary py-1.5 rounded-lg text-amber-700 hover:text-amber-800 font-semibold"
                                >
                                    Suspend
                                </button>
                            )}
                            <button
                                onClick={() => handleDelete(volunteer._id)}
                                disabled={actionLoading === volunteer._id}
                                className="px-3 py-1.5 rounded-lg bg-white text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
