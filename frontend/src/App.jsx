import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { usePWA } from './hooks/usePWA'

import LoginPage              from './pages/LoginPage'
import RegisterPage           from './pages/RegisterPage'
import HomePage                from './pages/HomePage'
import LibraryPage             from './pages/LibraryPage'
import FavoritesPage           from './pages/FavoritesPage'
import AccountPage             from './pages/AccountPage'
import RecipeDetailPage        from './pages/RecipeDetailPage'
import RecipeFormPage          from './pages/RecipeFormPage'
import DiscoverPage            from './pages/DiscoverPage'
import AISearchPage            from './pages/AISearchPage'
import ShoppingListPage        from './pages/ShoppingListPage'
import SavedShoppingListPage   from './pages/SavedShoppingListPage'
import PublicRecipePage        from './pages/PublicRecipePage'   // ← v4.4 追加（認証不要）

// ── オフラインバナー ──────────────────────────
function OfflineBanner() {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: '#1c1c1a', color: '#f4f1ec',
      fontSize: 12, fontWeight: 500, textAlign: 'center',
      padding: '8px 16px', letterSpacing: '.04em',
    }}>
      オフラインです。保存済みのレシピは引き続き閲覧できます。
    </div>
  )
}

// ── インストール促進バナー ────────────────────
function InstallBanner({ onInstall, onDismiss }) {
  return (
    <div style={{
      position: 'fixed', bottom: 72, left: 16, right: 16, zIndex: 900,
      background: '#ffffff', border: '1px solid #ddd6c8', borderRadius: 16,
      padding: '14px 16px', boxShadow: '0 8px 32px rgba(0,0,0,.15)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ fontSize: 32, flexShrink: 0 }}>🍳</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1c1c1a', marginBottom: 3 }}>
          ホーム画面に追加する
        </div>
        <div style={{ fontSize: 12, color: '#9a9a90', lineHeight: 1.5 }}>
          アプリとしてインストールするとオフラインでも使えます
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <button onClick={onInstall} style={{
          background: '#1c1c1a', color: '#f4f1ec', border: 'none', borderRadius: 8,
          padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>追加する</button>
        <button onClick={onDismiss} style={{
          background: 'transparent', color: '#9a9a90', border: 'none',
          fontSize: 11, cursor: 'pointer', textAlign: 'center',
        }}>後で</button>
      </div>
    </div>
  )
}

// ── 認証ガード ────────────────────────────────
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: 'var(--text-3)', fontSize: 14,
      }}>
        読み込み中…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/home" replace />
  return children
}

// ── アプリ本体 ────────────────────────────────
function AppShell() {
  const { user } = useAuth()
  const { isInstallable, isInstalled, isOffline, handleInstall } = usePWA()
  const [bannerDismissed, setBannerDismissed] = React.useState(false)

  const showInstallBanner = user && isInstallable && !isInstalled && !bannerDismissed

  return (
    <>
      {user && isOffline && <OfflineBanner />}
      {showInstallBanner && (
        <InstallBanner
          onInstall={handleInstall}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      <Routes>
        {/* 認証不要 */}
        <Route path="/login"    element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

        {/* v4.4: 公開レシピ閲覧（認証不要・ログイン状態どちらでもアクセス可能） */}
        <Route path="/r/:shareId" element={<PublicRecipePage />} />

        {/* 認証必須 */}
        <Route path="/"                   element={<Navigate to="/home" replace />} />
        <Route path="/home"               element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/library"            element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
        <Route path="/favorites"          element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
        <Route path="/account"            element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
        <Route path="/discover"           element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
        <Route path="/ai-search"          element={<ProtectedRoute><AISearchPage /></ProtectedRoute>} />
        <Route path="/shopping"           element={<ProtectedRoute><ShoppingListPage /></ProtectedRoute>} />
        <Route path="/shopping-lists/:id" element={<ProtectedRoute><SavedShoppingListPage /></ProtectedRoute>} />
        <Route path="/recipes/new"        element={<ProtectedRoute><RecipeFormPage /></ProtectedRoute>} />
        <Route path="/recipes/:id"        element={<ProtectedRoute><RecipeDetailPage /></ProtectedRoute>} />
        <Route path="/recipes/:id/edit"   element={<ProtectedRoute><RecipeFormPage /></ProtectedRoute>} />
      </Routes>
    </>
  )
}

// ── ルート ────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
