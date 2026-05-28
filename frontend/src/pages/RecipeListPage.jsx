import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchRecipes, fetchCategories } from '../api/recipeApi'
import RecipeCard from '../components/RecipeCard'
import BottomNav  from '../components/BottomNav'
import '../global.css'

const SORTS = [
  { value: 'updated_at', label: '更新日時' },
  { value: 'title',      label: '料理名'   },
  { value: 'cook_time',  label: '調理時間' },
]

export default function RecipeListPage() {
  const navigate = useNavigate()
  const [recipes,    setRecipes]    = useState([])
  const [categories, setCategories] = useState([])
  const [category,   setCategory]   = useState('')
  const [sort,       setSort]       = useState('updated_at')
  const [order,      setOrder]      = useState('desc')
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    fetchRecipes({ category: category || undefined, sort, order })
      .then(setRecipes)
      .finally(() => setLoading(false))
  }, [category, sort, order])

  useEffect(() => { load() }, [load])

  const handleUpdate = (updated) => {
    setRecipes(prev => prev.map(r => r.id === updated.id ? updated : r))
  }

  return (
    <div className="page-wrapper">
      {/* ── ヘッダー ── */}
      <div className="topbar">
        <div className="topbar-row">
          <div>
            <div className="topbar-title">My Recipes</div>
            <div className="topbar-sub">{recipes.length} レシピ</div>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginTop: 10,
        }}>
          <i className="ti ti-search" style={{ color: 'var(--text-3)', fontSize: 17 }} />
          <input
            placeholder="レシピを検索…"
            style={{ border: 'none', background: 'transparent', fontSize: 14, width: '100%', outline: 'none' }}
            readOnly
          />
        </div>
      </div>

      {/* ── カテゴリチップ ── */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px',
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {['', ...categories].map(cat => (
          <button
            key={cat || 'all'}
            onClick={() => setCategory(cat)}
            style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 999, fontSize: 13,
              border: '1px solid',
              borderColor: category === cat ? 'var(--blue-500)' : 'var(--border)',
              background:  category === cat ? 'var(--blue-500)' : 'var(--surface)',
              color:       category === cat ? '#fff' : 'var(--text-2)',
              cursor: 'pointer', transition: 'all var(--t)',
            }}
          >{cat || 'すべて'}</button>
        ))}
      </div>

      {/* ── ソートバー ── */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>並び順</span>
        <select
          value={sort} onChange={e => setSort(e.target.value)}
          style={{
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            padding: '5px 8px', fontSize: 13, background: 'var(--surface)',
            color: 'var(--text-1)', outline: 'none',
          }}
        >
          {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button
          onClick={() => setOrder(o => o === 'desc' ? 'asc' : 'desc')}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '5px 9px',
            cursor: 'pointer', fontSize: 16, color: 'var(--text-2)',
          }}
        >
          <i className={`ti ti-sort-${order === 'desc' ? 'descending' : 'ascending'}`} />
        </button>
      </div>

      {/* ── カードリスト ── */}
      {loading ? (
        <div className="spinner">
          <i className="ti ti-loader-2" style={{ fontSize: 24 }} />読み込み中…
        </div>
      ) : recipes.length === 0 ? (
        /* ⑥ 改善した空状態 */
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '3rem 2rem', gap: 8,
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'var(--blue-50)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 4,
          }}>
            <i className="ti ti-tools-kitchen-2" style={{ fontSize: 28, color: 'var(--blue-500)' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
            {category ? `「${category}」のレシピはまだありません` : 'レシピがまだありません'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.7 }}>
            作ったレシピを記録しておけば<br />人数別の分量計算やAI相談が使えます
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            onClick={() => navigate('/recipes/new')}
          >
            <i className="ti ti-plus" />最初のレシピを追加
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px' }}>
          {recipes.map(r => (
            <RecipeCard key={r.id} recipe={r} onUpdate={handleUpdate} />
          ))}
        </div>
      )}

      <button className="fab" onClick={() => navigate('/recipes/new')} aria-label="レシピを追加">
        <i className="ti ti-plus" />
      </button>
      <BottomNav />
    </div>
  )
}
