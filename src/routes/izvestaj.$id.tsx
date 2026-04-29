import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Save, Sparkles, CheckCircle2, Loader2, Trash2, Plus, Printer, ArrowLeft, Wand2,
} from "lucide-react";
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

function ReportPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<ReportFormState>(() => emptyReport());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());

  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [validating, setValidating] = useState(false);

  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const validate = useServerFn(aiValidateForm);

  // Load
  useEffect(() => {
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
  }, [id, navigate]);

  const setField = useCallback(<K extends FieldKey>(key: K, value: ReportFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setAiFilled((prev) => {
      if (!prev.has(key as string)) return prev;
      const next = new Set(prev);
      next.delete(key as string);
      return next;
    });
  }, []);

  const handleExtract = useCallback((extracted: Partial<ReportFormState>, filled: Set<string>) => {
    setForm((prev) => ({ ...prev, ...extracted }));
    setAiFilled((prev) => {
      const next = new Set(prev);
      filled.forEach((f) => next.add(f));
      return next;
    });
  }, []);

  // Save
  const doSave = useCallback(async (silent = false) => {
    if (!user) return;
    setSaving(true);
    const payload = formToRow(formRef.current, user.id);
    const { error } = await supabase.from("failure_reports").update(payload).eq("id", id);
    setSaving(false);
    if (error) {
      if (!silent) toast.error(error.message);
      return false;
    }
    setSavedAt(new Date());
    if (!silent) toast.success("Sačuvano.");
    return true;
  }, [id, user]);

  // Auto-save every 30s if dirty (simple: always save)
  useEffect(() => {
    if (loading) return;
    const t = setInterval(() => { void doSave(true); }, 30000);
    return () => clearInterval(t);
  }, [loading, doSave]);

  const handleFinish = async () => {
    const hasErrors = issues.some((i) => i.severity === "error");
    if (hasErrors) {
      toast.error("Ispravite greške pre završavanja.");
      return;
    }
    const ok = await doSave(true);
    if (!ok) return;
    const { error } = await supabase
      .from("failure_reports")
      .update({ status: "zavrsen" })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm((prev) => ({ ...prev, status: "zavrsen" }));
    toast.success("Izveštaj završen i sačuvan.");
  };

  // Time validation (local)
  const timeError = useMemo(() => {
    if (!form.vreme_prijave || !form.vreme_otklanjanja) return null;
    return new Date(form.vreme_otklanjanja) < new Date(form.vreme_prijave)
      ? "Vreme otklanjanja mora biti posle vremena prijave."
      : null;
  }, [form.vreme_prijave, form.vreme_otklanjanja]);

  // Local suggestions (instant, no AI)
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
        // Merge with local time-error so it always shows
        const merged = [...aiIssues];
        if (timeError && !merged.find((m) => m.field === "vreme_otklanjanja" && m.severity === "error")) {
          merged.unshift({ severity: "error", message: timeError, field: "vreme_otklanjanja" });
        }
        setIssues(merged);
      } catch {
        // keep local time error at minimum
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
  const aiClass = (k: string) => (aiFilled.has(k) ? "ai-filled" : "");

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
              <span className="font-mono">{form.evidencioni_broj}</span>
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
            <Button asChild variant="outline" size="sm">
              <Link to="/izvestaj/$id/print" params={{ id }}><Printer className="mr-1 h-4 w-4" />Štampaj</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => doSave()} disabled={saving} className="hidden sm:inline-flex">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Sačuvaj nacrt
            </Button>
            <Button size="sm" onClick={handleFinish} disabled={hasErrors || saving} className="hidden sm:inline-flex">
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
                  <Field label="Ispunio">
                    <Input value={form.ispunio} onChange={(e) => setField("ispunio", e.target.value)} placeholder="Ime i prezime" className={aiClass("ispunio")} />
                  </Field>
                </div>

                <Field label="Vrsta kvara">
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
                  <Field label="Pogon">
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
                  <Field label="Tehnološka linija">
                    <Input value={form.tehnoloska_linija} onChange={(e) => setField("tehnoloska_linija", e.target.value)} className={aiClass("tehnoloska_linija")} />
                  </Field>
                </div>
                <Field label="Tehnički sistem / mašina" hint="npr. Hidraulični sistem peći">
                  <Input value={form.tehnicki_sistem} onChange={(e) => setField("tehnicki_sistem", e.target.value)} className={aiClass("tehnicki_sistem")} />
                </Field>
                <Field label="Sklop, podsklop, element mašine" hint="npr. Pumpa za hidrauliku → elektromotor">
                  <Input value={form.sklop_podsklop} onChange={(e) => setField("sklop_podsklop", e.target.value)} className={aiClass("sklop_podsklop")} />
                </Field>
              </AccordionContent>
            </AccordionItem>

            {/* Section 2 */}
            <AccordionItem value="s2" className="rounded-lg border bg-card">
              <AccordionTrigger className="px-4">2. Vremenski okvir</AccordionTrigger>
              <AccordionContent className="space-y-4 px-4 pb-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Vreme prijave kvara">
                    <Input type="datetime-local" value={form.vreme_prijave} onChange={(e) => setField("vreme_prijave", e.target.value)} className={aiClass("vreme_prijave")} />
                  </Field>
                  <Field label="Vreme otklanjanja kvara">
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
                <FieldWithAI label="Uzrok kvara" form={form} setField={setField} fieldKey="uzrok" rows={3} aiClass={aiClass("uzrok")} />
                <Field label="Posledice kvara">
                  <Textarea rows={2} value={form.posledice} onChange={(e) => setField("posledice", e.target.value)} className={aiClass("posledice")} />
                </Field>
                <FieldWithAI label="Način otklanjanja, kratki opis poslova" form={form} setField={setField} fieldKey="nacin_otklanjanja" rows={3} aiClass={aiClass("nacin_otklanjanja")} />
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
                    {form.ugradjeni_delovi.map((d, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={d.naziv}
                          onChange={(e) => {
                            const next = [...form.ugradjeni_delovi];
                            next[i] = { ...next[i], naziv: e.target.value };
                            setField("ugradjeni_delovi", next);
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
                          }}
                          placeholder="Količina"
                          className="w-28"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => setField("ugradjeni_delovi", form.ugradjeni_delovi.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setField("ugradjeni_delovi", [...form.ugradjeni_delovi, { naziv: "", kolicina: 1 }])}>
                      <Plus className="mr-1 h-4 w-4" />Dodaj deo
                    </Button>
                  </div>
                </Field>

                <Field label="Imena angažovanih na popravci">
                  <div className="space-y-2">
                    {form.imena_angazovanih.map((n, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={n}
                          onChange={(e) => {
                            const next = [...form.imena_angazovanih];
                            next[i] = e.target.value;
                            setField("imena_angazovanih", next);
                          }}
                          placeholder="Ime i prezime"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => setField("imena_angazovanih", form.imena_angazovanih.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
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
                <FieldWithAI label="Tehnička analiza kvara" form={form} setField={setField} fieldKey="tehnicka_analiza" rows={5} aiClass={aiClass("tehnicka_analiza")} />
                <Field label="Analizu izvršio">
                  <Input value={form.analizu_izvrsio} onChange={(e) => setField("analizu_izvrsio", e.target.value)} />
                </Field>
                <FieldWithAI label="Predlog korektivne mere" form={form} setField={setField} fieldKey="korektivna_mera" rows={4} aiClass={aiClass("korektivna_mera")} />
                <Field label="Korektivnu meru predložio">
                  <Input value={form.korektivnu_meru_predlozio} onChange={(e) => setField("korektivnu_meru_predlozio", e.target.value)} />
                </Field>
              </AccordionContent>
            </AccordionItem>

            {/* Section 6 */}
            <AccordionItem value="s6" className="rounded-lg border bg-card">
              <AccordionTrigger className="px-4">6. Potpis</AccordionTrigger>
              <AccordionContent className="space-y-4 px-4 pb-4">
                <Field label="Ispunio">
                  <Input value={form.ispunio} onChange={(e) => setField("ispunio", e.target.value)} placeholder="Ime i prezime" />
                </Field>
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
            />
          </div>
        </aside>
      </main>

      {/* Mobile sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t bg-card/95 p-3 backdrop-blur md:hidden">
        <Button variant="outline" size="sm" onClick={() => doSave()} disabled={saving} className="flex-1">
          <Save className="mr-1 h-4 w-4" />Nacrt
        </Button>
        <Button size="sm" onClick={handleFinish} disabled={hasErrors || saving} className="flex-1">
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
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FieldWithAI({
  label, form, setField, fieldKey, rows, aiClass,
}: {
  label: string;
  form: ReportFormState;
  setField: <K extends FieldKey>(k: K, v: ReportFormState[K]) => void;
  fieldKey: "uzrok" | "nacin_otklanjanja" | "tehnicka_analiza" | "korektivna_mera";
  rows: number;
  aiClass: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<string>("");
  const suggest = useServerFn(aiSuggestField);
  const { user } = useAuth();

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
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
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
      <Textarea
        rows={rows}
        value={form[fieldKey] as string}
        onChange={(e) => setField(fieldKey as FieldKey, e.target.value as any)}
        className={aiClass}
      />
    </div>
  );
}
