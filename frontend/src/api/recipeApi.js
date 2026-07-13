/**
 * api/recipeApi.js — バックエンド通信レイヤー
 *
 * v4.4 追加:
 *   setRecipeVisibility() : 公開/非公開の切り替え
 *   fetchPublicRecipe()   : 共有URL経由でのレシピ取得（認証ヘッダー不要だが付与しても問題ない）
 *   forkRecipe()          : 公開レシピを自分のライブラリにフォーク
 */
import axios from 'axios'
import { getToken } from '../context/AuthContext'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'
const api = axios.create({
  baseURL,
  timeout: 30000,
})

api.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    const status = err?.response?.status
    const url = err?.config?.url
    if (err.code === 'ECONNABORTED') console.error(`[API] タイムアウト: ${url}`)
    else console.error(`[API] ${status ?? 'network error'}: ${url}`)
    return Promise.reject(err)
  }
)

export default api

/**
 * バックエンドのエラーレスポンスから表示用メッセージを取り出す。
 *
 * フェーズ3でバックエンドのエラー形式が {"error": {"code", "message"}} に
 * 統一されたため、それを優先的に読む。タイムアウト・ネットワークエラー時は
 * バックエンドからレスポンス自体が返らないため、専用のメッセージにフォールバックする。
 */
export const getApiErrorMessage = (err, fallback = 'エラーが発生しました。しばらくしてから再度お試しください。') => {
  if (err?.code === 'ECONNABORTED') return '応答がタイムアウトしました。もう一度お試しください。'
  const backendMessage = err?.response?.data?.error?.message
  return backendMessage || fallback
}

// ── レシピ CRUD ──────────────────────────────
export const fetchRecipes = (params = {}) => api.get('/recipes', { params }).then(r => r.data)
export const fetchRecipe = id => api.get(`/recipes/${id}`).then(r => r.data)
export const createRecipe = data => api.post('/recipes', data).then(r => r.data)
export const updateRecipe = (id, data) => api.patch(`/recipes/${id}`, data).then(r => r.data)
export const deleteRecipe = id => api.delete(`/recipes/${id}`)
export const toggleFavorite = id => api.patch(`/recipes/${id}/favorite`).then(r => r.data)
export const fetchCategories = () => api.get('/categories').then(r => r.data)
export const askRecipeAI = (id, q) => api.post(`/recipes/${id}/ai-assist`, { question: q }).then(r => r.data)

export const uploadImage = (id, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/recipes/${id}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  }).then(r => r.data)
}

// ── v4.4: 共有・フォーク ───────────────────────
/** @param {number} id @param {boolean} isPublic */
export const setRecipeVisibility = (id, isPublic) =>
  api.patch(`/recipes/${id}/visibility`, { is_public: isPublic }).then(r => r.data)

/** @param {string} shareId — 認証不要。ログイン前のユーザーでも呼び出せる */
export const fetchPublicRecipe = shareId =>
  api.get(`/public/recipes/${shareId}`).then(r => r.data)

/** @param {string} shareId — 認証必須。自分のライブラリにコピーする */
export const forkRecipe = shareId =>
  api.post(`/public/recipes/${shareId}/fork`).then(r => r.data)

// ── AI ───────────────────────────────────────
export const discoverRecipes = (params = {}) => api.post('/ai/discover', params).then(r => r.data)
export const generateRecipe = params => api.post('/ai/generate-recipe', params).then(r => r.data)
export const suggestMenu = question => api.post('/ai/suggest-menu', { question }).then(r => r.data)
export const searchAssist = question => api.post('/ai/search-assist', { question }).then(r => r.data)

// ── 買い物リスト ──────────────────────────────
export const fetchShoppingLists = () => api.get('/shopping-lists').then(r => r.data)
export const fetchShoppingList = id => api.get(`/shopping-lists/${id}`).then(r => r.data)
export const createShoppingList = data => api.post('/shopping-lists', data).then(r => r.data)
export const updateShoppingListItems = (id, items) => api.patch(`/shopping-lists/${id}/items`, items).then(r => r.data)
export const deleteShoppingList = id => api.delete(`/shopping-lists/${id}`)
