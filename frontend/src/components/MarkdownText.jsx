import ReactMarkdown from 'react-markdown'

/**
 * components/MarkdownText.jsx — AI応答のMarkdown表示用ラッパー
 *
 * Gemini/OpenAIの生成テキストには **太字** や ### 見出し 等のMarkdown記法が
 * そのまま含まれることがあるため、react-markdownで整形して表示する。
 * チャット吹き出し・検索結果カードのようなコンパクトな領域での使用を想定し、
 * 各要素のデフォルトマージンを詰めた最小限のスタイルのみ当てている。
 */
export default function MarkdownText({ children, style }) {
    return (
        <div style={style}>
            <ReactMarkdown
                components={{
                    p: (p) => <p style={{ margin: '0 0 8px' }} {...p} />,
                    h1: (p) => <h1 style={{ fontSize: '1.15em', margin: '10px 0 6px' }} {...p} />,
                    h2: (p) => <h2 style={{ fontSize: '1.1em', margin: '10px 0 6px' }} {...p} />,
                    h3: (p) => <h3 style={{ fontSize: '1.05em', margin: '8px 0 4px' }} {...p} />,
                    ul: (p) => <ul style={{ margin: '4px 0 8px', paddingLeft: '1.3em' }} {...p} />,
                    ol: (p) => <ol style={{ margin: '4px 0 8px', paddingLeft: '1.3em' }} {...p} />,
                    li: (p) => <li style={{ margin: '2px 0' }} {...p} />,
                    strong: (p) => <strong style={{ fontWeight: 700 }} {...p} />,
                    code: (p) => <code style={{ background: 'var(--bg)', padding: '1px 4px', borderRadius: 4, fontSize: '0.92em' }} {...p} />,
                }}
            >
                {children ?? ''}
            </ReactMarkdown>
        </div>
    )
}
