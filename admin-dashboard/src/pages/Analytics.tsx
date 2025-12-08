import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

interface SosStats {
    total: number
    active: number
    resolved: number
    cancelled: number
}

interface SosIncident {
    _id: string
    status: string
    createdAt: string
    initialLocation?: {
        coordinates: [number, number]
        address?: string
    }
}

export function Analytics() {
    const [stats, setStats] = useState<SosStats>({ total: 0, active: 0, resolved: 0, cancelled: 0 })
    const [incidents, setIncidents] = useState<SosIncident[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            const headers = { 'ngrok-skip-browser-warning': 'true' }
            try {
                const [statsRes, incidentsRes] = await Promise.all([
                    axios.get(`${API_URL}/sos/stats`, { headers }),
                    axios.get(`${API_URL}/sos`, { headers })
                ])
                setStats(statsRes.data || { total: 0, active: 0, resolved: 0, cancelled: 0 })
                const data = Array.isArray(incidentsRes.data) ? incidentsRes.data : []
                setIncidents(data)
            } catch (err) {
                console.error('Error fetching analytics:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    // Calculate real analytics from incidents data
    const incidentsByStatus = [
        { status: 'Triggered', count: incidents.filter(i => i.status === 'TRIGGERED').length, color: 'bg-red-500' },
        { status: 'In Progress', count: incidents.filter(i => i.status === 'IN_PROGRESS').length, color: 'bg-blue-500' },
        { status: 'Resolved', count: incidents.filter(i => i.status === 'RESOLVED').length, color: 'bg-green-500' },
        { status: 'Cancelled', count: incidents.filter(i => i.status === 'CANCELLED').length, color: 'bg-gray-500' },
    ]

    // Group incidents by day of week
    const weeklyData = (() => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const counts = Array(7).fill(0)
        incidents.forEach(i => {
            const day = new Date(i.createdAt).getDay()
            counts[day]++
        })
        return days.map((day, i) => ({ day, count: counts[i] }))
    })()

    const maxWeeklyCount = Math.max(...weeklyData.map(d => d.count), 1)

    // Group by time of day
    const timeDistribution = (() => {
        const slots = [
            { time: '00:00-06:00', count: 0, color: 'bg-indigo-500' },
            { time: '06:00-12:00', count: 0, color: 'bg-yellow-500' },
            { time: '12:00-18:00', count: 0, color: 'bg-orange-500' },
            { time: '18:00-00:00', count: 0, color: 'bg-red-500' },
        ]
        incidents.forEach(i => {
            const hour = new Date(i.createdAt).getHours()
            if (hour < 6) slots[0].count++
            else if (hour < 12) slots[1].count++
            else if (hour < 18) slots[2].count++
            else slots[3].count++
        })
        return slots
    })()

    const resolutionRate = stats.total > 0 ? ((stats.resolved / stats.total) * 100).toFixed(0) : 0

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-xl font-bold">Loading analytics...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-tight">Analytics</h1>
                    <p className="text-muted-foreground">Real-time statistics from database</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-black text-white border-2 border-black px-6 py-2 font-bold uppercase hover:bg-gray-800 transition-colors"
                    >
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-4">
                <div className="border-2 border-black p-6">
                    <div className="text-4xl font-black">{stats.total}</div>
                    <div className="text-sm font-medium uppercase tracking-wide">Total Incidents</div>
                    <div className="text-muted-foreground text-sm mt-2">All time</div>
                </div>
                <div className="border-2 border-black p-6 bg-green-50">
                    <div className="text-4xl font-black text-green-600">{resolutionRate}%</div>
                    <div className="text-sm font-medium uppercase tracking-wide">Resolution Rate</div>
                    <div className="text-muted-foreground text-sm mt-2">{stats.resolved} resolved</div>
                </div>
                <div className="border-2 border-black p-6 bg-red-50">
                    <div className="text-4xl font-black text-red-600">{stats.active}</div>
                    <div className="text-sm font-medium uppercase tracking-wide">Active Incidents</div>
                    <div className="text-muted-foreground text-sm mt-2">Needs attention</div>
                </div>
                <div className="border-2 border-black p-6 bg-gray-50">
                    <div className="text-4xl font-black text-gray-600">{stats.cancelled}</div>
                    <div className="text-sm font-medium uppercase tracking-wide">Cancelled</div>
                    <div className="text-muted-foreground text-sm mt-2">False alarms</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Incidents by Status */}
                <div className="border-2 border-black">
                    <div className="bg-black text-white p-4 border-b-2 border-black">
                        <h2 className="font-bold uppercase">Incidents by Status</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        {incidentsByStatus.map(item => (
                            <div key={item.status} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium">{item.status}</span>
                                    <span className="font-bold">{item.count}</span>
                                </div>
                                <div className="h-4 bg-secondary border border-black">
                                    <div
                                        className={`h-full ${item.color}`}
                                        style={{ width: `${stats.total > 0 ? (item.count / stats.total) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                        {stats.total === 0 && (
                            <div className="text-center text-muted-foreground py-4">
                                No incident data yet. Trigger SOS from mobile app.
                            </div>
                        )}
                    </div>
                </div>

                {/* Weekly Trend */}
                <div className="border-2 border-black">
                    <div className="bg-black text-white p-4 border-b-2 border-black">
                        <h2 className="font-bold uppercase">Weekly Distribution</h2>
                    </div>
                    <div className="p-6">
                        <div className="flex items-end justify-between h-48 gap-2">
                            {weeklyData.map((item) => (
                                <div key={item.day} className="flex-1 flex flex-col items-center gap-2">
                                    <span className="text-xs font-bold">{item.count}</span>
                                    <div
                                        className="w-full bg-black transition-all hover:bg-gray-700"
                                        style={{ height: `${item.count > 0 ? (item.count / maxWeeklyCount) * 100 : 5}%`, minHeight: '4px' }}
                                    />
                                    <span className="text-xs font-medium">{item.day}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Time Distribution */}
                <div className="border-2 border-black">
                    <div className="bg-black text-white p-4 border-b-2 border-black">
                        <h2 className="font-bold uppercase">Time Distribution</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        {timeDistribution.map(item => (
                            <div key={item.time} className="flex items-center gap-4">
                                <span className="w-28 text-sm font-medium">{item.time}</span>
                                <div className="flex-1 h-6 bg-secondary border border-black">
                                    <div
                                        className={`h-full ${item.color} flex items-center justify-end pr-2`}
                                        style={{ width: `${stats.total > 0 ? (item.count / stats.total) * 100 : 0}%` }}
                                    >
                                        {item.count > 0 && <span className="text-white text-xs font-bold">{item.count}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="border-2 border-black">
                    <div className="bg-black text-white p-4 border-b-2 border-black">
                        <h2 className="font-bold uppercase">Quick Stats</h2>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="border-2 border-black p-4 bg-green-50">
                                <div className="text-3xl font-black text-green-600">{stats.resolved}</div>
                                <div className="text-sm font-medium uppercase">Resolved</div>
                            </div>
                            <div className="border-2 border-black p-4 bg-red-50">
                                <div className="text-3xl font-black text-red-600">{stats.active}</div>
                                <div className="text-sm font-medium uppercase">Active</div>
                            </div>
                        </div>

                        <div className="mt-4 p-4 bg-secondary border-2 border-black">
                            <div className="font-bold mb-2">Summary</div>
                            <div className="text-sm space-y-1">
                                <div>• {stats.total} total incidents recorded</div>
                                <div>• {resolutionRate}% resolution rate</div>
                                <div>• {stats.active} requiring attention</div>
                            </div>
                        </div>

                        {incidents.length === 0 && (
                            <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-500 text-yellow-800">
                                <div className="font-bold">No Data Yet</div>
                                <div className="text-sm">Trigger SOS from the mobile app to generate real incident data.</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
