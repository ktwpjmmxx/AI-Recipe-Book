import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import '../global.css'

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

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const { t } = useTranslation()

  const [displayName, setDisplayName] = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [error,       setError]       = useState(null)
  const [loading,     setLoading]     = useState(false)

  const check = checkPolicy(password)

  // 翻訳キーを使ったルール定義（コンポーネント内で定義してtを参照できるようにする）
  const RULES = [
    { key: 'hasLower',  labelKey: 'register.ruleLower'  },
    { key: 'hasUpper',  labelKey: 'register.ruleUpper'  },
    { key: 'hasDigit',  labelKey: 'register.ruleDigit'  },
    { key: 'hasSymbol', labelKey: 'register.ruleSymbol' },
  ]

  const handleSubmit = async () => {
    if (!email || !password) { setError(t('register.errorRequired')); return }
    if (password.length < 8)  { setError(t('register.errorTooShort')); return }
    if (!check.ok)            { setError(t('register.errorWeak'));     return }
    if (password !== confirm)  { setError(t('register.errorMismatch')); return }
    setLoading(true)
    setError(null)
    try {
      await register(email, password, displayName)
      navigate('/home', { replace: true })
    } catch (err) {
      const msg = err?.response?.data?.detail
      setError(msg ?? t('register.errorFailed'))
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
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', letterSpacing: '.04em' }}>myrecipe</span>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
          </div>
          <div style={{ fontFamily: '"Noto Serif JP", Georgia, serif', fontSize: 26, fontWeight: 400, color: 'var(--ink)', lineHeight: 1.3 }}>
            {t('register.welcome')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
            {t('register.welcomeSub')}
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>

          {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="field">
            <label className="field-label">{t('register.nameLabel')}</label>
            <input type="text" className="field-input" placeholder={t('register.namePlaceholder')}
              value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>

          <div className="field">
            <label className="field-label">{t('register.emailLabel')}</label>
            <input type="email" className="field-input" placeholder={t('register.emailPlaceholder')}
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>

          <div className="field">
            <label className="field-label">{t('register.passwordLabel')}</label>
            <input type="password" className="field-input" placeholder={t('register.pwPlaceholder')}
              value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
            {password && (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {RULES.map(rule => (
                  <div key={rule.key} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 11, color: check[rule.key] ? '#3B6D11' : 'var(--text-3)',
                  }}>
                    <span>{check[rule.key] ? '✓' : '○'}</span>
                    {t(rule.labelKey)}
                  </div>
                ))}
              </div>
            )}
            {password && (
              <div style={{ marginTop: 6, fontSize: 11.5, color: check.ok ? '#3B6D11' : '#b91c1c' }}>
                {check.ok
                  ? t('register.strengthOk')
                  : t('register.strengthNeed', { count: Math.max(0, 3 - check.variety) })
                }
              </div>
            )}
          </div>

          <div className="field">
            <label className="field-label">{t('register.confirmLabel')}</label>
            <input type="password" className="field-input" placeholder={t('register.confirmPlaceholder')}
              value={confirm} onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} autoComplete="new-password" />
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
            {loading ? t('register.submitting') : t('register.submit')}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-3)' }}>
          {t('register.toLogin')}{' '}
          <Link to="/login" style={{ color: 'var(--accent-dark)', fontWeight: 600, textDecoration: 'none' }}>
            {t('register.loginLink')}
          </Link>
        </div>
      </div>
    </div>
  )
}
