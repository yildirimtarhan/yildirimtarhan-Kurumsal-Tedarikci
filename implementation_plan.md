# Deep Global Corporate Design Overhaul

The previous update only affected the homepage colors because the existing codebase replicates the same inline `<style>` block across **every single HTML file** in the project, overriding the global [style.css](file:///c:/Users/Pelin/Desktop/kurumsal-final/public/css/style.css).

To truly upgrade the website to a professional, premium, and corporate structure, we need a deeper refactor.

## Proposed Changes

### 1. Global CSS Architecture (Refactoring)
- **Action**: Remove the massive, redundant inline `<style>` blocks from all 20+ HTML files in the `public/` directory (e.g., [hizmetler.html](file:///c:/Users/Pelin/Desktop/kurumsal-final/public/hizmetler.html), [paketler.html](file:///c:/Users/Pelin/Desktop/kurumsal-final/public/paketler.html), vs).
- **Goal**: Force all pages to inherit styling strictly from [public/css/style.css](file:///c:/Users/Pelin/Desktop/kurumsal-final/public/css/style.css). This ensures the corporate colors, typography (`Inter`), and component styles apply universally and consistently.

### 2. Structural Redesign (HTML & Layout)
Merely changing colors is not enough for a premium feel. We will restructure key components:

#### [MODIFY] [index.html](file:///c:/Users/Pelin/Desktop/kurumsal-final/public/index.html)
- **Hero Section**: Transform the currently centered text hero into a modern, corporate split-layout.
  - *Left Column*: High-impact headline, refined paragraph spacing, and primary/secondary call-to-action buttons.
  - *Right Column*: A professional visual composition (e.g., an abstract geometric pattern, a grid of trust badges, or a mock UI window demonstrating E-Fatura/E-İmza securely).
- **Features / Services Grid**: Move from a basic standard grid to an elegant, staggered card layout with soft "glassmorphism" panels and deep, subtle shadows.
- **Navbar**: Enhance the stickiness with a stronger `backdrop-filter: blur(12px)` and refined border bottoms.

#### [MODIFY] [style.css](file:///c:/Users/Pelin/Desktop/kurumsal-final/public/css/style.css)
- **Utility Classes**: Introduce utility classes for sections (`.section-light`, `.section-dark`, `.glass-panel`) to give the design depth.
- **Micro-interactions**: Implement elegant, corporate micro-animations (e.g., cards slightly lifting on hover, buttons doing a soft background fade rather than aggressive scaling).

## Verification Plan
1. Start the local server to test the entire site architecture.
2. Verify that clicking through pages like "Hizmetler" and "Paketler" retains the identical corporate navy/blue design language without visual breaking.
3. Review the structural changes to the homepage.
