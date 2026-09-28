/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves under /<repo>/. Override with VITE_BASE if you host elsewhere.
  base: process.env.VITE_BASE ?? '/gh600-study/',
  server: { port: 5273, host: true },
  preview: { port: 5273, host: true },
  test: { environment: 'jsdom', css: { include: [/index\.css/] } },
})
