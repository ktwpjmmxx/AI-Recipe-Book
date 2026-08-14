import json
from database import SessionLocal
from models import RecipeORM
from repositories.vector_repository import upsert_recipe

db = SessionLocal()

# 既存レシピと同じuser_idを踏襲する（整合性のため）
existing = db.query(RecipeORM).first()
target_user_id = existing.user_id if existing else None

with open("recipe.json", "r", encoding="utf-8") as f:
    new_recipes = json.load(f)

for data in new_recipes:
    recipe = RecipeORM(
        user_id=target_user_id,
        title=data["title"],
        category=data["category"],
        description=data["description"],
        base_servings=data["base_servings"],
        prep_time=data["prep_time"],
        cook_time=data["cook_time"],
        is_ai_generated=True,
        ingredients=data["ingredients"],
        steps=data["steps"],
    )
    db.add(recipe)
    db.commit()
    db.refresh(recipe)

    # DB登録と同時にChromaDBへも反映（APIエンドポイントと同じ処理を手動で実行）
    upsert_recipe(recipe)
    print(f"登録完了: id={recipe.id}, title={recipe.title}")

db.close()
print("\n全件登録が完了しました。")