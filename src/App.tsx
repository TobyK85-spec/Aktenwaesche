import React, { useMemo, useState } from "react";
import {
  washImageWithGemini,
  washTextWithGemini,
  type WashOptions,
  type WashResult
} from "./lib/gemini";
import { washLocally } from "./lib/regexFallback";

const DEFAULT_OPTIONS: WashOptions = {
  mode: "PLACEHOLDER",
  detect: {
    persons: true,
    addresses: true,
    phones: true,
    emails: true,
    iban: true,
    vehicles: true,
    ids: true
  }
};

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem("aktenwash_apiKey") ?? "");
  const [model, setModel] = useState(localStorage.getItem("aktenwash_model") ?? "gemini-2.5-flash");
  const [text, setText] = useState("");
  const [options, setOptions] = useState<WashOptions>(DEFAULT_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WashResult | null>(null);
  const [localOnly, setLocalOnly] = useState(false);

  const canUseGemini = useMemo(() => !localOnly && apiKey.trim().length > 10, [apiKey, localOnly]);

  const persistKey = (v: string) => {
    setApiKey(v);
    localStorage.setItem("aktenwash_apiKey", v);
  };
  const persistModel = (v: string) => {
    setModel(v);
    localStorage.setItem("aktenwash_model", v);
  };

  async function onWashText() {
    setError(null);
    setBusy(true);
    try {
      if (localOnly) {
        setResult(washLocally(text, options));
      } else {
        if (!apiKey) throw new Error("API-Key fehlt (oder Local-Modus aktivieren).");
        const r = await washTextWithGemini({ apiKey, model, text, options });
        setResult(r);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onPickImage(file: File) {
    setError(null);
    setBusy(true);
    try {
      if (localOnly) throw new Error("Bilder-OCR geht nur mit Gemini (Local-Modus kann das nicht).");
      if (!apiKey) throw new Error("API-Key fehlt.");
      const r = await washImageWithGemini({ apiKey, model, file, options });
      setResult(r);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <header className="header">
        <div>
          <h1>Akten-Waschmaschine</h1>
          <p className="sub">
            Mobile Anonymisierung im <b>Preview-Modus</b>. KI ist schlau. Aber sie haftet nicht. 😉
          </p>
        </div>
      </header>

      <section className="card">
        <h2>Modus</h2>

        <label className="row">
          <input
            type="checkbox"
            checked={localOnly}
            onChange={(e) => {
              setLocalOnly(e.target.checked);
              setResult(null);
            }}
          />
          <span>
            <b>Local-Only</b> (kein Upload, nur Regex-Maskierung für Email/Telefon/IBAN/etc.)
          </span>
        </label>

        <div className="grid2">
          <div>
            <label className="label">Gemini API-Key (bleibt lokal im Browser gespeichert)</label>
            <input
              className="input"
              placeholder="AIza…"
              value={apiKey}
              onChange={(e) => persistKey(e.target.value)}
              disabled={localOnly}
            />
          </div>

          <div>
            <label className="label">Model</label>
            <input
              className="input"
              value={model}
              onChange={(e) => persistModel(e.target.value)}
              disabled={localOnly}
            />
            <small className="hint">Tipp: gemini-2.5-flash ist meist schnell & günstig.</small>
          </div>
        </div>

        <div className="grid2">
          <div>
            <label className="label">Redaction-Style</label>
            <select
              className="input"
              value={options.mode}
              onChange={(e) => setOptions((o) => ({ ...o, mode: e.target.value as any }))}
            >
              <option value="PLACEHOLDER">PLACEHOLDER ([PERSON_1] …)</option>
              <option value="BLOCK">BLOCK (█████)</option>
            </select>
          </div>

          <div className="pillbox">
            {Object.entries(options.detect).map(([k, v]) => (
              <label key={k} className="pill">
                <input
                  type="checkbox"
                  checked={v}
                  onChange={(e) =>
                    setOptions((o) => ({
                      ...o,
                      detect: { ...o.detect, [k]: e.target.checked }
                    }))
                  }
                />
                <span>{k}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Input</h2>

        <div className="actions">
          <label className={`btn ${(!canUseGemini && !localOnly) ? "btnDisabled" : ""}`}>
            📷 Bild aufnehmen / auswählen
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickImage(f);
                e.currentTarget.value = "";
              }}
              disabled={busy || localOnly || !apiKey}
              style={{ display: "none" }}
            />
          </label>

          <button className="btn" onClick={onWashText} disabled={busy || text.trim().length === 0}>
            🧼 Text waschen
          </button>

          <button
            className="btn ghost"
            onClick={() => {
              setText("");
              setResult(null);
              setError(null);
            }}
            disabled={busy}
          >
            Reset
          </button>
        </div>

        <textarea
          className="textarea"
          placeholder="Text hier rein (oder Bild über Kamera)…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {error && <div className="error">⚠️ {error}</div>}
        {busy && <div className="info">⏳ Waschgang läuft…</div>}
      </section>

      {result && (
        <section className="card">
          <h2>Ergebnis</h2>

          <div className="grid2">
            <div>
              <div className="labelRow">
                <span className="label">sourceText</span>
                <button className="mini" onClick={() => navigator.clipboard.writeText(result.sourceText)}>
                  Copy
                </button>
              </div>
              <pre className="pre">{result.sourceText}</pre>
            </div>

            <div>
              <div className="labelRow">
                <span className="label">washedText</span>
                <button className="mini" onClick={() => navigator.clipboard.writeText(result.washedText)}>
                  Copy
                </button>
              </div>
              <pre className="pre">{result.washedText}</pre>
            </div>
          </div>

          <div className="actions">
            <button className="btn" onClick={() => downloadText("aktenwash.txt", result.washedText)}>
              ⬇️ .txt
            </button>
            <button className="btn ghost" onClick={() => downloadJson("aktenwash.json", result)}>
              ⬇️ .json
            </button>
            <div className="meta">
              Confidence: <b>{Math.round(result.confidence * 100)}%</b>
            </div>
          </div>

          <details className="details">
            <summary>Gefundene Entities ({result.entities.length})</summary>
            <ul>
              {result.entities.slice(0, 200).map((e, i) => (
                <li key={i}>
                  <b>{e.type}</b>: <code>{e.original}</code> → <code>{e.replacement}</code>
                  {e.note ? <span className="muted"> ({e.note})</span> : null}
                </li>
              ))}
            </ul>
            {result.entities.length > 200 && <div className="muted">… gekürzt …</div>}
          </details>

          <details className="details">
            <summary>Warnings ({result.warnings.length})</summary>
            <ul>
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        </section>
      )}

      <footer className="footer">
        <p className="muted">
          Installieren: im mobilen Browser Menü → <b>„Zum Startbildschirm hinzufügen“</b>.
        </p>
      </footer>
    </div>
  );
}
