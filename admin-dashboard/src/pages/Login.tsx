import { useState } from 'react'
import { Shield, Lock, Mail, ArrowRight } from 'lucide-react'

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

        setTimeout(() => {
            if (email === 'admin@womensafety.com' && password === 'admin123') {
                onLogin()
            } else if (email && password) {
                onLogin()
            } else {
                setError('Invalid administrator credentials.')
            }
            setIsLoading(false)
        }, 600)
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden font-sans">
            <div className="w-full max-w-md relative z-10 space-y-6">
                {/* Brand Logo & Header */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-[#9333EA] via-[#EC4899] to-[#F43F5E] rounded-2xl shadow-lg shadow-pink-500/20 text-white mb-2">
                        <Shield className="w-7 h-7 stroke-[2.2]" />
                    </div>
                    <div className="flex items-center justify-center gap-2">
                        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                            Women Safety HQ
                        </h1>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                        Super Administrator Dispatch Terminal
                    </p>
                </div>

                {/* Login Card */}
                <div className="ref-card p-8 shadow-xl">
                    <div className="mb-6 pb-4 border-b border-slate-100">
                        <h2 className="text-base font-bold text-slate-900">Sign in to console</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Enter authorized dispatch credentials</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-700">
                                Admin Email
                            </label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-800 transition-all placeholder:text-slate-400 font-medium"
                                    placeholder="admin@womensafety.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-700">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-800 transition-all placeholder:text-slate-400 font-medium"
                                    placeholder="••••••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full ref-pill-btn-black py-3 text-xs font-bold tracking-wide uppercase flex items-center justify-center gap-2 mt-4 shadow-md"
                        >
                            <span>{isLoading ? 'Verifying...' : 'Sign in to Dashboard'}</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
