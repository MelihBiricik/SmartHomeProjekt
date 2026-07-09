// ============================================================
//  seed.js – Fuellt die Datenbank mit realistischen Testdaten
//  Aufruf:  npm run seed
//  Idempotent: kann beliebig oft laufen – legt nur an, was fehlt
//  (INSERT IGNORE fuer Raeume/Sensoren, Messwerte nur fuer
//   Sensoren, die noch KEINE Messwerte haben).
// ============================================================
require("dotenv").config();
const mysql = require("mysql2/promise");

// Raeume wie in der Team-Datenbank (RaumID = Position + 1)
const RAEUME = ["Bad", "Küche", "Kinderzimmer", "Wohnzimmer", "Schlafzimmer"];

// Wie im echten Aufbau: (bisher) 3 physische Sensoren
// → Wohnzimmer und Schlafzimmer erscheinen als "Keine Daten"-Kachel
const SENSOREN = [
  { SensorID: 1, RaumID: 1 }, // Bad
  { SensorID: 2, RaumID: 2 }, // Küche
  { SensorID: 3, RaumID: 3 }, // Kinderzimmer
];

// Basiswerte pro Raum: [Temperatur °C, Luftfeuchtigkeit %, Luftdruck hPa]
// (kleiner Luftdruck-Versatz pro Raum, damit im Demo-Diagramm alle Sensoren sichtbar sind)
const PROFIL = {
  Bad: [23.5, 65, 1013],
  Küche: [22.5, 50, 1014],
  Kinderzimmer: [21.0, 48, 1012],
  Wohnzimmer: [21.5, 45, 1012],
  Schlafzimmer: [19.0, 50, 1011],
};

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "SmartHomeDB2",
  });

  // Raeume anlegen – pro Raum, nicht "alles oder nichts".
  // (Vorher: wenn IRGENDEIN Raum existierte, wurde ALLES uebersprungen –
  //  fehlende Raeume/Sensoren wurden so nie ergaenzt.)
  let neueRaeume = 0;
  for (let i = 0; i < RAEUME.length; i++) {
    const [r] = await conn.query(
      "INSERT IGNORE INTO Raum (RaumID, Name) VALUES (?, ?);",
      [i + 1, RAEUME[i]]
    );
    neueRaeume += r.affectedRows;
  }

  // Sensoren anlegen (nur die, die fehlen)
  let neueSensoren = 0;
  for (const s of SENSOREN) {
    const [r] = await conn.query(
      "INSERT IGNORE INTO Sensor (SensorID, Typ, RaumID) VALUES (?, 'BME280', ?);",
      [s.SensorID, s.RaumID]
    );
    neueSensoren += r.affectedRows;
  }
  console.log(`Räume: ${neueRaeume} neu angelegt · Sensoren: ${neueSensoren} neu angelegt.`);

  // Messwerte fuer die letzten 7 Tage, alle 15 Minuten –
  // aber nur fuer Sensoren, die noch KEINE Messwerte haben
  const [sensoren] = await conn.query(`
    SELECT s.SensorID, r.Name
    FROM Sensor s
    JOIN Raum r ON r.RaumID = s.RaumID
    WHERE NOT EXISTS (SELECT 1 FROM Messwerte m WHERE m.SensorID = s.SensorID);
  `);
  if (sensoren.length === 0) {
    console.log("Alle Sensoren haben bereits Messwerte – fertig.");
    await conn.end();
    return;
  }

  const jetzt = Date.now();
  const start = jetzt - 7 * 24 * 60 * 60 * 1000;
  const schritt = 15 * 60 * 1000;
  let anzahl = 0;
  const werte = [];

  for (const s of sensoren) {
    const [tBase, fBase, dBase] = PROFIL[s.Name] || [20, 50, 1013];
    for (let t = start; t <= jetzt; t += schritt) {
      const d = new Date(t);
      const stunde = d.getHours() + d.getMinutes() / 60;
      // Tagesgang: mittags waermer, nachts kuehler
      const tagesgang = Math.sin(((stunde - 6) / 24) * 2 * Math.PI);
      const temp = tBase + tagesgang * 2.5 + (Math.random() - 0.5) * 0.8;
      const feuchte = fBase - tagesgang * 5 + (Math.random() - 0.5) * 4;
      const druck = dBase + Math.sin(t / 8.64e7) * 6 + (Math.random() - 0.5) * 1.5;
      werte.push([d, temp.toFixed(2), feuchte.toFixed(2), druck.toFixed(2), s.SensorID]);
      anzahl++;
    }
  }

  // In Bloecken einfuegen
  const block = 500;
  for (let i = 0; i < werte.length; i += block) {
    await conn.query(
      "INSERT INTO Messwerte (Zeitpunkt, Temperatur, Luftfeuchtigkeit, Luftdruck, SensorID) VALUES ?",
      [werte.slice(i, i + block)]
    );
  }

  console.log(
    `${anzahl} Messwerte für ${sensoren.length} Sensor(en) eingefügt (7 Tage, 15-Minuten-Takt).`
  );
  await conn.end();
}

main().catch((err) => {
  console.error("Seed-Fehler:", err.message);
  process.exit(1);
});
