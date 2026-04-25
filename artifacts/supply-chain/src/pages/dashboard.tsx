import { useGetDashboardSummary, useListDisruptions, useGetRiskScores } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, CheckCircle2, Box } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: disruptions, isLoading: isLoadingDisruptions } = useListDisruptions({ limit: 5 } as any);
  const { data: riskScores, isLoading: isLoadingRisks } = useGetRiskScores();

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      {isLoadingSummary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i} className="bg-card">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">{t("dashboard.activeShipments")}</CardTitle>
              <Box className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.activeShipments.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("dashboard.deliveredToday", { count: summary.deliveredToday })}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-l-4 border-l-destructive">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">{t("dashboard.atRisk")}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{summary.atRiskShipments.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("dashboard.currentlyDelayed", { count: summary.delayedShipments })}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-l-4 border-l-warning">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">{t("dashboard.activeDisruptions")}</CardTitle>
              <Activity className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.activeDisruptions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("dashboard.critical", { count: summary.criticalDisruptions })}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono">{t("dashboard.onTimeRate")}</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.onTimeRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("dashboard.avgRiskScore", { score: summary.avgRiskScore.toFixed(1) })}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{t("dashboard.liveDisruptionsFeed")}</CardTitle>
            <Link href="/disruptions" className="text-xs text-primary hover:underline font-mono uppercase tracking-wider">
              {t("dashboard.viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            {isLoadingDisruptions ? (
              <div className="space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : disruptions && disruptions.length > 0 ? (
              <div className="space-y-4">
                {disruptions.slice(0, 5).map(disruption => (
                  <div key={disruption.id} className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded-sm font-mono uppercase font-bold tracking-wider ${
                        disruption.severity === 'critical' ? 'bg-destructive/20 text-destructive' :
                        disruption.severity === 'high' ? 'bg-warning/20 text-warning' :
                        disruption.severity === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {disruption.severity}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{new Date(disruption.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="font-medium text-sm mt-1">{disruption.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{disruption.affectedRegion} • {disruption.type.replace('_', ' ')}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-2 opacity-50 text-emerald-500" />
                <p className="text-sm">{t("dashboard.noActiveDisruptions")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{t("dashboard.highestRiskShipments")}</CardTitle>
            <Link href="/shipments" className="text-xs text-primary hover:underline font-mono uppercase tracking-wider">
              {t("dashboard.viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            {isLoadingRisks ? (
              <div className="space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : riskScores && riskScores.length > 0 ? (
              <div className="space-y-4">
                {riskScores.slice(0, 5).map(risk => (
                  <div key={risk.shipmentId} className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <Link href={`/shipments/${risk.shipmentId}`} className="font-mono text-sm text-primary hover:underline">
                        {risk.trackingId}
                      </Link>
                      <span className={`text-xs font-mono font-bold ${
                        risk.riskScore >= 80 ? 'text-destructive' :
                        risk.riskScore >= 50 ? 'text-warning' : 'text-emerald-500'
                      }`}>
                        SCORE: {risk.riskScore}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {risk.riskFactors.slice(0, 2).map((factor, i) => (
                        <span key={i} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground uppercase tracking-wider">
                          {factor.replace('_', ' ')}
                        </span>
                      ))}
                      {risk.riskFactors.length > 2 && (
                        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5">+{risk.riskFactors.length - 2} more</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Box className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">{t("dashboard.noHighRisk")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
