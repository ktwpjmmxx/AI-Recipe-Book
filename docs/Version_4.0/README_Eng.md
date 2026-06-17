# MyRecipeBook

Personal recipe management web application with AI-powered recipe discovery, shopping list generation, and intelligent meal suggestions.

Built as a full-stack learning project covering production-grade architecture, AI integration, and mobile-first UX design.

---

## Overview

MyRecipeBook lets users save, manage, and discover recipes through a clean mobile-first interface. In the latest architectural revision, the codebase has been refactored from a monolithic single-file structure into a layered, production-ready system designed to scale.

**Design theme:** Honey Gold — a warm amber header palette chosen to evoke the comfort of home cooking, with blue interactive elements for clear affordance contrast.

**Target platform:** Mobile-first web (430px max-width layout). Designed with a future React Native or PWA migration in mind from day one.

---

## Screenshots

### Home — AI Recommendation Feed

The home screen surfaces time- and season-aware recipe suggestions drawn from the user's own library, alongside a prominent entry point to the AI consultation flow.

<img src="screenshots/01_home.png" width="320" alt="Home">

### AI Recipe Discovery

Users specify mood, time budget, and category. The AI proposes 3–5 dishes and generates full recipes on demand — ingredients, steps, and tips.

| Filter settings | AI suggestion results |
|:---:|:---:|
| <img src="screenshots/02_discover_filter.png" height="450" alt="Discover filter"> | <img src="screenshots/03_discover_results.png" height="450" alt="Discover results"> |

### Recipe Detail — Serving Scale and Step Check

The serving stepper allows for instant, real-time calculation of ingredient quantities. Ingredients registered as text (e.g., "1 tbsp") are identified as "fixed" and remain unaffected. This specification is implemented as a unified domain logic shared by both the backend and frontend.

<img src="screenshots/04_detail.png" width="320" alt="Recipe Detail">

### Shopping List — Pantry Deduction

Generate a shopping list based on the recipe's current serving size. Input your current pantry stock to automatically calculate the remaining quantity required.

| Pantry input | Shopping list |
|:---:|:---:|
| <img src="screenshots/05_shopping_deduct.png" height="450" alt="Pantry input"> | <img src="screenshots/06_shopping_list.png" height="450" alt="Shopping list"> |

---

## Architecture

### System Diagram

```
Browser / Mobile
      │
      │  HTTP REST  (Axios · timeout: 30s)
      ▼
┌─────────────────────────────────────────────────┐
│  React + Vite  (:5173)                          │
│                                                 │
│  pages/          — JSX rendering only           │
│  hooks/          — state, API calls             │
│  components/     — reusable UI units            │
│  api/recipeApi   — Axios client                 │
└───────────────────┬─────────────────────────────┘
                    │  /api/*  proxy
                    ▼
┌─────────────────────────────────────────────────┐
│  FastAPI  (:8000)                               │
│                                                 │
│  routers/        — HTTP endpoints, validation   │
│      └── schemas.py  (Pydantic)                 │
│  services/       — business logic               │
│      └── ai/     — LLM orchestration            │
│          ├── base.py      (abstract interface)  │
│          ├── factory.py   (provider selection)  │
│          ├── openai_client.py                   │
│          └── mock_client.py                     │
│  repositories/   — data access                  │
│      ├── recipe_repository.py   (SQLAlchemy)    │
│      ├── shopping_repository.py                 │
│      └── vector_repository.py  (ChromaDB)       │
│  models.py       — ORM table definitions        │
│  config.py       — env vars (pydantic-settings) │
│  database.py     — engine / session factory     │
└────────────┬──────────────┬─────────────────────┘
             │              │
             ▼              ▼
      SQLite / PG       ChromaDB
      (recipes,         (vector index
       shopping_lists)   for RAG)
             │
             ▼
      OpenAI / Anthropic / Mock
      (selected via LLM_PROVIDER env var)
```

### Layered Architecture (Backend)

The previous version placed all routing, business logic, AI orchestration, and database access inside a single `main.py` file (~600 lines). This has been split into four distinct layers.

| Layer | Directory | Responsibility |
|---|---|---|
| Router | `routers/` | Accept HTTP requests, validate via Pydantic, return responses |
| Service | `services/` | Business rules: serving ratio calculation, ingredient text formatting |
| AI Orchestration | `services/ai/` | Prompt construction, LLM calls, error handling, fallback to mock |
| Repository | `repositories/` | All database and vector store access |

Each layer depends only on the layer below it. Routers never touch the database directly; services never construct HTTP responses.

### Custom Hooks Pattern (Frontend)

Page components previously contained large blocks of `useState`, inline `axios` calls, and embedded sub-components. These have been separated.

| Before | After |
|---|---|
| `DiscoverPage.jsx` ~450 lines | `DiscoverPage.jsx` ~180 lines (rendering only) |
| `RecipeDetailPage.jsx` ~380 lines | `RecipeDetailPage.jsx` ~200 lines (rendering only) |
| `SuggestionCard` defined inline | `components/SuggestionCard.jsx` (independent file) |
| `AIPanel` defined inline | `components/AIPanel.jsx` (independent file) |
| No separation of concerns | `hooks/useDiscover.js`, `hooks/useRecipeDetail.js` |

---

## Key Engineering Decisions

### LLM Provider Abstraction (Factory Pattern)

Switching AI providers requires changing one environment variable. No application code changes.

```
LLM_PROVIDER=openai     → OpenAIClient   (GPT-4o-mini)
LLM_PROVIDER=anthropic  → AnthropicClient (Claude) — interface ready, implementation pending
LLM_PROVIDER=mock       → MockLLMClient  (no API key required)
```

The abstract base class `LLMClient` defines three methods — `discover()`, `generate_recipe()`, and `assist()` — that every provider must implement. Adding a new provider is a matter of writing one new file that inherits from `LLMClient` and registering it in `factory.py`.

```python
# Adding a new provider requires changes in exactly one place
# services/ai/factory.py

if provider == "anthropic":
    from services.ai.anthropic_client import AnthropicClient
    return AnthropicClient()
```

### Repository Pattern (Database Abstraction)

All SQLAlchemy queries are encapsulated in repository classes. The rest of the application never imports `Session` or constructs SQL. This means:

- Swapping SQLite for PostgreSQL requires changing `DATABASE_URL` only
- Business logic can be tested without a real database connection by substituting a mock repository

### Serving Scale Logic as Shared Domain Knowledge

The ingredient display logic — numeric amounts scale with the serving ratio; text-mode amounts (e.g. "2 tablespoons") are shown as-is — is implemented in both `services/recipe_service.py` (Python) and `hooks/useRecipeDetail.js` (JavaScript) using identical specifications.

This ensures that any future backend feature that produces ingredient lists (PDF export, shopping list aggregation, meal plan generation) produces results consistent with what the UI displays.

### Resilient AI Communication

| Risk | Mitigation |
|---|---|
| AI response takes too long | Axios `timeout: 30000`. On timeout, UI shows a readable error message rather than hanging |
| LLM returns malformed JSON | `optional chaining (?.)` throughout all AI response consumers — no `TypeError` crashes |
| LLM API is unavailable | `AIService` catches all exceptions and falls back to `MockLLMClient` automatically |
| File upload fills memory | Image writes use `file.read(65536)` chunked streaming — the full file is never loaded into memory |

### BackgroundTasks for Vector Indexing

ChromaDB writes are dispatched as FastAPI `BackgroundTasks`. The HTTP response is returned to the client immediately; vector indexing happens after, without blocking the request thread.

```python
@router.post("")
def create_recipe(body: RecipeCreate, background_tasks: BackgroundTasks, ...):
    recipe = repo.create(data)
    background_tasks.add_task(upsert_recipe, recipe)   # non-blocking
    return _to_out(recipe)
```

---

## Tech Stack

### Frontend

| Technology | Version | Role |
|---|---|---|
| React | 18.3 | Component model, state management |
| React Router | v6 | Client-side routing (SPA) |
| Vite | 5.4 | Dev server, build, API proxy |
| Axios | 1.7 | HTTP client (timeout, interceptors) |

### Backend

| Technology | Version | Role |
|---|---|---|
| FastAPI | 0.115 | REST API, automatic OpenAPI docs |
| SQLAlchemy | 2.0 | ORM, database abstraction |
| Pydantic v2 | 2.x | Request/response validation |
| pydantic-settings | 2.x | Typed environment variable management |
| SQLite | — | Default database (PostgreSQL-ready) |

### AI

| Technology | Role |
|---|---|
| ChromaDB | Vector store for semantic search (RAG foundation) |
| OpenAI API | GPT-4o-mini for recipe generation, discovery, Q&A |

---

## Directory Structure

```
myrecipebook/
├── backend/
│   ├── main.py                    # App factory — routes only, no logic
│   ├── config.py                  # All env vars in one place
│   ├── database.py                # Engine and session factory
│   ├── models.py                  # SQLAlchemy ORM definitions
│   ├── requirements.txt
│   ├── .env.example
│   ├── recipes.db                 # SQLite (auto-created on first run)
│   ├── uploads/                   # Uploaded images
│   ├── repositories/
│   │   ├── recipe_repository.py
│   │   ├── shopping_repository.py
│   │   └── vector_repository.py
│   ├── services/
│   │   ├── recipe_service.py      # Serving scale logic, ingredient formatting
│   │   ├── ai_service.py          # AI orchestration with fallback
│   │   └── ai/
│   │       ├── base.py            # LLMClient abstract interface
│   │       ├── factory.py         # Provider selection via env var
│   │       ├── openai_client.py   # OpenAI implementation
│   │       └── mock_client.py     # Mock implementation (no key needed)
│   └── routers/
│       ├── schemas.py             # All Pydantic request/response models
│       ├── recipes.py
│       ├── shopping_lists.py
│       ├── ai.py
│       └── misc.py
│
└── frontend/
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── global.css             # CSS variables, Honey Gold theme
        ├── api/
        │   └── recipeApi.js       # Axios client (timeout, interceptors)
        ├── hooks/
        │   ├── useRecipes.js      # Recipe list state and API
        │   ├── useRecipeDetail.js # Detail state, serving scale, step tracking
        │   └── useDiscover.js     # AI discovery flow state machine
        ├── components/
        │   ├── BottomNav.jsx      # Navigation bar + FAB
        │   ├── RecipeCard.jsx     # Card with inline image upload
        │   ├── SuggestionCard.jsx # AI suggestion card (extracted)
        │   └── AIPanel.jsx        # AI chat panel (extracted)
        └── pages/
            ├── HomePage.jsx
            ├── LibraryPage.jsx
            ├── FavoritesPage.jsx
            ├── DiscoverPage.jsx
            ├── ShoppingListPage.jsx
            ├── SavedShoppingListPage.jsx
            ├── RecipeDetailPage.jsx
            └── RecipeFormPage.jsx
```

---

## Local Setup

### Requirements

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
```

### Environment Variables

Copy `backend/.env.example` to `backend/.env`:

```env
# LLM provider: openai | anthropic | mock (default)
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini

# Required when LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Database (default: SQLite)
# DATABASE_URL=postgresql://user:pass@localhost:5432/myrecipebook
```

All features operate without an API key. When `LLM_PROVIDER=mock`, the application returns structured placeholder data so the full UI flow can be verified locally.

---

## API Reference

### Recipes

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/recipes` | List with category filter, sort, favorites flag |
| `GET` | `/api/recipes/{id}` | Single recipe |
| `POST` | `/api/recipes` | Create |
| `PATCH` | `/api/recipes/{id}` | Partial update |
| `DELETE` | `/api/recipes/{id}` | Delete (also removes vector index) |
| `POST` | `/api/recipes/{id}/image` | Streaming image upload |
| `PATCH` | `/api/recipes/{id}/favorite` | Toggle favorite |
| `POST` | `/api/recipes/{id}/ai-assist` | AI Q&A for a specific recipe |

### Shopping Lists

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/shopping-lists` | Save a generated list |
| `GET` | `/api/shopping-lists` | All saved lists (newest first) |
| `GET` | `/api/shopping-lists/{id}` | Single list |
| `PATCH` | `/api/shopping-lists/{id}/items` | Update checked state |
| `DELETE` | `/api/shopping-lists/{id}` | Delete |

### AI

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/ai/discover` | Propose 3–5 dishes based on mood/time/category |
| `POST` | `/api/ai/generate-recipe` | Generate full recipe from dish name |
| `POST` | `/api/ai/suggest-menu` | Suggest a menu from saved library |

### Utility

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/categories` | Distinct categories present in library |
| `GET` | `/health` | Health check including active LLM provider |

---

## Feature Summary

| Feature | Description |
|---|---|
| Recipe management | Create, edit, delete with photo upload |
| Category badges | Color-coded by cuisine type |
| Serving scaler | Stepper recalculates numeric amounts in real time |
| Hybrid ingredient input | Numeric (scalable) or free-text (fixed) per ingredient |
| Step tracker | Tap steps to mark complete; progress bar updates |
| Library | 4-axis sort (date / genre / kana / cook time) + search |
| Favorites | Heart toggle, dedicated tab |
| AI Q&A | Ask questions about any saved recipe |
| AI discovery | Mood/time/category filter → dish proposals → full recipe generation |
| AI home feed | Time- and season-weighted suggestions from personal library |
| Shopping list | Pantry deduction, checklist, persistent save |
| Mobile-first UI | Bottom nav + FAB, 430px layout, designed for PWA/React Native migration |

---

## Roadmap

### Phase 2 — Online and Social

- Recipe sharing via unique ID (e.g. `/r/00142`)
- Browse and fork other users' recipes
- PWA build with offline support
- Cooking log with AI feedback on dietary variety

### Phase 3 — Full RAG Integration

The current ChromaDB setup is the foundation. Phase 3 activates it:

- "What can I make with these ingredients?" query against the vector index
- Substitute ingredient suggestions ("I have no mirin") via semantic retrieval
- Nutrition analysis over cooking log history
- User-cluster trending on the home feed

The layered backend architecture means none of Phase 3 requires changes to the router or model layers — new capabilities are added as service classes only.

---

## About

Personal full-stack project. Learning objectives: production-grade API design, AI integration patterns, mobile-first UX, and the practical tradeoffs between architectural purity and development velocity.

Questions, feedback, and collaboration proposals welcome via Issues or Discussions.

---

## License

MIT License — see [LICENSE](LICENSE) for details.
