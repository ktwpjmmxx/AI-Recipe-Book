/**
 * src/main.jsx
 *
 * ① i18n を最初に import することで、アプリ全体で翻訳が使える状態になる。
 *    import の順番を変えないこと（React より先に初期化が必要）。
 */
import './i18n'          // ← ① 最初に import
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
