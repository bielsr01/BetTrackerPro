import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PdfUploadProps {
  onImageUpload: (file: File) => void;
  onImageRemove?: () => void;
  isProcessing?: boolean;
  uploadedImage?: string | null;
  className?: string;
  onOCRComplete?: (data: any) => void;
  onOCRError?: (error: string) => void;
}

export function ImageUpload({
  onImageUpload,
  onImageRemove,
  isProcessing = false,
  uploadedImage = null,
  className,
  onOCRComplete,
  onOCRError,
}: PdfUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === "application/pdf") {
      onImageUpload(file);
      
      // Also trigger PDF processing if handlers are provided
      if (onOCRComplete && onOCRError) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          
          const response = await fetch('/api/ocr/process', {
            method: 'POST',
            body: formData,
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            onOCRComplete(result.data);
          } else {
            onOCRError(result.error || 'Erro ao processar PDF');
          }
        } catch (error) {
          console.error('PDF processing error:', error);
          onOCRError('Erro ao processar PDF com pdfplumber');
        }
      }
    }
  }, [onImageUpload, onOCRComplete, onOCRError]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
  });


  if (uploadedImage) {
    return (
      <Card className={cn("relative", className)}>
        <CardContent className="p-4">
          <div className="relative">
            {/* PDF Preview */}
            <div className="w-full min-h-[200px] flex flex-col items-center justify-center border rounded-lg bg-muted/50">
              <div className="flex flex-col items-center gap-3 p-6">
                <div className="p-3 rounded-full bg-primary/10">
                  <FileText className="h-12 w-12 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="font-medium">PDF Carregado</h3>
                  <p className="text-sm text-muted-foreground">Documento pronto para processamento</p>
                </div>
              </div>
            </div>
            
            {onImageRemove && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={onImageRemove}
                data-testid="button-remove-pdf"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            
            {isProcessing && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm text-muted-foreground">Processando PDF com pdfplumber...</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed cursor-pointer transition-colors hover-elevate",
        isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
        isProcessing && "pointer-events-none opacity-50",
        className
      )}
      tabIndex={0}
      data-testid="dropzone-upload"
    >
      <CardContent className="flex flex-col items-center justify-center p-8 text-center">
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-muted">
            {isProcessing ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              {isProcessing ? "Processando..." : "Faça upload do PDF"}
            </h3>
            
            <div className="text-muted-foreground space-y-1">
              <p>Arraste e solte um PDF aqui</p>
              <p className="text-sm">ou <span className="text-primary font-medium">clique para selecionar</span></p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Apenas arquivos PDF</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}