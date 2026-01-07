export type RedactionMode = "BLOCK" | "PLACEHOLDER";

export type WashOptions = {
  mode: RedactionMode;
  detect: {
    persons: boolean;
    addresses: boolean;
    phones: boolean;
    emails: boolean;
    iban: boolean;
    vehicles: boolean;
    ids: boolean;
  };
};

export type WashResult = {
  sourceText: string; // OCR-Text oder Input
  washedText: string; // anonymisiert
  entities: Array<{
    type: string;
    original: string;
    replacement: string;
    note?: string;
  }>;
  warnings: string[];
  confidence: number; // 0..1
};

const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

function stripCodeFences(s: string) {
  return s.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
}

export async function washTextWithGemini(params: {
  apiKey: string;
  model?: string; // e.g. "gemini-2.5-flash"
  text: string;
  options: WashOptions;
}): Promise<WashResult> {
  const model = params.model ?? "gemini-2.5-flash";

  const schema = {
    type: "object",
    properties: {
      sourceText: { type: "string" },
      washedText: { type: "string" },
      entities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            original: { type: "string" },
            replacement: { type: "string" },
            note: { type: "string" }
          },
          required: ["type", "original", "replacement"]
        }
      },
      warnings: { type: "array", items: { type: "string" } },
      confidence: { type: "number" }
    },
    required: ["sourceText", "washedText", "entities", "warnings", "confidence"]
  } as const;

  const systemInstruction = `
Du bist "Akten-Waschmaschine", ein deutsches Datenschutz-Tool im Preview-Modus.
Aufgabe: (1) erkenne sensible personenbezogene Daten in deutschem Text (2) ersetze sie gemäß Modus.
Wichtig: Keine Halluzinationen – nur ersetzen, was im Text wirklich steht.
Gib JSON exakt nach Schema zurück.

Modus:
- BLOCK: ersetze mit █████ (gleiche Kategorie gleiches Symbol ok)
- PLACEHOLDER: ersetze konsistent z.B. [PERSON_1], [ADDR_1], [IBAN_1] ...

Kategorien (je nach Optionen):
PERSON, ADDRESS, PHONE, EMAIL, IBAN, VEHICLE, ID, BIRTHDATE, OTHER

Außerdem: erstelle "warnings" für indirekte Identifizierer (seltene Rollen, sehr spezifische Orte/Details).
Confidence 0..1: Wie sicher du bist, dass die Maskierung vollständig ist.
`.trim();

  const prompt = `
Optionen:
${JSON.stringify(params.options, null, 2)}

Text:
${params.text}
`.trim();

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.1
    }
  };

  const res = await fetch(ENDPOINT(model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": params.apiKey
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API Fehler (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Keine Antwort von Gemini erhalten.");

  const parsed = JSON.parse(stripCodeFences(text));
  return parsed as WashResult;
}

export async function washImageWithGemini(params: {
  apiKey: string;
  model?: string;
  file: File; // image/*
  options: WashOptions;
}): Promise<WashResult> {
  const model = params.model ?? "gemini-2.5-flash";

  const base64 = await fileToBase64(params.file);

  const schema = {
    type: "object",
    properties: {
      sourceText: { type: "string" },
      washedText: { type: "string" },
      entities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            original: { type: "string" },
            replacement: { type: "string" },
            note: { type: "string" }
          },
          required: ["type", "original", "replacement"]
        }
      },
      warnings: { type: "array", items: { type: "string" } },
      confidence: { type: "number" }
    },
    required: ["sourceText", "washedText", "entities", "warnings", "confidence"]
  } as const;

  const systemInstruction = `
Du bist "Akten-Waschmaschine", ein deutsches Datenschutz-Tool im Preview-Modus.
1) Lies den Text im Bild (OCR).
2) Erzeuge daraus sourceText.
3) Maskiere sensible Daten gemäß Optionen und Modus.
Nur ersetzen, was du im sourceText wirklich siehst. Keine Ergänzungen.
Gib JSON exakt nach Schema zurück.
`.trim();

  const prompt = `
Optionen:
${JSON.stringify(params.options, null, 2)}

Aufgabe: OCR + Maskierung aus dem Bild.
`.trim();

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{
      role: "user",
      parts: [
        {
          inline_data: {
            mime_type: params.file.type || "image/jpeg",
            data: base64
          }
        },
        { text: prompt }
      ]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.1
    }
  };

  const res = await fetch(ENDPOINT(model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": params.apiKey
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API Fehler (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Keine Antwort von Gemini erhalten.");

  const parsed = JSON.parse(stripCodeFences(text));
  return parsed as WashResult;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
