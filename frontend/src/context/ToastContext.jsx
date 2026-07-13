/**
 * context/ToastContext.jsx — グローバルトースト通知
 *
 * フェーズ3で新規追加。外部ライブラリ（react-hot-toast等）を追加せず、
 * 既存のContext + hookパターン（AuthContext等）に合わせて自前実装する。
 *
 * 使い方:
 *   const { notify } = useToast()
 *   notify('保存に失敗しました。', 'error')
 *   notify('現在はモック応答です。', 'info')
 */
import { createContext, useCallback, useContext, useState } from 'react'
import Toast from '../components/Toast'

const ToastContext = createContext(null)

const DEFAULT_DURATION_MS = 4000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const notify = useCallback((message, variant = 'error', duration = DEFAULT_DURATION_MS) => {
    if (!message) return
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, message, variant }])
    setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <Toast toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast() は ToastProvider の内側でのみ使用できます。')
  }
  return ctx
}
