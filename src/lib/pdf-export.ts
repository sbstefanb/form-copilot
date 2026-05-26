import { computeDuration, STATUS_LABELS, type ReportFormState } from "./report-types";

// Local TTF files served from /public/fonts (full Serbian latinica support: š đ č ć ž)
const FONT_URL_REGULAR = "/fonts/NotoSans-Regular.ttf";
const FONT_URL_BOLD = "/fonts/NotoSans-Bold.ttf";

let fontsPromise: Promise<{ regular: string; bold: string }> | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${url}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const [regular, bold] = await Promise.all([
        fetchAsBase64(FONT_URL_REGULAR),
        fetchAsBase64(FONT_URL_BOLD),
      ]);
      return { regular, bold };
    })().catch((e) => {
      fontsPromise = null;
      throw e;
    });
  }
  return fontsPromise;
}

export async function exportReportToPdf(form: ReportFormState) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // Register Noto Sans for proper Serbian latinica — required, no fallback
  try {
    const { regular, bold } = await loadFonts();
    pdf.addFileToVFS("NotoSans-Regular.ttf", regular);
    pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    pdf.addFileToVFS("NotoSans-Bold.ttf", bold);
    pdf.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
    pdf.setFont("NotoSans", "normal");
  } catch (err) {
    console.error("PDF font load failed:", err);
    throw new Error("PDF font nije učitan. Pokušajte ponovo za par sekundi.");
  }

  const FONT = "NotoSans";

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 15;
  const contentWidth = pageWidth - marginX * 2;
  const labelWidth = 60;
  const valueX = marginX + labelWidth;
  const valueWidth = contentWidth - labelWidth;
  let y = 15;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 15) {
      pdf.addPage();
      y = 15;
    }
  };

  const drawHeader = () => {
    pdf.setFont(FONT, "bold");
    pdf.setFontSize(14);
    pdf.text("IZVEŠTAJ O KVARU", marginX, y);
    pdf.setFont(FONT, "normal");
    pdf.setFontSize(9);
    pdf.text("Obrazac P-12-05 — Čeličana", marginX, y + 5);

    pdf.setFontSize(9);
    const right = pageWidth - marginX;
    pdf.text(`Ev. broj: ${form.evidencioni_broj ?? "—"}`, right, y, { align: "right" });
    pdf.text(`Datum: ${form.datum || "—"}`, right, y + 5, { align: "right" });
    pdf.text(`Status: ${STATUS_LABELS[form.status]}`, right, y + 10, { align: "right" });

    y += 16;
    pdf.setDrawColor(180);
    pdf.line(marginX, y, pageWidth - marginX, y);
    y += 4;
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(10);
    pdf.setFillColor(235, 235, 235);
    pdf.rect(marginX, y, contentWidth, 7, "F");
    pdf.setFont(FONT, "bold");
    pdf.setFontSize(10);
    pdf.text(title, marginX + 2, y + 5);
    y += 9;
  };

  const drawRow = (label: string, value: string) => {
    pdf.setFont(FONT, "normal");
    pdf.setFontSize(9);
    const text = (value && value.trim()) ? value : "—";
    const lines = pdf.splitTextToSize(text, valueWidth - 4);
    const rowHeight = Math.max(7, lines.length * 4.2 + 2);
    ensureSpace(rowHeight);

    pdf.setDrawColor(210);
    pdf.rect(marginX, y, labelWidth, rowHeight);
    pdf.rect(valueX, y, valueWidth, rowHeight);

    pdf.setFillColor(248, 248, 248);
    pdf.rect(marginX, y, labelWidth, rowHeight, "F");
    pdf.setFont(FONT, "bold");
    pdf.text(label, marginX + 2, y + 5);

    pdf.setFont(FONT, "normal");
    pdf.text(lines, valueX + 2, y + 5);

    y += rowHeight;
  };

  const fmtDateTime = (iso: string) =>
    iso ? new Date(iso).toLocaleString("sr-RS") : "";

  drawHeader();

  drawSectionTitle("1. Osnovne informacije");
  drawRow(
    "Vrsta kvara",
    form.vrsta_kvara === "Ostalo"
      ? `Ostalo: ${form.vrsta_kvara_ostalo}`
      : (form.vrsta_kvara || ""),
  );
  drawRow("Pogon", form.pogon);
  drawRow("Tehnološka linija", form.tehnoloska_linija);
  drawRow("Tehnički sistem / mašina", form.tehnicki_sistem);
  drawRow("Sklop, podsklop, element", form.sklop_podsklop);

  drawSectionTitle("2. Vremenski okvir");
  drawRow("Vreme prijave", fmtDateTime(form.vreme_prijave));
  drawRow("Vreme otklanjanja", fmtDateTime(form.vreme_otklanjanja));
  drawRow("Trajanje zastoja", computeDuration(form.vreme_prijave, form.vreme_otklanjanja));

  drawSectionTitle("3. Opis i otklanjanje");
  drawRow("Uzrok kvara", form.uzrok);
  drawRow("Posledice kvara", form.posledice);
  drawRow("Način otklanjanja", form.nacin_otklanjanja);
  drawRow("Ostale usluge", form.ostale_usluge);
  drawRow("Napomena", form.napomena);

  drawSectionTitle("4. Ugrađeni delovi i ljudi");
  drawRow(
    "Ugrađeni delovi",
    form.ugradjeni_delovi.length === 0
      ? ""
      : form.ugradjeni_delovi
          .map((d, i) => `${i + 1}. ${d.naziv} — ${d.kolicina}`)
          .join("\n"),
  );
  drawRow(
    "Imena angažovanih",
    form.imena_angazovanih.filter(Boolean).join(", "),
  );
  drawRow(
    "Broj izvršilaca",
    form.broj_izvrsilaca === "" ? "" : String(form.broj_izvrsilaca),
  );

  drawSectionTitle("5. Tehnička analiza (popunjava inženjer)");
  drawRow("Tehnička analiza", form.tehnicka_analiza);
  drawRow("Analizu izvršio", form.analizu_izvrsio);
  drawRow("Predlog korektivne mere", form.korektivna_mera);
  drawRow("Korektivnu meru predložio", form.korektivnu_meru_predlozio);

  drawSectionTitle("6. Potpis");
  drawRow("Ispunio", form.ispunio);

  pdf.save(`${form.evidencioni_broj || "izvestaj"}.pdf`);
}
