# План реализации системы отзывов 

## Цель
Реализовать систему сбора и модерации отзывов на товары. Покупатели оставляют отзывы (рейтинг, текст, изображения), оператор модерирует их в дашборде, опубликованные отзывы отображаются на странице товара на витрине.

---

## 1. База данных (Django модель)

### 1.1 Модель ProductReview
**Файл:** `saleor/product/models.py` (добавить в конец файла)

```python
class ProductReview(Model):
    id = models.UUIDField(primary_key=True, default=uuid4)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Связи
    product = models.ForeignKey(
        "product.Product",
        on_delete=models.CASCADE,
        related_name="reviews"
    )
    user = models.ForeignKey(
        "account.User",
        on_delete=models.CASCADE,
        related_name="product_reviews"
    )
    
    # Данные отзыва
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Рейтинг от 1 до 5 звезд"
    )
    text = models.TextField(help_text="Текст отзыва")
    
    # Модерация
    is_published = models.BooleanField(
        default=False,
        help_text="Опубликован ли отзыв (после модерации)"
    )
    moderated_by = models.ForeignKey(
        "account.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderated_reviews",
        help_text="Оператор, который отмодерировал отзыв"
    )
    moderated_at = models.DateTimeField(null=True, blank=True)
    
    # Изображения (максимум 2)
    image_1 = models.ImageField(upload_to="product_reviews/", null=True, blank=True)
    image_2 = models.ImageField(upload_to="product_reviews/", null=True, blank=True)
    
    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["product", "is_published"]),
            models.Index(fields=["user"]),
        ]
    
    def __str__(self):
        return f"Review for {self.product.name} by {self.user.email}"
```

### 1.2 Миграция
**Выполнить:** `uv run poe make-migrations`
**Файл будет создан:** `saleor/product/migrations/XXXX_add_productreview.py`

**Выполнить миграцию:** `uv run poe migrate`

---

## 2. GraphQL API (Backend)

### 2.1 Тип ProductReview
**Файл:** `saleor/graphql/product/types.py` (добавить)

```python
class ProductReview(graphene.ObjectType):
    id = graphene.ID(required=True)
    product = graphene.Field("saleor.graphql.product.types.Product")
    user = graphene.Field("saleor.graphql.account.types.User")
    rating = graphene.Int(required=True)
    text = graphene.String(required=True)
    image_1 = graphene.String()
    image_2 = graphene.String()
    is_published = graphene.Boolean(required=True)
    created_at = graphene.DateTime(required=True)
    moderated_by = graphene.Field("saleor.graphql.account.types.User")
    moderated_at = graphene.DateTime()
```

### 2.2 Mutation: Создание отзыва (с сайта)
**Файл:** `saleor/graphql/product/mutations/product_review_create.py` (создать)

**Логика:**
- Проверка: пользователь аутентифицирован
- Проверка: пользователь покупал этот товар (запрос к OrderLine)
- Валидация: rating 1-5, text не пустой, максимум 2 изображения
- Создание: `ProductReview(product=..., user=..., rating=..., text=..., image_1=..., image_2=..., is_published=False)`
- Возврат: созданный отзыв

**Разрешения:** `AccountPermissions.AUTHENTICATED_USER`

### 2.3 Query: Список отзывов товара (опубликованные)
**Файл:** `saleor/graphql/product/types.py` (добавить в Product тип)

```python
reviews = graphene.List(
    ProductReview,
    description="Опубликованные отзывы на товар"
)

def resolve_reviews(self, info):
    return self.reviews.filter(is_published=True)
```

### 2.4 Query: Отзывы на модерацию (для дашборда)
**Файл:** `saleor/graphql/product/queries.py` (добавить)

```python
product_reviews_pending = graphene.List(
    ProductReview,
    description="Отзывы, ожидающие модерации",
    required=True
)

def resolve_product_reviews_pending(self, info):
    # Доступ только для операторов
    return ProductReview.objects.filter(is_published=False).order_by("-created_at")
```

### 2.5 Mutation: Модерация отзыва (опубликовать/отклонить)
**Файл:** `saleor/graphql/product/mutations/product_review_moderate.py` (создать)

**Логика:**
- Параметры: `review_id`, `action` ("approve" / "reject")
- Проверка прав: оператор (MANAGE_PRODUCTS)
- Если approve: `is_published=True`, `moderated_by=request.user`, `moderated_at=now()`
- Если reject: удалить отзыв (soft delete) или пометить как отклонённый (по выбору)
- Возврат: отмодерированный отзыв или ошибка

**Разрешения:** `ProductPermissions.MANAGE_PRODUCTS`

### 2.6 Добавление в схему
**Файл:** `saleor/graphql/product/schema.py`

```python
from .mutations.product_review_create import ProductReviewCreate
from .mutations.product_review_moderate import ProductReviewModerate

class ProductMutations(graphene.ObjectType):
    product_review_create = ProductReviewCreate.Field()
    product_review_moderate = ProductReviewModerate.Field()
```

---

## 3. Дашборд (Dashboard)

### 3.1 Страница "Отзывы на модерацию"
**Структура файлов:**
- `src/productReviews/index.tsx` - главный экспорт
- `src/productReviews/urls.ts` - маршруты
- `src/productReviews/components/ProductReviewListPage/ProductReviewListPage.tsx` - список отзывов
- `src/productReviews/components/ProductReviewListDatagrid/ProductReviewListDatagrid.tsx` - таблица
- `src/productReviews/queries.ts` - GraphQL запросы
- `src/productReviews/mutations.ts` - GraphQL мутации

### 3.2 Компонент ProductReviewListDatagrid
**Колонки таблицы:**
- Товар (название, ссылка на страницу товара)
- Пользователь (email)
- Рейтинг (1-5 звезд, визуально)
- Текст (первые 100 символов, полный текст в модальном окне)
- Изображения (превью, клик для просмотра)
- Дата создания
- Действия: "Опубликовать", "Отклонить"

### 3.3 Модальное окно просмотра отзыва
**Компонент:** `ProductReviewDetailDialog.tsx`
- Полный текст отзыва
- Все изображения (если есть)
- Информация о товаре и пользователе
- Кнопки: "Опубликовать", "Отклонить"

### 3.4 GraphQL запросы (Dashboard)
**Файл:** `src/productReviews/queries.ts`

```graphql
query ProductReviewsPending {
  productReviewsPending {
    id
    product {
      id
      name
      slug
    }
    user {
      email
    }
    rating
    text
    image_1
    image_2
    created_at
  }
}
```

**Файл:** `src/productReviews/mutations.ts`

```graphql
mutation ProductReviewModerate($id: ID!, $action: String!) {
  productReviewModerate(id: $id, action: $action) {
    review {
      id
      is_published
    }
    errors {
      field
      message
    }
  }
}
```

### 3.5 Навигация
**Файл:** `src/navigation/structure.ts` (добавить пункт меню)
- Раздел: "Каталог" или "Контент"
- Пункт: "Отзывы на модерацию" (`/product-reviews`)
- Права доступа: `MANAGE_PRODUCTS`

---

## 4. Витрина (Storefront)

### 4.1 Форма создания отзыва
**Файл:** `storefront/src/components/ProductReviewForm/ProductReviewForm.tsx`

**Поля:**
- Рейтинг (1-5 звезд, выбор)
- Текст отзыва (textarea)
- Загрузка изображений (до 2, с предпросмотром)

**Валидация:**
- Рейтинг обязателен
- Текст обязателен (минимум 10 символов)
- Максимум 2 изображения

**Логика:**
- Показать форму только если пользователь аутентифицирован И купил этот товар
- Проверка покупки: GraphQL запрос к `orders` пользователя, поиск `orderLines` с данным `productId`
- При отправке: `mutation productReviewCreate(input: { product: ID, rating: Int, text: String, images: [Upload] })`
- После успешной отправки: показать сообщение "Спасибо, ваш отзыв отправлен на модерацию"

### 4.2 Отображение отзывов на странице товара
**Файл:** `storefront/src/components/ProductReviews/ProductReviews.tsx`

**Секция "Отзывы покупателей":**
- Заголовок с общим рейтингом (средний рейтинг из опубликованных отзывов)
- Список отзывов:
  - Рейтинг (звезды)
  - Текст
  - Изображения (галерея)
  - Имя пользователя (или "Покупатель N")
  - Дата
- Пагинация (если отзывов много)

**GraphQL запрос:**
```graphql
query Product($id: ID!) {
  product(id: $id) {
    reviews {
      id
      rating
      text
      image_1
      image_2
      user {
        email
      }
      created_at
    }
  }
}
```

---

## 5. Проверка покупки товара

### 5.1 Helper функция
**Файл:** `saleor/product/utils.py` (добавить)

```python
def user_purchased_product(user, product):
    """
    Проверяет, покупал ли пользователь данный товар.
    """
    if not user.is_authenticated:
        return False
    
    # Проверка через OrderLine
    return OrderLine.objects.filter(
        order__user=user,
        order__status__in=[OrderStatus.FULFILLED, OrderStatus.PARTIALLY_FULFILLED],
        variant__product=product
    ).exists()
```

**Использование в mutation `productReviewCreate`:**
- Вызвать `user_purchased_product(request.user, product)`
- Если `False` → вернуть ошибку "Вы можете оставить отзыв только на товары, которые вы приобрели"

---

## 6. Загрузка изображений

### 6.1 Настройка MEDIA
**Файл:** `saleor/settings.py` (проверить)

```python
MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")
```

**Директория:** `media/product_reviews/` (создастся автоматически при миграции)

### 6.2 Обработка загрузки (GraphQL)
**Использовать:** `graphene_file_upload` или стандартный `Upload` тип GraphQL
**В mutation `productReviewCreate`:**
- Принять файлы через `info.context.FILES` или `Upload`
- Валидация: формат (jpg, png), размер (например, макс 5MB), количество (макс 2)
- Сохранить: `review.image_1 = file1`, `review.image_2 = file2`

---

## 7. Порядок реализации

1. **Backend (Django):**
   - Создать модель `ProductReview`
   - Миграция БД
   - Создать helper `user_purchased_product`

2. **GraphQL API:**
   - Тип `ProductReview`
   - Query: `productReviewsPending` (для дашборда)
   - Query: добавить `reviews` в тип `Product` (для витрины)
   - Mutation: `productReviewCreate` (создание отзыва)
   - Mutation: `productReviewModerate` (модерация)

3. **Дашборд:**
   - Создать структуру папок `src/productReviews/`
   - Компонент таблицы отзывов
   - Страница модерации
   - Добавить в навигацию

4. **Витрина:**
   - Форма создания отзыва
   - Компонент отображения отзывов на странице товара

5. **Тестирование:**
   - Создание отзыва с сайта
   - Модерация в дашборде
   - Отображение опубликованных отзывов

---

## 8. Дополнительные улучшения (опционально)

- **Email уведомления:** отправка оператору при новом отзыве
- **Пагинация отзывов:** на странице товара
- **Сортировка отзывов:** по дате, по рейтингу
- **Фильтры в дашборде:** по товару, по рейтингу, по дате (если потребуется)
- **Статистика:** средний рейтинг товара, количество отзывов

---

## 9. Файлы для создания/изменения

### Backend:
- `saleor/product/models.py` (добавить модель)
- `saleor/product/migrations/XXXX_add_productreview.py` (создать миграцию)
- `saleor/product/utils.py` (helper функция)
- `saleor/graphql/product/types.py` (тип ProductReview, поле reviews в Product)
- `saleor/graphql/product/mutations/product_review_create.py` (создать)
- `saleor/graphql/product/mutations/product_review_moderate.py` (создать)
- `saleor/graphql/product/schema.py` (добавить мутации)
- `saleor/graphql/product/queries.py` (query для дашборда)

### Dashboard:
- `src/productReviews/index.tsx`
- `src/productReviews/urls.ts`
- `src/productReviews/queries.ts`
- `src/productReviews/mutations.ts`
- `src/productReviews/components/ProductReviewListPage/ProductReviewListPage.tsx`
- `src/productReviews/components/ProductReviewListDatagrid/ProductReviewListDatagrid.tsx`
- `src/productReviews/components/ProductReviewDetailDialog/ProductReviewDetailDialog.tsx`

### Storefront:
- Компоненты формы создания отзыва
- Компонент отображения отзывов

---

## Примечания

- Все отзывы создаются с `is_published=False` (требуют модерации)
- После модерации (`is_published=True`) отзыв появляется на витрине
- Оператор видит все отзывы на модерацию в одной таблице без фильтров
- Пользователь может оставить только один отзыв на один купленный товар (можно добавить проверку)

