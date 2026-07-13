import { useState, useCallback } from 'react'
import { searchAssist, getApiErrorMessage } from '../api/recipeApi'
import { useToast } from '../context/ToastContext'

/**
 * hooks/useAISearch.js — AI検索（RAGライブラリ横断質問応答）
 *
 * フェーズ3で新規実装。POST /api/ai/search-assist を呼び出す。
 * useDiscover.js と同じ「ページからロジックを分離する」パターンを踏襲。
 */
export function useAISearch() {
  const [question, setQuestion] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [answer,   setAnswer]   = useState(null)
  const [isMock,   setIsMock]   = useState(false)
  const [references, setReferences] = useState([])
  const [hasSearched, setHasSearched] = useState(false)
  const { notify } = useToast()

  const ask = useCallback(async () => {
    const q = question.trim()
    if (!q || loading) return
    setLoading(true)
    try {
      const res = await searchAssist(q)
      setAnswer(res?.answer ?? '')
      setIsMock(!!res?.is_mock)
      setReferences(res?.references ?? [])
      setHasSearched(true)
      if (res?.is_mock) {
        notify('現在、AI検索はモック応答で動作しています（実際のAI呼び出しに失敗、または未設定です）。', 'info')
      }
    } catch (err) {
      notify(getApiErrorMessage(err, 'AI検索に失敗しました。しばらくしてから再度お試しください。'), 'error')
    } finally {
      setLoading(false)
    }
  }, [question, loading, notify])

  const reset = useCallback(() => {
    setQuestion('')
    setAnswer(null)
    setIsMock(false)
    setReferences([])
    setHasSearched(false)
  }, [])

  return { question, setQuestion, loading, answer, isMock, references, hasSearched, ask, reset }
}
