import { Link } from "@tanstack/react-router";
import { LogOut, Factory } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { user, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-industrial text-industrial-foreground">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Factory className="h-5 w-5 text-primary" />
          <span className="text-primary tracking-tight">ČELIČANA</span>
          <span className="text-industrial-foreground/70 hidden sm:inline">/ Prijava Kvara</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          {user && <span className="hidden text-sm text-industrial-foreground/70 md:inline">{user.email}</span>}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="text-industrial-foreground hover:bg-industrial-foreground/10 hover:text-industrial-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Odjava
          </Button>
        </div>
      </div>
    </header>
  );
}
