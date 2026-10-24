# Spieleblock

Ein digitaler Spieleblock zum Punkte zählen – als statische Seite für GitHub Pages.
Alle Spielstände werden nur lokal im Browser (`localStorage`) gespeichert.

## Spiele

- **Wizard** (`/wizard/`): 3–6 Spieler, Ansagen und Stiche pro Runde eintragen,
  Punkte werden automatisch berechnet (Treffer: 20 + 10 pro Stich, daneben: −10 pro Stich Abweichung).
  Optional: „Ansagen dürfen nicht aufgehen“.

## Veröffentlichen

In den Repository-Einstellungen unter **Settings → Pages** als Quelle
„Deploy from a branch“ wählen, den Branch und den Ordner `/ (root)` auswählen.

## Lokal starten

```sh
python3 -m http.server
```

und dann <http://localhost:8000> öffnen.
