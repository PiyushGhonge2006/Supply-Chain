import { useListRoutes, useOptimizeRoute } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plane, Ship, Train, Truck, ArrowRight, Zap, Clock, DollarSign, Leaf, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Routes() {
  const { data: routes, isLoading } = useListRoutes();
  const optimizeRoute = useOptimizeRoute();
  const [optimizingId, setOptimizingId] = useState<number | null>(null);
  const { toast } = useToast();

  const getTransportIcon = (mode: string) => {
    switch(mode) {
      case 'air': return <Plane className="h-4 w-4" />;
      case 'sea': return <Ship className="h-4 w-4" />;
      case 'rail': return <Train className="h-4 w-4" />;
      case 'road': return <Truck className="h-4 w-4" />;
      default: return <ArrowRight className="h-4 w-4" />;
    }
  };

  const handleOptimize = (id: number) => {
    setOptimizingId(id);
    optimizeRoute.mutate(
      { id },
      {
        onSuccess: (result) => {
          toast({
            title: "Route Optimized",
            description: `Found ${result.alternatives.length} alternatives. Potential savings: $${result.costSaving}.`,
          });
          setOptimizingId(null);
        },
        onError: () => {
          toast({
            title: "Optimization Failed",
            description: "Failed to run optimization algorithm.",
            variant: "destructive"
          });
          setOptimizingId(null);
        }
      }
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Route Intelligence</h1>
          <p className="text-sm text-muted-foreground">Analyze and optimize logistics network paths</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => (
            <Card key={i} className="bg-card">
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : routes?.map(route => (
          <Card key={route.id} className={`bg-card transition-all ${route.isOptimal ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row items-stretch md:items-center">
                {/* Route Header */}
                <div className="p-6 md:w-1/3 border-b md:border-b-0 md:border-r border-border flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="font-mono text-[10px] uppercase bg-secondary">
                      {route.name}
                    </Badge>
                    {route.isOptimal && (
                      <Badge className="font-mono text-[10px] uppercase bg-primary text-primary-foreground flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Optimal
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-lg font-semibold mt-2">
                    <span>{route.origin}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground mx-2" />
                    <span>{route.destination}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground font-mono uppercase">
                    {getTransportIcon(route.transportMode)}
                    <span>{route.transportMode}</span>
                    <span className="mx-1">•</span>
                    <span>{route.distanceKm.toLocaleString()} KM</span>
                  </div>
                </div>

                {/* Route Metrics */}
                <div className="p-6 md:w-1/2 grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="text-xs text-muted-foreground font-mono uppercase flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Transit
                    </div>
                    <span className="font-medium">{route.estimatedHours}h</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-xs text-muted-foreground font-mono uppercase flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Cost/kg
                    </div>
                    <span className="font-medium">${route.costPerKg.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-xs text-muted-foreground font-mono uppercase flex items-center gap-1">
                      <Leaf className="h-3 w-3" /> Carbon
                    </div>
                    <span className="font-medium">{route.carbonFootprint} kg</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-xs text-muted-foreground font-mono uppercase flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Reliability
                    </div>
                    <span className={`font-medium ${route.reliability >= 90 ? 'text-emerald-500' : route.reliability >= 75 ? 'text-warning' : 'text-destructive'}`}>
                      {route.reliability}%
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-6 md:w-1/6 flex items-center justify-end bg-muted/20 border-t md:border-t-0 md:border-l border-border">
                  <Button 
                    variant={route.isOptimal ? "outline" : "default"}
                    className="w-full font-mono text-xs uppercase tracking-wider"
                    onClick={() => handleOptimize(route.id)}
                    disabled={optimizingId === route.id || route.isOptimal}
                  >
                    {optimizingId === route.id ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Computing</>
                    ) : route.isOptimal ? (
                      'Optimized'
                    ) : (
                      <><Zap className="h-4 w-4 mr-2" /> Run Optimizer</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
