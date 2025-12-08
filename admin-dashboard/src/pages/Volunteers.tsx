import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

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
        setActionLoading(id)
        try {
            await axios.put(`${API_URL}/volunteers/${id}/approve`, {}, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            await fetchVolunteers()
        } catch (err: any) {
            console.error('Error approving volunteer:', err)
            alert(`Failed to approve volunteer: ${err.response?.data?.message || err.message}`)
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async (id: string) => {
        const reason = prompt('Reason for rejection (optional):')
        setActionLoading(id)
        try {
            await axios.put(`${API_URL}/volunteers/${id}/reject`, { reason }, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            await fetchVolunteers()
        } catch (err: any) {
            console.error('Error rejecting volunteer:', err)
            alert(`Failed to reject volunteer: ${err.response?.data?.message || err.message}`)
        } finally {
            setActionLoading(null)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this volunteer?')) return
        setActionLoading(id)
        try {
            await axios.delete(`${API_URL}/volunteers/${id}`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            await fetchVolunteers()
        } catch (err: any) {
            console.error('Error deleting volunteer:', err)
            alert(`Failed to delete volunteer: ${err.response?.data?.message || err.message}`)
        } finally {
            setActionLoading(null)
        }
    }

    const filteredVolunteers = selectedFilter
        ? volunteers.filter(v => {
            if (selectedFilter === 'pending') return v.verificationStatus === 'pending'
            if (selectedFilter === 'verified') return v.verificationStatus === 'verified'
            if (selectedFilter === 'available') return v.status === 'available' && v.verificationStatus === 'verified'
            return true
        })
        : volunteers

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'available': return 'bg-green-500 text-white'
            case 'busy': return 'bg-yellow-500 text-black'
            case 'on_mission': return 'bg-blue-500 text-white'
            case 'offline': return 'bg-gray-500 text-white'
            default: return 'bg-gray-500 text-white'
        }
    }

    const getVerificationColor = (status: string) => {
        switch (status) {
            case 'verified': return 'bg-green-100 text-green-700 border-green-500'
            case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-500'
            case 'rejected': return 'bg-red-100 text-red-700 border-red-500'
            default: return 'bg-gray-100 text-gray-700 border-gray-500'
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black"></div>
            </div>
        )
    }

    const pendingVolunteers = volunteers.filter(v => v.verificationStatus === 'pending')

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-tight">Volunteers</h1>
                    <p className="text-muted-foreground">Manage government volunteers & responders</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border-2 border-red-500 text-red-700 p-4 font-bold">
                    {error}
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div
                    onClick={() => setSelectedFilter(null)}
                    className={`border-2 border-black p-6 cursor-pointer transition-colors ${!selectedFilter ? 'bg-secondary' : 'hover:bg-secondary'}`}
                >
                    <div className="text-4xl font-black">{stats.total}</div>
                    <div className="text-sm font-medium uppercase tracking-wide">Total</div>
                </div>
                <div
                    onClick={() => setSelectedFilter('pending')}
                    className={`border-2 border-black p-6 cursor-pointer transition-colors ${selectedFilter === 'pending' ? 'bg-yellow-100' : 'bg-yellow-50 hover:bg-yellow-100'}`}
                >
                    <div className="text-4xl font-black text-yellow-600">{stats.pending}</div>
                    <div className="text-sm font-medium uppercase tracking-wide">Pending Approval</div>
                </div>
                <div
                    onClick={() => setSelectedFilter('verified')}
                    className={`border-2 border-black p-6 cursor-pointer transition-colors ${selectedFilter === 'verified' ? 'bg-green-100' : 'bg-green-50 hover:bg-green-100'}`}
                >
                    <div className="text-4xl font-black text-green-600">{stats.verified}</div>
                    <div className="text-sm font-medium uppercase tracking-wide">Verified</div>
                </div>
                <div
                    onClick={() => setSelectedFilter('available')}
                    className={`border-2 border-black p-6 cursor-pointer transition-colors ${selectedFilter === 'available' ? 'bg-blue-100' : 'bg-blue-50 hover:bg-blue-100'}`}
                >
                    <div className="text-4xl font-black text-blue-600">{stats.available}</div>
                    <div className="text-sm font-medium uppercase tracking-wide">Available Now</div>
                </div>
            </div>

            {/* Pending Approvals Section */}
            {pendingVolunteers.length > 0 && (
                <div className="border-2 border-yellow-500 bg-yellow-50 p-4">
                    <h2 className="font-bold text-lg uppercase mb-4 text-yellow-700">
                        ⏳ Pending Approvals ({pendingVolunteers.length})
                    </h2>
                    <div className="space-y-3">
                        {pendingVolunteers.map(volunteer => (
                            <div key={volunteer._id} className="bg-white border-2 border-black p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xl font-bold">
                                                {volunteer.userId?.name || 'Unknown'}
                                            </span>
                                            {volunteer.governmentId && (
                                                <span className="px-3 py-1 bg-blue-100 text-blue-700 font-mono font-bold text-sm border border-blue-300">
                                                    ID: {volunteer.governmentId}
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">Phone: </span>
                                                <span className="font-medium">{volunteer.userId?.phone || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Email: </span>
                                                <span className="font-medium">{volunteer.userId?.email || 'N/A'}</span>
                                            </div>
                                        </div>
                                        {volunteer.skills && volunteer.skills.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {volunteer.skills.map(skill => (
                                                    <span key={skill} className="text-xs bg-gray-200 px-2 py-0.5 uppercase">
                                                        {skill}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprove(volunteer._id)}
                                            disabled={actionLoading === volunteer._id}
                                            className="bg-green-500 text-white px-6 py-2 font-bold uppercase hover:bg-green-600 disabled:opacity-50"
                                        >
                                            {actionLoading === volunteer._id ? '...' : 'Approve'}
                                        </button>
                                        <button
                                            onClick={() => handleReject(volunteer._id)}
                                            disabled={actionLoading === volunteer._id}
                                            className="bg-red-500 text-white px-6 py-2 font-bold uppercase hover:bg-red-600 disabled:opacity-50"
                                        >
                                            {actionLoading === volunteer._id ? '...' : 'Reject'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Volunteers Grid */}
            {filteredVolunteers.filter(v => v.verificationStatus !== 'pending').length === 0 ? (
                <div className="border-2 border-black p-12 text-center">
                    <p className="text-xl font-bold uppercase">No Verified Volunteers</p>
                    <p className="text-muted-foreground mt-2">Volunteers register through the mobile app</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-4">
                    {filteredVolunteers.filter(v => v.verificationStatus !== 'pending').map(volunteer => (
                        <div key={volunteer._id} className="border-2 border-black bg-white">
                            <div className="flex items-center justify-between px-4 py-2 border-b-2 border-black bg-gray-50">
                                <span className={`px-2 py-1 text-xs font-bold uppercase ${getStatusColor(volunteer.status)}`}>
                                    {volunteer.status.replace('_', ' ')}
                                </span>
                                <span className={`px-2 py-1 text-xs font-bold uppercase border ${getVerificationColor(volunteer.verificationStatus)}`}>
                                    {volunteer.verificationStatus}
                                </span>
                            </div>
                            <div className="p-4 space-y-3">
                                <div>
                                    <h3 className="font-bold text-lg">{volunteer.userId?.name || 'Unknown User'}</h3>
                                    {volunteer.governmentId && (
                                        <p className="text-sm font-mono bg-blue-50 text-blue-700 px-2 py-1 inline-block mt-1">
                                            ID: {volunteer.governmentId}
                                        </p>
                                    )}
                                    <p className="text-sm text-muted-foreground mt-1">{volunteer.userId?.phone}</p>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                                    <div className="border border-black p-2">
                                        <div className="text-lg font-bold">{volunteer.stats?.totalMissions || 0}</div>
                                        <div className="text-xs text-muted-foreground uppercase">Missions</div>
                                    </div>
                                    <div className="border border-black p-2">
                                        <div className="text-lg font-bold">{volunteer.stats?.completed || 0}</div>
                                        <div className="text-xs text-muted-foreground uppercase">Done</div>
                                    </div>
                                    <div className="border border-black p-2">
                                        <div className="text-lg font-bold">{volunteer.stats?.averageRating?.toFixed(1) || '-'}</div>
                                        <div className="text-xs text-muted-foreground uppercase">Rating</div>
                                    </div>
                                </div>

                                {volunteer.skills && volunteer.skills.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {volunteer.skills.slice(0, 3).map(skill => (
                                            <span key={skill} className="text-xs bg-gray-200 px-2 py-1 uppercase">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    {volunteer.verificationStatus === 'verified' && (
                                        <button
                                            onClick={() => handleReject(volunteer._id)}
                                            disabled={actionLoading === volunteer._id}
                                            className="flex-1 border-2 border-black px-3 py-2 font-medium hover:bg-yellow-100 text-yellow-600 disabled:opacity-50"
                                        >
                                            Suspend
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(volunteer._id)}
                                        disabled={actionLoading === volunteer._id}
                                        className="flex-1 border-2 border-black px-3 py-2 font-medium hover:bg-red-100 text-red-600 disabled:opacity-50"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
