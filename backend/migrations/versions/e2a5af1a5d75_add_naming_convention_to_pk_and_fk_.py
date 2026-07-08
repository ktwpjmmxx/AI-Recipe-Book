"""add naming convention to pk and fk constraints

Revision ID: e2a5af1a5d75
Revises: decaefdba359
Create Date: 2026-07-07 07:08:41.225338

【このマイグレーションについて】
models.py の Base.metadata に naming_convention を追加したことに伴う対応。

背景:
  Alembic導入以前（v4.7以前）のSQLite上のテーブルは、PRIMARY KEY /
  FOREIGN KEY 制約が無名のまま作られていた（例: `FOREIGN KEY(user_id)
  REFERENCES users (id)` に制約名が付かない）。この状態のままだと、
  将来 Alembic の autogenerate がこれらの制約を変更・削除する必要が
  生じた際に、安定した名前で参照できず、意図しない diff や
  downgrade不可のマイグレーションを生む恐れがあった。

やっていること:
  autogenerate はテーブル構造（列やインデックス）の差分検出はできるが、
  「制約の名前だけが変わった」という差分は検出できないため、
  このリビジョンは手書きで用意している。
  SQLiteはALTER TABLEで制約名を直接変更できないため、
  batch mode の recreate="always" を使い、models.py で定義した
  naming_convention に基づいてテーブルを安全に作り直す
  （データはAlembicが自動的にコピーする。列定義・データ内容は一切変更しない）。

  マイグレーションファイルはアプリ本体のコード変更に追従して壊れないよう、
  models.py をimportせず naming_convention をこの中に複製している
  （Alembicのベストプラクティス: マイグレーションは自己完結させる）。

対象外:
  users.email / recipes.share_id の UNIQUE 制約は、column(unique=True,
  index=True) の組み合わせによって元々 ix_users_email 等の名前付き
  UNIQUE INDEX として作成されており、無名の問題は発生していなかった
  ため本マイグレーションでは触れていない。
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e2a5af1a5d75'
down_revision: Union[str, Sequence[str], None] = 'decaefdba359'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# models.py の NAMING_CONVENTION と同一内容を維持すること
# (このマイグレーションが将来のmodels.py変更の影響を受けないよう、あえて複製している)
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# 依存関係の都合上、FK先のテーブルより先に再作成すると一時的に参照エラーになりうるため、
# 参照される側 (users) → 参照する側 (recipes) → さらにその先 (shopping_lists) の順で実行する
_TABLES_IN_DEPENDENCY_ORDER = ["users", "recipes", "shopping_lists"]


def upgrade() -> None:
    """Upgrade schema."""
    for table_name in _TABLES_IN_DEPENDENCY_ORDER:
        with op.batch_alter_table(
            table_name,
            naming_convention=NAMING_CONVENTION,
            recreate="always",
        ):
            pass


def downgrade() -> None:
    """Downgrade schema.

    制約名を無名の状態に戻す明確な方法はSQLite上には存在しないため
    （そもそも「無名」は名前の欠如であり、意図的に再現する意味が薄い）、
    downgradeは意図的にno-opとしている。制約に名前が付いていること自体は
    データや挙動に一切影響しないため、downgrade非対応によるリスクはない。
    """
    pass
