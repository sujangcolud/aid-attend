import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import RegisterStudent from "./pages/RegisterStudent";
import TakeAttendance from "./pages/TakeAttendance";
import ChaptersTracking from "./pages/ChaptersTracking";
import Tests from "./pages/Tests";
import StudentReport from "./pages/StudentReport";
import AIInsights from "./pages/AIInsights";
import ViewRecords from "./pages/ViewRecords";
import Summary from "./pages/Summary";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/register" element={<Layout><RegisterStudent /></Layout>} />
          <Route path="/attendance" element={<Layout><TakeAttendance /></Layout>} />
          <Route path="/chapters" element={<Layout><ChaptersTracking /></Layout>} />
          <Route path="/tests" element={<Layout><Tests /></Layout>} />
          <Route path="/student-report" element={<Layout><StudentReport /></Layout>} />
          <Route path="/ai-insights" element={<Layout><AIInsights /></Layout>} />
          <Route path="/records" element={<Layout><ViewRecords /></Layout>} />
          <Route path="/summary" element={<Layout><Summary /></Layout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
