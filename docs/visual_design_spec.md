# Open Blaster Target Platform - Web UI Visual Design Specification

## 1. Introduction
This document outlines the visual design specifications for the Open Blaster Target Platform (OBTP) web user interface. The goal is to establish a consistent, clear, usable, and mobile-friendly design language for the development team. This specification builds upon the existing dark theme and aims to enhance clarity, improve user experience, and ensure responsiveness across various devices.

## 2. Overall Aesthetic & Principles
*   **Modern & Clean:** Minimalist design with clear visual hierarchy.
*   **Dark Theme:** Maintain the existing dark background with light text and accent colors for readability and a modern feel.
*   **Clarity & Usability:** Prioritize intuitive interactions, clear labeling, and immediate feedback.
*   **Mobile-First Responsiveness:** Design components and layouts to adapt seamlessly from small mobile screens to larger desktop displays.
*   **Consistency:** Ensure all UI elements behave and appear consistently throughout the application.

## 3. Color Palette
Building on `style.css`:
*   **Primary Background:** `#1e1e1e` (Dark Gray) - `body` background.
*   **Panel Background:** `#252526` (Slightly Lighter Dark Gray) - Main content panels.
*   **Input/Control Background:** `#3c3c3c` (Medium Dark Gray) - Input fields, select boxes, textareas.
*   **Border Color (General):** `#333` (Dark Gray) - Panel borders.
*   **Border Color (Interactive):** `#555` (Gray) - Input/select/textarea borders.
*   **Primary Text Color:** `#d4d4d4` (Light Gray) - General body text.
*   **Heading Color:** `#569cd6` (Light Blue) - `h1`, `h2` headings.
*   **Label Color:** `#9cdcfe` (Lighter Blue) - Form labels.
*   **Accent/Interactive Color (Primary):** `#007acc` (Blue) - Default button background.
*   **Accent/Interactive Color (Hover):** `#005a9e` (Darker Blue) - Button hover state.
*   **Accent/Interactive Color (Border):** `#0e639c` (Dark Blue) - Button border.
*   **Link Color:** `#569cd6` (Light Blue) - Default link color.
*   **Link Hover Color:** `#9cdcfe` (Lighter Blue) - Link hover state.
*   **Success/Hit Status:** `#28a745` (Green) - For successful operations or 'HIT' status.
*   **Error/Expired Status:** `#dc3545` (Red) - For errors or 'EXPIRED' status.
*   **Warning/Prompt Color:** `#ffd700` (Gold/Yellow) - For prompts or warnings.
*   **Log Background:** `#1a1a1a` (Very Dark Gray) - For log output areas.

## 4. Typography
*   **Font Family:** `monospace` (as currently used) - Provides a technical, clean look. Consider a modern monospace font like "Fira Code", "JetBrains Mono", or "Roboto Mono" if a custom font is desired, ensuring it's easily readable.
*   **Headings (`h1`, `h2`):**
    *   `h1`: `font-size: 2em;` (or larger for desktop, responsive scaling)
    *   `h2`: `font-size: 1.5em;` (or larger for desktop, responsive scaling)
    *   `font-weight: normal;` (or `bold` for stronger emphasis, but current is `normal`)
    *   `color: #569cd6;`
    *   `border-bottom: 1px solid #444;`
*   **Body Text (`p`):**
    *   `font-size: 1em;`
    *   `color: #d4d4d4;`
*   **Labels (`label`):**
    *   `font-size: 1em;`
    *   `color: #9cdcfe;`
    *   `font-weight: bold;` (suggested for better distinction)
*   **Input/Select/Textarea Text:**
    *   `font-size: 1em;`
    *   `color: #d4d4d4;`
*   **Log Text:**
    *   `font-size: 0.9em;` (slightly smaller for density)
    *   `white-space: pre-wrap;` (maintain formatting)

## 5. Layout & Spacing
*   **Container:** `max-width: 1200px; margin: auto;` for desktop.
*   **Grid Layout:**
    *   Desktop (`.container`): `display: grid; grid-template-columns: 1fr 1fr; gap: 20px;`
    *   Mobile (`@media screen and (max-width: 768px)`): Change `.container` to `grid-template-columns: 1fr;` to stack panels vertically.
*   **Panels:**
    *   `padding: 20px;`
    *   `margin-bottom: 20px;` (consistent vertical spacing between stacked panels)
*   **Command Groups:**
    *   `margin-bottom: 20px;`
    *   `padding-bottom: 15px;`
    *   `border-bottom: 1px solid #444;` (consistent separators)
*   **Input/Label Spacing:**
    *   `label` `margin-bottom: 5px;`
    *   `input, select, textarea` `margin-bottom: 10px;` (consistent vertical rhythm)
*   **Button Spacing:** Consistent `margin-right` for inline buttons, or use flexbox for even distribution.

## 6. Components

### 6.1. Buttons
*   **Default:**
    *   `padding: 10px 20px;`
    *   `font-size: 1em;`
    *   `border: 1px solid #0e639c;`
    *   `border-radius: 3px;`
    *   `cursor: pointer;`
    *   `background: #007acc;`
    *   `color: white;`
*   **Hover:** `background: #005a9e;`
*   **Disabled:** `background: #555; cursor: not-allowed;`
*   **Destructive (e.g., Stop Game):**
    *   `background: #dc3545;`
    *   `border: 1px solid #a71d2a;` (suggested darker red border)
    *   `color: white;`
    *   Hover: `background: #c82333;`

### 6.2. Form Elements (Input, Select, Textarea)
*   **General:**
    *   `width: calc(100% - 20px);` (adjust for padding/border box model)
    *   `background: #3c3c3c;`
    *   `color: #d4d4d4;`
    *   `border: 1px solid #555;`
    *   `padding: 8px;`
    *   `border-radius: 3px;`
    *   `margin-bottom: 10px;`
*   **Focus State:** Add a distinct `outline` or `box-shadow` (e.g., `outline: 2px solid #9cdcfe; outline-offset: 2px;`) for accessibility and visual feedback.
*   **Placeholders:** Use a slightly lighter gray for placeholder text (e.g., `::placeholder { color: #a0a0a0; }`).

### 6.3. Panels & Cards
*   **Panel (`.panel`):**
    *   `background: #252526;`
    *   `border: 1px solid #333;`
    *   `border-radius: 5px;`
    *   `padding: 20px;`
*   **Target Card (`.target-card` in lobby):**
    *   `background: #2d2d2d;`
    *   `border: 1px solid #444;`
    *   `border-radius: 5px;`
    *   `padding: 15px;`
    *   `text-align: center;`
    *   `transition: all 0.3s ease;` (for smooth state changes)
*   **Offline Target Card:** `opacity: 0.5; background: #444;`

### 6.4. Status Indicators
*   **General Status (`.status`):**
    *   `font-size: 0.9em;`
    *   `padding: 5px;`
    *   `border-radius: 3px;`
    *   `margin-top: 10px;`
    *   `background-color: #3c3c3c;`
*   **Hit Status (`.status.hit`):** `background-color: #28a745; color: white;`
*   **Expired Status (`.status.expired`):** `background-color: #dc3545; color: white;`
*   **Prompt (`.prompt`):** `font-weight: bold; color: #ffd700;`

### 6.5. Navigation & Links
*   **Links (`a`):**
    *   `color: #569cd6;`
    *   `text-decoration: none;`
    *   `border-bottom: 1px dotted #569cd6;`
*   **Link Hover:** `color: #9cdcfe; border-bottom-style: solid;`
*   **Back to Lobby Link:** Ensure it's clearly visible and consistently placed (e.g., top-left of game/diagnostics pages).

## 7. Mobile Responsiveness
*   **Viewport Meta Tag:** Already present (`<meta name="viewport" content="width=device-width, initial-scale=1.0">`).
*   **Fluid Layouts:** Use percentages or `vw`/`vh` units where appropriate, but `calc(100% - Xpx)` is also effective.
*   **Media Queries:**
    *   Breakpoints: Suggest `768px` (for tablets) and `480px` (for smaller phones).
    *   Adjust `grid-template-columns` for `.container` to `1fr` on smaller screens.
    *   Adjust font sizes and padding to be slightly smaller on mobile for better content density.
    *   Ensure buttons and interactive elements have a minimum touch target size (e.g., 44x44px).
*   **Input Fields:** Ensure `width: 100%;` for inputs within panels on mobile.
*   **Log Area:** Ensure `height` of `#log` is responsive (e.g., `height: 30vh;` or `max-height: 300px;` with `overflow-y: auto;`).

## 8. Usability Enhancements (Beyond Visuals)
*   **Loading States:** Provide visual feedback (spinners, disabled buttons) for operations that take time (e.g., starting game, running diagnostic tests).
*   **Error Handling:** Clear, user-friendly error messages, not just in the log.
*   **Tooltips/Help Text:** For complex inputs or commands, consider adding small info icons with tooltips.
*   **Form Validation:** Client-side validation for inputs (e.g., number ranges, required fields) to provide immediate feedback.
*   **Accessibility:**
    *   Ensure sufficient color contrast for all text and interactive elements.
    *   Proper use of semantic HTML (`<label>`, `<button>`, etc.).
    *   Keyboard navigation and focus management.

## 9. Future Considerations
*   **Iconography:** Integrate a lightweight icon library (e.g., Font Awesome, Material Icons) for visual cues (e.g., play/pause, settings, info).
*   **Animations:** Subtle CSS transitions for hover states, panel expansions, etc., to enhance perceived performance and polish.
*   **Component Library:** As the application grows, consider abstracting common UI patterns into reusable components (e.g., a custom button component, input group component).

This specification serves as a guide. Developers should refer to it to maintain consistency and quality throughout the OBTP web interface development.
