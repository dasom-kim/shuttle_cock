import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // 새 버전이 나오면 자동으로 업데이트
      devOptions: {
        enabled: true // 로컬 개발 환경(localhost)에서도 PWA 설치 버튼을 테스트할 수 있게 켬
      },
      manifest: {
        name: '셔틀콕 - 대기업 셔틀 지도',
        short_name: '셔틀콕',
        description: '직장인들을 위한 대기업 셔틀버스 위치 및 혼잡도 공유 위키',
        theme_color: '#8B5CF6', // 앱 상단바 색상을 비비드 퍼플로 설정
        background_color: '#ffffff',
        display: 'standalone', // 브라우저 UI 없이 네이티브 앱처럼 띄움
        icons: [
          {
            src: '/logo192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
});