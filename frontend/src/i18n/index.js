/**
 * src/i18n/index.js
 *
 * react-i18next の初期化設定。
 * アプリ起動時（main.jsx）でこのファイルを import するだけで有効になる。
 *
 * 言語の優先順位:
 *   1. localStorage に保存済みの選択（ユーザーが手動で切り替えた場合）
 *   2. ブラウザの言語設定（navigator.language）
 *   3. フォールバック: 'ja'
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ja from './locales/ja.json'
import en from './locales/en.json'
import tr from './locales/tr.json'

i18n
  .use(LanguageDetector)     // ブラウザ言語・localStorage を自動検出
  .use(initReactI18next)
  .init({
    resources: {
      ja: { translation: ja },
      en: { translation: en },
      tr: { translation: tr },
    },

    // サポートする言語一覧（ここに追加するだけで新言語が有効になる）
    supportedLngs: ['ja', 'en', 'tr'],

    // 上記以外の言語コード（例: 'en-US'）が来たときの丸め先
    //   'en-US' → 'en', 'tr-TR' → 'tr'
    nonExplicitSupportedLngs: true,

    fallbackLng: 'ja',

    detection: {
      // 検出順序: localStorage → ブラウザ設定
      order: ['localStorage', 'navigator'],
      // localStorage に保存するキー名
      lookupLocalStorage: 'myrecipe_lang',
      // 選択した言語を localStorage に自動保存する
      caches: ['localStorage'],
    },

    interpolation: {
      // React は XSS エスケープを自前でやるので二重エスケープを防ぐ
      escapeValue: false,
    },
  })

export default i18n
