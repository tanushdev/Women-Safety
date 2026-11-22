import { useState, useEffect } from 'react'
import {
    Users,
    Shield,
    Activity,
    Clock,
    ArrowUpRight,
    Search,
    Radio,
    ChevronRight,
    MapPin,
    CheckCircle2,
    Maximize2
} from 'lucide-react'
import { LiveSOSMap } from '@/components/maps/LiveSOSMap'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '@/config/api'

interface SOS {
    _id: string
    userId: { name: string; phone: string } | null
    status: string
    triggerType?: string
    createdAt: string
    initialLocation?: { coordinates: [number, number] }
}

interface Stats {
    activeSOS: number
    totalIncidents: number
    totalVolunteers: number
    activeVolunteers: number
    totalZones: number
    totalUsers: number
}

export function Dashboard() {
    const navigate = useNavigate()
    const [stats, setStats] = useState<Stats>({
        activeSOS: 0,
        totalIncidents: 0,
        totalVolunteers: 0,
        activeVolunteers: 0,
        totalZones: 0,
        totalUsers: 0
    })
    const [recentAlerts, setRecentAlerts] = useState<SOS[]>([])
    const [searchTerm, setSearchTerm] = useState('')

    const fetchData = async () => {
        const headers = { 'ngrok-skip-browser-warning': 'true' }
        try {
            const [sosRes, volRes, zoneRes, recentRes, usersRes] = await Promise.all([
                fetch(`${API_URL}/sos/stats`, { headers }).then(r => r.ok ? r.json() : null),
                fetch(`${API_URL}/volunteers/stats`, { headers }).then(r => r.ok ? r.json() : null),
                fetch(`${API_URL}/zones/stats`, { headers }).then(r => r.ok ? r.json() : null),
                fetch(`${API_URL}/sos?limit=8`, { headers }).then(r => r.ok ? r.json() : []),
                fetch(`${API_URL}/users`, { headers }).then(r => r.ok ? r.json() : [])
            ])

            setStats({
                activeSOS: sosRes?.active || 0,
                totalIncidents: sosRes?.total || 0,
                totalVolunteers: volRes?.total || 0,
                activeVolunteers: volRes?.available || 0,
                totalZones: zoneRes?.total || 0,
                totalUsers: Array.isArray(usersRes) ? usersRes.length : 0
            })

            setRecentAlerts(Array.isArray(recentRes) ? recentRes : [])
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err)
        }
    }

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => clearInterval(interval)
    }, [])

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

        if (diff < 60) return 'Just now'
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
        return `${Math.floor(diff / 86400)}d ago`
    }

    const filteredAlerts = recentAlerts.filter(a => {
        if (!searchTerm) return true
        const name = (a.userId?.name || '').toLowerCase()
        const phone = a.userId?.phone || ''
        return name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm)
    })

    const Sparkline = ({ color = '#EC4899' }: { color?: string }) => (
        <svg className="w-20 h-6" viewBox="0 0 100 32" fill="none">
            <path
                d="M2 20 C 15 10, 25 26, 40 16 C 55 6, 65 24, 80 12 C 88 6, 92 14, 96 10"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
            />
            <circle cx="96" cy="10" r="3" fill={color} />
        </svg>
    )

    return (
        <div className="space-y-5">
            {/* Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        Overview
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Real-time status of emergency alerts, volunteers, and safe zones.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/analytics')}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
                    >
                        Analytics
                    </button>
                    <button
                        onClick={() => navigate('/live-sos')}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 flex items-center gap-2"
                    >
                        <span>Live SOS</span>
                        {stats.activeSOS > 0 && (
                            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                        )}
                    </button>
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Users */}
                <div 
                    onClick={() => navigate('/users')}
                    className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-slate-300 transition-colors"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-700 border border-slate-100">
                            <Users className="w-3.5 h-3.5" />
                        </div>
                        <Sparkline color="#F43F5E" />
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                        Users
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-bold text-slate-900 tabular-nums">
                            {stats.totalUsers > 0 ? stats.totalUsers.toLocaleString() : '1'}
                        </span>
                        <span className="text-[10px] text-slate-400">registered</span>
                    </div>
                </div>

                {/* Volunteers */}
                <div 
                    onClick={() => navigate('/volunteers')}
                    className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-slate-300 transition-colors"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-700 border border-slate-100">
                            <Shield className="w-3.5 h-3.5" />
                        </div>
                        <Sparkline color="#A855F7" />
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                        Volunteers
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-bold text-slate-900 tabular-nums">
                            {stats.activeVolunteers.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400">of {stats.totalVolunteers} available</span>
                    </div>
                </div>

                {/* Active SOS */}
                <div 
                    onClick={() => navigate('/live-sos')}
                    className={`p-4 rounded-xl border shadow-sm cursor-pointer transition-colors ${
                        stats.activeSOS > 0 
                            ? 'bg-red-50/30 border-red-200 hover:border-red-300' 
                            : 'bg-white border-slate-200/80 hover:border-slate-300'
                    }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                            stats.activeSOS > 0 
                                ? 'bg-red-50 text-red-600 border-red-200' 
                                : 'bg-slate-50 text-slate-700 border-slate-100'
                        }`}>
                            <Activity className="w-3.5 h-3.5" />
                        </div>
                        <Sparkline color={stats.activeSOS > 0 ? '#EF4444' : '#38BDF8'} />
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                        Active SOS
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className={`text-xl font-bold tabular-nums ${
                            stats.activeSOS > 0 ? 'text-red-600' : 'text-slate-900'
                        }`}>
                            {stats.activeSOS}
                        </span>
                        <span className={`text-[10px] font-medium ${
                            stats.activeSOS > 0 ? 'text-red-500' : 'text-emerald-600'
                        }`}>
                            {stats.activeSOS > 0 ? 'Active' : 'All Clear'}
                        </span>
                    </div>
                </div>

                {/* Safe Zones */}
                <div 
                    onClick={() => navigate('/zones')}
                    className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-slate-300 transition-colors"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-700 border border-slate-100">
                            <Clock className="w-3.5 h-3.5" />
                        </div>
                        <Sparkline color="#10B981" />
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                        Safe Zones
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-bold text-slate-900 tabular-nums">
                            {stats.totalZones}
                        </span>
                        <span className="text-[10px] text-slate-400">monitored</span>
                    </div>
                </div>
            </div>

            {/* Row 2: Live Map + Inset Summary Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Live Map Card (2 Cols) */}
                <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <span>Live Map</span>
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Active SOS alerts, volunteers, and safe zones
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigate('/live-map')}
                                    className="px-3 py-1 rounded-xl bg-slate-900 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 flex items-center gap-1.5"
                                >
                                    <Maximize2 className="w-3.5 h-3.5" />
                                    <span>Full View</span>
                                </button>
                                <button
                                    onClick={() => navigate('/zones')}
                                    className="px-3 py-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 shadow-sm flex items-center gap-1.5"
                                >
                                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Safe Zones</span>
                                </button>
                            </div>
                        </div>

                        {/* Direct Live Map Canvas */}
                        <div className="h-[360px] rounded-xl overflow-hidden border border-slate-100 relative">
                            <LiveSOSMap />
                        </div>
                    </div>
                </div>

                {/* Right Summary Card (1 Col) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-sm text-white">
                                    Overview
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Summary of safety metrics
                                </p>
                            </div>
                            <div 
                                onClick={() => navigate('/incidents')}
                                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
                            >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            </div>
                        </div>

                        {/* Progress Rows */}
                        <div className="space-y-3">
                            {[
                                { 
                                    label: 'Active SOS Alerts', 
                                    count: `${stats.activeSOS}`, 
                                    color: 'from-rose-500 to-pink-500', 
                                    pct: stats.activeSOS > 0 ? 100 : 10 
                                },
                                { 
                                    label: 'Total Incidents', 
                                    count: `${stats.totalIncidents}`, 
                                    color: 'from-purple-500 to-indigo-500', 
                                    pct: Math.min(Math.max(stats.totalIncidents * 10, 20), 100) 
                                },
                                { 
                                    label: 'Available Volunteers', 
                                    count: `${stats.activeVolunteers}`, 
                                    color: 'from-blue-500 to-sky-500', 
                                    pct: stats.totalVolunteers > 0 ? Math.round((stats.activeVolunteers / stats.totalVolunteers) * 100) : 40 
                                },
                                { 
                                    label: 'Safe Zones', 
                                    count: `${stats.totalZones}`, 
                                    color: 'from-emerald-500 to-teal-500', 
                                    pct: Math.min(Math.max(stats.totalZones * 15, 25), 100) 
                                },
                                { 
                                    label: 'Registered Users', 
                                    count: `${stats.totalUsers}`, 
                                    color: 'from-sky-500 to-blue-500', 
                                    pct: 60 
                                },
                            ].map((row) => (
                                <div key={row.label} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-300">{row.label}</span>
                                        <span className="text-slate-400 font-mono text-[11px]">{row.count}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex items-center">
                                        <div
                                            className={`h-full rounded-full bg-gradient-to-r ${row.color}`}
                                            style={{ width: `${row.pct}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                            <span>System Status</span>
                        </div>
                        <span className="text-emerald-400 font-semibold text-[11px]">Online</span>
                    </div>
                </div>
            </div>

            {/* Row 3: Recent Alerts Table */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 tracking-tight">
                            Recent Alerts
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Latest SOS calls and emergency requests
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                            <Search className="w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name or phone..."
                                className="bg-transparent focus:outline-none text-slate-700 placeholder:text-slate-400 text-xs w-44"
                            />
                        </div>
                        <button
                            onClick={() => navigate('/incidents')}
                            className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                        >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-slate-100 text-slate-400 text-left">
                                <th className="pb-2.5 font-semibold">User</th>
                                <th className="pb-2.5 font-semibold">Trigger</th>
                                <th className="pb-2.5 font-semibold">Location</th>
                                <th className="pb-2.5 font-semibold">Time</th>
                                <th className="pb-2.5 font-semibold">Status</th>
                                <th className="pb-2.5 font-semibold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredAlerts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-1.5">
                                            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </div>
                                            <p className="font-semibold text-slate-800 text-xs">No active alerts</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredAlerts.map((alert) => {
                                    const coords = alert.initialLocation?.coordinates
                                    const coordsText = coords ? `${coords[1].toFixed(4)}°, ${coords[0].toFixed(4)}°` : 'Location saved'
                                    const isTriggered = alert.status === 'TRIGGERED'

                                    return (
                                        <tr key={alert._id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-3">
                                                <div className="font-semibold text-slate-900 text-xs">
                                                    {alert.userId?.name || 'Citizen'}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    {alert.userId?.phone || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="py-3">
                                                <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">
                                                    {alert.triggerType || 'MANUAL'}
                                                </span>
                                            </td>
                                            <td className="py-3 text-slate-600 font-mono text-[11px]">
                                                {coordsText}
                                            </td>
                                            <td className="py-3 text-slate-500">
                                                {formatTime(alert.createdAt)}
                                            </td>
                                            <td className="py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                                    isTriggered 
                                                        ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' 
                                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                }`}>
                                                    {alert.status}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right">
                                                <button
                                                    onClick={() => navigate('/live-sos')}
                                                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 shadow-sm"
                                                >
                                                    <span>View</span>
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
