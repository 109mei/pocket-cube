import { defineConfig } from 'vite';
export default defineConfig({ base: './', server: { port: 5174, strictPort: true }, build: { rollupOptions: { output: { manualChunks: { three: ['three', 'three/addons/geometries/RoundedBoxGeometry.js'] } } } } });
