/**
 * pages/PublicRecipePage.jsx — 公開レシピ閲覧ページ（v4.4 新規）
 *
 * URL: /r/:shareId
 * 認証不要でアクセスできる（App.jsx で ProtectedRoute の外に配置する）。
 *
 * ログイン中のユーザーには「ライブラリに追加」ボタンを表示し、
 * フォーク（複製）を実行できるようにする。
 * 未ログインの場合は「ログインして追加」のリンクをログイン画面へ誘導する。
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchPublicRecipe, forkRecipe } from '../api/recipeApi'
import '../global.css'

export default function PublicRecipePage() {
  const { shareId } = useParams()
  const navigate     = useNavigate()
  const { user }     = useAuth()

  const [recipe,  setRecipe]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [forking, setForking] = useState(false)
  const [forkedId, setForkedId] = useState(null)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetchPublicRecipe(shareId)
      .then(setRecipe)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [shareId])

  const handleFork = async () => {
    setForking(true)
    setError(null)
    try {
      const res = await forkRecipe(shareId)
      setForkedId(res.id)
    } catch (err) {
      setError('ライブラリへの追加に失敗しました。再度お試しください。')
    } finally {
      setForking(false)
    }
  }

  if (loading) return <div className="spinner">読み込み中…</div>

  if (notFound) return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
      background: 'var(--cream)',
    }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
      <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
        このレシピは公開されていません
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.7 }}>
        リンクが間違っているか、オーナーが非公開に設定した可能性があります。
      </p>
    </div>
  )

  return (
    <div className="page-wrapper">

      {/* シンプルヘッダー（ログイン状態に関わらず表示） */}
      <div className="topbar">
        <div className="topbar-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>myrecipe</span>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
          </div>
          {!user && (
            <Link to="/login" className="btn btn-ghost" style={{ fontSize: 13, padding: '6px 14px' }}>
              ログイン
            </Link>
          )}
        </div>
      </div>

      {/* ヒーロー画像 */}
      <div style={{ position: 'relative', height: 220 }}>
        {recipe.image_url
          ? <img src={recipe.image_url} alt={recipe.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 64, opacity: .4 }}>🍳</span>
            </div>
        }
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: 'rgba(0,0,0,.55)', color: '#fff',
          fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
        }}>
          公開レシピ
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <span className={`cat-badge cat-${recipe.category}`}>{recipe.category}</span>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 10px', color: 'var(--ink)' }}>
          {recipe.title}
        </h1>
        {recipe.description && (
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 16 }}>
            {recipe.description}
          </p>
        )}

        <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 13, color: 'var(--text-3)' }}>
          <span>⏱ 調理 {recipe.cook_time}分</span>
          <span>👥 {recipe.base_servings}人前</span>
        </div>

        {/* 材料 */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ padding: '0 0 8px' }}>材料</div>
          {(recipe.ingredients ?? []).map((ing, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 14,
            }}>
              <span>{ing.name}</span>
              <span style={{ color: 'var(--text-2)' }}>
                {ing.amount_text || `${ing.amount ?? ''} ${ing.unit ?? ''}`.trim()}
              </span>
            </div>
          ))}
        </div>

        {/* 手順 */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ padding: '0 0 8px' }}>作り方</div>
          {(recipe.steps ?? []).map(step => (
            <div key={step.order} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent-dark)', color: '#fff',
                fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {step.order}
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }}>{step.description}</p>
            </div>
          ))}
        </div>

        {error && <div className="error-banner">{error}</div>}

        {/* フォークアクション */}
        {forkedId ? (
          <div style={{
            background: 'var(--accent-light)', border: '1px solid var(--accent-100)',
            borderRadius: 12, padding: 16, textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, color: 'var(--accent-dark)', fontWeight: 600, marginBottom: 10 }}>
              ✓ ライブラリに追加しました
            </p>
            <button
              onClick={() => navigate(`/recipes/${forkedId}`)}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }}
            >
              レシピを見る
            </button>
          </div>
        ) : user ? (
          <button
            onClick={handleFork}
            disabled={forking}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '13px 0', fontSize: 15 }}
          >
            {forking ? '追加中…' : '＋ 自分のライブラリに追加'}
          </button>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 10 }}>
              ライブラリに追加するにはログインが必要です
            </p>
            <Link
              to="/login"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '13px 0' }}
            >
              ログインして追加する
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
