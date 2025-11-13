import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, UserPlus, CheckSquare, FileText, BarChart3, BookOpen, ClipboardCheck, User, Brain, LogOut, Shield, Calendar, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureToggles } from "@/contexts/FeatureTogglesContext";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "Dashboard", icon: Home, feature: null },
  { to: "/register", label: "Register Student", icon: UserPlus, feature: null },
  { to: "/attendance", label: "Take Attendance", icon: CheckSquare, feature: "Attendance" },
  { to: "/attendance-summary", label: "Attendance Summary", icon: Calendar, feature: "Attendance Report" },
  { to: "/chapters", label: "Chapters Tracking", icon: BookOpen, feature: "Chapter Progress" },
  { to: "/tests", label: "Tests", icon: ClipboardCheck, feature: "Tests & Marks" },
  { to: "/student-report", label: "Student Report", icon: User, feature: "Student Report" },
  { to: "/fees", label: "Fee Management", icon: DollarSign, feature: "Finance" },
  { to: "/ai-insights", label: "AI Insights", icon: Brain, feature: null },
  { to: "/records", label: "View Records", icon: FileText, feature: null },
  { to: "/summary", label: "Summary", icon: BarChart3, feature: null },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { featureToggles } = useFeatureToggles();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80">
              <CheckSquare className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {user?.center_name || 'AttendTrack'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {user?.role === 'admin' ? 'Admin Panel' : 'Tuition Center'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{user?.username}</span>
              {user?.role === 'admin' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin-dashboard')}
                  className="ml-2"
                >
                  <Shield className="h-4 w-4 mr-1" />
                  Admin
                </Button>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/change-password')}>
              <Shield className="h-4 w-4 mr-2" />
              Change Password
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b bg-card">
        <div className="container">
          <div className="flex overflow-x-auto">
            {navItems
              .filter((item) => item.feature === null || featureToggles[item.feature])
              .map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors hover:text-primary",
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container py-6">{children}</main>
    </div>
  );
}
