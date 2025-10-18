import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // This is the crucial line for GitHub Pages deployment
  base: '/AI-Assistant/',
  // Pass environment variables from the build command into the application code.
  // This allows running the app without a .env file.
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});