import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'autoUpdate': ページリロード時に SW を自動更新する
      // ユーザーが「更新してください」ダイアログを見ずに済む
      registerType: 'autoUpdate',

      // Service Worker でキャッシュする静的アセットのパターン
      includeAssets: [
        'favicon.ico',
        'icons/*.png',
        'images/header/*.jpg',
      ],

      // Web App Manifest の設定
      // ホーム画面追加・スプラッシュスクリーン・テーマカラーなどを定義
      manifest: {
        name:             'MyRecipeBook',
        short_name:       'MyRecipe',
        description:      '自分だけのオリジナルレシピをデジタルで管理する、シンプルで賢いWebアプリ。',
        theme_color:      '#f4f1ec',   // Cream & Sage のベースカラー
        background_color: '#f4f1ec',
        display:          'standalone', // ブラウザUIを非表示にしてアプリらしく表示
        orientation:      'portrait',
        scope:            '/',
        start_url:        '/home',      // アプリ起動時に開くページ
        lang:             'ja',
        icons: [
          {
            src:   'icons/icon-192.png',
            sizes: '192x192',
            type:  'image/png',
          },
          {
            src:   'icons/icon-512.png',
            sizes: '512x512',
            type:  'image/png',
            // purpose: 'any maskable' にすると
            // Android のアダプティブアイコン（角丸・背景付き）に対応する
            purpose: 'any maskable',
          },
        ],
        // ショートカット: ホーム画面アイコンを長押しで表示されるクイックアクション
        shortcuts: [
          {
            name:       'レシピを追加',
            short_name: '追加',
            url:        '/recipes/new',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name:       'ライブラリ',
            short_name: 'ライブラリ',
            url:        '/library',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },

      // Workbox（Service Worker ライブラリ）の設定
      workbox: {
        // キャッシュ戦略:
        //   NetworkFirst  → まずネットワーク、失敗時にキャッシュ（レシピ一覧など最新性が重要なもの）
        //   CacheFirst    → まずキャッシュ（アイコン・画像など変わりにくいもの）
        //   StaleWhileRevalidate → キャッシュを即返しつつバックグラウンドで更新（JS/CSSなど）
        runtimeCaching: [
          {
            // APIレスポンスは NetworkFirst でオフライン時も最後のデータを表示
            urlPattern: /^https?:\/\/.*\/api\/.*/,
            handler:    'NetworkFirst',
            options: {
              cacheName:          'api-cache',
              networkTimeoutSeconds: 5,        // 5秒でタイムアウト → キャッシュにフォールバック
              expiration: {
                maxEntries:    50,             // 最大50エントリ
                maxAgeSeconds: 60 * 60 * 24,   // 24時間でキャッシュ失効
              },
            },
          },
          {
            // アップロード画像は CacheFirst（一度取得したら変わらない）
            urlPattern: /^https?:\/\/.*\/uploads\/.*/,
            handler:    'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries:    100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30日
              },
            },
          },
          {
            // ヘッダー背景画像（朝・昼・夜）は CacheFirst
            urlPattern: /\/images\/header\/.*/,
            handler:    'CacheFirst',
            options: {
              cacheName: 'header-image-cache',
              expiration: {
                maxEntries:    10,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7日
              },
            },
          },
        ],
      },

      // 開発環境でも Service Worker を有効にしてテストできるようにする
      devOptions: {
        enabled: true,
      },
    }),
  ],

  server: {
    proxy: {
      '/api': {
        target:      'http://localhost:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target:      'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
