import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { authPlugin } from './server/auth.ts'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app under /<repo>/ (set by the deploy workflow).
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), authPlugin()],
})
