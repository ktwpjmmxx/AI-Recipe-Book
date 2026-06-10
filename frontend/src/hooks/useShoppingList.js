/**
 * hooks/useShoppingList.js — 買い物リストの状態管理・API通信
 *
 * ShoppingListPage と SavedShoppingListPage から
 * ロジックを完全に分離する Custom Hook。
 */
import { useState, useCallback } from 'react'
import {
  createShoppingList,
  fetchShoppingLists,
  fetchShoppingList,
  updateShoppingListItems,
  deleteShoppingList,
} from '../api/recipeApi'

// ──────────────────────────────────────────────
// 買い物リスト生成ページで使用するHook
// ──────────────────────────────────────────────
export function useShoppingListBuilder(recipe, servings) {
  const [pantry,    setPantry]    = useState({})
  const [checked,   setChecked]   = useState(new Set())
  const [mode,      setMode]      = useState('input')  // 'input' | 'list'
  const [saving,    setSaving]    = useState(false)
  const [savedId,   setSavedId]   = useState(null)
  const [showToast, setShowToast] = useState(false)
  const [error,     setError]     = useState(null)

  const ratio = recipe ? servings / recipe.base_servings : 1

  const numericItems = (recipe?.ingredients ?? []).filter(
    ing => !ing.amount_text && ing.amount != null && ing.amount > 0
  )
  const textItems = (recipe?.ingredients ?? []).filter(
    ing => ing.amount_text || !ing.amount
  )

  // ① バグ修正済み: 空欄(null) と 0 を明確に区別する
  const parseHave = useCallback(name => {
    const raw = pantry[name]
    if (raw === undefined || raw === '') return null  // 未入力
    const n = parseFloat(raw)
    return isNaN(n) ? null : n
  }, [pantry])

  const calcNeeded = useCallback((ing) => {
    const required = (ing.amount ?? 0) * ratio
    const have     = parseHave(ing.name)
    if (have === null) return required        // 未入力 → 全量
    return Math.max(0, required - have)       // 0入力 → 全量が正しく表示される
  }, [ratio, parseHave])

  const listItems = numericItems.map(ing => ({
    ...ing,
    required: (ing.amount ?? 0) * ratio,
    have:     parseHave(ing.name),
    needed:   calcNeeded(ing),
  }))

  const toggleCheck = useCallback(name => {
    setChecked(prev => {
      const n = new Set(prev)
      n.has(name) ? n.delete(name) : n.add(name)
      return n
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!recipe) return
    setSaving(true)
    setError(null)
    try {
      const items = [
        ...listItems.map(item => ({
          name:     item.name,
          needed:   item.needed,
          unit:     item.unit,
          is_text:  false,
          text_val: null,
          checked:  checked.has(item.name),
        })),
        ...textItems.map(ing => ({
          name:     ing.name,
          needed:   null,
          unit:     '',
          is_text:  true,
          text_val: ing.amount_text ?? '適量',
          checked:  checked.has(ing.name),
        })),
      ]
      const saved = await createShoppingList({
        recipe_id:    recipe.id,
        recipe_title: recipe.title,
        servings,
        items,
      })
      setSavedId(saved?.id)
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } catch (err) {
      const msg = err?.code === 'ECONNABORTED'
        ? '保存がタイムアウトしました。再度お試しください。'
        : '保存に失敗しました。バックエンドが起動しているか確認してください。'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }, [recipe, servings, listItems, textItems, checked])

  const allDone = listItems.filter(i => i.needed > 0).every(i => checked.has(i.name))
    && textItems.every(i => checked.has(i.name))

  return {
    pantry, setPantry,
    checked, toggleCheck,
    mode, setMode,
    saving, savedId, showToast, error,
    ratio, numericItems, textItems, listItems, allDone,
    parseHave, handleSave,
  }
}

// ──────────────────────────────────────────────
// 保存済みリスト一覧で使用するHook
// ──────────────────────────────────────────────
export function useSavedShoppingLists() {
  const [lists,   setLists]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchShoppingLists()
      .then(setLists)
      .catch(err => setError(err?.message ?? '取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = useCallback(async id => {
    await deleteShoppingList(id)
    setLists(prev => prev.filter(l => l.id !== id))
  }, [])

  return { lists, loading, error, load, handleDelete }
}

// ──────────────────────────────────────────────
// 保存済みリスト詳細で使用するHook
// ──────────────────────────────────────────────
export function useSavedShoppingListDetail(id, navigate) {
  const [list,    setList]    = useState(null)
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    fetchShoppingList(id)
      .then(data => {
        setList(data)
        setItems(data?.items ?? [])
      })
      .catch(() => navigate?.('/library'))
      .finally(() => setLoading(false))
  }, [id])

  const toggleCheck = useCallback(async index => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    )
    setItems(updated)
    setSaving(true)
    try {
      await updateShoppingListItems(id, updated)
    } catch (err) {
      setError(err?.code === 'ECONNABORTED' ? 'タイムアウトしました。' : '保存に失敗しました。')
    } finally {
      setSaving(false)
    }
  }, [id, items])

  const handleDelete = useCallback(async () => {
    await deleteShoppingList(id)
    navigate?.('/library')
  }, [id, navigate])

  const needItems = items.filter(i => !i.is_text && (i.needed ?? 0) > 0)
  const haveItems = items.filter(i => !i.is_text && (i.needed ?? 1) === 0)
  const textItems = items.filter(i => i.is_text)
  const doneCount  = items.filter(i => i.checked).length
  const totalCount = items.length
  const allDone    = doneCount === totalCount && totalCount > 0

  return {
    list, items, loading, saving, error,
    needItems, haveItems, textItems,
    doneCount, totalCount, allDone,
    load, toggleCheck, handleDelete,
  }
}
