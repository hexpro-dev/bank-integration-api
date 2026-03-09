import { useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router";
import { Button } from "@heroui/react";
import { useAuth } from "~/lib/auth";

function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const links = [
    { to: "/", label: "Dashboard", icon: "📊" },
    { to: "/seats", label: "Bank Seats", icon: "🏦" },
    { to: "/sms-providers", label: "SMS Providers", icon: "📱" },
    { to: "/tokens", label: "API Tokens", icon: "🔑" },
    { to: "/webhooks", label: "Webhooks", icon: "🔗" },
    { to: "/docs", label: "API Docs", icon: "📖" },
  ];
  
  if (isAdmin) {
    links.push({ to: "/users", label: "Users", icon: "👤" });
  }
  
  return (
    <aside className="w-60 bg-default-50 border-r border-default-200 flex flex-col h-screen sticky top-0 shrink-0">
      <div className="p-4 border-b border-default-200">
        <h1 className="text-lg font-bold">Bank API</h1>
        <p className="text-sm text-default-500">{user?.email}</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-default-700 hover:bg-default-100"
              }`
            }
          >
            <span>{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-default-200">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onPress={() => { logout(); navigate("/login"); }}
        >
          Sign Out
        </Button>
      </div>
    </aside>
  );
}

export default function ProtectedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  if (!user) {
    return null;
  }
  
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
