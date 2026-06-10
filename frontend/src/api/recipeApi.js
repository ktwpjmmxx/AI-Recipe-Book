/**
 * api/recipeApi.js — バックエンド通信レイヤー
 *
 * 改善点:
 *   - timeout: 30000 でAI待ちによる無限ローディングを防止
 *   - interceptors でエラーを一元ログ
 *   - 関数ごとに JSDoc を付与
 */
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000, // 30秒タイムアウト（AI生成はやや長めに確保）
})

// レスポンスエラーを一元ログ（デバッグに便利）
api.interceptors.response.use(
  res => res,
  err => {
    const status = err?.response?.status
    const url    = err?.config?.url
    if (err.code === 'ECONNABORTED') {
      console.error(`[API] タイムアウト: ${url}`)
    } else {
      console.error(`[API] ${status ?? 'network error'}: ${url}`)
    }
    return Promise.reject(err)
  }
)

// ── レシピ CRUD ──────────────────────────────
/** @param {{ category?:string, sort?:string, order?:string, favorites_only?:boolean }} params */
export const fetchRecipes    = (params = {})  => api.get('/recipes', { params }).then(r => r.data)
/** @param {number} id */
export const fetchRecipe     = id             => api.get(`/recipes/${id}`).then(r => r.data)
/** @param {object} data */
export const createRecipe    = data           => api.post('/recipes', data).then(r => r.data)
/** @param {number} id @param {object} data */
export const updateRecipe    = (id, data)     => api.patch(`/recipes/${id}`, data).then(r => r.data)
/** @param {number} id */
export const deleteRecipe    = id             => api.delete(`/recipes/${id}`)
/** @param {number} id */
export const toggleFavorite  = id             => api.patch(`/recipes/${id}/favorite`).then(r => r.data)
export const fetchCategories = ()             => api.get('/categories').then(r => r.data)
/** @param {number} id @param {string} question */
export const askRecipeAI     = (id, question) => api.post(`/recipes/${id}/ai-assist`, { question }).then(r => r.data)
export const suggestMenu     = question       => api.post('/ai/suggest-menu', { question }).then(r => r.data)

/** @param {number} id @param {File} file */
export const uploadImage = (id, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/recipes/${id}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000, // 画像アップロードは少し長めに
  }).then(r => r.data)
}

// ── AI 発見・生成 ────────────────────────────
/** @param {{ mood?:string, max_time?:number, category?:string }} params */
export const discoverRecipes = (params = {}) =>
  api.post('/ai/discover', params).then(r => r.data)

/** @param {{ title:string, servings:number }} params */
export const generateRecipe = params =>
  api.post('/ai/generate-recipe', params).then(r => r.data)

// ── 買い物リスト ──────────────────────────────
export const fetchShoppingLists = () =>
  api.get('/shopping-lists').then(r => r.data)

export const fetchShoppingList = id =>
  api.get(`/shopping-lists/${id}`).then(r => r.data)

export const createShoppingList = data =>
  api.post('/shopping-lists', data).then(r => r.data)

export const updateShoppingListItems = (id, items) =>
  api.patch(`/shopping-lists/${id}/items`, items).then(r => r.data)

export const deleteShoppingList = id =>
  api.delete(`/shopping-lists/${id}`)
