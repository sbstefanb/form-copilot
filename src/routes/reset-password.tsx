import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Factory, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova lozinka — Čeličana" },
      { name: "description", content: "Postavite novu lozinku za vaš nalog." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash automatically
    // and emits a PASSWORD_RECOVERY event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Also check existing session (in case event already fired)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Lozinka mora imati najmanje 6 karaktera");
      return;
    }
    if (password !== confirm) {
      toast.error("Lozinke se ne poklapaju");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Lozinka uspešno promenjena");
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Greška pri promeni lozinke");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-industrial px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Factory className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">ČELIČANA</h1>
          <p className="mt-1 text-sm text-industrial-foreground/70">Postavi novu lozinku</p>
        </div>

        <Card className="p-6">
          {!ready ? (
            <p className="text-sm text-muted-foreground">
              Otvorite link za reset lozinke iz email-a koji ste dobili. Ako ste već kliknuli na link,
              sačekajte trenutak da se sesija učita…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Nova lozinka</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Najmanje 6 karaktera"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Potvrdi lozinku</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sačuvaj novu lozinku
              </Button>
            </form>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-industrial-foreground/60">
          <Link to="/login" className="hover:text-industrial-foreground">← Nazad na prijavu</Link>
        </p>
      </div>
    </div>
  );
}
