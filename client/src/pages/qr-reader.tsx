import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Copy, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsQR from "jsqr";

export default function QRReader() {
  const [qrText, setQrText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processImage = useCallback(async (file: File) => {
    setIsProcessing(true);
    setStatus("idle");
    setQrText("");

    try {
      // Create preview
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Create image element
      const img = new Image();
      img.src = url;

      img.onload = () => {
        // Create canvas and get image data
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          setStatus("error");
          setIsProcessing(false);
          toast({
            variant: "destructive",
            title: "Erro",
            description: "Não foi possível processar a imagem",
          });
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Process with jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          setQrText(code.data);
          setStatus("success");
          toast({
            title: "QR Code encontrado!",
            description: "Texto extraído com sucesso",
          });
        } else {
          setStatus("error");
          toast({
            variant: "destructive",
            title: "QR Code não encontrado",
            description: "Não foi possível encontrar um QR code na imagem",
          });
        }

        setIsProcessing(false);
      };

      img.onerror = () => {
        setStatus("error");
        setIsProcessing(false);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar a imagem",
        });
      };
    } catch (error) {
      setStatus("error");
      setIsProcessing(false);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao processar a imagem",
      });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "image/jpeg" || file.type === "image/png")) {
      processImage(file);
    } else {
      toast({
        variant: "destructive",
        title: "Formato inválido",
        description: "Por favor, selecione uma imagem JPG ou PNG",
      });
    }
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processImage(file);
        }
        break;
      }
    }
  }, [processImage]);

  // Add paste event listener
  useEffect(() => {
    document.addEventListener("paste", handlePaste as any);
    return () => {
      document.removeEventListener("paste", handlePaste as any);
    };
  }, [handlePaste]);

  const handleReset = () => {
    setQrText("");
    setStatus("idle");
    setPreviewUrl("");
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCopy = () => {
    if (qrText) {
      navigator.clipboard.writeText(qrText);
      toast({
        title: "Copiado!",
        description: "Texto copiado para a área de transferência",
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Leitor de QR Code</h1>
        <p className="text-muted-foreground">
          Extraia texto de imagens de QR code rapidamente
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload ou Cole a Imagem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-qr-file"
              />
              
              {previewUrl ? (
                <div className="space-y-4">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-w-full max-h-64 mx-auto rounded-lg"
                    data-testid="img-qr-preview"
                  />
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    disabled={isProcessing}
                    data-testid="button-new-qr"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Enviar um Novo QR
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-16 h-16 mx-auto text-muted-foreground" />
                  <div>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                      data-testid="button-upload-qr"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Selecionar Imagem
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ou pressione <kbd className="px-2 py-1 bg-muted rounded">Ctrl + V</kbd> para colar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: JPG, PNG
                  </p>
                </div>
              )}
            </div>

            {isProcessing && (
              <div className="flex items-center justify-center gap-2 text-primary">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                <span>Processando imagem...</span>
              </div>
            )}

            {status === "success" && (
              <div className="flex items-center gap-2 text-green-600" data-testid="status-success">
                <CheckCircle2 className="w-5 h-5" />
                <span>QR Code encontrado!</span>
              </div>
            )}

            {status === "error" && (
              <div className="flex items-center gap-2 text-red-600" data-testid="status-error">
                <XCircle className="w-5 h-5" />
                <span>QR Code não encontrado na imagem</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Texto Extraído</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={qrText}
              readOnly
              placeholder="O texto do QR code aparecerá aqui..."
              className="min-h-[200px] font-mono"
              data-testid="textarea-qr-result"
            />
            
            <Button
              onClick={handleCopy}
              disabled={!qrText}
              className="w-full"
              data-testid="button-copy-qr"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar Texto
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Como usar:</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>1. Clique em "Selecionar Imagem" para fazer upload de uma imagem JPG ou PNG</li>
            <li>2. Ou pressione Ctrl + V para colar uma imagem da área de transferência</li>
            <li>3. O sistema irá processar automaticamente e extrair o texto do QR code</li>
            <li>4. Use o botão "Copiar Texto" para copiar o resultado</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
