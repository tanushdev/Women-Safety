import { useState } from 'react'

interface LoginProps {
    onLogin: () => void
}

export function Login({ onLogin }: LoginProps) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        // Mock authentication - in production this would call the backend
        setTimeout(() => {
            if (email === 'admin@womensafety.com' && password === 'admin123') {
                onLogin()
            } else if (email && password) {
                // For demo, any credentials work
                onLogin()
            } else {
                setError('Please enter valid credentials')
            }
            setIsLoading(false)
        }, 1000)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F2EB]">
            <div className="w-full max-w-md p-8">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-black mb-4">
                        <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L2 7v15h20V7L12 2zm0 2.31L20 8v12H4V8l8-3.69z" />
                            <path d="M12 11a2 2 0 100-4 2 2 0 000 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-black tracking-tighter uppercase">Women Safety</h1>
                    <p className="text-gray-600 mt-1 font-medium">Admin Dashboard</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="border-2 border-black">
                        <div className="bg-black text-white px-4 py-2 text-sm font-bold uppercase">
                            Admin Login
                        </div>
                        <div className="p-6 space-y-4 bg-white">
                            {error && (
                                <div className="bg-red-100 border-2 border-red-500 text-red-700 px-4 py-2 text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold uppercase mb-1">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full border-2 border-black px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
                                    placeholder="admin@womensafety.com"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold uppercase mb-1">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full border-2 border-black px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-black text-white py-4 font-bold uppercase tracking-wide hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Authenticating...' : 'Login'}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Demo Credentials */}
                <div className="mt-6 border-2 border-black bg-yellow-50 p-4">
                    <p className="text-sm font-bold uppercase mb-2">Demo Credentials</p>
                    <p className="text-sm font-mono">Email: admin@womensafety.com</p>
                    <p className="text-sm font-mono">Password: admin123</p>
                    <p className="text-xs text-gray-500 mt-2">(Any credentials will work for demo)</p>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-gray-500 mt-8">
                    © 2024 Women Safety System. All rights reserved.
                </p>
            </div>
        </div>
    )
}
