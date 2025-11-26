import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Database, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface MigrationResult {
  success: boolean;
  tables: {
    name: string;
    count: number;
    status: 'success' | 'error';
    error?: string;
  }[];
  totalRecords: number;
  error?: string;
}

export default function AdminMigration() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  const testConnection = async () => {
    if (!supabaseUrl.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira a URL do Supabase",
        variant: "destructive"
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus('idle');

    try {
      const response = await fetch("/api/admin/migration/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ supabaseUrl })
      });

      const result = await response.json();

      if (result.success) {
        setConnectionStatus('success');
        toast({
          title: "Conexao OK",
          description: "Conexao com o Supabase estabelecida com sucesso!"
        });
      } else {
        setConnectionStatus('error');
        toast({
          title: "Erro de Conexao",
          description: result.error || "Nao foi possivel conectar ao Supabase",
          variant: "destructive"
        });
      }
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: "Erro",
        description: "Erro ao testar conexao",
        variant: "destructive"
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const executeMigration = async () => {
    if (!supabaseUrl.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira a URL do Supabase",
        variant: "destructive"
      });
      return;
    }

    if (connectionStatus !== 'success') {
      toast({
        title: "Erro",
        description: "Teste a conexao primeiro antes de migrar",
        variant: "destructive"
      });
      return;
    }

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const response = await fetch("/api/admin/migration/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ supabaseUrl })
      });

      const result: MigrationResult = await response.json();
      setMigrationResult(result);

      if (result.success) {
        toast({
          title: "Migracao Concluida",
          description: `${result.totalRecords} registros migrados com sucesso!`
        });
      } else {
        toast({
          title: "Migracao Falhou",
          description: result.error || "Alguns erros ocorreram durante a migracao",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao executar migracao",
        variant: "destructive"
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Migracao de Banco de Dados
            </CardTitle>
            <CardDescription>
              Migre todos os dados do Neon (atual) para o Supabase
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atencao</AlertTitle>
              <AlertDescription>
                Esta operacao ira copiar TODOS os dados do banco atual para o Supabase.
                As tabelas existentes no Supabase serao recriadas (dados anteriores serao perdidos).
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="supabase-url">URL de Conexao do Supabase</Label>
              <Input
                id="supabase-url"
                type="text"
                placeholder="postgresql://postgres:SENHA@db.xxxxx.supabase.co:5432/postgres"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-supabase-url"
              />
              <p className="text-sm text-muted-foreground">
                Encontre em: Supabase Dashboard → Settings → Database → Connection string → URI
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={testConnection}
                disabled={isTestingConnection || isMigrating}
                variant="outline"
                data-testid="button-test-connection"
              >
                {isTestingConnection ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : connectionStatus === 'success' ? (
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                ) : connectionStatus === 'error' ? (
                  <XCircle className="h-4 w-4 mr-2 text-red-500" />
                ) : null}
                Testar Conexao
              </Button>

              <Button
                onClick={executeMigration}
                disabled={isMigrating || connectionStatus !== 'success'}
                data-testid="button-execute-migration"
              >
                {isMigrating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                {isMigrating ? "Migrando..." : "Executar Migracao"}
              </Button>
            </div>

            {migrationResult && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold flex items-center gap-2">
                  {migrationResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  Resultado da Migracao
                </h3>

                <div className="space-y-2">
                  {migrationResult.tables.map((table) => (
                    <div 
                      key={table.name}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        {table.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-mono text-sm">{table.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {table.count} registros
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-semibold">
                    Total: {migrationResult.totalRecords} registros migrados
                  </p>
                </div>

                {migrationResult.success && (
                  <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle>Proximo Passo</AlertTitle>
                    <AlertDescription>
                      Migracao concluida! Para usar o Supabase como banco principal,
                      atualize a variavel DATABASE_URL nas configuracoes do Replit
                      com a URL do Supabase.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
