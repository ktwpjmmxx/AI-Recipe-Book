/**
 * components/AddByLinkModal.jsx — 共有リンクからレシピを追加（v4.4.1 新規）
 *
 * ライブラリページから呼び出す。
 * 共有URL（http://localhost:5173/r/a1B2c3D4）または share_id 単体
 * （a1B2c3D4）のどちらを貼り付けても受け付ける。
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchPublicRecipe, forkRecipe } from '../api/recipeApi'

/**
 * 入力値から share_id を抽出する。
 * URL全体が貼り付けられた場合は末尾のパス部分だけを取り出す。
 */
function extractShareId(input) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  try {
    // URLとして解釈できる場合はパスの最後の部分を share_id とみなす
    const url = new URL(trimmed)
    const parts = url.pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] ?? ''
  } catch {
    // URLでない場合（share_id を直接貼り付けたケース）はそのまま使う
    // 先頭の "/r/" だけ手入力された場合にも対応
    return trimmed.replace(/^\/?r\//, '')
  }
}

export default function AddByLinkModal({ onClose }) {
  const navigate = useNavigate()
  const [input,   setInput]   = useState('')
  const [preview, setPreview] = useState(null)   // 取得したレシピのプレビュー
  const [loading, setLoading] = useState(false)
  const [forking, setForking] = useState(false)
  const [error,   setError]   = useState(null)

  const handleLookup = async () => {
    const shareId = extractShareId(input)
    if (!shareId) {
      setError('共有リンクまたはIDを入力してください。')
      return
    }
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      const recipe = await fetchPublicRecipe(shareId)
      setPreview({ ...recipe, _shareId: shareId })
    } catch (err) {
      setError('このリンクのレシピは見つかりませんでした。公開されていない可能性があります。')
    } finally {
      setLoading(false)
    }
  }

  const handleFork = async () => {
    if (!preview) return
    setForking(true)
    setError(null)
    try {
      const res = await forkRecipe(preview._shareId)
      onClose()
      navigate(`/recipes/${res.id}`)
    } catch (err) {
      setError('ライブラリへの追加に失敗しました。')
    } finally {
      setForking(false)
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
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>共有リンクから追加</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--text-3)', lineHeight: 1,
          }}>✕</button>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 14 }}>
          友人から受け取った共有URL（例: .../r/a1B2c3D4）を貼り付けると、
          そのレシピをあなたのライブラリに追加できます。
        </p>

        {error && <div className="error-banner">{error}</div>}

        <div className="field">
          <label className="field-label">共有リンク または ID</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="field-input"
              placeholder="https://.../r/a1B2c3D4"
              value={input}
              onChange={e => { setInput(e.target.value); setPreview(null) }}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              style={{ flex: 1 }}
            />
            <button
              onClick={handleLookup}
              disabled={loading}
              style={{
                flexShrink: 0, padding: '0 16px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)', border: '1px solid var(--border)',
                fontSize: 13, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer',
              }}
            >
              {loading ? '検索中…' : '検索'}
            </button>
          </div>
        </div>

        {/* プレビュー */}
        {preview && (
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 12, marginTop: 8, marginBottom: 16,
            display: 'flex', gap: 12, alignItems: 'center',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 10, flexShrink: 0,
              background: 'var(--accent-light)', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {preview.image_url
                ? <img src={preview.image_url} alt={preview.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 24, opacity: .4 }}>🍳</span>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{preview.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                {preview.cook_time}分 · {preview.base_servings}人前
              </div>
            </div>
          </div>
        )}

        {preview && (
          <button
            onClick={handleFork}
            disabled={forking}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 0', fontSize: 15 }}
          >
            {forking ? '追加中…' : 'このレシピをライブラリに追加'}
          </button>
        )}
      </div>
    </div>
  )
}
