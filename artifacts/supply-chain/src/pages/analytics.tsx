import { useGetDelayForecast, useGetDisruptionTrends, useGetCostBreakdown } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";

export default function Analytics() {
  const { data: delays, isLoading: isLoadingDelays } = useGetDelayForecast();
  const { data: trends, isLoading: isLoadingTrends } = useGetDisruptionTrends();
  const { data: costs, isLoading: isLoadingCosts } = useGetCostBreakdown();

  const PIE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Network Analytics</h1>
        <p className="text-sm text-muted-foreground">Historical data and predictive modeling</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delay Forecast Chart */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Predictive Delay Forecast</CardTitle>
            <CardDescription>Estimated average delay hours over next 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingDelays ? (
              <Skeleton className="h-[300px] w-full" />
            ) : delays && delays.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={delays} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDelay" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {weekday: 'short'})}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString()}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="predictedAvgDelayHours" 
                      name="Avg Delay (hrs)"
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorDelay)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        {/* Disruption Trends Chart */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Disruption Causality Trends</CardTitle>
            <CardDescription>Volume of disruptions by type over time</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTrends ? (
              <Skeleton className="h-[300px] w-full" />
            ) : trends && trends.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString()}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="weather" stackId="a" fill="hsl(var(--chart-1))" />
                    <Bar dataKey="traffic" stackId="a" fill="hsl(var(--chart-2))" />
                    <Bar dataKey="port_congestion" name="Port" stackId="a" fill="hsl(var(--chart-3))" />
                    <Bar dataKey="mechanical" stackId="a" fill="hsl(var(--chart-4))" />
                    <Bar dataKey="other" stackId="a" fill="hsl(var(--muted))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        {/* Cost Breakdown */}
        <Card className="bg-card col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Transport Mode Economics</CardTitle>
            <CardDescription>Cost and reliability distribution across transport modes</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCosts ? (
              <Skeleton className="h-[300px] w-full" />
            ) : costs && costs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-auto min-h-[300px]">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={costs}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="shipmentCount"
                        nameKey="mode"
                      >
                        {costs.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(value) => [`${value} shipments`, 'Volume']}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} layout="vertical" verticalAlign="middle" align="right" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {costs.map((mode, i) => (
                    <div key={mode.mode} className="bg-muted/30 rounded-lg p-4 border border-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="font-mono uppercase text-xs font-bold tracking-wider">{mode.mode}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Avg Cost/kg</span>
                          <span className="font-mono">${mode.avgCostPerKg.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Reliability</span>
                          <span className="font-mono">{mode.reliability}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Carbon</span>
                          <span className="font-mono">{mode.carbonFootprint}kg</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
