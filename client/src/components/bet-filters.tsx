import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Filter, X, Search } from "lucide-react";
import type { BettingHouse } from "@shared/schema";
import type { DateRange } from "react-day-picker";

interface BetFiltersProps {
  onFiltersChange: (filters: FilterValues) => void;
  className?: string;
}

interface FilterValues {
  status?: string;
  house?: string;
  dateRange?: DateRange;
}

export function BetFilters({ onFiltersChange, className }: BetFiltersProps) {
  const [filters, setFilters] = useState<FilterValues>({});
  const [tempFilters, setTempFilters] = useState<FilterValues>({});

  // Load betting houses from API
  const { data: bettingHouses = [] } = useQuery<BettingHouse[]>({
    queryKey: ["/api/betting-houses"],
  });

  // Extract unique houses from data
  const uniqueHouseNames = Array.from(new Set(bettingHouses.map(house => house.name)));

  const handleTempFilterChange = (key: keyof FilterValues, value: any) => {
    setTempFilters({ ...tempFilters, [key]: value === 'all' ? undefined : value });
  };

  const handleDateRangeChange = (dateRange: DateRange | undefined) => {
    setTempFilters({ ...tempFilters, dateRange });
  };

  const applyFilters = () => {
    setFilters(tempFilters);
    onFiltersChange(tempFilters);
  };

  const clearFilters = () => {
    setFilters({});
    setTempFilters({});
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some(value => {
    if (value === undefined || value === "" || value === null) return false;
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => v !== undefined);
    }
    return true;
  });

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
          <div className="flex items-center gap-2">
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
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status-filter">Status</Label>
            <Select 
              value={tempFilters.status || ""} 
              onValueChange={(value) => handleTempFilterChange("status", value || undefined)}
            >
              <SelectTrigger id="status-filter" data-testid="select-status-filter">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="checked">Conferidas</SelectItem>
                <SelectItem value="resolved">Resolvidas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="house-filter">Casa de Apostas</Label>
            <Select 
              value={tempFilters.house || ""} 
              onValueChange={(value) => handleTempFilterChange("house", value || undefined)}
            >
              <SelectTrigger id="house-filter" data-testid="select-house-filter">
                <SelectValue placeholder="Todas as casas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as casas</SelectItem>
                {uniqueHouseNames.map((house) => (
                  <SelectItem key={house} value={house}>
                    {house}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Período de Data</Label>
            <DatePickerWithRange
              selected={tempFilters.dateRange}
              onSelect={handleDateRangeChange}
              placeholder="Selecione o período"
              data-testid="date-range-filter"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={applyFilters}
            data-testid="button-apply-filters"
            className="w-full md:w-auto"
          >
            <Search className="h-4 w-4 mr-2" />
            Aplicar Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}