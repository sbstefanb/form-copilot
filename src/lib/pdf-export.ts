import { computeDuration, STATUS_LABELS, type ReportFormState } from "./report-types";

export async function exportReportToPdf(form: ReportFormState) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

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
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("IZVESTAJ O KVARU", marginX, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("Obrazac P-12-05 — Celicana", marginX, y + 5);

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
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(title, marginX + 2, y + 5);
    y += 9;
  };

  const drawRow = (label: string, value: string) => {
    pdf.setFont("helvetica", "normal");
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
    pdf.setFont("helvetica", "bold");
    pdf.text(label, marginX + 2, y + 5);

    pdf.setFont("helvetica", "normal");
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
  drawRow("Tehnoloska linija", form.tehnoloska_linija);
  drawRow("Tehnicki sistem / masina", form.tehnicki_sistem);
  drawRow("Sklop, podsklop, element", form.sklop_podsklop);

  drawSectionTitle("2. Vremenski okvir");
  drawRow("Vreme prijave", fmtDateTime(form.vreme_prijave));
  drawRow("Vreme otklanjanja", fmtDateTime(form.vreme_otklanjanja));
  drawRow("Trajanje zastoja", computeDuration(form.vreme_prijave, form.vreme_otklanjanja));

  drawSectionTitle("3. Opis i otklanjanje");
  drawRow("Uzrok kvara", form.uzrok);
  drawRow("Posledice kvara", form.posledice);
  drawRow("Nacin otklanjanja", form.nacin_otklanjanja);
  drawRow("Ostale usluge", form.ostale_usluge);
  drawRow("Napomena", form.napomena);

  drawSectionTitle("4. Ugradjeni delovi i ljudi");
  drawRow(
    "Ugradjeni delovi",
    form.ugradjeni_delovi.length === 0
      ? ""
      : form.ugradjeni_delovi
          .map((d, i) => `${i + 1}. ${d.naziv} — ${d.kolicina}`)
          .join("\n"),
  );
  drawRow(
    "Imena angazovanih",
    form.imena_angazovanih.filter(Boolean).join(", "),
  );
  drawRow(
    "Broj izvrsilaca",
    form.broj_izvrsilaca === "" ? "" : String(form.broj_izvrsilaca),
  );

  drawSectionTitle("5. Tehnicka analiza (popunjava inzenjer)");
  drawRow("Tehnicka analiza", form.tehnicka_analiza);
  drawRow("Analizu izvrsio", form.analizu_izvrsio);
  drawRow("Predlog korektivne mere", form.korektivna_mera);
  drawRow("Korektivnu meru predlozio", form.korektivnu_meru_predlozio);

  drawSectionTitle("6. Potpis");
  drawRow("Ispunio", form.ispunio);

  pdf.save(`${form.evidencioni_broj || "izvestaj"}.pdf`);
}
