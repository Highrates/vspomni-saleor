// @ts-strict-ignore
import { DashboardCard } from "@dashboard/components/Card";
import {
  useOrderDetailsWithMetadataQuery,
  useOrderFulfillmentApproveMutation,
} from "@dashboard/graphql";
import useNavigator from "@dashboard/hooks/useNavigator";
import useNotifier from "@dashboard/hooks/useNotifier";
import { Box, Button, Text } from "@saleor/macaw-ui-next";
import { FormattedMessage, useIntl } from "react-intl";

import { customOrderListUrl } from "../../urls";

interface CustomOrderDetailsProps {
  id: string;
}

const CustomOrderDetails = ({ id }: CustomOrderDetailsProps) => {
  const navigate = useNavigator();
  const notify = useNotifier();
  const intl = useIntl();

  const { data, loading } = useOrderDetailsWithMetadataQuery({
    variables: { id, hasManageProducts: true },
    fetchPolicy: "cache-first",
  });

  const [approveFulfillment, { loading: updating }] = useOrderFulfillmentApproveMutation({
    refetchQueries: ["OrderDetailsWithMetadata"],
    onCompleted: data => {
      if (data.orderFulfillmentApprove?.errors.length === 0) {
        notify({
          status: "success",
          text: intl.formatMessage({
            defaultMessage: "Заказ отмечен как доставленный",
            id: "orderMarkedAsDelivered",
          }),
        });
      } else {
        const error = data.orderFulfillmentApprove?.errors[0];
        notify({
          status: "error",
          text: error?.message || intl.formatMessage({
            defaultMessage: "Ошибка при обновлении статуса",
            id: "orderStatusUpdateError",
          }),
        });
      }
    },
  });

  const order = data?.order;

  const handleMarkAsDelivered = () => {
    if (!order) return;

    // Находим первый fulfillment, который еще не одобрен
    const unfulfilledFulfillment = order.fulfillments?.find(
      f => f.status !== "FULFILLED" && f.status !== "CANCELED"
    );

    if (!unfulfilledFulfillment) {
      // Если нет fulfillment, нужно сначала создать его
      // Для простоты показываем сообщение
      notify({
        status: "error",
        text: intl.formatMessage({
          defaultMessage: "Нет fulfillment для одобрения. Сначала создайте fulfillment.",
          id: "noFulfillmentToApprove",
        }),
      });
      return;
    }

    // Одобряем fulfillment, что помечает заказ как доставленный
    approveFulfillment({
      variables: {
        id: unfulfilledFulfillment.id,
        notifyCustomer: false,
      },
    });
  };

  if (loading) {
    return (
      <Box padding={6}>
        <Text>
          <FormattedMessage defaultMessage="Загрузка..." id="loading" />
        </Text>
      </Box>
    );
  }

  if (!order) {
    return (
      <Box padding={6}>
        <Text>
          <FormattedMessage defaultMessage="Заказ не найден" id="orderNotFound" />
        </Text>
        <Button onClick={() => navigate(customOrderListUrl())} marginTop={4}>
          <FormattedMessage defaultMessage="Назад к списку" id="backToList" />
        </Button>
      </Box>
    );
  }

  return (
    <Box padding={6}>
      <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={4}>
        <Box>
          <Text size={8} fontWeight="bold">
            Заказ #{order.number}
          </Text>
          <Text size={4} color="default2">
            {order.created && new Date(order.created).toLocaleDateString("ru-RU")}
          </Text>
        </Box>
        <Button onClick={() => navigate(customOrderListUrl())} variant="secondary">
          <FormattedMessage defaultMessage="Назад" id="back" />
        </Button>
      </Box>

      <Box display="grid" gap={4}>
        <DashboardCard>
          <DashboardCard.Content>
            <Text size={5} fontWeight="bold" marginBottom={2}>
              <FormattedMessage defaultMessage="Информация о заказе" id="orderInfo" />
            </Text>
            <Box display="grid" gap={2}>
              <Box display="flex" justifyContent="space-between">
                <Text size={4}>Клиент:</Text>
                <Text size={4} fontWeight="bold">
                  {order.userEmail || "Без клиента"}
                </Text>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Text size={4}>Статус:</Text>
                <Text size={4} fontWeight="bold">
                  {order.status}
                </Text>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Text size={4}>Сумма:</Text>
                <Text size={4} fontWeight="bold">
                  {order.total?.gross?.amount} {order.total?.gross?.currency}
                </Text>
              </Box>
            </Box>
          </DashboardCard.Content>
        </DashboardCard>

        <DashboardCard>
          <DashboardCard.Content>
            <Text size={5} fontWeight="bold" marginBottom={2}>
              <FormattedMessage defaultMessage="Товары" id="products" />
            </Text>
            {order.lines?.map(line => (
              <Box key={line.id} display="flex" justifyContent="space-between" paddingY={2}>
                <Text size={4}>
                  {line.productName} x{line.quantity}
                </Text>
                <Text size={4} fontWeight="bold">
                  {line.totalPrice?.gross?.amount} {line.totalPrice?.gross?.currency}
                </Text>
              </Box>
            ))}
          </DashboardCard.Content>
        </DashboardCard>

        <DashboardCard>
          <DashboardCard.Content>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Text size={5} fontWeight="bold" marginBottom={1}>
                  <FormattedMessage defaultMessage="Статус доставки" id="deliveryStatus" />
                </Text>
                <Text size={4} color="default2">
                  {order.fulfillments?.length > 0
                    ? order.fulfillments[0].status
                    : "Не доставлено"}
                </Text>
              </Box>
              <Button
                onClick={handleMarkAsDelivered}
                disabled={
                  updating ||
                  order.fulfillments?.every(f => f.status === "FULFILLED" || f.status === "CANCELED")
                }
                variant="primary"
              >
                <FormattedMessage defaultMessage="Отметить как доставлено" id="markAsDelivered" />
              </Button>
            </Box>
          </DashboardCard.Content>
        </DashboardCard>
      </Box>
    </Box>
  );
};

export default CustomOrderDetails;
