# OBTP Pre-Programmed Animations

This document details the built-in animations available in the target firmware. These animations can be called within a `<visual_script>` using the `ANIM <name> <R> <G> <B>` format.

---

## Animation Library

### 1. `PULSE`
* **Description:** The entire LED ring smoothly fades in and out from black to the specified color.
* **Color Argument:** Used as the peak color for the pulse.
* **Special Considerations:** A classic, low-distraction animation ideal for indicating a "live" or "waiting" state.

### 2. `THEATER_CHASE`
* **Description:** A chasing light effect, where every third LED is lit in the specified color, creating a rotating pattern.
* **Color Argument:** Sets the color of the chasing lights.
* **Special Considerations:** The speed of the chase is fixed in the firmware.

### 3. `RAINBOW_CYCLE`
* **Description:** The LED ring cycles smoothly through all colors of the rainbow.
* **Color Argument:** This animation **ignores** the color argument, as it generates its own colors.
* **Special Considerations:** Useful for celebrations or attention-grabbing effects.

### 4. `COMET`
* **Description:** A single pixel of the specified color orbits the ring, leaving a fading tail behind it.
* **Color Argument:** Sets the color of the "comet" head. The tail is a fade-to-black of this color.
* **Special Considerations:** The speed and tail length are fixed in the firmware.

### 5. `WIPE`
* **Description:** The LED ring fills up one LED at a time with the specified color, pauses for half a second, and then clears itself.
* **Color Argument:** The color that fills the ring.
* **Special Considerations:** This animation has a fixed duration based on the number of LEDs and a hard-coded pause. It does not loop smoothly by itself; the entire animation sequence (fill, pause, clear) will repeat if the step duration is long enough.

### 6. `CYLON`
* **Description:** A bar of light (an "eye") sweeps back and forth across the LED strip, reminiscent of a Cylon from Battlestar Galactica.
* **Color Argument:** Sets the color of the sweeping "eye."
* **Special Considerations:** The size of the eye and its speed are fixed in the firmware.

### 7. `SPARKLE`
* **Description:** Random LEDs briefly flash with the specified color and then fade, creating a twinkling or sparkling effect.
* **Color Argument:** The color of the sparkles.
* **Special Considerations:** The rate and fade speed of the sparkles are fixed. Good for idle or decorative effects.

### 8. `FIRE`
* **Description:** Simulates a flickering flame effect, with warm colors moving upwards.
* **Color Argument:** This animation **ignores** the color argument and uses its own palette of reds, oranges, and yellows.
* **Special Considerations:** A complex, visually interesting effect that works best on linear strips or the bottom half of a ring to simulate rising flames.

### 9. `CONVERGE`
* **Description:** Two points of light start at opposite ends of the ring and move towards the middle, meeting at the top and bottom.
* **Color Argument:** Sets the color of the two moving points.
* **Special Considerations:** The speed is fixed. The animation will continuously loop, with the points restarting their journey from the sides.
