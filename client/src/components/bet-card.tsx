import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, Users, Check, Edit, Trash2, RotateCcw, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Função para formatar data sem conversão de timezone
function formatEventDate(isoString: string): { date: string; time: string } {
  // Extrai data/hora diretamente da string ISO: "2025-10-03T11:00:00.000Z" -> "2025-10-03T11:00"
  const dateTimeLocal = isoString.substring(0, 16);
  const [datePart, timePart] = dateTimeLocal.split('T');
  const [year, month, day] = datePart.split('-');
  
  return {
    date: `${day}/${month}/${year}`,
    time: timePart
  };
}

interface BetData {
  id: string;
  house: string;
  accountHolder: string;
  betType: string;
  odd: number;
  stake: number;
  potentialProfit: number;
  actualProfit?: number | null;
  result?: "won" | "lost" | "returned" | "half_won" | "half_returned";
}

interface SurebetCardProps {
  id: string;
  eventDate: string;
  sport: string;
  league: string;
  teamA: string;
  teamB: string;
  profitPercentage: number;
  status: "pending" | "resolved";
  isChecked: boolean;
  bet1: BetData;
  bet2: BetData;
  bet3?: BetData; // Optional third bet
  onResolve: (betId: string, result: "won" | "lost" | "returned" | "half_won" | "half_returned") => void;
  onStatusChange?: (surebetSetId: string, isChecked: boolean) => void;
  onReset?: (surebetSetId: string) => void;
  onEdit?: (surebetSetId: string) => void;
  onDelete?: (surebetSetId: string) => void;
  isResetting?: boolean;
  className?: string;
}

export function BetCard({
  id,
  eventDate,
  sport,
  league,
  teamA,
  teamB,
  profitPercentage,
  status,
  isChecked,
  bet1,
  bet2,
  bet3,
  onResolve,
  onStatusChange,
  onReset,
  onEdit,
  onDelete,
  isResetting,
  className,
}: SurebetCardProps) {
  const isResolved = status === "resolved";
  const isPending = status === "pending";
  const totalStake = bet1.stake + bet2.stake + (bet3?.stake || 0);
  
  // Use actualProfit from backend - don't calculate locally to avoid showing incorrect values
  let actualProfit: number | null = null;
  
  if (bet1.actualProfit !== undefined && bet1.actualProfit !== null) {
    // Use the value calculated by backend (all bets have same actualProfit)
    actualProfit = parseFloat(String(bet1.actualProfit));
  } else if (bet2.actualProfit !== undefined && bet2.actualProfit !== null) {
    // Use the value calculated by backend (all bets have same actualProfit)
    actualProfit = parseFloat(String(bet2.actualProfit));
  } else if (bet3 && bet3.actualProfit !== undefined && bet3.actualProfit !== null) {
    // For triple bets, check bet3 as well
    actualProfit = parseFloat(String(bet3.actualProfit));
  } else if (false && bet1.result && bet2.result) { // Disabled fallback to prevent incorrect temporary values
    // Fallback: Calculate actual profit based on bet results (legacy logic)
    if (bet1.result === "won" && bet2.result === "lost") {
      // Win/Loss: (winning_stake × odd) - losing_stake - winning_stake
      actualProfit = (bet1.stake * bet1.odd) - bet2.stake - bet1.stake;
    } else if (bet2.result === "won" && bet1.result === "lost") {
      // Win/Loss: (winning_stake × odd) - losing_stake - winning_stake
      actualProfit = (bet2.stake * bet2.odd) - bet1.stake - bet2.stake;
    } else if (bet1.result === "won" && bet2.result === "returned") {
      // Win/Return: (winning_stake × odd) - winning_stake
      actualProfit = (bet1.stake * bet1.odd) - bet1.stake;
    } else if (bet2.result === "won" && bet1.result === "returned") {
      // Win/Return: (winning_stake × odd) - winning_stake
      actualProfit = (bet2.stake * bet2.odd) - bet2.stake;
    } else if (bet1.result === "lost" && bet2.result === "returned") {
      // Loss/Return: -lost_stake (returned stake doesn't count, just comes back)
      actualProfit = -bet1.stake;
    } else if (bet2.result === "lost" && bet1.result === "returned") {
      // Loss/Return: -lost_stake (returned stake doesn't count, just comes back)
      actualProfit = -bet2.stake;
    } else if (bet1.result === "won" && bet2.result === "won") {
      // Both won: (return1 + return2) - (stake1 + stake2)
      actualProfit = (bet1.stake * bet1.odd + bet2.stake * bet2.odd) - (bet1.stake + bet2.stake);
    } else if (bet1.result === "lost" && bet2.result === "lost") {
      // Loss/Loss: negative value (lost both stakes)
      actualProfit = -(bet1.stake + bet2.stake);
    } else if (bet1.result === "returned" && bet2.result === "returned") {
      // Both returned: no profit or loss
      actualProfit = 0;
    } else if (bet1.result === "half_won" && bet2.result === "lost") {
      // Half Won + Lost: (half_stake × odd) - half_stake - lost_stake
      actualProfit = ((bet1.stake / 2) * bet1.odd) - (bet1.stake / 2) - bet2.stake;
    } else if (bet2.result === "half_won" && bet1.result === "lost") {
      // Half Won + Lost: (half_stake × odd) - half_stake - lost_stake
      actualProfit = ((bet2.stake / 2) * bet2.odd) - (bet2.stake / 2) - bet1.stake;
    } else if (bet1.result === "half_returned" && bet2.result === "lost") {
      // Half Returned + Lost: -lost_stake (half returned doesn't affect profit)
      actualProfit = -bet2.stake;
    } else if (bet2.result === "half_returned" && bet1.result === "lost") {
      // Half Returned + Lost: -lost_stake (half returned doesn't affect profit)
      actualProfit = -bet1.stake;
    } else if (bet1.result === "half_won" && bet2.result === "returned") {
      // Half Won + Returned: (half_stake × odd) - half_stake
      actualProfit = ((bet1.stake / 2) * bet1.odd) - (bet1.stake / 2);
    } else if (bet2.result === "half_won" && bet1.result === "returned") {
      // Half Won + Returned: (half_stake × odd) - half_stake
      actualProfit = ((bet2.stake / 2) * bet2.odd) - (bet2.stake / 2);
    } else if (bet1.result === "half_returned" && bet2.result === "returned") {
      // Both partial returns: no profit or loss
      actualProfit = 0;
    } else if (bet1.result === "half_won" && bet2.result === "half_returned") {
      // Half Won + Half Returned: calculate returns for each bet then subtract total invested
      const return1 = (bet1.stake / 2) * bet1.odd + (bet1.stake / 2); // Half won: (half × odd) + half returned
      const return2 = bet2.stake / 2; // Half returned: only half returned
      actualProfit = (return1 + return2) - (bet1.stake + bet2.stake);
    } else if (bet2.result === "half_won" && bet1.result === "half_returned") {
      // Half Won + Half Returned: calculate returns for each bet then subtract total invested
      const return1 = bet1.stake / 2; // Half returned: only half returned
      const return2 = (bet2.stake / 2) * bet2.odd + (bet2.stake / 2); // Half won: (half × odd) + half returned
      actualProfit = (return1 + return2) - (bet1.stake + bet2.stake);
    } else if (bet1.result === "won" && bet2.result === "half_returned") {
      // Won + Half Returned: (winning_stake × odd) - winning_stake
      actualProfit = (bet1.stake * bet1.odd) - bet1.stake;
    } else if (bet2.result === "won" && bet1.result === "half_returned") {
      // Won + Half Returned: (winning_stake × odd) - winning_stake
      actualProfit = (bet2.stake * bet2.odd) - bet2.stake;
    } else if (bet1.result === "half_won" && bet2.result === "half_won") {
      // Both Half Won: sum of half profits
      actualProfit = ((bet1.stake / 2) * bet1.odd) - (bet1.stake / 2) + ((bet2.stake / 2) * bet2.odd) - (bet2.stake / 2);
    }
  }

  return (
    <Card className={cn("hover-elevate", status === "resolved" && "bg-[#e6f7ed] dark:bg-[#344038]", className)} data-testid={`card-surebet-${id}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold">
              {teamA} vs {teamB}
            </CardTitle>
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(id)}
                data-testid={`button-edit-${id}`}
              >
                <Edit className="w-3 h-3" />
              </Button>
            )}
            {onReset && (bet1.result || bet2.result || bet3?.result) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReset(id)}
                disabled={isResetting}
                data-testid={`button-reset-${id}`}
              >
                {isResetting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDelete(id)}
                data-testid={`button-delete-${id}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isChecked && onStatusChange && !isResolved && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStatusChange(id, true)}
                className="bg-background"
                data-testid={`button-mark-checked-${id}`}
              >
                Conferido
              </Button>
            )}
            {isChecked && onStatusChange && !isResolved && (
              <Button
                size="sm"
                variant="outline"
                className="bg-background"
                onClick={() => onStatusChange(id, false)}
                data-testid={`button-uncheck-${id}`}
              >
                <Check className="w-3 h-3 mr-1" />
                Conferido
              </Button>
            )}
            {isResolved && (
              <Badge className="bg-green-600 text-white">
                Resolvido
              </Badge>
            )}
            {isPending && !isResolved && <StatusBadge status="pending" />}
            <Badge variant="outline" className="bg-primary text-primary-foreground">
              <TrendingUp className="w-3 h-3 mr-1" />
              {profitPercentage}%
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{formatEventDate(eventDate).date} às {formatEventDate(eventDate).time}</span>
          </div>
          <span>{sport} • {league}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Bet 1 */}
        <div className="p-4 rounded-lg border bg-card/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{bet1.house}</Badge>
              <span className="text-sm text-muted-foreground">
                <Users className="w-3 h-3 inline mr-1" />
                {bet1.accountHolder}
              </span>
            </div>
            {bet1.result && <StatusBadge status={bet1.result} />}
          </div>

          <div className="grid grid-cols-5 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Tipo</span>
              <p className="font-medium">{bet1.betType}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Odd</span>
              <p className="font-medium">{bet1.odd}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Stake</span>
              <p className="font-medium">R$ {bet1.stake.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Retorno</span>
              <p className="font-medium">R$ {(bet1.odd * bet1.stake).toFixed(2)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Lucro Pot.</span>
              <p className="font-medium text-betting-profit">R$ {bet1.potentialProfit.toFixed(2)}</p>
            </div>
          </div>

          {!bet1.result && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => onResolve(bet1.id, "won")}
                className="bg-betting-win hover:bg-betting-win/80"
                data-testid={`button-resolve-won-${bet1.id}`}
              >
                Ganhou
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onResolve(bet1.id, "lost")}
                data-testid={`button-resolve-lost-${bet1.id}`}
              >
                Perdeu
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onResolve(bet1.id, "returned")}
                data-testid={`button-resolve-returned-${bet1.id}`}
              >
                Devolvido
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-sky-400 hover:bg-sky-500 text-white"
                    data-testid={`button-half-green-${bet1.id}`}
                  >
                    Meio Green
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => onResolve(bet1.id, "half_won")}
                    data-testid={`button-half-won-${bet1.id}`}
                  >
                    Ganho
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onResolve(bet1.id, "half_returned")}
                    data-testid={`button-half-returned-${bet1.id}`}
                  >
                    Devolvido
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Bet 2 */}
        <div className="p-4 rounded-lg border bg-card/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{bet2.house}</Badge>
              <span className="text-sm text-muted-foreground">
                <Users className="w-3 h-3 inline mr-1" />
                {bet2.accountHolder}
              </span>
            </div>
            {bet2.result && <StatusBadge status={bet2.result} />}
          </div>

          <div className="grid grid-cols-5 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Tipo</span>
              <p className="font-medium">{bet2.betType}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Odd</span>
              <p className="font-medium">{bet2.odd}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Stake</span>
              <p className="font-medium">R$ {bet2.stake.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Retorno</span>
              <p className="font-medium">R$ {(bet2.odd * bet2.stake).toFixed(2)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Lucro Pot.</span>
              <p className="font-medium text-betting-profit">R$ {bet2.potentialProfit.toFixed(2)}</p>
            </div>
          </div>

          {!bet2.result && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => onResolve(bet2.id, "won")}
                className="bg-betting-win hover:bg-betting-win/80"
                data-testid={`button-resolve-won-${bet2.id}`}
              >
                Ganhou
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onResolve(bet2.id, "lost")}
                data-testid={`button-resolve-lost-${bet2.id}`}
              >
                Perdeu
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onResolve(bet2.id, "returned")}
                data-testid={`button-resolve-returned-${bet2.id}`}
              >
                Devolvido
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-sky-400 hover:bg-sky-500 text-white"
                    data-testid={`button-half-green-${bet2.id}`}
                  >
                    Meio Green
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => onResolve(bet2.id, "half_won")}
                    data-testid={`button-half-won-${bet2.id}`}
                  >
                    Ganho
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onResolve(bet2.id, "half_returned")}
                    data-testid={`button-half-returned-${bet2.id}`}
                  >
                    Devolvido
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Bet 3 (if exists) */}
        {bet3 && (
          <div className="p-4 rounded-lg border bg-card/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{bet3.house}</Badge>
                <span className="text-sm text-muted-foreground">
                  <Users className="w-3 h-3 inline mr-1" />
                  {bet3.accountHolder}
                </span>
              </div>
              {bet3.result && <StatusBadge status={bet3.result} />}
            </div>

            <div className="grid grid-cols-5 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Tipo</span>
                <p className="font-medium">{bet3.betType}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Odd</span>
                <p className="font-medium">{bet3.odd}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Stake</span>
                <p className="font-medium">R$ {bet3.stake.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Retorno</span>
                <p className="font-medium">R$ {(bet3.odd * bet3.stake).toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Lucro Pot.</span>
                <p className="font-medium text-betting-profit">R$ {bet3.potentialProfit.toFixed(2)}</p>
              </div>
            </div>

            {!bet3.result && (
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => onResolve(bet3.id, "won")}
                  className="bg-betting-win hover:bg-betting-win/80"
                  data-testid={`button-resolve-won-${bet3.id}`}
                >
                  Ganhou
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onResolve(bet3.id, "lost")}
                  data-testid={`button-resolve-lost-${bet3.id}`}
                >
                  Perdeu
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onResolve(bet3.id, "returned")}
                  data-testid={`button-resolve-returned-${bet3.id}`}
                >
                  Devolvido
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      className="bg-sky-400 hover:bg-sky-500 text-white"
                      data-testid={`button-half-green-${bet3.id}`}
                    >
                      Meio Green
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => onResolve(bet3.id, "half_won")}
                      data-testid={`button-half-won-${bet3.id}`}
                    >
                      Ganho
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onResolve(bet3.id, "half_returned")}
                      data-testid={`button-half-returned-${bet3.id}`}
                    >
                      Devolvido
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-sm">
            <span className="text-muted-foreground">Total Investido: </span>
            <span className="font-medium">R$ {totalStake.toFixed(2)}</span>
          </div>

          {(bet1.result && bet2.result && (!bet3 || bet3.result) && actualProfit !== null) && (
            <div className="text-sm">
              <span className="text-muted-foreground">Lucro Real: </span>
              <span className={cn(
                "font-medium",
                actualProfit > 0 ? "text-betting-profit" : "text-betting-loss"
              )}>
                R$ {actualProfit.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}