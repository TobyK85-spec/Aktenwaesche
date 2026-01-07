# Akten-Waschmaschine (PWA)

Installierbare Web-App (Android/Pixel): Text oder Foto rein → „gewaschener“ Text raus.
**Preview-Modus**: Ergebnis immer prüfen.

## Voraussetzungen
- Node.js >= 18
- Ein Gemini API-Key (für OCR + KI-Waschen). Optional: Local-Only Modus ohne Upload.

## Start (lokal)
```bash
npm install
npm run dev
```
Dann im Handy-Browser die angezeigte URL öffnen (am einfachsten über LAN-URL im Terminal).

## Build (für Deployment/Installation)
```bash
npm run build
npm run preview
```
Für echte Installation brauchst du HTTPS (z.B. Netlify/Vercel/Cloudflare Pages).

## Installation auf Android
Chrome/Edge → Menü → **Zum Startbildschirm hinzufügen**.
