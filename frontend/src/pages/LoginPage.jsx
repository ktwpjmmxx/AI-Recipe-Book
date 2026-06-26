import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import '../global.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useTranslation()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async () => {
    if (!email || !password) {
      setError(t('login.errorRequired'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/home', { replace: true })
    } catch (err) {
      const msg = err?.response?.data?.detail
      setError(msg ?? t('login.errorFailed'))
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
            {t('login.welcome')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
            {t('login.welcomeSub')}
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>

          {error && (
            <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>
          )}

          <div className="field">
            <label className="field-label">{t('login.emailLabel')}</label>
            <input
              type="email"
              className="field-input"
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label className="field-label">{t('login.passwordLabel')}</label>
            <input
              type="password"
              className="field-input"
              placeholder={t('login.pwPlaceholder')}
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
            {loading ? t('login.submitting') : t('login.submit')}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-3)' }}>
          {t('login.toRegister')}{' '}
          <Link to="/register" style={{ color: 'var(--accent-dark)', fontWeight: 600, textDecoration: 'none' }}>
            {t('login.registerLink')}
          </Link>
        </div>
      </div>
    </div>
  )
}
