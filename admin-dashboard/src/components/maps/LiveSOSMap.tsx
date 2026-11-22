import { useEffect, useRef, useState } from 'react'
import * as maptilersdk from '@maptiler/sdk'
import '@maptiler/sdk/dist/maptiler-sdk.css'
import { useSocket } from '../../hooks/useSocket'
import { API_URL } from '@/config/api'
import { Users, Shield, MapPin, Radio, AlertTriangle } from 'lucide-react'

interface SOSLocation {
    id: string
    userId?: string
    lng: number
    lat: number
    status: string
    userName: string
    phone?: string
    createdAt?: string
}

interface Volunteer {
    id: string
    lng: number
    lat: number
    name: string
    status: string
    governmentId?: string
}

interface Zone {
    id: string
    name: string
    type: string
    severity: string
    center: [number, number]
    radius: number
}

interface User {
    id: string
    lng: number
    lat: number
    name: string
    phone?: string
}

export function LiveSOSMap() {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<maptilersdk.Map | null>(null)
    const markersRef = useRef<{ [key: string]: maptilersdk.Marker }>({})
    const hasFittedBoundsRef = useRef(false)
    const { socket } = useSocket()
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [sosLocations, setSOSLocations] = useState<SOSLocation[]>([])
    const [volunteers, setVolunteers] = useState<Volunteer[]>([])
    const [zones, setZones] = useState<Zone[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [showVolunteers, setShowVolunteers] = useState(true)
    const [showZones, setShowZones] = useState(true)
    const [showUsers, setShowUsers] = useState(true)

    // Center on project telemetry data: Navi Mumbai / Panvel [73.165, 18.94]
    const defaultCenter: [number, number] = [73.165, 18.94]

    // Expose one-click beacon resolve to marker popup DOM
    useEffect(() => {
        (window as any).resolveSosBeacon = async (id: string) => {
            try {
                await fetch(`${API_URL}/sos/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'RESOLVED' }),
                })
                setSOSLocations(prev => prev.filter(s => s.id !== id))
                if (markersRef.current[`sos-${id}`]) {
                    markersRef.current[`sos-${id}`].remove()
                    delete markersRef.current[`sos-${id}`]
                }
            } catch (err) {
                console.error('Failed to resolve SOS beacon:', err)
            }
        }
        return () => {
            delete (window as any).resolveSosBeacon
        }
    }, [])

    // Fetch live real data with deduplication to prevent duplicate stacked markers
    useEffect(() => {
        const fetchData = async () => {
            const headers = { 'ngrok-skip-browser-warning': 'true' }

            try {
                const [sosRes, volRes, usersRes, zonesRes] = await Promise.all([
                    fetch(`${API_URL}/sos?status=TRIGGERED,IN_PROGRESS`, { headers }).catch(() => null),
                    fetch(`${API_URL}/volunteers?verificationStatus=verified`, { headers }).catch(() => null),
                    fetch(`${API_URL}/users`, { headers }).catch(() => null),
                    fetch(`${API_URL}/zones`, { headers }).catch(() => null)
                ])

                if (sosRes && sosRes.ok) {
                    const data = await sosRes.json()
                    const rawList = Array.isArray(data) ? data : []

                    const valid = rawList
                        .filter((sos: any) => {
                            const coords = sos.currentLocation?.coordinates || sos.initialLocation?.coordinates
                            return coords && coords[0] !== 0 && coords[1] !== 0
                        })
                        .map((sos: any) => {
                            const coords = sos.currentLocation?.coordinates || sos.initialLocation?.coordinates
                            const userObj = typeof sos.userId === 'object' && sos.userId !== null ? sos.userId : null
                            return {
                                id: sos._id,
                                userId: userObj?._id || (typeof sos.userId === 'string' ? sos.userId : undefined),
                                lng: coords[0],
                                lat: coords[1],
                                status: (sos.status || 'TRIGGERED').toLowerCase(),
                                userName: userObj?.name || 'Citizen in Distress',
                                phone: userObj?.phone || '',
                                createdAt: sos.createdAt || new Date().toISOString(),
                            }
                        })

                    // Sort descending by creation date so freshest telemetry wins
                    valid.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

                    // Deduplicate by user or cluster proximate anonymous triggers so historical test trails collapse to 1 single latest active beacon
                    const userSOSMap = new Map<string, SOSLocation>()
                    valid.forEach((item: any) => {
                        let dedupeKey = item.userId || (item.phone ? item.phone : (item.userName !== 'Citizen in Distress' ? item.userName : null))
                        
                        // If no specific identity is attached (e.g. anonymous test), collapse triggers within ~1.5km to the most recent alert
                        if (!dedupeKey) {
                            for (const [key, existing] of userSOSMap.entries()) {
                                const dLat = Math.abs(existing.lat - item.lat)
                                const dLng = Math.abs(existing.lng - item.lng)
                                if (dLat < 0.015 && dLng < 0.015) {
                                    dedupeKey = key
                                    break
                                }
                            }
                            if (!dedupeKey) dedupeKey = `sos-${item.id}`
                        }

                        if (!userSOSMap.has(dedupeKey)) {
                            userSOSMap.set(dedupeKey, item)
                        }
                    })

                    setSOSLocations(Array.from(userSOSMap.values()))
                }

                if (volRes && volRes.ok) {
                    const volData = await volRes.json()
                    const vols = (Array.isArray(volData) ? volData : [])
                        .filter((v: any) => v.currentLocation?.coordinates &&
                            v.currentLocation.coordinates[0] !== 0 &&
                            v.currentLocation.coordinates[1] !== 0)
                        .map((v: any) => ({
                            id: v._id,
                            lng: v.currentLocation.coordinates[0],
                            lat: v.currentLocation.coordinates[1],
                            name: v.userId?.name || 'Guardian Responder',
                            status: v.status || 'available',
                            governmentId: v.governmentId,
                        }))
                    setVolunteers(vols)
                }

                if (usersRes && usersRes.ok) {
                    const usersData = await usersRes.json()
                    const usersList = (Array.isArray(usersData) ? usersData : [])
                        .filter((u: any) => u.lastLocation?.coordinates &&
                            u.lastLocation.coordinates[0] !== 0 &&
                            u.lastLocation.coordinates[1] !== 0)
                        .map((u: any) => ({
                            id: u._id,
                            lng: u.lastLocation.coordinates[0],
                            lat: u.lastLocation.coordinates[1],
                            name: u.name || 'User',
                            phone: u.phone,
                        }))
                    setUsers(usersList)
                }

                if (zonesRes && zonesRes.ok) {
                    const zonesData = await zonesRes.json()
                    const zonesList = (Array.isArray(zonesData) ? zonesData : [])
                        .filter((z: any) => z.centerPoint?.coordinates &&
                            z.centerPoint.coordinates[0] !== 0 &&
                            z.centerPoint.coordinates[1] !== 0)
                        .map((z: any) => ({
                            id: z._id,
                            name: z.name,
                            type: z.type,
                            severity: z.severity || 'medium',
                            center: z.centerPoint.coordinates as [number, number],
                            radius: z.radius || 500,
                        }))
                    setZones(zonesList)
                }

            } catch (err) {
                console.error('Error fetching live map data:', err)
            }
        }

        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => clearInterval(interval)
    }, [])

    // WebSocket live event updates with deduplication
    useEffect(() => {
        if (!socket) return

        socket.on('sos:new', (event: any) => {
            const coords = event.location?.coordinates || event.initialLocation?.coordinates
            if (!coords || coords[0] === 0 || coords[1] === 0) return

            const userObj = typeof event.userId === 'object' && event.userId !== null ? event.userId : null
            const userId = userObj?._id || (typeof event.userId === 'string' ? event.userId : undefined)
            const phone = userObj?.phone || ''
            const userName = userObj?.name || 'Citizen in Distress'
            const dedupeKey = userId || phone || (userName !== 'Citizen in Distress' ? userName : event._id || event.id)

            const newSos: SOSLocation = {
                id: event._id || event.id,
                userId,
                lng: coords[0],
                lat: coords[1],
                status: (event.status || 'triggered').toLowerCase(),
                userName,
                phone,
                createdAt: event.createdAt || new Date().toISOString(),
            }

            setSOSLocations(prev => {
                const rest = prev.filter(s => {
                    const k = s.userId || s.phone || (s.userName !== 'Citizen in Distress' ? s.userName : s.id)
                    return k !== dedupeKey
                })
                return [newSos, ...rest]
            })
        })

        socket.on('sos:location:updated', (event: any) => {
            if (!event.latitude || !event.longitude) return
            setSOSLocations(prev =>
                prev.map(sos =>
                    sos.id === event.sosId
                        ? { ...sos, lng: event.longitude, lat: event.latitude }
                        : sos
                )
            )
        })

        socket.on('sos:status:updated', (event: any) => {
            if (event.status === 'RESOLVED' || event.status === 'CANCELLED') {
                setSOSLocations(prev => prev.filter(s => s.id !== event.sosId))
            }
        })

        return () => {
            socket.off('sos:new')
            socket.off('sos:location:updated')
            socket.off('sos:status:updated')
        }
    }, [socket])

    // Initialize Map with zoom-adaptive marker scaling
    useEffect(() => {
        if (map.current || !mapContainer.current) return

        try {
            const apiKey = import.meta.env.VITE_MAPTILER_API_KEY
            if (!apiKey) {
                setError('MapTiler API key missing')
                setLoading(false)
                return
            }

            maptilersdk.config.apiKey = apiKey

            const mapInstance = new maptilersdk.Map({
                container: mapContainer.current,
                style: maptilersdk.MapStyle.STREETS,
                center: defaultCenter,
                zoom: 12.5,
            })
            map.current = mapInstance

            // Dynamic scale update based on zoom level:
            // High Zoom (15+): 1.05 (detailed street level)
            // City Zoom (12-14): 0.70 - 0.85 (compact)
            // Region Zoom (9-11): 0.40 - 0.55 (small dot)
            // National Zoom (<=7): 0.20 (micro beacon dot - clean and never cluttering)
            const updateIconScale = () => {
                if (!mapContainer.current || !map.current) return
                const z = map.current.getZoom()
                // Smooth responsive scale from 0.20 (at zoom 5) to 1.05 (at zoom 15)
                const normalized = Math.max(0, Math.min(1, (z - 5) / 10))
                const s = 0.20 + Math.pow(normalized, 1.45) * 0.85
                mapContainer.current.style.setProperty('--map-icon-scale', s.toFixed(3))
            }

            mapInstance.on('load', () => {
                setLoading(false)
                updateIconScale()
                mapInstance.addControl(new maptilersdk.NavigationControl(), 'top-right')

                mapInstance.addSource('zone-circles', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                })

                mapInstance.addLayer({
                    id: 'zone-circles-fill',
                    type: 'fill',
                    source: 'zone-circles',
                    paint: {
                        'fill-color': ['get', 'color'],
                        'fill-opacity': 0.16,
                    }
                })

                mapInstance.addLayer({
                    id: 'zone-circles-outline',
                    type: 'line',
                    source: 'zone-circles',
                    paint: {
                        'line-color': ['get', 'color'],
                        'line-width': 1.8,
                    }
                })
            })

            mapInstance.on('zoom', updateIconScale)

            mapInstance.on('error', () => {
                setError('Failed to render MapTiler tiles')
                setLoading(false)
            })
        } catch (err) {
            console.error(err)
            setError('Map initialization failed')
            setLoading(false)
        }

        return () => {
            map.current?.remove()
            map.current = null
        }
    }, [])

    // Update Markers strictly at stable exact GPS coordinates with zero jitter
    useEffect(() => {
        if (!map.current || loading) return

        const currentMarkerKeys = new Set<string>()

        const getZoneColor = (type: string, severity: string) => {
            if (type === 'safe') return '#10B981'
            if (severity === 'critical' || type === 'danger') return '#EF4444'
            if (severity === 'high') return '#F97316'
            return '#3B82F6'
        }

        const createCirclePolygon = (center: [number, number], radiusMeters: number, points: number = 64): number[][] => {
            const coords: number[][] = []
            const earthRadius = 6371000
            const [lng, lat] = center

            for (let i = 0; i <= points; i++) {
                const angle = (i / points) * 2 * Math.PI
                const latOffset = (radiusMeters / earthRadius) * Math.cos(angle) * (180 / Math.PI)
                const lngOffset = (radiusMeters / earthRadius) * Math.sin(angle) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180)
                coords.push([lng + lngOffset, lat + latOffset])
            }
            return coords
        }

        // Zone polygon overlays
        if (showZones && map.current?.getSource('zone-circles')) {
            const circleFeatures = zones.map(zone => ({
                type: 'Feature' as const,
                properties: { id: zone.id, name: zone.name, type: zone.type, severity: zone.severity, color: getZoneColor(zone.type, zone.severity) },
                geometry: { type: 'Polygon' as const, coordinates: [createCirclePolygon(zone.center, zone.radius)] }
            }))

            const source = map.current.getSource('zone-circles') as maptilersdk.GeoJSONSource
            source.setData({ type: 'FeatureCollection', features: circleFeatures })

            zones.forEach(zone => {
                const key = `zone-${zone.id}`
                currentMarkerKeys.add(key)
                const color = getZoneColor(zone.type, zone.severity)

                if (!markersRef.current[key]) {
                    const el = document.createElement('div')
                    el.className = 'map-marker-container'
                    el.innerHTML = `
                        <div class="map-marker-inner">
                            <div style="width:24px;height:24px;border-radius:8px;background:#FFFFFF;border:2px solid ${color};box-shadow:0 2px 8px rgba(0,0,0,0.12);display:flex;align-items:center;justify-content:center;">
                                <span style="width:8px;height:8px;border-radius:50%;background:${color};"></span>
                            </div>
                        </div>
                    `

                    const popupHtml = `
                        <div style="font-family:'Plus Jakarta Sans',sans-serif;padding:6px 2px;">
                            <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:${color};letter-spacing:0.5px;">${zone.type.toUpperCase()}</span>
                            <h4 style="margin:2px 0 4px;font-size:13px;font-weight:700;color:#0F172A;">${zone.name}</h4>
                            <div style="font-size:11px;color:#64748B;">Radius: ${zone.radius}m • Severity: ${zone.severity}</div>
                        </div>
                    `

                    const marker = new maptilersdk.Marker({ element: el, anchor: 'center' })
                        .setLngLat(zone.center)
                        .setPopup(new maptilersdk.Popup({ offset: 15 }).setHTML(popupHtml))
                        .addTo(map.current!)
                    markersRef.current[key] = marker
                } else {
                    const cur = markersRef.current[key].getLngLat()
                    if (Math.abs(cur.lng - zone.center[0]) > 0.000001 || Math.abs(cur.lat - zone.center[1]) > 0.000001) {
                        markersRef.current[key].setLngLat(zone.center)
                    }
                }
            })
        } else if (!showZones && map.current?.getSource('zone-circles')) {
            const source = map.current.getSource('zone-circles') as maptilersdk.GeoJSONSource
            source.setData({ type: 'FeatureCollection', features: [] })
        }

        // Active SOS Markers - Glitch-Free Hardware-Accelerated Radar Pulse + Exact Real GPS Coordinates
        sosLocations.forEach((sos) => {
            const key = `sos-${sos.id}`
            currentMarkerKeys.add(key)

            const lng = sos.lng
            const lat = sos.lat

            if (!markersRef.current[key]) {
                const el = document.createElement('div')
                el.className = 'map-marker-container'
                el.innerHTML = `
                    <div class="map-marker-inner">
                        <div class="sos-core-dot">
                            <span class="sos-radar-pulse"></span>
                            <span class="sos-inner-pip"></span>
                        </div>
                    </div>
                `

                const popupHtml = `
                    <div style="font-family:'Plus Jakarta Sans',sans-serif;padding:6px 2px;min-width:160px;">
                        <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#FF2D78;letter-spacing:0.5px;">CRITICAL EMERGENCY</span>
                        <h4 style="margin:2px 0 4px;font-size:13px;font-weight:700;color:#0F172A;">${sos.userName}</h4>
                        <div style="font-size:11px;color:#64748B;margin-bottom:8px;">Phone: ${sos.phone || 'Emergency Direct Link'}</div>
                        <button onclick="window.resolveSosBeacon && window.resolveSosBeacon('${sos.id}')" style="width:100%;padding:6px 10px;border-radius:8px;background:#10B981;color:#FFFFFF;border:none;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;box-shadow:0 1px 4px rgba(16,185,129,0.3);">
                            ✓ Mark Resolved / Clear
                        </button>
                    </div>
                `

                const marker = new maptilersdk.Marker({ element: el, anchor: 'center' })
                    .setLngLat([lng, lat])
                    .setPopup(new maptilersdk.Popup({ offset: 18 }).setHTML(popupHtml))
                    .addTo(map.current!)
                markersRef.current[key] = marker
            } else {
                const cur = markersRef.current[key].getLngLat()
                if (Math.abs(cur.lng - lng) > 0.000001 || Math.abs(cur.lat - lat) > 0.000001) {
                    markersRef.current[key].setLngLat([lng, lat])
                }
            }
        })

        // Guardian Volunteer Markers
        if (showVolunteers) {
            volunteers.forEach((vol) => {
                const key = `vol-${vol.id}`
                currentMarkerKeys.add(key)

                const isAvail = vol.status === 'available'
                const pinColor = isAvail ? '#10B981' : '#3B82F6'
                const lng = vol.lng
                const lat = vol.lat

                if (!markersRef.current[key]) {
                    const el = document.createElement('div')
                    el.className = 'map-marker-container'
                    el.innerHTML = `
                        <div class="map-marker-inner">
                            <div style="width:24px;height:24px;border-radius:50%;background:${pinColor};border:2.5px solid #FFFFFF;box-shadow:0 3px 8px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;">
                                <span style="width:6px;height:6px;border-radius:50%;background:#FFFFFF;"></span>
                            </div>
                        </div>
                    `

                    const popupHtml = `
                        <div style="font-family:'Plus Jakarta Sans',sans-serif;padding:6px 2px;">
                            <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:${pinColor};letter-spacing:0.5px;">GUARDIAN RESPONDER</span>
                            <h4 style="margin:2px 0 4px;font-size:13px;font-weight:700;color:#0F172A;">${vol.name}</h4>
                            <div style="font-size:11px;color:#64748B;">ID: ${vol.governmentId || 'Verified Unit'} • ${vol.status.toUpperCase()}</div>
                        </div>
                    `

                    const marker = new maptilersdk.Marker({ element: el, anchor: 'center' })
                        .setLngLat([lng, lat])
                        .setPopup(new maptilersdk.Popup({ offset: 15 }).setHTML(popupHtml))
                        .addTo(map.current!)
                    markersRef.current[key] = marker
                } else {
                    const cur = markersRef.current[key].getLngLat()
                    if (Math.abs(cur.lng - lng) > 0.000001 || Math.abs(cur.lat - lat) > 0.000001) {
                        markersRef.current[key].setLngLat([lng, lat])
                    }
                }
            })
        }

        // Civilian User Markers
        if (showUsers) {
            users.forEach((user) => {
                // If user is already shown as active SOS, skip duplicate marker
                if (sosLocations.some(s => s.userName === user.name || (s.phone && s.phone === user.phone))) return

                const key = `user-${user.id}`
                currentMarkerKeys.add(key)
                const lng = user.lng
                const lat = user.lat

                if (!markersRef.current[key]) {
                    const el = document.createElement('div')
                    el.className = 'map-marker-container'
                    el.innerHTML = `
                        <div class="map-marker-inner">
                            <div style="width:14px;height:14px;border-radius:50%;background:#6366F1;border:2px solid #FFFFFF;box-shadow:0 2px 5px rgba(0,0,0,0.12);"></div>
                        </div>
                    `

                    const marker = new maptilersdk.Marker({ element: el, anchor: 'center' })
                        .setLngLat([lng, lat])
                        .setPopup(new maptilersdk.Popup({ offset: 10 }).setHTML(`
                            <div style="font-family:'Plus Jakarta Sans',sans-serif;padding:4px;">
                                <div style="font-size:12px;font-weight:700;color:#0F172A;">${user.name}</div>
                                <div style="font-size:11px;color:#64748B;">Registered Civilian</div>
                            </div>
                        `))
                        .addTo(map.current!)
                    markersRef.current[key] = marker
                } else {
                    const cur = markersRef.current[key].getLngLat()
                    if (Math.abs(cur.lng - lng) > 0.000001 || Math.abs(cur.lat - lat) > 0.000001) {
                        markersRef.current[key].setLngLat([lng, lat])
                    }
                }
            })
        }

        // Remove old / deactivated markers
        Object.keys(markersRef.current).forEach(key => {
            if (!currentMarkerKeys.has(key)) {
                markersRef.current[key].remove()
                delete markersRef.current[key]
            }
        })

        // Fit bounds ONCE on initial real data load so map doesn't twitch/glitch on updates
        if (!hasFittedBoundsRef.current && map.current) {
            const allPoints: [number, number][] = [
                ...sosLocations.map(s => [s.lng, s.lat] as [number, number]),
                ...volunteers.map(v => [v.lng, v.lat] as [number, number]),
                ...zones.map(z => z.center),
                ...users.map(u => [u.lng, u.lat] as [number, number]),
            ].filter(p => p[0] > 60 && p[0] < 90 && p[1] > 8 && p[1] < 38) // Valid India coordinates

            if (allPoints.length > 0) {
                const bounds = new maptilersdk.LngLatBounds()
                allPoints.forEach(p => bounds.extend(p))
                map.current.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1200 })
                hasFittedBoundsRef.current = true
            }
        }
    }, [sosLocations, volunteers, zones, users, showVolunteers, showZones, showUsers, loading])

    return (
        <div className="relative w-full h-full min-h-[440px] rounded-2xl overflow-hidden bg-slate-50">
            <div ref={mapContainer} className="absolute inset-0 w-full h-full" style={{ '--map-icon-scale': '1' } as any} />

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-10">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
                        <span className="text-xs font-semibold text-slate-700">Connecting Satellite Telemetry...</span>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-20 p-6">
                    <div className="text-center p-6 rounded-2xl bg-white border border-red-200 shadow-lg max-w-sm">
                        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-900 mb-1">{error}</p>
                        <p className="text-xs text-slate-500">Verify VITE_MAPTILER_API_KEY environment configuration.</p>
                    </div>
                </div>
            )}

            {/* 🎯 Modern Bright Pill Filter Controls (Matching Reference Mockup) */}
            {!loading && !error && (
                <div className="absolute top-4 left-4 flex items-center gap-2 z-10 flex-wrap">
                    <button
                        onClick={() => setShowUsers(!showUsers)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 ${
                            showUsers
                                ? 'bg-white text-slate-800 border border-slate-200/90 shadow-sm'
                                : 'bg-white/80 text-slate-400 border border-slate-200/50'
                        }`}
                    >
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Users ({users.length})</span>
                    </button>

                    <button
                        onClick={() => setShowVolunteers(!showVolunteers)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 ${
                            showVolunteers
                                ? 'bg-white text-slate-800 border border-slate-200/90 shadow-sm'
                                : 'bg-white/80 text-slate-400 border border-slate-200/50'
                        }`}
                    >
                        <Shield className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Guardians ({volunteers.length})</span>
                    </button>

                    <button
                        onClick={() => setShowZones(!showZones)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 ${
                            showZones
                                ? 'bg-white text-slate-800 border border-slate-200/90 shadow-sm'
                                : 'bg-white/80 text-slate-400 border border-slate-200/50'
                        }`}
                    >
                        <MapPin className="w-3.5 h-3.5 text-blue-500" />
                        <span>Havens ({zones.length})</span>
                    </button>
                </div>
            )}

            {/* 🎯 Real-Time Status Beacon Pill */}
            {!loading && !error && (
                <div className="absolute top-4 right-14 z-10">
                    <div className="px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-sm flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                        <span>GPS Live Radar</span>
                        {sosLocations.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold border border-red-200 animate-pulse">
                                {sosLocations.length} ACTIVE SOS
                            </span>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .map-marker-container {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    user-select: none;
                    pointer-events: auto;
                    position: relative;
                }
                .map-marker-inner {
                    transform: scale(var(--map-icon-scale, 1));
                    transform-origin: center center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: 100%;
                    pointer-events: auto;
                }
                .sos-core-dot {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: #FF2D78;
                    border: 2.5px solid #FFFFFF;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }
                .sos-inner-pip {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #FFFFFF;
                    position: relative;
                    z-index: 2;
                }
                .sos-radar-pulse {
                    position: absolute;
                    inset: -4px;
                    border-radius: 50%;
                    background: rgba(255, 45, 120, 0.3);
                    border: 1.5px solid #FF2D78;
                    animation: sosRadarPing 2s cubic-bezier(0, 0, 0.2, 1) infinite;
                    pointer-events: none;
                    will-change: transform, opacity;
                    z-index: 1;
                }
                @keyframes sosRadarPing {
                    0% {
                        transform: scale(0.6);
                        opacity: 0.95;
                    }
                    70% {
                        transform: scale(2.6);
                        opacity: 0;
                    }
                    100% {
                        transform: scale(2.6);
                        opacity: 0;
                    }
                }
            `}</style>
        </div>
    )
}
