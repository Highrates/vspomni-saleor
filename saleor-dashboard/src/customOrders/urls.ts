import { stringifyQs } from "@dashboard/utils/urls";
import urlJoin from "url-join";

const customOrderSectionUrl = "/custom-orders";

export const customOrderListPath = customOrderSectionUrl;

export const customOrderListUrl = (): string => {
  return customOrderListPath;
};

export const customOrderPath = (id: string) => urlJoin(customOrderSectionUrl, id);

export const customOrderUrl = (id: string) => {
  return customOrderPath(encodeURIComponent(id));
};
