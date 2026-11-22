import { ReactNode, useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
    LayoutDashboard,
    AlertTriangle,
    FileText,
    Map,
    Users,
    UserCog,
    BarChart3,
    LogOut,
    Search,
    Bell,
    Calendar,
    Download,
    HelpCircle,
    Menu,
    X,
    Shield,
    Check,
    Radio,
    ChevronDown,
    Building2,
    FileSpreadsheet
} from 'lucide-react'
import { API_URL } from '@/config/api'

interface LayoutProps {
    children: ReactNode
    onLogout?: () => void
}

export function Layout({ children, onLogout }: LayoutProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [timeRange, setTimeRange] = useState('Live Today')
    const [showRangeDropdown, setShowRangeDropdown] = useState(false)
    const [showProfileDropdown, setShowProfileDropdown] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [exportNotice, setExportNotice] = useState<string | null>(null)

    const rangeDropdownRef = useRef<HTMLDivElement>(null)
    const profileDropdownRef = useRef<HTMLDivElement>(null)

    const navItems = [
        { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
        { path: '/live-map', label: 'Full View Map', icon: Map, alert: true },
        { path: '/live-sos', label: 'Live SOS', icon: AlertTriangle },
        { path: '/incidents', label: 'Incidents', icon: FileText },
        { path: '/zones', label: 'Safe Havens', icon: Shield },
        { path: '/volunteers', label: 'Guardians', icon: Users },
        { path: '/users', label: 'Users', icon: UserCog },
        { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    ]

    const getPageTitle = () => {
        const item = navItems.find(n => n.path === location.pathname)
        return item ? item.label : 'Overview'
    }

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (rangeDropdownRef.current && !rangeDropdownRef.current.contains(e.target as Node)) {
                setShowRangeDropdown(false)
            }
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
                setShowProfileDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!searchQuery.trim()) return
        navigate(`/incidents?search=${encodeURIComponent(searchQuery.trim())}`)
    }

    // Real CSV Export of actual incident telemetry
    const handleExportCSV = async () => {
        setIsExporting(true)
        setExportNotice(null)
        try {
            const res = await fetch(`${API_URL}/sos`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
            if (!res.ok) throw new Error('API fetch failed')
            const data = await res.json()
            const rows = Array.isArray(data) ? data : []

            let csvContent = 'Incident ID,Citizen Name,Phone,Status,Trigger Type,Severity,Latitude,Longitude,Timestamp\n'
            rows.forEach((item: any) => {
                const name = typeof item.userId === 'object' && item.userId !== null ? item.userId.name : (item.userName || 'Unknown')
                const phone = typeof item.userId === 'object' && item.userId !== null ? item.userId.phone : (item.userPhone || '')
                const coords = item.currentLocation?.coordinates || item.initialLocation?.coordinates || [0, 0]
                csvContent += `"${item._id}","${name}","${phone}","${item.status}","${item.triggerType || 'SOS'}","${item.severity || 'high'}",${coords[1]},${coords[0]},"${item.createdAt}"\n`
            })

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `emergency_incidents_report_${new Date().toISOString().slice(0, 10)}.csv`)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            setExportNotice('✓ Exported Incident CSV')
            setTimeout(() => setExportNotice(null), 3000)
        } catch (e) {
            console.error('Export CSV failed:', e)
            setExportNotice('Export failed')
            setTimeout(() => setExportNotice(null), 3000)
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <div className="min-h-screen text-slate-800 antialiased flex flex-col selection:bg-[#FF2D78] selection:text-white">
            <div className="flex-1 flex">
                {/* 🎯 Fixed Slim Floating Icon Sidebar (Permanently anchored, never scrolls) */}
                <aside className="fixed left-0 top-0 bottom-0 w-20 h-screen hidden md:flex flex-col items-center py-6 border-r border-slate-200/70 bg-white/85 backdrop-blur-xl shrink-0 z-40">
                    {/* Top Logo Glyph */}
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#9333EA] via-[#EC4899] to-[#F43F5E] flex items-center justify-center text-white shadow-md shadow-pink-500/20 mb-8 cursor-pointer hover:scale-105 transition-transform">
                        <Shield className="w-5 h-5 stroke-[2.2]" />
                    </div>

                    {/* Middle Icon Navigation Rail */}
                    <nav className="flex-1 flex flex-col items-center gap-3 w-full px-3">
                        {navItems.map((item) => {
                            const Icon = item.icon
                            const isActive = location.pathname === item.path
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    title={item.label}
                                    className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                                        isActive
                                            ? 'bg-[#18191E] text-white shadow-md'
                                            : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100/80'
                                    }`}
                                >
                                    <Icon className="w-5 h-5 stroke-[2]" />
                                    {item.alert && !isActive && (
                                        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF2D78] animate-pulse" />
                                    )}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Bottom Utility Icons */}
                    <div className="flex flex-col items-center gap-3 pt-4 border-t border-slate-100 w-full px-3">
                        <button
                            title="Help & Safety Protocols"
                            onClick={() => window.open('https://112.gov.in', '_blank')}
                            className="w-11 h-11 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100/80 transition-colors"
                        >
                            <HelpCircle className="w-5 h-5" />
                        </button>
                        {onLogout && (
                            <button
                                onClick={onLogout}
                                title="Sign Out of Operations HQ"
                                className="w-11 h-11 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </aside>

                {/* Main View Area (Offset by md:pl-20 for fixed sidebar) */}
                <div className="flex-1 flex flex-col min-w-0 md:pl-20">
                    {/* 🎯 Real Top Operations Header Bar */}
                    <header className="h-20 px-6 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 bg-[#F3F5F9]/80 backdrop-blur-md">
                        {/* Mobile menu button & Breadcrumb */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="md:hidden p-2 rounded-xl bg-white border border-slate-200 text-slate-600"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                                <span className="text-slate-700 font-semibold">Command Center</span>
                                <span>&gt;</span>
                                <span className="text-slate-600 font-semibold">{getPageTitle()}</span>
                                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 ml-2">
                                    <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                                    <span>Live Telemetry Active</span>
                                </span>
                            </div>
                        </div>

                        {/* Real Functional Search Form */}
                        <form onSubmit={handleSearchSubmit} className="hidden lg:flex items-center flex-1 max-w-md mx-4">
                            <div className="w-full ref-pill-search flex items-center gap-3 px-4 py-2.5 shadow-sm bg-white">
                                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search distress signals, citizens, phone numbers..."
                                    className="bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none flex-1 font-medium"
                                />
                                {searchQuery ? (
                                    <button
                                        type="submit"
                                        className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-semibold"
                                    >
                                        Search
                                    </button>
                                ) : (
                                    <kbd className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 text-[10px] font-semibold border border-slate-200">
                                        Enter ↵
                                    </kbd>
                                )}
                            </div>
                        </form>

                        {/* Right Action Controls */}
                        <div className="flex items-center gap-3">
                            {/* Interactive Date Range Filter Dropdown */}
                            <div className="relative" ref={rangeDropdownRef}>
                                <button
                                    onClick={() => setShowRangeDropdown(!showRangeDropdown)}
                                    className="hidden sm:flex items-center gap-2 px-3.5 py-2 ref-pill-btn-white text-xs text-slate-700 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
                                >
                                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                    <span className="font-semibold">{timeRange}</span>
                                    <ChevronDown className="w-3 h-3 text-slate-400" />
                                </button>

                                {showRangeDropdown && (
                                    <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-white border border-slate-200/90 shadow-xl p-1.5 z-50">
                                        {['Live Today', 'Last 7 Days', 'Last 30 Days', 'All Time Records'].map((option) => (
                                            <button
                                                key={option}
                                                onClick={() => {
                                                    setTimeRange(option)
                                                    setShowRangeDropdown(false)
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                                                    timeRange === option
                                                        ? 'bg-slate-900 text-white'
                                                        : 'text-slate-700 hover:bg-slate-100'
                                                }`}
                                            >
                                                <span>{option}</span>
                                                {timeRange === option && <Check className="w-3.5 h-3.5" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Real CSV Export Button */}
                            <button
                                onClick={handleExportCSV}
                                disabled={isExporting}
                                title="Download complete incident telemetry CSV"
                                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 ref-pill-btn-white text-xs text-slate-700 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                                <Download className="w-3.5 h-3.5 text-slate-500" />
                                <span className="font-semibold">{isExporting ? 'Exporting...' : (exportNotice || 'Export CSV')}</span>
                            </button>

                            {/* Notification Bell */}
                            <button
                                onClick={() => navigate('/live-map')}
                                title="View Live Emergency Radar"
                                className="w-10 h-10 rounded-full ref-pill-btn-white flex items-center justify-center text-slate-600 shadow-sm relative hover:bg-slate-50"
                            >
                                <Bell className="w-4 h-4" />
                                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#FF2D78] animate-ping" />
                            </button>

                            {/* Real Emergency Operations Admin Profile */}
                            <div className="relative" ref={profileDropdownRef}>
                                <button
                                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                                    className="flex items-center gap-3 pl-2 cursor-pointer focus:outline-none"
                                >
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-500 via-pink-500 to-indigo-600 p-0.5 shadow-md shadow-pink-500/20">
                                        <div className="w-full h-full rounded-full bg-[#18191E] text-white flex items-center justify-center font-bold text-xs tracking-wider">
                                            HQ
                                        </div>
                                    </div>
                                    <div className="hidden xl:block text-left">
                                        <div className="text-xs font-bold text-slate-900 leading-tight">Operations HQ</div>
                                        <div className="text-[11px] text-emerald-600 leading-tight font-semibold flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <span>Chief Commander</span>
                                        </div>
                                    </div>
                                    <ChevronDown className="hidden xl:block w-3.5 h-3.5 text-slate-400" />
                                </button>

                                {showProfileDropdown && (
                                    <div className="absolute right-0 mt-3 w-64 rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-3 z-50">
                                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 mb-2">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                                                <Building2 className="w-4 h-4 text-pink-600" />
                                                <span>Navi Mumbai Safety Command</span>
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-1">Division: Emergency Dispatch Unit #01</div>
                                            <div className="text-[10px] text-emerald-600 font-mono mt-1 font-semibold">Port 3000 • Database Online</div>
                                        </div>

                                        <button
                                            onClick={handleExportCSV}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                                        >
                                            <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                                            <span>Export Telemetry Records</span>
                                        </button>

                                        {onLogout && (
                                            <button
                                                onClick={onLogout}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors mt-1"
                                            >
                                                <LogOut className="w-4 h-4 text-red-500" />
                                                <span>Sign Out Operations</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>

                    {/* Mobile Drawer Menu */}
                    {mobileMenuOpen && (
                        <div className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
                            <div 
                                className="bg-white w-64 h-full p-5 flex flex-col border-r border-slate-200 shadow-xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="py-2 border-b border-slate-100 mb-4 flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Navigation</span>
                                    <button onClick={() => setMobileMenuOpen(false)}>
                                        <X className="w-5 h-5 text-slate-400" />
                                    </button>
                                </div>
                                <nav className="space-y-1.5 flex-1 overflow-y-auto">
                                    {navItems.map((item) => {
                                        const Icon = item.icon
                                        const isActive = location.pathname === item.path
                                        return (
                                            <Link
                                                key={item.path}
                                                to={item.path}
                                                onClick={() => setMobileMenuOpen(false)}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold transition-all ${
                                                    isActive
                                                        ? 'bg-[#18191E] text-white shadow-sm'
                                                        : 'text-slate-600 hover:bg-slate-100'
                                                }`}
                                            >
                                                <Icon className="w-4 h-4" />
                                                <span>{item.label}</span>
                                            </Link>
                                        )
                                    })}
                                </nav>
                                {onLogout && (
                                    <button
                                        onClick={onLogout}
                                        className="mt-auto flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-red-600 bg-red-50 border border-red-200 text-xs font-semibold"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span>Sign Out</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Main Content Area */}
                    <main className="flex-1 px-6 sm:px-8 pb-10 max-w-7xl w-full mx-auto">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    )
}
