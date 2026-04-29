import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { computeDuration, rowToForm, STATUS_LABELS, type ReportFormState } from "@/lib/report-types";
import { toast } from "sonner";

export const Route = createFileRoute("/izvestaj/$id/print")({
  component: () => (
    <RequireAuth>
      <PrintPage />
    </RequireAuth>
  ),
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="print-row grid grid-cols-[200px_1fr] border-b">
      <div className="bg-muted px-3 py-1.5 text-sm font-medium">{label}</div>
      <div className="px-3 py-1.5 text-sm whitespace-pre-wrap">{value || "—"}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="print-section mb-3 border">
      <div className="print-section-title border-b bg-muted px-3 py-1.5 text-sm font-bold">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function PrintPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<ReportFormState | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.from("failure_reports").select("*").eq("id", id).maybeSingle();
      if (!active) return;
      if (error || !data) {
        toast.error(error?.message ?? "Nije pronađeno");
        navigate({ to: "/" });
        return;
      }
      setForm(rowToForm(data));
    })();
    return () => { active = false; };
  }, [id, navigate]);

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6">
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/izvestaj/$id" params={{ id }}><ArrowLeft className="mr-1 h-4 w-4" />Nazad</Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-1 h-4 w-4" />Štampaj
        </Button>
      </div>

      <div className="mx-auto max-w-3xl bg-white p-8 text-black shadow-sm print:p-0 print:shadow-none">
        <div className="mb-4 flex items-start justify-between border-b pb-3">
          <div>
            <h1 className="text-xl font-bold">IZVEŠTAJ O KVARU</h1>
            <p className="text-xs text-muted-foreground">Obrazac P-12-05 — Čeličana</p>
          </div>
          <div className="text-right text-sm">
            <div><strong>Ev. broj:</strong> <span className="font-mono">{form.evidencioni_broj}</span></div>
            <div><strong>Datum:</strong> {form.datum}</div>
            <div><strong>Status:</strong> {STATUS_LABELS[form.status]}</div>
          </div>
        </div>

        <Section title="1. Osnovne informacije">
          <Row label="Vrsta kvara" value={form.vrsta_kvara === "Ostalo" ? `Ostalo: ${form.vrsta_kvara_ostalo}` : form.vrsta_kvara} />
          <Row label="Pogon" value={form.pogon} />
          <Row label="Tehnološka linija" value={form.tehnoloska_linija} />
          <Row label="Tehnički sistem / mašina" value={form.tehnicki_sistem} />
          <Row label="Sklop, podsklop, element" value={form.sklop_podsklop} />
        </Section>

        <Section title="2. Vremenski okvir">
          <Row label="Vreme prijave" value={form.vreme_prijave ? new Date(form.vreme_prijave).toLocaleString("sr-RS") : ""} />
          <Row label="Vreme otklanjanja" value={form.vreme_otklanjanja ? new Date(form.vreme_otklanjanja).toLocaleString("sr-RS") : ""} />
          <Row label="Trajanje zastoja" value={computeDuration(form.vreme_prijave, form.vreme_otklanjanja)} />
        </Section>

        <Section title="3. Opis i otklanjanje">
          <Row label="Uzrok kvara" value={form.uzrok} />
          <Row label="Posledice kvara" value={form.posledice} />
          <Row label="Način otklanjanja" value={form.nacin_otklanjanja} />
          <Row label="Ostale usluge" value={form.ostale_usluge} />
          <Row label="Napomena" value={form.napomena} />
        </Section>

        <Section title="4. Ugrađeni delovi i ljudi">
          <Row
            label="Ugrađeni delovi"
            value={
              form.ugradjeni_delovi.length === 0
                ? "—"
                : form.ugradjeni_delovi.map((d, i) => `${i + 1}. ${d.naziv} — ${d.kolicina}`).join("\n")
            }
          />
          <Row
            label="Imena angažovanih"
            value={form.imena_angazovanih.length === 0 ? "—" : form.imena_angazovanih.filter(Boolean).join(", ")}
          />
          <Row label="Broj izvršilaca" value={form.broj_izvrsilaca === "" ? "—" : String(form.broj_izvrsilaca)} />
        </Section>

        <Section title="5. Tehnička analiza (popunjava inženjer)">
          <Row label="Tehnička analiza" value={form.tehnicka_analiza} />
          <Row label="Analizu izvršio" value={form.analizu_izvrsio} />
          <Row label="Predlog korektivne mere" value={form.korektivna_mera} />
          <Row label="Korektivnu meru predložio" value={form.korektivnu_meru_predlozio} />
        </Section>

        <Section title="6. Potpis">
          <Row label="Ispunio" value={form.ispunio} />
        </Section>
      </div>
    </div>
  );
}
