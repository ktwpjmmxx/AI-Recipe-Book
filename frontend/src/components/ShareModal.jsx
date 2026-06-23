/**
 * components/ShareModal.jsx — レシピ共有モーダル（v4.4 新規）
 *
 * RecipeDetailPage から呼び出す。
 * 公開/非公開のトグルと、公開時の共有URL表示・コピーを担当する。
 */
import { useState } from 'react'
import { setRecipeVisibility } from '../api/recipeApi'

export default function ShareModal({ recipe, onClose, onUpdated }) {
  const [isPublic,  setIsPublic]  = useState(recipe?.is_public ?? false)
  const [sharePath, setSharePath] = useState(
    recipe?.is_public && recipe?.share_id ? `/r/${recipe.share_id}` : null
  )
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(false)
  const [error,   setError]   = useState(null)

  const shareUrl = sharePath ? `${window.location.origin}${sharePath}` : null

  const handleToggle = async () => {
    setLoading(true)
    setError(null)
    try {
      const next = !isPublic
      const res  = await setRecipeVisibility(recipe.id, next)
      setIsPublic(res.is_public)
      setSharePath(res.share_path)
      onUpdated?.(res)
    } catch (err) {
      setError('設定の変更に失敗しました。再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API が使えない環境向けのフォールバックは省略
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>レシピを共有</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--text-3)', lineHeight: 1,
          }}>✕</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {/* 公開トグル */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'var(--bg)', borderRadius: 12, marginBottom: 16,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
              {isPublic ? '公開中' : '非公開'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              {isPublic
                ? 'リンクを知っている人なら誰でも閲覧できます'
                : '自分だけが閲覧できます'}
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={loading}
            style={{
              width: 48, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer',
              background: isPublic ? 'var(--accent-dark)' : '#ccc',
              position: 'relative', transition: 'background .2s', flexShrink: 0,
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: '50%', background: '#fff',
              position: 'absolute', top: 3,
              left: isPublic ? 23 : 3,
              transition: 'left .2s',
              boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            }} />
          </button>
        </div>

        {/* 共有URL */}
        {isPublic && shareUrl && (
          <div>
            <label className="field-label">共有リンク</label>
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center',
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '10px 12px', marginBottom: 8,
            }}>
              <span style={{
                flex: 1, fontSize: 13, color: 'var(--text-2)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {shareUrl}
              </span>
              <button
                onClick={handleCopy}
                style={{
                  flexShrink: 0, fontSize: 12, fontWeight: 600,
                  background: copied ? 'var(--accent-light)' : 'var(--surface)',
                  color: copied ? 'var(--accent-dark)' : 'var(--text-2)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: '6px 12px', cursor: 'pointer',
                }}
              >
                {copied ? '✓ コピー済み' : 'コピー'}
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
              このリンクを知っている人は、ログインなしでレシピを閲覧でき、
              アカウントを持っていれば自分のライブラリにコピー（フォーク）できます。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
