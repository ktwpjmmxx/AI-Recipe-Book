/**
 * pages/RegisterPage.jsx — 新規登録ページ
 *
 * v4.3.1 変更:
 *   - パスワード強度ポリシー（最低3種類の文字種）をフロントでも検証
 *   - バックエンドの validate_password_strength() と同じロジックを適用
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../global.css'

// ChangePasswordModal.jsx と同一ロジック（ポリシーの一貫性を保つ）
function checkPolicy(pw) {
  if (!pw) return { ok: false, variety: 0 }
  const hasLower  = /[a-z]/.test(pw)
  const hasUpper  = /[A-Z]/.test(pw)
  const hasDigit  = /[0-9]/.test(pw)
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw)
  const variety   = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length
  const isWeakPattern = /^(password|passw0rd|qwerty|12345678|11111111)$/i.test(pw)
  return { ok: pw.length >= 8 && variety >= 3 && !isWeakPattern, variety, hasLower, hasUpper, hasDigit, hasSymbol, isWeakPattern }
}

const RULES = [
  { key: 'hasLower',  label: '英小文字' },
  { key: 'hasUpper',  label: '英大文字' },
  { key: 'hasDigit',  label: '数字' },
  { key: 'hasSymbol', label: '記号' },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [error,       setError]       = useState(null)
  const [loading,     setLoading]     = useState(false)

  const check = checkPolicy(password)

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください。')
      return
    }
    if (password.length < 8) {
      setError('パスワードは8文字以上で設定してください。')
      return
    }
    if (!check.ok) {
      setError('パスワードには英大文字・英小文字・数字・記号のうち最低3種類を含めてください。')
      return
    }
    if (password !== confirm) {
      setError('パスワードが一致しません。')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await register(email, password, displayName)
      navigate('/home', { replace: true })
    } catch (err) {
      const msg = err?.response?.data?.detail
      setError(msg ?? '登録に失敗しました。再度お試しください。')
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
            はじめまして。
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
            あなただけのレシピブックを作りましょう
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>

          {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="field">
            <label className="field-label">表示名（任意）</label>
            <input
              type="text" className="field-input" placeholder="例: 田中"
              value={displayName} onChange={e => setDisplayName(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label">メールアドレス</label>
            <input
              type="email" className="field-input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
            />
          </div>

          <div className="field">
            <label className="field-label">パスワード（8文字以上・3種類以上の文字種）</label>
            <input
              type="password" className="field-input" placeholder="英大文字・英小文字・数字・記号のうち3種類"
              value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password"
            />
            {password && (
              <div style={{
                marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
              }}>
                {RULES.map(rule => (
                  <div key={rule.key} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 11, color: check[rule.key] ? '#3B6D11' : 'var(--text-3)',
                  }}>
                    <span>{check[rule.key] ? '✓' : '○'}</span>
                    {rule.label}
                  </div>
                ))}
              </div>
            )}
            {password && (
              <div style={{
                marginTop: 6, fontSize: 11.5,
                color: check.ok ? '#3B6D11' : '#b91c1c',
              }}>
                {check.ok ? '✓ 安全な強度のパスワードです。' : `あと${Math.max(0, 3 - check.variety)}種類の文字を追加してください。`}
              </div>
            )}
          </div>

          <div className="field">
            <label className="field-label">パスワード（確認）</label>
            <input
              type="password" className="field-input" placeholder="もう一度入力"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} autoComplete="new-password"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || (password.length > 0 && !check.ok)}
            className="btn btn-primary"
            style={{
              width: '100%', justifyContent: 'center', padding: '12px 0', marginTop: 8, fontSize: 15,
              opacity: (password.length > 0 && !check.ok) ? .5 : 1,
            }}
          >
            {loading ? '登録中…' : 'アカウントを作成'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-3)' }}>
          すでにアカウントをお持ちの方は{' '}
          <Link to="/login" style={{ color: 'var(--accent-dark)', fontWeight: 600, textDecoration: 'none' }}>
            ログイン
          </Link>
        </div>
      </div>
    </div>
  )
}
