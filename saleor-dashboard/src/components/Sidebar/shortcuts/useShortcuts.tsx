import { useNavigatorSearchContext } from "@dashboard/components/NavigatorSearch/useNavigatorSearchContext";
import { TerminalIcon } from "@dashboard/icons/TerminalIcon";
import { Box } from "@saleor/macaw-ui-next";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";

import { shortcutsMessages } from "./messages";
import { getShortcutLeadingKey } from "./utils";

export interface Shortcut {
  id: string;
  name: string | React.ReactNode;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const useShortcuts = (): Shortcut[] => {
  const intl = useIntl();
  const { setNavigatorVisibility } = useNavigatorSearchContext();
  const controlKey = getShortcutLeadingKey();

  const handleOpenSearch = useCallback(() => {
    setNavigatorVisibility(true);
  }, [setNavigatorVisibility]);

  const shortcuts = useMemo(
    () => [
      {
        id: "search",
        name: intl.formatMessage(shortcutsMessages.search),
        icon: (
          <Box __marginLeft={"-2px"}>
            <TerminalIcon />
          </Box>
        ),
        shortcut: `${controlKey} + K`,
        action: handleOpenSearch,
      },
    ],
    [intl, controlKey, handleOpenSearch],
  );

  return shortcuts;
};
