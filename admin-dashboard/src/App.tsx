import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { FullViewMap } from './pages/FullViewMap'
import { LiveSOS } from './pages/LiveSOS'
import { Incidents } from './pages/Incidents'
import { Zones } from './pages/Zones'
import { Volunteers } from './pages/Volunteers'
import { Users } from './pages/Users'
import { Analytics } from './pages/Analytics'
import { Login } from './pages/Login'
import { useSocket } from './hooks/useSocket'

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return localStorage.getItem('admin_auth') === 'true'
    })
    const { socket, isConnected } = useSocket()

    useEffect(() => {
        if (socket && isConnected && isAuthenticated) {
            // Register as admin
            socket.emit('auth:register', {
                userId: 'admin-001',
                role: 'admin',
            })

            // Listen for SOS events
            socket.on('sos:new', (data) => {
                console.log('New SOS:', data)
                // Show notification
                if (Notification.permission === 'granted') {
                    new Notification('🚨 New SOS Alert', {
                        body: `${data.userName || 'User'} needs help!`,
                    })
                }
            })

            return () => {
                socket.off('sos:new')
            }
        }
    }, [socket, isConnected, isAuthenticated])

    const handleLogin = () => {
        localStorage.setItem('admin_auth', 'true')
        setIsAuthenticated(true)
    }

    const handleLogout = () => {
        localStorage.removeItem('admin_auth')
        setIsAuthenticated(false)
    }

    if (!isAuthenticated) {
        return <Login onLogin={handleLogin} />
    }

    return (
        <Layout onLogout={handleLogout}>
            <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/live-map" element={<FullViewMap />} />
                <Route path="/live-sos" element={<LiveSOS />} />
                <Route path="/incidents" element={<Incidents />} />
                <Route path="/zones" element={<Zones />} />
                <Route path="/volunteers" element={<Volunteers />} />
                <Route path="/users" element={<Users />} />
                <Route path="/analytics" element={<Analytics />} />
            </Routes>
        </Layout>
    )
}

export default App
