export type VrstaKvara = "Mašinski" | "Elektro" | "Proizvodni" | "Ostalo";
export type ReportStatus = "u_izradi" | "ceka_analizu" | "zavrsen";

export type UgradjeniDeo = { naziv: string; kolicina: number };

export type ReportFormState = {
  id?: string;
  evidencioni_broj?: string;
  status: ReportStatus;
  datum: string; // YYYY-MM-DD
  vrsta_kvara: VrstaKvara | "";
  vrsta_kvara_ostalo: string;
  pogon: string;
  tehnoloska_linija: string;
  tehnicki_sistem: string;
  sklop_podsklop: string;
  vreme_prijave: string; // datetime-local
  vreme_otklanjanja: string;
  uzrok: string;
  posledice: string;
  nacin_otklanjanja: string;
  ugradjeni_delovi: UgradjeniDeo[];
  imena_angazovanih: string[];
  broj_izvrsilaca: number | "";
  ostale_usluge: string;
  napomena: string;
  ispunio: string;
  tehnicka_analiza: string;
  analizu_izvrsio: string;
  korektivna_mera: string;
  korektivnu_meru_predlozio: string;
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  u_izradi: "U izradi",
  ceka_analizu: "Čeka analizu",
  zavrsen: "Završen",
};

export const POGONI = ["Topionica", "Valjaonica", "Alatnica"];

export const VRSTE_KVARA: { value: VrstaKvara; label: string; emoji: string }[] = [
  { value: "Mašinski", label: "Mašinski", emoji: "🔧" },
  { value: "Elektro", label: "Elektro", emoji: "⚡" },
  { value: "Proizvodni", label: "Proizvodni", emoji: "🏭" },
  { value: "Ostalo", label: "Ostalo", emoji: "❓" },
];

export function emptyReport(ispunioName = ""): ReportFormState {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dateOnly = dt.slice(0, 10);
  return {
    status: "u_izradi",
    datum: dateOnly,
    vrsta_kvara: "",
    vrsta_kvara_ostalo: "",
    pogon: "",
    tehnoloska_linija: "",
    tehnicki_sistem: "",
    sklop_podsklop: "",
    vreme_prijave: dt,
    vreme_otklanjanja: "",
    uzrok: "",
    posledice: "",
    nacin_otklanjanja: "",
    ugradjeni_delovi: [],
    imena_angazovanih: [],
    broj_izvrsilaca: "",
    ostale_usluge: "",
    napomena: "",
    ispunio: ispunioName,
    tehnicka_analiza: "",
    analizu_izvrsio: "",
    korektivna_mera: "",
    korektivnu_meru_predlozio: "",
  };
}

export function computeDuration(prijava: string, otklanjanje: string): string {
  if (!prijava || !otklanjanje) return "—";
  const a = new Date(prijava).getTime();
  const b = new Date(otklanjanje).getTime();
  if (isNaN(a) || isNaN(b) || b <= a) return "—";
  const diffMin = Math.round((b - a) / 60000);
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return `${h}h ${m}min`;
}

// Convert DB row -> form state
export function rowToForm(row: any): ReportFormState {
  const toLocal = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return {
    id: row.id,
    evidencioni_broj: row.evidencioni_broj,
    status: row.status,
    datum: row.datum ?? "",
    vrsta_kvara: row.vrsta_kvara ?? "",
    vrsta_kvara_ostalo: row.vrsta_kvara_ostalo ?? "",
    pogon: row.pogon ?? "",
    tehnoloska_linija: row.tehnoloska_linija ?? "",
    tehnicki_sistem: row.tehnicki_sistem ?? "",
    sklop_podsklop: row.sklop_podsklop ?? "",
    vreme_prijave: toLocal(row.vreme_prijave),
    vreme_otklanjanja: toLocal(row.vreme_otklanjanja),
    uzrok: row.uzrok ?? "",
    posledice: row.posledice ?? "",
    nacin_otklanjanja: row.nacin_otklanjanja ?? "",
    ugradjeni_delovi: Array.isArray(row.ugradjeni_delovi) ? row.ugradjeni_delovi : [],
    imena_angazovanih: Array.isArray(row.imena_angazovanih) ? row.imena_angazovanih : [],
    broj_izvrsilaca: row.broj_izvrsilaca ?? "",
    ostale_usluge: row.ostale_usluge ?? "",
    napomena: row.napomena ?? "",
    ispunio: row.ispunio ?? "",
    tehnicka_analiza: row.tehnicka_analiza ?? "",
    analizu_izvrsio: row.analizu_izvrsio ?? "",
    korektivna_mera: row.korektivna_mera ?? "",
    korektivnu_meru_predlozio: row.korektivnu_meru_predlozio ?? "",
  };
}

// Convert form -> DB upsert payload
export function formToRow(form: ReportFormState, userId: string): any {
  const toIso = (local: string) => (local ? new Date(local).toISOString() : null);
  return {
    user_id: userId,
    status: form.status,
    datum: form.datum,
    vrsta_kvara: form.vrsta_kvara || null,
    vrsta_kvara_ostalo: form.vrsta_kvara_ostalo || null,
    pogon: form.pogon || null,
    tehnoloska_linija: form.tehnoloska_linija || null,
    tehnicki_sistem: form.tehnicki_sistem || null,
    sklop_podsklop: form.sklop_podsklop || null,
    vreme_prijave: toIso(form.vreme_prijave),
    vreme_otklanjanja: toIso(form.vreme_otklanjanja),
    uzrok: form.uzrok || null,
    posledice: form.posledice || null,
    nacin_otklanjanja: form.nacin_otklanjanja || null,
    ugradjeni_delovi: form.ugradjeni_delovi,
    imena_angazovanih: form.imena_angazovanih,
    broj_izvrsilaca: form.broj_izvrsilaca === "" ? null : form.broj_izvrsilaca,
    ostale_usluge: form.ostale_usluge || null,
    napomena: form.napomena || null,
    ispunio: form.ispunio || null,
    tehnicka_analiza: form.tehnicka_analiza || null,
    analizu_izvrsio: form.analizu_izvrsio || null,
    korektivna_mera: form.korektivna_mera || null,
    korektivnu_meru_predlozio: form.korektivnu_meru_predlozio || null,
  };
}
