import { useEffect, useRef, useState } from 'react'
import * as maptilersdk from '@maptiler/sdk'
import '@maptiler/sdk/dist/maptiler-sdk.css'
import { useSocket } from '../../hooks/useSocket'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

interface SOSLocation {
    id: string
    lng: number
    lat: number
    status: string
    userName: string
    phone?: string
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
    const markersRef = useRef<maptilersdk.Marker[]>([])
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

    const defaultCenter: [number, number] = [77.5946, 12.9716]

    // Fetch all data
    useEffect(() => {
        const fetchData = async () => {
            // Header to bypass ngrok's browser warning page
            const headers = { 'ngrok-skip-browser-warning': 'true' }

            try {
                const sosRes = await fetch(`${API_URL}/sos?status=TRIGGERED,IN_PROGRESS`, { headers })
                if (sosRes.ok) {
                    const data = await sosRes.json()
                    const locations = data
                        .filter((sos: any) => {
                            const coords = sos.currentLocation?.coordinates || sos.initialLocation?.coordinates
                            return coords && coords[0] !== 0 && coords[1] !== 0
                        })
                        .map((sos: any) => {
                            const coords = sos.currentLocation?.coordinates || sos.initialLocation?.coordinates
                            return {
                                id: sos._id,
                                lng: coords[0],
                                lat: coords[1],
                                status: sos.status.toLowerCase(),
                                userName: (typeof sos.userId === 'object' && sos.userId !== null) ? sos.userId.name : 'User',
                                phone: (typeof sos.userId === 'object' && sos.userId !== null) ? sos.userId.phone : '',
                            }
                        })
                    setSOSLocations(locations)
                }

                const volRes = await fetch(`${API_URL}/volunteers?verificationStatus=verified`, { headers })
                if (volRes.ok) {
                    const volData = await volRes.json()
                    const vols = volData
                        .filter((v: any) => v.currentLocation?.coordinates &&
                            v.currentLocation.coordinates[0] !== 0 &&
                            v.currentLocation.coordinates[1] !== 0)
                        .map((v: any) => ({
                            id: v._id,
                            lng: v.currentLocation.coordinates[0],
                            lat: v.currentLocation.coordinates[1],
                            name: v.userId?.name || 'Volunteer',
                            status: v.status,
                            governmentId: v.governmentId,
                        }))
                    setVolunteers(vols)
                }

                const usersRes = await fetch(`${API_URL}/users`, { headers })
                if (usersRes.ok) {
                    const usersData = await usersRes.json()
                    const usersList = (usersData.data || usersData || [])
                        .filter((u: any) => {
                            const coords = u.lastLocation?.coordinates
                            return coords && coords[0] !== 0 && coords[1] !== 0 && u.role !== 'volunteer'
                        })
                        .map((u: any) => ({
                            id: u._id,
                            lng: u.lastLocation.coordinates[0],
                            lat: u.lastLocation.coordinates[1],
                            name: u.name || 'User',
                            phone: u.phone,
                        }))
                    setUsers(usersList)
                }

                const zonesRes = await fetch(`${API_URL}/zones`, { headers })
                if (zonesRes.ok) {
                    const zonesData = await zonesRes.json()
                    const zonesList = zonesData
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
                console.error('Error fetching data:', err)
            }
        }

        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => clearInterval(interval)
    }, [])

    // Socket listeners
    useEffect(() => {
        if (!socket) return

        socket.on('sos:new', (event: any) => {
            const coords = event.location?.coordinates
            if (!coords || coords[0] === 0 || coords[1] === 0) return

            const newLocation: SOSLocation = {
                id: event.sosId,
                lng: coords[0],
                lat: coords[1],
                status: 'triggered',
                userName: event.userName || 'User',
                phone: event.userPhone,
            }
            setSOSLocations(prev => {
                if (prev.some(loc => loc.id === newLocation.id)) return prev
                return [newLocation, ...prev]
            })
        })

        socket.on('sos:location:updated', (event: any) => {
            if (!event.longitude || !event.latitude) return
            setSOSLocations(prev => prev.map(loc => {
                if (loc.id === event.sosId) {
                    return { ...loc, lng: event.longitude, lat: event.latitude }
                }
                return loc
            }))
        })

        socket.on('sos:status:updated', (event: any) => {
            if (event.status === 'RESOLVED' || event.status === 'CANCELLED') {
                setSOSLocations(prev => prev.filter(loc => loc.id !== event.sosId))
            } else {
                setSOSLocations(prev => prev.map(loc => {
                    if (loc.id === event.sosId) {
                        return { ...loc, status: event.status.toLowerCase() }
                    }
                    return loc
                }))
            }
        })

        socket.on('user:location:updated', (event: any) => {
            if (!event.latitude || !event.longitude) return
            setUsers(prev => {
                const existingUser = prev.find(u => u.id === event.userId)
                if (existingUser) {
                    return prev.map(u => u.id === event.userId ? { ...u, lng: event.longitude, lat: event.latitude } : u)
                }
                return [...prev, { id: event.userId, lng: event.longitude, lat: event.latitude, name: event.name || 'User', phone: '' }]
            })
        })

        return () => {
            socket.off('sos:new')
            socket.off('sos:location:updated')
            socket.off('sos:status:updated')
            socket.off('user:location:updated')
        }
    }, [socket])

    // Initialize map
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

            map.current = new maptilersdk.Map({
                container: mapContainer.current,
                style: maptilersdk.MapStyle.STREETS,
                center: defaultCenter,
                zoom: 12,
            })

            map.current.on('load', () => {
                setLoading(false)
                map.current?.addControl(new maptilersdk.NavigationControl(), 'top-right')

                map.current?.addSource('zone-circles', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                })

                map.current?.addLayer({
                    id: 'zone-circles-fill',
                    type: 'fill',
                    source: 'zone-circles',
                    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.3 }
                })

                map.current?.addLayer({
                    id: 'zone-circles-outline',
                    type: 'line',
                    source: 'zone-circles',
                    paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.8 }
                })
            })

            map.current.on('error', () => {
                setError('Failed to load map')
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

    // Update markers
    useEffect(() => {
        if (!map.current || loading) return

        markersRef.current.forEach(marker => marker.remove())
        markersRef.current = []

        const getSeverityColor = (severity: string) => {
            switch (severity) {
                case 'low': return '#22c55e'
                case 'medium': return '#f97316'
                case 'high': return '#ef4444'
                case 'critical': return '#dc2626'
                default: return '#f97316'
            }
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

        // Add Zone circles
        if (showZones && map.current?.getSource('zone-circles')) {
            const circleFeatures = zones.map(zone => ({
                type: 'Feature' as const,
                properties: { id: zone.id, name: zone.name, type: zone.type, severity: zone.severity, color: getSeverityColor(zone.severity) },
                geometry: { type: 'Polygon' as const, coordinates: [createCirclePolygon(zone.center, zone.radius)] }
            }))

            const source = map.current.getSource('zone-circles') as maptilersdk.GeoJSONSource
            source.setData({ type: 'FeatureCollection', features: circleFeatures })

            zones.forEach(zone => {
                const severityColor = getSeverityColor(zone.severity)
                const el = document.createElement('div')
                el.style.cssText = `width:28px;height:28px;border-radius:4px;background:${severityColor};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;`
                el.innerHTML = zone.type === 'danger' ? '⚠️' : zone.type === 'safe' ? '✓' : '📍'

                const marker = new maptilersdk.Marker({ element: el })
                    .setLngLat(zone.center)
                    .setPopup(new maptilersdk.Popup({ offset: 15 }).setHTML(`<div style="padding:10px;"><h4 style="margin:0 0 6px 0;font-weight:bold;">${zone.name}</h4><p style="margin:0;font-size:12px;">Type: ${zone.type}</p><p style="margin:0;font-size:12px;">Severity: ${zone.severity}</p></div>`))
                    .addTo(map.current!)
                markersRef.current.push(marker)
            })
        } else if (!showZones && map.current?.getSource('zone-circles')) {
            const source = map.current.getSource('zone-circles') as maptilersdk.GeoJSONSource
            source.setData({ type: 'FeatureCollection', features: [] })
        }

        // Add user markers with SOS overlay
        if (showUsers) {
            users.forEach(user => {
                const hasActiveSOS = sosLocations.some(sos => sos.userName === user.name || sos.phone === user.phone)

                const container = document.createElement('div')
                container.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:center;'

                // Add alarm icon ABOVE the marker if user has active SOS
                if (hasActiveSOS) {
                    const alarmIcon = document.createElement('div')
                    alarmIcon.style.cssText = 'font-size:24px;margin-bottom:-4px;animation:bounce 0.5s infinite alternate;filter:drop-shadow(0 2px 4px rgba(220,38,38,0.5));'
                    alarmIcon.innerHTML = '🚨'
                    container.appendChild(alarmIcon)
                }

                const dot = document.createElement('div')
                dot.style.cssText = `width:${hasActiveSOS ? '24px' : '16px'};height:${hasActiveSOS ? '24px' : '16px'};border-radius:50%;background:${hasActiveSOS ? '#dc2626' : '#6366f1'};border:${hasActiveSOS ? '3px' : '2px'} solid white;box-shadow:${hasActiveSOS ? '0 0 15px rgba(220,38,38,0.7)' : '0 2px 4px rgba(0,0,0,0.3)'};`
                if (hasActiveSOS) dot.style.animation = 'sosPulse 1.5s infinite'
                container.appendChild(dot)

                const marker = new maptilersdk.Marker({ element: container, anchor: 'bottom' })
                    .setLngLat([user.lng, user.lat])
                    .setPopup(new maptilersdk.Popup({ offset: 25 }).setHTML(`<div style="padding:10px;"><h4 style="margin:0 0 4px 0;font-weight:bold;color:${hasActiveSOS ? '#dc2626' : '#333'};">${hasActiveSOS ? '🚨' : '👤'} ${user.name}</h4><p style="margin:0;font-size:12px;color:#666;">${user.phone || 'N/A'}</p>${hasActiveSOS ? '<p style="margin:6px 0 0 0;font-size:11px;color:#dc2626;font-weight:bold;background:#fee2e2;padding:4px 8px;border-radius:4px;">⚠️ ACTIVE SOS</p>' : ''}</div>`))
                    .addTo(map.current!)
                markersRef.current.push(marker)
            })
        }

        // Add volunteer markers
        if (showVolunteers) {
            volunteers.forEach(vol => {
                const el = document.createElement('div')
                el.style.cssText = `width:32px;height:32px;border-radius:50%;background:${vol.status === 'available' ? '#22c55e' : vol.status === 'on_mission' ? '#3b82f6' : '#6b7280'};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:16px;`
                el.innerHTML = '👮'

                const marker = new maptilersdk.Marker({ element: el })
                    .setLngLat([vol.lng, vol.lat])
                    .setPopup(new maptilersdk.Popup({ offset: 20 }).setHTML(`<div style="padding:12px;"><h4 style="margin:0 0 6px 0;font-weight:bold;">👮 ${vol.name}</h4><p style="margin:0 0 4px 0;font-size:12px;background:#e0e7ff;padding:3px 8px;display:inline-block;border-radius:4px;">ID: ${vol.governmentId || 'N/A'}</p><p style="margin:6px 0 0 0;font-size:12px;color:${vol.status === 'available' ? 'green' : 'gray'};font-weight:bold;">● ${vol.status.toUpperCase()}</p></div>`))
                    .addTo(map.current!)
                markersRef.current.push(marker)
            })
        }

        // Fit bounds
        const allPoints: [number, number][] = [
            ...sosLocations.map(s => [s.lng, s.lat] as [number, number]),
            ...volunteers.map(v => [v.lng, v.lat] as [number, number]),
            ...zones.map(z => z.center),
            ...users.map(u => [u.lng, u.lat] as [number, number]),
        ].filter(p => p[0] !== 0 && p[1] !== 0)

        if (allPoints.length > 0) {
            const bounds = new maptilersdk.LngLatBounds()
            allPoints.forEach(p => bounds.extend(p))
            map.current.fitBounds(bounds, { padding: 80, maxZoom: 14 })
        }
    }, [sosLocations, volunteers, zones, users, showVolunteers, showZones, showUsers, loading])

    return (
        <div className="relative w-full h-full min-h-[500px] bg-gray-100 overflow-hidden">
            <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                    <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black mb-2"></div>
                        <p className="text-black font-bold uppercase tracking-wide">Loading Map...</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-20">
                    <div className="text-center p-6 border-2 border-red-500 bg-white shadow-brutal">
                        <p className="text-red-600 font-black mb-2 uppercase">⚠️ {error}</p>
                        <p className="text-sm text-black font-mono">Check console for details</p>
                    </div>
                </div>
            )}

            {/* Toggle Controls */}
            {!loading && !error && (
                <div className="absolute top-4 right-16 flex gap-2 z-10 flex-wrap">
                    <button onClick={() => setShowUsers(!showUsers)} className={`px-3 py-2 border-2 border-black font-bold text-xs ${showUsers ? 'bg-indigo-100' : 'bg-white'}`}>
                        👤 Users ({users.length})
                    </button>
                    <button onClick={() => setShowVolunteers(!showVolunteers)} className={`px-3 py-2 border-2 border-black font-bold text-xs ${showVolunteers ? 'bg-green-100' : 'bg-white'}`}>
                        👮 Volunteers ({volunteers.length})
                    </button>
                    <button onClick={() => setShowZones(!showZones)} className={`px-3 py-2 border-2 border-black font-bold text-xs ${showZones ? 'bg-blue-100' : 'bg-white'}`}>
                        📍 Zones ({zones.length})
                    </button>
                </div>
            )}

            {/* Legend */}
            {!loading && !error && (
                <div className="absolute bottom-4 left-4 bg-white border-2 border-black shadow-brutal p-3 z-10">
                    <div className="font-black text-xs mb-2 uppercase tracking-wide border-b-2 border-black pb-1">Live Tracking</div>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-red-600 animate-pulse border border-white shadow flex-shrink-0"></div>
                            <span className="text-xs font-medium">SOS Alerts ({sosLocations.length})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-green-500 border border-white shadow flex-shrink-0"></div>
                            <span className="text-xs font-medium">Volunteers ({volunteers.filter(v => v.status === 'available').length})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-indigo-500 border border-white shadow flex-shrink-0"></div>
                            <span className="text-xs font-medium">Users ({users.length})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-blue-500 border border-white shadow flex-shrink-0"></div>
                            <span className="text-xs font-medium">Zones ({zones.length})</span>
                        </div>
                        <div className="border-t border-gray-200 pt-1.5 mt-1.5">
                            <span className="text-[10px] font-bold uppercase text-gray-500">Severity:</span>
                            <div className="flex items-center gap-1.5 mt-1">
                                <div className="w-3 h-3 rounded-full bg-green-500 border border-white shadow"></div>
                                <span className="text-[10px]">Low</span>
                                <div className="w-3 h-3 rounded-full bg-orange-500 border border-white shadow ml-1"></div>
                                <span className="text-[10px]">Med</span>
                                <div className="w-3 h-3 rounded-full bg-red-500 border border-white shadow ml-1"></div>
                                <span className="text-[10px]">High</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Emergencies Badge - Bottom Center */}
            {!loading && !error && sosLocations.length > 0 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white border-2 border-black shadow-brutal px-4 py-2 z-10 animate-pulse flex items-center gap-2">
                    <span className="text-xl">🚨</span>
                    <span className="font-black text-lg">{sosLocations.length}</span>
                    <span className="font-bold text-xs uppercase">Active Emergencies</span>
                </div>
            )}

            <style>{`
                @keyframes sosPulse {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
                    50% { transform: scale(1.08); }
                    100% { transform: scale(1); box-shadow: 0 0 0 20px rgba(220, 38, 38, 0); }
                }
                @keyframes bounce {
                    from { transform: translateY(0); }
                    to { transform: translateY(-4px); }
                }
            `}</style>
        </div>
    )
}
