import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from '@/config/api'
import { Search, RefreshCw, Trash2 } from 'lucide-react'

interface User {
    _id: string
    name: string
    phone: string
    email?: string
    role: 'user' | 'volunteer' | 'admin'
    status: 'active' | 'inactive' | 'suspended' | 'deleted'
    age?: number
    lastLocation?: {
        coordinates: [number, number]
    }
    lastLocationUpdate?: string
    createdAt: string
}

export function Users() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [roleFilter, setRoleFilter] = useState<string>('all')
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const fetchUsers = async () => {
        try {
            setLoading(true)
            const res = await axios.get(`${API_URL}/users`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            const data = Array.isArray(res.data) ? res.data : []
            setUsers(data)
            setError(null)
        } catch (err) {
            console.error('Error fetching users:', err)
            setError('Failed to query user registry')
            setUsers([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    const handleDeleteUser = async (userId: string, userName: string) => {
        if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
            return
        }

        setActionLoading(userId)
        try {
            await axios.delete(`${API_URL}/users/${userId}`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            await fetchUsers()
        } catch (err: any) {
            console.error('Error deleting user:', err)
            alert(`Failed to delete user: ${err.response?.data?.message || err.message}`)
        } finally {
            setActionLoading(null)
        }
    }

    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.phone.includes(searchTerm) ||
            (user.email?.toLowerCase().includes(searchTerm.toLowerCase()))

        const matchesRole = roleFilter === 'all' || user.role === roleFilter

        return matchesSearch && matchesRole
    })

    const stats = {
        total: users.length,
        active: users.filter(u => u.status === 'active').length,
        volunteers: users.filter(u => u.role === 'volunteer').length,
        admins: users.filter(u => u.role === 'admin').length,
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500 font-mono text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-slate-700" />
                <span>INDEXING IDENTITY REGISTRY...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="command-panel p-6 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        <span className="text-[10px] font-mono font-semibold tracking-wider text-blue-600 uppercase">
                            Identity & Access Registry
                        </span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase font-mono">
                        User Directory
                    </h1>
                    <p className="text-xs text-slate-500 font-mono">Registered civilians, emergency responders, and command dispatchers</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchUsers}
                        className="command-button-secondary px-3.5 py-2 rounded-lg text-xs font-mono flex items-center gap-2"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        <span>SYNC</span>
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
                <div className="command-card p-4 rounded-xl border border-slate-200">
                    <div className="text-2xl font-bold text-slate-900 tabular-nums">{stats.total}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Total Users</div>
                </div>
                <div className="command-card p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                    <div className="text-2xl font-bold text-emerald-600 tabular-nums">{stats.active}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Active Accounts</div>
                </div>
                <div className="command-card p-4 rounded-xl border border-blue-200 bg-blue-50/40">
                    <div className="text-2xl font-bold text-blue-600 tabular-nums">{stats.volunteers}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Guardian Units</div>
                </div>
                <div className="command-card p-4 rounded-xl border border-purple-200 bg-purple-50/40">
                    <div className="text-2xl font-bold text-purple-600 tabular-nums">{stats.admins}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Dispatch Admins</div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3 font-mono">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search by name, phone, or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 shadow-sm"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none shadow-sm"
                >
                    <option value="all">ALL ROLES</option>
                    <option value="user">CIVILIANS ONLY</option>
                    <option value="volunteer">GUARDIANS ONLY</option>
                    <option value="admin">ADMINS ONLY</option>
                </select>
            </div>

            {/* Users Table */}
            <div className="command-panel rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-left">
                                <th className="p-3.5 uppercase font-semibold">User Identity</th>
                                <th className="p-3.5 uppercase font-semibold">Contact</th>
                                <th className="p-3.5 uppercase font-semibold">Role</th>
                                <th className="p-3.5 uppercase font-semibold">Account Status</th>
                                <th className="p-3.5 uppercase font-semibold">Coordinates</th>
                                <th className="p-3.5 uppercase font-semibold">Registered</th>
                                <th className="p-3.5 uppercase font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-10 text-center text-slate-400">
                                        No users matched the criteria
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3.5">
                                            <div className="font-semibold text-slate-900">{user.name}</div>
                                            {user.email && <div className="text-[11px] text-slate-500">{user.email}</div>}
                                        </td>
                                        <td className="p-3.5 text-slate-600">{user.phone}</td>
                                        <td className="p-3.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                user.role === 'admin' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                                user.role === 'volunteer' ? 'tactical-badge-blue' :
                                                'bg-slate-100 text-slate-700 border border-slate-200'
                                            }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="p-3.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                user.status === 'active' ? 'tactical-badge-green' : 'tactical-badge-amber'
                                            }`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-slate-500 text-[11px]">
                                            {user.lastLocation?.coordinates ? (
                                                <span className="text-emerald-600 font-semibold">
                                                    {user.lastLocation.coordinates[1].toFixed(2)}°, {user.lastLocation.coordinates[0].toFixed(2)}°
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">—</span>
                                            )}
                                        </td>
                                        <td className="p-3.5 text-slate-500">{formatDate(user.createdAt)}</td>
                                        <td className="p-3.5 text-right">
                                            <button
                                                onClick={() => handleDeleteUser(user._id, user.name)}
                                                disabled={actionLoading === user._id || user.role === 'admin'}
                                                className={`p-1.5 rounded transition-colors ${
                                                    user.role === 'admin'
                                                        ? 'text-slate-300 cursor-not-allowed'
                                                        : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                                }`}
                                                title={user.role === 'admin' ? 'Cannot remove administrators' : 'Delete user'}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
