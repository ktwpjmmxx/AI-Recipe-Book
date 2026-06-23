/**
 * pages/LoginPage.jsx — ログインページ
 *
 * Cream & Sage テーマに統一。
 * エラーメッセージはサーバーから返ってきたものをそのまま表示する。
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../global.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください。')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/home', { replace: true })
    } catch (err) {
      const msg = err?.response?.data?.detail
      setError(msg ?? 'ログインに失敗しました。再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--cream)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* ロゴ */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', letterSpacing: '.04em' }}>
              myrecipe
            </span>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
          </div>
          <div style={{
            fontFamily: '"Noto Serif JP", Georgia, serif',
            fontSize: 26, fontWeight: 400, color: 'var(--ink)', lineHeight: 1.3,
          }}>
            おかえりなさい。
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
            続きを始めましょう
          </div>
        </div>

        {/* フォーム */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>

          {error && (
            <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>
          )}

          <div className="field">
            <label className="field-label">メールアドレス</label>
            <input
              type="email"
              className="field-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label className="field-label">パスワード</label>
            <input
              type="password"
              className="field-input"
              placeholder="8文字以上"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoComplete="current-password"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 0', marginTop: 8, fontSize: 15 }}
          >
            {loading ? 'ログイン中…' : 'ログイン'}
          </button>
        </div>

        {/* 登録リンク */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-3)' }}>
          アカウントをお持ちでない方は{' '}
          <Link to="/register" style={{ color: 'var(--accent-dark)', fontWeight: 600, textDecoration: 'none' }}>
            新規登録
          </Link>
        </div>
      </div>
    </div>
  )
}
