import graphene
import pytest

from .....graphql.tests.utils import get_graphql_content, get_graphql_content_from_response
from .....product.error_codes import ProductErrorCode
from .....product.models import ProductReview


PRODUCT_REVIEW_MODERATE_MUTATION = """
    mutation ProductReviewModerate($input: ProductReviewModerateInput!) {
        productReviewModerate(input: $input) {
            review {
                id
                isPublished
                moderatedBy {
                    id
                }
                moderatedAt
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
def product_review(customer_user, product_with_default_variant):
    """Создает отзыв, ожидающий модерации."""
    return ProductReview.objects.create(
        product=product_with_default_variant,
        user=customer_user,
        rating=5,
        text="Отличный товар! Очень доволен покупкой. Рекомендую всем.",
        is_published=False,
    )


def test_product_review_moderate_approve_success(
    staff_api_client, product_review, permission_manage_products
):
    # given
    review_id = graphene.Node.to_global_id("ProductReview", product_review.id)
    variables = {
        "input": {
            "id": review_id,
            "action": "approve",
        }
    }

    # when
    response = staff_api_client.post_graphql(
        PRODUCT_REVIEW_MODERATE_MUTATION,
        variables,
        permissions=[permission_manage_products],
    )
    content = get_graphql_content(response)
    data = content["data"]["productReviewModerate"]

    # then
    assert not data["errors"]
    assert data["review"] is not None
    assert data["review"]["isPublished"] is True
    assert data["review"]["moderatedBy"] is not None
    assert data["review"]["moderatedAt"] is not None
    
    # Проверяем, что отзыв обновлен в БД
    product_review.refresh_from_db()
    assert product_review.is_published is True
    assert product_review.moderated_by is not None
    assert product_review.moderated_at is not None


def test_product_review_moderate_reject_success(
    staff_api_client, product_review, permission_manage_products
):
    # given
    review_id = graphene.Node.to_global_id("ProductReview", product_review.id)
    review_pk = product_review.id
    variables = {
        "input": {
            "id": review_id,
            "action": "reject",
        }
    }

    # when
    response = staff_api_client.post_graphql(
        PRODUCT_REVIEW_MODERATE_MUTATION,
        variables,
        permissions=[permission_manage_products],
    )
    content = get_graphql_content(response)
    data = content["data"]["productReviewModerate"]

    # then
    assert not data["errors"]
    assert data["review"] is None
    
    # Проверяем, что отзыв удален из БД
    assert not ProductReview.objects.filter(pk=review_pk).exists()


def test_product_review_moderate_invalid_action(
    staff_api_client, product_review, permission_manage_products
):
    # given
    review_id = graphene.Node.to_global_id("ProductReview", product_review.id)
    variables = {
        "input": {
            "id": review_id,
            "action": "invalid_action",
        }
    }

    # when
    response = staff_api_client.post_graphql(
        PRODUCT_REVIEW_MODERATE_MUTATION,
        variables,
        permissions=[permission_manage_products],
    )
    content = get_graphql_content(response)
    data = content["data"]["productReviewModerate"]

    # then
    assert data["errors"]
    assert data["errors"][0]["code"] == ProductErrorCode.INVALID_ACTION.name


def test_product_review_moderate_not_found(
    staff_api_client, permission_manage_products
):
    # given
    from uuid import uuid4
    fake_uuid = uuid4()
    fake_review_id = graphene.Node.to_global_id("ProductReview", fake_uuid)
    variables = {
        "input": {
            "id": fake_review_id,
            "action": "approve",
        }
    }

    # when
    response = staff_api_client.post_graphql(
        PRODUCT_REVIEW_MODERATE_MUTATION,
        variables,
        permissions=[permission_manage_products],
    )
    content = get_graphql_content(response)
    data = content["data"]["productReviewModerate"]

    # then
    assert data["errors"]
    assert data["errors"][0]["code"] == ProductErrorCode.NOT_FOUND.name


def test_product_review_moderate_no_permission(
    user_api_client, product_review
):
    # given
    review_id = graphene.Node.to_global_id("ProductReview", product_review.id)
    variables = {
        "input": {
            "id": review_id,
            "action": "approve",
        }
    }

    # when
    response = user_api_client.post_graphql(PRODUCT_REVIEW_MODERATE_MUTATION, variables)
    # Ошибка прав доступа возвращается на уровне GraphQL, не в data.errors
    content = get_graphql_content_from_response(response)

    # then
    # Проверяем, что есть ошибка на уровне GraphQL
    assert "errors" in content
    assert any(
        "MANAGE_PRODUCTS" in error.get("message", "") or "permission" in error.get("message", "").lower()
        for error in content["errors"]
    )
    # Проверяем, что отзыв не изменен
    product_review.refresh_from_db()
    assert product_review.is_published is False

