import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate      = useNavigate()
  const { t }         = useTranslation()

  const items = [
    { to: '/home',      icon: 'ti-home',        label: t('nav.home')      },
    { to: '/ai-search', icon: 'ti-sparkles',    label: t('nav.aiSearch')  },
    { to: '/library',   icon: 'ti-books',       label: t('nav.library')   },
    { to: '/favorites', icon: 'ti-heart',       label: t('nav.favorites') },
    { to: '/account',   icon: 'ti-user-circle', label: t('nav.account')   },
  ]

  // AI検索ページでは「レシピを追加」という導線が文脈的に不要なうえ、
  // 参照レシピカードとFABの表示位置が重なってしまうため非表示にする。
  const showFab = !pathname.startsWith('/ai-search')

  return (
    <>
      {showFab && (
        <button
          className="fab"
          onClick={() => navigate('/recipes/new')}
          aria-label={t('common.addRecipe')}
        >
          <i className="ti ti-plus" aria-hidden="true" />
          {t('common.addRecipe')}
        </button>
      )}

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
