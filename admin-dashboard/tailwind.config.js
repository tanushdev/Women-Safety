/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                border: "#E2E8F0",
                input: "#F1F5F9",
                ring: "#0F172A",
                background: "#F8FAFC",
                foreground: "#0F172A",
                primary: {
                    DEFAULT: "#0F172A", // Sleek executive slate
                    hover: "#1E293B",
                    light: "#F1F5F9",
                    foreground: "#FFFFFF",
                },
                secondary: {
                    DEFAULT: "#F1F5F9",
                    foreground: "#0F172A",
                },
                destructive: {
                    DEFAULT: "#EF4444",
                    foreground: "#FFFFFF",
                },
                muted: {
                    DEFAULT: "#F8FAFC",
                    foreground: "#64748B",
                },
                accent: {
                    DEFAULT: "#F1F5F9",
                    foreground: "#0F172A",
                },
                popover: {
                    DEFAULT: "#FFFFFF",
                    foreground: "#0F172A",
                },
                card: {
                    DEFAULT: "#FFFFFF",
                    foreground: "#0F172A",
                },
                // Enterprise Light Command tokens
                command: {
                    bg: '#F8FAFC',
                    surface: '#FFFFFF',
                    elevated: '#F1F5F9',
                    border: '#E2E8F0',
                    highlight: '#F8FAFC',
                },
                danger: {
                    DEFAULT: '#EF4444',
                    light: '#FEF2F2',
                    dark: '#991B1B',
                },
                safe: {
                    DEFAULT: '#10B981',
                    light: '#ECFDF5',
                    dark: '#065F46',
                },
                warning: {
                    DEFAULT: '#F59E0B',
                    light: '#FFFBEB',
                    dark: '#92400E',
                },
                tactical: {
                    DEFAULT: '#2563EB',
                    light: '#EFF6FF',
                    cyan: '#0284C7',
                }
            },
            borderRadius: {
                '3xl': '16px',
                '2xl': '12px',
                'xl': '10px',
                'lg': '8px',
                'md': '6px',
                'sm': '4px',
                'full': '9999px',
            },
            fontFamily: {
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
                mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
            },
            boxShadow: {
                'command-card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
                'command-card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
                'command-panel': '0 10px 25px -5px rgba(0, 0, 0, 0.04), 0 8px 10px -6px rgba(0, 0, 0, 0.02)',
                'soft-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                'soft': '0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}
