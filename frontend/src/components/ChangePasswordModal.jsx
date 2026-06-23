/**
 * components/ChangePasswordModal.jsx — パスワード変更モーダル
 *
 * v4.3.1 変更:
 *   - 強度チェックを「警告のみ」から「送信をブロックする」仕様に変更
 *   - バックエンドの validate_password_strength() と同じポリシーをフロントでも適用
 *     （UXとして送信前に気づけるようにする。最終的な強制はバックエンド側で行う）
 */
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

// ── パスワード強度判定（バックエンドの validate_password_strength と同じポリシー） ──
// 英大文字 / 英小文字 / 数字 / 記号のうち、最低3種類を必須とする。
function checkPolicy(pw) {
  if (!pw) return { ok: false, variety: 0 }

  const hasLower  = /[a-z]/.test(pw)
  const hasUpper  = /[A-Z]/.test(pw)
  const hasDigit  = /[0-9]/.test(pw)
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw)
  const variety   = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length

  const isWeakPattern = /^(password|passw0rd|qwerty|12345678|11111111)$/i.test(pw)

  return {
    ok:      pw.length >= 8 && variety >= 3 && !isWeakPattern,
    variety,
    hasLower, hasUpper, hasDigit, hasSymbol,
    isWeakPattern,
  }
}

function strengthLevel(check) {
  if (!check.ok && check.variety <= 1) return 'weak'
  if (!check.ok && check.variety === 2) return 'medium'
  if (check.ok) return 'strong'
  return 'weak'
}

const STRENGTH_COLOR = {
  weak:   { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  medium: { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  strong: { bg: '#EAF3DE', text: '#3B6D11', border: '#C0DD97' },
}

// 4種類の文字種チェックリスト表示用
const RULES = [
  { key: 'hasLower',  label: '英小文字（a-z）' },
  { key: 'hasUpper',  label: '英大文字（A-Z）' },
  { key: 'hasDigit',  label: '数字（0-9）' },
  { key: 'hasSymbol', label: '記号（!?#など）' },
]

export default function ChangePasswordModal({ onClose }) {
  const { changePassword } = useAuth()

  const [currentPw, setCurrentPw] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error,     setError]     = useState(null)
  const [success,   setSuccess]   = useState(false)
  const [saving,    setSaving]    = useState(false)

  const check = checkPolicy(newPw)
  const level = newPw ? strengthLevel(check) : null

  const handleSubmit = async () => {
    if (!currentPw || !newPw) {
      setError('すべての項目を入力してください。')
      return
    }
    if (newPw.length < 8) {
      setError('新しいパスワードは8文字以上で設定してください。')
      return
    }
    // ── ここでブロックする（送信前にフロントで強制） ──
    if (!check.ok) {
      setError('パスワードには英大文字・英小文字・数字・記号のうち最低3種類を含めてください。')
      return
    }
    if (newPw !== confirmPw) {
      setError('新しいパスワードが一致しません。')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await changePassword(currentPw, newPw)
      setSuccess(true)
      setTimeout(() => onClose(), 1500)
    } catch (err) {
      // バックエンドが最終的に拒否した場合もここでメッセージ表示
      const msg = err?.response?.data?.detail
      setError(msg ?? 'パスワードの変更に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300, padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20,
        padding: 24, maxWidth: 380, width: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>パスワード変更</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--text-3)', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* 注意書き */}
        <div style={{
          background: 'var(--accent-light)', border: '1px solid var(--accent-100)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 18,
          fontSize: 12, color: 'var(--accent-dark)', lineHeight: 1.6,
          display: 'flex', gap: 8,
        }}>
          <span style={{ flexShrink: 0 }}>🔒</span>
          <span>
            英大文字・英小文字・数字・記号のうち<strong>最低3種類</strong>を組み合わせてください。
            数字だけ・英字だけのパスワードは設定できません。
          </span>
        </div>

        {success ? (
          <div style={{
            background: '#EAF3DE', border: '1px solid #C0DD97',
            borderRadius: 10, padding: '16px', textAlign: 'center',
            fontSize: 14, color: '#3B6D11', fontWeight: 600,
          }}>
            ✓ パスワードを変更しました
          </div>
        ) : (
          <>
            {error && <div className="error-banner">{error}</div>}

            <div className="field">
              <label className="field-label">現在のパスワード</label>
              <input
                type="password"
                className="field-input"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="field">
              <label className="field-label">新しいパスワード（8文字以上）</label>
              <input
                type="password"
                className="field-input"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                autoComplete="new-password"
              />

              {/* 強度バナー */}
              {level && (
                <div style={{
                  marginTop: 8, fontSize: 11.5, padding: '8px 10px', borderRadius: 6,
                  background:   STRENGTH_COLOR[level].bg,
                  color:        STRENGTH_COLOR[level].text,
                  border:       `1px solid ${STRENGTH_COLOR[level].border}`,
                }}>
                  {check.isWeakPattern
                    ? 'このパスワードは推測されやすいため使用できません。'
                    : check.ok
                      ? '✓ 安全な強度のパスワードです。'
                      : `あと${3 - check.variety}種類の文字を追加してください。`
                  }
                </div>
              )}

              {/* 文字種チェックリスト */}
              {newPw && (
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
            </div>

            <div className="field">
              <label className="field-label">新しいパスワード（確認）</label>
              <input
                type="password"
                className="field-input"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoComplete="new-password"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={saving || (newPw.length > 0 && !check.ok)}
              className="btn btn-primary"
              style={{
                width: '100%', justifyContent: 'center', padding: '12px 0', marginTop: 8, fontSize: 15,
                opacity: (newPw.length > 0 && !check.ok) ? .5 : 1,
                cursor:  (newPw.length > 0 && !check.ok) ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '変更中…' : '変更する'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
