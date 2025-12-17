// @ts-strict-ignore
import { useOrderListQuery } from "@dashboard/graphql";
import { useListSettings } from "@dashboard/hooks/useListSettings";
import useNavigator from "@dashboard/hooks/useNavigator";
import { ListViews } from "@dashboard/types";
import { mapEdgesToItems } from "@dashboard/utils/maps";
import { Box, Button, Card, Text } from "@saleor/macaw-ui-next";
import { FormattedMessage, useIntl } from "react-intl";

import { customOrderUrl } from "../../urls";

const CustomOrderList = () => {
  const navigate = useNavigator();
  const intl = useIntl();
  const { settings } = useListSettings(ListViews.ORDER_LIST);

  // Загружаем все заказы, фильтруем только те, что созданы через кастомный эндпоинт
  // Можно фильтровать по метаданным или другому признаку
  const { data, loading } = useOrderListQuery({
    variables: {
      first: settings.rowNumber,
      after: null,
    },
  });

  const orders = mapEdgesToItems(data?.orders);

  // Фильтруем заказы - показываем все, но можно добавить фильтр по метаданным
  // Например, если в метаданных есть ключ "custom_endpoint": "true"
  const customOrders = orders?.filter(order => {
    // Здесь можно добавить фильтрацию по метаданным или другому признаку
    // Например: order.metadata?.some(meta => meta.key === "custom_endpoint" && meta.value === "true")
    return true; // Пока показываем все заказы
  }) || [];

  return (
    <Box padding={6}>
      <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={4}>
        <Text size={8} fontWeight="bold">
          <FormattedMessage defaultMessage="Кастомные заказы" id="customOrders.title" />
        </Text>
      </Box>

      {loading ? (
        <Text>
          <FormattedMessage defaultMessage="Загрузка..." id="loading" />
        </Text>
      ) : customOrders.length === 0 ? (
        <Card padding={6}>
          <Text>
            <FormattedMessage defaultMessage="Нет заказов" id="noOrders" />
          </Text>
        </Card>
      ) : (
        <Box display="grid" gap={2}>
          {customOrders.map(order => (
            <Card
              key={order.id}
              padding={4}
              onClick={() => navigate(customOrderUrl(order.id))}
              style={{ cursor: "pointer" }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Text size={5} fontWeight="bold">
                    Заказ #{order.number}
                  </Text>
                  <Text size={3} color="default2">
                    {order.created && new Date(order.created).toLocaleDateString("ru-RU")}
                  </Text>
                  <Text size={3} color="default2">
                    {order.customer?.email || "Без клиента"}
                  </Text>
                </Box>
                <Box textAlign="right">
                  <Text size={5} fontWeight="bold">
                    {order.total?.gross?.amount} {order.total?.gross?.currency}
                  </Text>
                  <Text size={3} color="default2">
                    Статус: {order.status}
                  </Text>
                </Box>
              </Box>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default CustomOrderList;
