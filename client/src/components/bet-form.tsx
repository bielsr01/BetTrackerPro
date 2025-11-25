import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Save, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountHolder, BettingHouse } from "@shared/schema";

const betFormSchema = z.object({
  eventDate: z.string(),
  sport: z.string().min(1, "Esporte é obrigatório"),
  league: z.string().min(1, "Liga é obrigatória"),
  teamA: z.string().min(1, "Time A é obrigatório"),
  teamB: z.string().min(1, "Time B é obrigatório"),
  profitPercentage: z.coerce.number(),
  
  // Bet 1 - casa de apostas (texto para OCR) e titular da conta (selector)
  bet1House: z.string().min(1, "Casa de apostas é obrigatória"),
  bet1HouseId: z.string().min(1, "Titular da conta é obrigatório"),
  bet1Type: z.string().min(1, "Tipo de aposta é obrigatório"),
  bet1Odd: z.coerce.number(),
  bet1Stake: z.coerce.number(),
  bet1Profit: z.coerce.number(),
  bet1AccountHolder: z.string().optional(),
  
  // Bet 2 - casa de apostas (texto para OCR) e titular da conta (selector)
  bet2House: z.string().min(1, "Casa de apostas é obrigatória"),
  bet2HouseId: z.string().min(1, "Titular da conta é obrigatório"),
  bet2Type: z.string().min(1, "Tipo de aposta é obrigatório"),
  bet2Odd: z.coerce.number(),
  bet2Stake: z.coerce.number(),
  bet2Profit: z.coerce.number(),
  bet2AccountHolder: z.string().optional(),
  
  // Bet 3 (opcional - apenas para apostas triplas)
  bet3House: z.string().optional(),
  bet3HouseId: z.string().optional(),
  bet3Type: z.string().optional(),
  bet3Odd: z.coerce.number().optional(),
  bet3Stake: z.coerce.number().optional(),
  bet3Profit: z.coerce.number().optional(),
  bet3AccountHolder: z.string().optional(),
});

type BetFormData = z.infer<typeof betFormSchema>;

interface BetFormProps {
  initialData?: Partial<BetFormData>;
  onSubmit: (data: BetFormData) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function BetForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  className,
}: BetFormProps) {
  // Load account holders from API
  const { data: holders = [], isLoading: holdersLoading } = useQuery<AccountHolder[]>({
    queryKey: ["/api/account-holders"],
  });

  // Load betting houses from API
  const { data: allHouses = [], isLoading: housesLoading } = useQuery<BettingHouse[]>({
    queryKey: ["/api/betting-houses"],
  });

  const isDataLoading = holdersLoading || housesLoading;

  // Create combined options for dropdowns: "Titular - Casa"
  // First, group houses by holder and sort alphabetically
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
      // First sort by holder name alphabetically
      const holderCompare = a.holderName.localeCompare(b.holderName);
      if (holderCompare !== 0) return holderCompare;
      // Then sort by house name alphabetically within the same holder
      return a.name.localeCompare(b.name);
    });

  // Detect if bet3 exists based on initialData
  const hasBet3 = useMemo(() => {
    if (!initialData) return false;
    // Check if any bet3 field has meaningful data
    return !!(
      initialData.bet3House ||
      initialData.bet3Type ||
      initialData.bet3Odd ||
      initialData.bet3Stake
    );
  }, [initialData]);

  const form = useForm<BetFormData>({
    resolver: zodResolver(betFormSchema),
    defaultValues: {
      eventDate: initialData?.eventDate || "",
      sport: initialData?.sport || "",
      league: initialData?.league || "",
      teamA: initialData?.teamA || "",
      teamB: initialData?.teamB || "",
      profitPercentage: initialData?.profitPercentage || 0,
      bet1House: initialData?.bet1House || "",
      bet1HouseId: initialData?.bet1HouseId || "",
      bet1Type: initialData?.bet1Type || "",
      bet1Odd: initialData?.bet1Odd || 0,
      bet1Stake: initialData?.bet1Stake || 0,
      bet1Profit: initialData?.bet1Profit || 0,
      bet1AccountHolder: initialData?.bet1AccountHolder || "",
      bet2House: initialData?.bet2House || "",
      bet2HouseId: initialData?.bet2HouseId || "",
      bet2Type: initialData?.bet2Type || "",
      bet2Odd: initialData?.bet2Odd || 0,
      bet2Stake: initialData?.bet2Stake || 0,
      bet2Profit: initialData?.bet2Profit || 0,
      bet2AccountHolder: initialData?.bet2AccountHolder || "",
      bet3House: initialData?.bet3House || "",
      bet3HouseId: initialData?.bet3HouseId || "",
      bet3Type: initialData?.bet3Type || "",
      bet3Odd: initialData?.bet3Odd || 0,
      bet3Stake: initialData?.bet3Stake || 0,
      bet3Profit: initialData?.bet3Profit || 0,
      bet3AccountHolder: initialData?.bet3AccountHolder || "",
    },
  });

  // Debug log to verify bet3 data
  console.log('BetForm initialized with hasBet3:', hasBet3, 'bet3House:', initialData?.bet3House);

  const handleSubmit = (data: BetFormData) => {
    console.log("Form submitted:", data);
    onSubmit(data);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Editar Dados da Aposta</h1>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Event Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Evento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="eventDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data e Hora</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="datetime-local"
                          data-testid="input-event-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="profitPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lucro (%)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01"
                          placeholder="2.22"
                          data-testid="input-profit-percentage"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sport"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Esporte</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Futebol"
                          data-testid="input-sport"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="league"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Liga</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Liga Pro Jupiler"
                          data-testid="input-league"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="teamA"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time A</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="OH Leuven"
                          data-testid="input-team-a"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="teamB"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time B</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Anderlecht"
                          data-testid="input-team-b"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                <FormField
                  control={form.control}
                  name="bet1House"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Casa de Apostas</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Pinnacle"
                          data-testid="input-bet1-house"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bet1Type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Acima 2.25"
                          data-testid="input-bet1-type"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bet1HouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titular da Conta</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-bet1-house" disabled={isDataLoading}>
                            <SelectValue placeholder={
                              isDataLoading 
                                ? "Carregando..." 
                                : houseOptions.length === 0 
                                  ? "Nenhuma casa cadastrada" 
                                  : "Selecionar titular"
                            } />
                          </SelectTrigger>
                        </FormControl>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="bet1Odd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Odd</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01"
                          placeholder="2.25"
                          data-testid="input-bet1-odd"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bet1Stake"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stake (R$)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01"
                          placeholder="2650.00"
                          data-testid="input-bet1-stake"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bet1Profit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lucro Potencial (R$)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01"
                          placeholder="106.00"
                          data-testid="input-bet1-profit"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                <FormField
                  control={form.control}
                  name="bet2House"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Casa de Apostas</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Betano"
                          data-testid="input-bet2-house"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bet2Type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Abaixo 2.25"
                          data-testid="input-bet2-type"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bet2HouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titular da Conta</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-bet2-house" disabled={isDataLoading}>
                            <SelectValue placeholder={
                              isDataLoading 
                                ? "Carregando..." 
                                : houseOptions.length === 0 
                                  ? "Nenhuma casa cadastrada" 
                                  : "Selecionar titular"
                            } />
                          </SelectTrigger>
                        </FormControl>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="bet2Odd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Odd</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01"
                          placeholder="2.25"
                          data-testid="input-bet2-odd"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bet2Stake"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stake (R$)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01"
                          placeholder="2120.00"
                          data-testid="input-bet2-stake"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bet2Profit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lucro Potencial (R$)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01"
                          placeholder="106.00"
                          data-testid="input-bet2-profit"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Bet 3 (condicional - apenas para apostas triplas) */}
          {hasBet3 && (
            <Card>
              <CardHeader>
                <CardTitle>Aposta 3</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="bet3House"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Casa de Apostas</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Betano"
                            data-testid="input-bet3-house"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bet3Type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="X"
                            data-testid="input-bet3-type"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bet3HouseId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titular da Conta</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-bet3-account-holder">
                              <SelectValue placeholder="Selecionar titular" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {houseOptions.map(option => (
                              <SelectItem 
                                key={option.id} 
                                value={option.id}
                                data-testid={`option-bet3-${option.id}`}
                              >
                                {option.displayLabel}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="bet3Odd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Odd</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            step="0.01"
                            placeholder="5.70"
                            data-testid="input-bet3-odd"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bet3Stake"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stake (R$)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            step="0.01"
                            placeholder="1799.00"
                            data-testid="input-bet3-stake"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bet3Profit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lucro Potencial (R$)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            step="0.01"
                            placeholder="253.00"
                            data-testid="input-bet3-profit"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-4">
            {onCancel && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                data-testid="button-cancel-form"
              >
                Cancelar
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isLoading}
              data-testid="button-save-bet"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isLoading ? "Salvando..." : "Salvar Aposta"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}