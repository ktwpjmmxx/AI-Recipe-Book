/**
 * hooks/useRecipeDetail.js — レシピ詳細の状態管理
 *
 * 分量計算ロジック（displayAmount）をここに集約することで
 * 複数ページから再利用可能にする。
 */
import { useState, useEffect, useCallback } from 'react'
import { fetchRecipe, toggleFavorite, uploadImage, deleteRecipe, askRecipeAI, getApiErrorMessage } from '../api/recipeApi'
import { useToast } from '../context/ToastContext'

const SERVING_OPTIONS = [0.5, 1, 2, 3, 4, 6]

/** 数値を見やすい文字列に変換 */
function fmtNum(val) {
  if (val === null || val === undefined || val < 0) return null
  if (val === 0) return '0'
  if (Number.isInteger(val)) return String(val)
  const f = val.toFixed(1)
  return f.endsWith('.0') ? f.slice(0, -2) : f
}

/**
 * ハイブリッド分量表示ロジック（バックエンドの recipe_service.py と同一仕様）
 *  - amount_text あり → テキストをそのまま表示（換算なし）
 *  - amount 数値あり → ratio 倍して換算
 *  - どちらもない    → unit のみ（「適量」など）
 */
export function displayAmount(ing, ratio) {
  if (ing?.amount_text) return ing.amount_text
  const numValue = (ing?.amount ?? 0) * ratio
  if (numValue === 0) return ing?.unit || '適量'
  const n = fmtNum(numValue)
  return `${n} ${ing?.unit ?? ''}`.trim()
}

export function isNumericAmount(ing) {
  return !ing?.amount_text && ing?.amount != null && ing.amount > 0
}

export function useRecipeDetail(id, navigate) {
  const [recipe,       setRecipe]       = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [servingIdx,   setServingIdx]   = useState(2)
  const [activeTab,    setActiveTab]    = useState('ingredients')
  const [checkedSteps, setCheckedSteps] = useState(new Set())

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchRecipe(id)
      .then(r => {
        setRecipe(r)
        const closest = SERVING_OPTIONS.reduce((best, s, i) =>
          Math.abs(s - r.base_servings) < Math.abs(SERVING_OPTIONS[best] - r.base_servings) ? i : best, 0)
        setServingIdx(closest)
      })
      .catch(() => navigate?.('/library'))
      .finally(() => setLoading(false))
  }, [id])

  const servings       = SERVING_OPTIONS[servingIdx]
  const ratio          = recipe ? servings / recipe.base_servings : 1
  const servingChanged = recipe ? servings !== recipe.base_servings : false
  const canScale       = recipe?.ingredients?.some(ing => isNumericAmount(ing)) ?? false
  const doneCount      = checkedSteps.size
  const totalSteps     = recipe?.steps?.length ?? 0

  const changeServing = useCallback(dir => {
    setServingIdx(i => Math.max(0, Math.min(SERVING_OPTIONS.length - 1, i + dir)))
  }, [])

  const handleFav = useCallback(async () => {
    if (!recipe) return
    const updated = await toggleFavorite(recipe.id)
    setRecipe(updated)
  }, [recipe])

  const handleImageUpload = useCallback(async file => {
    if (!recipe || !file) return
    const updated = await uploadImage(recipe.id, file)
    setRecipe(updated)
  }, [recipe])

  const handleDelete = useCallback(async () => {
    if (!recipe) return
    await deleteRecipe(recipe.id)
    navigate?.('/library')
  }, [recipe, navigate])

  const toggleStep = useCallback(order => {
    setCheckedSteps(prev => {
      const n = new Set(prev)
      n.has(order) ? n.delete(order) : n.add(order)
      return n
    })
  }, [])

  return {
    recipe, loading, error,
    servings, servingIdx, SERVING_OPTIONS,
    ratio, servingChanged, canScale,
    activeTab, setActiveTab,
    checkedSteps, doneCount, totalSteps,
    changeServing, handleFav, handleImageUpload, handleDelete, toggleStep,
    setRecipe,
  }
}

export function useAIPanel(recipe) {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const { notify } = useToast()

  useEffect(() => {
    if (recipe) {
      setMessages([{ role: 'bot', text: `「${recipe.title}」について何でも聞いてください！` }])
    }
  }, [recipe?.id])

  const send = useCallback(async q => {
    const text = q || input.trim()
    if (!text || loading || !recipe) return
    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const res = await askRecipeAI(recipe.id, text)
      setMessages(prev => [...prev, { role: 'bot', text: res?.answer ?? '回答を取得できませんでした。' }])
      if (res?.is_mock) {
        notify('現在、AI機能はモック応答で動作しています（実際のAI呼び出しに失敗、または未設定です）。', 'info')
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, 'エラーが発生しました。再度お試しください。')
      setMessages(prev => [...prev, { role: 'bot', text: msg }])
      setError(msg)
      notify(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [recipe, input, loading, notify])

  return { messages, input, setInput, loading, error, send }
}
