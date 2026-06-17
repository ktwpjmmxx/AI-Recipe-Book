import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchRecipes } from '../api/recipeApi'
import BottomNav from '../components/BottomNav'
import '../global.css'

// ── 時刻・季節スコアリング ──────────────────────
function scoreRecipe(recipe) {
  const h = new Date().getHours()
  const m = new Date().getMonth() + 1
  let score = 0
  if (h < 11 && recipe.cook_time <= 20) score += 3
  if (h >= 11 && h < 17 && recipe.category === '副菜') score += 2
  if (h >= 17 && recipe.cook_time > 20) score += 3
  if (h >= 17 && recipe.category === '和食') score += 1
  if ([6, 7, 8].includes(m) && ['アジアン', '洋食'].includes(recipe.category)) score += 2
  if ([11, 12, 1, 2].includes(m) && ['和食', '中華'].includes(recipe.category)) score += 2
  if (recipe.is_favorite) score += 1
  return score
}

// ── 時刻別: ヘッダー画像・挨拶・サブテキスト ────
function getTimeConfig() {
  const h = new Date().getHours()
  if (h >= 5 && h < 11) {
    return {
      image: '/images/header/morning.jpg',
      greeting: 'おはようございます',
      sub: '今朝は何食べる？',
      badge: '朝の時間帯 · 時短レシピがおすすめ',
      // 朝は画像が明るいので文字を暗く
      textColor: '#ffffff',
      subColor: 'rgba(255,255,255,.8)',
      badgeBg: 'rgba(255,255,255,.65)',
      badgeColor: '#3a3020',
      badgeBorder: 'rgba(0,0,0,.1)',
      dotColor: '#e09020',
      // オーバーレイは薄め（朝の明るさを活かす）
      overlay: 'linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,.25) 50%, rgba(244,241,236,.97) 100%)',
    }
  }
  if (h >= 11 && h < 17) {
    return {
      image: '/images/header/noon.jpg',
      greeting: 'こんにちは',
      sub: 'ランチは決まった？',
      badge: '昼の時間帯 · 副菜・あっさり系がおすすめ',
      textColor: '#ffffff',
      subColor: 'rgba(255,255,255,.8)',
      badgeBg: 'rgba(255,255,255,.65)',
      badgeColor: '#2a3a2a',
      badgeBorder: 'rgba(0,0,0,.1)',
      dotColor: '#5a9848',
      overlay: 'linear-gradient(180deg, rgba(0,0,0,.22) 0%, rgba(0,0,0,.10) 50%, rgba(244,241,236,.97) 100%)',
    }
  }
  return {
    image: '/images/header/night.jpg',
    greeting: 'こんばんは',
    sub: '今夜は何作る？',
    badge: '夜の時間帯 · しっかりした料理がおすすめ',
    // 夜は画像が暗いので文字を白に
    textColor: '#ffffff',
    subColor: 'rgba(255,255,255,.75)',
    badgeBg: 'rgba(255,255,255,.12)',
    badgeColor: 'rgba(255,255,255,.8)',
    badgeBorder: 'rgba(255,255,255,.2)',
    dotColor: '#8090d8',
    overlay: 'linear-gradient(180deg, rgba(0,0,0,.38) 0%, rgba(0,0,0,.20) 50%, rgba(244,241,236,.97) 100%)',
  }
}

function aiSuggestReason(recipe) {
  const h = new Date().getHours()
  const m = new Date().getMonth() + 1
  if (h < 11) return '朝は時短レシピがおすすめです'
  if (h >= 17 && recipe.cook_time > 20) return '夜ごはんにじっくり作りたい一品です'
  if ([6, 7, 8].includes(m)) return '夏にぴったりさっぱりした料理です'
  if ([11, 12, 1, 2].includes(m)) return '寒い季節に体が温まる一品です'
  return 'あなたのライブラリから選びました'
}

export default function HomePage() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState([])
  const [aiSuggest, setAiSuggest] = useState(null)

  const tc = getTimeConfig()

  useEffect(() => {
    fetchRecipes({ sort: 'updated_at', order: 'desc' })
      .then(list => {
        setRecipes(list)
        if (list.length > 0) {
          const scored = [...list].sort((a, b) => scoreRecipe(b) - scoreRecipe(a))
          setAiSuggest(scored[0])
        }
      })
      .catch(() => { })
  }, [])

  const recent = recipes.slice(0, 3)

  return (
    <div className="page-wrapper">

      {/* ── ヘッダー（時刻別背景画像） ── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>

        {/* 背景画像 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${tc.image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          zIndex: 0,
        }} />

        {/* グラデーションオーバーレイ */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: tc.overlay,
          zIndex: 1,
        }} />

        {/* ヘッダーコンテンツ */}
        <div style={{ position: 'relative', zIndex: 2, padding: '52px 22px 22px' }}>

          {/* ロゴ行 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: tc.textColor, letterSpacing: '.04em' }}>
                myrecipe
              </span>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7a9a78' }} />
            </div>
            <div style={{
              width: 33, height: 33, borderRadius: '50%',
              background: 'rgba(255,255,255,.18)',
              border: `1px solid ${tc.badgeBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, color: tc.textColor,
            }}>田</div>
          </div>

          {/* 挨拶 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontFamily: '"Noto Serif JP", Georgia, serif',
              fontSize: 26, fontWeight: 400,
              color: tc.textColor, lineHeight: 1.25, marginBottom: 4,
            }}>
              {tc.greeting}、<br />
              <em style={{ fontStyle: 'italic', color: tc.subColor }}>{tc.sub}</em>
            </div>
            <div style={{ fontSize: 11, color: tc.subColor, fontWeight: 300 }}>
              {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
            </div>
          </div>

          {/* 時刻バッジ */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: tc.badgeBg,
            border: `1px solid ${tc.badgeBorder}`,
            borderRadius: 999, padding: '4px 12px 4px 8px',
            fontSize: 11, color: tc.badgeColor,
            backdropFilter: 'blur(8px)',
            marginBottom: 14,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: tc.dotColor, flexShrink: 0 }} />
            {tc.badge}
          </div>

          {/* 検索バー */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            background: 'rgba(255,255,255,.72)',
            border: '1px solid rgba(200,190,175,.5)',
            borderRadius: 12, padding: '10px 15px',
            backdropFilter: 'blur(12px)',
          }}>
            <span style={{ fontSize: 14, color: '#b0a090' }}>🔍</span>
            <span style={{ fontSize: 13, color: '#b0a090', fontWeight: 300 }}>レシピを検索…</span>
          </div>
        </div>

        {/* ヘッダー下部セパレーター */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(180,165,145,.5) 20%, rgba(180,165,145,.5) 80%, transparent)',
          zIndex: 3,
        }} />
      </div>

      {/* ── AI発見バナー ── */}
      <div style={{ padding: '14px 16px 0' }}>
        <div
          onClick={() => navigate('/discover')}
          style={{
            background: 'linear-gradient(135deg, #6D28D9 0%, #185FA5 100%)',
            borderRadius: 14, padding: '13px 16px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
            transition: 'opacity .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <span style={{ fontSize: 26 }}>✦</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 3 }}>
              AIに今日の料理を相談する
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.72)' }}>
              気分や時間を伝えるとレシピを提案・生成します
            </div>
          </div>
          <div style={{ fontSize: 18, color: 'rgba(255,255,255,.6)' }}>›</div>
        </div>
      </div>

      {/* ── AIおすすめ ── */}
      {aiSuggest && (
        <>
          <div className="section-label">✦ 今夜のAIおすすめ</div>
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
                width: 70, height: 70, borderRadius: 12,
                overflow: 'hidden', flexShrink: 0,
                background: '#ede8e0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {aiSuggest.image_url
                  ? <img src={aiSuggest.image_url} alt={aiSuggest.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 28, opacity: .4 }}>🍳</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#7a9a78', fontWeight: 600, marginBottom: 4 }}>
                  あなたの好みから推測
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1c1c1a' }}>{aiSuggest.title}</div>
                <div style={{ fontSize: 12, color: '#9a9a90', marginTop: 3 }}>
                  ⏱ {aiSuggest.cook_time}分　👥 {aiSuggest.base_servings}人前
                </div>
                <div style={{ fontSize: 11, color: '#9a9a90', marginTop: 4, fontStyle: 'italic' }}>
                  {aiSuggestReason(aiSuggest)}
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
            レシピを追加してみましょう
          </p>
          <p style={{ fontSize: 13, color: '#9a9a90', lineHeight: 1.7, marginBottom: 16 }}>
            上のAI相談からレシピを発見するか<br />右下の＋ボタンで手動追加できます
          </p>
        </div>
      )}

      {/* ── 最近追加したレシピ ── */}
      {recent.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 10 }}>
            🕐 最近追加したレシピ
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
