import { useNavigate } from 'react-router-dom'
import { toggleFavorite, uploadImage } from '../api/recipeApi'

const CATEGORY_ICONS = {
  '和食':     'ti-bowl-chopsticks',
  '洋食':     'ti-meat',
  '中華':     'ti-noodles',
  'イタリアン':'ti-pizza',
  'アジアン':  'ti-bowl',
  '副菜':     'ti-salad',
  'default':  'ti-tools-kitchen-2',
}

export default function RecipeCard({ recipe, onUpdate, compact = false }) {
  const navigate = useNavigate()

  const handleFav = async (e) => {
    e.stopPropagation()
    const updated = await toggleFavorite(recipe.id)
    onUpdate?.(updated)
  }

  const handleUpload = async (e) => {
    e.stopPropagation()
    const file = e.target.files[0]; if (!file) return
    const updated = await uploadImage(recipe.id, file)
    onUpdate?.(updated)
  }

  const icon = CATEGORY_ICONS[recipe.category] || CATEGORY_ICONS.default
  const thumbSize = compact ? 52 : 68

  return (
    <div
      onClick={() => navigate(`/recipes/${recipe.id}`)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: compact ? 10 : 12,
        cursor: 'pointer',
        transition: 'box-shadow var(--t), transform var(--t)',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
    >
      {/* サムネイル */}
      <div style={{
        width: thumbSize, height: thumbSize,
        borderRadius: 'var(--radius-sm)', overflow: 'hidden',
        flexShrink: 0, position: 'relative',
      }}>
        {recipe.image_url
          ? <img src={recipe.image_url} alt={recipe.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{
              width: '100%', height: '100%', background: 'var(--gold-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className={`ti ${icon}`} style={{ fontSize: thumbSize * 0.45, color: 'var(--gold-dark)', opacity: .7 }} />
            </div>
        }
        {/* カメラオーバーレイ */}
        <label
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, cursor: 'pointer', transition: 'opacity var(--t)',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0}
        >
          <i className="ti ti-camera" style={{ color: '#fff', fontSize: 18 }} />
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
        </label>
      </div>

      {/* テキスト */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: compact ? 13 : 15, fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{recipe.title}</div>
        <div style={{
          fontSize: 12, color: 'var(--text-3)', marginTop: 3,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span><i className="ti ti-clock" style={{ fontSize: 11 }} /> {recipe.cook_time}分</span>
          <span><i className="ti ti-users" style={{ fontSize: 11 }} /> {recipe.base_servings}人前</span>
        </div>
        <span className={`cat-badge cat-${recipe.category}`} style={{ marginTop: 4 }}>
          {recipe.category}
        </span>
      </div>

      {/* お気に入り */}
      <button
        onClick={handleFav}
        style={{
          background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
          color: recipe.is_favorite ? '#E24B4A' : 'var(--text-3)',
          padding: 4, flexShrink: 0, transition: 'color var(--t)',
        }}
      >
        <i className={recipe.is_favorite ? 'ti ti-heart-filled' : 'ti ti-heart'} />
      </button>
    </div>
  )
}
