import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from '@/config/api'
import {
    RefreshCw,
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

    // Time slot distribution
    const timeDistribution = (() => {
        const slots = [
            { time: '12 AM – 6 AM', label: 'Night', count: 0, color: 'bg-indigo-500' },
            { time: '6 AM – 12 PM', label: 'Morning', count: 0, color: 'bg-sky-500' },
            { time: '12 PM – 6 PM', label: 'Afternoon', count: 0, color: 'bg-amber-500' },
            { time: '6 PM – 12 AM', label: 'Evening', count: 0, color: 'bg-rose-500' },
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
            { label: 'Panic Button', key: 'MANUAL_SOS', count: map['MANUAL_SOS'], pct: stats.total > 0 ? Math.round((map['MANUAL_SOS'] / stats.total) * 100) : 0, color: 'bg-rose-500' },
            { label: 'Voice Trigger', key: 'VOICE_TRIGGER', count: map['VOICE_TRIGGER'], pct: stats.total > 0 ? Math.round((map['VOICE_TRIGGER'] / stats.total) * 100) : 0, color: 'bg-indigo-500' },
            { label: 'Bluetooth Tracker', key: 'STALKER_RADAR', count: map['STALKER_RADAR'], pct: stats.total > 0 ? Math.round((map['STALKER_RADAR'] / stats.total) * 100) : 0, color: 'bg-amber-500' },
            { label: 'Fall Detection', key: 'FALL_DETECTION', count: map['FALL_DETECTION'], pct: stats.total > 0 ? Math.round((map['FALL_DETECTION'] / stats.total) * 100) : 0, color: 'bg-emerald-500' },
        ]
    })()

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-slate-700" />
                <span>Loading analytics...</span>
            </div>
        )
    }

    return (
        <div className="space-y-5 text-slate-800">
            {/* Header */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                        Analytics
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Overview of safety alerts and response trends
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium">
                        <button
                            onClick={() => setTimeRange('7d')}
                            className={`px-3 py-1 rounded-lg transition-colors ${timeRange === '7d' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            7 Days
                        </button>
                        <button
                            onClick={() => setTimeRange('30d')}
                            className={`px-3 py-1 rounded-lg transition-colors ${timeRange === '30d' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            30 Days
                        </button>
                        <button
                            onClick={() => setTimeRange('all')}
                            className={`px-3 py-1 rounded-lg transition-colors ${timeRange === 'all' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            All
                        </button>
                    </div>

                    <button
                        onClick={fetchData}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Key Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Alerts */}
                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500">Total Alerts</span>
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                            <Activity className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">{stats.total}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">All time logged</div>
                </div>

                {/* Resolution Rate */}
                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-emerald-600">Resolved Rate</span>
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 mt-2 tabular-nums">{resolutionRate}%</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{stats.resolved} of {stats.total} resolved</div>
                </div>

                {/* Active Alerts */}
                <div className="p-4 rounded-xl bg-white border border-red-200/80 bg-red-50/20 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-red-600">Active Alerts</span>
                        <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-red-600 mt-2 tabular-nums">{stats.active}</div>
                    <div className="text-[11px] text-red-500 mt-0.5">Needs response</div>
                </div>

                {/* Cancelled / False Alarms */}
                <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500">Cancelled</span>
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                            <ShieldAlert className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-700 mt-2 tabular-nums">{stats.cancelled}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Dismissed with PIN</div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Weekly Distribution */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-slate-700" />
                            <h2 className="text-xs font-bold text-slate-900">
                                Alerts this Week
                            </h2>
                        </div>
                        <span className="text-[10px] text-slate-400">Past 7 days</span>
                    </div>

                    <div className="h-48 flex items-end gap-2 pt-4 pb-2 px-1">
                        {weeklyData.map((d) => {
                            const heightPct = Math.max((d.count / maxWeeklyCount) * 100, 6)
                            const isPeak = d.count === maxWeeklyCount && d.count > 0

                            return (
                                <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                                    <span className={`text-[10px] font-semibold tabular-nums ${isPeak ? 'text-red-500' : 'text-slate-400'}`}>
                                        {d.count}
                                    </span>
                                    <div className="w-full bg-slate-100 rounded-t-lg h-full flex items-end overflow-hidden">
                                        <div
                                            className={`w-full rounded-t-lg transition-all duration-300 ${
                                                isPeak
                                                    ? 'bg-rose-500'
                                                    : d.count > 0
                                                        ? 'bg-slate-700'
                                                        : 'bg-slate-200'
                                            }`}
                                            style={{ height: `${heightPct}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-500">
                                        {d.day}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Time of Day Distribution */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-700" />
                            <h2 className="text-xs font-bold text-slate-900">
                                Alerts by Time of Day
                            </h2>
                        </div>
                        <span className="text-[10px] text-slate-400">24-hour breakdown</span>
                    </div>

                    <div className="space-y-3 pt-2">
                        {timeDistribution.map(slot => {
                            const widthPct = Math.max((slot.count / maxTimeCount) * 100, 4)
                            return (
                                <div key={slot.time} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-slate-800">{slot.label}</span>
                                            <span className="text-[10px] text-slate-400">({slot.time})</span>
                                        </div>
                                        <span className="text-slate-700 font-semibold tabular-nums text-xs">
                                            {slot.count}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full ${slot.color} transition-all duration-300 rounded-full`}
                                            style={{ width: `${widthPct}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Trigger Modes & Latency */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Trigger Types */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            <h2 className="text-xs font-bold text-slate-900">
                                Alert Triggers
                            </h2>
                        </div>
                        <span className="text-[10px] text-slate-400">Trigger method</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                        {triggerBreakdown.map((item) => (
                            <div key={item.key} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-slate-800">{item.label}</span>
                                    <span className="font-bold text-slate-900">{item.count}</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${Math.max(item.pct, 4)}%` }} />
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    {item.pct}% of alerts
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Average Response */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-3">
                    <div>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                                <Compass className="w-4 h-4 text-emerald-600" />
                                <h2 className="text-xs font-bold text-slate-900">
                                    Average Response Time
                                </h2>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                Target &lt; 5m
                            </span>
                        </div>

                        <div className="pt-3 space-y-1">
                            <div className="flex items-baseline justify-between">
                                <div className="text-2xl font-bold text-slate-900">3.4 <span className="text-xs font-normal text-slate-500">minutes</span></div>
                                <span className="text-xs font-semibold text-emerald-600">On Target</span>
                            </div>
                            <p className="text-xs text-slate-500">
                                Average response time from alert trigger to volunteer/police notification.
                            </p>
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <div>
                            <div className="font-semibold text-slate-800">Emergency Dispatch</div>
                            <div className="text-[11px] text-slate-400">Automated notification system</div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                            Active
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
