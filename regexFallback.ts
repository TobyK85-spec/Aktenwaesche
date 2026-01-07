import type { WashOptions, WashResult } from "./gemini";

export function washLocally(text: string, options: WashOptions): WashResult {
  let washed = text;
  const entities: WashResult["entities"] = [];
  const warnings: string[] = [];

  const replaceAll = (
    re: RegExp,
    type: string,
    makeReplacement: (m: string, idx: number) => string
  ) => {
    let idx = 0;
    washed = washed.replace(re, (m) => {
      idx++;
      const rep = makeReplacement(m, idx);
      entities.push({ type, original: m, replacement: rep, note: "Local regex" });
      return rep;
    });
  };

  const mode = options.mode;

  if (options.detect.emails) {
    replaceAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "EMAIL", (_m, i) =>
      mode === "BLOCK" ? "█████" : `[EMAIL_${i}]`
    );
  }

  if (options.detect.phones) {
    // grob deutsch/eu, bewusst breit:
    replaceAll(
      /(\+?\d{1,3}[\s/-]?)?(\(?0\d{2,4}\)?[\s/-]?)\d{2,}([\s/-]?\d{2,})+/g,
      "PHONE",
      (_m, i) => (mode === "BLOCK" ? "█████" : `[PHONE_${i}]`)
    );
  }

  if (options.detect.iban) {
    replaceAll(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, "IBAN", (_m, i) =>
      mode === "BLOCK" ? "████████" : `[IBAN_${i}]`
    );
  }

  if (options.detect.vehicles) {
    // deutsches Kennzeichen grob: B-AB 1234 / HH AB 123
    replaceAll(/\b[A-ZÄÖÜ]{1,3}[\s-]?[A-Z]{1,2}[\s-]?\d{1,4}\b/g, "VEHICLE", (_m, i) =>
      mode === "BLOCK" ? "████" : `[VEHICLE_${i}]`
    );
  }

  if (options.detect.ids) {
    // Aktenzeichen/IDs (grob): "Az. 12 Ds 34/25" / "ID: 12345"
    replaceAll(
      /\b(Az\.?|AZ\.?|Aktenzeichen|ID|Vorgang)\s*[:#]?\s*[A-Z0-9./ -]{4,}\b/gi,
      "ID",
      (_m, i) => (mode === "BLOCK" ? "████████" : `[ID_${i}]`)
    );
  }

  warnings.push("Lokaler Modus: Personennamen/Adressen werden hier NICHT zuverlässig erkannt.");

  return {
    sourceText: text,
    washedText: washed,
    entities,
    warnings,
    confidence: 0.35
  };
}
