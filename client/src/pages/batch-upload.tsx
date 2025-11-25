import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, XCircle, Loader2, Package, AlertTriangle, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { BettingHouse, AccountHolder } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface ExtractedBet {
  fileName: string;
  success: boolean;
  error?: string;
  data?: {
    date: string;
    sport: string;
    league: string;
    teamA: string;
    teamB: string;
    bet1: {
      house: string;
      odd: number;
      type: string;
      stake: number;
      profit: number;
    };
    bet2: {
      house: string;
      odd: number;
      type: string;
      stake: number;
      profit: number;
    };
    bet3?: {
      house: string;
      odd: number;
      type: string;
      stake: number;
      profit: number;
    };
    profitPercentage: number;
  };
}

interface EditableBetData {
  date: string;
  sport: string;
  league: string;
  teamA: string;
  teamB: string;
  profitPercentage: string;
  bet1House: string;
  bet1HouseId: string;
  bet1Type: string;
  bet1Odd: string;
  bet1Stake: string;
  bet1Profit: string;
  bet2House: string;
  bet2HouseId: string;
  bet2Type: string;
  bet2Odd: string;
  bet2Stake: string;
  bet2Profit: string;
  bet3House?: string;
  bet3HouseId?: string;
  bet3Type?: string;
  bet3Odd?: string;
  bet3Stake?: string;
  bet3Profit?: string;
}

// Helper function to wrap apiRequest with proper error handling and JSON parsing
async function createResource<T>(
  endpoint: string,
  payload: unknown,
  resourceLabel: string
): Promise<T> {
  try {
    const response = await apiRequest("POST", endpoint, payload);
    return await response.json();
  } catch (error) {
    // apiRequest already throws enriched errors with backend messages
    const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
    throw new Error(`Falha ao criar ${resourceLabel}: ${errorMsg}`);
  }
}

export default function BatchUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const [extractedBets, setExtractedBets] = useState<ExtractedBet[]>([]);
  const [editableData, setEditableData] = useState<Record<number, EditableBetData>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingHouse, setIsCreatingHouse] = useState(false);
  const { toast} = useToast();
  const [, navigate] = useLocation();

  const { data: holders = [], isLoading: holdersLoading } = useQuery<AccountHolder[]>({
    queryKey: ["/api/account-holders"],
  });

  const { data: allHouses = [], isLoading: housesLoading } = useQuery<BettingHouse[]>({
    queryKey: ['/api/betting-houses'],
  });

  const isDataLoading = holdersLoading || housesLoading;

  // Create combined options for dropdowns: "Titular - Casa"
  const houseOptions = allHouses
    .map(house => {
      const holder = holders.find(h => h.id === house.accountHolderId);
      return {
        id: house.id,
        name: house.name,
        holderName: holder?.name || "Titular não encontrado",
        displayLabel: `${holder?.name || "Titular não encontrado"} - ${house.name}`,
      };
    })
    .sort((a, b) => {
      const holderCompare = a.holderName.localeCompare(b.holderName);
      if (holderCompare !== 0) return holderCompare;
      return a.name.localeCompare(b.name);
    });

  // Derive unmatched betting houses from editable data (supports bet3)
  const unmatchedHouses = useMemo(() => {
    const unmatched: string[] = [];
    const seen = new Set<string>();
    
    Object.values(editableData).forEach((data) => {
      // Check bet1: has house name but no house ID
      if (data.bet1House && !data.bet1HouseId) {
        const normalized = data.bet1House.trim().toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          unmatched.push(data.bet1House); // Keep original casing for display
        }
      }
      // Check bet2: has house name but no house ID
      if (data.bet2House && !data.bet2HouseId) {
        const normalized = data.bet2House.trim().toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          unmatched.push(data.bet2House); // Keep original casing for display
        }
      }
      // Check bet3: has house name but no house ID (triple bets)
      if (data.bet3House && !data.bet3HouseId) {
        const normalized = data.bet3House.trim().toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          unmatched.push(data.bet3House); // Keep original casing for display
        }
      }
    });
    return unmatched;
  }, [editableData]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const pdfFiles = selectedFiles.filter(file => file.type === 'application/pdf');
      
      if (pdfFiles.length !== selectedFiles.length) {
        toast({
          title: "Alguns arquivos foram ignorados",
          description: "Apenas arquivos PDF são aceitos",
          variant: "destructive",
        });
      }
      
      setFiles(pdfFiles);
      setExtractedBets([]);
      setEditableData({});
    }
  };

  const findBettingHouse = (houseName: string) => {
    if (!allHouses) return null;
    
    const cleanName = houseName.replace(/\s*\([A-Z]{2}\)\s*/, '').trim().toLowerCase();
    
    return allHouses.find(house => {
      const houseNameClean = house.name.toLowerCase();
      return houseNameClean.includes(cleanName) || cleanName.includes(houseNameClean);
    });
  };

  const processAllPdfs = async () => {
    if (files.length === 0) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione arquivos PDF primeiro",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setExtractedBets([]);
    setEditableData({});

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/ocr/process-batch', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setExtractedBets(result.results);
        
        // Initialize editable data for successful extractions (supports bet3)
        const initialEditableData: Record<number, EditableBetData> = {};
        result.results.forEach((bet: ExtractedBet, index: number) => {
          if (bet.success && bet.data) {
            const house1 = findBettingHouse(bet.data.bet1.house);
            const house2 = findBettingHouse(bet.data.bet2.house);
            const house3 = bet.data.bet3 ? findBettingHouse(bet.data.bet3.house) : null;
            
            initialEditableData[index] = {
              date: bet.data.date,
              sport: bet.data.sport,
              league: bet.data.league,
              teamA: bet.data.teamA,
              teamB: bet.data.teamB,
              profitPercentage: bet.data.profitPercentage.toString(),
              bet1House: bet.data.bet1.house,
              bet1HouseId: house1?.id || '',
              bet1Type: bet.data.bet1.type,
              bet1Odd: bet.data.bet1.odd.toString(),
              bet1Stake: bet.data.bet1.stake.toString(),
              bet1Profit: bet.data.bet1.profit.toString(),
              bet2House: bet.data.bet2.house,
              bet2HouseId: house2?.id || '',
              bet2Type: bet.data.bet2.type,
              bet2Odd: bet.data.bet2.odd.toString(),
              bet2Stake: bet.data.bet2.stake.toString(),
              bet2Profit: bet.data.bet2.profit.toString(),
            };
            
            // Add bet3 if it exists (triple bets)
            if (bet.data.bet3) {
              initialEditableData[index].bet3House = bet.data.bet3.house;
              initialEditableData[index].bet3HouseId = house3?.id || '';
              initialEditableData[index].bet3Type = bet.data.bet3.type;
              initialEditableData[index].bet3Odd = bet.data.bet3.odd.toString();
              initialEditableData[index].bet3Stake = bet.data.bet3.stake.toString();
              initialEditableData[index].bet3Profit = bet.data.bet3.profit.toString();
            }
          }
        });
        setEditableData(initialEditableData);
        
        const successCount = result.results.filter((r: ExtractedBet) => r.success).length;
        const failCount = result.results.length - successCount;
        
        toast({
          title: "Processamento concluído",
          description: `${successCount} PDFs processados com sucesso${failCount > 0 ? `, ${failCount} com erro` : ''}`,
        });
      } else {
        toast({
          title: "Erro no processamento",
          description: result.error || "Erro ao processar PDFs",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro de conexão",
        description: "Falha ao processar PDFs. Tente novamente.",
        variant: "destructive",
      });
      console.error('Batch processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDateForInput = (isoDate: string): string => {
    if (!isoDate) return '';
    try {
      return isoDate.substring(0, 16);
    } catch {
      return '';
    }
  };

  const updateEditableField = (index: number, field: keyof EditableBetData, value: string) => {
    setEditableData(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value
      }
    }));
  };

  const handleQuickCreateHouses = async () => {
    setIsCreatingHouse(true);
    
    try {
      // 1. Ensure we have an account holder
      let holderId = "";
      
      if (holders.length === 0) {
        // Create a default account holder using helper
        const newHolder = await createResource<AccountHolder>(
          '/api/account-holders',
          { name: "Titular Padrão" },
          "titular padrão"
        );
        holderId = newHolder.id;
        
        // Invalidate AND refetch to ensure dropdowns update
        await queryClient.invalidateQueries({ queryKey: ['/api/account-holders'] });
        await queryClient.refetchQueries({ queryKey: ['/api/account-holders'] });
      } else {
        // Use the first available holder
        holderId = holders[0].id;
      }
      
      // 2. Create all unmatched houses one by one
      const createdHouses: { originalName: string; normalizedName: string; id: string }[] = [];
      const errors: string[] = [];
      
      for (const houseName of unmatchedHouses) {
        try {
          const newHouse = await createResource<BettingHouse>(
            '/api/betting-houses',
            {
              name: houseName,
              accountHolderId: holderId,
            },
            `casa "${houseName}"`
          );
          
          createdHouses.push({
            originalName: houseName,
            normalizedName: houseName.trim().toLowerCase(),
            id: newHouse.id
          });
        } catch (error) {
          // Preserve backend error message
          const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
          errors.push(`${houseName}: ${errorMsg}`);
        }
      }
      
      // If ALL houses failed to create, throw error
      if (errors.length > 0 && createdHouses.length === 0) {
        throw new Error(`Nenhuma casa foi criada. Erros:\n${errors.join('\n')}`);
      }
      
      // 3. Update editableData ONLY for successfully created houses
      if (createdHouses.length > 0) {
        setEditableData(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(key => {
            const k = parseInt(key);
            
            createdHouses.forEach(({ normalizedName, id }) => {
              // Normalize bet house names for comparison
              const bet1Normalized = updated[k].bet1House?.trim().toLowerCase();
              const bet2Normalized = updated[k].bet2House?.trim().toLowerCase();
              
              if (bet1Normalized === normalizedName) {
                updated[k].bet1HouseId = id;
              }
              if (bet2Normalized === normalizedName) {
                updated[k].bet2HouseId = id;
              }
            });
          });
          return updated;
        });
        
        // 4. Invalidate queries to refresh dropdowns
        await queryClient.invalidateQueries({ queryKey: ['/api/betting-houses'] });
      }
      
      // Show success/partial success message with backend error details
      if (errors.length > 0) {
        const failedHouses = errors.map(e => e.split(':')[0]).join(', ');
        toast({
          title: "Casas criadas parcialmente",
          description: `${createdHouses.length} casa(s) criadas com sucesso. ${errors.length} falharam: ${failedHouses}. Veja o console para mais detalhes.`,
          variant: "default",
        });
        console.error('Erros detalhados ao criar casas:', errors);
      } else {
        toast({
          title: "Casas criadas com sucesso!",
          description: `${createdHouses.length} casa(s) de apostas foram criadas. Agora você pode adicionar as apostas ao sistema.`,
        });
      }
      
    } catch (error) {
      // Display backend error message to user
      const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao criar casas",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsCreatingHouse(false);
    }
  };

  const createAllBets = async () => {
    const successfulBets = extractedBets
      .map((bet, index) => ({ bet, index }))
      .filter(({ bet }) => bet.success && bet.data);
    
    if (successfulBets.length === 0) {
      toast({
        title: "Nenhuma aposta para criar",
        description: "Não há apostas extraídas com sucesso",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      let created = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const { bet, index } of successfulBets) {
        try {
          const data = editableData[index];
          
          if (!data) {
            errors.push(`${bet.fileName}: Dados editáveis não encontrados`);
            failed++;
            continue;
          }

          // Check if bet3 exists (triple bet detection)
          const hasBet3 = !!(data.bet3House || data.bet3Type || data.bet3Odd);
          
          // Validação completa de campos obrigatórios
          const missingFields: string[] = [];
          
          if (!data.date) missingFields.push("Data/Hora");
          if (!data.sport?.trim()) missingFields.push("Esporte");
          if (!data.league?.trim()) missingFields.push("Liga");
          if (!data.teamA?.trim()) missingFields.push("Time A");
          if (!data.teamB?.trim()) missingFields.push("Time B");
          if (!data.profitPercentage) missingFields.push("Lucro %");
          
          if (!data.bet1HouseId) missingFields.push("Titular Aposta 1");
          if (!data.bet1Type?.trim()) missingFields.push("Tipo Aposta 1");
          if (!data.bet2HouseId) missingFields.push("Titular Aposta 2");
          if (!data.bet2Type?.trim()) missingFields.push("Tipo Aposta 2");
          
          if (hasBet3) {
            if (!data.bet3HouseId) missingFields.push("Titular Aposta 3");
            if (!data.bet3Type?.trim()) missingFields.push("Tipo Aposta 3");
          }
          
          if (missingFields.length > 0) {
            errors.push(`${bet.fileName}: Preencha todos os campos obrigatórios: ${missingFields.join(", ")}`);
            failed++;
            continue;
          }

          const surebetSetData = {
            eventDate: data.date || null,
            sport: data.sport,
            league: data.league,
            teamA: data.teamA,
            teamB: data.teamB,
            profitPercentage: data.profitPercentage.toString(),
            status: "pending",
          };

          const bet1Data = {
            betType: data.bet1Type,
            odd: data.bet1Odd.toString(),
            stake: data.bet1Stake.toString(),
            potentialProfit: data.bet1Profit.toString(),
            bettingHouseId: data.bet1HouseId,
          };

          const bet2Data = {
            betType: data.bet2Type,
            odd: data.bet2Odd.toString(),
            stake: data.bet2Stake.toString(),
            potentialProfit: data.bet2Profit.toString(),
            bettingHouseId: data.bet2HouseId,
          };

          const betsArray = [bet1Data, bet2Data];

          // Add bet3 if it exists (triple bets)
          if (hasBet3) {
            const bet3Data = {
              betType: data.bet3Type!,
              odd: data.bet3Odd!.toString(),
              stake: data.bet3Stake!.toString(),
              potentialProfit: data.bet3Profit!.toString(),
              bettingHouseId: data.bet3HouseId!,
            };
            betsArray.push(bet3Data);
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
            errors.push(`${bet.fileName}: ${errorText}`);
            failed++;
          }
        } catch (error) {
          errors.push(`${bet.fileName}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          failed++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/surebet-sets'] });

      if (created > 0) {
        toast({
          title: "✅ Apostas criadas com sucesso!",
          description: `${created} aposta(s) adicionada(s) ao sistema${failed > 0 ? `. ${failed} falhou(aram)` : ''}`,
        });

        // Reset para tela inicial após sucesso
        if (failed === 0) {
          setTimeout(() => {
            setFiles([]);
            setExtractedBets([]);
            setEditableData({});
          }, 1500);
        }
      }

      if (errors.length > 0 && failed > 0) {
        console.error('Erros na criação:', errors);
        toast({
          title: "⚠️ Alguns erros ocorreram",
          description: `${failed} aposta(s) não puderam ser criadas. Verifique o console.`,
          variant: "destructive",
        });
      }

    } catch (error) {
      toast({
        title: "Erro ao criar apostas",
        description: "Falha ao adicionar apostas ao sistema",
        variant: "destructive",
      });
      console.error('Batch creation error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Package className="h-8 w-8" />
          Enviar Lote de Apostas
        </h1>
        <p className="text-muted-foreground">
          Envie múltiplos PDFs de uma vez e crie todas as apostas automaticamente
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar Arquivos PDF</CardTitle>
          <CardDescription>
            Escolha um ou mais arquivos PDF de surebets para processar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="file"
              id="batch-file-input"
              className="hidden"
              accept=".pdf,application/pdf"
              multiple
              onChange={handleFileSelect}
              data-testid="input-batch-files"
            />
            <label htmlFor="batch-file-input">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('batch-file-input')?.click()}
                data-testid="button-select-files"
              >
                <Upload className="h-4 w-4 mr-2" />
                Selecionar PDFs
              </Button>
            </label>
            
            {files.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  <FileText className="h-3 w-3 mr-1" />
                  {files.length} arquivo(s) selecionado(s)
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFiles([]);
                    setExtractedBets([]);
                    setEditableData({});
                  }}
                  data-testid="button-clear-files"
                >
                  Limpar
                </Button>
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Arquivos selecionados:</p>
              <div className="grid gap-2 max-h-40 overflow-y-auto">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm"
                    data-testid={`file-item-${index}`}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={processAllPdfs}
            disabled={files.length === 0 || isProcessing}
            className="w-full"
            data-testid="button-process-batch"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando {files.length} PDF(s)...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Processar {files.length > 0 ? `${files.length} PDF(s)` : 'PDFs'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Blocking Alert for Unmatched Betting Houses */}
      {extractedBets.length > 0 && unmatchedHouses.length > 0 && (
        <Alert variant="destructive" data-testid="alert-unmatched-houses">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Casas de Apostas Não Cadastradas</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>As seguintes casas precisam ser criadas antes de adicionar as apostas ao sistema:</p>
            <div className="flex flex-wrap gap-2">
              {unmatchedHouses.map(house => (
                <Badge key={house} variant="outline" className="text-sm">
                  {house}
                </Badge>
              ))}
            </div>
            <Button 
              onClick={handleQuickCreateHouses}
              disabled={isCreatingHouse}
              size="sm"
              variant="default"
              data-testid="button-create-houses"
            >
              {isCreatingHouse ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Casas de Apostas Automaticamente
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {extractedBets.length > 0 && (
        <>
          <div className="space-y-6">
            {extractedBets.map((bet, index) => (
              <div key={index}>
                {bet.success && bet.data && editableData[index] ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <h2 className="text-xl font-semibold">{bet.fileName}</h2>
                      <Badge variant="default">Sucesso</Badge>
                    </div>

                    {/* Event Information */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Informações do Evento</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`date-${index}`}>Data e Hora</Label>
                            <Input
                              id={`date-${index}`}
                              type="datetime-local"
                              value={formatDateForInput(editableData[index].date)}
                              onChange={(e) => updateEditableField(index, 'date', e.target.value)}
                              data-testid={`input-date-${index}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`profit-percentage-${index}`}>Lucro (%)</Label>
                            <Input
                              id={`profit-percentage-${index}`}
                              type="number"
                              step="0.01"
                              value={editableData[index].profitPercentage}
                              onChange={(e) => updateEditableField(index, 'profitPercentage', e.target.value)}
                              data-testid={`input-profit-percentage-${index}`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`sport-${index}`}>Esporte</Label>
                            <Input
                              id={`sport-${index}`}
                              value={editableData[index].sport}
                              onChange={(e) => updateEditableField(index, 'sport', e.target.value)}
                              data-testid={`input-sport-${index}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`league-${index}`}>Liga</Label>
                            <Input
                              id={`league-${index}`}
                              value={editableData[index].league}
                              onChange={(e) => updateEditableField(index, 'league', e.target.value)}
                              data-testid={`input-league-${index}`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`teamA-${index}`}>Time A</Label>
                            <Input
                              id={`teamA-${index}`}
                              value={editableData[index].teamA}
                              onChange={(e) => updateEditableField(index, 'teamA', e.target.value)}
                              data-testid={`input-teamA-${index}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`teamB-${index}`}>Time B</Label>
                            <Input
                              id={`teamB-${index}`}
                              value={editableData[index].teamB}
                              onChange={(e) => updateEditableField(index, 'teamB', e.target.value)}
                              data-testid={`input-teamB-${index}`}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Bet 1 */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Aposta 1</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`bet1-house-${index}`}>Casa de Apostas</Label>
                            <Input
                              id={`bet1-house-${index}`}
                              value={editableData[index].bet1House}
                              onChange={(e) => updateEditableField(index, 'bet1House', e.target.value)}
                              data-testid={`input-bet1-house-${index}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`bet1-type-${index}`}>Tipo</Label>
                            <Input
                              id={`bet1-type-${index}`}
                              value={editableData[index].bet1Type}
                              onChange={(e) => updateEditableField(index, 'bet1Type', e.target.value)}
                              data-testid={`input-bet1-type-${index}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`bet1-house-id-${index}`}>Titular da Conta</Label>
                            <Select
                              value={editableData[index].bet1HouseId}
                              onValueChange={(value) => updateEditableField(index, 'bet1HouseId', value)}
                            >
                              <SelectTrigger id={`bet1-house-id-${index}`} data-testid={`select-bet1-house-${index}`} disabled={isDataLoading}>
                                <SelectValue placeholder={
                                  isDataLoading 
                                    ? "Carregando..." 
                                    : houseOptions.length === 0 
                                      ? "Nenhuma casa cadastrada" 
                                      : "Selecionar titular"
                                } />
                              </SelectTrigger>
                              <SelectContent>
                                {houseOptions.length === 0 && !isDataLoading ? (
                                  <SelectItem value="no-houses" disabled>
                                    Nenhuma casa de apostas cadastrada
                                  </SelectItem>
                                ) : (
                                  houseOptions.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>
                                      {option.displayLabel}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`bet1-odd-${index}`}>Odd</Label>
                            <Input
                              id={`bet1-odd-${index}`}
                              type="number"
                              step="0.001"
                              value={editableData[index].bet1Odd}
                              onChange={(e) => updateEditableField(index, 'bet1Odd', e.target.value)}
                              data-testid={`input-bet1-odd-${index}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`bet1-stake-${index}`}>Stake (R$)</Label>
                            <Input
                              id={`bet1-stake-${index}`}
                              type="number"
                              step="0.01"
                              value={editableData[index].bet1Stake}
                              onChange={(e) => updateEditableField(index, 'bet1Stake', e.target.value)}
                              data-testid={`input-bet1-stake-${index}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`bet1-profit-${index}`}>Lucro Potencial (R$)</Label>
                            <Input
                              id={`bet1-profit-${index}`}
                              type="number"
                              step="0.01"
                              value={editableData[index].bet1Profit}
                              onChange={(e) => updateEditableField(index, 'bet1Profit', e.target.value)}
                              data-testid={`input-bet1-profit-${index}`}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Bet 2 */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Aposta 2</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`bet2-house-${index}`}>Casa de Apostas</Label>
                            <Input
                              id={`bet2-house-${index}`}
                              value={editableData[index].bet2House}
                              onChange={(e) => updateEditableField(index, 'bet2House', e.target.value)}
                              data-testid={`input-bet2-house-${index}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`bet2-type-${index}`}>Tipo</Label>
                            <Input
                              id={`bet2-type-${index}`}
                              value={editableData[index].bet2Type}
                              onChange={(e) => updateEditableField(index, 'bet2Type', e.target.value)}
                              data-testid={`input-bet2-type-${index}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`bet2-house-id-${index}`}>Titular da Conta</Label>
                            <Select
                              value={editableData[index].bet2HouseId}
                              onValueChange={(value) => updateEditableField(index, 'bet2HouseId', value)}
                            >
                              <SelectTrigger id={`bet2-house-id-${index}`} data-testid={`select-bet2-house-${index}`} disabled={isDataLoading}>
                                <SelectValue placeholder={
                                  isDataLoading 
                                    ? "Carregando..." 
                                    : houseOptions.length === 0 
                                      ? "Nenhuma casa cadastrada" 
                                      : "Selecionar titular"
                                } />
                              </SelectTrigger>
                              <SelectContent>
                                {houseOptions.length === 0 && !isDataLoading ? (
                                  <SelectItem value="no-houses" disabled>
                                    Nenhuma casa de apostas cadastrada
                                  </SelectItem>
                                ) : (
                                  houseOptions.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>
                                      {option.displayLabel}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`bet2-odd-${index}`}>Odd</Label>
                            <Input
                              id={`bet2-odd-${index}`}
                              type="number"
                              step="0.001"
                              value={editableData[index].bet2Odd}
                              onChange={(e) => updateEditableField(index, 'bet2Odd', e.target.value)}
                              data-testid={`input-bet2-odd-${index}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`bet2-stake-${index}`}>Stake (R$)</Label>
                            <Input
                              id={`bet2-stake-${index}`}
                              type="number"
                              step="0.01"
                              value={editableData[index].bet2Stake}
                              onChange={(e) => updateEditableField(index, 'bet2Stake', e.target.value)}
                              data-testid={`input-bet2-stake-${index}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`bet2-profit-${index}`}>Lucro Potencial (R$)</Label>
                            <Input
                              id={`bet2-profit-${index}`}
                              type="number"
                              step="0.01"
                              value={editableData[index].bet2Profit}
                              onChange={(e) => updateEditableField(index, 'bet2Profit', e.target.value)}
                              data-testid={`input-bet2-profit-${index}`}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Bet 3 (condicional - apenas para apostas triplas) */}
                    {editableData[index].bet3House && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Aposta 3</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`bet3-house-${index}`}>Casa de Apostas</Label>
                              <Input
                                id={`bet3-house-${index}`}
                                value={editableData[index].bet3House}
                                onChange={(e) => updateEditableField(index, 'bet3House', e.target.value)}
                                data-testid={`input-bet3-house-${index}`}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`bet3-type-${index}`}>Tipo</Label>
                              <Input
                                id={`bet3-type-${index}`}
                                value={editableData[index].bet3Type}
                                onChange={(e) => updateEditableField(index, 'bet3Type', e.target.value)}
                                data-testid={`input-bet3-type-${index}`}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`bet3-house-id-${index}`}>Titular da Conta</Label>
                              <Select
                                value={editableData[index].bet3HouseId}
                                onValueChange={(value) => updateEditableField(index, 'bet3HouseId', value)}
                              >
                                <SelectTrigger id={`bet3-house-id-${index}`} data-testid={`select-bet3-house-${index}`} disabled={isDataLoading}>
                                  <SelectValue placeholder={
                                    isDataLoading 
                                      ? "Carregando..." 
                                      : houseOptions.length === 0 
                                        ? "Nenhuma casa cadastrada" 
                                        : "Selecionar titular"
                                  } />
                                </SelectTrigger>
                                <SelectContent>
                                  {houseOptions.length === 0 && !isDataLoading ? (
                                    <SelectItem value="no-houses" disabled>
                                      Nenhuma casa de apostas cadastrada
                                    </SelectItem>
                                  ) : (
                                    houseOptions.map((option) => (
                                      <SelectItem key={option.id} value={option.id}>
                                        {option.displayLabel}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`bet3-odd-${index}`}>Odd</Label>
                              <Input
                                id={`bet3-odd-${index}`}
                                type="number"
                                step="0.001"
                                value={editableData[index].bet3Odd}
                                onChange={(e) => updateEditableField(index, 'bet3Odd', e.target.value)}
                                data-testid={`input-bet3-odd-${index}`}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`bet3-stake-${index}`}>Stake (R$)</Label>
                              <Input
                                id={`bet3-stake-${index}`}
                                type="number"
                                step="0.01"
                                value={editableData[index].bet3Stake}
                                onChange={(e) => updateEditableField(index, 'bet3Stake', e.target.value)}
                                data-testid={`input-bet3-stake-${index}`}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`bet3-profit-${index}`}>Lucro Potencial (R$)</Label>
                              <Input
                                id={`bet3-profit-${index}`}
                                type="number"
                                step="0.01"
                                value={editableData[index].bet3Profit}
                                onChange={(e) => updateEditableField(index, 'bet3Profit', e.target.value)}
                                data-testid={`input-bet3-profit-${index}`}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card className="border-red-200 dark:border-red-900">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <CardTitle>{bet.fileName}</CardTitle>
                        <Badge variant="destructive">Erro</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {bet.error || "Erro desconhecido ao processar PDF"}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ))}
          </div>

          {extractedBets.some(b => b.success) && (
            <Card className="border-green-200 dark:border-green-900">
              <CardContent className="pt-6">
                {unmatchedHouses.length > 0 && (
                  <p className="text-sm text-muted-foreground mb-4 text-center">
                    ⚠️ Configure as casas de apostas acima antes de adicionar ao sistema
                  </p>
                )}
                <Button
                  onClick={createAllBets}
                  disabled={isCreating || unmatchedHouses.length > 0 || isDataLoading || isCreatingHouse}
                  className="w-full"
                  size="lg"
                  data-testid="button-create-all-bets"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Criando apostas...
                    </>
                  ) : unmatchedHouses.length > 0 ? (
                    <>
                      <AlertTriangle className="h-5 w-5 mr-2" />
                      Configure as casas de apostas primeiro
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Adicionar Todas as Apostas ao Sistema ({extractedBets.filter(b => b.success).length})
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
