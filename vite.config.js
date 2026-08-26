import path from 'path';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import { defineConfig } from 'vite';
var meta = JSON.parse(fs.readFileSync('./public/meta.json', 'utf8'));
export default defineConfig({
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(meta.versionId),
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        cors: true,
        host: '0.0.0.0',
        allowedHosts: true,
    },
});
