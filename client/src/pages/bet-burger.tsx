import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BettingHouseWithAccountHolder } from "@shared/schema";

interface ParsedBet {
  eventDate: string;
  sport: string;
  league: string;
  teamA: string;
  teamB: string;
  profitPercentage: number;
  bet1: {
    house: string;
    type: string;
    odd: number;
    stake: number;
    profit: number;
  };
  bet2: {
    house: string;
    type: string;
    odd: number;
    stake: number;
    profit: number;
  };
  bet3?: {
    house: string;
    type: string;
    odd: number;
    stake: number;
    profit: number;
  };
}

interface EditableData {
  eventDate: string;
  profitPercentage: string;
  sport: string;
  league: string;
  teamA: string;
  teamB: string;
  bet1House: string;
  bet1Type: string;
  bet1Odd: string;
  bet1Stake: string;
  bet1Profit: string;
  bet1SelectedHouseId?: string;
  bet2House: string;
  bet2Type: string;
  bet2Odd: string;
  bet2Stake: string;
  bet2Profit: string;
  bet2SelectedHouseId?: string;
  bet3House?: string;
  bet3Type?: string;
  bet3Odd?: string;
  bet3Stake?: string;
  bet3Profit?: string;
  bet3SelectedHouseId?: string;
}

export default function BetBurger() {
  const { toast } = useToast();
  const [excelData, setExcelData] = useState("");
  const [parsedBets, setParsedBets] = useState<ParsedBet[]>([]);
  const [editableData, setEditableData] = useState<Record<number, EditableData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: bettingHouses = [] } = useQuery<BettingHouseWithAccountHolder[]>({
    queryKey: ["/api/betting-houses"],
  });

  const parseBetBurgerData = (data: string): ParsedBet[] => {
    const lines = data.trim().split('\n').map(line => line.trim()).filter(line => line);
    const bets: ParsedBet[] = [];

    // Find all header line indices (lines that start with date)
    const headerIndices: number[] = [];
    lines.forEach((line, idx) => {
      // Match both formats with Unicode support for accented months (março, etc.)
      // Format 1: "17 nov 06:00" or "17 março 06:00" (allow any non-space chars for month)
      // Format 2: "08/11/2025 13:15"
      if (line.match(/^\d{1,2}\s+[^\s]{3,}\s+\d{2}:\d{2}/) || line.match(/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/)) {
        headerIndices.push(idx);
      }
    });

    // Process each bet group
    for (let h = 0; h < headerIndices.length; h++) {
      const startIdx = headerIndices[h];
      const endIdx = h + 1 < headerIndices.length ? headerIndices[h + 1] : lines.length;
      const betLines = lines.slice(startIdx, endIdx);

      if (betLines.length < 3) continue; // Need at least header + 2 bets

      // Normalize whitespace (tabs, multiple spaces) to single space for easier parsing
      const dateTimeMainLine = betLines[0].replace(/\s+/g, ' ').trim();
      const bet1Line = betLines[1];
      const bet2Line = betLines[2];
      const bet3Line = betLines.length >= 4 ? betLines[3] : null;

      // Parse date/time - support both formats with Unicode months
      let eventDate = new Date().toISOString().slice(0, 16);
      
      // Format 1: "17 nov 06:00" or "17 março 06:00" -> convert month name (allow accents)
      const dateTimeMatch1 = dateTimeMainLine.match(/^(\d{1,2})\s+([^\s]+)\s+(\d{2}:\d{2})/);
      if (dateTimeMatch1) {
        const [_, day, monthName, time] = dateTimeMatch1;
        
        // Normalize month name: remove dots, lowercase, remove common accents
        const normalizedMonth = monthName.toLowerCase()
          .replace(/\./g, '')
          .replace(/ç/g, 'c')
          .replace(/á/g, 'a')
          .replace(/é/g, 'e')
          .replace(/í/g, 'i')
          .replace(/ó/g, 'o')
          .replace(/ú/g, 'u')
          .replace(/â/g, 'a')
          .replace(/ê/g, 'e')
          .replace(/ô/g, 'o')
          .substring(0, 3); // Take first 3 chars after normalization
        
        // Extended month map with Portuguese variants
        const monthMap: Record<string, string> = {
          jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
          jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
          // English variants
          feb: '02', apr: '04', may: '05', aug: '08', sep: '09', oct: '10', dec: '12'
        };
        const month = monthMap[normalizedMonth] || '01';
        const year = new Date().getFullYear();
        eventDate = `${year}-${month}-${day.padStart(2, '0')}T${time}`;
      }
      
      // Format 2: "08/11/2025 13:15"
      const dateTimeMatch2 = dateTimeMainLine.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
      if (dateTimeMatch2) {
        const [_, datePart, timePart] = dateTimeMatch2;
        const [day, month, year] = datePart.split('/');
        eventDate = `${year}-${month}-${day}T${timePart}`;
      }

      // Parse main line - support both formats with Unicode characters (Portuguese/Spanish accents)
      // Format: "DATE TIME SPORT.TEAMA - TEAMB (LEAGUE) PERCENTAGE%"
      // Strategy: Find TIME, extract everything after it until first separator, that's the sport
      
      // Find the time portion (HH:MM)
      const timeMatch = dateTimeMainLine.match(/\d{2}:\d{2}/);
      if (!timeMatch) continue;
      
      // Get everything after the time
      const afterTime = dateTimeMainLine.substring(timeMatch.index! + 5).trim();
      
      // Find first separator (., ·, –, —) for sport
      // Use regex to find first occurrence of any separator
      const separatorMatch = afterTime.match(/[.·–—]/);
      if (!separatorMatch) continue;
      
      const separatorIndex = separatorMatch.index!;
      const sport = afterTime.substring(0, separatorIndex).trim();
      
      // Get everything after the separator for team extraction
      const afterSeparator = afterTime.substring(separatorIndex + 1);
      
      // Extract: TeamA - TeamB (League) Percentage%
      // Accept both ASCII hyphen (-) and Unicode dashes (–, —) between teams
      const eventPattern = /(.+?)\s*[-–—]\s*(.+?)\s*\(([^)]+)\)\s*([\d.]+)%/;
      const eventMatch = afterSeparator.match(eventPattern);
      if (!eventMatch) continue;
      
      const [, teamA, teamB, league, profitPct] = eventMatch;

      // Parse bet1 (segunda linha com tabs)
      const bet1Parts = bet1Line.split('\t').filter(p => p.trim());
      if (bet1Parts.length < 6) continue;

      const bet1 = {
        house: bet1Parts[0].trim(),
        type: bet1Parts[1].trim(),
        odd: parseFloat(bet1Parts[2]) || 0,
        stake: parseFloat(bet1Parts[3]) || 0,
        profit: parseFloat(bet1Parts[5]) || 0,
      };

      // Parse bet2
      const bet2Parts = bet2Line.split('\t').filter(p => p.trim());
      if (bet2Parts.length < 6) continue;

      const bet2 = {
        house: bet2Parts[0].trim(),
        type: bet2Parts[1].trim(),
        odd: parseFloat(bet2Parts[2]) || 0,
        stake: parseFloat(bet2Parts[3]) || 0,
        profit: parseFloat(bet2Parts[5]) || 0,
      };

      // Parse bet3 if exists
      let bet3 = undefined;
      if (bet3Line) {
        const bet3Parts = bet3Line.split('\t').filter(p => p.trim());
        if (bet3Parts.length >= 6) {
          bet3 = {
            house: bet3Parts[0].trim(),
            type: bet3Parts[1].trim(),
            odd: parseFloat(bet3Parts[2]) || 0,
            stake: parseFloat(bet3Parts[3]) || 0,
            profit: parseFloat(bet3Parts[5]) || 0,
          };
        }
      }

      bets.push({
        eventDate,
        sport: sport.trim(),
        league: league.trim(),
        teamA: teamA.trim(),
        teamB: teamB.trim(),
        profitPercentage: parseFloat(profitPct),
        bet1,
        bet2,
        bet3,
      });
    }

    return bets;
  };

  const findMatchingHouse = (houseName: string): string | undefined => {
    const normalized = houseName.toLowerCase().replace(/[.\s]/g, '');
    const match = bettingHouses.find(h => 
      h.name.toLowerCase().replace(/[.\s]/g, '').includes(normalized) ||
      normalized.includes(h.name.toLowerCase().replace(/[.\s]/g, ''))
    );
    return match?.id;
  };

  const handleProcessData = () => {
    try {
      const parsed = parseBetBurgerData(excelData);
      
      if (parsed.length === 0) {
        toast({
          title: "❌ Erro ao processar",
          description: "Não foi possível extrair apostas dos dados colados. Verifique o formato.",
          variant: "destructive",
        });
        return;
      }

      setParsedBets(parsed);

      const initialData: Record<number, EditableData> = {};
      parsed.forEach((bet, index) => {
        initialData[index] = {
          eventDate: bet.eventDate,
          profitPercentage: bet.profitPercentage.toFixed(2),
          sport: bet.sport,
          league: bet.league,
          teamA: bet.teamA,
          teamB: bet.teamB,
          bet1House: bet.bet1.house,
          bet1Type: bet.bet1.type,
          bet1Odd: bet.bet1.odd.toFixed(3),
          bet1Stake: bet.bet1.stake.toFixed(2),
          bet1Profit: bet.bet1.profit.toFixed(2),
          bet1SelectedHouseId: findMatchingHouse(bet.bet1.house),
          bet2House: bet.bet2.house,
          bet2Type: bet.bet2.type,
          bet2Odd: bet.bet2.odd.toFixed(3),
          bet2Stake: bet.bet2.stake.toFixed(2),
          bet2Profit: bet.bet2.profit.toFixed(2),
          bet2SelectedHouseId: findMatchingHouse(bet.bet2.house),
          ...(bet.bet3 && {
            bet3House: bet.bet3.house,
            bet3Type: bet.bet3.type,
            bet3Odd: bet.bet3.odd.toFixed(3),
            bet3Stake: bet.bet3.stake.toFixed(2),
            bet3Profit: bet.bet3.profit.toFixed(2),
            bet3SelectedHouseId: findMatchingHouse(bet.bet3.house),
          }),
        };
      });

      setEditableData(initialData);

      toast({
        title: "✅ Dados processados!",
        description: `${parsed.length} aposta(s) extraída(s) com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao processar dados:", error);
      toast({
        title: "❌ Erro ao processar",
        description: "Ocorreu um erro ao processar os dados. Verifique o formato.",
        variant: "destructive",
      });
    }
  };

  const handleClearAll = () => {
    setExcelData("");
    setParsedBets([]);
    setEditableData({});
  };

  const updateEditableField = (index: number, field: keyof EditableData, value: string) => {
    setEditableData(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value,
      }
    }));
  };

  const handleSubmitBets = async () => {
    setIsSubmitting(true);
    const errors: string[] = [];

    try {
      // PASSO 1: Validar TODAS as apostas ANTES de enviar qualquer uma
      for (let i = 0; i < parsedBets.length; i++) {
        const data = editableData[i];
        
        // Defensive check
        if (!data) {
          errors.push(`Aposta ${i + 1}: Dados não encontrados`);
          continue;
        }
        
        const hasBet3 = parsedBets[i].bet3 !== undefined;
        
        // Validação de campos obrigatórios
        const missingFields: string[] = [];
        
        if (!data.eventDate) missingFields.push("Data/Hora");
        if (!data.sport?.trim()) missingFields.push("Esporte");
        if (!data.league?.trim()) missingFields.push("Liga");
        if (!data.teamA?.trim()) missingFields.push("Time A");
        if (!data.teamB?.trim()) missingFields.push("Time B");
        if (!data.profitPercentage) missingFields.push("Lucro %");
        
        if (!data.bet1SelectedHouseId) missingFields.push("Titular Aposta 1");
        if (!data.bet1Type?.trim()) missingFields.push("Tipo Aposta 1");
        if (!data.bet2SelectedHouseId) missingFields.push("Titular Aposta 2");
        if (!data.bet2Type?.trim()) missingFields.push("Tipo Aposta 2");
        
        if (hasBet3) {
          if (!data.bet3SelectedHouseId) missingFields.push("Titular Aposta 3");
          if (!data.bet3Type?.trim()) missingFields.push("Tipo Aposta 3");
        }
        
        if (missingFields.length > 0) {
          errors.push(`Aposta ${i + 1}: ${missingFields.join(", ")}`);
          continue;
        }

        // Validação de valores numéricos
        const bet1Odd = parseFloat(data.bet1Odd);
        const bet1Stake = parseFloat(data.bet1Stake);
        const bet1Profit = parseFloat(data.bet1Profit);
        const bet2Odd = parseFloat(data.bet2Odd);
        const bet2Stake = parseFloat(data.bet2Stake);
        const bet2Profit = parseFloat(data.bet2Profit);

        if (isNaN(bet1Odd) || isNaN(bet1Stake) || isNaN(bet1Profit) || isNaN(bet2Odd) || isNaN(bet2Stake) || isNaN(bet2Profit)) {
          errors.push(`Aposta ${i + 1}: Valores numéricos inválidos (bet1 ou bet2)`);
          continue;
        }

        if (hasBet3) {
          const bet3Odd = parseFloat(data.bet3Odd || '0');
          const bet3Stake = parseFloat(data.bet3Stake || '0');
          const bet3Profit = parseFloat(data.bet3Profit || '0');
          
          if (isNaN(bet3Odd) || isNaN(bet3Stake) || isNaN(bet3Profit)) {
            errors.push(`Aposta ${i + 1}: Valores numéricos inválidos (bet3)`);
            continue;
          }
        }
      }

      // Se houver QUALQUER erro, bloquear envio completo
      if (errors.length > 0) {
        toast({
          title: "⚠️ Não é possível enviar",
          description: `Preencha TODOS os campos de TODAS as apostas antes de enviar:\n\n${errors.join('\n')}`,
          variant: "destructive",
        });
        return;
      }

      // PASSO 2: Se passou na validação, enviar TODAS as apostas
      let created = 0;
      let failed = 0;
      const submitErrors: string[] = [];

      for (let i = 0; i < parsedBets.length; i++) {
        const data = editableData[i];
        const hasBet3 = parsedBets[i].bet3 !== undefined;

        const bet1Odd = parseFloat(data.bet1Odd);
        const bet1Stake = parseFloat(data.bet1Stake);
        const bet1Profit = parseFloat(data.bet1Profit);
        const bet2Odd = parseFloat(data.bet2Odd);
        const bet2Stake = parseFloat(data.bet2Stake);
        const bet2Profit = parseFloat(data.bet2Profit);

        let bet3Odd, bet3Stake, bet3Profit;
        if (hasBet3) {
          bet3Odd = parseFloat(data.bet3Odd || '0');
          bet3Stake = parseFloat(data.bet3Stake || '0');
          bet3Profit = parseFloat(data.bet3Profit || '0');
        }

        try {
          const surebetSetData = {
            eventDate: data.eventDate || null,
            sport: data.sport,
            league: data.league,
            teamA: data.teamA,
            teamB: data.teamB,
            profitPercentage: data.profitPercentage.toString(),
            status: "pending",
          };

          const bet1Data = {
            betType: data.bet1Type,
            odd: bet1Odd.toFixed(3),
            stake: bet1Stake.toFixed(2),
            potentialProfit: bet1Profit.toFixed(2),
            bettingHouseId: data.bet1SelectedHouseId,
          };

          const bet2Data = {
            betType: data.bet2Type,
            odd: bet2Odd.toFixed(3),
            stake: bet2Stake.toFixed(2),
            potentialProfit: bet2Profit.toFixed(2),
            bettingHouseId: data.bet2SelectedHouseId,
          };

          const betsArray = [bet1Data, bet2Data];
          
          if (hasBet3 && bet3Odd && bet3Stake && bet3Profit) {
            betsArray.push({
              betType: data.bet3Type!,
              odd: bet3Odd.toFixed(3),
              stake: bet3Stake.toFixed(2),
              potentialProfit: bet3Profit.toFixed(2),
              bettingHouseId: data.bet3SelectedHouseId!,
            });
          }

          const response = await fetch('/api/surebet-sets', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              surebetSet: surebetSetData,
              bets: betsArray,
            }),
          });

          if (response.ok) {
            created++;
          } else {
            const errorText = await response.text();
            submitErrors.push(`Aposta ${i + 1}: ${errorText}`);
            failed++;
          }
        } catch (error: any) {
          console.error(`Erro ao criar aposta ${i + 1}:`, error);
          submitErrors.push(`Aposta ${i + 1}: ${error.message || 'Erro desconhecido'}`);
          failed++;
        }
      }

      // Mostrar resultados do envio
      if (created > 0) {
        toast({
          title: "✅ Apostas criadas com sucesso!",
          description: `${created} aposta(s) adicionada(s) ao sistema${failed > 0 ? `. ${failed} falhou(aram)` : ''}`,
        });

        if (failed === 0) {
          setTimeout(() => {
            handleClearAll();
          }, 1500);
        }
      }

      if (submitErrors.length > 0) {
        console.error('Erros na criação:', submitErrors);
        toast({
          title: "⚠️ Alguns erros ocorreram",
          description: `${failed} aposta(s) não puderam ser criadas. Verifique o console.`,
          variant: "destructive",
        });
      }

    } finally {
      setIsSubmitting(false);
    }

    queryClient.invalidateQueries({ queryKey: ['/api/surebet-sets'] });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bet Burger</h1>
          <p className="text-muted-foreground">Cole dados do Excel para adicionar apostas</p>
        </div>
      </div>

      {parsedBets.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Colar Dados do Excel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="excel-data">Dados do Bet Burger</Label>
              <Textarea
                id="excel-data"
                placeholder="Cole aqui os dados do Excel (Data/Hora, linha principal, aposta 1, aposta 2)..."
                value={excelData}
                onChange={(e) => setExcelData(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                data-testid="textarea-excel-data"
              />
              <p className="text-xs text-muted-foreground">
                Formato esperado: Data/Hora na primeira linha, depois Esporte.Time1 - Time2 (Liga) %, seguido das 2 apostas
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleProcessData}
                disabled={!excelData.trim()}
                data-testid="button-process-data"
              >
                <Upload className="w-4 h-4 mr-2" />
                Processar Dados
              </Button>
              <Button
                variant="outline"
                onClick={handleClearAll}
                disabled={!excelData.trim()}
                data-testid="button-clear-data"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {parsedBets.length} aposta(s) extraída(s) • Revise os dados antes de enviar
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClearAll}
                data-testid="button-reset"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Recomeçar
              </Button>
              <Button
                onClick={handleSubmitBets}
                disabled={isSubmitting}
                data-testid="button-submit-bets"
              >
                {isSubmitting ? "Enviando..." : "Adicionar Todas as Apostas ao Sistema"}
              </Button>
            </div>
          </div>

          <div className="space-y-8">
            {parsedBets.map((bet, index) => {
              const data = editableData[index];
              if (!data) return null;

              return (
                <div key={index} className="space-y-4 p-4 border rounded-lg bg-card">
                  <h3 className="text-lg font-semibold">Aposta {index + 1}</h3>

                  {/* Event Information Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Informações do Evento
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Data e Hora</Label>
                          <Input
                            type="datetime-local"
                            value={data.eventDate}
                            onChange={(e) => updateEditableField(index, 'eventDate', e.target.value)}
                            data-testid={`input-event-date-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Lucro (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={data.profitPercentage}
                            onChange={(e) => updateEditableField(index, 'profitPercentage', e.target.value)}
                            data-testid={`input-profit-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Esporte</Label>
                          <Input
                            value={data.sport}
                            onChange={(e) => updateEditableField(index, 'sport', e.target.value)}
                            data-testid={`input-sport-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Liga</Label>
                          <Input
                            value={data.league}
                            onChange={(e) => updateEditableField(index, 'league', e.target.value)}
                            data-testid={`input-league-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Time A</Label>
                          <Input
                            value={data.teamA}
                            onChange={(e) => updateEditableField(index, 'teamA', e.target.value)}
                            data-testid={`input-teamA-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Time B</Label>
                          <Input
                            value={data.teamB}
                            onChange={(e) => updateEditableField(index, 'teamB', e.target.value)}
                            data-testid={`input-teamB-${index}`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Bet 1 Card */}
                  <Card className="border-blue-200 dark:border-blue-800">
                    <CardHeader className="bg-blue-50 dark:bg-blue-950">
                      <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Aposta 1
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Casa de Apostas</Label>
                          <Input
                            value={data.bet1House}
                            onChange={(e) => updateEditableField(index, 'bet1House', e.target.value)}
                            data-testid={`input-bet1-house-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Titular da Conta</Label>
                          <Select
                            value={data.bet1SelectedHouseId || ""}
                            onValueChange={(value) => updateEditableField(index, 'bet1SelectedHouseId', value)}
                          >
                            <SelectTrigger data-testid={`select-bet1-holder-${index}`}>
                              <SelectValue placeholder="Selecione o titular" />
                            </SelectTrigger>
                            <SelectContent>
                              {bettingHouses.map((house) => (
                                <SelectItem key={house.id} value={house.id}>
                                  {house.accountHolder?.name || 'Sem titular'} - {house.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Input
                            value={data.bet1Type}
                            onChange={(e) => updateEditableField(index, 'bet1Type', e.target.value)}
                            data-testid={`input-bet1-type-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Odd</Label>
                          <Input
                            type="number"
                            step="0.001"
                            value={data.bet1Odd}
                            onChange={(e) => updateEditableField(index, 'bet1Odd', e.target.value)}
                            data-testid={`input-bet1-odd-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Stake (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={data.bet1Stake}
                            onChange={(e) => updateEditableField(index, 'bet1Stake', e.target.value)}
                            data-testid={`input-bet1-stake-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Lucro Potencial (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={data.bet1Profit}
                            onChange={(e) => updateEditableField(index, 'bet1Profit', e.target.value)}
                            data-testid={`input-bet1-profit-${index}`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Bet 2 Card */}
                  <Card className="border-purple-200 dark:border-purple-800">
                    <CardHeader className="bg-purple-50 dark:bg-purple-950">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Aposta 2
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Casa de Apostas</Label>
                          <Input
                            value={data.bet2House}
                            onChange={(e) => updateEditableField(index, 'bet2House', e.target.value)}
                            data-testid={`input-bet2-house-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Titular da Conta</Label>
                          <Select
                            value={data.bet2SelectedHouseId || ""}
                            onValueChange={(value) => updateEditableField(index, 'bet2SelectedHouseId', value)}
                          >
                            <SelectTrigger data-testid={`select-bet2-holder-${index}`}>
                              <SelectValue placeholder="Selecione o titular" />
                            </SelectTrigger>
                            <SelectContent>
                              {bettingHouses.map((house) => (
                                <SelectItem key={house.id} value={house.id}>
                                  {house.accountHolder?.name || 'Sem titular'} - {house.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Input
                            value={data.bet2Type}
                            onChange={(e) => updateEditableField(index, 'bet2Type', e.target.value)}
                            data-testid={`input-bet2-type-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Odd</Label>
                          <Input
                            type="number"
                            step="0.001"
                            value={data.bet2Odd}
                            onChange={(e) => updateEditableField(index, 'bet2Odd', e.target.value)}
                            data-testid={`input-bet2-odd-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Stake (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={data.bet2Stake}
                            onChange={(e) => updateEditableField(index, 'bet2Stake', e.target.value)}
                            data-testid={`input-bet2-stake-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Lucro Potencial (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={data.bet2Profit}
                            onChange={(e) => updateEditableField(index, 'bet2Profit', e.target.value)}
                            data-testid={`input-bet2-profit-${index}`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Bet 3 Card (conditional) */}
                  {parsedBets[index].bet3 && (
                    <Card className="border-green-200 dark:border-green-800">
                      <CardHeader className="bg-green-50 dark:bg-green-950">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Aposta 3
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Casa de Apostas</Label>
                            <Input
                              value={data.bet3House || ''}
                              onChange={(e) => updateEditableField(index, 'bet3House', e.target.value)}
                              data-testid={`input-bet3-house-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Titular da Conta</Label>
                            <Select
                              value={data.bet3SelectedHouseId || ""}
                              onValueChange={(value) => updateEditableField(index, 'bet3SelectedHouseId', value)}
                            >
                              <SelectTrigger data-testid={`select-bet3-holder-${index}`}>
                                <SelectValue placeholder="Selecione o titular" />
                              </SelectTrigger>
                              <SelectContent>
                                {bettingHouses.map((house) => (
                                  <SelectItem key={house.id} value={house.id}>
                                    {house.accountHolder?.name || 'Sem titular'} - {house.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Input
                              value={data.bet3Type || ''}
                              onChange={(e) => updateEditableField(index, 'bet3Type', e.target.value)}
                              data-testid={`input-bet3-type-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Odd</Label>
                            <Input
                              type="number"
                              step="0.001"
                              value={data.bet3Odd || ''}
                              onChange={(e) => updateEditableField(index, 'bet3Odd', e.target.value)}
                              data-testid={`input-bet3-odd-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Stake (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={data.bet3Stake || ''}
                              onChange={(e) => updateEditableField(index, 'bet3Stake', e.target.value)}
                              data-testid={`input-bet3-stake-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Lucro Potencial (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={data.bet3Profit || ''}
                              onChange={(e) => updateEditableField(index, 'bet3Profit', e.target.value)}
                              data-testid={`input-bet3-profit-${index}`}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })}
          </div>

          {/* Botões no final da página */}
          <div className="flex items-center justify-end gap-2 pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleClearAll}
              data-testid="button-reset-bottom"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Recomeçar
            </Button>
            <Button
              onClick={handleSubmitBets}
              disabled={isSubmitting}
              data-testid="button-submit-bets-bottom"
            >
              {isSubmitting ? "Enviando..." : "Adicionar Todas as Apostas ao Sistema"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
