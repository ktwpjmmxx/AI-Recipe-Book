import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate      = useNavigate()

  // ── ナビゲーション項目 ──
  // 「ログアウト」は即時実行アクションのため、ここには置かない。
  // 代わりに「アカウント」という画面遷移先を用意し、
  // そのページの下部にログアウトを独立配置する（AccountPage.jsx）。
  const items = [
    { to: '/home',      icon: 'ti-home',        label: 'ホーム'    },
    { to: '/library',   icon: 'ti-books',       label: 'ライブラリ' },
    { to: '/favorites', icon: 'ti-heart',       label: 'お気に入り' },
    { to: '/account',   icon: 'ti-user-circle', label: 'アカウント' },
  ]

  return (
    <>
      {/* FAB：ラベル付き・ピル型・セージ */}
      <button
        className="fab"
        onClick={() => navigate('/recipes/new')}
        aria-label="レシピを追加"
      >
        <i className="ti ti-plus" aria-hidden="true" />
        レシピを追加
      </button>

      <nav className="bnav">
        {items.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`bnav-item ${pathname.startsWith(item.to) ? 'active' : ''}`}
          >
            <i className={`ti ${item.icon}`} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
