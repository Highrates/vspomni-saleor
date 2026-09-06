import useAppChannel from "@dashboard/components/AppLayout/AppChannelContext";
import { ReportingPeriod, useComplexDashboardStatsQuery } from "@dashboard/graphql";

function getPeriodStartIsoDate(period: ReportingPeriod): string {
  const now = new Date();
  const start =
    period === ReportingPeriod.TODAY
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth(), 1);

  return start.toISOString().slice(0, 10);
}

export const useWelcomePageComplexStats = (period: ReportingPeriod = ReportingPeriod.TODAY) => {
  const { channel } = useAppChannel();
  const periodStart = getPeriodStartIsoDate(period);

  const { data, loading, error } = useComplexDashboardStatsQuery({
    variables: {
      period,
      channel: channel?.slug || "",
      ordersCreatedGte: periodStart,
      customersJoinedGte: periodStart,
    },
    skip: !channel,
  });

  const totalRevenue = data?.ordersTotal?.gross?.amount ?? 0;
  const currency = data?.ordersTotal?.gross?.currency || channel?.currencyCode || "RUB";
  const ordersCount = data?.orders?.totalCount ?? 0;
  const newCustomersCount = data?.customers?.totalCount ?? 0;
  const averageOrderValue = ordersCount > 0 ? totalRevenue / ordersCount : 0;

  return {
    totalRevenue,
    ordersCount,
    averageOrderValue,
    newCustomersCount,
    currency,
    loading,
    hasError: !!error,
  };
};
