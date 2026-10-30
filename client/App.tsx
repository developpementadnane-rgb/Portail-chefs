import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ContactWidget from "./components/ContactWidget";
import OfflineSyncProvider from "./components/OfflineSyncProvider";
import AiAssistantWidget from "./components/AiAssistantWidget";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import OfflineAccess from "./pages/OfflineAccess";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import PlaceholderPage from "./pages/PlaceholderPage";
import Members from "./pages/Members";
import MemberDetail from "./pages/MemberDetail";
import Reports from "./pages/Reports";
import ReportView from "./pages/ReportView";
import Sessions from "./pages/Sessions";
import Ideas from "./pages/Ideas";
import Account from "./pages/Account";
import About from "./pages/About";
import Contact from "./pages/Contact";
import DailyReports from "./pages/DailyReports";
import DailyReportDetail from "./pages/DailyReportDetail";
import AttendanceScan from "./pages/AttendanceScan";
import EmergencyAccess from "./pages/EmergencyAccess";
import MembershipList from "./pages/MembershipList";
import Gallery from "./pages/Gallery";
import MembershipManage from "./pages/MembershipManage";
import SyncCache from "./pages/SyncCache";
import PendingRegistrations from "./pages/PendingRegistrations";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ContactWidget />
      <OfflineSyncProvider />
      <AiAssistantWidget />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/offline-access" element={<OfflineAccess />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/account" element={<Account />} />
          <Route path="/members" element={<Members />} />
          <Route path="/members/:memberId" element={<MemberDetail />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/:reportId" element={<ReportView />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/attendance-scan" element={<AttendanceScan />} />
          <Route path="/emergency-access" element={<EmergencyAccess />} />
          <Route path="/sync-cache" element={<SyncCache />} />
          <Route path="/membership" element={<MembershipList />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/membership/manage" element={<MembershipManage />} />
          <Route path="/pending-registrations" element={<PendingRegistrations />} />
          <Route path="/ideas" element={<Ideas />} />
          <Route path="/daily-reports" element={<DailyReports />} />
          <Route path="/daily-reports/:reportId" element={<DailyReportDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
