import graphene
from graphene import relay

from ....product import models
from ...account import types as account_types
from ...core.types import ModelObjectType
from ...core.context import ChannelContext
from ...core.fields import PermissionsField
from ...core.scalars import DateTime
from ...core.doc_category import DOC_CATEGORY_PRODUCTS
from ....core.utils import build_absolute_uri


class ProductReview(ModelObjectType[models.ProductReview]):
    id = graphene.GlobalID(required=True, description="ID отзыва.")
    product = graphene.Field(
        "saleor.graphql.product.types.products.Product",
        description="Товар, на который оставлен отзыв.",
    )
    user = graphene.Field(
        account_types.User,
        description="Пользователь, который оставил отзыв.",
    )
    rating = graphene.Int(
        required=True,
        description="Рейтинг от 1 до 5 звезд.",
    )
    text = graphene.String(
        required=True,
        description="Текст отзыва.",
    )
    image_1 = graphene.String(description="Первое изображение отзыва.")
    image_2 = graphene.String(description="Второе изображение отзыва.")
    is_published = graphene.Boolean(
        required=True,
        description="Опубликован ли отзыв (после модерации).",
    )
    created_at = DateTime(
        required=True,
        description="Дата и время создания отзыва.",
    )
    moderated_by = graphene.Field(
        account_types.User,
        description="Оператор, который отмодерировал отзыв.",
    )
    moderated_at = DateTime(description="Дата и время модерации.")

    class Meta:
        description = "Отзыв на товар."
        model = models.ProductReview
        interfaces = [relay.Node]

    @staticmethod
    def resolve_image_1(root: models.ProductReview, _info):
        if root.image_1:
            return build_absolute_uri(root.image_1.url)
        return None

    @staticmethod
    def resolve_image_2(root: models.ProductReview, _info):
        if root.image_2:
            return build_absolute_uri(root.image_2.url)
        return None

    @staticmethod
    def resolve_product(root: models.ProductReview, info):
        # Product использует ChannelContextType, поэтому нужно обернуть в ChannelContext
        # Используем None для channel_slug - дефолтный канал будет использован автоматически
        return ChannelContext(node=root.product, channel_slug=None)

    @staticmethod
    def resolve_user(root: models.ProductReview, _info):
        return root.user

    @staticmethod
    def resolve_moderated_by(root: models.ProductReview, _info):
        return root.moderated_by

