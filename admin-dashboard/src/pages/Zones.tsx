import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import * as maptilersdk from '@maptiler/sdk'
import '@maptiler/sdk/dist/maptiler-sdk.css'
import { Plus, MapPin, RefreshCw, Trash2, Edit2, X } from 'lucide-react'
import { API_URL } from '@/config/api'

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
    const [, setError] = useState<string | null>(null)
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
            setError('Failed to load geofenced zones')
            setZones([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchZones()
    }, [])

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return '#EF4444'
            case 'high': return '#F97316'
            case 'medium': return '#EAB308'
            case 'low': return '#10B981'
            default: return '#EAB308'
        }
    }

    const createCirclePolygon = (lng: number, lat: number, radiusMeters: number, points: number = 64) => {
        const coords: [number, number][] = []
        const earthRadius = 6371000
        const d = radiusMeters / earthRadius

        for (let i = 0; i <= points; i++) {
            const bearing = (i * 360 / points) * Math.PI / 180
            const latRad = lat * Math.PI / 180
            const lngRad = lng * Math.PI / 180

            const pLat = Math.asin(
                Math.sin(latRad) * Math.cos(d) +
                Math.cos(latRad) * Math.sin(d) * Math.cos(bearing)
            )
            const pLng = lngRad + Math.atan2(
                Math.sin(bearing) * Math.sin(d) * Math.cos(latRad),
                Math.cos(d) - Math.sin(latRad) * Math.sin(pLat)
            )

            coords.push([pLng * 180 / Math.PI, pLat * 180 / Math.PI])
        }
        return coords
    }

    // Initialize Map when modal opens
    useEffect(() => {
        if (!showAddModal || !mapContainer.current || map.current) return

        const apiKey = import.meta.env.VITE_MAPTILER_API_KEY
        if (!apiKey) return

        maptilersdk.config.apiKey = apiKey

        const defaultCenter: [number, number] = [77.5946, 12.9716]
        const initialCenter = form.longitude && form.latitude
            ? [form.longitude, form.latitude] as [number, number]
            : defaultCenter

        map.current = new maptilersdk.Map({
            container: mapContainer.current,
            style: maptilersdk.MapStyle.STREETS,
            center: initialCenter,
            zoom: 13,
        })

        map.current.on('load', () => {
            setMapReady(true)

            map.current?.addSource('zone-preview', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            })

            map.current?.addLayer({
                id: 'zone-preview-fill',
                type: 'fill',
                source: 'zone-preview',
                paint: {
                    'fill-color': ['get', 'color'],
                    'fill-opacity': 0.25,
                }
            })

            map.current?.addLayer({
                id: 'zone-preview-outline',
                type: 'line',
                source: 'zone-preview',
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': 2,
                }
            })
        })

        map.current.on('click', (e) => {
            const { lng, lat } = e.lngLat
            setForm(prev => ({ ...prev, latitude: lat, longitude: lng }))

            if (markerRef.current) {
                markerRef.current.setLngLat([lng, lat])
            } else {
                const el = document.createElement('div')
                el.style.width = '20px'
                el.style.height = '20px'
                el.style.borderRadius = '50%'
                el.style.backgroundColor = getSeverityColor(form.severity)
                el.style.border = '2px solid white'
                el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'

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
                }
            }
        }
    }, [editingZone, mapReady])

    // Update zone preview circle
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
        }
    }, [form.latitude, form.longitude, form.radius, form.severity, mapReady])

    const handleSubmit = async () => {
        if (!form.name || !form.latitude || !form.longitude) {
            alert('Please provide zone name and set location on map')
            return
        }

        try {
            setSaving(true)
            const payload = {
                name: form.name,
                type: form.type,
                severity: form.severity,
                description: form.description,
                radius: form.radius,
                centerPoint: {
                    type: 'Point',
                    coordinates: [form.longitude, form.latitude]
                },
                isActive: true
            }

            if (editingZone) {
                await axios.patch(`${API_URL}/zones/${editingZone._id}`, payload, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                })
            } else {
                await axios.post(`${API_URL}/zones`, payload, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                })
            }

            fetchZones()
            closeModal()
        } catch (err: any) {
            console.error('Error saving zone:', err)
            alert(`Failed to save zone: ${err.response?.data?.message || err.message}`)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this monitored perimeter?')) return
        try {
            await axios.delete(`${API_URL}/zones/${id}`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            fetchZones()
        } catch (err) {
            console.error('Error deleting zone:', err)
            alert('Failed to delete zone')
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

    const closeModal = () => {
        setShowAddModal(false)
        setEditingZone(null)
        setForm(emptyForm)
    }

    const filteredZones = selectedType
        ? zones.filter(z => z.type === selectedType)
        : zones

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500 font-mono text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-slate-700" />
                <span>QUERYING GEOFENCED RADAR...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="command-panel p-6 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        <span className="text-[10px] font-mono font-semibold tracking-wider text-emerald-700 uppercase">
                            Perimeter Geofencing
                        </span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase font-mono">
                        Safe & Danger Havens
                    </h1>
                    <p className="text-xs text-slate-500 font-mono">Configure verified security boundaries, emergency shelters, and high-risk hotspots</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setEditingZone(null)
                            setForm(emptyForm)
                            setShowAddModal(true)
                        }}
                        className="command-button-primary px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase flex items-center gap-2"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tag New Zone</span>
                    </button>
                </div>
            </div>

            {/* Filter Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
                {[
                    { label: 'ALL ZONES', count: zones.length, filter: null, color: 'text-slate-900' },
                    { label: 'SAFE HAVENS', count: zones.filter(z => z.type === 'safe').length, filter: 'safe', color: 'text-emerald-600' },
                    { label: 'DANGER HOTSPOTS', count: zones.filter(z => z.type === 'danger').length, filter: 'danger', color: 'text-red-600' },
                    { label: 'POLICE POSTS', count: zones.filter(z => z.type === 'police_station').length, filter: 'police_station', color: 'text-blue-600' },
                ].map(item => {
                    const isSelected = selectedType === item.filter
                    return (
                        <div
                            key={item.label}
                            onClick={() => setSelectedType(item.filter)}
                            className={`p-4 rounded-xl cursor-pointer transition-all border ${
                                isSelected
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                    : 'bg-white border-slate-200 hover:bg-slate-50 shadow-sm'
                            }`}
                        >
                            <div className={`text-2xl font-bold tabular-nums ${isSelected ? 'text-white' : item.color}`}>
                                {item.count}
                            </div>
                            <div className={`text-[10px] font-semibold tracking-wider uppercase mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                                {item.label}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Zones Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
                {filteredZones.map(zone => (
                    <div key={zone._id} className="command-card p-5 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-bold text-sm text-slate-900">{zone.name}</h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">{zone.description || 'Monitored area'}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                zone.type === 'safe' ? 'tactical-badge-green' :
                                zone.type === 'danger' ? 'tactical-badge-red' :
                                'tactical-badge-blue'
                            }`}>
                                {zone.type.replace('_', ' ')}
                            </span>
                        </div>

                        <div className="text-xs text-slate-600 flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                <span>Radius: {zone.radius || 500}m</span>
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-600">
                                {zone.severity || 'MEDIUM'}
                            </span>
                        </div>

                        <div className="flex gap-2 pt-1 text-xs">
                            <button
                                onClick={() => handleEdit(zone)}
                                className="flex-1 command-button-secondary py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1"
                            >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit</span>
                            </button>
                            <button
                                onClick={() => handleDelete(zone._id)}
                                className="px-3 py-1.5 rounded-lg bg-white text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add / Edit Zone Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl overflow-hidden flex flex-col border border-slate-200 shadow-2xl">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between font-mono">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                {editingZone ? 'Edit Monitored Perimeter' : 'Tag New Perimeter on Map'}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-900">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                            {/* Map */}
                            <div className="w-full md:w-1/2 h-64 md:h-auto relative bg-slate-100">
                                <div ref={mapContainer} className="absolute inset-0" />
                                {form.latitude && form.longitude && (
                                    <div className="absolute bottom-3 left-3 bg-white/95 border border-slate-200 px-2.5 py-1 rounded text-[11px] font-mono text-emerald-700 shadow-sm">
                                        {form.latitude.toFixed(5)}°, {form.longitude.toFixed(5)}°
                                    </div>
                                )}
                            </div>

                            {/* Form */}
                            <div className="w-full md:w-1/2 p-5 overflow-y-auto space-y-4 font-mono text-xs">
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-[11px]">
                                    Click anywhere on the map to position coordinates. Drag marker to adjust radius center.
                                </div>

                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-700 mb-1">Perimeter Name</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-800"
                                        placeholder="e.g. Metro Junction, Safe Point"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-700 mb-1">Type</label>
                                        <select
                                            value={form.type}
                                            onChange={e => setForm({ ...form, type: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                                        >
                                            <option value="danger">Danger Hotspot</option>
                                            <option value="safe">Safe Haven</option>
                                            <option value="police_station">Police Station</option>
                                            <option value="hospital">Hospital</option>
                                            <option value="shelter">Shelter</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-700 mb-1">Radius (Meters)</label>
                                        <input
                                            type="number"
                                            value={form.radius}
                                            onChange={e => setForm({ ...form, radius: Number(e.target.value) })}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-700 mb-1">Description / Notes</label>
                                    <textarea
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none h-20 resize-none"
                                        placeholder="Operational perimeter notes..."
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handleSubmit}
                                        disabled={saving}
                                        className="flex-1 command-button-primary py-2.5 rounded-lg font-bold uppercase"
                                    >
                                        {saving ? 'Saving...' : 'Deploy Perimeter'}
                                    </button>
                                    <button
                                        onClick={closeModal}
                                        className="px-4 py-2.5 bg-white text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
