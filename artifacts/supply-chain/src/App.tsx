import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Shipments from "@/pages/shipments";
import ShipmentDetail from "@/pages/shipment-detail";
import Disruptions from "@/pages/disruptions";
import Routes from "@/pages/routes";
import Analytics from "@/pages/analytics";
import Warehouses from "@/pages/warehouses";
import { MainLayout } from "@/components/layout/main-layout";
import MapPage from "@/pages/map";
import RouteFinder from "@/pages/route-finder";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/shipments" component={Shipments} />
        <Route path="/shipments/:id" component={ShipmentDetail} />
        <Route path="/disruptions" component={Disruptions} />
        <Route path="/routes" component={Routes} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/warehouses" component={Warehouses} />
        <Route path="/map" component={MapPage} />
        <Route path="/route-finder" component={RouteFinder} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
