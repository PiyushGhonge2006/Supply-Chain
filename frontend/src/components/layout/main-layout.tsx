import React from "react";
import { useTranslation } from "react-i18next";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";
import { LanguageSelector } from "./language-selector";
import { useHealthCheck } from "@workspace/api-client-react";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { data: health } = useHealthCheck();
  const { t } = useTranslation();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen bg-background w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden bg-background">
          <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-6">
            <SidebarTrigger className="text-foreground" />
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              <LanguageSelector />
              <div className="flex items-center gap-2 text-xs">
                <span className={`h-2 w-2 rounded-full ${health ? 'bg-primary' : 'bg-destructive'}`} />
                <span className="text-muted-foreground uppercase tracking-widest font-mono">
                  {health ? t("systemOnline") : t("systemOffline")}
                </span>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
