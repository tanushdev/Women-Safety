import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

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
    const [error, setError] = useState<string | null>(null)
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
            setError('Failed to load users')
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

    // Stats
    const stats = {
        total: users.length,
        active: users.filter(u => u.status === 'active').length,
        volunteers: users.filter(u => u.role === 'volunteer').length,
        admins: users.filter(u => u.role === 'admin').length,
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-black border-t-transparent animate-spin"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="border-2 border-black bg-red-50 p-6">
                <p className="font-bold text-red-600 mb-4">{error}</p>
                <button
                    onClick={fetchUsers}
                    className="px-4 py-2 bg-black text-white font-bold hover:bg-gray-800"
                >
                    RETRY
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="font-display font-black text-4xl tracking-tighter">USERS</h1>
                    <p className="text-gray-500 font-mono text-sm mt-1">MANAGE ALL REGISTERED USERS</p>
                </div>
                <button
                    onClick={fetchUsers}
                    className="px-6 py-3 bg-black text-white font-bold tracking-wide hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                    ↻ REFRESH
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border-2 border-black p-6 bg-white">
                    <div className="font-display font-black text-4xl">{stats.total}</div>
                    <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">TOTAL USERS</div>
                </div>
                <div className="border-2 border-black p-6 bg-green-50">
                    <div className="font-display font-black text-4xl text-green-600">{stats.active}</div>
                    <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">ACTIVE</div>
                </div>
                <div className="border-2 border-black p-6 bg-blue-50">
                    <div className="font-display font-black text-4xl text-blue-600">{stats.volunteers}</div>
                    <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">VOLUNTEERS</div>
                </div>
                <div className="border-2 border-black p-6 bg-purple-50">
                    <div className="font-display font-black text-4xl text-purple-600">{stats.admins}</div>
                    <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">ADMINS</div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="Search by name, phone, or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-black font-mono focus:ring-0 focus:outline-none"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-4 py-3 border-2 border-black font-mono bg-white focus:ring-0 focus:outline-none"
                >
                    <option value="all">ALL ROLES</option>
                    <option value="user">USERS ONLY</option>
                    <option value="volunteer">VOLUNTEERS ONLY</option>
                    <option value="admin">ADMINS ONLY</option>
                </select>
            </div>

            {/* Users Table */}
            <div className="border-2 border-black bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="px-6 py-4 text-left font-mono text-xs uppercase tracking-wider">USER</th>
                                <th className="px-6 py-4 text-left font-mono text-xs uppercase tracking-wider">PHONE</th>
                                <th className="px-6 py-4 text-left font-mono text-xs uppercase tracking-wider">ROLE</th>
                                <th className="px-6 py-4 text-left font-mono text-xs uppercase tracking-wider">STATUS</th>
                                <th className="px-6 py-4 text-left font-mono text-xs uppercase tracking-wider">LOCATION</th>
                                <th className="px-6 py-4 text-left font-mono text-xs uppercase tracking-wider">JOINED</th>
                                <th className="px-6 py-4 text-right font-mono text-xs uppercase tracking-wider">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center font-mono text-gray-500">
                                        NO USERS FOUND
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-black text-white flex items-center justify-center font-bold">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold">{user.name}</div>
                                                    {user.email && (
                                                        <div className="text-xs text-gray-500 font-mono">{user.email}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-sm bg-gray-100 px-2 py-1 border border-gray-300">
                                                {user.phone}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border-2 ${user.role === 'admin'
                                                ? 'border-red-500 text-red-500 bg-red-50'
                                                : user.role === 'volunteer'
                                                    ? 'border-green-500 text-green-500 bg-green-50'
                                                    : 'border-blue-500 text-blue-500 bg-blue-50'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 text-xs font-bold uppercase ${user.status === 'active'
                                                ? 'bg-green-500 text-white'
                                                : user.status === 'suspended'
                                                    ? 'bg-yellow-500 text-black'
                                                    : 'bg-gray-500 text-white'
                                                }`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs">
                                            {user.lastLocation?.coordinates ? (
                                                <span className="text-green-600">
                                                    📍 {user.lastLocation.coordinates[1].toFixed(2)}°, {user.lastLocation.coordinates[0].toFixed(2)}°
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-gray-500">
                                            {formatDate(user.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDeleteUser(user._id, user.name)}
                                                disabled={actionLoading === user._id || user.role === 'admin'}
                                                className={`px-4 py-2 border-2 font-bold text-xs uppercase tracking-wider transition-colors ${user.role === 'admin'
                                                    ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                                                    : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                                                    }`}
                                                title={user.role === 'admin' ? 'Cannot delete admin users' : 'Delete user'}
                                            >
                                                {actionLoading === user._id ? '...' : 'DELETE'}
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
