/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx}",
    "./index.html",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
      },
      animation: {
        'gradient': 'gradient 15s ease infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(192, 132, 252, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(192, 132, 252, 0.4)' }
        },
        pulse: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: .7 }
        }
      }
    },
  },
  plugins: [],
} 