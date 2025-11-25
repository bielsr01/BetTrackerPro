import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";

// Pages
import Dashboard from "@/pages/dashboard";
import UploadPage from "@/pages/upload";
import OCRTestPage from "@/pages/ocr-test";
import QRReaderPage from "@/pages/qr-reader";
import BatchUploadPage from "@/pages/batch-upload";
import BetBurgerPage from "@/pages/bet-burger";
import AccountHoldersPage from "@/pages/account-holders";
import ManagementPage from "@/pages/management";
import AuthPage from "@/pages/auth-page";
import UsersPage from "@/pages/users-page";
import ProfilePage from "@/pages/profile-page";
import NotFound from "@/pages/not-found";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={() => <AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
      <ProtectedRoute path="/upload" component={() => <AuthenticatedLayout><UploadPage /></AuthenticatedLayout>} />
      <ProtectedRoute path="/test-ocr" component={() => <AuthenticatedLayout><OCRTestPage /></AuthenticatedLayout>} />
      <ProtectedRoute path="/qr-reader" component={() => <AuthenticatedLayout><QRReaderPage /></AuthenticatedLayout>} />
      <ProtectedRoute path="/batch-upload" component={() => <AuthenticatedLayout><BatchUploadPage /></AuthenticatedLayout>} />
      <ProtectedRoute path="/bet-burger" component={() => <AuthenticatedLayout><BetBurgerPage /></AuthenticatedLayout>} />
      <ProtectedRoute path="/account-holders" component={() => <AuthenticatedLayout><AccountHoldersPage /></AuthenticatedLayout>} />
      <ProtectedRoute path="/gerenciamento" component={() => <AuthenticatedLayout><ManagementPage /></AuthenticatedLayout>} />
      <ProtectedRoute path="/dashboard" component={() => <AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
      <ProtectedRoute path="/users" component={() => <AuthenticatedLayout><UsersPage /></AuthenticatedLayout>} />
      <ProtectedRoute path="/profile" component={() => <AuthenticatedLayout><ProfilePage /></AuthenticatedLayout>} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="light" storageKey="surebet-theme">
          <AuthProvider>
            <Router />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}