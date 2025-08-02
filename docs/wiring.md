# OBTP - ESP32 Target Wiring Guide

This document provides the wiring instructions for a single Open Blaster Target Platform (OBTP) smart target using an ESP32 development board.

---

## Required Components

* **ESP32 Development Board:** A 30-pin or 38-pin WROOM-32 based board.
* **WS2812B LED Ring/Strip:** The addressable LED ring for visual feedback.
* **Piezo Disc Sensor:** To detect dart impacts.
* **1MΩ (Megaohm) Resistor:** For the piezo sensor circuit.
* **5V DC Power Supply:** A power supply capable of providing at least 2A, depending on the number of LEDs.
* **Jumper Wires & Breadboard/PCB:** For making the connections.

---

## Wiring Instructions

All connections must share a **common ground**. This means the ground (`GND`) from your 5V power supply must be connected to the `GND` pin on the ESP32 and the `GND` pin on the LED ring.

### 1. Power Distribution

The ESP32 is powered via its `VIN` pin from the 5V power supply, which also powers the LED ring directly.

* **Power Supply `+5V`** -> **LED Ring `5V` pin**
* **Power Supply `+5V`** -> **ESP32 `VIN` pin**
* **Power Supply `GND`** -> **LED Ring `GND` pin**
* **Power Supply `GND`** -> **ESP32 `GND` pin**

### 2. LED Data Connection

The ESP32's 3.3V logic signal connects directly to the LED ring's 5V data input.

* **ESP32 `GPIO2`** -> **LED Ring `Data In` (DIN) pin**

> **Note on Logic Levels:** We are omitting a logic level converter for simplicity. Most WS2812B LEDs will correctly interpret the ESP32's 3.3V signal as a "high." If you experience flickering or incorrect colors, this is the first place to troubleshoot. Placing a standard 1N4001 diode in series with the 5V power line *only for the LED ring* can drop the ring's voltage to ~4.3V, making the 3.3V signal more reliable.

### 3. Piezo Sensor Connection

The piezo sensor is connected to an ADC (Analog-to-Digital Converter) pin with a 1MΩ pulldown resistor in parallel.

* **ESP32 `GPIO34`** -> **One wire** of the Piezo Sensor
* **ESP32 `GND`** -> **The other wire** of the Piezo Sensor
* **1MΩ Resistor:** Connect one leg to **`GPIO34`** and the other leg to **`GND`**.

---

## Troubleshooting & Best Practices

### Preventing False Hit Detection

The high-current switching of the LEDs can create electrical noise that interferes with the sensitive piezo sensor, causing false hit detections.

*   **Isolate Wires:** Keep the signal wire for the piezo sensor physically separate from the power and data wires for the LED ring. Do not run them bundled together. This prevents electrical noise (crosstalk) from the LEDs from being picked up by the sensor.
*   **Add a Decoupling Capacitor:** For maximum stability, solder a large capacitor (e.g., 1000µF, 6.3V or higher) across the main `+5V` and `GND` inputs, as close to the LED ring as possible. This acts as a local power reservoir, smoothing out the sudden current spikes from the LEDs and preventing voltage dips that can affect the entire circuit.

### Text-Based Diagram