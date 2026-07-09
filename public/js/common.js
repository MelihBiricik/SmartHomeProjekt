// ============================================================
//  common.js – Warenkorb, deutsche Formatierung (Euro, Datum)
// ============================================================

// --- Deutsche Formatierung ---
const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const DATUM_ZEIT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});
const NUR_ZEIT = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

function formatEuro(betrag) { return EUR.format(betrag); }
function formatDatumZeit(iso) { return DATUM_ZEIT.format(new Date(iso)) + " Uhr"; }

// --- Warenkorb (localStorage) ---
const KORB_KEY = "itsol_warenkorb";

function ladeKorb() {
  try { return JSON.parse(localStorage.getItem(KORB_KEY)) || []; }
  catch { return []; }
}
function speichereKorb(korb) {
  localStorage.setItem(KORB_KEY, JSON.stringify(korb));
  aktualisiereKorbAnzeige();
}
function inDenKorb(produkt) {
  const korb = ladeKorb();
  const vorhanden = korb.find((p) => p.id === produkt.id);
  if (vorhanden) vorhanden.menge += 1;
  else korb.push({ ...produkt, menge: 1 });
  speichereKorb(korb);
  zeigeToast(`„${produkt.name}" wurde in den Warenkorb gelegt.`);
}
function aendereMenge(id, delta) {
  let korb = ladeKorb();
  const eintrag = korb.find((p) => p.id === id);
  if (!eintrag) return;
  eintrag.menge += delta;
  if (eintrag.menge <= 0) korb = korb.filter((p) => p.id !== id);
  speichereKorb(korb);
  zeichneKorb();
}
function korbSumme(korb) {
  return korb.reduce((s, p) => s + p.preis * p.menge, 0);
}

// --- Warenkorb-UI ---
function aktualisiereKorbAnzeige() {
  const anzahl = ladeKorb().reduce((s, p) => s + p.menge, 0);
  document.querySelectorAll(".warenkorb-anzahl").forEach((el) => (el.textContent = anzahl));
}

function zeichneKorb() {
  const liste = document.getElementById("korbListe");
  const summeEl = document.getElementById("korbSumme");
  if (!liste) return;
  const korb = ladeKorb();

  if (korb.length === 0) {
    liste.innerHTML = '<p class="korb-leer">Ihr Warenkorb ist leer.<br>Legen Sie ein Produkt aus dem WebShop hinein.</p>';
  } else {
    liste.innerHTML = korb.map((p) => `
      <div class="korb-eintrag">
        <div>
          <div class="name">${p.name}</div>
          <div class="einzelpreis">${formatEuro(p.preis)} / Stück</div>
          <div class="menge">
            <button onclick="aendereMenge('${p.id}', -1)" aria-label="Menge verringern">−</button>
            <span>${p.menge}</span>
            <button onclick="aendereMenge('${p.id}', 1)" aria-label="Menge erhöhen">+</button>
          </div>
        </div>
        <div class="zeilensumme">${formatEuro(p.preis * p.menge)}</div>
      </div>
    `).join("");
  }
  if (summeEl) summeEl.textContent = formatEuro(korbSumme(korb));
}

function oeffneKorb() {
  zeichneKorb();
  document.getElementById("korb")?.classList.add("offen");
  document.getElementById("korbSchleier")?.classList.add("offen");
}
function schliesseKorb() {
  document.getElementById("korb")?.classList.remove("offen");
  document.getElementById("korbSchleier")?.classList.remove("offen");
}
function bestellungAbschicken() {
  const korb = ladeKorb();
  if (korb.length === 0) { zeigeToast("Der Warenkorb ist leer."); return; }
  speichereKorb([]);
  zeichneKorb();
  zeigeToast("Vielen Dank! Ihre Bestellung wurde aufgenommen (Demo).");
}

// --- Toast ---
let toastTimer;
function zeigeToast(text) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add("sichtbar");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("sichtbar"), 2600);
}

document.addEventListener("DOMContentLoaded", aktualisiereKorbAnzeige);
