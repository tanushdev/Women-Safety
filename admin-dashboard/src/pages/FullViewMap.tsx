import { useState, useEffect } from 'react'
import { LiveSOSMap } from '@/components/maps/LiveSOSMap'
import { API_URL } from '@/config/api'
import { useSocket } from '@/hooks/useSocket'
import { BlackboxAudioPlayer } from '@/components/audio/BlackboxAudioPlayer'
import {
    Radio,
    Shield,
    Users,
    MapPin,
    Maximize2,
    Minimize2,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Phone,
    CheckCircle2,
    Volume2,
    X
} from 'lucide-react'

interface ActiveSOS {
    _id: string
    userId?: {
        _id: string
        name: string
        phone: string
    }
    status: string
    triggerType: string
    severity: string
    createdAt: string
    audioRecordingUrl?: string
    audioUrl?: string
    sha256Checksum?: string
    digitalCertificate?: string
    currentLocation?: { coordinates: [number, number] }
    initialLocation?: { coordinates: [number, number] }
}

export function FullViewMap() {
    const { socket } = useSocket()
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [sosList, setSosList] = useState<ActiveSOS[]>([])
    const [guardianCount, setGuardianCount] = useState(0)
    const [zoneCount, setZoneCount] = useState(0)
    const [userCount, setUserCount] = useState(0)
    const [panelExpanded, setPanelExpanded] = useState(true)
    const [activeAudioSOS, setActiveAudioSOS] = useState<ActiveSOS | null>(null)

    const fetchTelemetry = async () => {
        const headers = { 'ngrok-skip-browser-warning': 'true' }
        try {
            const [sosRes, volRes, zoneRes, userRes] = await Promise.all([
                fetch(`${API_URL}/sos?status=TRIGGERED,IN_PROGRESS`, { headers }).then(r => r.ok ? r.json() : []),
                fetch(`${API_URL}/volunteers?verificationStatus=verified`, { headers }).then(r => r.ok ? r.json() : []),
                fetch(`${API_URL}/zones`, { headers }).then(r => r.ok ? r.json() : []),
                fetch(`${API_URL}/users`, { headers }).then(r => r.ok ? r.json() : []),
            ])

            const list = Array.isArray(sosRes) ? sosRes : []
            setSosList(list)
            setGuardianCount(Array.isArray(volRes) ? volRes.length : 0)
            setZoneCount(Array.isArray(zoneRes) ? zoneRes.length : 0)
            setUserCount(Array.isArray(userRes) ? userRes.length : 0)
        } catch (e) {
            console.error('Error fetching full view map telemetry:', e)
        }
    }

    useEffect(() => {
        fetchTelemetry()
        const interval = setInterval(fetchTelemetry, 10000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (!socket) return

        socket.on('sos:new', (event: any) => {
            setSosList(prev => [event, ...prev])
        })

        socket.on('sos:status:updated', (event: any) => {
            if (event.status === 'RESOLVED' || event.status === 'CANCELLED') {
                setSosList(prev => prev.filter(s => s._id !== event.sosId))
                if (activeAudioSOS?._id === event.sosId) {
                    setActiveAudioSOS(null)
                }
            }
        })

        return () => {
            socket.off('sos:new')
            socket.off('sos:status:updated')
        }
    }, [socket, activeAudioSOS])

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
        }
    }

    const resolveSOS = async (id: string) => {
        try {
            await fetch(`${API_URL}/sos/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'RESOLVED' }),
            })
            setSosList(prev => prev.filter(s => s._id !== id))
            if (activeAudioSOS?._id === id) {
                setActiveAudioSOS(null)
            }
        } catch (e) {
            console.error('Error resolving SOS:', e)
        }
    }

    return (
        <div className="relative w-full h-[calc(100vh-6.5rem)] rounded-2xl overflow-hidden shadow-lg border border-slate-200/80 bg-slate-900 flex flex-col">
            {/* 🎯 Edge-to-Edge Full Screen Live Map */}
            <div className="w-full h-full relative">
                <LiveSOSMap />
            </div>

            {/* 🎯 Floating Tactical Telemetry Header */}
            <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none flex-wrap gap-2.5">
                {/* Left Live Status Pills */}
                <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
                    <div className="px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-sm flex items-center gap-2 text-xs font-bold text-slate-800">
                        <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                        <span>Tactical Radar Map</span>
                    </div>

                    {sosList.length > 0 ? (
                        <div className="px-3.5 py-1.5 rounded-full bg-red-500 text-white shadow-md shadow-red-500/30 flex items-center gap-2 text-xs font-bold animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{sosList.length} CRITICAL DISTRESS ACTIVE</span>
                        </div>
                    ) : (
                        <div className="px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm flex items-center gap-2 text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>All Sectors Secure</span>
                        </div>
                    )}

                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm">
                        <Shield className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{guardianCount} Guardians</span>
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>{zoneCount} Havens</span>
                    </div>

                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{userCount} Citizens</span>
                    </div>
                </div>

                {/* Right Floating Actions */}
                <div className="flex items-center gap-2 pointer-events-auto">
                    <button
                        onClick={toggleFullscreen}
                        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                        className="w-9 h-9 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* 🎯 Interactive Blackbox Audio Stream Drawer on Map */}
            {activeAudioSOS && (
                <div className="absolute top-16 right-4 w-96 max-w-[calc(100vw-2rem)] z-30 pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-200">
                    <div className="relative shadow-2xl rounded-2xl overflow-hidden">
                        <button
                            onClick={() => setActiveAudioSOS(null)}
                            title="Close Audio Feed"
                            className="absolute top-3 right-3 z-40 w-7 h-7 rounded-full bg-white/80 hover:bg-white text-slate-700 flex items-center justify-center shadow-sm"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <BlackboxAudioPlayer
                            incidentId={activeAudioSOS._id}
                            citizenName={activeAudioSOS.userId?.name || 'Citizen in Distress'}
                            audioUrl={activeAudioSOS.audioRecordingUrl || activeAudioSOS.audioUrl}
                            isLive={activeAudioSOS.status === 'TRIGGERED' || activeAudioSOS.status === 'IN_PROGRESS'}
                            sha256Checksum={activeAudioSOS.sha256Checksum}
                            digitalCertificate={activeAudioSOS.digitalCertificate}
                            timestamp={activeAudioSOS.createdAt}
                        />
                    </div>
                </div>
            )}

            {/* 🎯 Floating Bottom Incident Panel (Collapsible) */}
            {sosList.length > 0 && (
                <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-20 pointer-events-auto">
                    <div className="p-4 rounded-2xl shadow-xl border border-red-100 bg-white/95 backdrop-blur-xl">
                        <div
                            onClick={() => setPanelExpanded(!panelExpanded)}
                            className="flex items-center justify-between cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                                <h4 className="font-bold text-xs uppercase tracking-wide text-red-600">
                                    Active Telemetry Queue ({sosList.length})
                                </h4>
                            </div>
                            <button className="text-slate-400 hover:text-slate-600">
                                {panelExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                            </button>
                        </div>

                        {panelExpanded && (
                            <div className="mt-3 space-y-2.5 max-h-60 overflow-y-auto pr-1">
                                {sosList.map((sos) => {
                                    const userName = sos.userId?.name || 'Citizen in Distress'
                                    const phone = sos.userId?.phone || 'Emergency Direct Link'
                                    const coords = sos.currentLocation?.coordinates || sos.initialLocation?.coordinates || [0, 0]

                                    return (
                                        <div
                                            key={sos._id}
                                            className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                                        >
                                            <div className="min-w-0">
                                                <div className="font-bold text-slate-900 truncate">{userName}</div>
                                                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                    <Phone className="w-3 h-3 text-slate-400" />
                                                    <span>{phone}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                    {coords[1].toFixed(4)}°N, {coords[0].toFixed(4)}°E
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    onClick={() => setActiveAudioSOS(sos)}
                                                    title="Listen to Live Blackbox Ambient Audio"
                                                    className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors"
                                                >
                                                    <Volume2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => resolveSOS(sos._id)}
                                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-[11px] flex items-center gap-1 shadow-sm transition-colors"
                                                >
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    <span>Resolve</span>
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
