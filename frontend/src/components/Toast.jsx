/**
 * components/Toast.jsx — トースト通知の表示コンポーネント
 *
 * フェーズ3で新規追加。AI呼び出し失敗時・モックフォールバック時の
 * 通知に使用する。既存の ErrorBanner（AIPanel等）と同じ配色トークンを
 * 流用し、見た目の一貫性を保つ。
 */
export default function Toast({ toasts, onDismiss }) {
  if (!toasts.length) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        padding: '0 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 2000,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => {
        const isInfo = toast.variant === 'info'
        return (
          <div
            key={toast.id}
            onClick={() => onDismiss(toast.id)}
            role="status"
            style={{
              pointerEvents: 'auto',
              cursor: 'pointer',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              lineHeight: 1.5,
              boxShadow: '0 4px 16px rgba(0,0,0,.15)',
              background: isInfo ? 'var(--gold-light)' : '#fef2f2',
              color: isInfo ? 'var(--gold-dark)' : '#b91c1c',
              border: `1px solid ${isInfo ? '#E8D080' : '#fecaca'}`,
            }}
          >
            {toast.message}
          </div>
        )
      })}
    </div>
  )
}
