import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ScanText, LogIn, Loader2 } from "lucide-react";
import Home from "@/pages/home";
import Administrative from "@/pages/administrative";
import NotFound from "@/pages/not-found";

function LoginScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 bg-background">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-primary text-primary-foreground">
          <ScanText className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Document Scanner</h1>
          <p className="text-sm text-muted-foreground">OCR Text Extraction</p>
        </div>
      </div>
      <p className="text-muted-foreground text-center max-w-sm">
        Sign in with your Google account to use the app.
      </p>
      <Button size="lg" asChild data-testid="button-login">
        <a href="/api/auth/google">
          <LogIn className="h-5 w-5 mr-2" />
          Sign in with Google
        </a>
      </Button>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/administrative" component={Administrative} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="ocr-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
