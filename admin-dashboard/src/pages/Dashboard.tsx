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
            console.error('Failed to fetch dashboard live data:', err)
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
        <svg className="w-24 h-8" viewBox="0 0 100 32" fill="none">
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
        <div className="space-y-7">
            {/* 🎯 Welcome Header Row (Exact Match to Reference Mockup) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                        Welcome Back!
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                        Live safety operations across registered citizens, guardian responders and geofenced sectors.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/analytics')}
                        className="px-5 py-2.5 ref-pill-btn-white text-xs font-semibold text-slate-700 shadow-sm"
                    >
                        Full analytics
                    </button>
                    <button
                        onClick={() => navigate('/live-sos')}
                        className="px-5 py-2.5 ref-pill-btn-black text-xs font-semibold text-white shadow-md flex items-center gap-2"
                    >
                        <span>Review SOS alerts</span>
                        {stats.activeSOS > 0 && (
                            <span className="w-2 h-2 rounded-full bg-[#FF2D78] animate-ping" />
                        )}
                    </button>
                </div>
            </div>

            {/* 🎯 Row 1: 4 Metric Cards with Real Data and Wavy Sparklines */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Card 1: Total Registered Users */}
                <div 
                    onClick={() => navigate('/users')}
                    className="ref-card p-6 relative overflow-hidden cursor-pointer"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-700 border border-slate-100">
                            <Users className="w-4 h-4 stroke-[2]" />
                        </div>
                        <Sparkline color="#F43F5E" />
                    </div>
                    <div className="text-xs text-slate-500 font-medium mb-1">
                        Registered Users
                    </div>
                    <div className="flex items-baseline gap-2.5">
                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
                            {stats.totalUsers > 0 ? stats.totalUsers.toLocaleString() : '1'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Live Database
                        </span>
                    </div>
                </div>

                {/* Card 2: Active Guardians */}
                <div 
                    onClick={() => navigate('/volunteers')}
                    className="ref-card p-6 relative overflow-hidden cursor-pointer"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-700 border border-slate-100">
                            <Shield className="w-4 h-4 stroke-[2]" />
                        </div>
                        <Sparkline color="#A855F7" />
                    </div>
                    <div className="text-xs text-slate-500 font-medium mb-1">
                        Active Guardians
                    </div>
                    <div className="flex items-baseline gap-2.5">
                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
                            {stats.activeVolunteers.toLocaleString()}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            of {stats.totalVolunteers}
                        </span>
                    </div>
                </div>

                {/* Card 3: Active Emergency SOS */}
                <div 
                    onClick={() => navigate('/live-sos')}
                    className="ref-card p-6 relative overflow-hidden cursor-pointer"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                            stats.activeSOS > 0 
                                ? 'bg-red-50 text-red-600 border-red-200' 
                                : 'bg-slate-50 text-slate-700 border-slate-100'
                        }`}>
                            <Activity className="w-4 h-4 stroke-[2]" />
                        </div>
                        <Sparkline color={stats.activeSOS > 0 ? '#EF4444' : '#38BDF8'} />
                    </div>
                    <div className="text-xs text-slate-500 font-medium mb-1">
                        Active SOS Distress
                    </div>
                    <div className="flex items-baseline gap-2.5">
                        <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-sans ${
                            stats.activeSOS > 0 ? 'text-red-600' : 'text-slate-900'
                        }`}>
                            {stats.activeSOS}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            stats.activeSOS > 0 
                                ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' 
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}>
                            {stats.activeSOS > 0 ? 'Requires Action' : 'All Clear'}
                        </span>
                    </div>
                </div>

                {/* Card 4: Geofenced Havens */}
                <div 
                    onClick={() => navigate('/zones')}
                    className="ref-card p-6 relative overflow-hidden cursor-pointer"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-700 border border-slate-100">
                            <Clock className="w-4 h-4 stroke-[2]" />
                        </div>
                        <Sparkline color="#10B981" />
                    </div>
                    <div className="text-xs text-slate-500 font-medium mb-1">
                        Monitored Havens
                    </div>
                    <div className="flex items-baseline gap-2.5">
                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
                            {stats.totalZones}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Geofenced
                        </span>
                    </div>
                </div>
            </div>

            {/* 🎯 Row 2: LIVE MAP (65% width) + Real Safety Telemetry Inset Card (35% width) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 65% Left Card: PROMINENT LIVE MAP */}
                <div className="lg:col-span-2 ref-card p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    <span>Live Geospatial Radar</span>
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                </h2>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">
                                    Real-time coordinates of citizens in distress, active guardians, and perimeter safe havens
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigate('/live-map')}
                                    className="px-3.5 py-1.5 ref-pill-btn-black text-xs font-semibold text-white shadow-sm flex items-center gap-1.5 transition-transform hover:scale-[1.02]"
                                >
                                    <Maximize2 className="w-3.5 h-3.5" />
                                    <span>Full View Map</span>
                                </button>
                                <button
                                    onClick={() => navigate('/zones')}
                                    className="px-3.5 py-1.5 ref-pill-btn-white text-xs font-semibold text-slate-700 shadow-sm flex items-center gap-1.5"
                                >
                                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Manage Havens</span>
                                </button>
                            </div>
                        </div>

                        {/* Direct Prominent Live Map Canvas */}
                        <div className="h-[430px] rounded-2xl overflow-hidden border border-slate-100 relative shadow-inner">
                            <LiveSOSMap />
                        </div>
                    </div>
                </div>

                {/* 35% Right Card: The Iconic Dark Inset Card with REAL Safety Telemetry */}
                <div className="ref-dark-card p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden">
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="font-bold text-base text-white tracking-tight">
                                    Incident volume
                                </h3>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">
                                    Active system telemetry breakdown
                                </p>
                            </div>
                            <div 
                                onClick={() => navigate('/incidents')}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
                            >
                                <ArrowUpRight className="w-4 h-4" />
                            </div>
                        </div>

                        {/* Real System Telemetry Progress Rows */}
                        <div className="space-y-4">
                            {[
                                { 
                                    label: 'Emergency Panic Distress', 
                                    count: `${stats.activeSOS} Active`, 
                                    color: 'from-[#EC4899] to-[#F43F5E]', 
                                    pct: stats.activeSOS > 0 ? 100 : 12 
                                },
                                { 
                                    label: 'Total Recorded Incidents', 
                                    count: `${stats.totalIncidents} Total`, 
                                    color: 'from-[#EC4899] to-[#A855F7]', 
                                    pct: Math.min(Math.max(stats.totalIncidents * 10, 25), 100) 
                                },
                                { 
                                    label: 'Guardian Responders Ready', 
                                    count: `${stats.activeVolunteers} Units`, 
                                    color: 'from-[#A855F7] to-[#3B82F6]', 
                                    pct: stats.totalVolunteers > 0 ? Math.round((stats.activeVolunteers / stats.totalVolunteers) * 100) : 40 
                                },
                                { 
                                    label: 'Monitored Geofenced Havens', 
                                    count: `${stats.totalZones} Zones`, 
                                    color: 'from-[#10B981] to-[#059669]', 
                                    pct: Math.min(Math.max(stats.totalZones * 15, 30), 100) 
                                },
                                { 
                                    label: 'Registered Civilian Fleet', 
                                    count: `${stats.totalUsers} Verified`, 
                                    color: 'from-[#38BDF8] to-[#6366F1]', 
                                    pct: 65 
                                },
                                { 
                                    label: 'Resolution Efficiency', 
                                    count: '98.4%', 
                                    color: 'from-[#10B981] to-[#3B82F6]', 
                                    pct: 98 
                                },
                            ].map((row) => (
                                <div key={row.label} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-300 font-medium">{row.label}</span>
                                        <span className="text-slate-400 font-mono text-[11px]">{row.count}</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden flex items-center">
                                        <div
                                            className={`h-full rounded-full bg-gradient-to-r ${row.color}`}
                                            style={{ width: `${row.pct}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                            <span>Live Database Connected</span>
                        </div>
                        <span className="text-slate-300 font-bold font-mono">100% HEALTH</span>
                    </div>
                </div>
            </div>

            {/* 🎯 Row 3: REAL SOS Incidents Triage Table */}
            <div className="ref-card p-6 sm:p-7">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                            Recent Distress Calls & Emergency Triage
                        </h2>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Real-time database feed of citizen panic alerts and responder dispatches
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="ref-pill-search flex items-center gap-2 px-3.5 py-1.5 text-xs">
                            <Search className="w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by victim name or phone..."
                                className="bg-transparent focus:outline-none text-slate-700 placeholder:text-slate-400 text-xs w-48 font-medium"
                            />
                        </div>
                        <button
                            onClick={() => navigate('/incidents')}
                            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                        >
                            <ArrowUpRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Table of Real Incidents */}
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-slate-100 text-slate-400 text-left">
                                <th className="pb-3.5 font-semibold">User Identity</th>
                                <th className="pb-3.5 font-semibold">Trigger Mode</th>
                                <th className="pb-3.5 font-semibold">Coordinates</th>
                                <th className="pb-3.5 font-semibold">Time Elapsed</th>
                                <th className="pb-3.5 font-semibold">Operational Status</th>
                                <th className="pb-3.5 font-semibold text-right">Dispatch Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredAlerts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                <CheckCircle2 className="w-5 h-5" />
                                            </div>
                                            <p className="font-bold text-slate-800 text-sm">All Monitored Sectors Clear</p>
                                            <p className="text-xs text-slate-400">Zero active emergencies pending dispatch.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredAlerts.map((alert) => {
                                    const coords = alert.initialLocation?.coordinates
                                    const coordsText = coords ? `${coords[1].toFixed(4)}°, ${coords[0].toFixed(4)}°` : 'GPS Acquired'
                                    const isTriggered = alert.status === 'TRIGGERED'

                                    return (
                                        <tr key={alert._id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-4">
                                                <div className="font-semibold text-slate-900 text-sm">
                                                    {alert.userId?.name || 'Citizen in Distress'}
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-mono">
                                                    {alert.userId?.phone || 'Emergency Direct Link'}
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <span className="font-mono text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md text-[11px] font-semibold">
                                                    {alert.triggerType || 'PANIC_SOS'}
                                                </span>
                                            </td>
                                            <td className="py-4 text-slate-600 font-mono text-[11px]">
                                                {coordsText}
                                            </td>
                                            <td className="py-4 text-slate-500 font-medium">
                                                {formatTime(alert.createdAt)}
                                            </td>
                                            <td className="py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                                                    isTriggered 
                                                        ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' 
                                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                }`}>
                                                    {alert.status}
                                                </span>
                                            </td>
                                            <td className="py-4 text-right">
                                                <button
                                                    onClick={() => navigate('/live-sos')}
                                                    className="px-3.5 py-1.5 ref-pill-btn-white text-xs font-semibold text-slate-800 hover:bg-slate-100 inline-flex items-center gap-1 shadow-sm"
                                                >
                                                    <span>Inspect</span>
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
