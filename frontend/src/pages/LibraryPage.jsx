import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchRecipes } from '../api/recipeApi'
import RecipeCard from '../components/RecipeCard'
import BottomNav  from '../components/BottomNav'
import '../global.css'

const SORT_OPTIONS = [
  { key: 'date',    label: '追加日順' },
  { key: 'genre',   label: 'ジャンル順' },
  { key: 'kana',    label: '五十音順' },
  { key: 'time',    label: '調理時間' },
]

// 月ラベル
function monthLabel(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

// 五十音の行グループ
function kanaGroup(title) {
  const c = title[0]
  const groups = [
    ['あ行', /^[あいうえおぁぃぅぇぉアイウエオァィゥェォa-zA-Z]/],
    ['か行', /^[かきくけこカキクケコ]/],
    ['さ行', /^[さしすせそサシスセソ]/],
    ['た行', /^[たちつてとタチツテト]/],
    ['な行', /^[なにぬねのナニヌネノ]/],
    ['は行', /^[はひふへほハヒフヘホ]/],
    ['ま行', /^[まみむめもマミムメモ]/],
    ['や行', /^[やゆよヤユヨ]/],
    ['ら行', /^[らりるれろラリルレロ]/],
    ['わ行', /^[わをんワヲン]/],
  ]
  for (const [label, re] of groups) {
    if (re.test(c)) return label
  }
  return 'その他'
}

// レシピをグループ化して [{header, items}] に変換
function groupRecipes(recipes, sortKey) {
  if (sortKey === 'date') {
    const groups = {}
    recipes.forEach(r => {
      const key = monthLabel(r.created_at)
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })
    return Object.entries(groups).map(([header, items]) => ({ header, items }))
  }
  if (sortKey === 'genre') {
    const groups = {}
    recipes.forEach(r => {
      if (!groups[r.category]) groups[r.category] = []
      groups[r.category].push(r)
    })
    return Object.entries(groups).map(([header, items]) => ({ header, items }))
  }
  if (sortKey === 'kana') {
    const groups = {}
    recipes.forEach(r => {
      const key = kanaGroup(r.title)
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })
    return Object.entries(groups).map(([header, items]) => ({ header, items }))
  }
  if (sortKey === 'time') {
    const groups = {
      '〜15分': [],
      '16〜30分': [],
      '31〜60分': [],
      '60分以上': [],
    }
    recipes.forEach(r => {
      if      (r.cook_time <= 15)  groups['〜15分'].push(r)
      else if (r.cook_time <= 30)  groups['16〜30分'].push(r)
      else if (r.cook_time <= 60)  groups['31〜60分'].push(r)
      else                          groups['60分以上'].push(r)
    })
    return Object.entries(groups)
      .filter(([, items]) => items.length > 0)
      .map(([header, items]) => ({ header, items }))
  }
  return [{ header: '', items: recipes }]
}

export default function LibraryPage() {
  const [recipes,  setRecipes]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [sortKey,  setSortKey]  = useState('date')
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    fetchRecipes({ sort: 'created_at', order: 'desc' })
      .then(setRecipes)
      .finally(() => setLoading(false))
  }, [])

  const handleUpdate = (updated) => {
    setRecipes(prev => prev.map(r => r.id === updated.id ? updated : r))
  }

  // ソート済みリスト
  const sorted = useMemo(() => {
    let list = [...recipes]
    if (search.trim()) {
      list = list.filter(r => r.title.includes(search.trim()))
    }
    if (sortKey === 'date')  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sortKey === 'genre') list.sort((a, b) => a.category.localeCompare(b.category, 'ja'))
    if (sortKey === 'kana')  list.sort((a, b) => a.title.localeCompare(b.title, 'ja'))
    if (sortKey === 'time')  list.sort((a, b) => a.cook_time - b.cook_time)
    return list
  }, [recipes, sortKey, search])

  const groups = useMemo(() => groupRecipes(sorted, sortKey), [sorted, sortKey])

  return (
    <div className="page-wrapper">
      {/* ── ヘッダー ── */}
      <div className="topbar">
        <div className="topbar-row">
          <div>
            <div className="topbar-title">ライブラリ</div>
            <div className="topbar-sub">{recipes.length} レシピ保存中</div>
          </div>
        </div>
        {/* 検索バー */}
        <div className="topbar-search">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            placeholder="レシピを検索…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.7)', fontSize: 16, padding: 0 }}
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ── ソートタブ ── */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 16px',
        overflowX: 'auto', scrollbarWidth: 'none',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortKey(opt.key)}
            style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 999,
              fontSize: 13, border: '1px solid',
              borderColor: sortKey === opt.key ? 'var(--blue)' : 'var(--border)',
              background:  sortKey === opt.key ? 'var(--blue)' : 'var(--surface)',
              color:       sortKey === opt.key ? '#fff' : 'var(--text-2)',
              cursor: 'pointer', transition: 'all var(--t)',
            }}
          >{opt.label}</button>
        ))}
      </div>

      {/* ── コンテンツ ── */}
      {loading ? (
        <div className="spinner">
          <i className="ti ti-loader-2" style={{ fontSize: 24 }} />読み込み中…
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', background: 'var(--gold-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
          }}>
            <i className="ti ti-tools-kitchen-2" style={{ fontSize: 28, color: 'var(--gold-dark)' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600 }}>
            {search ? `「${search}」のレシピは見つかりませんでした` : 'レシピがまだありません'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.7 }}>
            右下の ＋ ボタンからレシピを追加できます
          </p>
        </div>
      ) : (
        <div style={{ paddingBottom: 8 }}>
          {groups.map(({ header, items }) => (
            <div key={header}>
              {header && (
                <div style={{
                  padding: '10px 16px 5px',
                  fontSize: 12, fontWeight: 600,
                  color: 'var(--text-3)', letterSpacing: '.05em',
                  background: 'var(--bg)',
                  borderBottom: '1px solid var(--border)',
                }}>{header}</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 16px 2px' }}>
                {items.map(r => (
                  <RecipeCard key={r.id} recipe={r} onUpdate={handleUpdate} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
