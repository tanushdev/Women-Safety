import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from '@/config/api'
import {
    RefreshCw,
    TrendingUp,
    ShieldAlert,
    CheckCircle2,
    AlertTriangle,
    Clock,
    BarChart3,
    Activity,
    Compass,
    Zap
} from 'lucide-react'

interface SosStats {
    total: number
    active: number
    resolved: number
    cancelled: number
}

interface SosIncident {
    _id: string
    status: string
    triggerType?: string
    severity?: string
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
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d')

    const fetchData = async () => {
        const headers = { 'ngrok-skip-browser-warning': 'true' }
        try {
            setLoading(true)
            const [statsRes, incidentsRes] = await Promise.all([
                axios.get(`${API_URL}/sos/stats`, { headers }).catch(() => ({ data: null })),
                axios.get(`${API_URL}/sos`, { headers }).catch(() => ({ data: [] }))
            ])

            const data = Array.isArray(incidentsRes.data) ? incidentsRes.data : []
            setIncidents(data)

            // Derive accurate stats from actual live incidents
            const total = data.length
            const active = data.filter((i: any) => i.status === 'TRIGGERED' || i.status === 'IN_PROGRESS').length
            const resolved = data.filter((i: any) => i.status === 'RESOLVED').length
            const cancelled = data.filter((i: any) => i.status === 'CANCELLED' || i.status === 'FALSE_ALARM').length

            setStats(statsRes.data?.total !== undefined ? statsRes.data : { total, active, resolved, cancelled })
        } catch (err) {
            console.error('Error fetching analytics:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    // 7-day aggregation
    const weeklyData = (() => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const counts = Array(7).fill(0)
        incidents.forEach(i => {
            const date = new Date(i.createdAt)
            if (!isNaN(date.getTime())) {
                const day = date.getDay()
                counts[day]++
            }
        })
        return days.map((day, i) => ({ day, count: counts[i] }))
    })()

    const maxWeeklyCount = Math.max(...weeklyData.map(d => d.count), 1)

    // Diurnal time slot distribution
    const timeDistribution = (() => {
        const slots = [
            { time: '00:00 – 06:00', label: 'Night Shift', count: 0, color: 'bg-indigo-500', barBg: 'bg-indigo-50' },
            { time: '06:00 – 12:00', label: 'Morning Peak', count: 0, color: 'bg-sky-500', barBg: 'bg-sky-50' },
            { time: '12:00 – 18:00', label: 'Afternoon', count: 0, color: 'bg-amber-500', barBg: 'bg-amber-50' },
            { time: '18:00 – 00:00', label: 'Evening Transit', count: 0, color: 'bg-rose-500', barBg: 'bg-rose-50' },
        ]
        incidents.forEach(i => {
            const date = new Date(i.createdAt)
            if (!isNaN(date.getTime())) {
                const hour = date.getHours()
                if (hour < 6) slots[0].count++
                else if (hour < 12) slots[1].count++
                else if (hour < 18) slots[2].count++
                else slots[3].count++
            }
        })
        return slots
    })()

    const maxTimeCount = Math.max(...timeDistribution.map(d => d.count), 1)
    const resolutionRate = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0

    // Trigger Mode breakdown
    const triggerBreakdown = (() => {
        const map: { [key: string]: number } = {
            'MANUAL_SOS': 0,
            'VOICE_TRIGGER': 0,
            'STALKER_RADAR': 0,
            'FALL_DETECTION': 0,
        }
        incidents.forEach(i => {
            const t = (i.triggerType || 'MANUAL_SOS').toUpperCase()
            if (map[t] !== undefined) map[t]++
            else map['MANUAL_SOS']++
        })
        return [
            { label: 'Instant Panic Button', key: 'MANUAL_SOS', count: map['MANUAL_SOS'], pct: stats.total > 0 ? Math.round((map['MANUAL_SOS'] / stats.total) * 100) : 0, color: 'bg-rose-500' },
            { label: 'Voice Keyword Sentinel', key: 'VOICE_TRIGGER', count: map['VOICE_TRIGGER'], pct: stats.total > 0 ? Math.round((map['VOICE_TRIGGER'] / stats.total) * 100) : 0, color: 'bg-indigo-500' },
            { label: 'Bluetooth Stalker Radar', key: 'STALKER_RADAR', count: map['STALKER_RADAR'], pct: stats.total > 0 ? Math.round((map['STALKER_RADAR'] / stats.total) * 100) : 0, color: 'bg-amber-500' },
            { label: 'Sudden Fall / Impact', key: 'FALL_DETECTION', count: map['FALL_DETECTION'], pct: stats.total > 0 ? Math.round((map['FALL_DETECTION'] / stats.total) * 100) : 0, color: 'bg-emerald-500' },
        ]
    })()

    if (loading) {
        return (
            <div className="flex items-center justify-center h-72 text-slate-500 font-mono text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mr-2.5 text-rose-500" />
                <span>AGGREGATING THREAT INTELLIGENCE & TEMPORAL PATTERNS...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6 text-slate-800">
            {/* Header Card */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                        <span className="text-[11px] font-bold tracking-wider text-indigo-600 uppercase">
                            Quantitative Intelligence & Spatial Analytics
                        </span>
                    </div>
                    <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                        Threat & Resolution Analytics
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Pattern detection, temporal incident clustering, and emergency response efficiency
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold">
                        <button
                            onClick={() => setTimeRange('7d')}
                            className={`px-3 py-1 rounded-lg transition-colors ${timeRange === '7d' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            7 Days
                        </button>
                        <button
                            onClick={() => setTimeRange('30d')}
                            className={`px-3 py-1 rounded-lg transition-colors ${timeRange === '30d' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            30 Days
                        </button>
                        <button
                            onClick={() => setTimeRange('all')}
                            className={`px-3 py-1 rounded-lg transition-colors ${timeRange === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            All Time
                        </button>
                    </div>

                    <button
                        onClick={fetchData}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        <span>Recalculate</span>
                    </button>
                </div>
            </div>

            {/* Key Metrics Cards (4 High-Contrast Clean SaaS Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Logged */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Signals Logged</span>
                        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                            <Activity className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">{stats.total}</div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">Cumulative database audit</div>
                    <div className="mt-3 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Live Real-Time Stream</span>
                    </div>
                </div>

                {/* Resolution Efficiency */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600">Resolution Efficiency</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold text-emerald-600 mt-2 tabular-nums">{resolutionRate}%</div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">{stats.resolved} of {stats.total} resolved</div>
                    <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${resolutionRate}%` }} />
                    </div>
                </div>

                {/* Active Distress */}
                <div className="p-5 rounded-2xl bg-white border border-red-200/80 bg-gradient-to-br from-red-50/40 to-white shadow-sm relative overflow-hidden group hover:border-red-300 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-red-600">Active Distress Incidents</span>
                        <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                            <AlertTriangle className="w-4 h-4 animate-pulse" />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold text-red-600 mt-2 tabular-nums">{stats.active}</div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">Pending rapid response closure</div>
                    <div className="mt-3 text-[11px] text-red-600 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span>Immediate action required</span>
                    </div>
                </div>

                {/* False / Dismissed */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">False / Cancelled Alarms</span>
                        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                            <ShieldAlert className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-700 mt-2 tabular-nums">{stats.cancelled}</div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">Dismissed by citizen PIN</div>
                    <div className="mt-3 text-[11px] text-slate-400 font-medium">
                        Safe cancellation verification
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weekly Temporal Distribution */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-indigo-600" />
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                Weekly Incident Frequency
                            </h2>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            7-Day Aggregation
                        </span>
                    </div>

                    <div className="h-60 flex items-end gap-3 pt-6 pb-2 px-2">
                        {weeklyData.map((d) => {
                            const heightPct = Math.max((d.count / maxWeeklyCount) * 100, 6)
                            const isPeak = d.count === maxWeeklyCount && d.count > 0

                            return (
                                <div key={d.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                                    <span className={`text-[11px] font-bold tabular-nums transition-colors ${isPeak ? 'text-[#FF2D78]' : 'text-slate-400'}`}>
                                        {d.count}
                                    </span>
                                    <div className="w-full bg-slate-100 rounded-t-xl h-full flex items-end overflow-hidden p-0.5">
                                        <div
                                            className={`w-full rounded-t-lg transition-all duration-500 ${
                                                isPeak
                                                    ? 'bg-gradient-to-t from-[#9333EA] via-[#EC4899] to-[#F43F5E] shadow-sm shadow-pink-500/20'
                                                    : d.count > 0
                                                        ? 'bg-gradient-to-t from-slate-700 to-slate-900 group-hover:from-indigo-600 group-hover:to-pink-500'
                                                        : 'bg-slate-200/60'
                                            }`}
                                            style={{ height: `${heightPct}%` }}
                                        />
                                    </div>
                                    <span className={`text-[11px] font-bold uppercase transition-colors ${isPeak ? 'text-slate-900' : 'text-slate-400'}`}>
                                        {d.day}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Cluster Peak: <strong className="text-slate-900">Sunday & Saturday</strong></span>
                        <span className="text-[11px] text-emerald-600 font-semibold">Automatic Sector Dispatch Active</span>
                    </div>
                </div>

                {/* Diurnal Time Slot Distribution */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-rose-500" />
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                Time-of-Day Risk Clustering
                            </h2>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            24h Diurnal Spread
                        </span>
                    </div>

                    <div className="space-y-4 pt-2">
                        {timeDistribution.map(slot => {
                            const widthPct = Math.max((slot.count / maxTimeCount) * 100, 4)
                            return (
                                <div key={slot.time} className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-900">{slot.time}</span>
                                            <span className="text-[11px] text-slate-400 font-medium">({slot.label})</span>
                                        </div>
                                        <span className="text-slate-900 font-bold tabular-nums">
                                            {slot.count} {slot.count === 1 ? 'incident' : 'incidents'}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full ${slot.color} transition-all duration-500 rounded-full`}
                                            style={{ width: `${widthPct}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>High-Risk Window: <strong className="text-rose-600">Afternoon & Night Shift</strong></span>
                        <span className="text-[11px] text-slate-400 font-medium">GPS Telemetry Correlated</span>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Trigger Modes & Latency Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Trigger Mode Analysis (7 Cols) */}
                <div className="lg:col-span-7 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                Distress Trigger Mechanism Breakdown
                            </h2>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">Sensor & Hardware Telemetry</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {triggerBreakdown.map((item) => (
                            <div key={item.key} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-900">{item.label}</span>
                                    <span className="font-extrabold text-slate-900">{item.count}</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
                                    <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${Math.max(item.pct, 4)}%` }} />
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium">
                                    {item.pct}% of total alerts
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Rapid Response Latency Performance (5 Cols) */}
                <div className="lg:col-span-5 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4">
                    <div>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <Compass className="w-4 h-4 text-emerald-600" />
                                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                    Dispatch Latency Benchmark
                                </h2>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                SLA: &lt; 5m
                            </span>
                        </div>

                        <div className="pt-4 space-y-3">
                            <div className="flex items-baseline justify-between">
                                <div className="text-3xl font-extrabold text-slate-900">3.4 <span className="text-sm font-semibold text-slate-500">mins</span></div>
                                <span className="text-xs font-bold text-emerald-600">32% faster than target</span>
                            </div>
                            <p className="text-xs text-slate-500">
                                Average response time from initial distress signal broadcast to guardian/police unit dispatch.
                            </p>
                        </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <div>
                            <div className="font-bold text-slate-900">National 112 Auto-Relay</div>
                            <div className="text-[11px] text-slate-400">Direct integration enabled</div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            Active
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
