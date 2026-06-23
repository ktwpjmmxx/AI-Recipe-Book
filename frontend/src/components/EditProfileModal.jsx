/**
 * components/EditProfileModal.jsx — プロフィール編集モーダル
 *
 * 機能:
 *   - プロフィール画像のアップロード（タップで選択 → 即時アップロード）
 *   - 表示名の編集
 *   - 一言プロフィール（bio）の編集（Twitter的な軽い自己紹介欄、140文字まで）
 */
import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const BIO_MAX_LEN = 140

export default function EditProfileModal({ onClose }) {
  const { user, updateProfile, uploadAvatar } = useAuth()
  const fileInputRef = useRef(null)

  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [bio,         setBio]         = useState(user?.bio || '')
  const [avatarUrl,   setAvatarUrl]   = useState(user?.avatar_url || null)
  const [uploading,   setUploading]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)

  const initial = (displayName || user?.email || '?').charAt(0).toUpperCase()

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const updated = await uploadAvatar(file)
      setAvatarUrl(updated.avatar_url)
    } catch (err) {
      setError('画像のアップロードに失敗しました。')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateProfile({ display_name: displayName.trim(), bio: bio.trim() })
      onClose()
    } catch (err) {
      const msg = err?.response?.data?.detail
      setError(msg ?? '保存に失敗しました。再度お試しください。')
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
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>プロフィール編集</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--text-3)', lineHeight: 1,
          }}>✕</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {/* アバター */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 84, height: 84, borderRadius: '50%',
              background: avatarUrl ? 'transparent' : 'var(--accent-light)',
              color: 'var(--accent-dark)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 600,
              cursor: 'pointer', position: 'relative', overflow: 'hidden',
              border: '1px solid var(--border)',
            }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initial
            }
            {uploading && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: '#fff',
              }}>
                アップロード中…
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleAvatarSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              marginTop: 10, background: 'none', border: 'none',
              fontSize: 13, color: 'var(--accent-dark)', fontWeight: 600, cursor: 'pointer',
            }}
          >
            画像を変更
          </button>
        </div>

        {/* 表示名 */}
        <div className="field">
          <label className="field-label">表示名</label>
          <input
            type="text"
            className="field-input"
            placeholder="例: 田中"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={50}
          />
        </div>

        {/* 一言プロフィール（bio） */}
        <div className="field">
          <label className="field-label">一言プロフィール（任意）</label>
          <textarea
            className="field-input"
            placeholder="例: 週末に作り置きするのが好きです🍳"
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, BIO_MAX_LEN))}
            style={{ minHeight: 64, resize: 'vertical' }}
          />
          <div style={{
            textAlign: 'right', fontSize: 11, color: 'var(--text-3)', marginTop: 4,
          }}>
            {bio.length} / {BIO_MAX_LEN}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px 0', marginTop: 8, fontSize: 15 }}
        >
          {saving ? '保存中…' : '保存する'}
        </button>
      </div>
    </div>
  )
}
