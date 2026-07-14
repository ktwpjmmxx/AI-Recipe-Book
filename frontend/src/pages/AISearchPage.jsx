import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import MarkdownText from '../components/MarkdownText'
import '../global.css'
import { useAISearch } from '../hooks/useAISearch'

// コサイン距離（小さいほど類似）を、表示用の「関連度%」に変換する。
// バックエンド側の score はあくまで距離なので、フロントでのみ使う近似表示。
function toRelevancePercent(score) {
  const clamped = Math.max(0, Math.min(1, 1 - (score ?? 0)))
  return Math.round(clamped * 100)
}

function ReferenceCard({ reference, onClick }) {
  const relevance = toRelevancePercent(reference.score)
  const clickable = reference.recipe_id != null

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {reference.title}
        </div>
        <span className={`cat-badge cat-${reference.category || 'その他'}`} style={{ fontSize: 11 }}>
          {reference.category || 'その他'}
        </span>
      </div>
      <div
        style={{
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--accent-dark)',
          background: 'var(--accent-light)',
          borderRadius: 999,
          padding: '4px 10px',
          whiteSpace: 'nowrap',
        }}
      >
        関連度 {relevance}%
      </div>
      {clickable && <i className="ti ti-chevron-right" aria-hidden="true" style={{ color: 'var(--text-3)', fontSize: 16 }} />}
    </div>
  )
}

export default function AISearchPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const {
    question, setQuestion, loading, answer, isMock, references, hasSearched, ask, reset,
  } = useAISearch()

  const handleSubmit = e => {
    e.preventDefault()
    ask()
  }

  return (
    <div className="page-wrapper">
      <div className="topbar">
        <div className="topbar-row">
          <button
            onClick={() => navigate('/home')}
            style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {t('common.back')}
          </button>
          <span className="topbar-title" style={{ flex: 1, textAlign: 'center' }}>{t('aiSearch.title')}</span>
          <div style={{ width: 60 }} />
        </div>
      </div>

      <div style={{ padding: '20px 16px 96px' }}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 18 }}>
          {t('aiSearch.subtitle')}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder={t('aiSearch.placeholder')}
            style={{
              flex: 1,
              padding: '11px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              fontSize: 14,
              background: 'var(--surface)',
            }}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="btn btn-primary"
            style={{ flexShrink: 0, padding: '0 18px', opacity: loading || !question.trim() ? 0.6 : 1 }}
          >
            {loading ? t('common.loading') : t('aiSearch.submit')}
          </button>
        </form>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-2)', fontSize: 13, marginBottom: 16 }}>
            <span style={{ fontSize: 20, animation: 'spin 1s linear infinite', display: 'inline-block' }}>✦</span>
            {t('aiSearch.loading')}
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {!loading && !hasSearched && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✦</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{t('aiSearch.emptyTitle')}</p>
            <p style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{t('aiSearch.emptySub')}</p>
          </div>
        )}

        {!loading && hasSearched && (
          <>
            {isMock && (
              <div style={{ background: 'var(--gold-light)', border: '1px solid #E8D080', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 12, color: 'var(--gold-dark)', marginBottom: 14 }}>
                {t('aiSearch.mockNotice')}
              </div>
            )}

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 20 }}>
              <MarkdownText style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-1)' }}>{answer}</MarkdownText>
            </div>

            <div className="field-label">{t('aiSearch.referencesTitle')}</div>
            {references.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>{t('aiSearch.noReferences')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {references.map((r, i) => (
                  <ReferenceCard
                    key={r.recipe_id ?? i}
                    reference={r}
                    onClick={() => r.recipe_id != null && navigate(`/recipes/${r.recipe_id}`)}
                  />
                ))}
              </div>
            )}

            <button onClick={reset} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '11px 0', marginTop: 20 }}>
              {t('aiSearch.submit')}
            </button>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
