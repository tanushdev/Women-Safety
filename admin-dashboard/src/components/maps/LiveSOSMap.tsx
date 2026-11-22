import { useEffect, useRef, useState, useCallback } from 'react'
import * as maptilersdk from '@maptiler/sdk'
import '@maptiler/sdk/dist/maptiler-sdk.css'
import { useSocket } from '../../hooks/useSocket'
import { API_URL } from '@/config/api'
import { Shield, MapPin, AlertTriangle, Crosshair } from 'lucide-react'

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

// Normalizes coordinates to GeoJSON [longitude, latitude]
function normalizeCoords(c1: number, c2: number): [number, number] {
    if (typeof c1 !== 'number' || typeof c2 !== 'number' || isNaN(c1) || isNaN(c2)) {
        return [73.165, 18.94]
    }
    // In India: Latitude is 6-38, Longitude is 65-100
    if (c1 >= 6.0 && c1 <= 38.0 && c2 >= 65.0 && c2 <= 100.0) {
        return [c2, c1] // Was [lat, lng], swapped to [lng, lat]
    }
    return [c1, c2]
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
    const [showUsers] = useState(false) // Off by default to avoid stale user clutter

    const defaultCenter: [number, number] = [73.165, 18.94]

    // One-click resolve callback for popup buttons
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

    // Fetch live map data
    useEffect(() => {
        let isMounted = true
        const fetchData = async () => {
            const headers = { 'ngrok-skip-browser-warning': 'true' }

            try {
                const [sosRes, volRes, usersRes, zonesRes] = await Promise.all([
                    fetch(`${API_URL}/sos?status=TRIGGERED,IN_PROGRESS`, { headers }).catch(() => null),
                    fetch(`${API_URL}/volunteers?verificationStatus=verified`, { headers }).catch(() => null),
                    fetch(`${API_URL}/users`, { headers }).catch(() => null),
                    fetch(`${API_URL}/zones`, { headers }).catch(() => null)
                ])

                if (!isMounted) return

                if (sosRes && sosRes.ok) {
                    const data = await sosRes.json()
                    const rawList = Array.isArray(data) ? data : []

                    const valid = rawList
                        .filter((sos: any) => {
                            const rawCoords = sos.currentLocation?.coordinates || sos.initialLocation?.coordinates
                            return rawCoords && rawCoords[0] !== 0 && rawCoords[1] !== 0
                        })
                        .map((sos: any) => {
                            const rawCoords = sos.currentLocation?.coordinates || sos.initialLocation?.coordinates
                            const [lng, lat] = normalizeCoords(rawCoords[0], rawCoords[1])
                            const userObj = typeof sos.userId === 'object' && sos.userId !== null ? sos.userId : null
                            return {
                                id: sos._id,
                                userId: userObj?._id || (typeof sos.userId === 'string' ? sos.userId : undefined),
                                lng,
                                lat,
                                status: (sos.status || 'TRIGGERED').toLowerCase(),
                                userName: userObj?.name || sos.userName || 'Citizen Alert',
                                phone: userObj?.phone || sos.userPhone || '',
                                createdAt: sos.createdAt || new Date().toISOString(),
                            }
                        })

                    valid.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

                    // Deduplicate test alerts
                    const userSOSMap = new Map<string, SOSLocation>()
                    valid.forEach((item: any) => {
                        const dedupeKey = item.userId || item.phone || item.id
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
                        .map((v: any) => {
                            const [lng, lat] = normalizeCoords(v.currentLocation.coordinates[0], v.currentLocation.coordinates[1])
                            return {
                                id: v._id,
                                lng,
                                lat,
                                name: v.userId?.name || 'Volunteer',
                                status: v.status || 'available',
                                governmentId: v.governmentId,
                            }
                        })
                    setVolunteers(vols)
                }

                if (usersRes && usersRes.ok) {
                    const usersData = await usersRes.json()
                    const usersList = (Array.isArray(usersData) ? usersData : [])
                        .filter((u: any) => u.lastLocation?.coordinates &&
                            u.lastLocation.coordinates[0] !== 0 &&
                            u.lastLocation.coordinates[1] !== 0)
                        .map((u: any) => {
                            const [lng, lat] = normalizeCoords(u.lastLocation.coordinates[0], u.lastLocation.coordinates[1])
                            return {
                                id: u._id,
                                lng,
                                lat,
                                name: u.name || 'User',
                                phone: u.phone,
                            }
                        })
                    setUsers(usersList)
                }

                if (zonesRes && zonesRes.ok) {
                    const zonesData = await zonesRes.json()
                    const zonesList = (Array.isArray(zonesData) ? zonesData : [])
                        .filter((z: any) => z.centerPoint?.coordinates &&
                            z.centerPoint.coordinates[0] !== 0 &&
                            z.centerPoint.coordinates[1] !== 0)
                        .map((z: any) => {
                            const normalized = normalizeCoords(z.centerPoint.coordinates[0], z.centerPoint.coordinates[1])
                            return {
                                id: z._id,
                                name: z.name,
                                type: z.type,
                                severity: z.severity || 'medium',
                                center: normalized,
                                radius: z.radius || 500,
                            }
                        })
                    setZones(zonesList)
                }

            } catch (err) {
                console.error('Error fetching live map data:', err)
            }
        }

        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => {
            isMounted = false
            clearInterval(interval)
        }
    }, [])

    // WebSocket live event updates
    useEffect(() => {
        if (!socket) return

        socket.on('sos:new', (event: any) => {
            const coords = event.location?.coordinates || event.initialLocation?.coordinates
            if (!coords || coords[0] === 0 || coords[1] === 0) return

            const [lng, lat] = normalizeCoords(coords[0], coords[1])
            const userObj = typeof event.userId === 'object' && event.userId !== null ? event.userId : null

            const newSos: SOSLocation = {
                id: event._id || event.id,
                userId: userObj?._id || (typeof event.userId === 'string' ? event.userId : undefined),
                lng,
                lat,
                status: (event.status || 'triggered').toLowerCase(),
                userName: userObj?.name || event.userName || 'Citizen Alert',
                phone: userObj?.phone || event.userPhone || '',
                createdAt: event.createdAt || new Date().toISOString(),
            }

            setSOSLocations(prev => [newSos, ...prev.filter(s => s.id !== newSos.id)])

            // Smoothly pan to the new emergency point
            if (map.current) {
                map.current.flyTo({ center: [lng, lat], zoom: 14, duration: 800 })
            }
        })

        socket.on('sos:location:updated', (event: any) => {
            if (!event.latitude || !event.longitude) return
            const [lng, lat] = normalizeCoords(event.longitude, event.latitude)
            setSOSLocations(prev =>
                prev.map(sos =>
                    sos.id === event.sosId
                        ? { ...sos, lng, lat }
                        : sos
                )
            )
        })

        socket.on('sos:status:updated', (event: any) => {
            if (event.status === 'RESOLVED' || event.status === 'CANCELLED') {
                setSOSLocations(prev => prev.filter(s => s.id !== event.sosId))
                if (markersRef.current[`sos-${event.sosId}`]) {
                    markersRef.current[`sos-${event.sosId}`].remove()
                    delete markersRef.current[`sos-${event.sosId}`]
                }
            }
        })

        return () => {
            socket.off('sos:new')
            socket.off('sos:location:updated')
            socket.off('sos:status:updated')
        }
    }, [socket])

    // Initialize Map with stable default coordinates
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
                zoom: 13,
            })
            map.current = mapInstance

            mapInstance.on('load', () => {
                setLoading(false)
                mapInstance.addControl(new maptilersdk.NavigationControl({ showCompass: false }), 'top-right')

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
                        'fill-opacity': 0.15,
                    }
                })

                mapInstance.addLayer({
                    id: 'zone-circles-outline',
                    type: 'line',
                    source: 'zone-circles',
                    paint: {
                        'line-color': ['get', 'color'],
                        'line-width': 1.5,
                    }
                })
            })

            mapInstance.on('error', () => {
                setError('Failed to render Map tiles')
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

    // ResizeObserver ensures canvas always fills parent container
    useEffect(() => {
        if (!mapContainer.current) return
        const ro = new ResizeObserver(() => {
            if (map.current) {
                map.current.resize()
            }
        })
        ro.observe(mapContainer.current)
        return () => ro.disconnect()
    }, [])

    // Render Markers at EXACT GPS Coordinates (Fixed Stable Dimensions, Zero Drift)
    useEffect(() => {
        if (!map.current || loading) return

        const currentMarkerKeys = new Set<string>()

        // 1. Zone Circles
        if (showZones && map.current.getSource('zone-circles')) {
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
                    el.className = 'haven-marker'
                    el.style.cssText = `width:20px;height:20px;border-radius:50%;background:#FFFFFF;border:3px solid ${color};box-shadow:0 1px 4px rgba(0,0,0,0.15);cursor:pointer;`

                    const popupHtml = `
                        <div style="font-family:sans-serif;padding:4px 2px;">
                            <span style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase;">${zone.type}</span>
                            <div style="font-size:12px;font-weight:700;color:#0F172A;margin-top:2px;">${zone.name}</div>
                            <div style="font-size:10px;color:#64748B;">Radius: ${zone.radius}m</div>
                        </div>
                    `

                    const marker = new maptilersdk.Marker({ element: el, anchor: 'center' })
                        .setLngLat(zone.center)
                        .setPopup(new maptilersdk.Popup({ offset: 12 }).setHTML(popupHtml))
                        .addTo(map.current!)
                    markersRef.current[key] = marker
                } else {
                    markersRef.current[key].setLngLat(zone.center)
                }
            })
        } else if (!showZones && map.current?.getSource('zone-circles')) {
            const source = map.current.getSource('zone-circles') as maptilersdk.GeoJSONSource
            source.setData({ type: 'FeatureCollection', features: [] })
        }

        // 2. Active SOS Markers - High-Precision Red Beacon (Fixed Size 26px, No Scaling Glitches)
        sosLocations.forEach((sos) => {
            const key = `sos-${sos.id}`
            currentMarkerKeys.add(key)

            if (!markersRef.current[key]) {
                const el = document.createElement('div')
                el.className = 'sos-marker'
                el.innerHTML = `
                    <div style="position:relative;width:26px;height:26px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
                        <span style="position:absolute;inset:-6px;border-radius:50%;background:rgba(239,68,68,0.3);border:1.5px solid #EF4444;animation:sosPing 1.8s cubic-bezier(0,0,0.2,1) infinite;"></span>
                        <div style="width:22px;height:22px;border-radius:50%;background:#EF4444;border:2.5px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
                            <span style="width:6px;height:6px;border-radius:50%;background:#FFFFFF;"></span>
                        </div>
                    </div>
                `

                const popupHtml = `
                    <div style="font-family:sans-serif;padding:6px 2px;min-width:150px;">
                        <span style="font-size:10px;font-weight:700;color:#EF4444;text-transform:uppercase;">EMERGENCY SOS</span>
                        <div style="font-size:13px;font-weight:700;color:#0F172A;margin:2px 0 4px;">${sos.userName}</div>
                        <div style="font-size:11px;color:#64748B;margin-bottom:8px;">${sos.phone || 'Phone Alert'}</div>
                        <button onclick="window.resolveSosBeacon && window.resolveSosBeacon('${sos.id}')" style="width:100%;padding:5px 8px;border-radius:6px;background:#10B981;color:#FFFFFF;border:none;font-size:11px;font-weight:600;cursor:pointer;">
                            Mark Resolved
                        </button>
                    </div>
                `

                const marker = new maptilersdk.Marker({ element: el, anchor: 'center' })
                    .setLngLat([sos.lng, sos.lat])
                    .setPopup(new maptilersdk.Popup({ offset: 16 }).setHTML(popupHtml))
                    .addTo(map.current!)
                markersRef.current[key] = marker
            } else {
                markersRef.current[key].setLngLat([sos.lng, sos.lat])
            }
        })

        // 3. Volunteers (Guardians) - Green Pins (Fixed Size 20px)
        if (showVolunteers) {
            volunteers.forEach((vol) => {
                const key = `vol-${vol.id}`
                currentMarkerKeys.add(key)

                if (!markersRef.current[key]) {
                    const el = document.createElement('div')
                    el.className = 'vol-marker'
                    el.innerHTML = `
                        <div style="width:20px;height:20px;border-radius:50%;background:#10B981;border:2px solid #FFFFFF;box-shadow:0 2px 5px rgba(0,0,0,0.2);cursor:pointer;display:flex;align-items:center;justify-content:center;">
                            <span style="width:5px;height:5px;border-radius:50%;background:#FFFFFF;"></span>
                        </div>
                    `

                    const popupHtml = `
                        <div style="font-family:sans-serif;padding:4px;">
                            <span style="font-size:10px;font-weight:700;color:#10B981;text-transform:uppercase;">Volunteer</span>
                            <div style="font-size:12px;font-weight:700;color:#0F172A;margin-top:2px;">${vol.name}</div>
                            <div style="font-size:10px;color:#64748B;">Status: ${vol.status}</div>
                        </div>
                    `

                    const marker = new maptilersdk.Marker({ element: el, anchor: 'center' })
                        .setLngLat([vol.lng, vol.lat])
                        .setPopup(new maptilersdk.Popup({ offset: 12 }).setHTML(popupHtml))
                        .addTo(map.current!)
                    markersRef.current[key] = marker
                } else {
                    markersRef.current[key].setLngLat([vol.lng, vol.lat])
                }
            })
        }

        // 4. Civilian Users - Clean Small Indigo Dots
        if (showUsers) {
            users.forEach((user) => {
                if (sosLocations.some(s => s.userName === user.name)) return

                const key = `user-${user.id}`
                currentMarkerKeys.add(key)

                if (!markersRef.current[key]) {
                    const el = document.createElement('div')
                    el.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#6366F1;border:2px solid #FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,0.15);cursor:pointer;'

                    const marker = new maptilersdk.Marker({ element: el, anchor: 'center' })
                        .setLngLat([user.lng, user.lat])
                        .setPopup(new maptilersdk.Popup({ offset: 10 }).setHTML(`
                            <div style="font-family:sans-serif;padding:3px;font-size:11px;font-weight:600;color:#0F172A;">${user.name}</div>
                        `))
                        .addTo(map.current!)
                    markersRef.current[key] = marker
                } else {
                    markersRef.current[key].setLngLat([user.lng, user.lat])
                }
            })
        }

        // Clean up stale markers
        Object.keys(markersRef.current).forEach(key => {
            if (!currentMarkerKeys.has(key)) {
                markersRef.current[key].remove()
                delete markersRef.current[key]
            }
        })

        // On first load, focus on active SOS beacon if available
        if (!hasFittedBoundsRef.current && map.current) {
            if (sosLocations.length > 0) {
                map.current.flyTo({
                    center: [sosLocations[0].lng, sosLocations[0].lat],
                    zoom: 13.5,
                    duration: 600,
                })
                hasFittedBoundsRef.current = true
            } else {
                map.current.flyTo({
                    center: defaultCenter,
                    zoom: 13,
                    duration: 600,
                })
                hasFittedBoundsRef.current = true
            }
        }
    }, [sosLocations, volunteers, zones, users, showVolunteers, showZones, showUsers, loading])

    // Center view on active SOS or default city
    const fitView = useCallback(() => {
        if (!map.current) return
        if (sosLocations.length > 0) {
            map.current.flyTo({
                center: [sosLocations[0].lng, sosLocations[0].lat],
                zoom: 14,
                duration: 600,
            })
        } else {
            map.current.flyTo({ center: defaultCenter, zoom: 13, duration: 600 })
        }
    }, [sosLocations])

    return (
        <div className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden bg-slate-100">
            <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                    <span className="text-xs font-medium text-slate-600">Loading map...</span>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-20 p-4">
                    <div className="text-center p-4 rounded-xl bg-white border border-red-200 shadow-sm max-w-xs">
                        <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-1.5" />
                        <p className="text-xs font-bold text-slate-900">{error}</p>
                    </div>
                </div>
            )}

            {/* Filter Controls (Simple, Compact) */}
            {!loading && !error && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10 flex-wrap">
                    <button
                        onClick={() => setShowVolunteers(!showVolunteers)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shadow-xs flex items-center gap-1.5 ${
                            showVolunteers
                                ? 'bg-white text-slate-800 border border-slate-200'
                                : 'bg-white/70 text-slate-400 border border-slate-200/50'
                        }`}
                    >
                        <Shield className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Volunteers ({volunteers.length})</span>
                    </button>

                    <button
                        onClick={() => setShowZones(!showZones)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shadow-xs flex items-center gap-1.5 ${
                            showZones
                                ? 'bg-white text-slate-800 border border-slate-200'
                                : 'bg-white/70 text-slate-400 border border-slate-200/50'
                        }`}
                    >
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>Safe Zones ({zones.length})</span>
                    </button>

                    <button
                        onClick={fitView}
                        title="Center map on active alert"
                        className="px-3 py-1 rounded-full bg-white text-slate-700 border border-slate-200 shadow-xs text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 transition-colors"
                    >
                        <Crosshair className="w-3.5 h-3.5 text-slate-500" />
                        <span>Center</span>
                    </button>
                </div>
            )}

            {/* Simple Status Pill */}
            {!loading && !error && sosLocations.length > 0 && (
                <div className="absolute top-3 right-12 z-10">
                    <div className="px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 shadow-xs flex items-center gap-1.5 text-xs font-semibold animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span>{sosLocations.length} Active Alert{sosLocations.length > 1 ? 's' : ''}</span>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes sosPing {
                    0% { transform: scale(0.6); opacity: 0.9; }
                    80% { transform: scale(2.4); opacity: 0; }
                    100% { transform: scale(2.4); opacity: 0; }
                }
            `}</style>
        </div>
    )
}
