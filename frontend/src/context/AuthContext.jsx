/**
 * context/AuthContext.jsx — 認証状態のグローバル管理
 *
 * v4.3 追加:
 *   updateProfile(data)      : 表示名・bio の更新
 *   changePassword(cur, new) : パスワード変更
 *   uploadAvatar(file)       : プロフィール画像アップロード
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/recipeApi'

const TOKEN_KEY = 'myrecipe_token'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    api.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    localStorage.setItem(TOKEN_KEY, res.data.access_token)
    const me = await api.get('/auth/me')
    setUser(me.data)
    return me.data
  }, [])

  const register = useCallback(async (email, password, displayName) => {
    const res = await api.post('/auth/register', {
      email, password, display_name: displayName || null,
    })
    localStorage.setItem(TOKEN_KEY, res.data.access_token)
    const me = await api.get('/auth/me')
    setUser(me.data)
    return me.data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  // ── プロフィール更新（v4.3） ──────────────────
  const updateProfile = useCallback(async ({ display_name, bio }) => {
    const res = await api.patch('/auth/me', { display_name, bio })
    setUser(res.data)
    return res.data
  }, [])

  // ── パスワード変更（v4.3） ────────────────────
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await api.patch('/auth/me/password', {
      current_password: currentPassword,
      new_password:      newPassword,
    })
    // パスワード変更自体はレスポンスボディを持たない（204 No Content）
  }, [])

  // ── アバターアップロード（v4.3） ──────────────
  const uploadAvatar = useCallback(async (file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post('/auth/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    })
    setUser(res.data)
    return res.data
  }, [])

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout, register,
      updateProfile, changePassword, uploadAvatar,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
