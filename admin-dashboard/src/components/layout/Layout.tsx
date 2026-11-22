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
    Menu,
    X,
    Shield,
    Check,
    ChevronDown,
    PhoneCall
} from 'lucide-react'
import { API_URL } from '@/config/api'
import { useSocket } from '@/hooks/useSocket'

interface LayoutProps {
    children: ReactNode
    onLogout?: () => void
}

export function Layout({ children, onLogout }: LayoutProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const { socket } = useSocket()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [timeRange, setTimeRange] = useState('Today')
    const [showRangeDropdown, setShowRangeDropdown] = useState(false)
    const [showProfileDropdown, setShowProfileDropdown] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [exportNotice, setExportNotice] = useState<string | null>(null)
    const [activeSosCount, setActiveSosCount] = useState<number>(0)

    const rangeDropdownRef = useRef<HTMLDivElement>(null)
    const profileDropdownRef = useRef<HTMLDivElement>(null)

    // Fetch active SOS count
    useEffect(() => {
        const fetchActiveCount = async () => {
            try {
                const res = await fetch(`${API_URL}/sos?status=TRIGGERED,IN_PROGRESS`, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                })
                if (res.ok) {
                    const data = await res.json()
                    setActiveSosCount(Array.isArray(data) ? data.length : 0)
                }
            } catch (e) {
                // Ignore transient network errors
            }
        }
        fetchActiveCount()
        const interval = setInterval(fetchActiveCount, 15000)
        return () => clearInterval(interval)
    }, [])

    // Real-time socket updates for active SOS counter
    useEffect(() => {
        if (!socket) return

        socket.on('sos:new', () => {
            setActiveSosCount(prev => prev + 1)
        })

        socket.on('sos:status:updated', (data: { status: string }) => {
            if (data.status === 'RESOLVED' || data.status === 'CANCELLED') {
                setActiveSosCount(prev => Math.max(0, prev - 1))
            }
        })

        return () => {
            socket.off('sos:new')
            socket.off('sos:status:updated')
        }
    }, [socket])

    const navSections = [
        {
            title: 'Monitoring',
            items: [
                { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
                { path: '/live-map', label: 'Live Map', icon: Map, badge: 'LIVE' },
                { 
                    path: '/live-sos', 
                    label: 'Live SOS', 
                    icon: AlertTriangle, 
                    badge: activeSosCount > 0 ? `${activeSosCount}` : undefined,
                    badgeAlert: activeSosCount > 0
                },
            ]
        },
        {
            title: 'Manage',
            items: [
                { path: '/incidents', label: 'Incidents', icon: FileText },
                { path: '/zones', label: 'Safe Zones', icon: Shield },
                { path: '/volunteers', label: 'Volunteers', icon: Users },
                { path: '/users', label: 'Users', icon: UserCog },
                { path: '/analytics', label: 'Analytics', icon: BarChart3 },
            ]
        }
    ]

    const getPageTitle = () => {
        for (const section of navSections) {
            const item = section.items.find(n => n.path === location.pathname)
            if (item) return item.label
        }
        return 'Overview'
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

    // Export CSV
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

            let csvContent = 'ID,Name,Phone,Status,Type,Severity,Latitude,Longitude,Date\n'
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
            link.setAttribute('download', `incidents_${new Date().toISOString().slice(0, 10)}.csv`)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            setExportNotice('Downloaded')
            setTimeout(() => setExportNotice(null), 3000)
        } catch (e) {
            setExportNotice('Export failed')
            setTimeout(() => setExportNotice(null), 3000)
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <div className="min-h-screen text-slate-800 antialiased flex flex-col bg-[#F8FAFC]">
            <div className="flex-1 flex">
                {/* 🎯 Compact Sleek Fixed Sidebar */}
                <aside className="fixed left-0 top-0 bottom-0 w-56 h-screen hidden md:flex flex-col justify-between border-r border-slate-200/90 bg-white shrink-0 z-40">
                    <div>
                        {/* Top Logo */}
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#9333EA] via-[#EC4899] to-[#F43F5E] flex items-center justify-center text-white shadow-xs shrink-0">
                                    <Shield className="w-4 h-4 stroke-[2.2]" />
                                </div>
                                <div>
                                    <h1 className="text-xs font-bold tracking-tight text-slate-900 leading-none">
                                        Women Safety
                                    </h1>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">
                                        Admin Panel
                                    </span>
                                </div>
                            </div>
                            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
                        </div>

                        {/* Navigation Categories */}
                        <div className="py-3 px-2 space-y-4 overflow-y-auto max-h-[calc(100vh-180px)]">
                            {navSections.map((section, idx) => (
                                <div key={idx} className="space-y-1">
                                    <div className="px-2.5 pb-0.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                        {section.title}
                                    </div>
                                    <nav className="space-y-0.5">
                                        {section.items.map((item) => {
                                            const Icon = item.icon
                                            const isActive = location.pathname === item.path
                                            return (
                                                <Link
                                                    key={item.path}
                                                    to={item.path}
                                                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                                                        isActive
                                                            ? 'bg-slate-900 text-white font-semibold shadow-xs'
                                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                                        <span>{item.label}</span>
                                                    </div>

                                                    {item.badge && (
                                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                                            item.badgeAlert
                                                                ? 'bg-red-500 text-white'
                                                                : isActive
                                                                    ? 'bg-white/20 text-white'
                                                                    : 'bg-emerald-50 text-emerald-700'
                                                        }`}>
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </Link>
                                            )
                                        })}
                                    </nav>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Helpline & Logout */}
                    <div className="p-3 border-t border-slate-100 bg-slate-50/60 space-y-2">
                        <a
                            href="tel:112"
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                        >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>Helpline 112</span>
                        </a>

                        <div className="flex items-center justify-between px-1">
                            <div className="text-[11px] text-slate-500 font-medium">Dispatcher on duty</div>
                            {onLogout && (
                                <button
                                    onClick={onLogout}
                                    title="Sign Out"
                                    className="p-1 rounded text-slate-400 hover:text-red-600 transition-colors"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Main Content Area (Offset by md:pl-56) */}
                <div className="flex-1 flex flex-col min-w-0 md:pl-56">
                    {/* Compact Top Header Bar (56px) */}
                    <header className="h-14 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="md:hidden p-1.5 rounded-lg border border-slate-200 text-slate-600"
                            >
                                <Menu className="w-4 h-4" />
                            </button>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                <span className="text-slate-600 font-medium hidden sm:inline">Admin</span>
                                <span className="hidden sm:inline">&gt;</span>
                                <span className="text-slate-900 font-bold">{getPageTitle()}</span>
                            </div>
                        </div>

                        {/* Search Input */}
                        <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center flex-1 max-w-sm mx-3">
                            <div className="w-full flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search alerts or citizens..."
                                    className="bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none flex-1"
                                />
                            </div>
                        </form>

                        {/* Right Action Controls */}
                        <div className="flex items-center gap-2">
                            {/* Date Filter */}
                            <div className="relative" ref={rangeDropdownRef}>
                                <button
                                    onClick={() => setShowRangeDropdown(!showRangeDropdown)}
                                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                    <span>{timeRange}</span>
                                    <ChevronDown className="w-3 h-3 text-slate-400" />
                                </button>

                                {showRangeDropdown && (
                                    <div className="absolute right-0 mt-1.5 w-36 rounded-xl bg-white border border-slate-200 shadow-lg p-1 z-50">
                                        {['Today', '7 Days', '30 Days', 'All Time'].map((option) => (
                                            <button
                                                key={option}
                                                onClick={() => {
                                                    setTimeRange(option)
                                                    setShowRangeDropdown(false)
                                                }}
                                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left ${
                                                    timeRange === option ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span>{option}</span>
                                                {timeRange === option && <Check className="w-3 h-3" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* CSV Export Button */}
                            <button
                                onClick={handleExportCSV}
                                disabled={isExporting}
                                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                <Download className="w-3.5 h-3.5 text-slate-500" />
                                <span>{isExporting ? 'Exporting...' : (exportNotice || 'CSV')}</span>
                            </button>

                            {/* Bell Alert */}
                            <button
                                onClick={() => navigate('/live-sos')}
                                title="View Active SOS Alerts"
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 relative hover:bg-slate-50"
                            >
                                <Bell className="w-3.5 h-3.5" />
                                {activeSosCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                )}
                            </button>

                            {/* Profile Dropdown */}
                            <div className="relative" ref={profileDropdownRef}>
                                <button
                                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                                    className="flex items-center gap-2 cursor-pointer focus:outline-none"
                                >
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                                        HQ
                                    </div>
                                </button>

                                {showProfileDropdown && (
                                    <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white border border-slate-200 shadow-xl p-2 z-50">
                                        <div className="p-2 border-b border-slate-100 mb-1">
                                            <div className="text-xs font-bold text-slate-900">Admin Dispatcher</div>
                                            <div className="text-[11px] text-slate-500">System Online</div>
                                        </div>
                                        {onLogout && (
                                            <button
                                                onClick={onLogout}
                                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50"
                                            >
                                                <LogOut className="w-3.5 h-3.5" />
                                                <span>Sign Out</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>

                    {/* Mobile Drawer */}
                    {mobileMenuOpen && (
                        <div className="md:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)}>
                            <div 
                                className="bg-white w-60 h-full p-4 flex flex-col border-r border-slate-200 shadow-xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="py-2 border-b border-slate-100 mb-3 flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-900">Women Safety</span>
                                    <button onClick={() => setMobileMenuOpen(false)}>
                                        <X className="w-4 h-4 text-slate-400" />
                                    </button>
                                </div>
                                <div className="space-y-3 flex-1 overflow-y-auto">
                                    {navSections.map((section, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <div className="text-[10px] font-bold uppercase text-slate-400 px-1">
                                                {section.title}
                                            </div>
                                            {section.items.map((item) => {
                                                const Icon = item.icon
                                                const isActive = location.pathname === item.path
                                                return (
                                                    <Link
                                                        key={item.path}
                                                        to={item.path}
                                                        onClick={() => setMobileMenuOpen(false)}
                                                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium ${
                                                            isActive ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Icon className="w-4 h-4" />
                                                            <span>{item.label}</span>
                                                        </div>
                                                        {item.badge && (
                                                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-500 text-white">
                                                                {item.badge}
                                                            </span>
                                                        )}
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    ))}
                                </div>
                                {onLogout && (
                                    <button
                                        onClick={onLogout}
                                        className="mt-auto py-2 px-3 rounded-lg text-red-600 bg-red-50 text-xs font-semibold flex items-center justify-center gap-2"
                                    >
                                        <LogOut className="w-3.5 h-3.5" />
                                        <span>Sign Out</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Main Viewport Container (Responsive, Not Oversized) */}
                    <main className="flex-1 px-4 sm:px-6 py-4 max-w-6xl w-full mx-auto">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    )
}
