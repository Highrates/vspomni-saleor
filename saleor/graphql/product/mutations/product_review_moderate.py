import graphene
from django.core.exceptions import ValidationError
from django.utils import timezone

from ...core import ResolveInfo
from ...core.doc_category import DOC_CATEGORY_PRODUCTS
from ...core.mutations import BaseMutation
from ....core.tracing import traced_atomic_transaction
from ...core.types import ProductError
from ...core.utils import from_global_id_or_error
from ....permission.enums import ProductPermissions
from ....product import models as product_models
from ....product.error_codes import ProductErrorCode
from ...utils import get_user_or_app_from_context
from ..types.product_reviews import ProductReview


class ProductReviewModerateInput(graphene.InputObjectType):
    id = graphene.ID(
        required=True,
        description="ID отзыва для модерации.",
    )
    action = graphene.String(
        required=True,
        description="Действие: 'approve' для одобрения, 'reject' для отклонения.",
    )

    class Meta:
        doc_category = DOC_CATEGORY_PRODUCTS


class ProductReviewModerate(BaseMutation):
    review = graphene.Field(
        ProductReview,
        description="Отмодерированный отзыв (null при отклонении).",
    )

    class Arguments:
        input = ProductReviewModerateInput(
            required=True,
            description="Данные для модерации отзыва.",
        )

    class Meta:
        description = "Модерирует отзыв: одобряет (опубликовывает) или отклоняет."
        doc_category = DOC_CATEGORY_PRODUCTS
        error_type_class = ProductError
        permissions = (ProductPermissions.MANAGE_PRODUCTS,)

    @classmethod
    @traced_atomic_transaction()
    def perform_mutation(cls, root, info: ResolveInfo, /, **data):
        input_data = data.get("input")
        user = get_user_or_app_from_context(info.context)

        if not user:
            raise ValidationError(
                {
                    "user": ValidationError(
                        "Вы должны быть аутентифицированы для модерации отзывов.",
                        code=ProductErrorCode.NOT_AUTHENTICATED.value,
                    )
                }
            )

        # Получаем отзыв
        _, review_id = from_global_id_or_error(
            input_data["id"], only_type="ProductReview"
        )
        try:
            review = product_models.ProductReview.objects.get(pk=review_id)
        except product_models.ProductReview.DoesNotExist:
            raise ValidationError(
                {
                    "id": ValidationError(
                        "Отзыв не найден.",
                        code=ProductErrorCode.NOT_FOUND.value,
                    )
                }
            )

        action = input_data.get("action", "").lower()

        if action == "approve":
            # Одобряем отзыв
            review.is_published = True
            review.moderated_by = user
            review.moderated_at = timezone.now()
            review.save(update_fields=["is_published", "moderated_by", "moderated_at"])
            return cls(errors=[], review=review)

        elif action == "reject":
            # Отклоняем отзыв - удаляем
            review.delete()
            return cls(errors=[], review=None)

        else:
            raise ValidationError(
                {
                    "action": ValidationError(
                        "Действие должно быть 'approve' или 'reject'.",
                        code=ProductErrorCode.INVALID_ACTION.value,
                    )
                }
            )

