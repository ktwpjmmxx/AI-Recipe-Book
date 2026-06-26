import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchRecipes } from '../api/recipeApi'
import BottomNav from '../components/BottomNav'
import '../global.css'

// ── サポート言語定義 ─────────────────────────────────
// 言語を追加するときはここと /src/i18n/locales/ にJSONを追加するだけ
const SUPPORTED_LANGS = [
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
]

// ── 時刻・季節スコアリング ──────────────────────────
function scoreRecipe(recipe) {
  const h = new Date().getHours()
  const m = new Date().getMonth() + 1
  let score = 0
  if (h < 11 && recipe.cook_time <= 20)               score += 3
  if (h >= 11 && h < 17 && recipe.category === '副菜') score += 2
  if (h >= 17 && recipe.cook_time > 20)               score += 3
  if (h >= 17 && recipe.category === '和食')           score += 1
  if ([6,7,8].includes(m) && ['アジアン','洋食'].includes(recipe.category)) score += 2
  if ([11,12,1,2].includes(m) && ['和食','中華'].includes(recipe.category)) score += 2
  if (recipe.is_favorite) score += 1
  return score
}

// ── 時刻別: ヘッダー画像・挨拶キー・サブテキスト ────
function getTimeConfig(t) {
  const h = new Date().getHours()

  if (h >= 5 && h < 11) {
    return {
      image:    '/images/header/morning.jpg',
      greeting: t('time.morning.greeting'),
      sub:      t('time.morning.sub'),
      badge:    t('time.morning.badge'),
      textColor:    '#1c1c1a',
      subColor:     'rgba(28,28,26,.7)',
      textShadow:   '0 1px 3px rgba(255,255,255,.55), 0 1px 8px rgba(255,255,255,.35)',
      badgeBg:      'rgba(255,255,255,.7)',
      badgeColor:   '#3a3020',
      badgeBorder:  'rgba(0,0,0,.12)',
      dotColor:     '#e09020',
      overlay: 'linear-gradient(180deg, rgba(0,0,0,.22) 0%, rgba(0,0,0,.10) 50%, rgba(244,241,236,.97) 100%)',
    }
  }

  if (h >= 11 && h < 17) {
    return {
      image:    '/images/header/noon.jpg',
      greeting: t('time.noon.greeting'),
      sub:      t('time.noon.sub'),
      badge:    t('time.noon.badge'),
      textColor:    '#ffffff',
      subColor:     'rgba(255,255,255,.85)',
      textShadow:   '0 1px 4px rgba(0,0,0,.45), 0 1px 12px rgba(0,0,0,.25)',
      badgeBg:      'rgba(0,0,0,.32)',
      badgeColor:   'rgba(255,255,255,.9)',
      badgeBorder:  'rgba(255,255,255,.25)',
      dotColor:     '#9be08a',
      overlay: 'linear-gradient(180deg, rgba(0,0,0,.42) 0%, rgba(0,0,0,.22) 50%, rgba(244,241,236,.97) 100%)',
    }
  }

  return {
    image:    '/images/header/night.jpg',
    greeting: t('time.night.greeting'),
    sub:      t('time.night.sub'),
    badge:    t('time.night.badge'),
    textColor:    '#ffffff',
    subColor:     'rgba(255,255,255,.75)',
    textShadow:   '0 1px 4px rgba(0,0,0,.55), 0 1px 12px rgba(0,0,0,.35)',
    badgeBg:      'rgba(255,255,255,.12)',
    badgeColor:   'rgba(255,255,255,.85)',
    badgeBorder:  'rgba(255,255,255,.2)',
    dotColor:     '#8090d8',
    overlay: 'linear-gradient(180deg, rgba(0,0,0,.40) 0%, rgba(0,0,0,.22) 50%, rgba(244,241,236,.97) 100%)',
  }
}

function aiSuggestReason(recipe, t) {
  const h = new Date().getHours()
  const m = new Date().getMonth() + 1
  if (h < 11)                              return t('aiSuggestReason.morning')
  if (h >= 17 && recipe.cook_time > 20)   return t('aiSuggestReason.nightSlow')
  if ([6,7,8].includes(m))                return t('aiSuggestReason.summer')
  if ([11,12,1,2].includes(m))            return t('aiSuggestReason.winter')
  return t('aiSuggestReason.default')
}

// ── 言語切替メニュー ────────────────────────────────
function LangMenu({ tc }) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = SUPPORTED_LANGS.find(l => l.code === i18n.resolvedLanguage) ?? SUPPORTED_LANGS[0]

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* 🌐 トリガーボタン */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="言語を切り替える / Switch language"
        style={{
          width: 33, height: 33, borderRadius: '50%',
          background: open ? 'rgba(255,255,255,.32)' : 'rgba(255,255,255,.18)',
          border: `1px solid ${tc.badgeBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 16,
          transition: 'background .15s',
          // ボタンのデフォルトスタイルをリセット
          padding: 0, outline: 'none',
        }}
      >
        🌐
      </button>

      {/* ドロップダウンメニュー */}
      {open && (
        <div style={{
          position: 'absolute', top: 38, right: 0,
          background: 'rgba(255,255,255,.96)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(200,190,175,.5)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,.18)',
          overflow: 'hidden',
          minWidth: 140,
          zIndex: 100,
        }}>
          {SUPPORTED_LANGS.map((lang, idx) => {
            const isSelected = lang.code === i18n.resolvedLanguage
            return (
              <button
                key={lang.code}
                onClick={() => {
                  i18n.changeLanguage(lang.code)
                  setOpen(false)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px',
                  background: isSelected ? 'rgba(74,124,53,.08)' : 'transparent',
                  border: 'none',
                  borderBottom: idx < SUPPORTED_LANGS.length - 1
                    ? '1px solid rgba(200,190,175,.3)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(0,0,0,.04)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 18 }}>{lang.flag}</span>
                <span style={{
                  fontSize: 13, color: isSelected ? '#4a7c35' : '#3a3020',
                  fontWeight: isSelected ? 600 : 400,
                }}>
                  {lang.label}
                </span>
                {isSelected && (
                  <span style={{ marginLeft: 'auto', color: '#4a7c35', fontSize: 12 }}>✓</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────
export default function HomePage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [recipes,   setRecipes]   = useState([])
  const [aiSuggest, setAiSuggest] = useState(null)
  const [headerSearch, setHeaderSearch] = useState('')

  const tc = getTimeConfig(t)

  // 言語が変わったときに日付ロケールを再レンダリングさせるためのキー
  const dateLocaleMap = { ja: 'ja-JP', en: 'en-US', tr: 'tr-TR' }
  const dateLocale = dateLocaleMap[i18n.resolvedLanguage] ?? 'ja-JP'

  useEffect(() => {
    fetchRecipes({ sort: 'updated_at', order: 'desc' })
      .then(list => {
        setRecipes(list)
        if (list.length > 0) {
          const scored = [...list].sort((a, b) => scoreRecipe(b) - scoreRecipe(a))
          setAiSuggest(scored[0])
        }
      })
      .catch(() => {})
  }, [])

  const recent = recipes.slice(0, 3)

  return (
    <div className="page-wrapper">

      {/* ── ヘッダー（時刻別背景画像） ── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>

        {/* 背景画像 */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${tc.image})`,
          backgroundSize: 'cover', backgroundPosition: 'center top',
          zIndex: 0,
        }} />

        {/* グラデーションオーバーレイ */}
        <div style={{ position: 'absolute', inset: 0, background: tc.overlay, zIndex: 1 }} />

        {/* ヘッダーコンテンツ */}
        <div style={{ position: 'relative', zIndex: 2, padding: '52px 22px 22px' }}>

          {/* ロゴ行 ＋ 🌐言語切替 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 14, fontWeight: 500, color: tc.textColor, letterSpacing: '.04em',
                textShadow: tc.textShadow,
              }}>
                myrecipe
              </span>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7a9a78' }} />
            </div>

            {/* 田 → 🌐 に変更 */}
            <LangMenu tc={tc} />
          </div>

          {/* 挨拶 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontFamily: '"Noto Serif JP", Georgia, serif',
              fontSize: 26, fontWeight: 400,
              color: tc.textColor, lineHeight: 1.25, marginBottom: 4,
              textShadow: tc.textShadow,
            }}>
              {tc.greeting}
              {/* 日本語だけ読点＋改行を入れる */}
              {i18n.resolvedLanguage === 'ja' ? '、' : ','}<br />
              <em style={{ fontStyle: 'italic', color: tc.subColor }}>{tc.sub}</em>
            </div>
            <div style={{ fontSize: 11, color: tc.subColor, fontWeight: 300, textShadow: tc.textShadow }}>
              {new Date().toLocaleDateString(dateLocale, { month: 'long', day: 'numeric', weekday: 'short' })}
            </div>
          </div>

          {/* 時刻バッジ */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: tc.badgeBg, border: `1px solid ${tc.badgeBorder}`,
            borderRadius: 999, padding: '4px 12px 4px 8px',
            fontSize: 11, color: tc.badgeColor,
            backdropFilter: 'blur(8px)', marginBottom: 14,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: tc.dotColor, flexShrink: 0 }} />
            {tc.badge}
          </div>

          {/* 検索バー */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            background: 'rgba(255,255,255,.85)', border: '1px solid rgba(200,190,175,.5)',
            borderRadius: 12, padding: '10px 15px', backdropFilter: 'blur(12px)',
          }}>
            <span style={{ fontSize: 14, color: '#b0a090' }}>🔍</span>
            <input
              className="home-search-input"
              value={headerSearch}
              onChange={e => setHeaderSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  navigate('/library', { state: { initialSearch: headerSearch.trim() } })
                }
              }}
              placeholder={t('home.searchPlaceholder')}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 13, color: '#5a5044', fontWeight: 400,
              }}
            />
          </div>
        </div>

        {/* ヘッダー下部セパレーター */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(180,165,145,.5) 20%, rgba(180,165,145,.5) 80%, transparent)',
          zIndex: 3,
        }} />
      </div>

      {/* ── AI発見バナー ── */}
      <div style={{ padding: '14px 16px 0' }}>
        <div
          onClick={() => navigate('/discover')}
          style={{
            background: '#4a7c35', borderRadius: 14, padding: '13px 16px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
            transition: 'opacity .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <span style={{ fontSize: 26 }}>✦</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 3 }}>
              {t('home.aiBannerTitle')}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.72)' }}>
              {t('home.aiBannerSub')}
            </div>
          </div>
          <div style={{ fontSize: 18, color: 'rgba(255,255,255,.6)' }}>›</div>
        </div>
      </div>

      {/* ── AIおすすめ ── */}
      {aiSuggest && (
        <>
          <div className="section-label">{t('home.aiRecommendSection')}</div>
          <div style={{ padding: '0 16px' }}>
            <div
              onClick={() => navigate(`/recipes/${aiSuggest.id}`)}
              style={{
                background: '#f9f6f0', border: '1px solid #e8e0d4',
                borderRadius: 16, display: 'flex', gap: 12, padding: 14,
                cursor: 'pointer', transition: 'box-shadow .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
            >
              <div style={{
                width: 70, height: 70, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
                background: '#ede8e0', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {aiSuggest.image_url
                  ? <img src={aiSuggest.image_url} alt={aiSuggest.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 28, opacity: .4 }}>🍳</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#7a9a78', fontWeight: 600, marginBottom: 4 }}>
                  {t('home.aiRecommendLabel')}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1c1c1a' }}>{aiSuggest.title}</div>
                <div style={{ fontSize: 12, color: '#9a9a90', marginTop: 3 }}>
                  ⏱ {t('home.cookTime', { minutes: aiSuggest.cook_time })}
                  　👥 {t('home.servings', { count: aiSuggest.base_servings })}
                </div>
                <div style={{ fontSize: 11, color: '#9a9a90', marginTop: 4, fontStyle: 'italic' }}>
                  {aiSuggestReason(aiSuggest, t)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ライブラリ空の場合 */}
      {recipes.length === 0 && (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: '#eef4ee',
            margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 28 }}>🍳</span>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: '#1c1c1a' }}>
            {t('home.emptyTitle')}
          </p>
          <p style={{ fontSize: 13, color: '#9a9a90', lineHeight: 1.7, marginBottom: 16 }}>
            {/* \n を <br /> に変換して表示 */}
            {t('home.emptySub').split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </p>
        </div>
      )}

      {/* ── 最近追加したレシピ ── */}
      {recent.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 10 }}>
            {t('home.recentSection')}
          </div>
          <div style={{
            display: 'flex', gap: 10, padding: '0 16px',
            overflowX: 'auto', scrollbarWidth: 'none',
          }}>
            {recent.map(r => (
              <div
                key={r.id}
                onClick={() => navigate(`/recipes/${r.id}`)}
                style={{
                  flexShrink: 0, width: 130,
                  background: '#fff', border: '1px solid #e8e2d8',
                  borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                  transition: 'box-shadow .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
              >
                <div style={{
                  height: 80, background: '#f4f1ec',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  {r.image_url
                    ? <img src={r.image_url} alt={r.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 30, opacity: .4 }}>🍳</span>
                  }
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: '#1c1c1a',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    marginBottom: 4,
                  }}>{r.title}</div>
                  <span className={`cat-badge cat-${r.category}`} style={{ fontSize: 10 }}>
                    {r.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ height: 16 }} />
      <BottomNav />
    </div>
  )
}
