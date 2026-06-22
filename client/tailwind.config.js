/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ocean-bg': '#0a0f1e',
        'ocean-surface': '#0f1a2e',
        'ocean-border': '#1e3a5f',
        'signal-blue': '#0080ff',
        'signal-red': '#ff3b3b',
        'signal-green': '#00c878',
        'signal-amber': '#ffaa00',
        'text-primary': '#e0eaff',
        'text-muted': '#7a9cc0',
        ocean: {
          bg: '#0a0f1e',
          surface: '#0f1a2e',
          border: '#1e3a5f',
        },
        signal: {
          blue: '#0080ff',
          red: '#ff3b3b',
          green: '#00c878',
          amber: '#ffaa00',
        },
        text: {
          primary: '#e0eaff',
          muted: '#7a9cc0',
        },
      },
    },
  },
  plugins: [],
}
