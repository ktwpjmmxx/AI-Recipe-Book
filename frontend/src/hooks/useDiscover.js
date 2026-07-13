/**
 * hooks/useDiscover.js — AIレシピ発見の状態管理
 *
 * DiscoverPage から UI ロジックを完全に分離する。
 * タイムアウトエラーを型で区別し、UI に適切なメッセージを表示する。
 */
import { useState, useCallback } from 'react'
import { discoverRecipes, generateRecipe, createRecipe, getApiErrorMessage } from '../api/recipeApi'
import { useToast } from '../context/ToastContext'

export const STEP = {
  FILTER:     'filter',
  LOADING:    'loading',
  RESULTS:    'results',
  GENERATING: 'generating',
  PREVIEW:    'preview',
  DONE:       'done',
}

export const MOODS     = ['さっぱりしたもの', 'ガッツリ食べたい', '体に優しいもの', '簡単に作れるもの', 'おしゃれな一品']
export const TIMES     = [
  { label: '15分以内', value: 15 },
  { label: '30分以内', value: 30 },
  { label: '60分以内', value: 60 },
  { label: '時間をかけてOK', value: null },
]
export const CATEGORIES = ['和食', '洋食', '中華', 'イタリアン', 'アジアン', '副菜', 'こだわらない']

export function useDiscover() {
  const [step,      setStep]      = useState(STEP.FILTER)
  const [mood,      setMood]      = useState('')
  const [maxTime,   setMaxTime]   = useState(null)
  const [category,  setCategory]  = useState('こだわらない')
  const [servings,  setServings]  = useState(2)
  const [results,   setResults]   = useState([])
  const [isMock,    setIsMock]    = useState(false)
  const [generated, setGenerated] = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [savedId,   setSavedId]   = useState(null)
  const [error,     setError]     = useState(null)
  const { notify } = useToast()

  const handleDiscover = useCallback(async () => {
    setStep(STEP.LOADING)
    setError(null)
    try {
      const res = await discoverRecipes({
        mood:     mood     || undefined,
        max_time: maxTime  || undefined,
        category: category === 'こだわらない' ? undefined : category,
      })
      // optional chaining で JSON クラッシュを防止
      setResults(res?.items ?? [])
      setIsMock(res?.is_mock ?? true)
      setStep(STEP.RESULTS)
    } catch (err) {
      const msg = getApiErrorMessage(err, '提案の取得に失敗しました。バックエンドが起動しているか確認してください。')
      setError(msg)
      notify(msg, 'error')
      setStep(STEP.FILTER)
    }
  }, [mood, maxTime, category, notify])

  const handleSelectItem = useCallback(async item => {
    setStep(STEP.GENERATING)
    setError(null)
    try {
      const res = await generateRecipe({ title: item?.title ?? '', servings })
      setGenerated(res)
      setStep(STEP.PREVIEW)
    } catch (err) {
      const msg = getApiErrorMessage(err, 'レシピの生成に失敗しました。')
      setError(msg)
      notify(msg, 'error')
      setStep(STEP.RESULTS)
    }
  }, [servings, notify])

  const handleSave = useCallback(async rating => {
    if (rating !== 'save') {
      setStep(STEP.FILTER)
      setGenerated(null)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        title:           generated?.title         ?? '',
        category:        generated?.category      ?? 'その他',
        description:     generated?.description   ?? '',
        base_servings:   generated?.base_servings ?? servings,
        prep_time:       generated?.prep_time     ?? 0,
        cook_time:       generated?.cook_time     ?? 0,
        is_ai_generated: true,
        ingredients:     generated?.ingredients   ?? [],
        steps:           generated?.steps         ?? [],
      }
      const saved = await createRecipe(payload)
      setSavedId(saved?.id)
      setStep(STEP.DONE)
    } catch {
      setError('保存に失敗しました。')
    } finally {
      setSaving(false)
    }
  }, [generated, servings])

  const reset = useCallback(() => {
    setStep(STEP.FILTER)
    setGenerated(null)
    setError(null)
    setSavedId(null)
  }, [])

  return {
    step, mood, setMood,
    maxTime, setMaxTime,
    category, setCategory,
    servings, setServings,
    results, isMock,
    generated, saving, savedId, error,
    handleDiscover, handleSelectItem, handleSave, reset,
  }
}
