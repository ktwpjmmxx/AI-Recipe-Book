/**
 * components/SuggestionCard.jsx — AI提案カード
 *
 * DiscoverPage から切り出した独立コンポーネント。
 * 再利用・単体テストが可能になる。
 */

export default function SuggestionCard({ item, onSelect }) {
  if (!item) return null

  return (
    <div
      onClick={() => onSelect?.(item)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '14px 16px',
        cursor: 'pointer', transition: 'box-shadow var(--t), transform var(--t)',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 'var(--radius-sm)',
        background: 'var(--gold-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
      }}>🍳</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          {item.title ?? ''}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6, lineHeight: 1.5 }}>
          {item.description ?? ''}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`cat-badge cat-${item.category ?? 'その他'}`}>
            {item.category ?? 'その他'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {item.cook_time ?? 0}分
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {item.servings ?? 2}人前
          </span>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 600, flexShrink: 0, paddingTop: 2 }}>
        詳しく見る ›
      </div>
    </div>
  )
}
