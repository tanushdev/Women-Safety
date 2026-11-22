import { useState, useRef, useEffect } from 'react'
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    Download,
    ShieldCheck,
    Check,
    Copy,
    Mic,
    MicOff,
    RefreshCw
} from 'lucide-react'
import { API_URL } from '@/config/api'
import { useSocket } from '@/hooks/useSocket'
import axios from 'axios'

interface BlackboxAudioPlayerProps {
    incidentId: string
    citizenName: string
    audioUrl?: string
    durationSeconds?: number
    sha256Checksum?: string
    digitalCertificate?: string
    timestamp?: string
    isLive?: boolean
}

// Convert relative backend path (e.g. /uploads/audio/...) to full playable URL
function resolveAudioUrl(url?: string): string | null {
    if (!url || typeof url !== 'string' || url.trim() === '') return null
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    const base = API_URL.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')
    const cleanPath = url.startsWith('/') ? url : `/${url}`
    return `${base}${cleanPath}`
}

export function BlackboxAudioPlayer({
    incidentId,
    citizenName,
    audioUrl: initialAudioUrl,
    durationSeconds = 25,
    sha256Checksum: initialChecksum,
    digitalCertificate,
    timestamp,
    isLive = false
}: BlackboxAudioPlayerProps) {
    const { socket } = useSocket()

    const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(resolveAudioUrl(initialAudioUrl))
    const [checksum, setChecksum] = useState<string | undefined>(initialChecksum)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(durationSeconds)
    const [isMuted, setIsMuted] = useState(false)
    const [playbackRate, setPlaybackRate] = useState(1.0)
    const [copiedHash, setCopiedHash] = useState(false)
    const [isChecking, setIsChecking] = useState(false)

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const animationFrameRef = useRef<number | null>(null)

    const effectiveDuration = (duration > 0 && isFinite(duration)) ? duration : durationSeconds

    // Update resolved URL if prop changes
    useEffect(() => {
        const resolved = resolveAudioUrl(initialAudioUrl)
        setCurrentAudioUrl(resolved)
        setChecksum(initialChecksum)
        if (resolved && audioRef.current) {
            audioRef.current.src = resolved
            audioRef.current.load()
        }
    }, [initialAudioUrl, initialChecksum])

    // Listen for real-time audio upload event from backend
    useEffect(() => {
        if (!socket) return

        const handleAudioUploaded = (data: { sosId: string; audioRecordingUrl?: string; audioUrl?: string; sha256Checksum?: string }) => {
            if (data.sosId === incidentId) {
                const newUrl = resolveAudioUrl(data.audioRecordingUrl || data.audioUrl)
                if (newUrl) {
                    setCurrentAudioUrl(newUrl)
                    if (data.sha256Checksum) setChecksum(data.sha256Checksum)
                    if (audioRef.current) {
                        audioRef.current.src = newUrl
                        audioRef.current.load()
                    }
                }
            }
        }

        socket.on('sos:audio:uploaded', handleAudioUploaded)
        return () => {
            socket.off('sos:audio:uploaded', handleAudioUploaded)
        }
    }, [socket, incidentId])

    // Manually check backend for audio
    const checkForAudio = async () => {
        if (!incidentId) return
        try {
            setIsChecking(true)
            const res = await axios.get(`${API_URL}/sos/${incidentId}`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            const data = res.data?.data || res.data
            const url = data?.audioRecordingUrl || data?.audioUrl
            if (url) {
                const resolved = resolveAudioUrl(url)
                setCurrentAudioUrl(resolved)
                if (data.sha256Checksum) setChecksum(data.sha256Checksum)
            }
        } catch (e) {
            console.error('Error checking for audio:', e)
        } finally {
            setIsChecking(false)
        }
    }

    const togglePlayback = () => {
        if (!currentAudioUrl || !audioRef.current) return

        if (isPlaying) {
            audioRef.current.pause()
            setIsPlaying(false)
        } else {
            audioRef.current.playbackRate = playbackRate
            audioRef.current.muted = isMuted
            audioRef.current.play().then(() => {
                setIsPlaying(true)
            }).catch(err => {
                console.error('Audio playback error:', err)
                setIsPlaying(false)
            })
        }
    }

    const handleSeek = (newTime: number) => {
        setCurrentTime(newTime)
        if (audioRef.current) {
            audioRef.current.currentTime = newTime
        }
    }

    // Waveform rendering
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let phase = 0

        const renderWaveform = () => {
            const width = canvas.width
            const height = canvas.height
            ctx.clearRect(0, 0, width, height)

            const bars = 36
            const barWidth = 3
            const gap = (width - bars * barWidth) / (bars - 1)

            for (let i = 0; i < bars; i++) {
                const x = i * (barWidth + gap)
                let barHeight = 6

                if (isPlaying) {
                    const noise = Math.sin(i * 0.45 + phase) * Math.cos(i * 0.25 - phase * 0.8)
                    barHeight = Math.max(6, Math.min(height - 4, (Math.abs(noise) * (height - 10)) + 6))
                } else if (currentAudioUrl) {
                    barHeight = 6 + Math.sin(i * 0.5) * 6
                }

                const y = (height - barHeight) / 2
                const progressRatio = duration > 0 ? currentTime / duration : 0
                const isCurrent = (i / bars) <= progressRatio

                if (isCurrent && isPlaying) {
                    ctx.fillStyle = '#10B981' // Emerald
                } else if (isCurrent) {
                    ctx.fillStyle = '#0F172A'
                } else {
                    ctx.fillStyle = '#E2E8F0'
                }

                ctx.beginPath()
                ctx.roundRect(x, y, barWidth, barHeight, 2)
                ctx.fill()
            }

            if (isPlaying) {
                phase += 0.15
            }
            animationFrameRef.current = requestAnimationFrame(renderWaveform)
        }

        renderWaveform()

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [isPlaying, currentTime, duration, currentAudioUrl])

    const copyChecksum = () => {
        if (!checksum) return
        navigator.clipboard.writeText(checksum)
        setCopiedHash(true)
        setTimeout(() => setCopiedHash(false), 2500)
    }

    const formatSeconds = (sec: number) => {
        if (!sec || isNaN(sec) || !isFinite(sec)) return '00:00'
        const m = Math.floor(sec / 60).toString().padStart(2, '0')
        const s = (Math.floor(sec) % 60).toString().padStart(2, '0')
        return `${m}:${s}`
    }

    const downloadAudio = () => {
        if (!currentAudioUrl) return
        const a = document.createElement('a')
        a.href = currentAudioUrl
        a.download = `sos_mic_recording_${incidentId}.m4a`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }

    return (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
            {/* HTML5 Audio Element for Real Mic Recording */}
            {currentAudioUrl && (
                <audio
                    ref={audioRef}
                    src={currentAudioUrl}
                    preload="auto"
                    onTimeUpdate={() => {
                        if (audioRef.current) {
                            setCurrentTime(audioRef.current.currentTime)
                        }
                    }}
                    onLoadedMetadata={() => {
                        if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
                            setDuration(Math.ceil(audioRef.current.duration))
                        }
                    }}
                    onCanPlay={() => {
                        if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
                            setDuration(Math.ceil(audioRef.current.duration))
                        }
                    }}
                    onEnded={() => {
                        setIsPlaying(false)
                        setCurrentTime(0)
                    }}
                    onError={(e) => {
                        console.warn('Audio element load notice:', e)
                    }}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        currentAudioUrl ? 'bg-emerald-50 border border-emerald-200 text-emerald-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                        {currentAudioUrl ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-xs text-slate-900">
                                Ambient Audio Recording
                            </h4>
                            {currentAudioUrl ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>Phone Mic Recording</span>
                                </span>
                            ) : isLive ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200">
                                    Awaiting Phone Upload
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">
                                    No Recording
                                </span>
                            )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                            {currentAudioUrl
                                ? `Captured live from ${citizenName}'s phone microphone${timestamp ? ` • ${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
                                : `Ambient recording for ${citizenName}`}
                        </div>
                    </div>
                </div>

                {!currentAudioUrl && (
                    <button
                        onClick={checkForAudio}
                        disabled={isChecking}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-medium flex items-center gap-1 transition-colors"
                        title="Check if mobile app uploaded recording"
                    >
                        <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                        <span>Check Audio</span>
                    </button>
                )}
            </div>

            {/* Main Audio Display */}
            {currentAudioUrl ? (
                <div className="space-y-3">
                    {/* Waveform / Visualizer */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                            <span className="font-bold text-slate-900">{formatSeconds(currentTime)}</span>
                            <span className="text-[10px] font-semibold text-emerald-600">
                                {isPlaying ? 'Playing Real Recording' : 'Recording Ready'}
                            </span>
                            <span>{formatSeconds(effectiveDuration)}</span>
                        </div>

                        <div className="w-full flex justify-center py-1">
                            <canvas ref={canvasRef} width={320} height={40} className="w-full max-w-sm" />
                        </div>

                        {/* Scrubber */}
                        <input
                            type="range"
                            min={0}
                            max={effectiveDuration}
                            value={currentTime}
                            onChange={(e) => handleSeek(Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />

                        {/* Native Browser Audio Controls for 100% Reliable Direct Playback */}
                        <div className="pt-1.5 border-t border-slate-200/60">
                            <audio
                                controls
                                src={currentAudioUrl}
                                className="w-full h-8 rounded-lg"
                                preload="auto"
                            />
                        </div>
                    </div>

                    {/* Controls Bar */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={togglePlayback}
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-all shadow-sm ${
                                    isPlaying ? 'bg-slate-900 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                                title={isPlaying ? 'Pause' : 'Play Phone Recording'}
                            >
                                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                            </button>

                            <button
                                onClick={() => {
                                    setIsMuted(!isMuted)
                                    if (audioRef.current) audioRef.current.muted = !isMuted
                                }}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                                title={isMuted ? 'Unmute' : 'Mute'}
                            >
                                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-500" /> : <Volume2 className="w-3.5 h-3.5" />}
                            </button>

                            <button
                                onClick={() => {
                                    const next = playbackRate === 1.0 ? 1.5 : playbackRate === 1.5 ? 2.0 : 1.0
                                    setPlaybackRate(next)
                                    if (audioRef.current) audioRef.current.playbackRate = next
                                }}
                                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-bold transition-colors"
                                title="Playback Speed"
                            >
                                {playbackRate.toFixed(1)}x
                            </button>
                        </div>

                        <button
                            onClick={downloadAudio}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                            title="Download recorded .m4a file"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download .m4a</span>
                        </button>
                    </div>

                    {/* Checksum / Evidence Info */}
                    {(checksum || digitalCertificate) && (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 truncate">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="font-mono text-[10px] text-slate-500 truncate">
                                    {digitalCertificate ? `${digitalCertificate} • ` : ''}{checksum ? `SHA-256: ${checksum}` : ''}
                                </span>
                            </div>
                            <button
                                onClick={copyChecksum}
                                className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-medium shrink-0 flex items-center gap-1"
                            >
                                {copiedHash ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-100 text-center space-y-1.5">
                    <p className="text-xs font-medium text-slate-700">
                        {isLive ? 'Recording audio on handset...' : 'No audio recording for this incident'}
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                        {isLive
                            ? 'When SOS is active, the mobile app captures ambient microphone audio and uploads it to this console.'
                            : 'This alert was resolved or closed without an uploaded microphone audio file.'}
                    </p>
                </div>
            )}
        </div>
    )
}
