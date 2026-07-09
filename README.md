# ITSol SmartHome – Website mit WebShop & Live-Dashboard

Azubi-Projekt „SmartHome" (LS-SmartHome, it.schule stuttgart).
Website in Deutsch, Farbthema **#026773 / #024959**, Preise in Euro, Datum/Uhrzeit im deutschen Format.

## Struktur

```
smarthome-web/
├── server.js            Express-Server + MySQL-API
├── seed.js              Testdaten-Generator (7 Tage Messwerte)
├── .env.example         Vorlage für die DB-Zugangsdaten
├── package.json
└── public/
    ├── index.html       Startseite
    ├── shop.html        WebShop (Produktreihe SmartHome)
    ├── dashboard.html   Live-Dashboard (MiniChart, ohne CDN)
    ├── css/style.css
    └── js/              common.js · shop.js · dashboard.js · minichart.js
```

## Voraussetzungen

- Node.js (Version 18 oder neuer)
- MySQL-Server mit der Datenbank aus `smartHomeNeue.sql` (SmartHomeDB2)

## Installation

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Zugangsdaten einrichten
#    .env.example zu .env kopieren und DB_USER / DB_PASSWORD eintragen
cp .env.example .env        # Windows: copy .env.example .env

# 3. (Optional) Testdaten einspielen – 5 Räume (Bad, Küche, Kinderzimmer,
#    Wohnzimmer, Schlafzimmer), 3 Sensoren, 7 Tage Messwerte.
#    Idempotent: legt nur an, was fehlt – kann beliebig oft laufen.
npm run seed

# 4. Server starten
npm start
```

Danach im Browser öffnen: **http://localhost:3000**

## API-Endpunkte (für das Dashboard)

| Endpunkt                     | Beschreibung                                  |
| ---------------------------- | --------------------------------------------- |
| `/api/raeume`                | Alle Räume mit Sensor-Anzahl                  |
| `/api/sensoren`              | Alle Sensoren mit Raumnamen                   |
| `/api/messwerte/aktuell`     | Neuester Messwert pro Raum/Sensor (Räume ohne Daten inklusive) |
| `/api/messwerte?raumId=&stunden=` | Verlauf (serverseitig gemittelt), nach Raum & Zeitraum |
| `/api/statistik?raumId=&stunden=` | Min / Max / Durchschnitt                |
| `/api/status`                | Prüft die Datenbank-Verbindung                |

## Hinweise

- Die Diagramme nutzen einen **eigenen, leichtgewichtigen SVG-Renderer**
  (`js/minichart.js`) – **keine externe Chart-Bibliothek/kein CDN nötig**,
  das Dashboard funktioniert also auch ohne Internet.
- Läuft der SmartHomeServer (C#) parallel und schreibt echte Sensordaten in
  `SmartHomeDB2`, erscheinen diese automatisch im Dashboard
  (Aktualisierung alle 30 Sekunden).
- Der Warenkorb im WebShop ist eine Demo (localStorage) – eine echte
  Bestellabwicklung ist laut Projektbeschreibung optional.
