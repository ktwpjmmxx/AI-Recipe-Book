import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import BottomNav from '../components/BottomNav'
import EditProfileModal from '../components/EditProfileModal'
import ChangePasswordModal from '../components/ChangePasswordModal'
import '../global.css'

export default function AccountPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showEditProfile,   setShowEditProfile]   = useState(false)
  const [showChangePw,      setShowChangePw]       = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const displayName = user?.display_name || user?.email?.split('@')[0] || t('account.guest')
  const initial      = displayName.charAt(0).toUpperCase()

  return (
    <div className="page-wrapper">

      <div className="topbar">
        <div className="topbar-row">
          <div className="topbar-title">{t('account.title')}</div>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>

        {/* プロフィールカード */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '20px 18px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: user?.avatar_url ? 'transparent' : 'var(--accent-light)',
              color: 'var(--accent-dark)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 600, flexShrink: 0,
              overflow: 'hidden', border: '1px solid var(--border)',
            }}>
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initial
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 16, fontWeight: 600, color: 'var(--ink)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {displayName}{t('account.san')}
              </div>
              <div style={{
                fontSize: 13, color: 'var(--text-3)', marginTop: 3,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {user?.email}
              </div>
            </div>
          </div>

          {user?.bio && (
            <div style={{
              marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)',
              fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {user.bio}
            </div>
          )}
        </div>

        {/* メニューリスト */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, overflow: 'hidden', marginBottom: 24,
        }}>
          <button onClick={() => setShowEditProfile(true)} style={menuItemStyle(true)}>
            <i className="ti ti-user" style={menuIconStyle} />
            <span style={{ flex: 1 }}>{t('account.editProfile')}</span>
            <i className="ti ti-chevron-right" style={menuChevronStyle} />
          </button>

          <button onClick={() => setShowChangePw(true)} style={menuItemStyle(true)}>
            <i className="ti ti-lock" style={menuIconStyle} />
            <span style={{ flex: 1 }}>{t('account.changePassword')}</span>
            <i className="ti ti-chevron-right" style={menuChevronStyle} />
          </button>

          <button onClick={() => alert(t('account.notificationsSoon'))} style={menuItemStyle(false)}>
            <i className="ti ti-bell" style={menuIconStyle} />
            <span style={{ flex: 1 }}>{t('account.notifications')}</span>
            <i className="ti ti-chevron-right" style={menuChevronStyle} />
          </button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginBottom: 28 }}>
          {t('account.version')}
        </div>

        {/* ログアウト */}
        {!showLogoutConfirm ? (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              width: '100%', padding: '13px 0',
              background: 'var(--surface)', border: '1px solid #fecaca',
              borderRadius: 12, color: '#b91c1c',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <i className="ti ti-logout" />
            {t('account.logout')}
          </button>
        ) : (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 13, color: '#b91c1c', marginBottom: 12, textAlign: 'center' }}>
              {t('account.logoutConfirm')}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowLogoutConfirm(false)} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
                {t('common.cancel')}
              </button>
              <button onClick={handleLogout} className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }}>
                {t('account.logoutDo')}
              </button>
            </div>
          </div>
        )}
      </div>

      {showEditProfile && <EditProfileModal onClose={() => setShowEditProfile(false)} />}
      {showChangePw    && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}

      <BottomNav />
    </div>
  )
}

function menuItemStyle(hasBorder) {
  return {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px',
    borderBottom: hasBorder ? '1px solid var(--border)' : 'none',
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, color: 'var(--ink)', textAlign: 'left',
  }
}
const menuIconStyle    = { fontSize: 18, color: 'var(--text-3)' }
const menuChevronStyle = { fontSize: 16, color: 'var(--text-3)' }
