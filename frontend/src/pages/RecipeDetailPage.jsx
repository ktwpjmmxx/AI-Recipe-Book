import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useRecipeDetail, useAIPanel, displayAmount } from '../hooks/useRecipeDetail'
import AIPanel from '../components/AIPanel'
import ShareModal from '../components/ShareModal'
import BottomNav from '../components/BottomNav'
import '../global.css'

export default function RecipeDetailPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { t }    = useTranslation()
  const [showAI,      setShowAI]      = useState(false)
  const [showDelConf, setShowDelConf] = useState(false)
  const [showShare,   setShowShare]   = useState(false)

  const {
    recipe, loading,
    servings, servingIdx, SERVING_OPTIONS,
    ratio, servingChanged, canScale,
    activeTab, setActiveTab,
    checkedSteps, doneCount, totalSteps,
    changeServing, handleFav, handleImageUpload, handleDelete, toggleStep,
    setRecipe,
  } = useRecipeDetail(id, navigate)

  const aiPanel = useAIPanel(recipe)

  if (loading) return <div className="spinner">{t('common.loading')}</div>
  if (!recipe)  return null

  return (
    <div className="page-wrapper">

      {/* ゴールドヘッダー */}
      <div style={{ background: 'var(--gold)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {t('common.back')}
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', flex: 1, textAlign: 'center', padding: '0 8px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {recipe.title}
        </span>
        <button onClick={handleFav} style={{ background: recipe.is_favorite ? '#fff' : 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: recipe.is_favorite ? '#E24B4A' : '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all var(--t)' }}>
          {recipe.is_favorite ? t('recipeDetail.favorited') : t('recipeDetail.favorite')}
        </button>
      </div>

      {/* ヒーロー画像 */}
      <div style={{ position: 'relative', height: 220 }}>
        {recipe.image_url
          ? <img src={recipe.image_url} alt={recipe.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', background: 'var(--gold-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 72, opacity: .4 }}>🍳</span>
            </div>
        }
        {recipe.is_ai_generated && (
          <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(109,40,217,.85)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999 }}>
            {t('recipeDetail.aiGenerated')}
          </div>
        )}
        {recipe.is_public && (
          <div style={{ position: 'absolute', top: 10, left: recipe.is_ai_generated ? 92 : 10, background: 'rgba(122,154,120,.9)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4 }}>
            {t('recipeDetail.publicBadge')}
          </div>
        )}
        <label style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,.5)', color: '#fff', padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          {t('recipeDetail.changePhoto')}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageUpload(e.target.files?.[0])} />
        </label>
      </div>

      {/* ボディ */}
      <div style={{ padding: '16px 20px' }}>
        <span className={`cat-badge cat-${recipe.category}`}>{recipe.category}</span>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 10px', lineHeight: 1.25 }}>{recipe.title}</h1>
        {recipe.description && <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 14 }}>{recipe.description}</p>}

        {/* 人数ステッパー */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--gold-light)', border: '1px solid #E8D080', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1 }}>{t('recipeDetail.servingsLabel')}</span>
          <button onClick={() => changeServing(-1)} disabled={servingIdx === 0} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', cursor: servingIdx === 0 ? 'not-allowed' : 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: servingIdx === 0 ? 'var(--text-3)' : 'var(--text-1)' }}>−</button>
          <div style={{ minWidth: 80, textAlign: 'center', fontSize: 15, fontWeight: 600, color: 'var(--gold-dark)' }}>
            {t('common.servingsUnit', { count: servings })}
          </div>
          <button onClick={() => changeServing(1)} disabled={servingIdx === SERVING_OPTIONS.length - 1} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', cursor: servingIdx === SERVING_OPTIONS.length - 1 ? 'not-allowed' : 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: servingIdx === SERVING_OPTIONS.length - 1 ? 'var(--text-3)' : 'var(--text-1)' }}>＋</button>
        </div>
        {servingChanged && canScale && (
          <div style={{ fontSize: 12, color: 'var(--blue)', background: 'var(--blue-light)', border: '1px solid var(--blue-100)', borderRadius: 'var(--radius-sm)', padding: '5px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            {t('recipeDetail.scaledNote', { from: recipe.base_servings, to: servings })}
          </div>
        )}

        {/* 時間メタ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: t('recipeDetail.prepTime'), value: t('common.minutesUnit', { minutes: recipe.prep_time }) },
            { label: t('recipeDetail.cookTime'), value: t('common.minutesUnit', { minutes: recipe.cook_time }) },
          ].map(item => (
            <div key={item.label} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 10, textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{item.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
          {[
            { key: 'ingredients', label: t('recipeDetail.tabIngredients', { count: recipe.ingredients?.length ?? 0 }) },
            { key: 'steps',       label: t('recipeDetail.tabSteps',       { count: totalSteps }) },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: activeTab === tab.key ? 'var(--blue)' : 'var(--text-3)', borderBottom: activeTab === tab.key ? '2px solid var(--blue)' : '2px solid transparent', marginBottom: -1, transition: 'all var(--t)' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 材料タブ */}
        {activeTab === 'ingredients' && (
          <div>
            {(recipe.ingredients ?? []).map((ing, i) => {
              const scaled  = displayAmount(ing, ratio)
              const isFixed = !!ing?.amount_text
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: i < (recipe.ingredients?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none', fontSize: 14 }}>
                  <span>{ing?.name ?? ''}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isFixed && servingChanged && (
                      <span style={{ fontSize: 10, background: 'var(--gold-light)', color: 'var(--gold-dark)', padding: '1px 5px', borderRadius: 4, border: '1px solid #E8D080' }}>
                        {t('recipeDetail.fixed')}
                      </span>
                    )}
                    <span style={{ fontWeight: 600, color: isFixed ? 'var(--text-2)' : 'var(--blue)', minWidth: 80, textAlign: 'right' }}>{scaled}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 手順タブ */}
        {activeTab === 'steps' && (
          <div>
            {doneCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: '#3B6D11' }}>
                <div style={{ flex: 1, height: 4, background: '#EAF3DE', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#639922', borderRadius: 999, width: `${(doneCount / totalSteps) * 100}%`, transition: 'width .3s ease' }} />
                </div>
                <span>{t('common.progress', { done: doneCount, total: totalSteps })}</span>
              </div>
            )}
            {(recipe.steps ?? []).map(step => {
              const done = checkedSteps.has(step?.order)
              return (
                <div key={step?.order} onClick={() => toggleStep(step?.order)} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', opacity: done ? .55 : 1, transition: 'opacity var(--t)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: done ? 'var(--text-3)' : 'var(--blue)', color: '#fff', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    {done ? '✓' : step?.order}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, lineHeight: 1.7, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text-3)' : 'var(--text-1)' }}>{step?.description ?? ''}</p>
                    {done && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#3B6D11', background: '#EAF3DE', borderRadius: 4, padding: '2px 8px', marginTop: 4 }}>
                        {t('recipeDetail.stepDone')}
                      </div>
                    )}
                    {step?.tip && <div className="tip-box">💡 {step.tip}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* アクションボタン */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate(`/recipes/${id}/edit`)}>{t('recipeDetail.btnEdit')}</button>
          <button className="btn btn-ghost" onClick={() => setShowAI(v => !v)}>{t('recipeDetail.btnAI')}</button>
          <button
            onClick={() => setShowShare(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 'var(--radius-sm)', background: recipe.is_public ? 'var(--accent-light)' : 'var(--bg)', color: recipe.is_public ? 'var(--accent-dark)' : 'var(--text-2)', border: `1px solid ${recipe.is_public ? 'var(--accent-100)' : 'var(--border)'}`, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            {recipe.is_public ? t('recipeDetail.btnPublic') : t('recipeDetail.btnShare')}
          </button>
          <button onClick={() => navigate('/shopping', { state: { recipe, servings } })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 'var(--radius-sm)', background: '#EAF3DE', color: '#3B6D11', border: '1px solid #C0DD97', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {t('recipeDetail.btnShopping')}
          </button>
          <button className="btn btn-danger" onClick={() => setShowDelConf(true)}>{t('recipeDetail.btnDelete')}</button>
        </div>

        {/* 削除確認 */}
        {showDelConf && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 320, width: '100%' }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>{t('recipeDetail.deleteConfirm', { title: recipe.title })}</p>
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>{t('common.irreversible')}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowDelConf(false)}>{t('common.cancel')}</button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDelete}>{t('common.delete')}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showAI && <AIPanel {...aiPanel} onClose={() => setShowAI(false)} />}
      {showShare && (
        <ShareModal
          recipe={recipe}
          onClose={() => setShowShare(false)}
          onUpdated={updated => setRecipe(prev => ({ ...prev, ...updated }))}
        />
      )}
      <BottomNav />
    </div>
  )
}
