import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { computeDuration, type ReportFormState } from "@/lib/report-types";

const THIN: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF000000" } };
const BORDER_ALL = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const BORDER_BOTTOM = { bottom: THIN };
const FONT = { name: "Calibri", size: 11 };
const FONT_BOLD = { ...FONT, bold: true };

function splitDateTime(local: string): { date: string; time: string } {
  if (!local) return { date: "", time: "" };
  const d = new Date(local);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function checkbox(checked: boolean, label: string): string {
  return `${checked ? "[✓]" : "[ ]"} ${label}`;
}

export async function exportReportToXlsx(form: ReportFormState): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1", {
    pageSetup: {
      orientation: "portrait",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { top: 0.75, bottom: 0.75, left: 0.5, right: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  // Column widths (A..M)
  const widths = [3, 5, 35, 18, 3, 12, 14, 3, 14, 14, 3, 20, 14];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Enable auto row height for merged multi-line blocks via wrapText.
  // ExcelJS does not auto-fit merged cells, so set sensible minimum heights.
  const multiLineRows: Array<[number, number]> = [
    [28, 31],   // 6. Uzrok
    [34, 37],   // 7. Posledice
    [40, 55],   // 8. Način otklanjanja
    [58, 63],   // 9. Ugrađeni delovi
    [66, 68],   // 10. Imena angažovanih
    [70, 75],   // 11. Ostale usluge
    [78, 83],   // 12. Napomena
    [88, 98],   // 13. Tehnička analiza
    [103, 108], // 14. Korektivna mera
  ];
  for (const [from, to] of multiLineRows) {
    for (let r = from; r <= to; r++) ws.getRow(r).height = 18;
  }

  // Helpers
  const setLabel = (addr: string, value: string, opts: { bold?: boolean; align?: "left" | "right" | "center"; size?: number } = {}) => {
    const c = ws.getCell(addr);
    c.value = value;
    c.font = { ...FONT, bold: !!opts.bold, size: opts.size ?? 11 };
    c.alignment = { horizontal: opts.align ?? "left", vertical: "middle", wrapText: true };
  };
  const setValueBottom = (addr: string, value: any) => {
    const c = ws.getCell(addr);
    c.value = value ?? "";
    c.font = FONT;
    c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    c.border = BORDER_BOTTOM;
  };
  const setBlock = (range: string, value: string) => {
    ws.mergeCells(range);
    const top = range.split(":")[0];
    const c = ws.getCell(top);
    c.value = value ?? "";
    c.font = FONT;
    c.alignment = { horizontal: "left", vertical: "top", wrapText: true };
    c.border = BORDER_ALL;
  };

  // Row 2
  const g2 = ws.getCell("G2");
  g2.value = "IZVEŠTAJI I ANALIZE KVAROVA";
  g2.font = { ...FONT, bold: true, size: 12 };
  g2.alignment = { horizontal: "center", vertical: "middle" };
  const m2 = ws.getCell("M2");
  m2.value = "P-12-05";
  m2.font = { ...FONT, bold: true, size: 12 };
  m2.alignment = { horizontal: "center", vertical: "middle" };
  m2.border = BORDER_ALL;

  // Row 6 - title
  ws.mergeCells("B6:M6");
  const b6 = ws.getCell("B6");
  b6.value = "IZVEŠTAJ I ANALIZA KVARA - NEPLANIRANOG ZASTOJA";
  b6.font = { ...FONT, bold: true, size: 14 };
  b6.alignment = { horizontal: "center", vertical: "middle" };

  // Row 8
  setLabel("D8", "Evidencioni broj:", { bold: true, align: "right" });
  setValueBottom("E8", form.evidencioni_broj || "");
  setLabel("G8", "Datum:", { bold: true, align: "right" });
  setValueBottom("H8", form.datum || "");

  // Row 10-11 - vrsta kvara
  setLabel("B10", "1.", { bold: true });
  setLabel("C10", "Vrste kvara - neplaniranog zastoja:", { bold: true });
  setLabel("D11", checkbox(form.vrsta_kvara === "Mašinski", "Mašinski"));
  setLabel("G11", checkbox(form.vrsta_kvara === "Elektro", "Elektro"));
  setLabel("I11", checkbox(form.vrsta_kvara === "Proizvodni", "Proizvodni"));
  setLabel("K11", `${form.vrsta_kvara === "Ostalo" ? "[✓]" : "[ ]"} Ostalo: ${form.vrsta_kvara_ostalo || ""}`);

  // Row 13 - mesto kvara
  setLabel("B13", "2.", { bold: true });
  setLabel("C13", "Mesto kvara - neplaniranog zastoja:", { bold: true });
  const mestoRows: [string, string, string][] = [
    ["C14", "Pogon:", form.pogon],
    ["C15", "Tehnološka linija:", form.tehnoloska_linija],
    ["C16", "Tehnički sistem, mašina:", form.tehnicki_sistem],
    ["C17", "Sklop, podsklop, element mašine:", form.sklop_podsklop],
  ];
  mestoRows.forEach(([addr, label, value]) => {
    setLabel(addr, label, { align: "right" });
    const row = addr.slice(1);
    ws.mergeCells(`D${row}:M${row}`);
    setValueBottom(`D${row}`, value);
  });

  // Row 19 - vreme prijave
  const prijava = splitDateTime(form.vreme_prijave);
  setLabel("B19", "3.", { bold: true });
  setLabel("C19", "Vreme prijave nastanka kvara i pristupa otklanjanju", { bold: true });
  setLabel("C20", "Datum:", { align: "right" });
  setValueBottom("D20", prijava.date);
  setLabel("G20", "Vreme:", { align: "right" });
  setValueBottom("H20", prijava.time);

  // Row 22 - vreme otklanjanja
  const otkl = splitDateTime(form.vreme_otklanjanja);
  setLabel("B22", "4.", { bold: true });
  setLabel("C22", "Vreme otklanjanja kvara (tačno vreme kada je mašina, uređaj počeo sa nesmetanim radom)", { bold: true });
  setLabel("C23", "Datum:", { align: "right" });
  setValueBottom("D23", otkl.date);
  setLabel("G23", "Vreme:", { align: "right" });
  setValueBottom("H23", otkl.time);

  // Row 25 - trajanje
  setLabel("B25", "5.", { bold: true });
  setLabel("C25", "Ukupno vreme neplaniranog zastoja:", { bold: true });
  setValueBottom("D25", computeDuration(form.vreme_prijave, form.vreme_otklanjanja));

  // Row 27 - uzrok
  setLabel("B27", "6.", { bold: true });
  setLabel("C27", "Uzrok kvara:", { bold: true });
  setBlock("C28:M31", form.uzrok);

  // Row 33 - posledice
  setLabel("B33", "7.", { bold: true });
  setLabel("C33", "Posledice kvara na delovanje tehničkog sistema, mašine:", { bold: true });
  setBlock("C34:M37", form.posledice);

  // Row 39 - nacin otklanjanja
  setLabel("B39", "8.", { bold: true });
  setLabel("C39", "Način otklanjanja kvara, kratki opis poslova:", { bold: true });
  setBlock("C40:M55", form.nacin_otklanjanja);

  // Row 57 - ugradjeni delovi
  setLabel("B57", "9.", { bold: true });
  setLabel("C57", "Ugrađeni delovi i materijal:", { bold: true });
  setBlock(
    "C58:M63",
    form.ugradjeni_delovi.map((d) => `${d.naziv} — ${d.kolicina}`).join("\n"),
  );

  // Row 65 - imena angazovanih
  setLabel("B65", "10.", { bold: true });
  setLabel("C65", "Imena angažovanih na popravci:", { bold: true });
  setLabel("L65", "Broj izvršilaca:", { bold: true, align: "right" });
  setBlock("C66:K68", form.imena_angazovanih.filter(Boolean).join(", "));
  setValueBottom("L66", form.broj_izvrsilaca === "" ? "" : String(form.broj_izvrsilaca));

  // Row 69 - ostale usluge
  setLabel("B69", "11.", { bold: true });
  setLabel("C69", "Ostale usluge:", { bold: true });
  setBlock("C70:M75", form.ostale_usluge);

  // Row 77 - napomena
  setLabel("B77", "12.", { bold: true });
  setLabel("C77", "Napomena i zapažanje:", { bold: true });
  setBlock("C78:M83", form.napomena);

  // Row 85 - ispunio
  setLabel("C85", "ISPUNIO:", { bold: true, align: "right" });
  ws.mergeCells("D85:G85");
  setValueBottom("D85", form.ispunio);

  // Row 87 - tehnicka analiza
  setLabel("B87", "13.", { bold: true });
  setLabel("C87", "Tehnička analiza kvara:", { bold: true });
  setBlock("C88:M98", form.tehnicka_analiza);

  // Row 100 - analizu izvrsio
  setLabel("C100", "ANALIZU IZVRŠIO:", { bold: true, align: "right" });
  ws.mergeCells("D100:G100");
  setValueBottom("D100", form.analizu_izvrsio);

  // Row 102 - korektivna mera
  setLabel("B102", "14.", { bold: true });
  setLabel("C102", "Predlog korektivne mere (osnova za popunjavanje formulara F-12)", { bold: true });
  setBlock("C103:M108", form.korektivna_mera);

  // Row 109 - korektivnu meru predlozio
  setLabel("C109", "KOREKTIVNU MERU PREDLOŽIO:", { bold: true, align: "right" });
  ws.mergeCells("D109:G109");
  setValueBottom("D109", form.korektivnu_meru_predlozio);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `${form.evidencioni_broj || "izvestaj"}.xlsx`);
}
