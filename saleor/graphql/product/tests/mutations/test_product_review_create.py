import graphene
import pytest
from decimal import Decimal

from .....graphql.tests.utils import get_graphql_content
from .....order import OrderStatus
from .....order.models import OrderLine
from .....product.error_codes import ProductErrorCode
from .....product.models import ProductReview


PRODUCT_REVIEW_CREATE_MUTATION = """
    mutation ProductReviewCreate($input: ProductReviewCreateInput!) {
        productReviewCreate(input: $input) {
            review {
                id
                rating
                text
                isPublished
                user {
                    id
                }
            }
            errors {
                field
                code
                message
            }
        }
    }
"""


@pytest.fixture
def fulfilled_order(customer_user, product_with_default_variant, channel_USD):
    """Создает выполненный заказ для пользователя с товаром."""
    from .....order.models import Order

    order = Order.objects.create(
        user=customer_user,
        channel=channel_USD,
        currency=channel_USD.currency_code,
        status=OrderStatus.FULFILLED,
        lines_count=1,
        undiscounted_base_shipping_price_amount=Decimal("0.00"),
    )
    
    variant = product_with_default_variant.variants.first()
    OrderLine.objects.create(
        order=order,
        product_name=str(variant.product),
        variant_name=str(variant),
        product_sku=variant.sku,
        variant=variant,
        quantity=1,
        is_shipping_required=variant.is_shipping_required(),
        is_gift_card=variant.is_gift_card(),
        unit_price_net_amount=Decimal("10.00"),
        unit_price_gross_amount=Decimal("10.00"),
        total_price_net_amount=Decimal("10.00"),
        total_price_gross_amount=Decimal("10.00"),
        undiscounted_unit_price_net_amount=Decimal("10.00"),
        undiscounted_unit_price_gross_amount=Decimal("10.00"),
        undiscounted_total_price_net_amount=Decimal("10.00"),
        undiscounted_total_price_gross_amount=Decimal("10.00"),
        base_unit_price_amount=Decimal("10.00"),
        undiscounted_base_unit_price_amount=Decimal("10.00"),
        tax_rate=Decimal("0.00"),
    )
    
    return order


def test_product_review_create_success(
    user_api_client, product_with_default_variant, fulfilled_order
):
    # given
    product_id = graphene.Node.to_global_id("Product", product_with_default_variant.id)
    variables = {
        "input": {
            "product": product_id,
            "rating": 5,
            "text": "Отличный товар! Очень доволен покупкой. Рекомендую.",
        }
    }

    # when
    response = user_api_client.post_graphql(PRODUCT_REVIEW_CREATE_MUTATION, variables)
    content = get_graphql_content(response)
    data = content["data"]["productReviewCreate"]

    # then
    assert not data["errors"]
    assert data["review"] is not None
    assert data["review"]["rating"] == 5
    assert data["review"]["text"] == "Отличный товар! Очень доволен покупкой. Рекомендую."
    assert data["review"]["isPublished"] is False
    
    # Проверяем, что отзыв создан в БД
    review = ProductReview.objects.get(product=product_with_default_variant)
    assert review.rating == 5
    assert review.is_published is False


def test_product_review_create_not_authenticated(
    api_client, product_with_default_variant
):
    # given
    product_id = graphene.Node.to_global_id("Product", product_with_default_variant.id)
    variables = {
        "input": {
            "product": product_id,
            "rating": 5,
            "text": "Отличный товар!",
        }
    }

    # when
    response = api_client.post_graphql(PRODUCT_REVIEW_CREATE_MUTATION, variables)
    content = get_graphql_content(response)
    data = content["data"]["productReviewCreate"]

    # then
    assert data["errors"]
    assert data["errors"][0]["code"] == ProductErrorCode.NOT_AUTHENTICATED.name


def test_product_review_create_not_purchased(
    user_api_client, product_with_default_variant
):
    # given
    product_id = graphene.Node.to_global_id("Product", product_with_default_variant.id)
    variables = {
        "input": {
            "product": product_id,
            "rating": 5,
            "text": "Отличный товар! Очень доволен покупкой.",
        }
    }

    # when
    response = user_api_client.post_graphql(PRODUCT_REVIEW_CREATE_MUTATION, variables)
    content = get_graphql_content(response)
    data = content["data"]["productReviewCreate"]

    # then
    assert data["errors"]
    assert data["errors"][0]["code"] == ProductErrorCode.NOT_PURCHASED.name


def test_product_review_create_duplicate(
    user_api_client, product_with_default_variant, fulfilled_order
):
    # given
    product_id = graphene.Node.to_global_id("Product", product_with_default_variant.id)
    user = fulfilled_order.user
    
    # Создаем первый отзыв
    ProductReview.objects.create(
        product=product_with_default_variant,
        user=user,
        rating=4,
        text="Первый отзыв",
        is_published=False,
    )
    
    variables = {
        "input": {
            "product": product_id,
            "rating": 5,
            "text": "Второй отзыв",
        }
    }

    # when
    response = user_api_client.post_graphql(PRODUCT_REVIEW_CREATE_MUTATION, variables)
    content = get_graphql_content(response)
    data = content["data"]["productReviewCreate"]

    # then
    assert data["errors"]
    assert data["errors"][0]["code"] == ProductErrorCode.DUPLICATE_REVIEW.name


def test_product_review_create_invalid_rating_low(
    user_api_client, product_with_default_variant, fulfilled_order
):
    # given
    product_id = graphene.Node.to_global_id("Product", product_with_default_variant.id)
    variables = {
        "input": {
            "product": product_id,
            "rating": 0,
            "text": "Отличный товар! Очень доволен покупкой.",
        }
    }

    # when
    response = user_api_client.post_graphql(PRODUCT_REVIEW_CREATE_MUTATION, variables)
    content = get_graphql_content(response)
    data = content["data"]["productReviewCreate"]

    # then
    assert data["errors"]
    assert data["errors"][0]["code"] == ProductErrorCode.INVALID_RATING.name


def test_product_review_create_invalid_rating_high(
    user_api_client, product_with_default_variant, fulfilled_order
):
    # given
    product_id = graphene.Node.to_global_id("Product", product_with_default_variant.id)
    variables = {
        "input": {
            "product": product_id,
            "rating": 6,
            "text": "Отличный товар! Очень доволен покупкой.",
        }
    }

    # when
    response = user_api_client.post_graphql(PRODUCT_REVIEW_CREATE_MUTATION, variables)
    content = get_graphql_content(response)
    data = content["data"]["productReviewCreate"]

    # then
    assert data["errors"]
    assert data["errors"][0]["code"] == ProductErrorCode.INVALID_RATING.name


def test_product_review_create_text_too_short(
    user_api_client, product_with_default_variant, fulfilled_order
):
    # given
    product_id = graphene.Node.to_global_id("Product", product_with_default_variant.id)
    variables = {
        "input": {
            "product": product_id,
            "rating": 5,
            "text": "Коротко",
        }
    }

    # when
    response = user_api_client.post_graphql(PRODUCT_REVIEW_CREATE_MUTATION, variables)
    content = get_graphql_content(response)
    data = content["data"]["productReviewCreate"]

    # then
    assert data["errors"]
    assert data["errors"][0]["code"] == ProductErrorCode.TEXT_TOO_SHORT.name


def test_product_review_create_product_not_found(user_api_client, fulfilled_order):
    # given
    # Product использует integer ID, а не UUID
    fake_product_id = graphene.Node.to_global_id("Product", 999999)
    variables = {
        "input": {
            "product": fake_product_id,
            "rating": 5,
            "text": "Отличный товар! Очень доволен покупкой.",
        }
    }

    # when
    response = user_api_client.post_graphql(PRODUCT_REVIEW_CREATE_MUTATION, variables)
    content = get_graphql_content(response)
    data = content["data"]["productReviewCreate"]

    # then
    assert data["errors"]
    assert data["errors"][0]["code"] == ProductErrorCode.NOT_FOUND.name

