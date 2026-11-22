export const getApiUrl = (): string => {
    const envUrl = import.meta.env.VITE_API_URL
    if (envUrl && !envUrl.includes('ngrok')) {
        return envUrl
    }
    const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'
    return `http://${host}:3000/api/v1`
}

export const getSocketUrl = (): string => {
    const envUrl = import.meta.env.VITE_SOCKET_URL
    if (envUrl && !envUrl.includes('ngrok')) {
        return envUrl
    }
    const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'
    return `http://${host}:3000`
}

export const API_URL = getApiUrl()
export const SOCKET_URL = getSocketUrl()
