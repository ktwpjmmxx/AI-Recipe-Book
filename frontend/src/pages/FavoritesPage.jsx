import { useState, useEffect } from 'react'
import { fetchRecipes } from '../api/recipeApi'
import RecipeCard from '../components/RecipeCard'
import BottomNav  from '../components/BottomNav'
import '../global.css'

export default function FavoritesPage() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecipes({ favorites_only: true })
      .then(setRecipes)
      .finally(() => setLoading(false))
  }, [])

  const handleUpdate = (updated) => {
    if (!updated.is_favorite) {
      setRecipes(prev => prev.filter(r => r.id !== updated.id))
    } else {
      setRecipes(prev => prev.map(r => r.id === updated.id ? updated : r))
    }
  }

  return (
    <div className="page-wrapper">
      <div className="topbar">
        <div className="topbar-row">
          <div>
            <div className="topbar-title">お気に入り</div>
            <div className="topbar-sub">{recipes.length} レシピ</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {loading ? (
          <div className="spinner"><i className="ti ti-loader-2" style={{ fontSize: 24 }} />読み込み中…</div>
        ) : recipes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%', background: 'var(--gold-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
            }}>
              <i className="ti ti-heart" style={{ fontSize: 28, color: 'var(--gold-dark)' }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>お気に入りがまだありません</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.7 }}>
              レシピ詳細のハートマークをタップして<br />お気に入りに登録できます
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recipes.map(r => (
              <RecipeCard key={r.id} recipe={r} onUpdate={handleUpdate} />
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
