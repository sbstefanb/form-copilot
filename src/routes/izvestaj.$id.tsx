import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Save, Sparkles, CheckCircle2, Loader2, Trash2, Plus, Printer, ArrowLeft, Wand2, Download,
} from "lucide-react";
import { exportReportToPdf } from "@/lib/pdf-export";
import { useServerFn } from "@tanstack/react-start";

import { RequireAuth } from "@/components/require-auth";
import { AppHeader } from "@/components/app-header";
import { AiAssistantPanel, type ValidationIssue } from "@/components/ai-assistant-panel";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { aiSuggestField, aiValidateForm } from "@/server/ai.functions";
import {
  computeDuration, emptyReport, formToRow, POGONI, rowToForm, STATUS_LABELS, VRSTE_KVARA,
  type ReportFormState,
} from "@/lib/report-types";
import { toast } from "sonner";

export const Route = createFileRoute("/izvestaj/$id")({
  component: () => (
    <RequireAuth>
      <ReportPage />
    </RequireAuth>
  ),
});

type FieldKey = keyof ReportFormState;

const REQUIRED_FIELDS: FieldKey[] = [
  "vrsta_kvara", "pogon", "tehnoloska_linija", "tehnicki_sistem", "sklop_podsklop",
  "vreme_prijave", "vreme_otklanjanja", "uzrok", "posledice", "nacin_otklanjanja", "ispunio",
];

const REQUIRED_LABELS: Record<string, string> = {
  vrsta_kvara: "Vrsta kvara",
  pogon: "Pogon",
  tehnoloska_linija: "Tehnološka linija",
  tehnicki_sistem: "Tehnički sistem",
  sklop_podsklop: "Sklop / podsklop",
  vreme_prijave: "Vreme prijave",
  vreme_otklanjanja: "Vreme otklanjanja",
  uzrok: "Uzrok kvara",
  posledice: "Posledice",
  nacin_otklanjanja: "Način otklanjanja",
  ispunio: "Ispunio",
};

const isEmpty = (v: unknown) =>
  v === "" || v === null || v === undefined || (Array.isArray(v) && v.length === 0);

function ReportPage() {
  const { id } = Route.useParams();
  const isDraft = id === "novi";
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<ReportFormState>(() => emptyReport());
  const [loading, setLoading] = useState(!isDraft);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);

  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [validating, setValidating] = useState(false);

  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const validate = useServerFn(aiValidateForm);

  // Load existing report (skip for new drafts)
  useEffect(() => {
    if (isDraft) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("failure_reports")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        toast.error(error.message);
        navigate({ to: "/" });
        return;
      }
      if (!data) {
        toast.error("Izveštaj nije pronađen.");
        navigate({ to: "/" });
        return;
      }
      setForm(rowToForm(data));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id, navigate, isDraft]);

  const setField = useCallback(<K extends FieldKey>(key: K, value: ReportFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setVerified((prev) => (prev[key as string] ? { ...prev, [key as string]: false } : prev));
    setAiFilled((prev) => {
      if (!prev.has(key as string)) return prev;
      const next = new Set(prev);
      next.delete(key as string);
      return next;
    });
  }, []);

  const toggleVerified = useCallback((key: string, val: boolean) => {
    setVerified((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleExtract = useCallback((extracted: Partial<ReportFormState>, filled: Set<string>) => {
    setForm((prev) => ({ ...prev, ...extracted }));
    setIsDirty(true);
    // AI-filled fields must be re-verified by user
    setVerified((prev) => {
      const next = { ...prev };
      filled.forEach((f) => { next[f] = false; });
      return next;
    });
    setAiFilled((prev) => {
      const next = new Set(prev);
      filled.forEach((f) => next.add(f));
      return next;
    });
  }, []);

  // Save (insert if draft, update otherwise)
  const doSave = useCallback(async (silent = false): Promise<string | null> => {
    if (!user) return null;
    setSaving(true);
    const payload = formToRow(formRef.current, user.id);
    if (isDraft) {
      const { data, error } = await supabase
        .from("failure_reports")
        .insert({ ...payload, evidencioni_broj: "" } as any)
        .select("id")
        .single();
      setSaving(false);
      if (error) {
        if (!silent) toast.error(error.message);
        return null;
      }
      setSavedAt(new Date());
      setIsDirty(false);
      if (!silent) toast.success("Sačuvano.");
      // Switch URL to real id
      navigate({ to: "/izvestaj/$id", params: { id: data.id }, replace: true });
      return data.id;
    }
    const { error } = await supabase.from("failure_reports").update(payload).eq("id", id);
    setSaving(false);
    if (error) {
      if (!silent) toast.error(error.message);
      return null;
    }
    setSavedAt(new Date());
    setIsDirty(false);
    if (!silent) toast.success("Sačuvano.");
    return id;
  }, [id, user, isDraft, navigate]);

  // Auto-save every 30s, only when dirty and not a draft
  useEffect(() => {
    if (loading || isDraft) return;
    const t = setInterval(() => {
      if (isDirty) void doSave(true);
    }, 30000);
    return () => clearInterval(t);
  }, [loading, doSave, isDirty, isDraft]);

  // Verification status
  const verifiedRequiredCount = REQUIRED_FIELDS.filter(
    (k) => !isEmpty(form[k]) && verified[k as string],
  ).length;
  const unverifiedRequired = REQUIRED_FIELDS
    .filter((k) => isEmpty(form[k]) || !verified[k as string])
    .map((k) => ({
      key: k as string,
      label: REQUIRED_LABELS[k as string] ?? (k as string),
      filled: !isEmpty(form[k]),
    }));
  const allRequiredVerified = unverifiedRequired.length === 0;

  const handleFinish = async () => {
    const hasErrors = issues.some((i) => i.severity === "error");
    if (hasErrors) {
      toast.error("Ispravite greške pre završavanja.");
      return;
    }
    if (!allRequiredVerified) {
      toast.error("Označite sva obavezna polja kao 'Provereno'.");
      return;
    }
    const savedId = await doSave(true);
    if (!savedId) return;
    const { error } = await supabase
      .from("failure_reports")
      .update({ status: "zavrsen" })
      .eq("id", savedId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm((prev) => ({ ...prev, status: "zavrsen" }));
    toast.success("Izveštaj završen i sačuvan.");
  };

  const handleDownloadPdf = async () => {
    if (!allRequiredVerified) {
      toast.warning("Neka obavezna polja nisu proverena — PDF se ipak generiše.");
    }
    try {
      await exportReportToPdf(form);
      toast.success("PDF preuzet.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Greška pri PDF-u");
    }
  };

  // Time validation (local)
  const timeError = useMemo(() => {
    if (!form.vreme_prijave || !form.vreme_otklanjanja) return null;
    return new Date(form.vreme_otklanjanja) < new Date(form.vreme_prijave)
      ? "Vreme otklanjanja mora biti posle vremena prijave."
      : null;
  }, [form.vreme_prijave, form.vreme_otklanjanja]);

  const suggestions = useMemo(() => {
    const out: { id: string; title: string; description: string }[] = [];
    const desc = `${form.uzrok} ${form.nacin_otklanjanja}`.toLowerCase();
    if (form.vrsta_kvara === "Mašinski" && /\b(kalem|kontaktor|plc|kabl|transformator)\b/.test(desc)) {
      out.push({
        id: "elektro",
        title: "Možda elektro kvar?",
        description: "U opisu se pominju elektro komponente. Razmotrite menjanje vrste kvara.",
      });
    }
    if (form.pogon === "Valjaonica" && !form.tehnicki_sistem) {
      out.push({
        id: "sistem",
        title: "Predlog za tehnički sistem",
        description: "Česti sistemi u Valjaonici: Linija valjanja, Hidraulični sistem, Pogon kaveza.",
      });
    }
    if (form.uzrok && !form.posledice) {
      out.push({
        id: "posledice",
        title: "Opišite posledice",
        description: "Zaustavljena proizvodnja, oštećenje druge opreme, troškovi…",
      });
    }
    return out.slice(0, 3);
  }, [form]);

  // AI validation, debounced
  useEffect(() => {
    if (loading) return;
    setValidating(true);
    const t = setTimeout(async () => {
      try {
        const res = await validate({ data: { form_state: formToRow(formRef.current, user?.id ?? "") } });
        const aiIssues = ((res as any).issues ?? []) as ValidationIssue[];
        const merged = [...aiIssues];
        if (timeError && !merged.find((m) => m.field === "vreme_otklanjanja" && m.severity === "error")) {
          merged.unshift({ severity: "error", message: timeError, field: "vreme_otklanjanja" });
        }
        setIssues(merged);
      } catch {
        setIssues(timeError ? [{ severity: "error", message: timeError, field: "vreme_otklanjanja" }] : []);
      } finally {
        setValidating(false);
      }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(form), timeError, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const hasErrors = issues.some((i) => i.severity === "error");
  const blockedActions = !allRequiredVerified || hasErrors;
  const aiClass = (k: string) => (aiFilled.has(k) ? "ai-filled" : "");

  // helper props bag for required fields
  const fProps = (key: FieldKey) => ({
    fieldKey: key as string,
    verified: !!verified[key as string],
    onVerifyToggle: toggleVerified,
    required: REQUIRED_FIELDS.includes(key),
  });

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <AppHeader />

      {/* Sticky page header */}
      <div className="sticky top-14 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" />Nazad</Link>
          </Button>
          <div className="flex flex-col">
            <h1 className="text-base font-bold tracking-tight sm:text-lg">Izveštaj o kvaru</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">
                {isDraft ? "— (biće dodeljen nakon snimanja)" : form.evidencioni_broj}
              </span>
              <StatusBadge status={form.status} />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {savedAt && (
              <span className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Sačuvano u {savedAt.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {!isDraft && (
              <Button asChild variant="outline" size="sm" disabled={blockedActions}>
                <Link to="/izvestaj/$id/print" params={{ id }}><Printer className="mr-1 h-4 w-4" />Štampaj</Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={blockedActions}
              title={blockedActions ? "Označite sva obavezna polja kao 'Provereno'" : ""}
            >
              <Download className="mr-1 h-4 w-4" />Preuzmi PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => doSave()} disabled={saving} className="hidden sm:inline-flex">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Sačuvaj nacrt
            </Button>
            <Button
              size="sm"
              onClick={handleFinish}
              disabled={blockedActions || saving}
              className="hidden sm:inline-flex"
              title={blockedActions ? "Označite sva obavezna polja kao 'Provereno'" : ""}
            >
              Završi i sačuvaj
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[3fr_2fr]">
        {/* Form */}
        <div>
          <Accordion type="multiple" defaultValue={["s1", "s2", "s3", "s4", "s5", "s6"]} className="space-y-3">
            {/* Section 1 */}
            <AccordionItem value="s1" className="rounded-lg border bg-card">
              <AccordionTrigger className="px-4 text-left">1. Osnovne informacije</AccordionTrigger>
              <AccordionContent className="space-y-4 px-4 pb-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Datum izveštaja">
                    <Input type="date" value={form.datum} onChange={(e) => setField("datum", e.target.value)} />
                  </Field>
                  <Field label="Ispunio" {...fProps("ispunio")}>
                    <Input value={form.ispunio} onChange={(e) => setField("ispunio", e.target.value)} placeholder="Ime i prezime" className={aiClass("ispunio")} />
                  </Field>
                </div>

                <Field label="Vrsta kvara" {...fProps("vrsta_kvara")}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {VRSTE_KVARA.map((v) => (
                      <button
                        type="button"
                        key={v.value}
                        onClick={() => setField("vrsta_kvara", v.value)}
                        className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-sm transition ${
                          form.vrsta_kvara === v.value
                            ? "border-primary bg-primary/5 font-semibold"
                            : "border-border hover:border-primary/40"
                        } ${aiFilled.has("vrsta_kvara") && form.vrsta_kvara === v.value ? "ai-filled" : ""}`}
                      >
                        <span className="text-2xl">{v.emoji}</span>
                        <span>{v.label}</span>
                      </button>
                    ))}
                  </div>
                  {form.vrsta_kvara === "Ostalo" && (
                    <Input
                      className="mt-2"
                      value={form.vrsta_kvara_ostalo}
                      onChange={(e) => setField("vrsta_kvara_ostalo", e.target.value)}
                      placeholder="Opišite vrstu kvara"
                    />
                  )}
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Pogon" {...fProps("pogon")}>
                    <Input
                      list="pogoni"
                      value={form.pogon}
                      onChange={(e) => setField("pogon", e.target.value)}
                      placeholder="npr. Topionica"
                      className={aiClass("pogon")}
                    />
                    <datalist id="pogoni">
                      {POGONI.map((p) => <option key={p} value={p} />)}
                    </datalist>
                  </Field>
                  <Field label="Tehnološka linija" {...fProps("tehnoloska_linija")}>
                    <Input value={form.tehnoloska_linija} onChange={(e) => setField("tehnoloska_linija", e.target.value)} className={aiClass("tehnoloska_linija")} />
                  </Field>
                </div>
                <Field label="Tehnički sistem / mašina" hint="npr. Hidraulični sistem peći" {...fProps("tehnicki_sistem")}>
                  <Input value={form.tehnicki_sistem} onChange={(e) => setField("tehnicki_sistem", e.target.value)} className={aiClass("tehnicki_sistem")} />
                </Field>
                <Field label="Sklop, podsklop, element mašine" hint="npr. Pumpa za hidrauliku → elektromotor" {...fProps("sklop_podsklop")}>
                  <Input value={form.sklop_podsklop} onChange={(e) => setField("sklop_podsklop", e.target.value)} className={aiClass("sklop_podsklop")} />
                </Field>
              </AccordionContent>
            </AccordionItem>

            {/* Section 2 */}
            <AccordionItem value="s2" className="rounded-lg border bg-card">
              <AccordionTrigger className="px-4">2. Vremenski okvir</AccordionTrigger>
              <AccordionContent className="space-y-4 px-4 pb-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Vreme prijave kvara" {...fProps("vreme_prijave")}>
                    <Input type="datetime-local" value={form.vreme_prijave} onChange={(e) => setField("vreme_prijave", e.target.value)} className={aiClass("vreme_prijave")} />
                  </Field>
                  <Field label="Vreme otklanjanja kvara" {...fProps("vreme_otklanjanja")}>
                    <Input type="datetime-local" value={form.vreme_otklanjanja} onChange={(e) => setField("vreme_otklanjanja", e.target.value)} className={aiClass("vreme_otklanjanja")} />
                  </Field>
                </div>
                {timeError && (
                  <p className="text-sm font-medium text-destructive">⚠ {timeError}</p>
                )}
                <Field label="Ukupno trajanje zastoja">
                  <div className="rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                    {computeDuration(form.vreme_prijave, form.vreme_otklanjanja)}
                  </div>
                </Field>
              </AccordionContent>
            </AccordionItem>

            {/* Section 3 */}
            <AccordionItem value="s3" className="rounded-lg border bg-card">
              <AccordionTrigger className="px-4">3. Opis i otklanjanje</AccordionTrigger>
              <AccordionContent className="space-y-4 px-4 pb-4">
                <FieldWithAI label="Uzrok kvara" form={form} setField={setField} fieldKey="uzrok" rows={3} aiClass={aiClass("uzrok")} {...fProps("uzrok")} />
                <Field label="Posledice kvara" {...fProps("posledice")}>
                  <Textarea rows={2} value={form.posledice} onChange={(e) => setField("posledice", e.target.value)} className={aiClass("posledice")} />
                </Field>
                <FieldWithAI label="Način otklanjanja, kratki opis poslova" form={form} setField={setField} fieldKey="nacin_otklanjanja" rows={3} aiClass={aiClass("nacin_otklanjanja")} {...fProps("nacin_otklanjanja")} />
                <Field label="Ostale usluge (opciono)">
                  <Textarea rows={2} value={form.ostale_usluge} onChange={(e) => setField("ostale_usluge", e.target.value)} />
                </Field>
                <Field label="Napomena i zapažanje (opciono)">
                  <Textarea rows={2} value={form.napomena} onChange={(e) => setField("napomena", e.target.value)} />
                </Field>
              </AccordionContent>
            </AccordionItem>

            {/* Section 4 */}
            <AccordionItem value="s4" className="rounded-lg border bg-card">
              <AccordionTrigger className="px-4">4. Ugrađeni delovi i ljudi</AccordionTrigger>
              <AccordionContent className="space-y-4 px-4 pb-4">
                <Field label="Ugrađeni delovi i materijal">
                  <div className="space-y-2">
                    {form.ugradjeni_delovi.map((d, i) => {
                      const rowKey = `ugradjeni_delovi.${i}`;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            value={d.naziv}
                            onChange={(e) => {
                              const next = [...form.ugradjeni_delovi];
                              next[i] = { ...next[i], naziv: e.target.value };
                              setField("ugradjeni_delovi", next);
                              setVerified((p) => ({ ...p, [rowKey]: false }));
                            }}
                            placeholder="Naziv dela"
                          />
                          <Input
                            type="number"
                            min={0}
                            value={d.kolicina}
                            onChange={(e) => {
                              const next = [...form.ugradjeni_delovi];
                              next[i] = { ...next[i], kolicina: Number(e.target.value) || 0 };
                              setField("ugradjeni_delovi", next);
                              setVerified((p) => ({ ...p, [rowKey]: false }));
                            }}
                            placeholder="Količina"
                            className="w-28"
                          />
                          <VerifyBox checked={!!verified[rowKey]} onChange={(v) => toggleVerified(rowKey, v)} />
                          <Button type="button" variant="ghost" size="icon" onClick={() => setField("ugradjeni_delovi", form.ugradjeni_delovi.filter((_, j) => j !== i))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                    <Button type="button" variant="outline" size="sm" onClick={() => setField("ugradjeni_delovi", [...form.ugradjeni_delovi, { naziv: "", kolicina: 1 }])}>
                      <Plus className="mr-1 h-4 w-4" />Dodaj deo
                    </Button>
                  </div>
                </Field>

                <Field label="Imena angažovanih na popravci">
                  <div className="space-y-2">
                    {form.imena_angazovanih.map((n, i) => {
                      const rowKey = `imena_angazovanih.${i}`;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            value={n}
                            onChange={(e) => {
                              const next = [...form.imena_angazovanih];
                              next[i] = e.target.value;
                              setField("imena_angazovanih", next);
                              setVerified((p) => ({ ...p, [rowKey]: false }));
                            }}
                            placeholder="Ime i prezime"
                          />
                          <VerifyBox checked={!!verified[rowKey]} onChange={(v) => toggleVerified(rowKey, v)} />
                          <Button type="button" variant="ghost" size="icon" onClick={() => setField("imena_angazovanih", form.imena_angazovanih.filter((_, j) => j !== i))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                    <Button type="button" variant="outline" size="sm" onClick={() => setField("imena_angazovanih", [...form.imena_angazovanih, ""])}>
                      <Plus className="mr-1 h-4 w-4" />Dodaj radnika
                    </Button>
                  </div>
                </Field>

                <Field label="Ukupan broj izvršilaca">
                  <Input
                    type="number"
                    min={0}
                    value={form.broj_izvrsilaca}
                    onChange={(e) => setField("broj_izvrsilaca", e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={String(form.imena_angazovanih.filter(Boolean).length || 0)}
                    className="w-32"
                  />
                </Field>
              </AccordionContent>
            </AccordionItem>

            {/* Section 5 - engineer */}
            <AccordionItem value="s5" className="rounded-lg border-2 border-engineer-border bg-engineer">
              <AccordionTrigger className="px-4 text-engineer-foreground">
                5. Tehnička analiza <span className="ml-2 rounded-full bg-engineer-border px-2 py-0.5 text-xs font-normal">Popunjava inženjer</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 px-4 pb-4">
                <FieldWithAI label="Tehnička analiza kvara" form={form} setField={setField} fieldKey="tehnicka_analiza" rows={5} aiClass={aiClass("tehnicka_analiza")} fieldVerifyKey="tehnicka_analiza" verified={!!verified["tehnicka_analiza"]} onVerifyToggle={toggleVerified} />
                <Field label="Analizu izvršio" fieldKey="analizu_izvrsio" verified={!!verified["analizu_izvrsio"]} onVerifyToggle={toggleVerified}>
                  <Input value={form.analizu_izvrsio} onChange={(e) => setField("analizu_izvrsio", e.target.value)} />
                </Field>
                <FieldWithAI label="Predlog korektivne mere" form={form} setField={setField} fieldKey="korektivna_mera" rows={4} aiClass={aiClass("korektivna_mera")} fieldVerifyKey="korektivna_mera" verified={!!verified["korektivna_mera"]} onVerifyToggle={toggleVerified} />
                <Field label="Korektivnu meru predložio" fieldKey="korektivnu_meru_predlozio" verified={!!verified["korektivnu_meru_predlozio"]} onVerifyToggle={toggleVerified}>
                  <Input value={form.korektivnu_meru_predlozio} onChange={(e) => setField("korektivnu_meru_predlozio", e.target.value)} />
                </Field>
              </AccordionContent>
            </AccordionItem>

            {/* Section 6 */}
            <AccordionItem value="s6" className="rounded-lg border bg-card">
              <AccordionTrigger className="px-4">6. Potpis</AccordionTrigger>
              <AccordionContent className="space-y-4 px-4 pb-4">
                <p className="text-xs text-muted-foreground">
                  Ime potpisnika unosi se u polju <strong>"Ispunio"</strong> u sekciji 1.
                </p>
                <p className="text-xs text-muted-foreground">
                  Trenutni status: <strong>{STATUS_LABELS[form.status]}</strong>
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Desktop AI panel */}
        <aside className="hidden md:block">
          <div className="sticky top-32">
            <AiAssistantPanel
              form={form}
              onExtract={handleExtract}
              suggestions={suggestions}
              issues={issues}
              validating={validating}
              verifiedCount={verifiedRequiredCount}
              requiredCount={REQUIRED_FIELDS.length}
              unverifiedRequired={unverifiedRequired}
            />
          </div>
        </aside>
      </main>

      {/* Mobile sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t bg-card/95 p-3 backdrop-blur md:hidden">
        <Button variant="outline" size="sm" onClick={() => doSave()} disabled={saving} className="flex-1">
          <Save className="mr-1 h-4 w-4" />Nacrt
        </Button>
        <Button size="sm" onClick={handleFinish} disabled={blockedActions || saving} className="flex-1">
          Završi
        </Button>
        <Sheet>
          <SheetTrigger asChild>
            <Button size="sm" variant="default" className="bg-primary">
              <Sparkles className="mr-1 h-4 w-4" />AI
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[92vw] max-w-md overflow-y-auto p-4 sm:w-[440px]">
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI Asistent</SheetTitle>
            </SheetHeader>
            <AiAssistantPanel
              form={form}
              onExtract={handleExtract}
              suggestions={suggestions}
              issues={issues}
              validating={validating}
              verifiedCount={verifiedRequiredCount}
              requiredCount={REQUIRED_FIELDS.length}
              unverifiedRequired={unverifiedRequired}
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function VerifyBox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-muted-foreground select-none">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="h-3.5 w-3.5"
      />
      <span>Provereno</span>
    </label>
  );
}

function Field({
  label, hint, children, required, fieldKey, verified, onVerifyToggle,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
  fieldKey?: string;
  verified?: boolean;
  onVerifyToggle?: (key: string, v: boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {fieldKey && onVerifyToggle && (
          <VerifyBox checked={!!verified} onChange={(v) => onVerifyToggle(fieldKey, v)} />
        )}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FieldWithAI({
  label, form, setField, fieldKey, rows, aiClass,
  required, fieldVerifyKey, verified, onVerifyToggle,
}: {
  label: string;
  form: ReportFormState;
  setField: <K extends FieldKey>(k: K, v: ReportFormState[K]) => void;
  fieldKey: "uzrok" | "nacin_otklanjanja" | "tehnicka_analiza" | "korektivna_mera";
  rows: number;
  aiClass: string;
  required?: boolean;
  fieldVerifyKey?: string;
  verified?: boolean;
  onVerifyToggle?: (key: string, v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<string>("");
  const suggest = useServerFn(aiSuggestField);
  const { user } = useAuth();
  const verifyKey = fieldVerifyKey ?? fieldKey;

  const run = async () => {
    setOpen(true);
    setBusy(true);
    setSuggestion("");
    try {
      const res = await suggest({
        data: {
          form_state: formToRow(form, user?.id ?? ""),
          target_field: fieldKey,
        },
      });
      setSuggestion(((res as any).suggestion ?? "").trim());
    } catch (e) {
      setSuggestion("Greška: " + (e instanceof Error ? e.message : "AI nije dostupan"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        <div className="flex items-center gap-2">
          {onVerifyToggle && (
            <VerifyBox checked={!!verified} onChange={(v) => onVerifyToggle(verifyKey, v)} />
          )}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="sm" onClick={run} className="h-7 text-xs text-primary hover:text-primary">
                <Wand2 className="mr-1 h-3 w-3" />Pomozi mi
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              {busy ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />Razmišljam…
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="whitespace-pre-wrap text-sm">{suggestion || "—"}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setField(fieldKey as FieldKey, suggestion as any);
                        setOpen(false);
                      }}
                      disabled={!suggestion}
                      className="flex-1"
                    >Prihvati</Button>
                    <Button size="sm" variant="outline" onClick={() => setOpen(false)} className="flex-1">Odbaci</Button>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <Textarea
        rows={rows}
        value={form[fieldKey] as string}
        onChange={(e) => setField(fieldKey as FieldKey, e.target.value as any)}
        className={aiClass}
      />
    </div>
  );
}
