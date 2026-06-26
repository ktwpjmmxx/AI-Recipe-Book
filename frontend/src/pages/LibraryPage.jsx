import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useRecipes } from '../hooks/useRecipes'
import { useSavedShoppingLists } from '../hooks/useShoppingList'
import RecipeCard from '../components/RecipeCard'
import BottomNav  from '../components/BottomNav'
import AddByLinkModal from '../components/AddByLinkModal'
import '../global.css'

// ソートキーは固定値だがラベルは翻訳する
const SORT_KEYS = ['date', 'genre', 'kana', 'time']

function monthLabel(dateStr, locale) {
  const d = new Date(dateStr)
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'long' })
}

function kanaGroup(title, t) {
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
  for (const [label, re] of groups) if (re.test(c)) return label
  return t('library.kanaOther')
}

function groupRecipes(recipes, sortKey, t, dateLocale) {
  if (sortKey === 'date') {
    const groups = {}
    recipes.forEach(r => {
      const key = monthLabel(r.created_at, dateLocale)
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
      const key = kanaGroup(r.title, t)
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })
    return Object.entries(groups).map(([header, items]) => ({ header, items }))
  }
  if (sortKey === 'time') {
    const groups = {
      [t('library.timeGroup1')]: [],
      [t('library.timeGroup2')]: [],
      [t('library.timeGroup3')]: [],
      [t('library.timeGroup4')]: [],
    }
    const keys = Object.keys(groups)
    recipes.forEach(r => {
      if      (r.cook_time <= 15) groups[keys[0]].push(r)
      else if (r.cook_time <= 30) groups[keys[1]].push(r)
      else if (r.cook_time <= 60) groups[keys[2]].push(r)
      else                         groups[keys[3]].push(r)
    })
    return Object.entries(groups).filter(([, i]) => i.length > 0).map(([header, items]) => ({ header, items }))
  }
  return [{ header: '', items: recipes }]
}

// ── 買い物リスト一覧サブタブ ──
function ShoppingListsTab() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { lists, loading, error, load, handleDelete } = useSavedShoppingLists()
  const [delId, setDelId] = useState(null)

  const dateLocaleMap = { ja: 'ja-JP', en: 'en-US', tr: 'tr-TR' }
  const dateLocale = dateLocaleMap[i18n.resolvedLanguage] ?? 'ja-JP'

  useEffect(() => { load() }, [load])

  const fmtDate = (str) => {
    const d = new Date(str)
    return d.toLocaleString(dateLocale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <div className="spinner">{t('common.loading')}</div>
  if (error)   return <div style={{ padding:'2rem 16px' }}><div className="error-banner">{error}</div></div>

  if (lists.length === 0) return (
    <div style={{ textAlign:'center', padding:'4rem 2rem' }}>
      <div style={{ width:60, height:60, borderRadius:'50%', background:'var(--accent-light)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:28 }}>🛒</div>
      <p style={{ fontSize:15, fontWeight:600, marginBottom:6 }}>{t('library.shoppingEmptyTitle')}</p>
      <p style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.7 }}>
        {t('library.shoppingEmptyHint').split('\n').map((line, i) => (
          <span key={i}>{line}{i === 0 && <br />}</span>
        ))}
      </p>
    </div>
  )

  return (
    <div style={{ padding:'14px 16px' }}>
      {lists.map(list => {
        const needItems = (list.items ?? []).filter(i => !i.is_text && (i.needed ?? 0) > 0)
        const doneCount = (list.items ?? []).filter(i => i.checked).length
        const total     = (list.items ?? []).length
        return (
          <div key={list.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'14px 16px', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:600, marginBottom:3 }}>{list.recipe_title}</div>
                <div style={{ fontSize:12, color:'var(--text-3)', display:'flex', gap:10 }}>
                  <span>👥 {t('common.servingsUnit', { count: list.servings })}</span>
                  <span>🕐 {fmtDate(list.created_at)}</span>
                </div>
              </div>
              <button onClick={() => setDelId(list.id)} style={{ background:'#fef2f2', border:'1px solid #fecaca', color:'#b91c1c', borderRadius:'var(--radius-sm)', padding:'4px 10px', fontSize:12, cursor:'pointer', flexShrink:0, marginLeft:8 }}>
                🗑 {t('common.delete')}
              </button>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <div style={{ flex:1, height:4, background:'#E5E7EB', borderRadius:999, overflow:'hidden' }}>
                <div style={{ height:'100%', background: doneCount===total&&total>0 ? '#3B6D11' : 'var(--accent-dark)', borderRadius:999, width:`${total>0?(doneCount/total)*100:0}%`, transition:'width .3s ease' }} />
              </div>
              <span style={{ fontSize:11, color:'var(--text-3)', flexShrink:0 }}>
                {t('library.progressDone', { done: doneCount, total })}
              </span>
            </div>

            {needItems.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                {needItems.slice(0,3).map((item,i) => (
                  <span key={i} style={{ fontSize:11, background:'var(--accent-light)', color:'var(--accent-dark)', padding:'2px 8px', borderRadius:4 }}>
                    {item.name} {item.needed}{item.unit}
                  </span>
                ))}
                {needItems.length > 3 && (
                  <span style={{ fontSize:11, color:'var(--text-3)', padding:'2px 4px' }}>
                    {t('library.moreItems', { count: needItems.length - 3 })}
                  </span>
                )}
              </div>
            )}

            <button onClick={() => navigate(`/shopping-lists/${list.id}`)} style={{ width:'100%', padding:'8px 0', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', fontSize:13, fontWeight:600, color:'var(--accent-dark)', cursor:'pointer' }}>
              {t('library.openList')}
            </button>
          </div>
        )
      })}

      {delId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:20 }}>
          <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:24, maxWidth:300, width:'100%' }}>
            <p style={{ fontWeight:600, marginBottom:8 }}>{t('library.deleteListConfirm')}</p>
            <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:20 }}>{t('common.irreversible')}</p>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setDelId(null)}>{t('common.cancel')}</button>
              <button className="btn btn-danger" style={{ flex:1 }} onClick={async () => { await handleDelete(delId); setDelId(null) }}>{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── メインページ ──
export default function LibraryPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { t, i18n } = useTranslation()

  const [mainTab,      setMainTab]      = useState('recipes')
  const [sortKey,      setSortKey]      = useState('date')
  const [search,       setSearch]       = useState(location.state?.initialSearch || '')
  const [showAddByLink, setShowAddByLink] = useState(false)

  const dateLocaleMap = { ja: 'ja-JP', en: 'en-US', tr: 'tr-TR' }
  const dateLocale = dateLocaleMap[i18n.resolvedLanguage] ?? 'ja-JP'

  useEffect(() => {
    if (location.state?.initialSearch !== undefined) {
      setSearch(location.state.initialSearch)
      setMainTab('recipes')
    }
  }, [location.state])

  const { sorted, recipes, loading, handleUpdate } = useRecipes({ sortKey, search })
  const groups = useMemo(() => groupRecipes(sorted, sortKey, t, dateLocale), [sorted, sortKey, t, dateLocale])

  const sortOptions = SORT_KEYS.map(key => ({
    key,
    label: t(`library.sort${key.charAt(0).toUpperCase() + key.slice(1)}`),
  }))

  return (
    <div className="page-wrapper">
      <div className="topbar">
        <div className="topbar-row">
          <div>
            <div className="topbar-title">{t('library.title')}</div>
            <div className="topbar-sub">
              {mainTab === 'recipes'
                ? t('library.recipeCount', { count: recipes.length })
                : t('library.shoppingListTab')
              }
            </div>
          </div>
          {mainTab === 'recipes' && (
            <button
              onClick={() => setShowAddByLink(true)}
              style={{ display:'flex', alignItems:'center', gap:5, background:'var(--accent-light)', border:'1px solid var(--accent-100)', borderRadius:'var(--radius-sm)', padding:'6px 12px', fontSize:12, fontWeight:600, color:'var(--accent-dark)', cursor:'pointer', flexShrink:0 }}
            >
              {t('library.addByLink')}
            </button>
          )}
        </div>
        {mainTab === 'recipes' && (
          <div className="topbar-search">
            <i className="ti ti-search" aria-hidden="true" />
            <input
              placeholder={t('library.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:16, padding:0 }}>✕</button>
            )}
          </div>
        )}
      </div>

      {/* メインタブ */}
      <div style={{ display:'flex', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
        {[
          { key:'recipes',  label: t('library.tabRecipes')  },
          { key:'shopping', label: t('library.tabShopping') },
        ].map(tab => (
          <button key={tab.key} onClick={() => setMainTab(tab.key)} style={{
            flex:1, padding:'11px 0', fontSize:13, fontWeight:600,
            background:'none', border:'none', cursor:'pointer',
            color: mainTab===tab.key ? 'var(--accent-dark)' : 'var(--text-3)',
            borderBottom: mainTab===tab.key ? '2px solid var(--accent-dark)' : '2px solid transparent',
            transition:'all var(--t)',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* レシピタブ */}
      {mainTab === 'recipes' && (
        <>
          <div style={{ display:'flex', gap:6, padding:'10px 16px', overflowX:'auto', scrollbarWidth:'none', borderBottom:'1px solid var(--border)', background:'var(--surface)' }}>
            {sortOptions.map(opt => (
              <button key={opt.key} onClick={() => setSortKey(opt.key)} style={{
                flexShrink:0, padding:'6px 14px', borderRadius:999, fontSize:13, border:'1px solid',
                borderColor: sortKey===opt.key ? 'var(--accent-dark)' : 'var(--border)',
                background:  sortKey===opt.key ? 'var(--accent-dark)' : 'var(--surface)',
                color:       sortKey===opt.key ? '#fff' : 'var(--text-2)',
                cursor:'pointer', transition:'all var(--t)',
              }}>{opt.label}</button>
            ))}
          </div>

          {loading ? (
            <div className="spinner">{t('common.loading')}</div>
          ) : sorted.length === 0 ? (
            <div style={{ textAlign:'center', padding:'4rem 2rem' }}>
              <div style={{ width:60, height:60, borderRadius:'50%', background:'var(--accent-light)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                <span style={{ fontSize:28 }}>🍳</span>
              </div>
              <p style={{ fontSize:15, fontWeight:600 }}>
                {search ? t('library.emptySearch', { query: search }) : t('library.emptyRecipes')}
              </p>
              <p style={{ fontSize:13, color:'var(--text-3)', marginTop:6, lineHeight:1.7 }}>
                {t('library.emptyHint')}
              </p>
            </div>
          ) : (
            <div style={{ paddingBottom:8 }}>
              {groups.map(({ header, items }) => (
                <div key={header}>
                  {header && (
                    <div style={{ padding:'10px 16px 5px', fontSize:12, fontWeight:600, color:'var(--text-3)', letterSpacing:'.05em', background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
                      {header}
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'10px 16px 2px' }}>
                    {items.map(r => (
                      <RecipeCard key={r.id} recipe={r} onUpdate={handleUpdate} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {mainTab === 'shopping' && <ShoppingListsTab />}
      {showAddByLink && <AddByLinkModal onClose={() => setShowAddByLink(false)} />}
      <BottomNav />
    </div>
  )
}
