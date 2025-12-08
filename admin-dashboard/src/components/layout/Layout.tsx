import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    AlertTriangle,
    FileText,
    Map,
    Users,
    UserCog,
    BarChart3,
    Menu,
    Triangle,
    LogOut,
} from 'lucide-react'

interface LayoutProps {
    children: ReactNode
    onLogout?: () => void
}

export function Layout({ children, onLogout }: LayoutProps) {
    const location = useLocation()

    const navItems = [
        { path: '/dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
        { path: '/live-sos', label: 'LIVE SOS', icon: AlertTriangle },
        { path: '/incidents', label: 'INCIDENTS', icon: FileText },
        { path: '/zones', label: 'ZONES', icon: Map },
        { path: '/volunteers', label: 'VOLUNTEERS', icon: Users },
        { path: '/users', label: 'USERS', icon: UserCog },
        { path: '/analytics', label: 'ANALYTICS', icon: BarChart3 },
    ]

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-black selection:text-white">
            {/* Sidebar */}
            <aside className="fixed inset-y-0 left-0 w-72 bg-background border-r-2 border-black hidden md:flex flex-col z-50">
                {/* Logo Section */}
                <div className="p-8 border-b-2 border-black">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black flex items-center justify-center">
                            <Triangle className="w-6 h-6 text-white fill-current" />
                        </div>
                        <div>
                            <h1 className="font-display font-black text-xl tracking-tighter leading-none">WOMEN<br />SAFETY</h1>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <p className="text-xs font-mono uppercase tracking-widest">System Operational</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = location.pathname === item.path
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`group flex items-center gap-4 px-4 py-3 transition-all duration-200 border border-transparent ${isActive
                                    ? 'bg-black text-white shadow-brutal'
                                    : 'hover:border-black hover:bg-white'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'stroke-2' : 'stroke-1'}`} />
                                <span className={`font-bold tracking-wide text-sm ${isActive ? '' : ''}`}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />
                                )}
                            </Link>
                        )
                    })}
                </nav>

                {/* Footer User Info */}
                <div className="p-6 border-t-2 border-black bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 border-2 border-black bg-gray-100 flex items-center justify-center font-bold">
                            AD
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="text-sm font-bold truncate">ADMIN USER</p>
                            <p className="text-xs text-gray-500 truncate font-mono">ID: #8829-X</p>
                        </div>
                        {onLogout && (
                            <button
                                onClick={onLogout}
                                className="p-2 border-2 border-black hover:bg-red-100 hover:border-red-500 transition-colors"
                                title="Logout"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="md:pl-72 flex flex-col min-h-screen">
                {/* Top Bar - Mobile Only mostly, but keeps layout structure */}
                <header className="md:hidden bg-background border-b-2 border-black px-6 py-4 flex items-center justify-between sticky top-0 z-40">
                    <div className="flex items-center gap-2">
                        <Triangle className="w-6 h-6 fill-black" />
                        <span className="font-black tracking-tighter">WS SYSTEM</span>
                    </div>
                    <button className="p-2 border-2 border-black active:bg-black active:text-white transition-colors">
                        <Menu className="w-6 h-6" />
                    </button>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
                    {children}
                </main>
            </div>
        </div>
    )
}
