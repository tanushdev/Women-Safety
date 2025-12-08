import { useState, useEffect } from 'react'
import { Bell, MapPin, Users, AlertTriangle, Shield, Activity, ArrowUpRight } from 'lucide-react'
import { LiveSOSMap } from '@/components/maps/LiveSOSMap'
import { useNavigate } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

interface SOS {
    _id: string
    userId: { name: string; phone: string } | null
    status: string
    createdAt: string
    initialLocation?: { coordinates: [number, number] }
}

interface Stats {
    activeSOS: number
    totalIncidents: number
    totalVolunteers: number
    activeVolunteers: number
    totalZones: number
}

export function Dashboard() {
    const navigate = useNavigate()
    const [stats, setStats] = useState<Stats>({
        activeSOS: 0,
        totalIncidents: 0,
        totalVolunteers: 0,
        activeVolunteers: 0,
        totalZones: 0
    })
    const [recentAlerts, setRecentAlerts] = useState<SOS[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            // Header to bypass ngrok's browser warning page
            const headers = { 'ngrok-skip-browser-warning': 'true' }

            try {
                // Fetch SOS stats
                const sosRes = await fetch(`${API_URL}/sos/stats`, { headers })
                const sosData = sosRes.ok ? await sosRes.json() : null

                // Fetch volunteer stats
                const volRes = await fetch(`${API_URL}/volunteers/stats`, { headers })
                const volData = volRes.ok ? await volRes.json() : null

                // Fetch zone stats
                const zoneRes = await fetch(`${API_URL}/zones/stats`, { headers })
                const zoneData = zoneRes.ok ? await zoneRes.json() : null

                // Fetch recent SOS events
                const recentRes = await fetch(`${API_URL}/sos?limit=5`, { headers })
                const recentData = recentRes.ok ? await recentRes.json() : []

                setStats({
                    activeSOS: sosData?.active || 0,
                    totalIncidents: sosData?.total || 0,
                    totalVolunteers: volData?.total || 0,
                    activeVolunteers: volData?.available || 0,
                    totalZones: zoneData?.total || 0
                })

                setRecentAlerts(recentData.slice(0, 5))
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
        const interval = setInterval(fetchData, 15000) // Refresh every 15s
        return () => clearInterval(interval)
    }, [])

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

        if (diff < 60) return 'JUST NOW'
        if (diff < 3600) return `${Math.floor(diff / 60)} MINS AGO`
        if (diff < 86400) return `${Math.floor(diff / 3600)} HOURS AGO`
        return `${Math.floor(diff / 86400)} DAYS AGO`
    }

    const statsCards = [
        {
            title: 'ACTIVE SOS',
            value: String(stats.activeSOS).padStart(2, '0'),
            icon: AlertTriangle,
            trend: 'LIVE',
            alert: stats.activeSOS > 0,
        },
        {
            title: 'INCIDENTS',
            value: String(stats.totalIncidents),
            icon: Activity,
            trend: 'TOTAL',
            alert: false,
        },
        {
            title: 'VOLUNTEERS',
            value: String(stats.totalVolunteers),
            icon: Users,
            trend: `${stats.activeVolunteers} ONLINE`,
            alert: false,
        },
        {
            title: 'ZONES',
            value: String(stats.totalZones),
            icon: Shield,
            trend: 'CONFIGURED',
            alert: false,
        },
    ]

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-end justify-between border-b-2 border-black pb-6">
                <div>
                    <h1 className="text-5xl font-display font-black tracking-tighter uppercase leading-none">
                        Mission<br />Control
                    </h1>
                    <p className="text-sm font-mono mt-2 tracking-widest uppercase">
                        // System Status: {loading ? 'Loading...' : 'Online'}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/incidents')}
                    className="group flex items-center gap-3 px-6 py-3 bg-black text-white hover:bg-white hover:text-black border-2 border-black transition-all shadow-brutal hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                >
                    <Bell className="w-5 h-5" />
                    <span className="font-bold tracking-wide">INCIDENTS</span>
                    {stats.activeSOS > 0 && (
                        <span className="flex items-center justify-center w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-none group-hover:bg-black group-hover:text-white animate-pulse">
                            {stats.activeSOS}
                        </span>
                    )}
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsCards.map((stat) => {
                    const Icon = stat.icon
                    return (
                        <div key={stat.title} className="relative group">
                            <div className="absolute inset-0 bg-black translate-x-2 translate-y-2 transition-transform group-hover:translate-x-1 group-hover:translate-y-1"></div>
                            <div className={`relative h-full bg-white border-2 border-black p-6 flex flex-col justify-between transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1 ${stat.alert ? 'bg-red-50' : ''}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-bold text-sm tracking-widest uppercase">{stat.title}</h3>
                                    <Icon className={`w-6 h-6 ${stat.alert ? 'text-red-600 animate-pulse' : 'text-black'}`} />
                                </div>
                                <div>
                                    <div className="text-5xl font-black tracking-tighter mb-2">{stat.value}</div>
                                    <div className="flex items-center gap-2 font-mono text-xs border-t border-black pt-2 mt-2">
                                        <ArrowUpRight className="w-3 h-3" />
                                        {stat.trend}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Live Map */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                            <MapPin className="w-6 h-6 stroke-[3]" />
                            Live Surveillance
                        </h2>
                        <div className="flex gap-2">
                            <div className="w-3 h-3 bg-red-500 animate-pulse"></div>
                            <span className="text-xs font-mono font-bold">LIVE FEED ACTIVE</span>
                        </div>
                    </div>

                    <div className="border-2 border-black p-1 bg-white shadow-brutal">
                        <div className="h-[500px] border border-black relative">
                            {/* Technical markings */}
                            <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-black z-10"></div>
                            <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-black z-10"></div>
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-black z-10"></div>
                            <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-black z-10"></div>
                            <div className="absolute top-1/2 left-0 w-2 h-[1px] bg-black z-10"></div>
                            <div className="absolute top-1/2 right-0 w-2 h-[1px] bg-black z-10"></div>
                            <div className="absolute top-0 left-1/2 w-[1px] h-2 bg-black z-10"></div>
                            <div className="absolute bottom-0 left-1/2 w-[1px] h-2 bg-black z-10"></div>

                            <LiveSOSMap />
                        </div>
                    </div>
                </div>

                {/* Recent Alerts */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6 stroke-[3]" />
                        Active SOS Incidents
                    </h2>

                    <div className="bg-white border-2 border-black shadow-brutal h-full">
                        <div className="divide-y-2 divide-black">
                            {recentAlerts.length === 0 ? (
                                <div className="p-8 text-center">
                                    <p className="font-bold text-gray-500 uppercase">No active incidents</p>
                                    <p className="text-sm text-gray-400 mt-2">All clear!</p>
                                </div>
                            ) : (
                                recentAlerts.map((alert) => (
                                    <div
                                        key={alert._id}
                                        className="p-5 hover:bg-yellow-50 transition-colors group cursor-pointer"
                                        onClick={() => navigate('/incidents')}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-black text-lg uppercase tracking-tight group-hover:underline decoration-2 underline-offset-2">
                                                {alert.userId?.name || 'Unknown User'}
                                            </h4>
                                            <span className={`font-mono text-xs font-bold px-2 py-1 border border-black ${alert.status === 'TRIGGERED' ? 'bg-red-600 text-white animate-pulse' :
                                                alert.status === 'IN_PROGRESS' ? 'bg-orange-500 text-white' :
                                                    alert.status === 'RESOLVED' ? 'bg-green-500 text-white' :
                                                        'bg-gray-500 text-white'
                                                }`}>
                                                {alert.status}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm font-bold mb-3">
                                            <MapPin className="w-4 h-4" />
                                            <span className="uppercase font-mono text-xs">
                                                {alert.initialLocation?.coordinates
                                                    ? `${alert.initialLocation.coordinates[1].toFixed(4)}, ${alert.initialLocation.coordinates[0].toFixed(4)}`
                                                    : 'Location N/A'
                                                }
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center text-xs font-mono border-t border-dashed border-gray-400 pt-3 mt-2">
                                            <span>{formatTime(alert.createdAt)}</span>
                                            <span className="font-bold">
                                                📞 {alert.userId?.phone || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div
                            onClick={() => navigate('/incidents')}
                            className="p-4 bg-black text-white text-center font-bold uppercase text-sm hover:bg-gray-900 cursor-pointer transition-colors"
                        >
                            View All Incidents →
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
