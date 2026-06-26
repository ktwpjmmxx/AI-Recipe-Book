import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSavedShoppingListDetail } from '../hooks/useShoppingList'
import BottomNav from '../components/BottomNav'
import '../global.css'

function fmtNum(val) {
  if (val === null || val === undefined) return ''
  if (val === 0) return '0'
  if (Number.isInteger(val)) return String(val)
  const f = val.toFixed(1)
  return f.endsWith('.0') ? f.slice(0, -2) : f
}

export default function SavedShoppingListPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [showDelConf, setShowDelConf] = useState(false)

  const dateLocaleMap = { ja: 'ja-JP', en: 'en-US', tr: 'tr-TR' }
  const dateLocale = dateLocaleMap[i18n.resolvedLanguage] ?? 'ja-JP'

  const fmtDate = (str) => {
    const d = new Date(str)
    return d.toLocaleString(dateLocale, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const {
    list, items, loading, saving, error,
    needItems, haveItems, textItems,
    doneCount, totalCount, allDone,
    load, toggleCheck, handleDelete,
  } = useSavedShoppingListDetail(id, navigate)

  useEffect(() => { load() }, [load])

  if (loading) return <div className="spinner">{t('common.loading')}</div>
  if (!list)   return null

  return (
    <div className="page-wrapper">

      <div className="topbar">
        <div className="topbar-row">
          <button onClick={() => navigate('/library')} style={{ background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.4)', borderRadius:'var(--radius-sm)', padding:'6px 12px', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            {t('common.back')}
          </button>
          <span className="topbar-title" style={{ flex:1, textAlign:'center' }}>{t('shopping.title')}</span>
          <button onClick={() => setShowDelConf(true)} style={{ background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.4)', borderRadius:'var(--radius-sm)', padding:'6px 10px', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            {t('shopping.deleteIcon')}
          </button>
        </div>
      </div>

      <div style={{ padding:'12px 16px', background:'var(--gold-light)', borderBottom:'1px solid #E8D080' }}>
        <div style={{ fontSize:15, fontWeight:600, color:'var(--gold-dark)', marginBottom:3 }}>{list.recipe_title}</div>
        <div style={{ fontSize:12, color:'var(--text-3)', display:'flex', gap:12 }}>
          <span>👥 {t('common.servingsUnit', { count: list.servings })}</span>
          <span>🕐 {fmtDate(list.created_at)}</span>
        </div>
      </div>

      <div style={{ padding:'10px 16px', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, height:6, background:'#E5E7EB', borderRadius:999, overflow:'hidden' }}>
            <div style={{ height:'100%', background: allDone ? '#3B6D11' : 'var(--blue)', borderRadius:999, width:`${totalCount>0?(doneCount/totalCount)*100:0}%`, transition:'width .3s ease' }} />
          </div>
          <span style={{ fontSize:12, color: allDone ? '#3B6D11' : 'var(--text-3)', fontWeight: allDone ? 600 : 400, flexShrink:0 }}>
            {allDone
              ? t('shopping.progressDone')
              : t('shopping.progressCount', { done: doneCount, total: totalCount })
            }
          </span>
        </div>
      </div>

      <div style={{ padding:'14px 16px' }}>
        {error && (
          <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:13, color:'#b91c1c', marginBottom:14 }}>
            {error}
          </div>
        )}

        {needItems.length > 0 && (
          <>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', marginBottom:8 }}>{t('shopping.needSection')}</div>
            {needItems.map((item, i) => {
              const idx = items.indexOf(item)
              return (
                <div key={i} onClick={() => toggleCheck(idx)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background: item.checked ? 'var(--bg)' : 'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', marginBottom:6, cursor:'pointer', opacity: item.checked ? .55 : 1, transition:'all var(--t)' }}>
                  <div style={{ width:22, height:22, borderRadius:4, flexShrink:0, border: item.checked ? 'none' : '2px solid var(--border)', background: item.checked ? '#3B6D11' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {item.checked && <span style={{ color:'#fff', fontSize:14 }}>✓</span>}
                  </div>
                  <span style={{ flex:1, fontSize:14, textDecoration: item.checked ? 'line-through' : 'none', color: item.checked ? 'var(--text-3)' : 'var(--text-1)' }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize:14, fontWeight:600, color: item.checked ? 'var(--text-3)' : 'var(--blue)' }}>
                    {fmtNum(item.needed)} {item.unit}
                  </span>
                </div>
              )
            })}
          </>
        )}

        {haveItems.length > 0 && (
          <>
            <div style={{ fontSize:12, fontWeight:600, color:'#3B6D11', marginTop:14, marginBottom:8 }}>{t('shopping.haveSection')}</div>
            {haveItems.map((item, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'#EAF3DE', border:'1px solid #C0DD97', borderRadius:'var(--radius-sm)', marginBottom:6, fontSize:14, opacity:.7 }}>
                <span style={{ textDecoration:'line-through', color:'var(--text-3)' }}>{item.name}</span>
                <span style={{ fontSize:12, color:'#3B6D11' }}>{t('shopping.sufficientLabel')}</span>
              </div>
            ))}
          </>
        )}

        {textItems.length > 0 && (
          <>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', marginTop:14, marginBottom:8 }}>{t('shopping.textCheckSection')}</div>
            {textItems.map((item, i) => {
              const idx = items.indexOf(item)
              return (
                <div key={i} onClick={() => toggleCheck(idx)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background: item.checked ? 'var(--bg)' : 'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', marginBottom:6, cursor:'pointer', opacity: item.checked ? .55 : 1 }}>
                  <div style={{ width:22, height:22, borderRadius:4, flexShrink:0, border: item.checked ? 'none' : '2px solid var(--border)', background: item.checked ? '#3B6D11' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {item.checked && <span style={{ color:'#fff', fontSize:14 }}>✓</span>}
                  </div>
                  <span style={{ flex:1, fontSize:14, textDecoration: item.checked ? 'line-through' : 'none', color: item.checked ? 'var(--text-3)' : 'var(--text-1)' }}>{item.name}</span>
                  <span style={{ fontSize:13, color:'var(--text-3)' }}>{item.text_val ?? t('common.appropriate')}</span>
                </div>
              )
            })}
          </>
        )}

        {saving && (
          <div style={{ fontSize:12, color:'var(--text-3)', textAlign:'center', marginTop:8 }}>
            {t('common.saving')}
          </div>
        )}
      </div>

      {showDelConf && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:20 }}>
          <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:24, maxWidth:300, width:'100%' }}>
            <p style={{ fontWeight:600, marginBottom:8 }}>{t('shopping.deleteConfirm')}</p>
            <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:20 }}>{t('common.irreversible')}</p>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setShowDelConf(false)}>{t('common.cancel')}</button>
              <button className="btn btn-danger" style={{ flex:1 }} onClick={handleDelete}>{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
