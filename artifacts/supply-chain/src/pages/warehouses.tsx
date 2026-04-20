import { useListWarehouses } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Box, AlertTriangle, Building2, Anchor, Plane, ArrowRightLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Warehouses() {
  const { data: warehouses, isLoading } = useListWarehouses();
  const [search, setSearch] = useState("");

  const getFacilityIcon = (type: string) => {
    switch (type) {
      case 'port': return <Anchor className="h-4 w-4" />;
      case 'airport': return <Plane className="h-4 w-4" />;
      case 'rail_terminal': return <ArrowRightLeft className="h-4 w-4" />;
      default: return <Building2 className="h-4 w-4" />;
    }
  };

  const filteredWarehouses = warehouses?.filter(w => 
    w.name.toLowerCase().includes(search.toLowerCase()) || 
    w.city.toLowerCase().includes(search.toLowerCase()) ||
    w.country.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Facilities & Hubs</h1>
          <p className="text-sm text-muted-foreground">Monitor capacity and congestion across nodes</p>
        </div>
        <div className="w-full sm:w-64 relative">
          <Input 
            placeholder="Search facility or location..." 
            className="w-full bg-card border-border"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="bg-card">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : filteredWarehouses?.map(warehouse => {
          const occupancyRate = (warehouse.currentOccupancy / warehouse.capacity) * 100;
          
          return (
            <Card key={warehouse.id} className="bg-card flex flex-col">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
                    {getFacilityIcon(warehouse.type)}
                    <span>{warehouse.type.replace('_', ' ')}</span>
                  </div>
                  <Badge variant="outline" className={`font-mono text-[10px] uppercase ${
                    warehouse.operationalStatus === 'operational' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                    warehouse.operationalStatus === 'limited' ? 'bg-warning/10 text-warning border-warning/20' :
                    'bg-destructive/10 text-destructive border-destructive/20'
                  }`}>
                    {warehouse.operationalStatus}
                  </Badge>
                </div>
                <CardTitle className="text-lg leading-tight">{warehouse.name}</CardTitle>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3" />
                  {warehouse.city}, {warehouse.country}
                </div>
              </CardHeader>
              
              <CardContent className="pt-4 flex-1 flex flex-col justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-mono uppercase text-muted-foreground">Capacity / Occupancy</span>
                    <span className="text-sm font-medium font-mono">
                      {warehouse.currentOccupancy.toLocaleString()} / {warehouse.capacity.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        occupancyRate >= 90 ? 'bg-destructive' :
                        occupancyRate >= 75 ? 'bg-warning' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                    />
                  </div>
                  <div className="text-right text-[10px] text-muted-foreground font-mono">
                    {occupancyRate.toFixed(1)}% FULL
                  </div>
                </div>

                <div className={`p-3 rounded-md flex items-center justify-between border ${
                  warehouse.congestionLevel === 'critical' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                  warehouse.congestionLevel === 'high' ? 'bg-warning/10 border-warning/20 text-warning' :
                  warehouse.congestionLevel === 'medium' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                  'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                }`}>
                  <div className="flex items-center gap-2">
                    {warehouse.congestionLevel === 'critical' || warehouse.congestionLevel === 'high' ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Box className="h-4 w-4" />
                    )}
                    <span className="text-xs font-mono uppercase tracking-wider font-semibold">Congestion</span>
                  </div>
                  <span className="text-xs font-mono uppercase font-bold tracking-widest">{warehouse.congestionLevel}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
