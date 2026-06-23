/**
 * hooks/usePWA.js — PWA インストール促進 & オフライン検出
 *
 * 提供する機能:
 *   1. インストール促進バナーの表示制御
 *      - ブラウザが beforeinstallprompt イベントを発火したときだけ表示
 *      - すでにインストール済みの場合は自動的に非表示
 *   2. オフライン状態の検出
 *      - navigator.onLine の変化を監視
 *      - オフライン時にアプリ内でバナー表示するための state を提供
 */
import { useState, useEffect, useCallback } from 'react'

export function usePWA() {
  // beforeinstallprompt イベントを保持する（後で prompt() を呼ぶために必要）
  const [installPrompt,   setInstallPrompt]   = useState(null)
  const [isInstallable,   setIsInstallable]   = useState(false)
  const [isInstalled,     setIsInstalled]     = useState(false)
  const [isOffline,       setIsOffline]       = useState(!navigator.onLine)

  useEffect(() => {
    // ── インストール促進 ──────────────────────────
    const handleBeforeInstall = (e) => {
      // ブラウザのデフォルトのインストールバナーを抑制
      e.preventDefault()
      // イベントを保存して後で任意のタイミングで表示できるようにする
      setInstallPrompt(e)
      setIsInstallable(true)
    }

    // インストール完了イベント
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setInstallPrompt(null)
    }

    // ── オフライン検出 ────────────────────────────
    const handleOnline  = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled',        handleAppInstalled)
    window.addEventListener('online',              handleOnline)
    window.addEventListener('offline',             handleOffline)

    // standalone モードで動作中（= すでにインストール済み）かを確認
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled',        handleAppInstalled)
      window.removeEventListener('online',              handleOnline)
      window.removeEventListener('offline',             handleOffline)
    }
  }, [])

  // インストールダイアログを表示する
  const handleInstall = useCallback(async () => {
    if (!installPrompt) return
    const { outcome } = await installPrompt.prompt()
    // 'accepted' or 'dismissed'
    if (outcome === 'accepted') {
      setIsInstallable(false)
      setInstallPrompt(null)
    }
  }, [installPrompt])

  return {
    isInstallable,  // true のときインストールバナーを表示する
    isInstalled,    // true のときインストール済み（バナー非表示）
    isOffline,      // true のときオフラインバナーを表示する
    handleInstall,  // インストールボタンの onClick に渡す
  }
}
