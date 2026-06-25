/**
 * pages/DiscoverPage.jsx — AIレシピ発見ページ
 *
 * このページは UI の描画のみ担当する。
 * すべての状態管理・API通信は useDiscover() に委譲する。
 */
import { useNavigate } from 'react-router-dom'
import { useDiscover, STEP, MOODS, TIMES, CATEGORIES } from '../hooks/useDiscover'
import SuggestionCard from '../components/SuggestionCard'
import BottomNav from '../components/BottomNav'
import '../global.css'

// ── ローディング画面 ──
function LoadingView({ message }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
      <div style={{ fontSize: 40, animation: 'spin 1s linear infinite' }}>✦</div>
      <p style={{ fontSize: 15, color: 'var(--text-2)' }}>{message}</p>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── エラーバナー ──
function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div style={{
      background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
      borderRadius: 'var(--radius-sm)', padding: '10px 14px',
      fontSize: 13, marginBottom: 14, lineHeight: 1.6,
    }}>{message}</div>
  )
}

export default function DiscoverPage() {
  const navigate = useNavigate()
  const {
    step, mood, setMood, maxTime, setMaxTime, category, setCategory,
    servings, setServings, results, isMock, generated, saving, savedId, error,
    handleDiscover, handleSelectItem, handleSave, reset,
  } = useDiscover()

  // ── フィルター画面 ──
  if (step === STEP.FILTER) return (
    <div className="page-wrapper">
      <div className="topbar">
        <div className="topbar-row">
          <button onClick={() => navigate('/home')} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← 戻る</button>
          <span className="topbar-title" style={{ flex: 1, textAlign: 'center' }}>AIに相談する</span>
          <div style={{ width: 60 }} />
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <ErrorBanner message={error} />
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>
          今日の気分や条件を教えてください。AIが料理を提案します。<br />
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>すべて任意です。スキップしてもOK。</span>
        </p>

        {/* 気分 */}
        <div style={{ marginBottom: 20 }}>
          <div className="field-label">今日の気分（任意）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MOODS.map(m => (
              <button key={m} onClick={() => setMood(mood === m ? '' : m)} style={{
                padding: '7px 14px', borderRadius: 999, fontSize: 13, border: '1px solid',
                borderColor: mood === m ? 'var(--blue)' : 'var(--border)',
                background:  mood === m ? 'var(--blue)' : 'var(--surface)',
                color:       mood === m ? '#fff' : 'var(--text-2)',
                cursor: 'pointer',
              }}>{m}</button>
            ))}
          </div>
        </div>

        {/* 時間 */}
        <div style={{ marginBottom: 20 }}>
          <div className="field-label">調理にかけられる時間（任意）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TIMES.map(t => (
              <button key={t.label} onClick={() => setMaxTime(maxTime === t.value ? null : t.value)} style={{
                padding: '7px 14px', borderRadius: 999, fontSize: 13, border: '1px solid',
                borderColor: maxTime === t.value ? 'var(--blue)' : 'var(--border)',
                background:  maxTime === t.value ? 'var(--blue)' : 'var(--surface)',
                color:       maxTime === t.value ? '#fff' : 'var(--text-2)',
                cursor: 'pointer',
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* カテゴリ */}
        <div style={{ marginBottom: 20 }}>
          <div className="field-label">カテゴリ（任意）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{
                padding: '7px 14px', borderRadius: 999, fontSize: 13, border: '1px solid',
                borderColor: category === c ? 'var(--blue)' : 'var(--border)',
                background:  category === c ? 'var(--blue)' : 'var(--surface)',
                color:       category === c ? '#fff' : 'var(--text-2)',
                cursor: 'pointer',
              }}>{c}</button>
            ))}
          </div>
        </div>

        {/* 人数 */}
        <div style={{ marginBottom: 24 }}>
          <div className="field-label">何人前のレシピを生成しますか？</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--gold-light)', border: '1px solid #E8D080', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1 }}>人数</span>
            <button onClick={() => setServings(s => Math.max(1, s - 1))} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <span style={{ minWidth: 48, textAlign: 'center', fontSize: 15, fontWeight: 600, color: 'var(--gold-dark)' }}>{servings}人前</span>
            <button onClick={() => setServings(s => Math.min(6, s + 1))} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</button>
          </div>
        </div>

        <button onClick={handleDiscover} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px 0', fontSize: 15 }}>
          AIに料理を提案してもらう
        </button>
      </div>
      <BottomNav />
    </div>
  )

  if (step === STEP.LOADING)    return <LoadingView message="AIが料理を考えています…" />
  if (step === STEP.GENERATING) return <LoadingView message="レシピを生成しています…" />

  // ── 提案リスト ──
  if (step === STEP.RESULTS) return (
    <div className="page-wrapper">
      <div className="topbar">
        <div className="topbar-row" style={{ position: 'relative' }}>
          <button onClick={() => reset()} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>← 条件を変える</button>
          <span className="topbar-title" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>AIの提案</span>
        </div>
      </div>
      <div style={{ padding: '16px' }}>
        {isMock && (
          <div style={{ background: 'var(--gold-light)', border: '1px solid #E8D080', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 12, color: 'var(--gold-dark)', marginBottom: 14 }}>
            現在はモックデータを表示しています。OPENAI_API_KEY を設定するとAIが本格提案します。
          </div>
        )}
        <ErrorBanner message={error} />
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
          気になる料理をタップするとレシピ全文を生成します
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(results ?? []).map((item, i) => (
            <SuggestionCard key={i} item={item} onSelect={handleSelectItem} />
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  )

  // ── レシピプレビュー（省略：RecipeDetailPage と同構造のため別コンポーネント化を推奨） ──
  if (step === STEP.PREVIEW && generated) return (
    <div className="page-wrapper">
      <div className="topbar">
        <div className="topbar-row">
          <button onClick={() => { /* 結果一覧に戻る */ }} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← 戻る</button>
          <span className="topbar-title" style={{ flex: 1, textAlign: 'center' }}>AIが生成したレシピ</span>
          <div style={{ width: 60 }} />
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        <span className={`cat-badge cat-${generated?.category ?? 'その他'}`}>{generated?.category ?? 'その他'}</span>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 10px' }}>{generated?.title ?? ''}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 16 }}>{generated?.description ?? ''}</p>
        <ErrorBanner message={error} />
        {/* 評価ボタン */}
        <div style={{ background: 'var(--gold-light)', border: '1px solid #E8D080', borderRadius: 'var(--radius-md)', padding: 16, marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold-dark)', marginBottom: 12, textAlign: 'center' }}>このレシピはどうでしたか？</p>
          <button onClick={() => handleSave('save')} disabled={saving} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px 0', marginBottom: 8 }}>
            {saving ? '保存中…' : 'また作りたい → ライブラリに保存'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleSave('neutral')} style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>微妙</button>
            <button onClick={() => handleSave('never')}   style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-sm)', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, cursor: 'pointer' }}>二度と作らない</button>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  )

  // ── 保存完了 ──
  if (step === STEP.DONE) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, padding: 24 }}>
      <div style={{ fontSize: 56 }}>🎉</div>
      <p style={{ fontSize: 18, fontWeight: 600 }}>ライブラリに保存しました！</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
        <button className="btn btn-primary" style={{ justifyContent: 'center', padding: '12px 0' }} onClick={() => navigate(`/recipes/${savedId}`)}>レシピを見る</button>
        <button className="btn btn-ghost"   style={{ justifyContent: 'center', padding: '12px 0' }} onClick={reset}>もう一品相談する</button>
        <button className="btn btn-ghost"   style={{ justifyContent: 'center', padding: '12px 0' }} onClick={() => navigate('/home')}>ホームに戻る</button>
      </div>
    </div>
  )

  return null
}
