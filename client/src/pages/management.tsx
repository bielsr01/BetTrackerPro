import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BetCard } from "@/components/bet-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { TrendingUp, DollarSign, Clock, CheckCircle, XCircle, X, ArrowUpDown, Plus, RotateCcw, Loader2, RefreshCw, TrendingDown, ListChecks } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SurebetSetWithBets, BettingHouse, BettingHouseWithAccountHolder } from "@shared/schema";
import type { DateRange } from "react-day-picker";

interface FilterValues {
  status?: string;
  checked?: string;
  house?: string;
  eventDateRange?: DateRange;
  createdDateRange?: DateRange;
}

const removeAccents = (str: string): string => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

export default function Management() {
  const [filters, setFilters] = useState<FilterValues>({ status: 'pending' });
  const [tempFilters, setTempFilters] = useState<FilterValues>({ status: 'pending' });
  const [chronologicalSort, setChronologicalSort] = useState(true);
  const [, setLocation] = useLocation();
  const [editingBet, setEditingBet] = useState<any>(null);
  const [editingNumericFields, setEditingNumericFields] = useState<{
    profitPercentage: string;
    bet1Odd: string;
    bet1Stake: string;
    bet2Odd: string;
    bet2Stake: string;
  }>({ profitPercentage: '', bet1Odd: '', bet1Stake: '', bet2Odd: '', bet2Stake: '' });
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [timeDisplay, setTimeDisplay] = useState('Agora mesmo');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingBetId, setDeletingBetId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);

      if (diffInSeconds < 60) {
        setTimeDisplay(`Há ${diffInSeconds}s`);
      } else if (diffInSeconds < 3600) {
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        setTimeDisplay(`Há ${diffInMinutes}m`);
      } else if (diffInSeconds < 86400) {
        const diffInHours = Math.floor(diffInSeconds / 3600);
        setTimeDisplay(`Há ${diffInHours}h`);
      } else {
        const diffInDays = Math.floor(diffInSeconds / 86400);
        setTimeDisplay(`Há ${diffInDays}d`);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [lastUpdate]);

  // Load surebet sets from the API - optimized with staleTime
  const { data: surebetSets = [], isLoading, refetch, error } = useQuery<SurebetSetWithBets[]>({
    queryKey: ["/api/surebet-sets"],
    staleTime: 30000, // Cache for 30 seconds to optimize performance
    refetchInterval: 60000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      setLastUpdate(new Date());
      setTimeDisplay('Agora mesmo');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load betting houses from API - optimized with staleTime
  const { data: bettingHouses = [] } = useQuery<BettingHouseWithAccountHolder[]>({
    queryKey: ["/api/betting-houses"],
    staleTime: 300000, // Cache for 5 minutes (betting houses don't change often)
  });

  // Mutation for updating bet results
  const updateBetMutation = useMutation({
    mutationFn: async ({ betId, result }: { betId: string; result: "won" | "lost" | "returned" | "half_won" | "half_returned" }) => {
      const response = await apiRequest("PUT", `/api/bets/${betId}`, { result });
      return response.json();
    },
    onMutate: async ({ betId, result }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/surebet-sets"] });
      const previousData = queryClient.getQueryData<SurebetSetWithBets[]>(["/api/surebet-sets"]);

      queryClient.setQueryData<SurebetSetWithBets[]>(["/api/surebet-sets"], (old) => {
        if (!old) return old;
        return old.map(set => {
          // Check if this set contains the bet being updated
          const hasBet = set.bets.some(b => b.id === betId);
          if (!hasBet) return set;

          // Clear actualProfit for ALL bets in the set to avoid showing stale values
          const updatedBets = set.bets.map(bet => 
            bet.id === betId 
              ? { ...bet, result, actualProfit: null }
              : { ...bet, actualProfit: null }
          );
          
          const allHaveResults = updatedBets.every(b => b.result != null);
          return {
            ...set,
            bets: updatedBets,
            status: allHaveResults ? "resolved" : set.status
          };
        });
      });

      return { previousData };
    },
    onSuccess: (updatedBet) => {
      // Update all bets in the set with the actualProfit from backend
      queryClient.setQueryData<SurebetSetWithBets[]>(["/api/surebet-sets"], (old) => {
        if (!old) return old;
        return old.map(set => {
          const hasBet = set.bets.some(b => b.id === updatedBet.id);
          if (!hasBet) return set;

          // Update ALL bets in the set with the actualProfit (backend calculated it for all)
          const updatedBets = set.bets.map(bet => 
            bet.id === updatedBet.id 
              ? { ...bet, ...updatedBet } // Update the modified bet
              : updatedBet.actualProfit !== null && updatedBet.actualProfit !== undefined
                ? { ...bet, actualProfit: updatedBet.actualProfit } // Sync actualProfit to siblings
                : bet
          );
          
          return {
            ...set,
            bets: updatedBets,
            status: updatedBet.actualProfit !== null ? "resolved" : set.status
          };
        });
      });
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["/api/surebet-sets"], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surebet-sets"] });
      setLastUpdate(new Date());
      setTimeDisplay('Agora mesmo');
    },
  });

  // Mutation for checking/unchecking surebet set
  const updateStatusMutation = useMutation({
    mutationFn: async ({ surebetSetId, isChecked }: { surebetSetId: string; isChecked: boolean }) => {
      const response = await apiRequest("PATCH", `/api/surebet-sets/${surebetSetId}/status`, { isChecked });
      return response.json();
    },
    onMutate: async ({ surebetSetId, isChecked }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/surebet-sets"] });
      const previousData = queryClient.getQueryData<SurebetSetWithBets[]>(["/api/surebet-sets"]);

      queryClient.setQueryData<SurebetSetWithBets[]>(["/api/surebet-sets"], (old) => {
        if (!old) return old;
        return old.map(set => 
          set.id === surebetSetId ? { ...set, isChecked } : set
        );
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["/api/surebet-sets"], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surebet-sets"] });
      setLastUpdate(new Date());
      setTimeDisplay('Agora mesmo');
    },
  });

  // Mutation for reset
  const resetMutation = useMutation({
    mutationFn: async (surebetSetId: string) => {
      const response = await apiRequest("POST", `/api/surebet-sets/${surebetSetId}/reset`);
      return response.json();
    },
    onMutate: async (surebetSetId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/surebet-sets"] });
      const previousData = queryClient.getQueryData<SurebetSetWithBets[]>(["/api/surebet-sets"]);

      queryClient.setQueryData<SurebetSetWithBets[]>(["/api/surebet-sets"], (old) => {
        if (!old) return old;
        return old.map(set => {
          if (set.id === surebetSetId) {
            return {
              ...set,
              status: "pending",
              bets: set.bets.map(bet => ({
                ...bet,
                result: null,
                actualProfit: null
              }))
            };
          }
          return set;
        });
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["/api/surebet-sets"], context.previousData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surebet-sets"] });
      setLastUpdate(new Date());
      setTimeDisplay('Agora mesmo');
    },
  });

  // Mutation for delete with optimistic update
  const deleteMutation = useMutation({
    mutationFn: async (surebetSetId: string) => {
      const response = await apiRequest("DELETE", `/api/surebet-sets/${surebetSetId}`);
      return response.json();
    },
    onMutate: async (surebetSetId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/surebet-sets"] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<SurebetSetWithBets[]>(["/api/surebet-sets"]);

      // Optimistically remove the bet from the list
      queryClient.setQueryData<SurebetSetWithBets[]>(["/api/surebet-sets"], (old) => {
        if (!old) return old;
        return old.filter(set => set.id !== surebetSetId);
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(["/api/surebet-sets"], context.previousData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surebet-sets"] });
      setLastUpdate(new Date());
      setTimeDisplay('Agora mesmo');
      setDeletingBetId(null);
    },
  });

  // Mutation for updating surebet set and bets
  const updateSurebetMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PUT", `/api/surebet-sets/${data.id}`, {
        eventDate: data.eventDate,
        sport: data.sport,
        league: data.league,
        teamA: data.teamA,
        teamB: data.teamB,
        profitPercentage: String(data.profitPercentage),
      });

      await apiRequest("PUT", `/api/bets/${data.bet1.id}`, {
        bettingHouseId: data.bet1.bettingHouseId,
        betType: data.bet1.betType,
        odd: String(data.bet1.odd),
        stake: String(data.bet1.stake),
      });

      await apiRequest("PUT", `/api/bets/${data.bet2.id}`, {
        bettingHouseId: data.bet2.bettingHouseId,
        betType: data.bet2.betType,
        odd: String(data.bet2.odd),
        stake: String(data.bet2.stake),
      });
      
      return data;
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/surebet-sets"] });
      const previousData = queryClient.getQueryData<SurebetSetWithBets[]>(["/api/surebet-sets"]);

      queryClient.setQueryData<SurebetSetWithBets[]>(["/api/surebet-sets"], (old) => {
        if (!old) return old;
        return old.map(set => {
          if (set.id === data.id) {
            return {
              ...set,
              eventDate: data.eventDate,
              sport: data.sport,
              league: data.league,
              teamA: data.teamA,
              teamB: data.teamB,
              profitPercentage: String(data.profitPercentage),
              bets: set.bets.map((bet, index) => {
                if (index === 0) {
                  return {
                    ...bet,
                    bettingHouseId: data.bet1.bettingHouseId,
                    betType: data.bet1.betType,
                    odd: String(data.bet1.odd),
                    stake: String(data.bet1.stake),
                  };
                } else {
                  return {
                    ...bet,
                    bettingHouseId: data.bet2.bettingHouseId,
                    betType: data.bet2.betType,
                    odd: String(data.bet2.odd),
                    stake: String(data.bet2.stake),
                  };
                }
              })
            };
          }
          return set;
        });
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["/api/surebet-sets"], context.previousData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surebet-sets"] });
      setEditingBet(null);
      setLastUpdate(new Date());
      setTimeDisplay('Agora mesmo');
    },
  });

  // Transform data
  const transformedBets = (surebetSets || [])
    .map((set) => {
      // Backend já ordena as apostas por createdAt - não reordenar aqui
      const sortedBets = set.bets;

      return {
        id: set.id,
        eventDate: typeof set.eventDate === 'string' ? set.eventDate : (set.eventDate instanceof Date ? set.eventDate.toISOString() : new Date().toISOString()),
        createdAt: typeof set.createdAt === 'string' ? set.createdAt : (set.createdAt instanceof Date ? set.createdAt.toISOString() : new Date().toISOString()),
        sport: set.sport || "N/A",
        league: set.league || "N/A",
        teamA: set.teamA || "Time A",
        teamB: set.teamB || "Time B",
        profitPercentage: Number(set.profitPercentage) || 0,
        status: (set.status || "pending") as "pending" | "resolved",
        isChecked: set.isChecked || false,
        bet1: {
          id: sortedBets[0]?.id || "",
          bettingHouseId: sortedBets[0]?.bettingHouseId || "",
          house: sortedBets[0]?.bettingHouse?.name || "Casa 1",
          accountHolder: sortedBets[0]?.bettingHouse?.accountHolder?.name || "",
          betType: sortedBets[0]?.betType || "N/A",
          odd: Number(sortedBets[0]?.odd) || 0,
          stake: Number(sortedBets[0]?.stake) || 0,
          potentialProfit: Number(sortedBets[0]?.potentialProfit) || 0,
          actualProfit: sortedBets[0]?.actualProfit !== undefined && sortedBets[0]?.actualProfit !== null ? Number(sortedBets[0].actualProfit) : undefined,
          result: sortedBets[0]?.result as "won" | "lost" | "returned" | "half_won" | "half_returned" | undefined,
        },
        bet2: {
          id: sortedBets[1]?.id || "",
          bettingHouseId: sortedBets[1]?.bettingHouseId || "",
          house: sortedBets[1]?.bettingHouse?.name || "Casa 2",
          accountHolder: sortedBets[1]?.bettingHouse?.accountHolder?.name || "",
          betType: sortedBets[1]?.betType || "N/A",
          odd: Number(sortedBets[1]?.odd) || 0,
          stake: Number(sortedBets[1]?.stake) || 0,
          potentialProfit: Number(sortedBets[1]?.potentialProfit) || 0,
          actualProfit: sortedBets[1]?.actualProfit !== undefined && sortedBets[1]?.actualProfit !== null ? Number(sortedBets[1].actualProfit) : undefined,
          result: sortedBets[1]?.result as "won" | "lost" | "returned" | "half_won" | "half_returned" | undefined,
        },
        // bet3 is optional - only include if there's a third bet
        ...(sortedBets[2] && {
          bet3: {
            id: sortedBets[2].id,
            bettingHouseId: sortedBets[2].bettingHouseId,
            house: sortedBets[2].bettingHouse?.name || "Casa 3",
            accountHolder: sortedBets[2].bettingHouse?.accountHolder?.name || "",
            betType: sortedBets[2].betType || "N/A",
            odd: Number(sortedBets[2].odd) || 0,
            stake: Number(sortedBets[2].stake) || 0,
            potentialProfit: Number(sortedBets[2].potentialProfit) || 0,
            actualProfit: sortedBets[2].actualProfit !== undefined && sortedBets[2].actualProfit !== null ? Number(sortedBets[2].actualProfit) : undefined,
            result: sortedBets[2].result as "won" | "lost" | "returned" | "half_won" | "half_returned" | undefined,
          }
        }),
      };
    });

  // Apply filters
  const filteredBets = transformedBets.filter((bet) => {
    // Apply search query filter
    if (searchQuery) {
      const query = removeAccents(searchQuery.toLowerCase().trim());
      const searchableText = removeAccents(`${bet.teamA} ${bet.teamB} ${bet.sport} ${bet.league}`.toLowerCase());
      if (!searchableText.includes(query)) {
        return false;
      }
    }

    if (filters.status && bet.status !== filters.status) return false;
    
    if (filters.checked) {
      // Filtro de conferência só mostra apostas pendentes
      if (bet.status !== "pending") return false;
      if (filters.checked === "checked" && !bet.isChecked) return false;
      if (filters.checked === "unchecked" && bet.isChecked) return false;
    }
    
    if (filters.house) {
      const hasHouse = bet.bet1.house === filters.house || bet.bet2.house === filters.house;
      if (!hasHouse) return false;
    }

    if (filters.eventDateRange?.from || filters.eventDateRange?.to) {
      const eventDate = new Date(bet.eventDate);
      if (filters.eventDateRange.from) {
        const fromDate = new Date(filters.eventDateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        if (eventDate < fromDate) return false;
      }
      if (filters.eventDateRange.to) {
        const toDate = new Date(filters.eventDateRange.to);
        toDate.setHours(23, 59, 59, 999);
        if (eventDate > toDate) return false;
      }
    }

    if (filters.createdDateRange?.from || filters.createdDateRange?.to) {
      const createdDate = new Date(bet.createdAt);
      if (filters.createdDateRange.from) {
        const fromDate = new Date(filters.createdDateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        if (createdDate < fromDate) return false;
      }
      if (filters.createdDateRange.to) {
        const toDate = new Date(filters.createdDateRange.to);
        toDate.setHours(23, 59, 59, 999);
        if (createdDate > toDate) return false;
      }
    }

    return true;
  })
  .sort((a, b) => {
    if (chronologicalSort) {
      // Ordenar por data do evento (mais antiga primeiro)
      return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
    }
    // Ordenação padrão (por ordem de criação)
    return 0;
  });

  // Calculate metrics
  const pendingBets = filteredBets.filter(bet => bet.status === "pending");
  const resolvedBets = filteredBets.filter(bet => bet.status === "resolved");

  // Calculate stakes (supports 2 or 3 bets)
  const totalStakePending = pendingBets.reduce((sum, bet) => {
    let stake = bet.bet1.stake + bet.bet2.stake;
    if (bet.bet3) stake += bet.bet3.stake;
    return sum + stake;
  }, 0);
  
  const totalStakeResolved = resolvedBets.reduce((sum, bet) => {
    let stake = bet.bet1.stake + bet.bet2.stake;
    if (bet.bet3) stake += bet.bet3.stake;
    return sum + stake;
  }, 0);
  
  const totalStake = totalStakePending + totalStakeResolved;

  // Calculate real profit for resolved bets using actualProfit from database (supports 2 or 3 bets)
  const calculateRealProfit = (bet: typeof filteredBets[0]) => {
    const { bet1, bet2, bet3 } = bet;
    
    // For triple bets, all 3 must have results
    if (bet3) {
      if (!bet1.result || !bet2.result || !bet3.result) return 0;
      
      // Use actualProfit from database (all bets have same value)
      if (bet3.actualProfit !== undefined && bet3.actualProfit !== null) {
        return parseFloat(String(bet3.actualProfit));
      }
    } else {
      // For dual bets, both must have results
      if (!bet1.result || !bet2.result) return 0;
    }

    // Use actualProfit from database (all bets have same value)
    if (bet1.actualProfit !== undefined && bet1.actualProfit !== null) {
      return parseFloat(String(bet1.actualProfit));
    }
    if (bet2.actualProfit !== undefined && bet2.actualProfit !== null) {
      return parseFloat(String(bet2.actualProfit));
    }
    
    return 0;
  };

  const totalProfitResolved = resolvedBets.reduce((sum, bet) => sum + calculateRealProfit(bet), 0);
  
  // Calculate potential profit for pending bets (supports 2 or 3 bets)
  const totalProfitPending = pendingBets.reduce((sum, bet) => {
    // Use the first bet's potential profit (they should all be the same for a surebet)
    return sum + bet.bet1.potentialProfit;
  }, 0);
  const totalProfitTotal = totalProfitResolved + totalProfitPending;

  const handleTempFilterChange = (key: keyof FilterValues, value: any) => {
    setTempFilters({ ...tempFilters, [key]: value === 'all' ? undefined : value });
  };

  const applyFilters = () => {
    setFilters(tempFilters);
  };

  const clearFilters = () => {
    setFilters({});
    setTempFilters({});
  };

  const hasActiveFilters = Object.values(filters).some(value => {
    if (value === undefined || value === "" || value === null) return false;
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => v !== undefined);
    }
    return true;
  });

  const uniqueHouseNames = Array.from(new Set(bettingHouses.map(house => house.name)));

  const handleEdit = (surebetSetId: string) => {
    const bet = transformedBets.find(b => b.id === surebetSetId);
    if (bet) {
      // Extrai data/hora diretamente da string ISO sem conversão de timezone
      // Formato esperado: "2025-10-02T22:00:00.000Z" -> "2025-10-02T22:00"
      const eventDateStr = String(bet.eventDate);
      const dateTimeLocal = eventDateStr.substring(0, 16);

      setEditingBet({
        id: bet.id,
        eventDate: dateTimeLocal,
        sport: bet.sport,
        league: bet.league,
        teamA: bet.teamA,
        teamB: bet.teamB,
        profitPercentage: bet.profitPercentage,
        bet1: {
          id: bet.bet1.id,
          bettingHouseId: bet.bet1.bettingHouseId,
          house: bet.bet1.house,
          accountHolder: bet.bet1.accountHolder,
          betType: bet.bet1.betType,
          odd: bet.bet1.odd,
          stake: bet.bet1.stake,
        },
        bet2: {
          id: bet.bet2.id,
          bettingHouseId: bet.bet2.bettingHouseId,
          house: bet.bet2.house,
          accountHolder: bet.bet2.accountHolder,
          betType: bet.bet2.betType,
          odd: bet.bet2.odd,
          stake: bet.bet2.stake,
        },
      });

      setEditingNumericFields({
        profitPercentage: bet.profitPercentage.toString().replace('.', ','),
        bet1Odd: bet.bet1.odd.toString().replace('.', ','),
        bet1Stake: bet.bet1.stake.toString().replace('.', ','),
        bet2Odd: bet.bet2.odd.toString().replace('.', ','),
        bet2Stake: bet.bet2.stake.toString().replace('.', ','),
      });
    }
  };

  const handleSaveEdit = () => {
    if (!editingBet) return;

    const profitPercentage = parseFloat(editingNumericFields.profitPercentage.replace(',', '.'));
    const bet1Odd = parseFloat(editingNumericFields.bet1Odd.replace(',', '.'));
    const bet1Stake = parseFloat(editingNumericFields.bet1Stake.replace(',', '.'));
    const bet2Odd = parseFloat(editingNumericFields.bet2Odd.replace(',', '.'));
    const bet2Stake = parseFloat(editingNumericFields.bet2Stake.replace(',', '.'));

    updateSurebetMutation.mutate({
      ...editingBet,
      profitPercentage,
      bet1: { ...editingBet.bet1, odd: bet1Odd, stake: bet1Stake },
      bet2: { ...editingBet.bet2, odd: bet2Odd, stake: bet2Stake },
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento</h1>
          <p className="text-muted-foreground">
            Análise detalhada de apostas
            {hasActiveFilters && (
              <span className="ml-2 text-primary font-medium" data-testid="text-filtered-count">
                • {filteredBets.length} {filteredBets.length === 1 ? 'resultado' : 'resultados'}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={chronologicalSort ? "default" : "outline"}
            onClick={() => setChronologicalSort(!chronologicalSort)}
            data-testid="button-chronological-sort-management"
          >
            <ArrowUpDown className="w-4 h-4 mr-2" />
            {chronologicalSort ? "Ordenado por Data" : "Ordenar por Data"}
          </Button>
          <Link href="/upload">
            <Button data-testid="button-new-bet-management">
              <Plus className="w-4 h-4 mr-2" />
              Nova Aposta
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card data-testid="card-total-bets">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Apostas</CardTitle>
            <ListChecks className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {filteredBets.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingBets.length} pendentes • {resolvedBets.length} resolvidas
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-profit-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Total do Período</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfitTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              R$ {totalProfitTotal.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Resolvido + Pendente
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-profit-resolved">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Resolvido</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {totalProfitResolved.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {resolvedBets.length} apostas resolvidas
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-profit-pending">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Pendente</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              R$ {totalProfitPending.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingBets.length} apostas pendentes
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stake-pending">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Apostado (Pendente)</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalStakePending.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Em andamento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card data-testid="card-filters">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filtros</CardTitle>
            {hasActiveFilters && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearFilters}
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status-filter" className="text-sm">Status</Label>
              <Select 
                value={tempFilters.status || ""} 
                onValueChange={(value) => handleTempFilterChange("status", value || undefined)}
              >
                <SelectTrigger id="status-filter" data-testid="select-status-filter" className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="resolved">Resolvidas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checked-filter" className="text-sm">Conferência</Label>
              <Select 
                value={tempFilters.checked || ""} 
                onValueChange={(value) => handleTempFilterChange("checked", value || undefined)}
              >
                <SelectTrigger id="checked-filter" data-testid="select-checked-filter" className="w-full">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="checked">Conferido</SelectItem>
                  <SelectItem value="unchecked">Não Conferido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="house-filter" className="text-sm">Casa de Apostas</Label>
              <Select 
                value={tempFilters.house || ""} 
                onValueChange={(value) => handleTempFilterChange("house", value || undefined)}
              >
                <SelectTrigger id="house-filter" data-testid="select-house-filter" className="w-full">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueHouseNames.map((house) => (
                    <SelectItem key={house} value={house}>
                      {house}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Data do Jogo</Label>
              <DatePickerWithRange
                selected={tempFilters.eventDateRange}
                onSelect={(range) => setTempFilters({ ...tempFilters, eventDateRange: range })}
                placeholder="Selecione o período"
                data-testid="event-date-range-filter"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Data de Inserção</Label>
              <DatePickerWithRange
                selected={tempFilters.createdDateRange}
                onSelect={(range) => setTempFilters({ ...tempFilters, createdDateRange: range })}
                placeholder="Selecione o período"
                data-testid="created-date-range-filter"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={applyFilters}
              data-testid="button-apply-filters"
              className="w-full md:w-auto"
            >
              Aplicar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bet Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <h2 className="text-xl font-semibold whitespace-nowrap">
              Apostas Ativas ({filteredBets.length} {filteredBets.length === 1 ? 'aposta' : 'apostas'})
            </h2>
            <Input
              type="text"
              placeholder="Buscar por time, esporte ou liga..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
              data-testid="input-search-bets-management"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground" data-testid="text-last-update">
              Atualizado: {timeDisplay}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh-management"
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </>
              )}
            </Button>
          </div>
        </div>
        {isLoading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Carregando apostas...</h3>
              <p className="text-muted-foreground text-center">
                Buscando suas surebets no banco de dados
              </p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TrendingDown className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Erro ao carregar apostas</h3>
              <p className="text-muted-foreground text-center mb-4">
                Não foi possível carregar as apostas. Tente novamente.
              </p>
              <Button onClick={handleRefresh}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : filteredBets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma aposta encontrada</h3>
              <p className="text-muted-foreground text-center mb-4">
                {hasActiveFilters ? "Nenhuma aposta encontrada com os filtros aplicados" : "Comece adicionando sua primeira aposta surebet"}
              </p>
              {!hasActiveFilters && (
                <Link href="/upload">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Aposta
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredBets.map((bet) => (
            <BetCard
              key={bet.id}
              {...bet}
              onResolve={(betId, result) => updateBetMutation.mutate({ betId, result })}
              onStatusChange={(surebetSetId, isChecked) => updateStatusMutation.mutate({ surebetSetId, isChecked })}
              onReset={(surebetSetId) => resetMutation.mutate(surebetSetId)}
              onEdit={handleEdit}
              onDelete={(surebetSetId) => setDeletingBetId(surebetSetId)}
              isResetting={resetMutation.isPending}
            />
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingBet} onOpenChange={(open) => !open && setEditingBet(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Aposta Surebet</DialogTitle>
          </DialogHeader>

          {editingBet && (
            <div className="space-y-6">
              {/* Event Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Detalhes do Evento</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data e Hora do Evento</Label>
                    <Input
                      type="datetime-local"
                      value={editingBet.eventDate}
                      onChange={(e) => setEditingBet({ ...editingBet, eventDate: e.target.value })}
                      data-testid="input-event-date"
                    />
                  </div>
                  <div>
                    <Label>Esporte</Label>
                    <Input
                      value={editingBet.sport}
                      onChange={(e) => setEditingBet({ ...editingBet, sport: e.target.value })}
                      data-testid="input-sport"
                    />
                  </div>
                  <div>
                    <Label>Liga</Label>
                    <Input
                      value={editingBet.league}
                      onChange={(e) => setEditingBet({ ...editingBet, league: e.target.value })}
                      data-testid="input-league"
                    />
                  </div>
                  <div>
                    <Label>Lucro (%)</Label>
                    <Input
                      type="text"
                      value={editingNumericFields.profitPercentage}
                      onChange={(e) => {
                        setEditingNumericFields({ 
                          ...editingNumericFields, 
                          profitPercentage: e.target.value 
                        });
                      }}
                      data-testid="input-profit-percentage"
                    />
                  </div>
                  <div>
                    <Label>Time A</Label>
                    <Input
                      value={editingBet.teamA}
                      onChange={(e) => setEditingBet({ ...editingBet, teamA: e.target.value })}
                      data-testid="input-team-a"
                    />
                  </div>
                  <div>
                    <Label>Time B</Label>
                    <Input
                      value={editingBet.teamB}
                      onChange={(e) => setEditingBet({ ...editingBet, teamB: e.target.value })}
                      data-testid="input-team-b"
                    />
                  </div>
                </div>
              </div>

              {/* Bet 1 */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="font-semibold text-lg">Aposta 1</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Casa de Aposta</Label>
                    <Select
                      value={editingBet.bet1.bettingHouseId}
                      onValueChange={(value) => {
                        const selectedHouse = bettingHouses.find(h => h.id === value);
                        setEditingBet({ 
                          ...editingBet, 
                          bet1: { 
                            ...editingBet.bet1, 
                            bettingHouseId: value,
                            house: selectedHouse?.name || editingBet.bet1.house,
                            accountHolder: selectedHouse?.accountHolder?.name || editingBet.bet1.accountHolder
                          }
                        });
                      }}
                    >
                      <SelectTrigger data-testid="select-bet1-house">
                        <SelectValue placeholder="Selecione a casa" />
                      </SelectTrigger>
                      <SelectContent>
                        {bettingHouses.map(house => (
                          <SelectItem key={house.id} value={house.id}>
                            {house.name} {house.accountHolder?.name ? `(${house.accountHolder.name})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo de Aposta</Label>
                    <Input
                      value={editingBet.bet1.betType}
                      onChange={(e) => setEditingBet({ 
                        ...editingBet, 
                        bet1: { ...editingBet.bet1, betType: e.target.value }
                      })}
                      data-testid="input-bet1-type"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Odd</Label>
                    <Input
                      type="text"
                      value={editingNumericFields.bet1Odd}
                      onChange={(e) => {
                        setEditingNumericFields({ 
                          ...editingNumericFields, 
                          bet1Odd: e.target.value 
                        });
                      }}
                      data-testid="input-bet1-odd"
                    />
                  </div>
                  <div>
                    <Label>Stake (R$)</Label>
                    <Input
                      type="text"
                      value={editingNumericFields.bet1Stake}
                      onChange={(e) => {
                        setEditingNumericFields({ 
                          ...editingNumericFields, 
                          bet1Stake: e.target.value 
                        });
                      }}
                      data-testid="input-bet1-stake"
                    />
                  </div>
                </div>
              </div>

              {/* Bet 2 */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="font-semibold text-lg">Aposta 2</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Casa de Aposta</Label>
                    <Select
                      value={editingBet.bet2.bettingHouseId}
                      onValueChange={(value) => {
                        const selectedHouse = bettingHouses.find(h => h.id === value);
                        setEditingBet({ 
                          ...editingBet, 
                          bet2: { 
                            ...editingBet.bet2, 
                            bettingHouseId: value,
                            house: selectedHouse?.name || editingBet.bet2.house,
                            accountHolder: selectedHouse?.accountHolder?.name || editingBet.bet2.accountHolder
                          }
                        });
                      }}
                    >
                      <SelectTrigger data-testid="select-bet2-house">
                        <SelectValue placeholder="Selecione a casa" />
                      </SelectTrigger>
                      <SelectContent>
                        {bettingHouses.map(house => (
                          <SelectItem key={house.id} value={house.id}>
                            {house.name} {house.accountHolder?.name ? `(${house.accountHolder.name})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo de Aposta</Label>
                    <Input
                      value={editingBet.bet2.betType}
                      onChange={(e) => setEditingBet({ 
                        ...editingBet, 
                        bet2: { ...editingBet.bet2, betType: e.target.value }
                      })}
                      data-testid="input-bet2-type"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Odd</Label>
                    <Input
                      type="text"
                      value={editingNumericFields.bet2Odd}
                      onChange={(e) => {
                        setEditingNumericFields({ 
                          ...editingNumericFields, 
                          bet2Odd: e.target.value 
                        });
                      }}
                      data-testid="input-bet2-odd"
                    />
                  </div>
                  <div>
                    <Label>Stake (R$)</Label>
                    <Input
                      type="text"
                      value={editingNumericFields.bet2Stake}
                      onChange={(e) => {
                        setEditingNumericFields({ 
                          ...editingNumericFields, 
                          bet2Stake: e.target.value 
                        });
                      }}
                      data-testid="input-bet2-stake"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBet(null)} data-testid="button-cancel-edit">
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateSurebetMutation.isPending} data-testid="button-save-edit">
              {updateSurebetMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={!!deletingBetId} onOpenChange={(open) => !open && setDeletingBetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta aposta? Esta ação não pode ser desfeita e todos os dados relacionados serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBetId && deleteMutation.mutate(deletingBetId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
