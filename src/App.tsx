import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
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
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import InitAdmin from "./pages/InitAdmin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/init-admin" element={<InitAdmin />} />
            <Route path="/login" element={<Login />} />
            <Route path="/login-admin" element={<AdminLogin />} />
            <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/register" element={<ProtectedRoute><Layout><RegisterStudent /></Layout></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Layout><TakeAttendance /></Layout></ProtectedRoute>} />
            <Route path="/chapters" element={<ProtectedRoute><Layout><ChaptersTracking /></Layout></ProtectedRoute>} />
            <Route path="/tests" element={<ProtectedRoute><Layout><Tests /></Layout></ProtectedRoute>} />
            <Route path="/student-report" element={<ProtectedRoute><Layout><StudentReport /></Layout></ProtectedRoute>} />
            <Route path="/ai-insights" element={<ProtectedRoute><Layout><AIInsights /></Layout></ProtectedRoute>} />
            <Route path="/records" element={<ProtectedRoute><Layout><ViewRecords /></Layout></ProtectedRoute>} />
            <Route path="/summary" element={<ProtectedRoute><Layout><Summary /></Layout></ProtectedRoute>} />
            <Route path="/admin-dashboard" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
