import { useState } from "react";
import { useListDisruptions } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, AlertTriangle, Activity, Map, Clock, CheckCircle2 } from "lucide-react";
import type { ListDisruptionsSeverity } from "@workspace/api-client-react";

export default function Disruptions() {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: disruptions, isLoading } = useListDisruptions({
    severity: severityFilter !== "all" ? severityFilter as ListDisruptionsSeverity : undefined
  });

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-destructive bg-destructive/10 text-destructive';
      case 'high': return 'border-warning bg-warning/10 text-warning';
      case 'medium': return 'border-blue-500 bg-blue-500/10 text-blue-400';
      default: return 'border-border bg-secondary text-muted-foreground';
    }
  };

  const filteredDisruptions = disruptions?.filter(d => 
    d.title.toLowerCase().includes(search.toLowerCase()) || 
    d.affectedRegion.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Global Disruptions</h1>
          <p className="text-sm text-muted-foreground">Monitor incidents affecting supply chain operations</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search incident or region..." 
              className="pl-9 bg-card border-border w-full"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-full sm:w-[150px] bg-card border-border">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="bg-card">
              <CardHeader className="pb-2">
                <div className="h-6 bg-muted animate-pulse rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted animate-pulse rounded w-full mb-4"></div>
                <div className="flex gap-2">
                  <div className="h-8 bg-muted animate-pulse rounded w-1/3"></div>
                  <div className="h-8 bg-muted animate-pulse rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredDisruptions?.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg bg-card/50">
            <CheckCircle2 className="h-12 w-12 text-emerald-500/50 mb-3" />
            <p className="text-lg font-medium">No disruptions found</p>
            <p className="text-sm">Operations are running normally in all monitored regions.</p>
          </div>
        ) : (
          filteredDisruptions?.map((disruption) => (
            <Card key={disruption.id} className={`bg-card overflow-hidden flex flex-col ${disruption.resolved ? 'opacity-70' : ''}`}>
              <div className={`h-1.5 w-full ${getSeverityStyles(disruption.severity).split(' ')[0].replace('border-', 'bg-')}`} />
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className={`font-mono uppercase tracking-widest text-[10px] ${getSeverityStyles(disruption.severity)}`}>
                    {disruption.severity}
                  </Badge>
                  {disruption.resolved && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                      Resolved
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base font-semibold leading-tight">{disruption.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {disruption.description}
                </p>
                <div className="space-y-3 mt-auto pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 text-xs text-foreground/80">
                    <Map className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{disruption.affectedRegion}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-foreground/80">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="capitalize">{disruption.type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-foreground/80">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Est. Impact: <span className="font-mono font-medium">{disruption.estimatedImpactHours}h</span></span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
