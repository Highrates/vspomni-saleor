import useAppChannel from "@dashboard/components/AppLayout/AppChannelContext";
import Money from "@dashboard/components/Money";
import { Skeleton, Text } from "@saleor/macaw-ui-next";
import { useIntl } from "react-intl";

import { welcomePageMessages } from "../../messages";
import { WelcomePageAnalyticsCard } from "../WelcomePageAnalyticsCard";
import { useWelcomePageSalesAnalytics } from "./useWelcomePageSalesAnalytics";

export const WelcomePageSalesAnalytics = () => {
  const intl = useIntl();
  const { channel } = useAppChannel();
  const noChannel = !channel && typeof channel !== "undefined";
  const { analytics, loading, hasError } = useWelcomePageSalesAnalytics();

  return (
    <WelcomePageAnalyticsCard
      title={intl.formatMessage(welcomePageMessages.salesCardTitle)}
      testId="sales-analytics"
    >
      {noChannel || hasError ? (
        <Text size={5} color="default2">
          —
        </Text>
      ) : !loading && analytics.sales ? (
        <Money money={analytics.sales} />
      ) : !loading ? (
        <Text size={5} color="default2">
          0
        </Text>
      ) : (
        <Skeleton width={10} height={3} />
      )}
    </WelcomePageAnalyticsCard>
  );
};
