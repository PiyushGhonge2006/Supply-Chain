import { Box, Home, Activity, Route, BarChart2, MapPin, Map, Navigation } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const [location] = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { key: "dashboard",      url: "/",             icon: Home },
    { key: "worldMap",       url: "/map",          icon: Map },
    { key: "shipments",      url: "/shipments",    icon: Box },
    { key: "disruptions",    url: "/disruptions",  icon: Activity },
    { key: "routeOptimizer", url: "/routes",       icon: Route },
    { key: "routeFinder",    url: "/route-finder", icon: Navigation },
    { key: "warehouses",     url: "/warehouses",   icon: MapPin },
    { key: "analytics",      url: "/analytics",    icon: BarChart2 },
  ] as const;

  return (
    <Sidebar className="border-r border-border bg-sidebar">
      <SidebarHeader className="border-b border-border p-4 h-14 flex items-center">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <span className="font-bold text-sm tracking-tight text-foreground">{t("brand")}</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider font-mono">
            {t("commandCenter")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const label = t(`nav.${item.key}`);
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url || (item.url !== "/" && location.startsWith(item.url))}
                      tooltip={label}
                    >
                      <Link href={item.url} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
