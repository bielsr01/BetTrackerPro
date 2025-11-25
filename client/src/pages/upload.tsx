import { useState, useEffect } from "react";
import { ImageUpload } from "@/components/image-upload";
import { BetForm } from "@/components/bet-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Upload, Wand2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

type UploadStep = "upload" | "edit";

export default function UploadPage() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<UploadStep>("upload");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Check for imported OCR data on component mount
  useEffect(() => {
    const importedData = sessionStorage.getItem('importedPDFData');
    if (importedData) {
      try {
        const parsedData = JSON.parse(importedData);
        // Validate basic structure before using
        if (parsedData && typeof parsedData === 'object' && parsedData.sport) {
          setExtractedData(parsedData);
          setCurrentStep("edit");
        }
        // Clear the imported data from sessionStorage
        sessionStorage.removeItem('importedPDFData');
      } catch (error) {
        console.error('Error parsing imported OCR data:', error);
        sessionStorage.removeItem('importedPDFData');
      }
    }
  }, []);

  const handleImageUpload = (file: File) => {
    const imageUrl = URL.createObjectURL(file);
    setUploadedImage(imageUrl);
    setIsProcessing(true);
  };

  const handleOCRComplete = (ocrData: any) => {
    // DEBUG: Log what we receive from backend
    console.log('handleOCRComplete received ocrData:', ocrData);
    console.log('Does ocrData have bet3?', {
      hasBet3: !!ocrData.bet3,
      bet3House: ocrData.bet3?.house,
      bet3Type: ocrData.bet3?.type,
      bet3Odd: ocrData.bet3?.odd
    });
    
    // Transform OCR data to form format, safely handling null values (supports 2 OR 3 bets)
    const formattedData: any = {
      eventDate: ocrData.date,
      sport: ocrData.sport || "",
      league: ocrData.league || "",
      teamA: ocrData.teamA || "",
      teamB: ocrData.teamB || "",
      profitPercentage: String(ocrData.profitPercentage ?? ""),
      bet1House: ocrData.bet1?.house || "",
      bet1HouseId: "", // User needs to select this manually
      bet1Type: ocrData.bet1?.type || "",
      bet1Odd: String(ocrData.bet1?.odd ?? ""),
      bet1Stake: String(ocrData.bet1?.stake ?? ""),
      bet1Profit: String(ocrData.bet1?.profit ?? ""),
      bet1AccountHolder: "",
      bet2House: ocrData.bet2?.house || "",
      bet2HouseId: "", // User needs to select this manually
      bet2Type: ocrData.bet2?.type || "",
      bet2Odd: String(ocrData.bet2?.odd ?? ""),
      bet2Stake: String(ocrData.bet2?.stake ?? ""),
      bet2Profit: String(ocrData.bet2?.profit ?? ""),
      bet2AccountHolder: "",
    };
    
    // Add bet3 if it exists
    if (ocrData.bet3?.house) {
      formattedData.bet3House = ocrData.bet3.house;
      formattedData.bet3HouseId = "";
      formattedData.bet3Type = ocrData.bet3.type;
      formattedData.bet3Odd = String(ocrData.bet3.odd ?? "");
      formattedData.bet3Stake = String(ocrData.bet3.stake ?? "");
      formattedData.bet3Profit = String(ocrData.bet3.profit ?? "");
      formattedData.bet3AccountHolder = "";
    }
    
    setExtractedData(formattedData);
    setIsProcessing(false);
    setCurrentStep("edit");
  };

  const handleOCRError = (error: string) => {
    console.error("OCR Error:", error);
    setIsProcessing(false);
    // You could show a toast notification here
  };

  const handleImageRemove = () => {
    if (uploadedImage) {
      URL.revokeObjectURL(uploadedImage);
    }
    setUploadedImage(null);
    setExtractedData(null);
    setCurrentStep("upload");
  };

  const handleFormSubmit = async (data: any) => {
    setIsSaving(true);
    try {
      console.log("Submitting form data:", data);
      
      // Validate required fields (supports 2 OR 3 bets)
      // Detect bet3 if any of its fields are populated (from OCR or manual entry)
      const hasBet3 = !!(data.bet3House || data.bet3Type || data.bet3Odd);
      
      if (!data.bet1HouseId || !data.bet2HouseId) {
        toast({
          title: "Campos obrigatórios",
          description: "Por favor, selecione os titulares de conta para ambas as apostas.",
          variant: "destructive",
          duration: 3000,
        });
        setIsSaving(false);
        return;
      }
      
      if (hasBet3 && !data.bet3HouseId) {
        toast({
          title: "Campos obrigatórios",
          description: "Por favor, selecione o titular de conta para a terceira aposta.",
          variant: "destructive",
          duration: 3000,
        });
        setIsSaving(false);
        return;
      }
      
      // Create surebet set and bets
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
      
      // Add bet3 if it exists
      if (hasBet3) {
        const bet3Data = {
          betType: data.bet3Type,
          odd: data.bet3Odd.toString(),
          stake: data.bet3Stake.toString(),
          potentialProfit: data.bet3Profit.toString(),
          bettingHouseId: data.bet3HouseId,
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
        const result = await response.json();
        console.log("Bet saved successfully!", result);
        
        // Invalidate queries asynchronously (no await needed for faster UX)
        queryClient.invalidateQueries({ 
          queryKey: ["/api/surebet-sets"],
          refetchType: 'all' // Force refetch even if data is stale
        });
        
        toast({
          title: "✅ Aposta salva!",
          description: "Surebet salvo com sucesso!",
          duration: 3000,
        });
        
        setIsSaving(false);
        // Clear form and stay on upload page
        handleImageRemove(); // This will reset to upload step and clear all data
      } else {
        const errorText = await response.text();
        console.error("Failed to save bet:", errorText);
        toast({
          title: "❌ Erro ao salvar",
          description: "Erro ao salvar surebet. Verifique os dados e tente novamente.",
          variant: "destructive",
          duration: 3000,
        });
        setIsSaving(false);
      }
    } catch (error) {
      console.error("Error saving bet:", error);
      toast({
        title: "❌ Erro de conexão",
        description: "Erro ao salvar surebet. Verifique sua conexão e tente novamente.",
        variant: "destructive",
        duration: 3000,
      });
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setCurrentStep("upload");
    setExtractedData(null);
  };

  if (currentStep === "edit" && extractedData) {
    // Debug log to verify bet3 data is being passed to BetForm
    console.log('Upload page passing extractedData to BetForm:', {
      hasBet3House: !!extractedData.bet3House,
      hasBet3Type: !!extractedData.bet3Type,
      hasBet3Odd: !!extractedData.bet3Odd,
      bet3House: extractedData.bet3House,
      bet3Type: extractedData.bet3Type,
      bet3Odd: extractedData.bet3Odd,
      fullData: extractedData
    });
    
    return (
      <div className="p-6">
        <BetForm
          initialData={extractedData}
          onSubmit={handleFormSubmit}
          onCancel={handleCancel}
          isLoading={isSaving}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Nova Aposta</h1>
          <p className="text-muted-foreground">
            Faça upload de um PDF para extrair automaticamente os dados da aposta
          </p>
        </div>
        
        <Link href="/">
          <Button variant="outline" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload do PDF
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUpload
            onImageUpload={handleImageUpload}
            onImageRemove={handleImageRemove}
            uploadedImage={uploadedImage}
            isProcessing={isProcessing}
            onOCRComplete={handleOCRComplete}
            onOCRError={handleOCRError}
            className="min-h-[400px]"
          />
          
          {isProcessing && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 animate-pulse" />
                <span className="text-sm">
                  Processando PDF com pdfplumber... Isso pode levar alguns segundos.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}