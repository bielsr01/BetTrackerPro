import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TrendingUp, Filter, Shield, BarChart3 } from "lucide-react";
import { Redirect } from "wouter";

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  if (user) {
    return <Redirect to="/" />;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  const features = [
    {
      icon: TrendingUp,
      title: "Gestão Eficiente",
      description: "Organize todos os seus surebets em um único lugar com visão clara de lucros",
    },
    {
      icon: Filter,
      title: "Filtros Personalizados",
      description: "Filtre por status, casa de aposta, titular e período para análises precisas",
    },
    {
      icon: Shield,
      title: "Controle Total",
      description: "Acompanhe cada aposta desde a entrada até a resolução com status detalhado",
    },
    {
      icon: BarChart3,
      title: "Análise de Resultados",
      description: "Visualize métricas e resultados reais para otimizar suas estratégias",
    },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left side - Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-12 flex-col justify-center">
        <div className="max-w-xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-primary rounded-lg">
              <TrendingUp className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold">BetTracker Pro</h1>
          </div>
          <p className="text-xl text-muted-foreground mb-12">
            Gerencie e acompanhe suas apostas de arbitragem com velocidade e segurança que sua operação precisa.
          </p>
          <div className="space-y-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="flex gap-4 items-start">
                  <Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="p-2 bg-primary rounded-lg">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">BetTracker Pro</h1>
          </div>
          
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">Faça o Login</h2>
            <p className="text-muted-foreground">
              Acesse sua conta para gerenciar apostas e acompanhar resultados
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-email"
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-password"
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  data-testid="checkbox-remember"
                />
                <Label htmlFor="remember" className="text-sm cursor-pointer">
                  Lembrar de mim
                </Label>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? "Entrando..." : "Entrar na Plataforma"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
