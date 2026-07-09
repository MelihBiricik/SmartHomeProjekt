// ============================================================
//  live.js – Live-Überwachung (Echtzeit-Ansicht)
//  Fragt alle 5 Sekunden die API ab:
//    • /api/messwerte/aktuell     → große Kacheln mit dem letzten Wert je Raum
//    • /api/messwerte/live        → ROHE Messwerte (jeder Messpunkt einzeln)
//  Diagramm über MiniChart (SVG, ohne externe Bibliothek → offline-fähig).
// ============================================================

const INTERVALL_MS = 5000; // Seiten-Aktualisierung (unabhängig vom Messintervall)

// Raum-Farben aus der Petrol-Palette (gleich wie im Dashboard → Wiedererkennung)
const RAUM_FARBEN = ["#026773", "#e8a33d", "#024959", "#5aa9b2", "#c0708a", "#6b8f95", "#3d7d86"];

let liveTimer = null;
let aktuellesFeld = "Temperatur";
let aktuelleEinheit = "°C";
let aktuelleStellen = 1;
let letzteLiveDaten = null;

const $ = (id) => document.getElementById(id);
const de = (n, stellen = 1) =>
  Number(n).toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
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

// kurzer Puls bei erfolgreicher Aktualisierung
function tickPuls() {
  const pille = $("dbStatus");
  pille.classList.remove("live-tick");
  void pille.offsetWidth; // Reflow erzwingen → Animation neu starten
  pille.classList.add("live-tick");
}

// ---------- Große Live-Kacheln je Raum ----------
async function ladeKacheln() {
  const res = await fetch("/api/messwerte/aktuell");
  if (!res.ok) throw new Error("DB offline");
  const daten = await res.json();

  $("kachelRaster").innerHTML = daten.map((d) => {
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

// ---------- Rohdaten → Datasets je Raum ----------
function baueDatasets(daten, feld) {
  const gruppen = {};
  daten.forEach((d) => {
    if (d[feld] == null) return;
    const raum = d.RaumName || "Ohne Raum";
    (gruppen[raum] ||= []).push({ x: new Date(d.Zeitpunkt).getTime(), y: Number(d[feld]) });
  });
  return Object.entries(gruppen)
    .sort((a, b) => a[0].localeCompare(b[0], "de"))
    .map(([raum, points], i) => ({
      label: raum, color: RAUM_FARBEN[i % RAUM_FARBEN.length], points,
    }));
}

function zeichneDiagramm() {
  if (!letzteLiveDaten) return;
  const sets = baueDatasets(letzteLiveDaten, aktuellesFeld);
  MiniChart.legende($("legende"), sets);
  MiniChart.zeichne($("chartLive"), sets, {
    einheit: aktuelleEinheit, yStellen: aktuelleStellen, titel: aktuellesFeld, punkte: true,
  });
  $("diagrammEinheit").textContent = `${aktuelleEinheit} · nach Raum · jeder Punkt = eine Messung`;
}

// ---------- Live-Diagramm laden ----------
async function ladeDiagramm() {
  const minuten = $("fensterFilter").value;
  const res = await fetch(`/api/messwerte/live?minuten=${minuten}&limit=5000`);
  if (!res.ok) throw new Error("DB offline");
  letzteLiveDaten = await res.json();
  zeichneDiagramm();

  // Info-Zeile: Anzahl Messpunkte + Zeitpunkt der letzten Aktualisierung
  const jetzt = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  $("liveInfo").innerHTML =
    `Aktualisierung alle 5&nbsp;Sekunden · <b>${letzteLiveDaten.length.toLocaleString("de-DE")}</b> Messpunkte im Fenster · zuletzt ${jetzt} Uhr`;
}

// ---------- Alles laden ----------
async function alleDatenLaden() {
  try {
    await Promise.all([ladeKacheln(), ladeDiagramm()]);
    setzeStatus(true);
    tickPuls();
  } catch (err) {
    console.warn("Live-Abruf fehlgeschlagen:", err.message);
    setzeStatus(false);
  }
}

// ---------- Start ----------
document.addEventListener("DOMContentLoaded", () => {
  // Messgröße umschalten (Temperatur / Feuchte / Druck)
  $("messgroesse").addEventListener("click", (e) => {
    const knopf = e.target.closest(".live-tab");
    if (!knopf) return;
    document.querySelectorAll(".live-tab").forEach((b) => b.classList.remove("aktiv"));
    knopf.classList.add("aktiv");
    aktuellesFeld = knopf.dataset.feld;
    aktuelleEinheit = knopf.dataset.einheit;
    aktuelleStellen = Number(knopf.dataset.stellen);
    zeichneDiagramm();
  });

  // Zeitfenster ändern → sofort neu laden
  $("fensterFilter").addEventListener("change", alleDatenLaden);

  // Bei Größenänderung neu zeichnen (SVG passt sich an)
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(zeichneDiagramm, 200);
  });

  // Im Hintergrund (anderer Tab) nicht pollen → Ressourcen sparen
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearInterval(liveTimer);
      liveTimer = null;
    } else if (!liveTimer) {
      alleDatenLaden();
      liveTimer = setInterval(alleDatenLaden, INTERVALL_MS);
    }
  });

  alleDatenLaden();
  liveTimer = setInterval(alleDatenLaden, INTERVALL_MS);
});
