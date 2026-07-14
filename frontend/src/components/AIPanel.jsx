/**
 * components/AIPanel.jsx — AIアシスタントパネル
 *
 * RecipeDetailPage から切り出した独立コンポーネント。
 * useAIPanel hook から状態を受け取り、描画のみ担当する。
 */
import { useEffect, useRef } from 'react'
import MarkdownText from './MarkdownText'

const HINTS = ['時短テクニックは？', 'みりんの代用は？', '失敗しないコツは？']

export default function AIPanel({ messages, input, setInput, loading, error, send, onClose }) {
  const chatRef = useRef()

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div style={{
      position: 'fixed', bottom: 62, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430,
      background: 'var(--surface)', borderTop: '1px solid var(--border)',
      zIndex: 200, padding: '12px 16px', boxShadow: '0 -4px 20px rgba(0,0,0,.10)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold-dark)', display: 'flex', alignItems: 'center', gap: 5 }}>
          AI アシスタント
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: 'var(--text-3)', padding: '4px 8px',
        }}>閉じる ✕</button>
      </div>

      {/* クイックヒント */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {HINTS.map(h => (
          <button key={h} onClick={() => send(h)} style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 999,
            border: '1px solid var(--border)', background: 'var(--bg)',
            color: 'var(--text-2)', cursor: 'pointer',
          }}>{h}</button>
        ))}
      </div>

      {/* チャット履歴 */}
      <div ref={chatRef} style={{
        maxHeight: 130, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8,
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            padding: '7px 11px', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
            maxWidth: '88%',
            background: m.role === 'bot' ? 'var(--bg)' : 'var(--blue)',
            color: m.role === 'bot' ? 'var(--text-1)' : '#fff',
            alignSelf: m.role === 'bot' ? 'flex-start' : 'flex-end',
          }}>
            {m.role === 'bot'
              ? <MarkdownText style={{ fontSize: 13, lineHeight: 1.6 }}>{m.text ?? ''}</MarkdownText>
              : <span style={{ whiteSpace: 'pre-wrap' }}>{m.text ?? ''}</span>}
          </div>
        ))}
        {loading && (
          <div style={{ padding: '7px 11px', borderRadius: 10, background: 'var(--bg)', fontSize: 13, color: 'var(--text-3)' }}>
            回答中…
          </div>
        )}
        {error && (
          <div style={{ padding: '7px 11px', borderRadius: 10, background: '#fef2f2', color: '#b91c1c', fontSize: 12 }}>
            {error}
          </div>
        )}
      </div>

      {/* 入力欄 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="質問を入力…"
          style={{
            flex: 1, padding: '8px 11px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', fontSize: 13,
            background: 'var(--bg)', color: 'var(--text-1)', outline: 'none',
          }}
        />
        <button onClick={() => send()} style={{
          padding: '8px 14px', background: 'var(--blue)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer',
        }}>送信</button>
      </div>
    </div>
  )
}
