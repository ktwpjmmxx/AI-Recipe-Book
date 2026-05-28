import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()

  const items = [
    { to: '/home',      icon: 'ti-home',  label: 'ホーム'    },
    { to: '/library',   icon: 'ti-books', label: 'ライブラリ' },
    { to: '/favorites', icon: 'ti-heart', label: 'お気に入り' },
  ]

  return (
    <>
      {/* FAB：ラベル付き・ピル型・ブルー */}
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
