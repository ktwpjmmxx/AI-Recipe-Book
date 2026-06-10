/**
 * hooks/useRecipes.js — レシピ一覧の状態管理・API通信
 *
 * ページコンポーネントは UI 描画に専念し、
 * データ取得・状態変更はすべてこの Hook に委譲する。
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchRecipes, fetchCategories } from '../api/recipeApi'

export function useRecipes({ sortKey = 'date', search = '' } = {}) {
  const [recipes,    setRecipes]    = useState([])
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchRecipes({ sort: 'created_at', order: 'desc' })
      .then(setRecipes)
      .catch(err => setError(err?.message ?? '取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleUpdate = useCallback(updated => {
    setRecipes(prev => prev.map(r => r.id === updated.id ? updated : r))
  }, [])

  const sorted = useMemo(() => {
    let list = [...recipes]
    if (search.trim()) {
      list = list.filter(r => r.title.includes(search.trim()))
    }
    if (sortKey === 'date')  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sortKey === 'genre') list.sort((a, b) => a.category.localeCompare(b.category, 'ja'))
    if (sortKey === 'kana')  list.sort((a, b) => a.title.localeCompare(b.title, 'ja'))
    if (sortKey === 'time')  list.sort((a, b) => a.cook_time - b.cook_time)
    return list
  }, [recipes, sortKey, search])

  return { recipes, sorted, categories, loading, error, handleUpdate, reload: load }
}

export function useFavoriteRecipes() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetchRecipes({ favorites_only: true })
      .then(setRecipes)
      .catch(err => setError(err?.message ?? '取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  const handleUpdate = useCallback(updated => {
    if (!updated.is_favorite) {
      setRecipes(prev => prev.filter(r => r.id !== updated.id))
    } else {
      setRecipes(prev => prev.map(r => r.id === updated.id ? updated : r))
    }
  }, [])

  return { recipes, loading, error, handleUpdate }
}
