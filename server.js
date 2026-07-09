// ============================================================
//  ITSol SmartHome – Webserver
//  Verbindet sich mit der lokalen MySQL-Datenbank "SmartHomeDB2"
//  und stellt die Messdaten als JSON-API fuer das Dashboard bereit.
// ============================================================
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Datenbank-Verbindung (Pool) ----------
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "SmartHomeDB2",
  waitForConnections: true,
  connectionLimit: 10,
  // Zeitzone wie beim Seeden (lokale Zeit des Servers) → konsistente Anzeige
  timezone: "local",
});

// ---------- Statische Dateien (Frontend) ----------
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Kleiner Helfer: Fehler einheitlich zurueckgeben
function dbError(res, err) {
  console.error("DB-Fehler:", err.message);
  res.status(500).json({
    error: "Datenbank nicht erreichbar",
    details: err.code || err.message,
  });
}

// ============================================================
//  API-Endpunkte
// ============================================================

// Alle Raeume inkl. Anzahl der Sensoren
app.get("/api/raeume", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.RaumID, r.Name, COUNT(s.SensorID) AS AnzahlSensoren
      FROM Raum r
      LEFT JOIN Sensor s ON s.RaumID = r.RaumID
      GROUP BY r.RaumID, r.Name
      ORDER BY r.Name;
    `);
    res.json(rows);
  } catch (err) {
    dbError(res, err);
  }
});

// Alle Sensoren mit Raumnamen
app.get("/api/sensoren", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.SensorID, s.Typ, s.RaumID, r.Name AS RaumName
      FROM Sensor s
      LEFT JOIN Raum r ON r.RaumID = s.RaumID
      ORDER BY r.Name, s.SensorID;
    `);
    res.json(rows);
  } catch (err) {
    dbError(res, err);
  }
});

// Aktuellster Messwert pro Raum bzw. Sensor (fuer die Kachel-Uebersicht).
// WICHTIG: Die Abfrage geht vom RAUM aus (LEFT JOIN), damit auch Raeume
// OHNE Sensor oder ohne Messwerte als Kachel erscheinen ("Keine Daten").
// Vorher (INNER JOIN ab Messwerte) fielen solche Raeume komplett weg –
// deshalb waren nur 3 von 5 Raeumen sichtbar.
app.get("/api/messwerte/aktuell", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.RaumID, r.Name AS RaumName, s.SensorID, s.Typ,
             m.Zeitpunkt, m.Temperatur, m.Luftfeuchtigkeit, m.Luftdruck,
             0 AS OhneRaum
      FROM Raum r
      LEFT JOIN Sensor s ON s.RaumID = r.RaumID
      LEFT JOIN Messwerte m ON m.MesswerteID = (
        SELECT m2.MesswerteID FROM Messwerte m2
        WHERE m2.SensorID = s.SensorID
        ORDER BY m2.Zeitpunkt DESC, m2.MesswerteID DESC
        LIMIT 1
      )

      UNION ALL

      -- Sensoren ohne Raum-Zuordnung (RaumID NULL) trotzdem anzeigen
      SELECT NULL AS RaumID, NULL AS RaumName, s.SensorID, s.Typ,
             m.Zeitpunkt, m.Temperatur, m.Luftfeuchtigkeit, m.Luftdruck,
             1 AS OhneRaum
      FROM Sensor s
      LEFT JOIN Messwerte m ON m.MesswerteID = (
        SELECT m2.MesswerteID FROM Messwerte m2
        WHERE m2.SensorID = s.SensorID
        ORDER BY m2.Zeitpunkt DESC, m2.MesswerteID DESC
        LIMIT 1
      )
      WHERE s.RaumID IS NULL

      ORDER BY OhneRaum, RaumName;
    `);
    res.json(rows);
  } catch (err) {
    dbError(res, err);
  }
});

// Live-Verlauf: ROHE Messwerte (KEINE Mittelung/kein Downsampling) fuer ein
// kurzes, aktuelles Zeitfenster – so wird JEDER einzelne Messpunkt gezeichnet.
// Fuer die Live-Seite gedacht (kurze Fenster, haeufige Abfrage).
// /api/messwerte/live?minuten=60&raumId=1
app.get("/api/messwerte/live", async (req, res) => {
  const raumId = parseInt(req.query.raumId, 10);
  // Fenster: 5 Minuten bis 24 Stunden (Standard 60 Min)
  const minuten = Math.min(Math.max(parseInt(req.query.minuten, 10) || 60, 5), 24 * 60);
  // Sicherheitsnetz gegen riesige Antworten (z. B. viele Sensoren)
  const limit = Math.min(parseInt(req.query.limit, 10) || 3000, 10000);

  let sql = `
    SELECT m.Zeitpunkt,
           m.Temperatur, m.Luftfeuchtigkeit, m.Luftdruck,
           r.RaumID, r.Name AS RaumName, s.SensorID
    FROM Messwerte m
    JOIN Sensor s ON s.SensorID = m.SensorID
    LEFT JOIN Raum r ON r.RaumID = s.RaumID
    WHERE m.Zeitpunkt >= NOW() - INTERVAL ? MINUTE
  `;
  const params = [minuten];

  if (!isNaN(raumId)) {
    sql += " AND s.RaumID = ? ";
    params.push(raumId);
  }
  // Neueste zuerst holen (LIMIT greift auf die aktuellsten), Frontend sortiert
  // je Raum ohnehin nach Zeit.
  sql += " ORDER BY m.Zeitpunkt DESC LIMIT ?;";
  params.push(limit);

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    dbError(res, err);
  }
});

// Messwert-Verlauf, optional gefiltert nach Raum + Zeitraum
// /api/messwerte?raumId=1&stunden=24&limit=500
// Die Werte werden serverseitig pro Zeit-Bucket gemittelt (Downsampling).
// Vorher schnitt "ORDER BY ASC LIMIT n" bei langen Zeitraeumen die
// NEUESTEN Messwerte ab (z. B. 7 Tage × 5 Sensoren = 3360 Zeilen > 3000).
app.get("/api/messwerte", async (req, res) => {
  const raumId = parseInt(req.query.raumId, 10);
  const stunden = Math.min(parseInt(req.query.stunden, 10) || 24, 24 * 90);
  const limit = Math.min(parseInt(req.query.limit, 10) || 1000, 5000);

  // Bucket-Groesse (Sekunden): hoechstens ~400 Punkte pro Raum,
  // mindestens 15 Minuten (= Messintervall der Sensoren)
  const bucket = Math.max(900, Math.ceil((stunden * 3600) / 400 / 900) * 900);

  // Hinweis: In GROUP BY loest MySQL "Zeitpunkt" zur TABELLEN-Spalte auf
  // (nicht zum Alias) – deshalb wird hier explizit nach dem
  // Bucket-AUSDRUCK gruppiert und der Zeitstempel als AVG berechnet.
  let sql = `
    SELECT FROM_UNIXTIME(AVG(UNIX_TIMESTAMP(m.Zeitpunkt))) AS Zeitpunkt,
           AVG(m.Temperatur) AS Temperatur,
           AVG(m.Luftfeuchtigkeit) AS Luftfeuchtigkeit,
           AVG(m.Luftdruck) AS Luftdruck,
           r.RaumID, r.Name AS RaumName
    FROM Messwerte m
    JOIN Sensor s ON s.SensorID = m.SensorID
    LEFT JOIN Raum r ON r.RaumID = s.RaumID
    WHERE m.Zeitpunkt >= NOW() - INTERVAL ? HOUR
  `;
  const params = [stunden];

  if (!isNaN(raumId)) {
    sql += " AND s.RaumID = ? ";
    params.push(raumId);
  }
  sql += `
    GROUP BY r.RaumID, r.Name, FLOOR(UNIX_TIMESTAMP(m.Zeitpunkt) / ?)
    ORDER BY Zeitpunkt ASC
    LIMIT ?;`;
  params.push(bucket, limit);

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    dbError(res, err);
  }
});

// Statistik (Min / Max / Durchschnitt) fuer einen Raum oder alle
app.get("/api/statistik", async (req, res) => {
  const raumId = parseInt(req.query.raumId, 10);
  const stunden = Math.min(parseInt(req.query.stunden, 10) || 24, 24 * 90);

  let sql = `
    SELECT
      MIN(m.Temperatur)  AS TempMin,  MAX(m.Temperatur)  AS TempMax,  AVG(m.Temperatur)  AS TempAvg,
      MIN(m.Luftfeuchtigkeit) AS FeuchteMin, MAX(m.Luftfeuchtigkeit) AS FeuchteMax, AVG(m.Luftfeuchtigkeit) AS FeuchteAvg,
      MIN(m.Luftdruck) AS DruckMin, MAX(m.Luftdruck) AS DruckMax, AVG(m.Luftdruck) AS DruckAvg,
      COUNT(*) AS Anzahl
    FROM Messwerte m
    JOIN Sensor s ON s.SensorID = m.SensorID
    WHERE m.Zeitpunkt >= NOW() - INTERVAL ? HOUR
  `;
  const params = [stunden];
  if (!isNaN(raumId)) {
    sql += " AND s.RaumID = ? ";
    params.push(raumId);
  }

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows[0]);
  } catch (err) {
    dbError(res, err);
  }
});

// Gesundheits-Check (zeigt im Frontend, ob die DB erreichbar ist)
app.get("/api/status", async (req, res) => {
  try {
    await pool.query("SELECT 1;");
    res.json({ db: "ok" });
  } catch (err) {
    res.status(500).json({ db: "offline", details: err.code || err.message });
  }
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log("============================================");
  console.log(`  ITSol SmartHome laeuft auf http://localhost:${PORT}`);
  console.log("  Datenbank: " + (process.env.DB_NAME || "SmartHomeDB2"));
  console.log("============================================");
});
