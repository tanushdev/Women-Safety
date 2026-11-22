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
            console.error('Error fetching map telemetry:', e)
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
        <div className="relative w-full h-[calc(100vh-5.5rem)] rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-slate-900 flex flex-col">
            {/* Live Map Canvas */}
            <div className="w-full h-full relative">
                <LiveSOSMap />
            </div>

            {/* Top Floating Controls */}
            <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none flex-wrap gap-2">
                {/* Status Pills */}
                <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
                    <div className="px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 shadow-sm flex items-center gap-2 text-xs font-semibold text-slate-800">
                        <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                        <span>Live Map</span>
                    </div>

                    {sosList.length > 0 ? (
                        <div className="px-3 py-1 rounded-full bg-red-500 text-white shadow-sm flex items-center gap-1.5 text-xs font-semibold animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{sosList.length} Active SOS</span>
                        </div>
                    ) : (
                        <div className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm flex items-center gap-1.5 text-xs font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>All Clear</span>
                        </div>
                    )}

                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 text-xs font-medium text-slate-700 shadow-sm">
                        <Shield className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{guardianCount} Volunteers</span>
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 text-xs font-medium text-slate-700 shadow-sm">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>{zoneCount} Safe Zones</span>
                    </div>

                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 text-xs font-medium text-slate-700 shadow-sm">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{userCount} Users</span>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 pointer-events-auto">
                    <button
                        onClick={toggleFullscreen}
                        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                        className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            {/* Audio Drawer */}
            {activeAudioSOS && (
                <div className="absolute top-14 right-3 w-80 max-w-[calc(100vw-2rem)] z-30 pointer-events-auto">
                    <div className="relative shadow-xl rounded-2xl overflow-hidden">
                        <button
                            onClick={() => setActiveAudioSOS(null)}
                            title="Close Audio"
                            className="absolute top-3 right-3 z-40 w-6 h-6 rounded-full bg-white/90 hover:bg-white text-slate-700 flex items-center justify-center shadow-sm"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                        <BlackboxAudioPlayer
                            incidentId={activeAudioSOS._id}
                            citizenName={activeAudioSOS.userId?.name || 'Citizen'}
                            audioUrl={activeAudioSOS.audioRecordingUrl || activeAudioSOS.audioUrl}
                            isLive={activeAudioSOS.status === 'TRIGGERED' || activeAudioSOS.status === 'IN_PROGRESS'}
                            sha256Checksum={activeAudioSOS.sha256Checksum}
                            digitalCertificate={activeAudioSOS.digitalCertificate}
                            timestamp={activeAudioSOS.createdAt}
                        />
                    </div>
                </div>
            )}

            {/* Floating Bottom Active SOS Panel */}
            {sosList.length > 0 && (
                <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 z-20 pointer-events-auto">
                    <div className="p-3.5 rounded-2xl shadow-lg border border-red-100 bg-white/95 backdrop-blur-md">
                        <div
                            onClick={() => setPanelExpanded(!panelExpanded)}
                            className="flex items-center justify-between cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                <h4 className="font-bold text-xs text-red-600">
                                    Active Alerts ({sosList.length})
                                </h4>
                            </div>
                            <button className="text-slate-400 hover:text-slate-600">
                                {panelExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                            </button>
                        </div>

                        {panelExpanded && (
                            <div className="mt-2.5 space-y-2 max-h-52 overflow-y-auto pr-1">
                                {sosList.map((sos) => {
                                    const userName = sos.userId?.name || 'Citizen'
                                    const phone = sos.userId?.phone || 'N/A'
                                    const coords = sos.currentLocation?.coordinates || sos.initialLocation?.coordinates || [0, 0]

                                    return (
                                        <div
                                            key={sos._id}
                                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                                        >
                                            <div className="min-w-0">
                                                <div className="font-semibold text-slate-900 truncate">{userName}</div>
                                                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                                    <Phone className="w-3 h-3 text-slate-400" />
                                                    <span>{phone}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                    {coords[1].toFixed(4)}°N, {coords[0].toFixed(4)}°E
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    onClick={() => setActiveAudioSOS(sos)}
                                                    title="Listen to Audio"
                                                    className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors"
                                                >
                                                    <Volume2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => resolveSOS(sos._id)}
                                                    className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-[11px] flex items-center gap-1 shadow-sm transition-colors"
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
