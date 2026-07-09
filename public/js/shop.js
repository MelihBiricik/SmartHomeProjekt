// ============================================================
//  shop.js – Produkte der Produktreihe „SmartHome"
//  (Produkte laut Projektbeschreibung LS-SmartHome)
// ============================================================

const PRODUKTE = [
  {
    id: "server",
    name: "SmartHomeServer",
    tag: "Software · Download",
    preis: 49.99,
    beschreibung:
      "Die Server-Applikation empfängt die Daten Ihrer Sensoren per WLAN und speichert sie in einer MySQL-Datenbank. Mit WPF-Oberfläche, Multi-Threading und integrierter MockUp-Funktion zum Testen.",
    lieferumfang: [
      "Server-Software für Windows (Download)",
      "Datenbank-Skript (MySQL)",
      "Ausführliche Installationsanleitung",
      "Kostenlose Updates für 12 Monate",
    ],
    icon: "server",
  },
  {
    id: "sensor",
    name: "SmartHomeSensor",
    tag: "Hardware · Bausatz",
    preis: 34.9,
    beschreibung:
      "Der Mess-Bausatz für jeden Raum: erfasst Temperatur (0,1 °C genau), Luftfeuchtigkeit und Luftdruck und funkt die Werte per WLAN an den SmartHome-Server.",
    lieferumfang: [
      "Adafruit Feather-Board (ESP8266)",
      "BME280-Sensormodul",
      "USB-Kabel und USB-Netzteil",
      "Aufbau- und Flash-Anleitung",
    ],
    icon: "chip",
  },
  {
    id: "sensor-akku",
    name: "SmartHomeSensor Akku-Edition",
    tag: "Hardware · Bausatz",
    preis: 44.9,
    beschreibung:
      "Wie der SmartHomeSensor – aber kabellos: Mit LiPo-Akku für flexible Platzierung auf Balkon, in der Garage oder überall dort, wo keine Steckdose in der Nähe ist.",
    lieferumfang: [
      "Adafruit Feather-Board (ESP8266)",
      "BME280-Sensormodul",
      "LiPo-Akku 2000 mAh + Ladeelektronik",
      "Aufbau- und Flash-Anleitung",
    ],
    icon: "akku",
  },
  {
    id: "web",
    name: "SmartHomeWeb",
    tag: "Software · Download",
    preis: 29.99,
    beschreibung:
      "Das Web-Dashboard für Ihren Browser: Wetterdaten anzeigen, Historie durchsuchen, Alarmierung einrichten und Befehle an Geräte senden – von jedem Gerät im Heimnetz.",
    lieferumfang: [
      "Web-Applikation (Download)",
      "Live-Diagramme für alle Räume",
      "Alarmierung bei Grenzwerten",
      "Wetterdaten-Historie",
    ],
    icon: "monitor",
  },
  {
    id: "komplett",
    name: "SmartHome Komplett-Set",
    tag: "Bundle · Sparpreis",
    preis: 129.0,
    beschreibung:
      "Das Rundum-Paket für den Einstieg: Server-Software, Web-Dashboard und drei Sensoren – genug für Wohnzimmer, Küche und Bad. Sie sparen über 20 € gegenüber dem Einzelkauf.",
    lieferumfang: [
      "1× SmartHomeServer (Download)",
      "1× SmartHomeWeb (Download)",
      "3× SmartHomeSensor (Bausatz)",
      "Schnellstart-Anleitung",
    ],
    icon: "paket",
  },
];

const ICONS = {
  server: '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>',
  chip: '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>',
  akku: '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="2" y="8" width="17" height="8" rx="2"/><path d="M21 10.5v3"/><path d="M6 10.5v3M9.5 10.5v3"/></svg>',
  monitor: '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="M6.5 12l2.5-3 2 2 3.5-4.5"/></svg>',
  paket: '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7Z"/><path d="M3 8.5 12 14l9-5.5M12 14v7"/></svg>',
};

function zeichneProdukte() {
  const raster = document.getElementById("produktRaster");
  raster.innerHTML = PRODUKTE.map((p) => `
    <article class="produkt">
      <div class="produkt-bild">${ICONS[p.icon]}</div>
      <div class="produkt-inhalt">
        <span class="produkt-tag">${p.tag}</span>
        <h3>${p.name}</h3>
        <p class="beschreibung">${p.beschreibung}</p>
        <ul class="lieferumfang">
          ${p.lieferumfang.map((l) => `<li>${l}</li>`).join("")}
        </ul>
        <div class="produkt-fuss">
          <div class="preis">${formatEuro(p.preis)}<small>inkl. MwSt.</small></div>
          <button class="knopf knopf-primaer" onclick='inDenKorb({ id: "${p.id}", name: "${p.name}", preis: ${p.preis} })'>
            In den Warenkorb
          </button>
        </div>
      </div>
    </article>
  `).join("");
}

document.addEventListener("DOMContentLoaded", zeichneProdukte);
