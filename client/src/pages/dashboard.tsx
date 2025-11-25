import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TrendingUp, DollarSign, BarChart3, Filter, X, CalendarIcon } from "lucide-react";
import type { SurebetSetWithBets, BettingHouseWithAccountHolder } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, TooltipProps } from 'recharts';
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  // Temporary filter states (not applied until "Filtrar" is clicked)
  const [tempStatusFilter, setTempStatusFilter] = useState<string>("all");
  const [tempInsertionDateRange, setTempInsertionDateRange] = useState<DateRange | undefined>();
  const [tempEventDateRange, setTempEventDateRange] = useState<DateRange | undefined>();
  const [tempHouseFilter, setTempHouseFilter] = useState<string>("all");

  // Applied filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [insertionDateRange, setInsertionDateRange] = useState<DateRange | undefined>();
  const [eventDateRange, setEventDateRange] = useState<DateRange | undefined>();
  const [houseFilter, setHouseFilter] = useState<string>("all");

  const { data: surebetSets = [], isLoading } = useQuery<SurebetSetWithBets[]>({
    queryKey: ["/api/surebet-sets"],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: bettingHouses = [] } = useQuery<BettingHouseWithAccountHolder[]>({
    queryKey: ["/api/betting-houses"],
    staleTime: 300000,
  });

  const applyFilters = () => {
    setStatusFilter(tempStatusFilter);
    setInsertionDateRange(tempInsertionDateRange);
    setEventDateRange(tempEventDateRange);
    setHouseFilter(tempHouseFilter);
  };

  const clearFilters = () => {
    setTempStatusFilter("all");
    setTempInsertionDateRange(undefined);
    setTempEventDateRange(undefined);
    setTempHouseFilter("all");
    
    setStatusFilter("all");
    setInsertionDateRange(undefined);
    setEventDateRange(undefined);
    setHouseFilter("all");
  };

  const filteredBets = useMemo(() => {
    return surebetSets.filter((set) => {
      if (statusFilter === "pending" && set.status !== "pending") return false;
      if (statusFilter === "resolved" && set.status !== "resolved") return false;

      if (insertionDateRange?.from && set.createdAt) {
        const insertDate = new Date(set.createdAt);
        const fromDate = new Date(insertionDateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        if (insertDate < fromDate) return false;
      }

      if (insertionDateRange?.to && set.createdAt) {
        const insertDate = new Date(set.createdAt);
        const toDate = new Date(insertionDateRange.to);
        toDate.setHours(23, 59, 59, 999);
        if (insertDate > toDate) return false;
      }

      if (eventDateRange?.from && set.eventDate) {
        const evtDate = new Date(set.eventDate);
        const fromDate = new Date(eventDateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        if (evtDate < fromDate) return false;
      }

      if (eventDateRange?.to && set.eventDate) {
        const evtDate = new Date(set.eventDate);
        const toDate = new Date(eventDateRange.to);
        toDate.setHours(23, 59, 59, 999);
        if (evtDate > toDate) return false;
      }

      if (houseFilter !== "all") {
        const hasHouse = set.bets.some(bet => bet.bettingHouse.name === houseFilter);
        if (!hasHouse) return false;
      }

      return true;
    });
  }, [surebetSets, statusFilter, insertionDateRange, eventDateRange, houseFilter]);

  const totalBets = filteredBets.length;
  const pendingBets = filteredBets.filter(set => set.status === "pending").length;
  const resolvedBets = filteredBets.filter(set => set.status === "resolved").length;

  const totalInvested = filteredBets.reduce((acc, set) => {
    return acc + set.bets.reduce((sum, bet) => sum + parseFloat(bet.stake), 0);
  }, 0);

  const totalInvestedPending = filteredBets
    .filter(set => set.status === "pending")
    .reduce((acc, set) => {
      return acc + set.bets.reduce((sum, bet) => sum + parseFloat(bet.stake), 0);
    }, 0);

  const totalInvestedResolved = filteredBets
    .filter(set => set.status === "resolved")
    .reduce((acc, set) => {
      return acc + set.bets.reduce((sum, bet) => sum + parseFloat(bet.stake), 0);
    }, 0);

  const totalProfitResolved = filteredBets
    .filter(set => set.status === "resolved")
    .reduce((acc, set) => {
      // Use actualProfit from database (both bets have same value)
      const firstBet = set.bets[0];
      if (firstBet?.actualProfit !== undefined && firstBet?.actualProfit !== null) {
        return acc + parseFloat(String(firstBet.actualProfit));
      }
      return acc;
    }, 0);

  const totalProfitPending = filteredBets
    .filter(set => set.status === "pending")
    .reduce((acc, set) => {
      const sortedBets = [...set.bets].sort((a, b) => 
        new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()
      );
      const bet1 = sortedBets[0];
      if (!bet1) return acc;
      return acc + parseFloat(bet1.potentialProfit);
    }, 0);

  const totalProfitTotal = totalProfitResolved + totalProfitPending;

  const chartData = useMemo(() => {
    const resolvedBets = filteredBets
      .filter(set => set.status === "resolved")
      .map(set => {
        // Use actualProfit from database
        const firstBet = set.bets[0];
        const profit = (firstBet?.actualProfit !== undefined && firstBet?.actualProfit !== null) 
          ? parseFloat(String(firstBet.actualProfit)) 
          : 0;

        const insertionDate = set.createdAt ? new Date(set.createdAt) : new Date();
        const year = insertionDate.getFullYear();
        const month = String(insertionDate.getMonth() + 1).padStart(2, '0');
        const day = String(insertionDate.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;

        return {
          date: dateKey,
          profit: profit,
          insertionDate: insertionDate.getTime()
        };
      })
      .sort((a, b) => a.insertionDate - b.insertionDate);

    const dailyProfits = new Map<string, number>();
    resolvedBets.forEach(bet => {
      const current = dailyProfits.get(bet.date) || 0;
      dailyProfits.set(bet.date, current + bet.profit);
    });

    const sortedDates = Array.from(dailyProfits.keys()).sort();
    
    let accumulated = 0;
    return sortedDates.map(date => {
      const dayProfit = dailyProfits.get(date) || 0;
      accumulated += dayProfit;
      const [year, month, day] = date.split('-');
      return {
        date: `${day}/${month}`,
        lucroAcumulado: parseFloat(accumulated.toFixed(2)),
        lucroDoDia: parseFloat(dayProfit.toFixed(2))
      };
    });
  }, [filteredBets]);

  const uniqueHouses = Array.from(new Set(bettingHouses.map(h => h.name))).sort();

  const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{data.date}</p>
          <p className="text-sm text-primary font-medium">
            Lucro Acumulado: R$ {data.lucroAcumulado.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground">
            Lucro do Dia: R$ {data.lucroDoDia.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Visualize o desempenho das suas apostas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <Select value={tempStatusFilter} onValueChange={setTempStatusFilter}>
                  <SelectTrigger id="status-filter" data-testid="select-status-filter">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="resolved">Resolvida</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de Inserção</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !tempInsertionDateRange && "text-muted-foreground"
                      )}
                      data-testid="button-insertion-date-range"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempInsertionDateRange?.from ? (
                        tempInsertionDateRange.to ? (
                          <>
                            {format(tempInsertionDateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                            {format(tempInsertionDateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                          </>
                        ) : (
                          format(tempInsertionDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        )
                      ) : (
                        <span>Selecione o período</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={tempInsertionDateRange}
                      onSelect={setTempInsertionDateRange}
                      numberOfMonths={2}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Data do Jogo</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !tempEventDateRange && "text-muted-foreground"
                      )}
                      data-testid="button-event-date-range"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempEventDateRange?.from ? (
                        tempEventDateRange.to ? (
                          <>
                            {format(tempEventDateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                            {format(tempEventDateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                          </>
                        ) : (
                          format(tempEventDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        )
                      ) : (
                        <span>Selecione o período</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={tempEventDateRange}
                      onSelect={setTempEventDateRange}
                      numberOfMonths={2}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="house-filter">Casa de Aposta</Label>
                <Select value={tempHouseFilter} onValueChange={setTempHouseFilter}>
                  <SelectTrigger id="house-filter" data-testid="select-house-filter">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {uniqueHouses.map(house => (
                      <SelectItem key={house} value={house}>{house}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={applyFilters} data-testid="button-apply-filters">
                <Filter className="w-4 h-4 mr-2" />
                Filtrar
              </Button>
              <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters">
                <X className="w-4 h-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Apostas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-bets">{totalBets}</div>
            <p className="text-xs text-muted-foreground">
              {pendingBets} pendentes • {resolvedBets} resolvidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investido Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-invested">
              R$ {totalInvested.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pendente: R$ {totalInvestedPending.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              Resolvido: R$ {totalInvestedResolved.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Resolvido</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfitResolved >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="stat-profit-resolved">
              R$ {totalProfitResolved.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Apostas já finalizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Pendente</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfitPending >= 0 ? 'text-blue-600' : 'text-orange-600'}`} data-testid="stat-profit-pending">
              R$ {totalProfitPending.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Lucro potencial estimado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfitTotal >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="stat-profit-total">
              R$ {totalProfitTotal.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Resolvido + Pendente
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lucro Acumulado ao Longo do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              Nenhuma aposta resolvida para exibir no gráfico
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  label={{ value: 'Data', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  label={{ value: 'Lucro (R$)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="lucroAcumulado" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  name="Lucro Acumulado"
                  dot={{ fill: '#2563eb', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
