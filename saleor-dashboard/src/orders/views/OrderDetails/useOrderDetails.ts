import { useOrderDetailsWithMetadataQuery } from "@dashboard/graphql";
import { useHasManageProductsPermission } from "@dashboard/orders/hooks/useHasManageProductsPermission";

export const useOrderDetails = (id: string) => {
  const hasManageProducts = useHasManageProductsPermission();
  const { data, loading } = useOrderDetailsWithMetadataQuery({
    displayLoader: true,
    variables: { id, hasManageProducts },
    // STRICT cache-first to prevent ANY automatic refetching
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
    // Disable ALL automatic refetch triggers
    notifyOnNetworkStatusChange: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    // Disable refetch on window focus
    refetchOnWindowFocus: false,
    // Skip the query if we have cached data
    skip: false,
  });

  return {
    data,
    loading,
  };
};
