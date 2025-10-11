import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // This is the crucial line for GitHub Pages deployment
  base: '/AI-Assistant/',
  // This makes the environment variable available to the client-side code
  define: {
    // Vite replaces this with the value of process.env.API_KEY at build time.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    'process.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(process.env.VITE_GOOGLE_CLIENT_ID)
  }
});