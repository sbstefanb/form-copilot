import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  AlignmentType,
  HeadingLevel,
} from "docx";
import { saveAs } from "file-saver";
import { computeDuration, STATUS_LABELS, type ReportFormState } from "./report-types";

const FONT = "Calibri";
const TITLE_RED = "C8102E";
const LABEL_BG = "F0F0F0";
const SECTION_BG = "D9D9D9";
const BORDER_COLOR = "BFBFBF";

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR };
const cellBorders = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder,
};

// Content width on US Letter with 1" margins = 9360 DXA; A4 = 9026. Use 9360.
const TABLE_WIDTH = 9360;
const LABEL_W = 3120;
const VALUE_W = TABLE_WIDTH - LABEL_W;

function fmtDateTime(iso: string) {
  return iso ? new Date(iso).toLocaleString("sr-RS") : "";
}

function dash(v: string | number | undefined | null) {
  const s = v === null || v === undefined ? "" : String(v);
  return s.trim() ? s : "—";
}

function labelCell(label: string) {
  return new TableCell({
    width: { size: LABEL_W, type: WidthType.DXA },
    borders: cellBorders,
    shading: { fill: LABEL_BG, type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: label, bold: true, font: FONT, size: 22 })],
      }),
    ],
  });
}

function valueCell(value: string) {
  const lines = (value || "").split("\n");
  const children =
    lines.length === 0 || (lines.length === 1 && !lines[0])
      ? [new Paragraph({ children: [new TextRun({ text: "—", font: FONT, size: 22 })] })]
      : lines.map(
          (l) =>
            new Paragraph({
              children: [new TextRun({ text: l || "—", font: FONT, size: 22 })],
            }),
        );
  return new TableCell({
    width: { size: VALUE_W, type: WidthType.DXA },
    borders: cellBorders,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children,
  });
}

function row(label: string, value: string) {
  return new TableRow({
    children: [labelCell(label), valueCell(dash(value))],
  });
}

function sectionTitle(title: string) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: SECTION_BG },
    children: [new TextRun({ text: title, bold: true, font: FONT, size: 24 })],
  });
}

function dataTable(rows: TableRow[]) {
  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [LABEL_W, VALUE_W],
    rows,
  });
}

export async function exportReportToDocx(form: ReportFormState) {
  const headerTable = new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [5360, 4000],
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "auto" },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: "808080" },
      left: { style: BorderStyle.NONE, size: 0, color: "auto" },
      right: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 5360, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "auto" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
              left: { style: BorderStyle.NONE, size: 0, color: "auto" },
              right: { style: BorderStyle.NONE, size: 0, color: "auto" },
            },
            children: [
              new Paragraph({
                heading: HeadingLevel.HEADING_1,
                children: [
                  new TextRun({
                    text: "IZVEŠTAJ O KVARU",
                    bold: true,
                    font: FONT,
                    size: 28,
                    color: TITLE_RED,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Obrazac P-12-05 — Čeličana",
                    font: FONT,
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 4000, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "auto" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
              left: { style: BorderStyle.NONE, size: 0, color: "auto" },
              right: { style: BorderStyle.NONE, size: 0, color: "auto" },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "Ev. broj: ", bold: true, font: FONT, size: 18 }),
                  new TextRun({ text: dash(form.evidencioni_broj), font: FONT, size: 18 }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "Datum: ", bold: true, font: FONT, size: 18 }),
                  new TextRun({ text: dash(form.datum), font: FONT, size: 18 }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "Status: ", bold: true, font: FONT, size: 18 }),
                  new TextRun({ text: STATUS_LABELS[form.status], font: FONT, size: 18 }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const ugradjeniText =
    form.ugradjeni_delovi.length === 0
      ? ""
      : form.ugradjeni_delovi
          .map((d, i) => `${i + 1}. ${d.naziv} — ${d.kolicina}`)
          .join("\n");

  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          headerTable,
          new Paragraph({ children: [new TextRun({ text: "" })] }),

          sectionTitle("1. Osnovne informacije"),
          dataTable([
            row(
              "Vrsta kvara",
              form.vrsta_kvara === "Ostalo"
                ? `Ostalo: ${form.vrsta_kvara_ostalo}`
                : form.vrsta_kvara || "",
            ),
            row("Pogon", form.pogon),
            row("Tehnološka linija", form.tehnoloska_linija),
            row("Tehnički sistem / mašina", form.tehnicki_sistem),
            row("Sklop, podsklop, element", form.sklop_podsklop),
          ]),

          sectionTitle("2. Vremenski okvir"),
          dataTable([
            row("Vreme prijave", fmtDateTime(form.vreme_prijave)),
            row("Vreme otklanjanja", fmtDateTime(form.vreme_otklanjanja)),
            row(
              "Trajanje zastoja",
              computeDuration(form.vreme_prijave, form.vreme_otklanjanja),
            ),
          ]),

          sectionTitle("3. Opis i otklanjanje"),
          dataTable([
            row("Uzrok kvara", form.uzrok),
            row("Posledice kvara", form.posledice),
            row("Način otklanjanja", form.nacin_otklanjanja),
            row("Ostale usluge", form.ostale_usluge),
            row("Napomena", form.napomena),
          ]),

          sectionTitle("4. Ugrađeni delovi i ljudi"),
          dataTable([
            row("Ugrađeni delovi", ugradjeniText),
            row("Imena angažovanih", form.imena_angazovanih.filter(Boolean).join(", ")),
            row(
              "Broj izvršilaca",
              form.broj_izvrsilaca === "" ? "" : String(form.broj_izvrsilaca),
            ),
          ]),

          sectionTitle("5. Tehnička analiza (popunjava inženjer)"),
          dataTable([
            row("Tehnička analiza", form.tehnicka_analiza),
            row("Analizu izvršio", form.analizu_izvrsio),
            row("Predlog korektivne mere", form.korektivna_mera),
            row("Korektivnu meru predložio", form.korektivnu_meru_predlozio),
          ]),

          sectionTitle("6. Potpis"),
          dataTable([row("Ispunio", form.ispunio)]),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${form.evidencioni_broj || "izvestaj"}.docx`);
}
