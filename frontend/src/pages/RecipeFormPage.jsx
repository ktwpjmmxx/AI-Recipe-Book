import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchRecipe, createRecipe, updateRecipe, uploadImage } from '../api/recipeApi'
import '../global.css'

const CATEGORIES      = ['和食', '洋食', '中華', 'イタリアン', 'アジアン', '副菜', 'その他']
const SERVING_OPTIONS = [0.5, 1, 2, 3, 4, 6]
const UNITS           = ['g', 'kg', 'ml', 'l', '個', '枚', '本', '束', '切れ', '片', '缶', '袋']
const TEXT_SUGGESTIONS = [
  '大さじ1', '大さじ2', '大さじ3', '大さじ1/2', '大さじ2〜3',
  '小さじ1', '小さじ2', '小さじ1/2', '適量', '少々', 'ひとつまみ', 'お好みで',
]

const emptyIng  = () => ({ name: '', mode: 'num', amount: '', unit: 'g', amount_text: '' })
const emptyStep = (n) => ({ order: n, description: '', tip: '' })

// ── セクションラッパー ──
function Section({ title, badge, children }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{
        background: 'var(--gold-light)', borderBottom: '1px solid #E8D080',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold-dark)' }}>{title}</span>
        {badge}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  )
}

// ── 材料1行コンポーネント ──
function IngredientRow({ ing, index, onChange, onRemove, isOnly }) {
  const set = (key, val) => onChange(index, { ...ing, [key]: val })

  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 8,
    }}>
      {/* 1行目：食材名 ＋ モード切替 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input
          className="field-input"
          placeholder="食材名（例：醤油）"
          value={ing.name}
          onChange={e => set('name', e.target.value)}
          style={{ flex: 1, background: 'var(--surface)' }}
        />
        {/* モード切替トグル */}
        <div style={{
          display: 'flex', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0,
          background: 'var(--surface)',
        }}>
          {[{ key: 'num', label: '数値' }, { key: 'text', label: '文字' }].map(opt => (
            <button key={opt.key} onClick={() => set('mode', opt.key)} style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: ing.mode === opt.key ? 'var(--blue)' : 'transparent',
              color:      ing.mode === opt.key ? '#fff'        : 'var(--text-3)',
              transition: 'all var(--t)',
            }}>{opt.label}</button>
          ))}
        </div>
      </div>

      {/* 2行目：数値モード */}
      {ing.mode === 'num' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0, width: 24 }}>量</span>
          <input
            className="field-input"
            type="number"
            placeholder="例：200"
            value={ing.amount}
            onChange={e => set('amount', e.target.value)}
            style={{ width: 90, flex: 'none', textAlign: 'right', background: 'var(--surface)' }}
          />
          <select
            className="field-input"
            value={ing.unit}
            onChange={e => set('unit', e.target.value)}
            style={{ flex: 1, background: 'var(--surface)' }}
          >
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <span style={{
            fontSize: 10, color: 'var(--blue)', background: 'var(--blue-light)',
            padding: '3px 7px', borderRadius: 4, flexShrink: 0, fontWeight: 500,
          }}>↕ 換算あり</span>
        </div>
      )}

      {/* 2行目：テキストモード */}
      {ing.mode === 'text' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0, width: 24 }}>量</span>
          <input
            list={`sug-${index}`}
            className="field-input"
            placeholder="例：大さじ1、適量"
            value={ing.amount_text}
            onChange={e => set('amount_text', e.target.value)}
            style={{ flex: 1, background: 'var(--surface)' }}
          />
          <datalist id={`sug-${index}`}>
            {TEXT_SUGGESTIONS.map(u => <option key={u} value={u} />)}
          </datalist>
          <span style={{
            fontSize: 10, color: 'var(--gold-dark)', background: 'var(--gold-light)',
            padding: '3px 7px', borderRadius: 4, flexShrink: 0, fontWeight: 500,
            border: '1px solid #E8D080',
          }}>固定表示</span>
        </div>
      )}

      {/* 削除ボタン（テキスト付き・右寄せ） */}
      {!isOnly && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            onClick={() => onRemove(index)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 'var(--radius-sm)',
              background: '#fef2f2', border: '1px solid #fecaca',
              color: '#b91c1c', fontSize: 12, cursor: 'pointer',
            }}
          >
            🗑 この材料を削除
          </button>
        </div>
      )}
    </div>
  )
}

export default function RecipeFormPage() {
  const navigate = useNavigate()
  const { id }   = useParams()
  const isEdit   = Boolean(id)

  const [form, setForm] = useState({
    title: '', category: '和食', description: '',
    base_servings: 2, prep_time: 10, cook_time: 30,
    ingredients: [emptyIng()],
    steps: [emptyStep(1)],
  })
  const [imageFile, setImageFile] = useState(null)
  const [preview,   setPreview]   = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    if (!isEdit) return
    fetchRecipe(id).then(r => {
      setForm({
        title:         r.title,
        category:      r.category,
        description:   r.description,
        base_servings: r.base_servings,
        prep_time:     r.prep_time,
        cook_time:     r.cook_time,
        ingredients: r.ingredients.length
          ? r.ingredients.map(ing => ({
              name:        ing.name,
              mode:        ing.amount_text ? 'text' : 'num',
              amount:      ing.amount != null ? String(ing.amount) : '',
              unit:        ing.unit || 'g',
              amount_text: ing.amount_text || '',
            }))
          : [emptyIng()],
        steps: r.steps.length
          ? r.steps.map(s => ({ ...s, tip: s.tip || '' }))
          : [emptyStep(1)],
      })
      if (r.image_url) setPreview(r.image_url)
    }).catch(() => setError('レシピの取得に失敗しました'))
  }, [id, isEdit])

  const set    = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const setIng = (i, updated) =>
    setForm(f => { const a = [...f.ingredients]; a[i] = updated; return { ...f, ingredients: a } })
  const addIng    = ()  => setForm(f => ({ ...f, ingredients: [...f.ingredients, emptyIng()] }))
  const removeIng = (i) => setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, j) => j !== i) }))
  const setStep = (i, key, val) =>
    setForm(f => { const a = [...f.steps]; a[i] = { ...a[i], [key]: val }; return { ...f, steps: a } })
  const addStep    = ()  => setForm(f => ({ ...f, steps: [...f.steps, emptyStep(f.steps.length + 1)] }))
  const removeStep = (i) => setForm(f => ({
    ...f,
    steps: f.steps.filter((_, j) => j !== i).map((s, idx) => ({ ...s, order: idx + 1 }))
  }))

  const handlePhoto = (e) => {
    const file = e.target.files[0]; if (!file) return
    setImageFile(file); setPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) return setError('料理名を入力してください')
    setSaving(true); setError('')
    try {
      const payload = {
        title:         form.title,
        category:      form.category,
        description:   form.description,
        base_servings: parseFloat(form.base_servings),
        prep_time:     parseInt(form.prep_time) || 0,
        cook_time:     parseInt(form.cook_time) || 0,
        ingredients: form.ingredients.filter(i => i.name.trim()).map(i =>
          i.mode === 'text'
            ? { name: i.name, amount: null, unit: '', amount_text: i.amount_text || null }
            : { name: i.name, amount: parseFloat(i.amount) || 0, unit: i.unit, amount_text: null }
        ),
        steps: form.steps.filter(s => s.description.trim()).map(s => ({
          order: s.order, description: s.description, tip: s.tip || null,
        })),
      }
      const saved = isEdit ? await updateRecipe(id, payload) : await createRecipe(payload)
      if (imageFile) await uploadImage(saved.id, imageFile)
      navigate(`/recipes/${saved.id}`)
    } catch {
      setError('保存に失敗しました。入力内容を確認してください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* ヘッダー */}
      <div className="topbar">
        <div className="topbar-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate(-1)} style={{
              background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)',
              borderRadius: 'var(--radius-sm)', padding: '6px 12px',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>← 戻る</button>
            <span className="topbar-title">{isEdit ? 'レシピを編集' : '新しいレシピ'}</span>
          </div>
          <button onClick={handleSubmit} disabled={saving} style={{
            padding: '7px 18px', background: saving ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.25)',
            border: '1px solid rgba(255,255,255,.5)',
            borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600,
            color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? '保存中…' : '保存'}</button>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {error && <div className="error-banner">{error}</div>}
      </div>

      {/* 基本情報 */}
      <div style={{ padding: '0 16px' }}>
        <Section title="📋 基本情報">
          <div className="field">
            <label className="field-label">料理名 *</label>
            <input className="field-input" value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="例：豚の角煮" />
          </div>

          <div className="field">
            <label className="field-label">カテゴリ</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => set('category', cat)} style={{
                  padding: '6px 14px', borderRadius: 999, fontSize: 13, border: '1px solid',
                  borderColor: form.category === cat ? 'var(--blue)' : 'var(--border)',
                  background:  form.category === cat ? 'var(--blue)' : 'var(--surface)',
                  color:       form.category === cat ? '#fff' : 'var(--text-2)',
                  cursor: 'pointer',
                }}>{cat}</button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label">メモ・説明（任意）</label>
            <textarea className="field-input" value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="料理の紹介や作るコツを一言で" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div className="field">
              <label className="field-label">基準の人数</label>
              <select className="field-input" value={form.base_servings}
                onChange={e => set('base_servings', parseFloat(e.target.value))}>
                {SERVING_OPTIONS.map(s => <option key={s} value={s}>{s}人前</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">下準備（分）</label>
              <input className="field-input" type="number" min="0"
                value={form.prep_time} onChange={e => set('prep_time', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">調理時間（分）</label>
              <input className="field-input" type="number" min="0"
                value={form.cook_time} onChange={e => set('cook_time', e.target.value)} />
            </div>
          </div>
        </Section>

        {/* 写真 */}
        <Section title="📷 料理写真（任意）">
          <label style={{
            display: 'block', border: '1.5px dashed var(--border)',
            borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer',
          }}>
            {preview ? (
              <div style={{ position: 'relative' }}>
                <img src={preview} alt="プレビュー"
                  style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                <div style={{
                  position: 'absolute', bottom: 8, right: 8,
                  background: 'rgba(0,0,0,.5)', color: '#fff',
                  padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12,
                }}>📷 写真を変更</div>
              </div>
            ) : (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-3)' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                <p style={{ fontSize: 13 }}>タップして写真を追加</p>
                <p style={{ fontSize: 11, marginTop: 4 }}>jpg / png / webp 対応</p>
              </div>
            )}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
          </label>
        </Section>

        {/* 材料 */}
        <Section
          title="🥕 材料"
          badge={
            <div style={{ display: 'flex', gap: 6, fontSize: 10 }}>
              <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '2px 7px', borderRadius: 4, fontWeight: 500 }}>
                数値 = 人数換算あり
              </span>
              <span style={{ background: 'var(--surface)', color: 'var(--gold-dark)', padding: '2px 7px', borderRadius: 4, border: '1px solid #E8D080', fontWeight: 500 }}>
                文字 = 固定表示
              </span>
            </div>
          }
        >
          {form.ingredients.map((ing, i) => (
            <IngredientRow
              key={i}
              ing={ing}
              index={i}
              onChange={setIng}
              onRemove={removeIng}
              isOnly={form.ingredients.length === 1}
            />
          ))}
          <button onClick={addIng} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--blue)', background: 'none', border: 'none',
            fontSize: 13, cursor: 'pointer', padding: '6px 0', fontWeight: 500,
          }}>
            ＋ 材料を追加
          </button>
        </Section>

        {/* 手順 */}
        <Section title="📝 作り方の手順">
          {form.steps.map((step, i) => (
            <div key={i} style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--blue)', color: '#fff',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{i + 1}</div>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>工程 {i + 1}</span>
              </div>
              <textarea
                className="field-input"
                placeholder={`工程 ${i + 1} の説明を入力`}
                value={step.description}
                onChange={e => setStep(i, 'description', e.target.value)}
                style={{ minHeight: 72, marginBottom: 8, background: 'var(--surface)' }}
              />
              <input
                className="field-input"
                placeholder="💡 ポイント・ヒント（任意）"
                value={step.tip}
                onChange={e => setStep(i, 'tip', e.target.value)}
                style={{ background: 'var(--surface)' }}
              />
              {form.steps.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button onClick={() => removeStep(i)} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                    background: '#fef2f2', border: '1px solid #fecaca',
                    color: '#b91c1c', fontSize: 12, cursor: 'pointer',
                  }}>🗑 この工程を削除</button>
                </div>
              )}
            </div>
          ))}
          <button onClick={addStep} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--blue)', background: 'none', border: 'none',
            fontSize: 13, cursor: 'pointer', padding: '6px 0', fontWeight: 500,
          }}>
            ＋ 工程を追加
          </button>
        </Section>

        {/* 保存・キャンセル */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => navigate(-1)}>
            キャンセル
          </button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSubmit} disabled={saving}>
            {saving ? '保存中…' : isEdit ? '変更を保存' : 'レシピを登録'}
          </button>
        </div>
      </div>
    </div>
  )
}
