CREATE DATABASE IF NOT EXISTS SmartHomeDB2;
USE SmartHomeDB2;

-- 1. Tabelle für die Räume
CREATE TABLE Raum (
    RaumID INT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL
);

-- 2. Tabelle für die Sensoren
-- Ein Sensor gehört zu einem Raum (1:n Beziehung)
CREATE TABLE Sensor (
    SensorID INT PRIMARY KEY,
    Typ VARCHAR(50),
    RaumID INT,
    CONSTRAINT fk_raum
        FOREIGN KEY (RaumID) 
        REFERENCES Raum(RaumID)
        ON DELETE SET NULL
);
 
-- 3. Tabelle für die Messwerte
-- Ein Messwert gehört zu genau einem Sensor (1:n Beziehung)
CREATE TABLE Messwerte (
    MesswerteID INT PRIMARY KEY AUTO_INCREMENT,
    Zeitpunkt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Temperatur DECIMAL(5, 2),
    Luftfeuchtigkeit DECIMAL(5, 2),
    Luftdruck DECIMAL(6, 2),
    SensorID INT NOT NULL,
    CONSTRAINT fk_sensor
        FOREIGN KEY (SensorID)
        REFERENCES Sensor(SensorID)
        ON DELETE CASCADE,
    -- Verbund-Index: beschleunigt "letzter Messwert pro Sensor" und
    -- Zeitraum-Abfragen des Dashboards, wenn die Tabelle waechst
    INDEX idx_sensor_zeit (SensorID, Zeitpunkt)
);

-- Fuer eine BESTEHENDE Datenbank den Index nachtraeglich anlegen:
-- ALTER TABLE Messwerte ADD INDEX idx_sensor_zeit (SensorID, Zeitpunkt);