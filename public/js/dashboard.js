// ============================================================
//  dashboard.js – Lädt Messwerte aus der API (MySQL: SmartHomeDB2)
//  und zeichnet Kacheln, Statistiken und Diagramme (MiniChart,
//  ohne externe Bibliothek → offline-fähig).
// ============================================================

// Raum-Farben aus der Petrol-Palette abgeleitet
const RAUM_FARBEN = ["#026773", "#e8a33d", "#024959", "#5aa9b2", "#c0708a", "#6b8f95", "#3d7d86"];

let refreshTimer = null;
const $ = (id) => document.getElementById(id);
const de = (n, stellen = 1) =>
  Number(n).toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
// HTML-Sonderzeichen entschaerfen (Raumnamen kommen aus der DB → kein rohes HTML einfuegen)
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- Status-Anzeige ----------
function setzeStatus(ok) {
  const pille = $("dbStatus");
  if (ok) {
    pille.className = "status-pille ok";
    pille.innerHTML = "● Datenbank verbunden";
    $("fehlerbox").hidden = true;
  } else {
    pille.className = "status-pille fehler";
    pille.innerHTML = "● Datenbank offline";
    $("fehlerbox").hidden = false;
  }
}

// ---------- Räume in den Filter laden ----------
async function ladeRaeume() {
  const res = await fetch("/api/raeume");
  if (!res.ok) throw new Error("DB offline");
  const raeume = await res.json();
  const filter = $("raumFilter");
  [...filter.querySelectorAll("option")].slice(1).forEach((o) => o.remove());
  raeume.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r.RaumID;
    opt.textContent = r.Name;
    filter.appendChild(opt);
  });
}

// ---------- Aktuelle Werte als Kacheln ----------
async function ladeKacheln() {
  const res = await fetch("/api/messwerte/aktuell");
  if (!res.ok) throw new Error("DB offline");
  const daten = await res.json();
  const raumId = $("raumFilter").value;
  const gefiltert = raumId ? daten.filter((d) => String(d.RaumID) === raumId) : daten;

  $("kachelRaster").innerHTML = gefiltert.map((d) => {
    // Raum ohne Sensor oder ohne Messwerte → graue "Keine Daten"-Kachel
    if (!d.Zeitpunkt) {
      return `
    <div class="kachel kachel-leer">
      <div class="raum"><span class="puls" style="background: var(--text-gedimmt); animation: none;"></span> ${esc(d.RaumName) || "Ohne Raum"}</div>
      <div class="zeit">${d.SensorID ? `Sensor ${esc(d.SensorID)} – noch keine Messwerte` : "Kein Sensor zugeordnet"}</div>
      <div class="werte"><div class="wert">–<small>Keine Daten</small></div></div>
    </div>`;
    }
    return `
    <div class="kachel">
      <div class="raum"><span class="puls" style="background: var(--gruen);"></span> ${esc(d.RaumName) || "Ohne Raum"}</div>
      <div class="zeit">${new Date(d.Zeitpunkt).toLocaleString("de-DE", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })} Uhr</div>
      <div class="werte">
        <div class="wert">${de(d.Temperatur)} °C<small>Temperatur</small></div>
        <div class="wert">${de(d.Luftfeuchtigkeit, 0)} %<small>Feuchte</small></div>
        <div class="wert">${de(d.Luftdruck, 0)} hPa<small>Druck</small></div>
      </div>
    </div>`;
  }).join("") || '<p style="color: var(--text-gedimmt);">Noch keine Messwerte in der Datenbank.</p>';
}

// ---------- Statistik ----------
async function ladeStatistik() {
  const raumId = $("raumFilter").value;
  const stunden = $("zeitFilter").value;
  const res = await fetch(`/api/statistik?stunden=${stunden}${raumId ? "&raumId=" + raumId : ""}`);
  if (!res.ok) throw new Error("DB offline");
  const s = await res.json();
  if (!s || !s.Anzahl) { $("statistikZeile").innerHTML = ""; return; }

  $("statistikZeile").innerHTML = `
    <div class="stat">Temperatur&nbsp; Min <b>${de(s.TempMin)}</b> · Ø <b>${de(s.TempAvg)}</b> · Max <b>${de(s.TempMax)}</b> °C</div>
    <div class="stat">Feuchte&nbsp; Min <b>${de(s.FeuchteMin, 0)}</b> · Ø <b>${de(s.FeuchteAvg, 0)}</b> · Max <b>${de(s.FeuchteMax, 0)}</b> %</div>
    <div class="stat">Druck&nbsp; Min <b>${de(s.DruckMin, 0)}</b> · Ø <b>${de(s.DruckAvg, 0)}</b> · Max <b>${de(s.DruckMax, 0)}</b> hPa</div>
    <div class="stat"><b>${Number(s.Anzahl).toLocaleString("de-DE")}</b> Messwerte im Zeitraum</div>
  `;
}

// ---------- Diagramme (MiniChart) ----------
let letzteDiagrammDaten = null;

function baueDatasets(daten, feld) {
  const gruppen = {};
  daten.forEach((d) => {
    const raum = d.RaumName || "Ohne Raum";
    (gruppen[raum] ||= []).push({ x: new Date(d.Zeitpunkt).getTime(), y: Number(d[feld]) });
  });
  // Alphabetisch sortieren → ein Raum behaelt seine Farbe, egal wie gefiltert wird
  return Object.entries(gruppen)
    .sort((a, b) => a[0].localeCompare(b[0], "de"))
    .map(([raum, points], i) => ({
      label: raum, color: RAUM_FARBEN[i % RAUM_FARBEN.length], points,
    }));
}

function zeichneDiagramme(daten) {
  const tempSets = baueDatasets(daten, "Temperatur");
  MiniChart.legende($("legendeTemp"), tempSets);
  MiniChart.zeichne($("chartTemp"), tempSets, { einheit: "°C", yStellen: 1, titel: "Temperatur" });
  MiniChart.zeichne($("chartFeuchte"), baueDatasets(daten, "Luftfeuchtigkeit"), { einheit: "%", yStellen: 0, titel: "Luftfeuchtigkeit" });
  MiniChart.zeichne($("chartDruck"), baueDatasets(daten, "Luftdruck"), { einheit: "hPa", yStellen: 0, titel: "Luftdruck" });
}

async function ladeDiagramme() {
  const raumId = $("raumFilter").value;
  const stunden = $("zeitFilter").value;
  const res = await fetch(`/api/messwerte?stunden=${stunden}&limit=3000${raumId ? "&raumId=" + raumId : ""}`);
  if (!res.ok) throw new Error("DB offline");
  letzteDiagrammDaten = await res.json();
  zeichneDiagramme(letzteDiagrammDaten);
}

// ---------- Alles laden ----------
async function alleDatenLaden() {
  try {
    // Falls der Raum-Filter noch leer ist (DB war beim Laden offline) → nachladen
    if ($("raumFilter").options.length <= 1) await ladeRaeume();
    await Promise.all([ladeKacheln(), ladeStatistik(), ladeDiagramme()]);
    setzeStatus(true);
  } catch (err) {
    console.warn("Datenabruf fehlgeschlagen:", err.message);
    setzeStatus(false);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try { await ladeRaeume(); } catch { /* Status wird in alleDatenLaden gesetzt */ }
  await alleDatenLaden();

  $("raumFilter").addEventListener("change", alleDatenLaden);
  $("zeitFilter").addEventListener("change", alleDatenLaden);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (letzteDiagrammDaten) zeichneDiagramme(letzteDiagrammDaten); }, 200);
  });

  refreshTimer = setInterval(alleDatenLaden, 30000);
});
