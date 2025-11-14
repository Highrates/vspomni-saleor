# API для отзывов на странице товара (Storefront)

## GraphQL Endpoint
```
http://localhost:8000/graphql/
```

## Запрос отзывов для товара

### Пример запроса:
```graphql
query ProductReviews($id: ID!) {
  product(id: $id) {
    id
    name
    reviews {
      id
      rating
      text
      image1
      image2
      createdAt
      isPublished
      user {
        email
        firstName
        lastName
      }
    }
  }
}
```

### Пример переменных:
```json
{
  "id": "UHJvZHVjdDoxNjc="
}
```

### Пример ответа:
```json
{
  "data": {
    "product": {
      "id": "UHJvZHVjdDoxNjc=",
      "name": "Гидрофильное масло «Мать-и-мачеха и календула»",
      "reviews": [
        {
          "id": "UHJvZHVjdFJldmlldzo3MDYyY2U0Ni1jMmU3LTRhNDktYjUzNS1hNzg0OGUwODQwZDQ=",
          "rating": 5,
          "text": "Отличный товар! Очень доволен покупкой...",
          "image1": "http://localhost:8000/media/product_reviews/test_review_image.jpg",
          "image2": null,
          "createdAt": "2025-10-31T13:02:00+00:00",
          "isPublished": true,
          "user": {
            "email": "anthony.bailey@example.com",
            "firstName": "Anthony",
            "lastName": "Bailey"
          }
        }
      ]
    }
  }
}
```

## Важные замечания

1. **Поле `reviews` возвращает только опубликованные отзывы** (`is_published=True`)
2. **Все отзывы требуют модерации** - неопубликованные отзывы не возвращаются
3. **Изображения** (`image1`, `image2`) - опциональные, могут быть `null`
4. **Рейтинг** - целое число от 1 до 5
5. **Пользователь** может быть `null` (если аккаунт удален)

## Вычисление среднего рейтинга

```typescript
const averageRating = reviews.length > 0
  ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
  : 0;
```

## Формат даты

`createdAt` возвращается в формате ISO 8601: `"2025-10-31T13:02:00+00:00"`

## Пример использования в React (Apollo Client)

```typescript
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';

const PRODUCT_REVIEWS_QUERY = gql`
  query ProductReviews($id: ID!) {
    product(id: $id) {
      id
      name
      reviews {
        id
        rating
        text
        image1
        image2
        createdAt
        user {
          email
          firstName
          lastName
        }
      }
    }
  }
`;

function ProductReviews({ productId }) {
  const { data, loading, error } = useQuery(PRODUCT_REVIEWS_QUERY, {
    variables: { id: productId },
  });

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error.message}</div>;

  const reviews = data?.product?.reviews || [];
  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <div>
      <h2>Отзывы покупателей</h2>
      <div>Средний рейтинг: {averageRating.toFixed(1)} ⭐</div>
      {reviews.map(review => (
        <div key={review.id}>
          <div>{'⭐'.repeat(review.rating)}</div>
          <p>{review.text}</p>
          {review.user && (
            <div>{review.user.firstName} {review.user.lastName}</div>
          )}
          {review.image1 && <img src={review.image1} alt="Review" />}
          {review.image2 && <img src={review.image2} alt="Review" />}
          <div>{new Date(review.createdAt).toLocaleDateString('ru-RU')}</div>
        </div>
      ))}
    </div>
  );
}
```

