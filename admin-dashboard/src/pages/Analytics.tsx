import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from '@/config/api'
import { RefreshCw } from 'lucide-react'

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

    const fetchData = async () => {
        const headers = { 'ngrok-skip-browser-warning': 'true' }
        try {
            setLoading(true)
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

    useEffect(() => {
        fetchData()
    }, [])



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

    const timeDistribution = (() => {
        const slots = [
            { time: '00:00 – 06:00', label: 'Night Shift', count: 0, color: 'bg-indigo-500' },
            { time: '06:00 – 12:00', label: 'Morning Peak', count: 0, color: 'bg-sky-500' },
            { time: '12:00 – 18:00', label: 'Afternoon', count: 0, color: 'bg-amber-500' },
            { time: '18:00 – 00:00', label: 'Evening Transit', count: 0, color: 'bg-rose-500' },
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

    const maxTimeCount = Math.max(...timeDistribution.map(d => d.count), 1)
    const resolutionRate = stats.total > 0 ? ((stats.resolved / stats.total) * 100).toFixed(0) : 0

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400 font-mono text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-rose-500" />
                <span>AGGREGATING THREAT INTELLIGENCE...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="command-panel p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/[0.08]">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className="text-[10px] font-mono font-semibold tracking-wider text-purple-400 uppercase">
                            Quantitative Intelligence
                        </span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-white uppercase font-mono">
                        Threat & Resolution Analytics
                    </h1>
                    <p className="text-xs text-slate-400 font-mono">Pattern detection, temporal incident clustering, and emergency response latency</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="command-button-secondary px-3.5 py-2 rounded-lg text-xs font-mono flex items-center gap-2"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>RECALCULATE</span>
                    </button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
                <div className="command-card p-5 rounded-xl border border-white/[0.08]">
                    <div className="text-3xl font-bold text-white tabular-nums">{stats.total}</div>
                    <div className="text-xs text-slate-300 font-medium mt-1">Total Signals Logged</div>
                    <div className="text-[10px] text-slate-400 mt-2">Cumulative database audit</div>
                </div>
                <div className="command-card p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03]">
                    <div className="text-3xl font-bold text-emerald-400 tabular-nums">{resolutionRate}%</div>
                    <div className="text-xs text-slate-300 font-medium mt-1">Resolution Efficiency</div>
                    <div className="text-[10px] text-slate-400 mt-2">{stats.resolved} of {stats.total} resolved</div>
                </div>
                <div className="command-card p-5 rounded-xl border border-red-500/20 bg-red-500/[0.03]">
                    <div className="text-3xl font-bold text-rose-400 tabular-nums">{stats.active}</div>
                    <div className="text-xs text-slate-300 font-medium mt-1">Active Distress Incidents</div>
                    <div className="text-[10px] text-slate-400 mt-2">Pending final closure</div>
                </div>
                <div className="command-card p-5 rounded-xl border border-white/[0.08]">
                    <div className="text-3xl font-bold text-slate-300 tabular-nums">{stats.cancelled}</div>
                    <div className="text-xs text-slate-300 font-medium mt-1">False / Cancelled Alarms</div>
                    <div className="text-[10px] text-slate-400 mt-2">Dismissed by user</div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
                {/* Weekly Temporal Distribution */}
                <div className="command-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                            Weekly Incident Frequency
                        </h2>
                        <span className="text-[10px] text-slate-400">7-Day Aggregation</span>
                    </div>

                    <div className="h-56 flex items-end gap-3 pt-6 pb-2">
                        {weeklyData.map((d) => {
                            const heightPct = Math.max((d.count / maxWeeklyCount) * 100, 8)
                            return (
                                <div key={d.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                                    <span className="text-[11px] text-slate-400 tabular-nums">{d.count}</span>
                                    <div 
                                        className="w-full bg-slate-800 hover:bg-rose-500/80 rounded-t transition-all duration-300 border-t border-rose-500/40"
                                        style={{ height: `${heightPct}%` }}
                                    />
                                    <span className="text-[11px] text-slate-400 uppercase">{d.day}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Diurnal Time Slot Distribution */}
                <div className="command-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                            Time-of-Day Risk Clustering
                        </h2>
                        <span className="text-[10px] text-slate-400">24h Diurnal Spread</span>
                    </div>

                    <div className="space-y-4 pt-2">
                        {timeDistribution.map(slot => {
                            const widthPct = Math.max((slot.count / maxTimeCount) * 100, 4)
                            return (
                                <div key={slot.time} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-300 font-semibold">{slot.time} <span className="text-slate-400 font-normal">({slot.label})</span></span>
                                        <span className="text-slate-400 font-bold">{slot.count} incidents</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/[0.04]">
                                        <div 
                                            className={`h-full ${slot.color} transition-all duration-500`}
                                            style={{ width: `${widthPct}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
