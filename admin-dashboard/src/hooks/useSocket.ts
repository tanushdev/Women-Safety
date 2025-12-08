import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

export function useSocket() {
    const [isConnected, setIsConnected] = useState(false)
    const socketRef = useRef<Socket | null>(null)

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
        })

        socketRef.current = socket

        socket.on('connect', () => {
            console.log('Socket connected')
            setIsConnected(true)
            socket.emit('admin:join')
        })

        socket.on('disconnect', () => {
            console.log('Socket disconnected')
            setIsConnected(false)
        })

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error)
            setIsConnected(false)
        })

        return () => {
            socket.disconnect()
            socketRef.current = null
        }
    }, [])

    return {
        socket: socketRef.current,
        isConnected,
    }
}
