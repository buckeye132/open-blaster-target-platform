# Open Blaster Target Platform (OBTP)

![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)
![GitHub issues](https://img.shields.io/github/issues/buckeye132/open-blaster-target-platform)
![GitHub pull requests](https://img.shields.io/github/issues-pr/buckeye132/open-blaster-target-platform)

The Open Blaster Target Platform (OBTP) is a community-driven project to build intelligent, connected targets for the foam-flinging hobby. This repository contains the firmware for ESP32-based smart targets and a Node.js server that acts as a central game engine, enabling custom game modes, real-time scoring, and multi-target interaction.

---

## Key Features

* **Networked Gameplay:** Connect multiple smart targets over Wi-Fi for dynamic, coordinated games.
* **Centralized Game Logic:** All game rules are managed by a Node.js server, allowing for easy creation of new game modes without re-flashing the targets.
* **Latency-Independent Scoring:** Targets handle hit detection and reaction timing locally for maximum accuracy.
* **Highly Configurable:** Use the powerful command protocol to control target visuals, hit requirements, and game mechanics.
* **Fully Open Source:** All hardware designs, firmware, and server software are open source and ready for you to build, modify, and improve.

---

## Project Structure

This repository is organized into the following directories:

* **/hardware/**: Contains the 3D models (`.stl`) and PCB design files (`KiCad`/`EasyEDA`) for building the physical targets.
* **/firmware/**: Contains the ESP32 firmware source code, written for the Arduino IDE.
* **/software/**: Contains the Node.js central game server and diagnostic tools.
* **/docs/**: Contains the command protocol specification, wiring guides, and other documentation.

---

## Getting Started

**NOTE:** This project is a work in progress! I do not recommend starting a build yet unless you are interested in helping contribute.

1. **Build the Hardware:** Fabricate the PCBs and 3D print the enclosures using the files in the `/hardware/` directory.
2. **Flash the Firmware:** Compile and upload the firmware from the `/firmware/` directory to your ESP32 targets.
3. **Run the Server:** Install the dependencies and start the Node.js server from the `/software/` directory.
4. **Play!** Connect your targets and start a game using the server's web interface.

---

## License

This project is licensed under the **Apache License 2.0**. A copy of the license is available in the `LICENSE` file in this repository.

---

## Contributing

Contributions are welcome! Please feel free to open an issue to report bugs or a pull request to suggest improvements.
