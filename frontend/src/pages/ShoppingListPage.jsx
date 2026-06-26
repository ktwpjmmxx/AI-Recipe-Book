import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useShoppingListBuilder } from '../hooks/useShoppingList'
import BottomNav from '../components/BottomNav'
import '../global.css'

function fmtNum(val) {
  if (val === null || val === undefined) return ''
  if (val === 0) return '0'
  if (Number.isInteger(val)) return String(val)
  const f = val.toFixed(1)
  return f.endsWith('.0') ? f.slice(0, -2) : f
}

export default function ShoppingListPage() {
  const navigate  = useNavigate()
  const { state } = useLocation()
  const { t }     = useTranslation()
  const recipe    = state?.recipe
  const servings  = state?.servings

  const {
    pantry, setPantry,
    checked, toggleCheck,
    mode, setMode,
    saving, savedId, showToast, error,
    numericItems, textItems, listItems, allDone,
    parseHave, handleSave,
  } = useShoppingListBuilder(recipe, servings)

  if (!recipe || !servings) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:12, padding:24 }}>
        <p style={{ fontSize:15, color:'var(--text-2)' }}>{t('shopping.noRecipeError')}</p>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>{t('shopping.back')}</button>
      </div>
    )
  }

  return (
    <div className="page-wrapper">

      {showToast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', background:'#3B6D11', color:'#fff', padding:'10px 20px', borderRadius:999, fontSize:13, fontWeight:600, zIndex:999, boxShadow:'0 4px 16px rgba(0,0,0,.2)' }}>
          {t('shopping.savedToast')}
        </div>
      )}

      <div className="topbar">
        <div className="topbar-row">
          <button onClick={() => navigate(-1)} style={{ background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.4)', borderRadius:'var(--radius-sm)', padding:'6px 12px', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            {t('common.back')}
          </button>
          <span className="topbar-title" style={{ flex:1, textAlign:'center' }}>{t('shopping.title')}</span>
          <button onClick={() => setMode(m => m==='input' ? 'list' : 'input')} style={{ background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.4)', borderRadius:'var(--radius-sm)', padding:'6px 10px', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            {mode==='input' ? t('shopping.toList') : t('shopping.toInput')}
          </button>
        </div>
      </div>

      <div style={{ padding:'12px 16px', background:'var(--gold-light)', borderBottom:'1px solid #E8D080', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--gold-dark)' }}>{recipe.title}</div>
          <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
            {t('shopping.convertNote', { base: recipe.base_servings, servings })}
          </div>
        </div>
        <span style={{ background:'var(--blue)', color:'#fff', padding:'4px 12px', borderRadius:999, fontSize:12, fontWeight:600 }}>
          👥 {t('common.servingsUnit', { count: servings })}
        </span>
      </div>

      {/* 残量入力モード */}
      {mode === 'input' && (
        <div style={{ padding:'16px' }}>
          <div style={{ background:'var(--blue-light)', border:'1px solid var(--blue-100)', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:13, color:'var(--blue)', marginBottom:16, lineHeight:1.6 }}>
            {t('shopping.inputHint')}<br />
            <strong>{t('shopping.inputHintOk')}</strong>{t('shopping.inputHintSub')}
          </div>

          {numericItems.length > 0 && (
            <>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', marginBottom:8 }}>{t('shopping.numericSection')}</div>
              {numericItems.map((ing, i) => {
                const required = (ing.amount ?? 0) * (servings / recipe.base_servings)
                const have     = parseHave(ing.name)
                const needed   = have === null ? required : Math.max(0, required - have)
                return (
                  <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'12px', marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <span style={{ fontSize:14, fontWeight:500 }}>{ing.name}</span>
                      <span style={{ fontSize:12, color:'var(--text-3)' }}>
                        {t('shopping.required', { amount: fmtNum(required), unit: ing.unit })}
                      </span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:12, color:'var(--text-3)', width:80, flexShrink:0 }}>{t('shopping.onHand')}</span>
                      <input
                        type="number" min="0" step="0.1"
                        placeholder={t('shopping.inputPlaceholder')}
                        value={pantry[ing.name] ?? ''}
                        onChange={e => setPantry(p => ({ ...p, [ing.name]: e.target.value }))}
                        style={{ width:80, padding:'6px 8px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', fontSize:14, textAlign:'right', outline:'none' }}
                        onFocus={e => e.target.style.borderColor='var(--blue)'}
                        onBlur={e  => e.target.style.borderColor='var(--border)'}
                      />
                      <span style={{ fontSize:13, color:'var(--text-2)' }}>{ing.unit}</span>
                      {have !== null && (
                        <span style={{ marginLeft:'auto', fontSize:13, fontWeight:600, color: needed===0 ? '#3B6D11' : 'var(--blue)' }}>
                          {needed===0
                            ? t('shopping.sufficient')
                            : t('shopping.needToBuy', { amount: fmtNum(needed), unit: ing.unit })
                          }
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {textItems.length > 0 && (
            <>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', marginTop:16, marginBottom:8 }}>{t('shopping.textSection')}</div>
              {textItems.map((ing, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', marginBottom:6, fontSize:14 }}>
                  <span>{ing.name}</span>
                  <span style={{ color:'var(--text-3)', fontSize:13 }}>
                    {ing.amount_text ?? t('common.appropriate')}{t('shopping.approximateHint')}
                  </span>
                </div>
              ))}
            </>
          )}

          <button onClick={() => setMode('list')} className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'13px 0', fontSize:15, marginTop:20 }}>
            🛒 {t('shopping.title')}
          </button>
        </div>
      )}

      {/* 買い物リストモード */}
      {mode === 'list' && (
        <div style={{ padding:'16px' }}>
          {allDone && (
            <div style={{ background:'#EAF3DE', border:'1px solid #C0DD97', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:13, color:'#3B6D11', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
              {t('shopping.allDone')}
            </div>
          )}
          {error && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:13, color:'#b91c1c', marginBottom:14 }}>
              {error}
            </div>
          )}

          {listItems.filter(i => i.needed > 0).length > 0 && (
            <>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-3)', marginBottom:8 }}>{t('shopping.needSection')}</div>
              {listItems.filter(i => i.needed > 0).map((item, i) => (
                <div key={i} onClick={() => toggleCheck(item.name)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background: checked.has(item.name) ? 'var(--bg)' : 'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', marginBottom:6, cursor:'pointer', opacity: checked.has(item.name) ? .55 : 1, transition:'all var(--t)' }}>
                  <div style={{ width:22, height:22, borderRadius:4, flexShrink:0, border: checked.has(item.name) ? 'none' : '2px solid var(--border)', background: checked.has(item.name) ? '#3B6D11' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {checked.has(item.name) && <span style={{ color:'#fff', fontSize:14 }}>✓</span>}
                  </div>
                  <span style={{ flex:1, fontSize:14, textDecoration: checked.has(item.name) ? 'line-through' : 'none' }}>{item.name}</span>
                  <span style={{ fontSize:14, fontWeight:600, color: checked.has(item.name) ? 'var(--text-3)' : 'var(--blue)' }}>
                    {fmtNum(item.needed)} {item.unit}
                    {item.have !== null && item.have > 0 && (
                      <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:4 }}>（{fmtNum(item.required)}-{fmtNum(item.have)}）</span>
                    )}
                  </span>
                </div>
              ))}
            </>
          )}

          {listItems.filter(i => i.needed === 0 && i.have !== null).length > 0 && (
            <>
              <div style={{ fontSize:12, fontWeight:600, color:'#3B6D11', marginTop:14, marginBottom:8 }}>{t('shopping.haveSection')}</div>
              {listItems.filter(i => i.needed === 0 && i.have !== null).map((item, i) => (
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
              {textItems.map((ing, i) => (
                <div key={i} onClick={() => toggleCheck(ing.name)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background: checked.has(ing.name) ? 'var(--bg)' : 'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', marginBottom:6, cursor:'pointer', opacity: checked.has(ing.name) ? .55 : 1 }}>
                  <div style={{ width:22, height:22, borderRadius:4, flexShrink:0, border: checked.has(ing.name) ? 'none' : '2px solid var(--border)', background: checked.has(ing.name) ? '#3B6D11' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {checked.has(ing.name) && <span style={{ color:'#fff', fontSize:14 }}>✓</span>}
                  </div>
                  <span style={{ flex:1, fontSize:14, textDecoration: checked.has(ing.name) ? 'line-through' : 'none', color: checked.has(ing.name) ? 'var(--text-3)' : 'var(--text-1)' }}>{ing.name}</span>
                  <span style={{ fontSize:13, color:'var(--text-3)' }}>{ing.amount_text ?? t('common.appropriate')}</span>
                </div>
              ))}
            </>
          )}

          <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:8 }}>
            {!savedId ? (
              <button onClick={handleSave} disabled={saving} style={{ width:'100%', padding:'13px 0', background:'#3B6D11', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', fontSize:14, fontWeight:600, cursor: saving ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                {saving ? t('common.saving') : t('shopping.save')}
              </button>
            ) : (
              <div style={{ background:'#EAF3DE', border:'1px solid #C0DD97', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:13, color:'#3B6D11', textAlign:'center' }}>
                {t('shopping.saveNote')}
              </div>
            )}
            <button onClick={() => navigate(-1)} className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', padding:'11px 0' }}>
              {t('shopping.backToRecipe')}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
