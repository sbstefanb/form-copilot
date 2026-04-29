import { useState } from "react";
import { Sparkles, Mic, Loader2, Lightbulb, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useServerFn } from "@tanstack/react-start";
import { aiExtractFromDescription } from "@/server/ai.functions";
import { toast } from "sonner";
import type { ReportFormState } from "@/lib/report-types";

export type ValidationIssue = { severity: "error" | "warning"; message: string; field: string | null };

type Suggestion = { id: string; title: string; description: string };

type Props = {
  form: ReportFormState;
  onExtract: (extracted: Partial<ReportFormState>, filledFields: Set<string>) => void;
  suggestions: Suggestion[];
  issues: ValidationIssue[];
  validating: boolean;
};

export function AiAssistantPanel({ form, onExtract, suggestions, issues, validating }: Props) {
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const extract = useServerFn(aiExtractFromDescription);

  const runExtract = async () => {
    if (!desc.trim()) {
      toast.info("Unesite kratak opis kvara.");
      return;
    }
    setBusy(true);
    try {
      const res = await extract({ data: { description: desc } });
      const extracted = (res as any).extracted ?? {};
      const filled = new Set<string>();
      const partial: Partial<ReportFormState> = {};
      for (const [k, v] of Object.entries(extracted)) {
        if (v == null) continue;
        if (Array.isArray(v) && v.length === 0) continue;
        // Map ISO datetimes to local string
        if ((k === "vreme_prijave" || k === "vreme_otklanjanja") && typeof v === "string") {
          const d = new Date(v);
          if (!isNaN(d.getTime())) {
            const pad = (n: number) => String(n).padStart(2, "0");
            (partial as any)[k] = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            filled.add(k);
          }
        } else {
          (partial as any)[k] = v;
          filled.add(k);
        }
      }
      onExtract(partial, filled);
      toast.success(`Popunjeno ${filled.size} ${filled.size === 1 ? "polje" : "polja"} iz opisa.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI greška");
    } finally {
      setBusy(false);
    }
  };

  const startDictation = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Glasovni unos nije podržan u ovom pregledaču.");
      return;
    }
    const rec = new SR();
    rec.lang = "sr-RS";
    rec.continuous = true;
    rec.interimResults = false;
    setListening(true);
    rec.onresult = (e: any) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setDesc((prev) => (prev ? prev + " " : "") + txt);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
  };

  return (
    <div className="space-y-4">
      {/* Card 1: Quick description -> extract */}
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Brzi opis kvara</h3>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Opišite kvar svojim rečima i AI će pokušati da popuni što više polja iz formulara.
        </p>
        <Textarea
          rows={5}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="npr. Sinoć oko 22h je stao motor pumpe za hidrauliku na peći u valjaonici. Došli smo odmah, pregoreo kalem motora, zamenili smo motor, sve proradilo u 02:30."
          className="resize-none text-sm"
        />
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={startDictation}
            disabled={listening}
            title="Diktiraj"
          >
            {listening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button onClick={runExtract} disabled={busy} className="flex-1">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Popuni iz opisa
          </Button>
        </div>
      </Card>

      {/* Card 2: Contextual suggestions */}
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold">Predlozi</h3>
        </div>
        {suggestions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nema predloga u ovom trenutku.</p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={s.id} className="rounded-md border border-border bg-muted/40 p-2.5 text-xs">
                <div className="font-medium">{s.title}</div>
                <div className="mt-0.5 text-muted-foreground">{s.description}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Card 3: Validation */}
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2">
          {validating ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : issues.length === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
          <h3 className="font-semibold">Provera formulara</h3>
        </div>
        {issues.length === 0 && !validating ? (
          <p className="text-xs text-muted-foreground">Formular izgleda konzistentno.</p>
        ) : (
          <ul className="space-y-2">
            {issues.map((it, i) => (
              <Alert key={i} variant={it.severity === "error" ? "destructive" : "default"} className="py-2">
                <div className="flex items-start gap-2">
                  {it.severity === "error" ? <AlertCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  <AlertDescription className="text-xs">{it.message}</AlertDescription>
                </div>
              </Alert>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-center text-[11px] text-muted-foreground">
        AI Asistent koristi Lovable AI (Gemini)
      </p>
    </div>
  );
}
