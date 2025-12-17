// @ts-strict-ignore
import { useMemo } from "react";

import { customOrderListUrl } from "@dashboard/customOrders/urls";

// Минимальный тип пункта меню, достаточный для работы компонента MenuItem
export interface SidebarMenuItem {
  id: string;
  label: string;
  url?: string;
  children?: SidebarMenuItem[];
}

// Хук структуры меню. Сейчас реализован упрощённо:
// - возвращает стандартную группу "Заказы"
// - внутри неё пункт "Кастомные заказы"
// При необходимости сюда можно добавить остальные пункты как в оригинальном Saleor.
export const useMenuStructure = (): SidebarMenuItem[] => {
  return useMemo(
    () => [
      {
        id: "orders-section",
        label: "Заказы",
        children: [
          {
            id: "custom-orders",
            label: "Кастомные заказы",
            url: customOrderListUrl(),
          },
        ],
      },
    ],
    [],
  );
};

