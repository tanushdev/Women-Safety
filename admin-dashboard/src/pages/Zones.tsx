import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import * as maptilersdk from '@maptiler/sdk'
import '@maptiler/sdk/dist/maptiler-sdk.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

interface Zone {
    _id: string
    name: string
    type: 'safe' | 'danger' | 'crowded' | 'police_station' | 'hospital' | 'shelter'
    severity?: 'low' | 'medium' | 'high' | 'critical'
    description?: string
    radius?: number
    centerPoint?: {
        coordinates: [number, number]
    }
    city?: string
    address?: string
    isActive: boolean
    createdAt: string
}

interface ZoneForm {
    name: string
    type: string
    severity: string
    description: string
    latitude: number | null
    longitude: number | null
    radius: number
}

const emptyForm: ZoneForm = {
    name: '',
    type: 'danger',
    severity: 'medium',
    description: '',
    latitude: null,
    longitude: null,
    radius: 500,
}

export function Zones() {
    const [zones, setZones] = useState<Zone[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingZone, setEditingZone] = useState<Zone | null>(null)
    const [selectedType, setSelectedType] = useState<string | null>(null)
    const [form, setForm] = useState<ZoneForm>(emptyForm)
    const [saving, setSaving] = useState(false)

    // Map refs
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<maptilersdk.Map | null>(null)
    const markerRef = useRef<maptilersdk.Marker | null>(null)
    const [mapReady, setMapReady] = useState(false)

    const fetchZones = async () => {
        try {
            setLoading(true)
            const response = await axios.get(`${API_URL}/zones`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            const data = Array.isArray(response.data) ? response.data : []
            setZones(data)
            setError(null)
        } catch (err) {
            console.error('Error fetching zones:', err)
            setError('Failed to load zones')
            setZones([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchZones()
    }, [])

    // Helper function to get severity color
    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'low': return '#22c55e'      // Green
            case 'medium': return '#f97316'   // Orange
            case 'high': return '#ef4444'     // Red
            case 'critical': return '#dc2626' // Dark Red
            default: return '#f97316'         // Default to Orange
        }
    }

    // Helper function to create circle polygon
    const createCirclePolygon = (centerLng: number, centerLat: number, radiusMeters: number, points: number = 64): number[][] => {
        const coords: number[][] = []
        const earthRadius = 6371000 // meters

        for (let i = 0; i <= points; i++) {
            const angle = (i / points) * 2 * Math.PI
            const latOffset = (radiusMeters / earthRadius) * Math.cos(angle) * (180 / Math.PI)
            const lngOffset = (radiusMeters / earthRadius) * Math.sin(angle) * (180 / Math.PI) / Math.cos(centerLat * Math.PI / 180)
            coords.push([centerLng + lngOffset, centerLat + latOffset])
        }
        return coords
    }

    // Initialize map when modal opens
    useEffect(() => {
        if (!showAddModal || !mapContainer.current || map.current) return

        const apiKey = import.meta.env.VITE_MAPTILER_API_KEY
        if (!apiKey) {
            console.error('MapTiler API key missing')
            return
        }

        maptilersdk.config.apiKey = apiKey

        map.current = new maptilersdk.Map({
            container: mapContainer.current,
            style: maptilersdk.MapStyle.STREETS,
            center: [73.1596, 18.9999], // Default center
            zoom: 12,
        })

        map.current.on('load', () => {
            setMapReady(true)

            // Add zone preview circle source
            map.current?.addSource('zone-preview', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            })

            // Add fill layer for zone preview
            map.current?.addLayer({
                id: 'zone-preview-fill',
                type: 'fill',
                source: 'zone-preview',
                paint: {
                    'fill-color': ['get', 'color'],
                    'fill-opacity': 0.3
                }
            })

            // Add outline layer for zone preview
            map.current?.addLayer({
                id: 'zone-preview-outline',
                type: 'line',
                source: 'zone-preview',
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': 2,
                    'line-opacity': 0.8
                }
            })

            // Add click handler
            map.current?.on('click', (e) => {
                const { lng, lat } = e.lngLat
                setForm(prev => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng,
                }))

                // Update or create marker
                if (markerRef.current) {
                    markerRef.current.setLngLat([lng, lat])
                } else {
                    const el = document.createElement('div')
                    el.className = 'zone-marker'
                    el.style.width = '24px'
                    el.style.height = '24px'
                    el.style.borderRadius = '50%'
                    el.style.backgroundColor = getSeverityColor(form.severity)
                    el.style.border = '3px solid white'
                    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
                    el.style.cursor = 'move'

                    markerRef.current = new maptilersdk.Marker({ element: el, draggable: true })
                        .setLngLat([lng, lat])
                        .addTo(map.current!)

                    markerRef.current.on('dragend', () => {
                        const lngLat = markerRef.current?.getLngLat()
                        if (lngLat) {
                            setForm(prev => ({
                                ...prev,
                                latitude: lngLat.lat,
                                longitude: lngLat.lng,
                            }))
                        }
                    })
                }
            })
        })

        return () => {
            map.current?.remove()
            map.current = null
            markerRef.current = null
            setMapReady(false)
        }
    }, [showAddModal])

    // Update marker when editing
    useEffect(() => {
        if (editingZone && map.current && mapReady) {
            const lng = editingZone.centerPoint?.coordinates[0]
            const lat = editingZone.centerPoint?.coordinates[1]
            if (lng && lat) {
                map.current.flyTo({ center: [lng, lat], zoom: 15 })

                if (markerRef.current) {
                    markerRef.current.setLngLat([lng, lat])
                } else {
                    const el = document.createElement('div')
                    el.style.width = '24px'
                    el.style.height = '24px'
                    el.style.borderRadius = '50%'
                    el.style.backgroundColor = getSeverityColor(form.severity)
                    el.style.border = '3px solid white'
                    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'

                    markerRef.current = new maptilersdk.Marker({ element: el, draggable: true })
                        .setLngLat([lng, lat])
                        .addTo(map.current!)

                    markerRef.current.on('dragend', () => {
                        const lngLat = markerRef.current?.getLngLat()
                        if (lngLat) {
                            setForm(prev => ({
                                ...prev,
                                latitude: lngLat.lat,
                                longitude: lngLat.lng,
                            }))
                        }
                    })
                }
            }
        }
    }, [editingZone, mapReady])

    // Update zone preview circle when form changes
    useEffect(() => {
        if (!map.current || !mapReady) return

        const source = map.current.getSource('zone-preview') as maptilersdk.GeoJSONSource
        if (!source) return

        if (form.latitude && form.longitude) {
            const circleCoords = createCirclePolygon(form.longitude, form.latitude, form.radius)
            const color = getSeverityColor(form.severity)

            source.setData({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    properties: { color },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [circleCoords]
                    }
                }]
            })

            // Update marker color if exists
            if (markerRef.current) {
                const el = markerRef.current.getElement()
                if (el) {
                    el.style.backgroundColor = color
                }
            }
        } else {
            source.setData({ type: 'FeatureCollection', features: [] })
        }
    }, [form.latitude, form.longitude, form.radius, form.severity, mapReady])

    const handleSubmit = async () => {
        if (!form.name) {
            alert('Please enter a zone name')
            return
        }
        if (!form.latitude || !form.longitude) {
            alert('Please click on the map to set the zone location')
            return
        }

        setSaving(true)
        try {
            const data = {
                name: form.name,
                type: form.type,
                severity: form.severity,
                description: form.description || '',
                latitude: Number(form.latitude),
                longitude: Number(form.longitude),
                radius: Number(form.radius),
                isActive: true,
            }

            console.log('Sending zone data:', data)

            if (editingZone) {
                await axios.put(`${API_URL}/zones/${editingZone._id}`, data)
            } else {
                await axios.post(`${API_URL}/zones`, data)
            }

            setShowAddModal(false)
            setEditingZone(null)
            setForm(emptyForm)
            fetchZones()
        } catch (err: any) {
            console.error('Error saving zone:', err)
            console.error('Error response:', err.response?.data)
            alert(`Failed to save zone: ${err.response?.data?.message || err.message}`)
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = (zone: Zone) => {
        setEditingZone(zone)
        setForm({
            name: zone.name,
            type: zone.type,
            severity: zone.severity || 'medium',
            description: zone.description || '',
            latitude: zone.centerPoint?.coordinates[1] || null,
            longitude: zone.centerPoint?.coordinates[0] || null,
            radius: zone.radius || 500,
        })
        setShowAddModal(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this zone?')) return

        try {
            await axios.delete(`${API_URL}/zones/${id}`)
            fetchZones()
        } catch (err) {
            console.error('Error deleting zone:', err)
            alert('Failed to delete zone')
        }
    }

    const closeModal = () => {
        setShowAddModal(false)
        setEditingZone(null)
        setForm(emptyForm)
    }

    const filteredZones = selectedType
        ? zones.filter(z => z.type === selectedType)
        : zones

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'safe': return 'bg-green-500'
            case 'danger': return 'bg-red-500'
            case 'crowded': return 'bg-orange-500'
            case 'police_station': return 'bg-blue-500'
            case 'hospital': return 'bg-purple-500'
            case 'shelter': return 'bg-teal-500'
            default: return 'bg-gray-500'
        }
    }

    const getTypeBg = (type: string) => {
        switch (type) {
            case 'safe': return 'bg-green-50'
            case 'danger': return 'bg-red-50'
            case 'crowded': return 'bg-orange-50'
            case 'police_station': return 'bg-blue-50'
            case 'hospital': return 'bg-purple-50'
            case 'shelter': return 'bg-teal-50'
            default: return 'bg-gray-50'
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-tight">Zones</h1>
                    <p className="text-muted-foreground">Click on map to tag safe and danger zones</p>
                </div>
                <button
                    onClick={() => {
                        setEditingZone(null)
                        setForm(emptyForm)
                        setShowAddModal(true)
                    }}
                    className="bg-black text-white border-2 border-black px-6 py-3 font-bold uppercase hover:bg-gray-800 transition-colors"
                >
                    + Add Zone on Map
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border-2 border-red-500 text-red-700 p-4 font-bold">
                    {error}
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div
                    onClick={() => setSelectedType(null)}
                    className={`border-2 border-black p-6 cursor-pointer transition-colors ${!selectedType ? 'bg-secondary' : 'hover:bg-secondary'}`}
                >
                    <div className="text-4xl font-black">{zones.length}</div>
                    <div className="text-sm font-medium uppercase tracking-wide">Total Zones</div>
                </div>
                <div
                    onClick={() => setSelectedType('safe')}
                    className={`border-2 border-black p-6 cursor-pointer transition-colors ${selectedType === 'safe' ? 'bg-green-100' : 'bg-green-50 hover:bg-green-100'}`}
                >
                    <div className="text-4xl font-black text-green-600">
                        {zones.filter(z => z.type === 'safe').length}
                    </div>
                    <div className="text-sm font-medium uppercase tracking-wide">Safe Zones</div>
                </div>
                <div
                    onClick={() => setSelectedType('danger')}
                    className={`border-2 border-black p-6 cursor-pointer transition-colors ${selectedType === 'danger' ? 'bg-red-100' : 'bg-red-50 hover:bg-red-100'}`}
                >
                    <div className="text-4xl font-black text-red-600">
                        {zones.filter(z => z.type === 'danger').length}
                    </div>
                    <div className="text-sm font-medium uppercase tracking-wide">Danger Zones</div>
                </div>
                <div
                    onClick={() => setSelectedType('police_station')}
                    className={`border-2 border-black p-6 cursor-pointer transition-colors ${selectedType === 'police_station' ? 'bg-blue-100' : 'bg-blue-50 hover:bg-blue-100'}`}
                >
                    <div className="text-4xl font-black text-blue-600">
                        {zones.filter(z => z.type === 'police_station').length}
                    </div>
                    <div className="text-sm font-medium uppercase tracking-wide">Police Stations</div>
                </div>
            </div>

            {/* Zones Grid */}
            {filteredZones.length === 0 ? (
                <div className="border-2 border-black p-12 text-center">
                    <p className="text-xl font-bold uppercase">No Zones Found</p>
                    <p className="text-muted-foreground mt-2">Click "Add Zone on Map" to create one</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-4">
                    {filteredZones.map(zone => (
                        <div key={zone._id} className={`border-2 border-black ${getTypeBg(zone.type)}`}>
                            <div className={`${getTypeColor(zone.type)} text-white px-4 py-2 border-b-2 border-black flex items-center justify-between`}>
                                <span className="font-bold uppercase">{zone.type.replace('_', ' ')}</span>
                                <span className={`px-2 py-0.5 text-xs font-bold rounded ${zone.isActive ? 'bg-white text-green-600' : 'bg-gray-200 text-gray-600'}`}>
                                    {zone.severity?.toUpperCase() || 'MEDIUM'}
                                </span>
                            </div>
                            <div className="p-4 space-y-3">
                                <h3 className="font-bold text-lg">{zone.name}</h3>
                                <p className="text-sm text-muted-foreground">{zone.description || 'No description'}</p>

                                <div className="text-sm text-muted-foreground">
                                    📍 Radius: {zone.radius || 500}m
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(zone)}
                                        className="flex-1 border-2 border-black px-3 py-2 font-medium hover:bg-secondary transition-colors"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(zone._id)}
                                        className="flex-1 border-2 border-black px-3 py-2 font-medium hover:bg-red-100 text-red-600 transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Zone Modal with Map */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background border-2 border-black w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b-2 border-black bg-gray-50">
                            <h2 className="text-xl font-bold uppercase">
                                {editingZone ? 'Edit Zone' : 'Add Zone - Click on Map'}
                            </h2>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Map */}
                            <div className="w-1/2 relative">
                                <div ref={mapContainer} className="absolute inset-0" />
                                {!mapReady && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                                    </div>
                                )}
                                {form.latitude && form.longitude && (
                                    <div className="absolute bottom-4 left-4 bg-white border-2 border-black p-2 text-xs font-mono">
                                        {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
                                    </div>
                                )}
                            </div>

                            {/* Form */}
                            <div className="w-1/2 p-4 overflow-y-auto border-l-2 border-black">
                                <div className="space-y-4">
                                    <div className="bg-yellow-50 border-2 border-yellow-500 p-3 text-sm">
                                        👆 <strong>Click on the map</strong> to set zone location. Drag marker to adjust.
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold uppercase mb-1">Zone Name *</label>
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            className="w-full border-2 border-black p-3 focus:outline-none"
                                            placeholder="e.g., Market Area, Railway Station"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold uppercase mb-1">Zone Type</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['safe', 'danger', 'crowded', 'police_station', 'hospital', 'shelter'].map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => setForm({ ...form, type })}
                                                    className={`p-2 border-2 border-black text-sm font-bold uppercase transition-colors ${form.type === type ? getTypeColor(type) + ' text-white' : 'hover:bg-gray-100'
                                                        }`}
                                                >
                                                    {type.replace('_', ' ')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold uppercase mb-1">Severity</label>
                                        <div className="flex gap-2">
                                            {['low', 'medium', 'high', 'critical'].map(sev => (
                                                <button
                                                    key={sev}
                                                    onClick={() => setForm({ ...form, severity: sev })}
                                                    className={`flex-1 p-2 border-2 border-black text-sm font-bold uppercase ${form.severity === sev ? 'bg-black text-white' : 'hover:bg-gray-100'
                                                        }`}
                                                >
                                                    {sev}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold uppercase mb-1">Radius (meters)</label>
                                        <input
                                            type="range"
                                            min="100"
                                            max="2000"
                                            step="100"
                                            value={form.radius}
                                            onChange={e => setForm({ ...form, radius: parseInt(e.target.value) })}
                                            className="w-full"
                                        />
                                        <div className="text-center font-bold">{form.radius}m</div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold uppercase mb-1">Description</label>
                                        <textarea
                                            value={form.description}
                                            onChange={e => setForm({ ...form, description: e.target.value })}
                                            className="w-full border-2 border-black p-3 focus:outline-none resize-none"
                                            rows={2}
                                            placeholder="Describe why this zone is marked..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 p-4 border-t-2 border-black bg-gray-50">
                            <button
                                onClick={closeModal}
                                className="flex-1 border-2 border-black px-4 py-3 font-bold uppercase hover:bg-secondary transition-colors"
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={saving || !form.latitude || !form.longitude}
                                className="flex-1 bg-black text-white border-2 border-black px-4 py-3 font-bold uppercase hover:bg-gray-800 transition-colors disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : (editingZone ? 'Update Zone' : 'Save Zone')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
