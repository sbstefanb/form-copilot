import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Eye, Printer, Inbox, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { RequireAuth } from "@/components/require-auth";
import { AppHeader } from "@/components/app-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import type { ReportStatus } from "@/lib/report-types";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
});

type ReportRow = {
  id: string;
  evidencioni_broj: string;
  datum: string;
  pogon: string | null;
  vrsta_kvara: string | null;
  status: ReportStatus;
  created_at: string;
};

const FILTERS: { value: "all" | ReportStatus; label: string }[] = [
  { value: "all", label: "Svi" },
  { value: "u_izradi", label: "U izradi" },
  { value: "zavrsen", label: "Završeni" },
];

const ONBOARD_KEY = "celicana_onboard_seen";

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ReportStatus>("all");
  const [showOnboard, setShowOnboard] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReportRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.localStorage.getItem(ONBOARD_KEY)) {
      setShowOnboard(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("failure_reports")
        .select("id, evidencioni_broj, datum, pogon, vrsta_kvara, status, created_at")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) toast.error(error.message);
      else setReports((data ?? []) as ReportRow[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const visible = reports.filter((r) => filter === "all" || r.status === filter);

  const dismissOnboard = () => {
    window.localStorage.setItem(ONBOARD_KEY, "1");
    setShowOnboard(false);
  };

  const createNew = () => {
    if (!user) return;
    navigate({ to: "/izvestaj/$id", params: { id: "novi" } });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from("failure_reports")
      .delete()
      .eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReports((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    toast.success("Izveštaj obrisan.");
    setDeleteTarget(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* CTA */}
        <Card className="mb-8 flex flex-col items-start gap-4 border-primary/20 bg-gradient-to-br from-card to-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dobrodošli{user?.email ? `, ${user.email.split("@")[0]}` : ""}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Popunite novi izveštaj o kvaru (obrazac P-12-05) — AI asistent vam pomaže.
            </p>
          </div>
          <Button size="lg" onClick={createNew} className="shadow-md">
            <Plus className="mr-2 h-5 w-5" />
            Novi izveštaj o kvaru
          </Button>
        </Card>

        {/* List */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Moji izveštaji</h2>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  filter === f.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-medium">Još nema izveštaja.</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Klikni "Novi izveštaj o kvaru" da počneš.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Evidencioni broj</th>
                    <th className="px-4 py-3">Datum</th>
                    <th className="px-4 py-3">Pogon</th>
                    <th className="px-4 py-3">Vrsta kvara</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Akcije</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visible.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{r.evidencioni_broj}</td>
                      <td className="px-4 py-3">{r.datum}</td>
                      <td className="px-4 py-3">{r.pogon || "—"}</td>
                      <td className="px-4 py-3">{r.vrsta_kvara || "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button asChild variant="ghost" size="icon" title="Otvori">
                            <Link to="/izvestaj/$id" params={{ id: r.id }}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" size="icon" title="Štampaj">
                            <Link to="/izvestaj/$id/print" params={{ id: r.id }}>
                              <Printer className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Obriši"
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(r)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>

      {showOnboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-md p-6">
            <h3 className="text-lg font-bold">Dobrodošli u Prijava Kvara — Čeličana</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Ovde popunjavate izveštaje o kvarovima (obrazac P-12-05). Sa desne strane vam je AI asistent koji može:
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li>✨ Popuni formular iz vašeg slobodnog opisa</li>
              <li>💡 Predloži tekst za teža polja</li>
              <li>✓ Upozori na greške i nedoslednosti</li>
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              Krenite klikom na <strong>"Novi izveštaj o kvaru"</strong>.
            </p>
            <Button className="mt-5 w-full" onClick={dismissOnboard}>Razumem</Button>
          </Card>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisati izveštaj?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete izveštaj{" "}
              <strong className="font-mono">{deleteTarget?.evidencioni_broj}</strong>? Ova akcija je nepovratna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
