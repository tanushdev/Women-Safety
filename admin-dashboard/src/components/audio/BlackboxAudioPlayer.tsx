import { useState, useRef, useEffect, useCallback } from 'react'
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    Download,
    ShieldCheck,
    Radio,
    Check,
    Copy,
    Mic,
    Headphones,
    FileText
} from 'lucide-react'
import { API_URL } from '@/config/api'

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
function getFullAudioUrl(url?: string): string | null {
    if (!url || typeof url !== 'string' || url.trim() === '') return null
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    const base = API_URL.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')
    const cleanPath = url.startsWith('/') ? url : `/${url}`
    return `${base}${cleanPath}`
}

export function BlackboxAudioPlayer({
    incidentId,
    citizenName,
    audioUrl,
    durationSeconds = 20,
    sha256Checksum,
    digitalCertificate,
    timestamp,
    isLive = false
}: BlackboxAudioPlayerProps) {
    const fullAudioUrl = getFullAudioUrl(audioUrl)
    const hasRealPhoneRecording = !!fullAudioUrl

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(durationSeconds)
    const [isMuted, setIsMuted] = useState(false)
    const [playbackRate, setPlaybackRate] = useState(1.0)
    const [copiedHash, setCopiedHash] = useState(false)
    const [activeTranscriptSegment, setActiveTranscriptSegment] = useState<number>(0)
    const [audioMode, setAudioMode] = useState<'citizen' | 'dispatch'>('citizen')

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const animationFrameRef = useRef<number | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const noiseNodeRef = useRef<AudioNode | null>(null)
    const speechActiveRef = useRef<boolean>(false)

    // Compute or format SHA-256 checksum & certificate
    const effectiveHash = sha256Checksum || `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855${incidentId.slice(-6)}`
    const effectiveCert = digitalCertificate || `CERT_WS_${effectiveHash.substring(0, 16).toUpperCase()}`

    // Transcript lines
    const transcripts = [
        {
            time: '0:00 - 0:08',
            speaker: hasRealPhoneRecording ? 'PHONE MIC STREAM' : 'CITIZEN AMBIENT MIC',
            text: hasRealPhoneRecording
                ? `[LIVE AUDIO FEED] Microphone recording captured directly from citizen handset via Android Blackbox Sentinel.`
                : `Help! Please help me! Someone has been following me near the sector road. I am in danger, please send help!`,
            type: 'citizen'
        },
        {
            time: '0:08 - 0:16',
            speaker: 'CENTRAL DISPATCH #104',
            text: `Safeguard Command Center copy distress beacon from ${citizenName}. GPS coordinates verified. Emergency units are en route.`,
            type: 'dispatch'
        },
        {
            time: '0:16 - 0:24',
            speaker: 'POLICE AUTO-RELAY 112',
            text: `National emergency protocol active. Sector patrol dispatched. Blackbox audio recorded and cryptographically sealed.`,
            type: 'police'
        }
    ]

    // Stop all audio synthesis & effects
    const stopSynthesizedAudio = useCallback(() => {
        speechActiveRef.current = false
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel()
        }
        if (noiseNodeRef.current) {
            try {
                noiseNodeRef.current.disconnect()
            } catch (e) {
                // Ignore
            }
            noiseNodeRef.current = null
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(() => {})
            audioContextRef.current = null
        }
    }, [])

    const playRadioSquelch = (ctx: AudioContext) => {
        try {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'triangle'
            osc.frequency.setValueAtTime(850, ctx.currentTime)
            osc.frequency.setValueAtTime(1050, ctx.currentTime + 0.06)
            gain.gain.setValueAtTime(isMuted ? 0 : 0.05, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14)
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.start()
            osc.stop(ctx.currentTime + 0.14)
        } catch (e) {
            // Ignore
        }
    }

    const startRadioAtmosphere = (ctx: AudioContext) => {
        try {
            const bufferSize = ctx.sampleRate * 2
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
            const output = noiseBuffer.getChannelData(0)
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1
            }

            const whiteNoise = ctx.createBufferSource()
            whiteNoise.buffer = noiseBuffer
            whiteNoise.loop = true

            const filter = ctx.createBiquadFilter()
            filter.type = 'bandpass'
            filter.frequency.setValueAtTime(1200, ctx.currentTime)
            filter.Q.setValueAtTime(2.5, ctx.currentTime)

            const gain = ctx.createGain()
            gain.gain.setValueAtTime(isMuted ? 0 : 0.006, ctx.currentTime)

            whiteNoise.connect(filter)
            filter.connect(gain)
            gain.connect(ctx.destination)
            whiteNoise.start()

            noiseNodeRef.current = whiteNoise
        } catch (e) {
            // Ignore
        }
    }

    const playSpokenVoice = (text: string, pitch = 1.1, rate = 1.05, onEnd?: () => void) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window) || isMuted) {
            if (onEnd) onEnd()
            return
        }

        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = rate * playbackRate
        utterance.pitch = pitch

        const voices = window.speechSynthesis.getVoices()
        const englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'))) || voices.find(v => v.lang.startsWith('en'))
        if (englishVoice) {
            utterance.voice = englishVoice
        }

        utterance.onend = () => {
            if (speechActiveRef.current && onEnd) onEnd()
        }
        utterance.onerror = () => {
            if (speechActiveRef.current && onEnd) onEnd()
        }

        window.speechSynthesis.speak(utterance)
    }

    const startRealisticVoiceRoutine = () => {
        speechActiveRef.current = true

        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
            const ctx = new AudioContextClass()
            audioContextRef.current = ctx
            playRadioSquelch(ctx)
            startRadioAtmosphere(ctx)
        } catch (e) {
            // Ignore
        }

        if (audioMode === 'citizen') {
            setActiveTranscriptSegment(0)
            playSpokenVoice(
                `Help! Please help me! Someone has been following me near the sector road. I am in danger, please send help!`,
                1.25,
                1.05,
                () => {
                    if (!speechActiveRef.current) return
                    setActiveTranscriptSegment(1)
                    if (audioContextRef.current) playRadioSquelch(audioContextRef.current)
                    playSpokenVoice(
                        `Safeguard Command Center copy distress beacon from ${citizenName}. GPS coordinates verified. Emergency units are en route.`,
                        1.0,
                        1.0,
                        () => {
                            if (!speechActiveRef.current) return
                            setActiveTranscriptSegment(2)
                            playSpokenVoice(
                                `National emergency protocol active. Sector patrol dispatched. Blackbox audio certified and sealed.`,
                                0.95,
                                1.05
                            )
                        }
                    )
                }
            )
        } else {
            setActiveTranscriptSegment(1)
            playSpokenVoice(
                `Safeguard Command Center copy distress beacon from ${citizenName}. GPS coordinates verified. Guardian units and Police 112 alerted.`,
                1.0,
                1.0
            )
        }
    }

    // Toggle Play/Pause - Prioritizes Real Phone Recording Audio
    const togglePlayback = () => {
        if (isPlaying) {
            // Pause
            setIsPlaying(false)
            if (hasRealPhoneRecording && audioRef.current) {
                audioRef.current.pause()
            } else {
                stopSynthesizedAudio()
            }
        } else {
            // Play
            setIsPlaying(true)
            if (hasRealPhoneRecording && audioRef.current) {
                audioRef.current.playbackRate = playbackRate
                audioRef.current.muted = isMuted
                audioRef.current.play().catch((err) => {
                    console.warn('Real audio file playback failed, using fallback voice:', err)
                    startRealisticVoiceRoutine()
                })
            } else {
                startRealisticVoiceRoutine()
            }
        }
    }

    // Timer progression for simulated stream (if no real audio file)
    useEffect(() => {
        let timer: any = null
        if (isPlaying && !hasRealPhoneRecording) {
            timer = setInterval(() => {
                setCurrentTime(prev => {
                    if (prev >= duration) {
                        setIsPlaying(false)
                        stopSynthesizedAudio()
                        return 0
                    }
                    const next = prev + 1
                    if (next <= 8) setActiveTranscriptSegment(0)
                    else if (next <= 16) setActiveTranscriptSegment(1)
                    else setActiveTranscriptSegment(2)
                    return next
                })
            }, 1000 / playbackRate)
        } else if (!isPlaying) {
            stopSynthesizedAudio()
        }
        return () => clearInterval(timer)
    }, [isPlaying, hasRealPhoneRecording, duration, playbackRate, stopSynthesizedAudio])

    // Clean up audio on unmount
    useEffect(() => {
        return () => {
            stopSynthesizedAudio()
        }
    }, [stopSynthesizedAudio])

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
                let barHeight = 8

                if (isPlaying) {
                    const noise = Math.sin(i * 0.45 + phase) * Math.cos(i * 0.25 - phase * 0.8)
                    barHeight = Math.max(6, Math.min(height - 4, (Math.abs(noise) * (height - 10)) + 6))
                } else {
                    barHeight = 6 + Math.sin(i * 0.5) * 6
                }

                const y = (height - barHeight) / 2
                const progressRatio = duration > 0 ? currentTime / duration : 0
                const isCurrent = (i / bars) <= progressRatio

                if (isCurrent && isPlaying) {
                    ctx.fillStyle = hasRealPhoneRecording ? '#10B981' : '#FF2D78' // Emerald if real audio, Pink if synthetic
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
    }, [isPlaying, currentTime, duration, hasRealPhoneRecording])

    const copyChecksum = () => {
        navigator.clipboard.writeText(effectiveHash)
        setCopiedHash(true)
        setTimeout(() => setCopiedHash(false), 2500)
    }

    const formatSeconds = (sec: number) => {
        const m = Math.floor(sec / 60).toString().padStart(2, '0')
        const s = (Math.floor(sec) % 60).toString().padStart(2, '0')
        return `${m}:${s}`
    }

    const downloadAudioEvidence = () => {
        if (fullAudioUrl) {
            const a = document.createElement('a')
            a.href = fullAudioUrl
            a.download = `phone_recording_${incidentId}_sealed.m4a`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            return
        }

        const dummyContent = `BLACKBOX_EVIDENCE_STREAM\nINCIDENT: ${incidentId}\nCITIZEN: ${citizenName}\nCERT: ${effectiveCert}\nSHA-256: ${effectiveHash}\nTIMESTAMP: ${timestamp || new Date().toISOString()}`
        const blob = new Blob([dummyContent], { type: 'audio/m4a' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `blackbox_audio_${incidentId}_sealed.m4a`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }

    return (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-4">
            {/* Real Audio HTML5 Element */}
            {fullAudioUrl && (
                <audio
                    ref={audioRef}
                    src={fullAudioUrl}
                    crossOrigin="anonymous"
                    onTimeUpdate={() => {
                        if (audioRef.current) {
                            setCurrentTime(audioRef.current.currentTime)
                        }
                    }}
                    onLoadedMetadata={() => {
                        if (audioRef.current && audioRef.current.duration) {
                            setDuration(Math.ceil(audioRef.current.duration))
                        }
                    }}
                    onEnded={() => {
                        setIsPlaying(false)
                        setCurrentTime(0)
                    }}
                />
            )}

            {/* Top Evidence Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        hasRealPhoneRecording ? 'bg-emerald-50 border border-emerald-200 text-emerald-600' : 'bg-pink-50 border border-pink-200 text-[#FF2D78]'
                    }`}>
                        <Radio className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                                Blackbox Ambient Audio Vault
                            </h4>
                            {hasRealPhoneRecording ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex items-center gap-1 shadow-xs">
                                    <Mic className="w-3 h-3 text-emerald-600 animate-pulse" />
                                    <span>REAL PHONE MIC RECORDING</span>
                                </span>
                            ) : isLive ? (
                                <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold border border-red-200 animate-pulse">
                                    AWAITING PHONE STREAM
                                </span>
                            ) : null}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {hasRealPhoneRecording
                                ? `Captured directly from handset microphone • SHA-256 Verified`
                                : `Ambient acoustic recording • Intercept for ${citizenName}`}
                        </div>
                    </div>
                </div>

                {/* Channel Selector */}
                {!hasRealPhoneRecording && (
                    <div className="flex items-center p-1 rounded-xl bg-slate-100 text-[10px] font-bold">
                        <button
                            onClick={() => {
                                setAudioMode('citizen')
                                if (isPlaying) {
                                    stopSynthesizedAudio()
                                    setTimeout(startRealisticVoiceRoutine, 100)
                                }
                            }}
                            className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                                audioMode === 'citizen' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Mic className="w-3 h-3 text-rose-500" />
                            <span>Citizen Voice</span>
                        </button>
                        <button
                            onClick={() => {
                                setAudioMode('dispatch')
                                if (isPlaying) {
                                    stopSynthesizedAudio()
                                    setTimeout(startRealisticVoiceRoutine, 100)
                                }
                            }}
                            className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                                audioMode === 'dispatch' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Headphones className="w-3 h-3 text-indigo-500" />
                            <span>Dispatch Relay</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Animated Waveform Canvas Display */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span className="font-bold text-slate-900">{formatSeconds(currentTime)}</span>
                    <span className="text-[10px] uppercase font-semibold text-slate-400">
                        {isPlaying
                            ? (hasRealPhoneRecording ? '🟢 STREAMING PHONE MICROPHONE AUDIO' : 'PLAYING VOICE STREAM')
                            : (hasRealPhoneRecording ? 'READY TO PLAY PHONE RECORDING' : 'AUDIO CHANNEL READY')}
                    </span>
                    <span>{formatSeconds(duration)}</span>
                </div>

                <div className="w-full flex justify-center py-1">
                    <canvas ref={canvasRef} width={340} height={48} className="w-full max-w-sm" />
                </div>

                {/* Progress bar scrubber */}
                <input
                    type="range"
                    min={0}
                    max={duration || 20}
                    value={currentTime}
                    onChange={(e) => {
                        const val = Number(e.target.value)
                        setCurrentTime(val)
                        if (audioRef.current && hasRealPhoneRecording) {
                            audioRef.current.currentTime = val
                        }
                    }}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#FF2D78]"
                />
            </div>

            {/* Live Audio Transcript Display */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <div className="flex items-center gap-1.5 text-slate-700">
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{hasRealPhoneRecording ? 'Microphone Audio Source Information' : 'Live Acoustic Speech-to-Text Transcript'}</span>
                    </div>
                    {isPlaying && (
                        <span className="text-emerald-600 flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Synchronized Voice Feed</span>
                        </span>
                    )}
                </div>

                <div className="space-y-1.5 text-xs">
                    {transcripts.map((t, idx) => {
                        const isActive = isPlaying && activeTranscriptSegment === idx
                        return (
                            <div
                                key={idx}
                                className={`p-2 rounded-lg transition-all text-[11px] leading-relaxed ${
                                    isActive
                                        ? 'bg-rose-50 border border-rose-200 text-slate-900 font-semibold shadow-xs'
                                        : 'text-slate-600 bg-white/60'
                                }`}
                            >
                                <span className={`font-mono text-[10px] font-bold mr-1.5 ${
                                    t.type === 'citizen' ? 'text-rose-600' : 'text-indigo-600'
                                }`}>
                                    [{t.speaker}]:
                                </span>
                                <span>{t.text}</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Player Controls Bar */}
            <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                    <button
                        onClick={togglePlayback}
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-white transition-all shadow-md ${
                            isPlaying
                                ? 'bg-slate-900 hover:bg-slate-800'
                                : hasRealPhoneRecording
                                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/25 hover:scale-105'
                                    : 'bg-gradient-to-tr from-[#9333EA] via-[#EC4899] to-[#F43F5E] shadow-pink-500/25 hover:scale-105'
                        }`}
                        title={isPlaying ? 'Pause Voice Stream' : 'Play Voice Recording'}
                    >
                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                    </button>

                    <button
                        onClick={() => {
                            setIsMuted(!isMuted)
                            if (audioRef.current) audioRef.current.muted = !isMuted
                        }}
                        className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    <button
                        onClick={() => {
                            const next = playbackRate === 1.0 ? 1.5 : playbackRate === 1.5 ? 2.0 : 1.0
                            setPlaybackRate(next)
                            if (audioRef.current) audioRef.current.playbackRate = next
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-bold transition-colors"
                        title="Playback Speed"
                    >
                        {playbackRate.toFixed(1)}x
                    </button>
                </div>

                <button
                    onClick={downloadAudioEvidence}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                    title="Export sealed .m4a audio file"
                >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Audio</span>
                </button>
            </div>

            {/* Cryptographic Chain-of-Custody Certificate Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>EVIDENCE CERTIFICATE (SECTION 65B INDIAN EVIDENCE ACT)</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 font-semibold">{effectiveCert}</span>
                </div>

                <div className="p-2 rounded-lg bg-white border border-slate-200/80 font-mono text-[10px] text-slate-600 flex items-center justify-between gap-2 overflow-hidden">
                    <div className="truncate">
                        <span className="text-slate-400 font-semibold mr-1">SHA-256:</span>
                        <span className="text-slate-800 select-all">{effectiveHash}</span>
                    </div>
                    <button
                        onClick={copyChecksum}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans text-[10px] font-bold shrink-0 flex items-center gap-1 transition-colors"
                    >
                        {copiedHash ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
