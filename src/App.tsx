import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import React from "react";

const queryClient = new QueryClient();
const DatabaseDocumentsLazy = React.lazy(() => import('./pages/DatabaseDocuments'));

const RecoveryRedirector = () => {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const hash = location.hash || window.location.hash || '';
    const search = location.search || '';
    const hasCode = new URLSearchParams(search).get('code');
    const isRecovery = (hash.includes('type=recovery') || Boolean(hasCode));
    if (isRecovery && location.pathname !== '/reset') {
      navigate(`/reset${search}${hash}`, { replace: true });
    }
  }, [location, navigate]);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RecoveryRedirector />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="/databases/:id/documents" element={<DatabaseDocumentsLazy />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
