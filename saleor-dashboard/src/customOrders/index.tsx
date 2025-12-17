import { Route } from "@dashboard/components/Router";
import { sectionNames } from "@dashboard/intl";
import { useIntl } from "react-intl";
import { RouteComponentProps, Switch } from "react-router-dom";

import { WindowTitle } from "../components/WindowTitle";
import { customOrderListPath, customOrderPath } from "./urls";
import CustomOrderDetails from "./views/CustomOrderDetails/CustomOrderDetails";
import CustomOrderList from "./views/CustomOrderList/CustomOrderList";

interface MatchParams {
  id?: string;
}

const CustomOrderListRoute = () => {
  return <CustomOrderList />;
};

const CustomOrderDetailsRoute = ({ match }: RouteComponentProps<MatchParams>) => {
  const id = match.params.id!;
  return <CustomOrderDetails id={decodeURIComponent(id)} />;
};

const Component = () => {
  const intl = useIntl();

  return (
    <>
      <WindowTitle title={intl.formatMessage(sectionNames.orders)} />
      <Switch>
        <Route exact path={customOrderListPath} component={CustomOrderListRoute} />
        <Route path={customOrderPath(":id")} component={CustomOrderDetailsRoute} />
      </Switch>
    </>
  );
};

export default Component;
