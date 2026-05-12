import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts';
          if (id.includes('node_modules/lucide-react')) return 'icons';
          if (id.includes('node_modules/xlsx')) return 'excel';
          if (id.includes('node_modules/react-router-dom') || id.includes('node_modules/react-dom') || (id.includes('node_modules/react/') && !id.includes('react-'))) return 'react-vendor';
          if (id.includes('node_modules/date-fns') || id.includes('node_modules/clsx') || id.includes('node_modules/tailwind-merge')) return 'utils';
        },
      },
    },
  },
})
