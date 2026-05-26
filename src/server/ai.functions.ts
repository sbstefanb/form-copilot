import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const body: any = { model: MODEL, messages };

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("Previše zahteva — sačekajte trenutak.");
    if (res.status === 402) throw new Error("Potrebno dopuniti AI kredit u Lovable Cloud podešavanjima.");
    const txt = await res.text();
    console.error("AI gateway error:", res.status, txt);
    throw new Error("AI servis trenutno nije dostupan.");
  }
  const json = await res.json();
  return (json?.choices?.[0]?.message?.content as string) ?? "";
}

function safeJsonExtract(text: string): any {
  // Strip code fences if any
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // try to find first { ... } or [ ... ]
    const m = cleaned.match(/[{\[][\s\S]*[}\]]/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* */ }
    }
    return null;
  }
}

// ===== AI Function 1: Extract structured data from free text =====

const ExtractInput = z.object({ description: z.string().min(1).max(5000) });

export const aiExtractFromDescription = createServerFn({ method: "POST" })
  .inputValidator((d) => ExtractInput.parse(d))
  .handler(async ({ data }) => {
    const today = new Date().toISOString().slice(0, 10);
    const system = `Ti si AI asistent koji izvlači strukturirane podatke iz opisa industrijskog kvara u Čeličani (čeličana). Korisnik (tehničar/inženjer) ti daje slobodan opis na srpskom jeziku, a ti vraćaš JSON sa popunjenim poljima obrasca P-12-05.

PRAVILA:
1. Vrati ISKLJUČIVO validan JSON. Bez objašnjenja, bez markdown ograde.
2. Polja koja ne možeš da zaključiš iz opisa, postavi na null (ili prazan niz za liste).
3. Ne izmišljaj. Ako nešto nije rečeno, vrati null.
4. Vrste kvara: 'Mašinski' (motor, pumpa, ležaj, ulje, hidraulika), 'Elektro' (kalem, kontaktor, PLC, kabl, transformator), 'Proizvodni' (greška u tehnologiji, kvalitet sirovine), 'Ostalo'. Ako nije jasno, postavi null.
5. Datumi/vremena: tumači "sinoć", "jutros", "danas", "u sredu" relativno na DATUM_DANAS koji ti je dat ispod. Format vremena: ISO 8601 sa lokalnom vremenskom zonom.

POGONI U ČELIČANI: Topionica, Valjaonica, Alatnica.
NIVOI STRUKTURE MAŠINE: 1) mašina, 2) podsklop, 3) rezervni deo, 4) rezervni deo rezervnog dela.

DATUM_DANAS: ${today}

JSON SCHEMA — vrati objekat sa OVIM ključevima (svi opcionalni, koristi null gde ne znaš):
{
  "vrsta_kvara": "Mašinski" | "Elektro" | "Proizvodni" | "Ostalo" | null,
  "pogon": string | null,
  "tehnoloska_linija": string | null,
  "tehnicki_sistem": string | null,
  "sklop_podsklop": string | null,
  "vreme_prijave": ISO_string | null,
  "vreme_otklanjanja": ISO_string | null,
  "uzrok": string | null,
  "posledice": string | null,
  "nacin_otklanjanja": string | null,
  "ugradjeni_delovi": [{"naziv": string, "kolicina": number}] | [],
  "imena_angazovanih": [string] | [],
  "broj_izvrsilaca": number | null
}`;

    const content = await callAI(
      [
        { role: "system", content: system },
        { role: "user", content: data.description },
      ],
    );
    const parsed = safeJsonExtract(content);
    return { extracted: parsed ?? {} };
  });

// ===== AI Function 2: Suggest text for a specific field =====

const SuggestInput = z.object({
  form_state: z.record(z.string(), z.any()),
  target_field: z.enum(["uzrok", "nacin_otklanjanja", "tehnicka_analiza", "korektivna_mera"]),
});

export const aiSuggestField = createServerFn({ method: "POST" })
  .inputValidator((d) => SuggestInput.parse(d))
  .handler(async ({ data }) => {
    const system = `Ti si AI asistent koji predlaže tekst za polje obrasca P-12-05 u Čeličani. Dobijaš trenutno popunjen formular (kao JSON) i ime polja za koje treba predlog.

PRAVILA:
1. Vrati SAMO predloženi tekst, bez objašnjenja, bez markdown.
2. Tekst mora biti kratak i konkretan: 1-3 rečenice za kratka polja, 3-5 za dugačka (tehnička analiza, korektivna mera).
3. Koristi tehničku terminologiju iz dokumenata Čeličane: radni nalog, karta mašine, podsklop, preventivno održavanje, korektivna mera, itd.
4. Za 'tehnicka_analiza' fokusiraj se na: koren uzrok (ne samo simptom), procena uticaja, kontekst u smislu strukture mašine.
5. Za 'korektivna_mera' predloži konkretne preventivne mere: dopuna plana podmazivanja, dodavanje tačke u listi minimalnih rezervnih delova, izmena karte mašine, kvartalna inspekcija, itd.
6. Ako u formularu nema dovoljno informacija da daš relevantan predlog, vrati: "Potrebno je više informacija u prethodnim poljima da bih dao predlog."`;

    const content = await callAI([
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(data) },
    ]);
    return { suggestion: content.trim() };
  });

// ===== AI Function 3: Validate the form =====

const ValidateInput = z.object({ form_state: z.record(z.string(), z.any()) });

export const aiValidateForm = createServerFn({ method: "POST" })
  .inputValidator((d) => ValidateInput.parse(d))
  .handler(async ({ data }) => {
    const system = `Ti si AI asistent koji proverava logičku konzistentnost i potpunost obrasca P-12-05 u Čeličani. Dobijaš popunjen formular (JSON) i vraćaš listu pronađenih problema.

PRAVILA:
1. Vrati ISKLJUČIVO validan JSON niz objekata. Bez objašnjenja oko niza.
2. Svaki objekat ima oblik: {"severity": "error" | "warning", "message": string, "field": string | null}
3. Tipovi provera:
   - "error" za logičke greške koje moraju biti ispravljene (vreme otklanjanja pre prijave, neslaganje vrste kvara sa opisom, prazno obavezno polje)
   - "warning" za nedostatke koji nisu kritični (prazno polje korektivne mere, broj izvršilaca ne odgovara broju imena, kratak/nejasan opis uzroka)
4. Maksimalno 5 problema u nizu. Najvažniji prvo.
5. Ako nema problema, vrati prazan niz: []
6. Poruke na srpskom (latinica), kratko i konstruktivno.
7. VAŽNO — vreme_prijave (kvara) i vreme_otklanjanja prirodno PRETHODE polju 'datum' (datum popunjavanja izveštaja). Kvar se desi prvo, pa se posle popunjava izveštaj o njemu. NE prijavljuj kao grešku ili upozorenje ako je vreme_prijave ili vreme_otklanjanja ranije od 'datum' polja — to je očekivano.

   Jedina vremenska greška koju prijavljuješ je: vreme_otklanjanja PRE vreme_prijave (otklanjanje ne može biti pre prijave istog kvara). Sve ostalo je u redu.

8. VAŽNO — Klasifikacija vrste kvara je BLAGO pravilo, ne strogo. Mašinsko-elektro mešoviti kvarovi (npr. pumpa + elektromotor + senzor) su uobičajeni u industriji i klasifikuju se po DOMINANTNOM aspektu, ne po svim pomenutim komponentama.

   PRIJAVLJUJ upozorenje za neslaganje vrste kvara SAMO ako je situacija OČIGLEDNA — npr. vrsta = 'Elektro' a opis se ISKLJUČIVO bavi mehaničkim oštećenjem (puklo vratilo, slomljen ležaj) bez ijedne elektro komponente.

   NE PRIJAVLJUJ ako:
   - opis sadrži više komponenti različitih priroda (mašinski + elektro = mešoviti, normalan slučaj)
   - vrsta = 'Mašinski' a u opisu se pominju motor, senzor, kontaktor (motor je mašinsko-elektro komponenta, klasifikacija po pumpi/uležištenju je validna)
   - vrsta = 'Elektro' a u opisu se pominje motor, ležaj, ulje (elektrokomponente nose mehanički deo)

   Cilj: AI prijavljuje samo stvarno pogrešne klasifikacije, ne diskutuje nijanse sa korisnikom.`;

    const content = await callAI(
      [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(data.form_state) },
      ],
    );
    let parsed = safeJsonExtract(content);
    // Some models wrap arrays into an object; normalize
    if (parsed && !Array.isArray(parsed)) {
      if (Array.isArray(parsed.issues)) parsed = parsed.issues;
      else if (Array.isArray(parsed.problems)) parsed = parsed.problems;
      else parsed = [];
    }
    return { issues: Array.isArray(parsed) ? parsed : [] };
  });
