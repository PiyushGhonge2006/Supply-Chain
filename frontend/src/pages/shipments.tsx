import { useState } from "react";
import { useListShipments } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MapPin, Box, Plane, Ship, Train, Truck } from "lucide-react";
import type { ShipmentStatus } from "@workspace/api-client-react";

export default function Shipments() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: shipments, isLoading } = useListShipments({ 
    status: statusFilter !== "all" ? statusFilter as ShipmentStatus : undefined 
  });

  const getTransportIcon = (mode: string) => {
    switch(mode) {
      case 'air': return <Plane className="h-3 w-3" />;
      case 'sea': return <Ship className="h-3 w-3" />;
      case 'rail': return <Train className="h-3 w-3" />;
      case 'road': return <Truck className="h-3 w-3" />;
      default: return <Box className="h-3 w-3" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'delivered': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Delivered</Badge>;
      case 'delayed': return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Delayed</Badge>;
      case 'at_risk': return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">At Risk</Badge>;
      case 'in_transit': return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">In Transit</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const filteredShipments = shipments?.filter(s => 
    s.trackingId.toLowerCase().includes(search.toLowerCase()) || 
    s.origin.toLowerCase().includes(search.toLowerCase()) ||
    s.destination.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Shipment Registry</h1>
          <p className="text-sm text-muted-foreground">Monitor and manage global transit</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search tracking ID or location..." 
              className="pl-9 bg-card border-border w-full"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px] bg-card border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="delayed">Delayed</SelectItem>
              <SelectItem value="at_risk">At Risk</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-mono text-xs uppercase">Tracking ID</TableHead>
                <TableHead className="font-mono text-xs uppercase">Status</TableHead>
                <TableHead className="font-mono text-xs uppercase">Route</TableHead>
                <TableHead className="font-mono text-xs uppercase">Mode</TableHead>
                <TableHead className="font-mono text-xs uppercase">Risk</TableHead>
                <TableHead className="font-mono text-xs uppercase text-right">ETA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(10).fill(0).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredShipments?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No shipments found matching criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredShipments?.map((shipment) => (
                  <TableRow key={shipment.id} className="border-border border-b hover:bg-muted/30 transition-colors group cursor-pointer">
                    <TableCell className="font-mono text-sm font-medium">
                      <Link href={`/shipments/${shipment.id}`} className="text-primary hover:underline">
                        {shipment.trackingId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(shipment.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm max-w-[200px] truncate">
                        <span className="truncate">{shipment.origin}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="truncate">{shipment.destination}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        {getTransportIcon(shipment.transportMode)}
                        {shipment.transportMode}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              shipment.riskScore >= 80 ? 'bg-destructive' :
                              shipment.riskScore >= 50 ? 'bg-warning' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${shipment.riskScore}%` }}
                          />
                        </div>
                        <span className={`text-xs font-mono font-medium ${
                          shipment.riskScore >= 80 ? 'text-destructive' :
                          shipment.riskScore >= 50 ? 'text-warning' : 'text-emerald-500'
                        }`}>
                          {shipment.riskScore}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {new Date(shipment.estimatedDelivery).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
