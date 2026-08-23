import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useEffect } from "react";
import Home from "@/pages/home";
import Administrative from "@/pages/administrative";
import NotFound from "@/pages/not-found";

function Router() {
  useEffect(() => {
    fetch("/api/visits", { method: "POST" }).catch(() => {
      // Visitor analytics must never prevent anyone from using the app.
    });
  }, []);

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
