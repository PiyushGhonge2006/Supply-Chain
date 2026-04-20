import { useRoute } from "wouter";
import { useGetShipment, useGetRiskScores } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Navigation, Clock, Box, AlertTriangle, ShieldAlert, Navigation2, FileText, Weight, DollarSign, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ShipmentDetail() {
  const [, params] = useRoute("/shipments/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  
  const { data: shipment, isLoading } = useGetShipment(id, { query: { enabled: !!id } });
  const { data: riskScores } = useGetRiskScores();
  
  const riskDetail = riskScores?.find(r => r.shipmentId === id);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 col-span-2" />
          <Skeleton className="h-64 col-span-1" />
        </div>
      </div>
    );
  }

  if (!shipment) {
    return <div className="p-8 text-center text-muted-foreground">Shipment not found</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight font-mono">{shipment.trackingId}</h1>
            <Badge variant="outline" className={`
              ${shipment.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : ''}
              ${shipment.status === 'delayed' ? 'bg-warning/10 text-warning border-warning/20' : ''}
              ${shipment.status === 'at_risk' ? 'bg-destructive/10 text-destructive border-destructive/20' : ''}
              ${shipment.status === 'in_transit' ? 'bg-primary/10 text-primary border-primary/20' : ''}
              uppercase tracking-wider text-xs
            `}>
              {shipment.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Carrier: {shipment.carrier}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="font-mono text-xs uppercase tracking-wider">Update Status</Button>
          <Button variant="default" className="font-mono text-xs uppercase tracking-wider">Optimize Route</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col gap-6">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-mono uppercase tracking-widest text-muted-foreground">Route & Transit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8 py-4 relative">
                <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-secondary -translate-y-1/2 hidden sm:block z-0" />
                
                <div className="flex flex-col items-center gap-2 relative z-10 w-full sm:w-auto text-center sm:text-left bg-card px-2">
                  <div className="w-10 h-10 rounded-full bg-secondary border-2 border-border flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-mono uppercase">Origin</p>
                    <p className="font-semibold text-sm">{shipment.origin}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 relative z-10 w-full sm:w-auto text-center bg-card px-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                    <Navigation2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-primary font-mono uppercase animate-pulse">Current</p>
                    <p className="font-semibold text-sm">{shipment.currentLocation}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 relative z-10 w-full sm:w-auto text-center sm:text-right bg-card px-2">
                  <div className="w-10 h-10 rounded-full bg-secondary border-2 border-border flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-mono uppercase">Destination</p>
                    <p className="font-semibold text-sm">{shipment.destination}</p>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className="text-xs font-mono uppercase">Est. Delivery</span>
                  </div>
                  <span className="font-medium text-sm">
                    {new Date(shipment.estimatedDelivery).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Navigation className="h-3 w-3" />
                    <span className="text-xs font-mono uppercase">Mode</span>
                  </div>
                  <span className="font-medium text-sm capitalize">{shipment.transportMode}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Weight className="h-3 w-3" />
                    <span className="text-xs font-mono uppercase">Weight</span>
                  </div>
                  <span className="font-medium text-sm">{shipment.weight.toLocaleString()} kg</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <DollarSign className="h-3 w-3" />
                    <span className="text-xs font-mono uppercase">Cost</span>
                  </div>
                  <span className="font-medium text-sm">${shipment.cost.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {shipment.notes && (
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-lg font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/80 leading-relaxed">{shipment.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card className="bg-card border-t-4 border-t-warning">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-mono uppercase tracking-widest flex items-center justify-between">
                Risk Analysis
                <ShieldAlert className="h-5 w-5 text-warning" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Risk Score</p>
                    <div className={`text-4xl font-mono font-bold leading-none ${
                      shipment.riskScore >= 80 ? 'text-destructive' :
                      shipment.riskScore >= 50 ? 'text-warning' : 'text-emerald-500'
                    }`}>
                      {shipment.riskScore}
                      <span className="text-sm text-muted-foreground ml-1 font-sans font-normal">/100</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono uppercase">
                    <span className="text-muted-foreground">Delay Probability</span>
                    <span className={shipment.delayProbability > 0.5 ? 'text-destructive' : 'text-foreground'}>
                      {(shipment.delayProbability * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        shipment.delayProbability > 0.7 ? 'bg-destructive' :
                        shipment.delayProbability > 0.4 ? 'bg-warning' : 'bg-primary'
                      }`}
                      style={{ width: `${shipment.delayProbability * 100}%` }}
                    />
                  </div>
                </div>

                {riskDetail && riskDetail.riskFactors.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Identified Factors</p>
                    <div className="flex flex-wrap gap-2">
                      {riskDetail.riskFactors.map((factor, i) => (
                        <Badge key={i} variant="outline" className="bg-secondary/50 text-xs">
                          {factor.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {shipment.estimatedDelayhours > 0 && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 flex items-start gap-3 mt-2">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Estimated Delay</p>
                      <p className="text-xs text-destructive/80 mt-1">
                        Model predicts a delay of {shipment.estimatedDelayhours} hours based on current conditions.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6 border-l-2 border-secondary space-y-6">
                <div className="relative">
                  <div className="absolute w-3 h-3 bg-card border-2 border-primary rounded-full -left-[1.65rem] top-1" />
                  <p className="text-sm font-medium">Record Created</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(shipment.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="relative opacity-50">
                  <div className="absolute w-3 h-3 bg-secondary rounded-full -left-[1.65rem] top-1" />
                  <p className="text-sm font-medium">Estimated Arrival</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(shipment.estimatedDelivery).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
