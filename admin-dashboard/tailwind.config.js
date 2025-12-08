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
                border: "#000000", // Stark black borders
                input: "#000000",
                ring: "#000000",
                background: "#F5F2EB", // Warm paper/cream background
                foreground: "#000000", // Black text
                primary: {
                    DEFAULT: "#000000",
                    foreground: "#F5F2EB",
                },
                secondary: {
                    DEFAULT: "#E6E1D6", // Slightly darker cream for hover/active
                    foreground: "#000000",
                },
                destructive: {
                    DEFAULT: "#FF3B30", // Sharp red for alerts
                    foreground: "#FFFFFF",
                },
                muted: {
                    DEFAULT: "#E6E1D6",
                    foreground: "#666666",
                },
                accent: {
                    DEFAULT: "#000000",
                    foreground: "#F5F2EB",
                },
                popover: {
                    DEFAULT: "#F5F2EB",
                    foreground: "#000000",
                },
                card: {
                    DEFAULT: "#F5F2EB",
                    foreground: "#000000",
                },
                // Semantic colors
                danger: {
                    DEFAULT: '#FF3B30',
                    light: '#FFE5E5',
                },
                safe: {
                    DEFAULT: '#34C759',
                    light: '#E0F8E5',
                },
                warning: {
                    DEFAULT: '#FF9500',
                    light: '#FFF0D6',
                },
            },
            borderRadius: {
                lg: "0px", // Sharp corners for brutalist look
                md: "0px",
                sm: "0px",
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                display: ['Inter', 'sans-serif'], // Use for big headers
            },
            boxShadow: {
                'brutal': '4px 4px 0px 0px #000000', // Hard shadow
                'brutal-sm': '2px 2px 0px 0px #000000',
                'brutal-lg': '8px 8px 0px 0px #000000',
            },
            keyframes: {
                "accordion-down": {
                    from: { height: 0 },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: 0 },
                },
                pulse: {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "pulse-slow": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}
