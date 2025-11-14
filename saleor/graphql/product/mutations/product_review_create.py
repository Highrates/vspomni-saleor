import graphene
from django.core.exceptions import ValidationError

from ...core import ResolveInfo
from ...core.doc_category import DOC_CATEGORY_PRODUCTS
from ...core.mutations import BaseMutation
from ....core.tracing import traced_atomic_transaction
from ...core.types import ProductError, Upload
from ...core.utils import from_global_id_or_error
from ....product import models as product_models
from ....product.error_codes import ProductErrorCode
from ....product.utils.product import user_purchased_product
from ...utils import get_user_or_app_from_context
from ..types.product_reviews import ProductReview


class ProductReviewCreateInput(graphene.InputObjectType):
    product = graphene.ID(
        required=True,
        description="ID товара, на который оставляется отзыв.",
    )
    rating = graphene.Int(
        required=True,
        description="Рейтинг от 1 до 5 звезд.",
    )
    text = graphene.String(
        required=True,
        description="Текст отзыва.",
    )
    image_1 = Upload(
        required=False,
        description="Первое изображение отзыва (максимум 2).",
    )
    image_2 = Upload(
        required=False,
        description="Второе изображение отзыва (максимум 2).",
    )

    class Meta:
        doc_category = DOC_CATEGORY_PRODUCTS


class ProductReviewCreate(BaseMutation):
    review = graphene.Field(
        ProductReview,
        description="Созданный отзыв.",
    )

    class Arguments:
        input = ProductReviewCreateInput(
            required=True,
            description="Данные для создания отзыва.",
        )

    class Meta:
        description = "Создает новый отзыв на товар. Отзыв требует модерации перед публикацией."
        doc_category = DOC_CATEGORY_PRODUCTS
        error_type_class = ProductError
        permissions = ()

    @classmethod
    @traced_atomic_transaction()
    def perform_mutation(cls, root, info: ResolveInfo, /, **data):
        input_data = data.get("input")
        user = get_user_or_app_from_context(info.context)

        if not user or not user.is_authenticated:
            raise ValidationError(
                {
                    "user": ValidationError(
                        "Вы должны быть аутентифицированы для создания отзыва.",
                        code=ProductErrorCode.NOT_AUTHENTICATED.value,
                    )
                }
            )

        # Получаем товар
        _, product_id = from_global_id_or_error(
            input_data["product"], only_type="Product"
        )
        try:
            product = product_models.Product.objects.get(pk=product_id)
        except product_models.Product.DoesNotExist:
            raise ValidationError(
                {
                    "product": ValidationError(
                        "Товар не найден.",
                        code=ProductErrorCode.NOT_FOUND.value,
                    )
                }
            )

        # Проверяем, покупал ли пользователь товар
        if not user_purchased_product(user, product):
            raise ValidationError(
                {
                    "product": ValidationError(
                        "Вы можете оставить отзыв только на товары, которые вы приобрели.",
                        code=ProductErrorCode.NOT_PURCHASED.value,
                    )
                }
            )

        # Проверяем, не оставлял ли пользователь уже отзыв на этот товар
        existing_review = product_models.ProductReview.objects.filter(
            product=product, user=user
        ).first()
        if existing_review:
            raise ValidationError(
                {
                    "product": ValidationError(
                        "Вы уже оставили отзыв на этот товар.",
                        code=ProductErrorCode.DUPLICATE_REVIEW.value,
                    )
                }
            )

        # Валидация рейтинга
        rating = input_data.get("rating")
        if rating < 1 or rating > 5:
            raise ValidationError(
                {
                    "rating": ValidationError(
                        "Рейтинг должен быть от 1 до 5.",
                        code=ProductErrorCode.INVALID_RATING.value,
                    )
                }
            )

        # Валидация текста
        text = input_data.get("text", "").strip()
        if not text or len(text) < 10:
            raise ValidationError(
                {
                    "text": ValidationError(
                        "Текст отзыва должен содержать минимум 10 символов.",
                        code=ProductErrorCode.TEXT_TOO_SHORT.value,
                    )
                }
            )

        # Обработка изображений
        image_1 = None
        image_2 = None
        files = info.context.FILES

        if "image_1" in files:
            image_1 = files["image_1"]
            # Валидация размера (например, максимум 5MB)
            if image_1.size > 5 * 1024 * 1024:
                raise ValidationError(
                    {
                        "image_1": ValidationError(
                            "Размер изображения не должен превышать 5MB.",
                            code=ProductErrorCode.FILE_TOO_LARGE.value,
                        )
                    }
                )

        if "image_2" in files:
            image_2 = files["image_2"]
            if image_2.size > 5 * 1024 * 1024:
                raise ValidationError(
                    {
                        "image_2": ValidationError(
                            "Размер изображения не должен превышать 5MB.",
                            code=ProductErrorCode.FILE_TOO_LARGE.value,
                        )
                    }
                )

        # Создаем отзыв
        review = product_models.ProductReview.objects.create(
            product=product,
            user=user,
            rating=rating,
            text=text,
            image_1=image_1,
            image_2=image_2,
            is_published=False,  # Требует модерации
        )

        return cls(errors=[], review=review)

