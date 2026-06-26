import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDiscover, STEP, MOODS, TIMES, CATEGORIES } from '../hooks/useDiscover'
import SuggestionCard from '../components/SuggestionCard'
import BottomNav from '../components/BottomNav'
import '../global.css'

function LoadingView({ message }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
      <div style={{ fontSize: 40, animation: 'spin 1s linear infinite' }}>✦</div>
      <p style={{ fontSize: 15, color: 'var(--text-2)' }}>{message}</p>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

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
  const { t } = useTranslation()
  const {
    step, mood, setMood, maxTime, setMaxTime, category, setCategory,
    servings, setServings, results, isMock, generated, saving, savedId, error,
    handleDiscover, handleSelectItem, handleSave, reset,
  } = useDiscover()

  const chipStyle = (active) => ({
    padding: '7px 14px', borderRadius: 999, fontSize: 13, border: '1px solid',
    borderColor: active ? 'var(--blue)' : 'var(--border)',
    background:  active ? 'var(--blue)' : 'var(--surface)',
    color:       active ? '#fff' : 'var(--text-2)',
    cursor: 'pointer',
  })

  // ── フィルター画面 ──
  if (step === STEP.FILTER) return (
    <div className="page-wrapper">
      <div className="topbar">
        <div className="topbar-row">
          <button onClick={() => navigate('/home')} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {t('common.back')}
          </button>
          <span className="topbar-title" style={{ flex: 1, textAlign: 'center' }}>{t('discover.pageTitle')}</span>
          <div style={{ width: 60 }} />
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <ErrorBanner message={error} />
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>
          {t('discover.filterIntro')}<br />
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('discover.filterOptional')}</span>
        </p>

        {/* 気分 */}
        <div style={{ marginBottom: 20 }}>
          <div className="field-label">{t('discover.moodLabel')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MOODS.map(m => (
              <button key={m} onClick={() => setMood(mood === m ? '' : m)} style={chipStyle(mood === m)}>{m}</button>
            ))}
          </div>
        </div>

        {/* 時間 */}
        <div style={{ marginBottom: 20 }}>
          <div className="field-label">{t('discover.timeLabel')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TIMES.map(tv => (
              <button key={tv.label} onClick={() => setMaxTime(maxTime === tv.value ? null : tv.value)} style={chipStyle(maxTime === tv.value)}>{tv.label}</button>
            ))}
          </div>
        </div>

        {/* カテゴリ */}
        <div style={{ marginBottom: 20 }}>
          <div className="field-label">{t('discover.categoryLabel')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={chipStyle(category === c)}>{c}</button>
            ))}
          </div>
        </div>

        {/* 人数 */}
        <div style={{ marginBottom: 24 }}>
          <div className="field-label">{t('discover.servingsLabel')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--gold-light)', border: '1px solid #E8D080', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1 }}>{t('discover.servingsInputLabel')}</span>
            <button onClick={() => setServings(s => Math.max(1, s - 1))} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <span style={{ minWidth: 80, textAlign: 'center', fontSize: 15, fontWeight: 600, color: 'var(--gold-dark)' }}>
              {t('discover.servingsUnit', { count: servings })}
            </span>
            <button onClick={() => setServings(s => Math.min(6, s + 1))} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</button>
          </div>
        </div>

        <button onClick={handleDiscover} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px 0', fontSize: 15 }}>
          {t('discover.submitFilter')}
        </button>
      </div>
      <BottomNav />
    </div>
  )

  if (step === STEP.LOADING)    return <LoadingView message={t('discover.loadingThinking')} />
  if (step === STEP.GENERATING) return <LoadingView message={t('discover.loadingGenerating')} />

  // ── 提案リスト ──
  if (step === STEP.RESULTS) return (
    <div className="page-wrapper">
      <div className="topbar">
        <div className="topbar-row" style={{ position: 'relative' }}>
          <button onClick={() => reset()} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
            {t('discover.resultsBack')}
          </button>
          <span className="topbar-title" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
            {t('discover.resultsTitle')}
          </span>
        </div>
      </div>
      <div style={{ padding: '16px' }}>
        {isMock && (
          <div style={{ background: 'var(--gold-light)', border: '1px solid #E8D080', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 12, color: 'var(--gold-dark)', marginBottom: 14 }}>
            {t('discover.mockBanner')}
          </div>
        )}
        <ErrorBanner message={error} />
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
          {t('discover.resultsHint')}
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

  // ── レシピプレビュー ──
  if (step === STEP.PREVIEW && generated) return (
    <div className="page-wrapper">
      <div className="topbar">
        <div className="topbar-row">
          <button onClick={() => {}} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {t('common.back')}
          </button>
          <span className="topbar-title" style={{ flex: 1, textAlign: 'center' }}>{t('discover.previewTitle')}</span>
          <div style={{ width: 60 }} />
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        <span className={`cat-badge cat-${generated?.category ?? 'その他'}`}>{generated?.category ?? 'その他'}</span>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 10px' }}>{generated?.title ?? ''}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 16 }}>{generated?.description ?? ''}</p>
        <ErrorBanner message={error} />
        <div style={{ background: 'var(--gold-light)', border: '1px solid #E8D080', borderRadius: 'var(--radius-md)', padding: 16, marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold-dark)', marginBottom: 12, textAlign: 'center' }}>
            {t('discover.ratingQuestion')}
          </p>
          <button onClick={() => handleSave('save')} disabled={saving} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px 0', marginBottom: 8 }}>
            {saving ? t('common.saving') : t('discover.ratingSave')}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleSave('neutral')} style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>
              {t('discover.ratingNeutral')}
            </button>
            <button onClick={() => handleSave('never')} style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-sm)', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, cursor: 'pointer' }}>
              {t('discover.ratingNever')}
            </button>
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
      <p style={{ fontSize: 18, fontWeight: 600 }}>{t('discover.doneTitle')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
        <button className="btn btn-primary" style={{ justifyContent: 'center', padding: '12px 0' }} onClick={() => navigate(`/recipes/${savedId}`)}>
          {t('discover.doneView')}
        </button>
        <button className="btn btn-ghost" style={{ justifyContent: 'center', padding: '12px 0' }} onClick={reset}>
          {t('discover.doneAnother')}
        </button>
        <button className="btn btn-ghost" style={{ justifyContent: 'center', padding: '12px 0' }} onClick={() => navigate('/home')}>
          {t('discover.doneHome')}
        </button>
      </div>
    </div>
  )

  return null
}
