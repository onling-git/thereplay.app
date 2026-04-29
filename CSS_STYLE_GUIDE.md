# CSS Style Guide

This style guide documents the CSS conventions and patterns used throughout thefinalplay.com, based on the homepage and team overview page implementations.

## Table of Contents
- [Color System](#color-system)
- [Typography](#typography)
- [Naming Conventions](#naming-conventions)
- [Layout Patterns](#layout-patterns)
- [Component Structure](#component-structure)
- [Spacing & Sizing](#spacing--sizing)
- [Responsive Design](#responsive-design)
- [Interactive Elements](#interactive-elements)
- [Common Patterns](#common-patterns)
- [Best Practices](#best-practices)

---

## Color System

### Background Colors
```css
/* Primary Background */
background-color: #18181b;      /* Body/page background (dark) */
background-color: #262628;      /* Card/component background (lighter dark) */
background-color: #323235;      /* Badge/accent background */
background-color: #f8f9fa;      /* Light background (loading states) */
```

### Text Colors
```css
/* Primary Text */
color: #fff;                    /* Headings and important text */
color: #807e84;                 /* Body text, meta information */
color: #1a1a1a;                 /* Dark text on light backgrounds */
color: #666;                    /* Subdued text */
```

### Accent Colors
```css
/* Primary Accents */
color: #e55a53;                 /* Primary accent (links, CTAs) */
color: #e9716b;                 /* Hover/alternative accent */
color: #4CAF50;                 /* Success/positive actions */
color: #388E3C;                 /* Success hover state */
```

### Status Colors
```css
/* Status Indicators */
background-color: #dc3545;      /* Live/urgent status (red) */
background-color: #28a745;      /* Finished/complete status (green) */
background-color: #ffc107;      /* Upcoming/warning status (yellow) */

/* Data Freshness */
background-color: #d4edda;      /* Current/fresh data */
color: #155724;
border: 1px solid #c3e6cb;

background-color: #fff3cd;      /* Cached data */
color: #856404;
border: 1px solid #ffeaa7;
```

---

## Typography

### Font Families
```css
/* Primary Font Stack */
font-family: "Roboto", Arial, sans-serif;           /* Body text */

/* Display Fonts */
font-family: "Schabo Condensed", Arial, sans-serif; /* Headings (optional) */
font-family: "Permanent Marker", cursive;           /* Special emphasis */
font-family: "Oswald", sans-serif;                  /* Alternative headings */
```

### Font Sizing
```css
/* Base */
font-size: 12px;                /* Body base size */

/* Headings */
font-size: 1.5rem;              /* h2 - section headers */
font-size: 1.3rem;              /* h2 - mobile */
font-size: 1.2rem;              /* h2 - small mobile */

/* Small Text */
font-size: 0.9rem;              /* Link text, buttons */
font-size: 0.85em;              /* Meta information */
font-size: 0.8em;               /* Timestamps, small meta */
font-size: 0.75em;              /* Badge text */
```

### Font Weights
```css
font-weight: 400;               /* Normal text */
font-weight: 500;               /* Headings, emphasized */
font-weight: 600;               /* Bold links, important text */
font-weight: bold;              /* Status badges */
```

---

## Naming Conventions

### BEM-Like Naming Pattern
Follow a component-based naming pattern similar to BEM (Block Element Modifier):

```css
/* Block: Component name */
.news-card { }
.top-stories-card { }
.live-score-card { }

/* Element: Child elements using component prefix */
.news-card-content { }
.news-card-header { }
.top-stories-card-footer { }
.top-stories-card-team { }

/* Modifier: State or variant using additional class */
.status-badge.status-live { }
.favorite-button.favorited { }
.data-freshness.current { }
```

### Common Naming Patterns

#### Section Names
```css
.{page}-section                 /* .livescores-section, .news-section */
.{page}-content                 /* .home-content, .page-content */
```

#### Headers
```css
.section-header                 /* Consistent across pages */
.{component}-header             /* .news-section-header, .team-overview-header */
```

#### Containers
```css
.{component}-container          /* .top-stories-card-container */
.{component}-inner              /* .to-scorecard-inner */
```

#### Elements with Icons
```css
.{element}-icon                 /* .news-icon, .source-icon */
.{element}-logo                 /* .top-stories-card-logo, .tweet-logo */
```

#### Interactive Elements
```css
.{action}-link                  /* .view-more-link */
.{action}-btn                   /* .auth-btn, .favorite-btn */
```

---

## Layout Patterns

### Flexbox Layouts
```css
/* Horizontal alignment with gap */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

/* Vertical stacking */
.component {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

/* Auto-margins for spacing */
.element {
  margin-left: auto;          /* Push to right */
  margin-right: 10px;
}
```

### Grid Layouts
```css
/* Responsive card grid */
.news-feed {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

/* Two-column grid */
.matches-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

/* Mobile: single column */
@media (max-width: 768px) {
  .matches-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}
```

### Horizontal Scrolling
```css
.scrollable-container {
  display: flex;
  gap: 15px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 10px 0;
  white-space: nowrap;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.scrollable-item {
  flex-shrink: 0;             /* Prevent shrinking */
  scroll-snap-align: start;
  width: 270px;               /* Fixed width */
}
```

---

## Component Structure

### Card Components
All card components should follow this structure:

```css
/* Base card */
.{component}-card {
  background: #262628;
  border-radius: 10px;        /* or 8px for smaller cards */
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: all 0.2s ease;
}

/* Hover state */
.{component}-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  transform: translateY(-1px);
}

/* Card sections */
.{component}-card-header { }
.{component}-card-content {
  padding: 1rem;              /* Standard padding */
}
.{component}-card-footer { }
```

### Borders
```css
/* Card borders */
border: 1px solid #e9ecef;    /* Light borders */
border: 1px solid white;       /* Emphasizing borders */

/* Border radius */
border-radius: 8px;            /* Standard cards */
border-radius: 10px;           /* Larger components */
border-radius: 4px;            /* Badges, small elements */
border-radius: 25px;           /* Pills/tags */
```

---

## Spacing & Sizing

### Margins
```css
/* Section spacing */
margin: 2rem 0;                /* Between major sections */
margin: 30px 0;                /* Between subsections */
margin: 20px 0;                /* Between elements */
margin: 1.5rem;                /* Standard spacing */

/* Page margins */
margin: 0 2%;                  /* Page content horizontal margins */

/* Element margins */
margin-bottom: 1.5rem;         /* After section headers */
margin-bottom: 0.8rem;         /* Between small elements */
```

### Padding
```css
/* Card/container padding */
padding: 1rem;                 /* Standard content padding */
padding: 15px;                 /* Alternative standard */
padding: 20px;                 /* Larger content areas */

/* Compact padding */
padding: 8px 12px;             /* Badges */
padding: 4px 8px;              /* Small badges */
padding: 0.2rem 0.8rem;        /* Tags */

/* Directional padding */
padding: 0 15px;               /* Horizontal only */
padding: 10px 0;               /* Vertical only */

/* Bottom padding for fixed footer */
padding-bottom: 100px;         /* Page content (prevents footer overlap) */
```

### Gaps
```css
gap: 30px;                     /* Large gap (grid, major elements) */
gap: 15px;                     /* Medium gap (cards in row) */
gap: 10px;                     /* Standard gap (flex items) */
gap: 1rem;                     /* Grid gap */
gap: 0.5rem;                   /* Tight gap */
```

### Icon Sizes
```css
/* Standard icons */
width: 15px;
height: 15px;

/* Medium icons */
width: 20px;
height: 20px;

/* Large icons/logos */
width: 25px;
height: 25px;

/* Team logos */
max-width: 30px;
```

---

## Responsive Design

### Breakpoints
```css
/* Tablet and below */
@media (max-width: 768px) {
  /* Stack grids, increase spacing */
}

/* Mobile */
@media (max-width: 480px) {
  /* Reduce sizes, tighter spacing */
}
```

### Mobile-First Patterns
```css
/* Change grid columns */
@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;  /* Single column */
  }
}

/* Reduce sizes */
@media (max-width: 768px) {
  .section-header h2 {
    font-size: 1.3rem;           /* From 1.5rem */
  }
}

@media (max-width: 480px) {
  .section-header h2 {
    font-size: 1.2rem;           /* Further reduction */
  }
}

/* Adjust padding */
@media (max-width: 480px) {
  .content {
    padding: 0.8rem;             /* From 1rem */
  }
}
```

---

## Interactive Elements

### Links
```css
/* Standard links */
a {
  color: #e55a53;
  text-decoration: none;
  transition: color 0.2s ease;
}

a:hover {
  color: #e9716b;
}

/* Action links */
.view-more-link {
  color: #4CAF50;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  transition: color 0.2s ease;
}

.view-more-link:hover {
  color: #388E3C;
}

/* Links in titles */
.title a {
  color: #807e84;
  text-decoration: none;
  transition: color 0.2s ease;
}

.title a:hover {
  color: #e9716b;
}
```

### Buttons
```css
button {
  color: #807e84;
  transition: all 0.2s ease;
}

.auth-btn {
  background: transparent;
  border: 1px solid #807e84;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.auth-btn:hover {
  border-color: #e55a53;
  color: #e55a53;
}
```

### Cursors
```css
cursor: pointer;               /* Clickable elements */
```

### Transitions
```css
/* Standard transitions */
transition: all 0.2s ease;     /* Most interactive elements */
transition: color 0.2s ease;   /* Text color changes */

/* Specific properties */
transition: transform 0.2s ease, box-shadow 0.2s ease;
```

### Hover Effects
```css
/* Card hover */
.card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  transform: translateY(-1px);
}

/* Button hover */
.button:hover {
  background-color: rgba(229, 90, 83, 0.1);
}
```

---

## Common Patterns

### Status Badges
```css
.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75em;
  font-weight: bold;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.status-badge.status-live {
  background-color: #dc3545;
  color: white;
}

.status-badge.status-finished,
.status-badge.status-FT {
  background-color: #28a745;
  color: white;
}

.status-badge.status-upcoming {
  background-color: #ffc107;
  color: #212529;
}
```

### Data Freshness Indicators
```css
.data-freshness {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.85em;
  font-weight: 500;
  margin-bottom: 15px;
  display: inline-block;
}

.data-freshness.current {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.data-freshness.cached {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}
```

### Loading States
```css
.loading-content {
  text-align: center;
  padding: 2rem;
  color: #666;
  background-color: #f8f9fa;
  border-radius: 8px;
}
```

### Image Transformations
```css
/* Rotated arrows */
transform: rotate(-90deg);     /* Down arrow pointing right */

/* Icon sizing */
.icon {
  width: 15px;
  height: 15px;
  margin: 0 10px 0 0;          /* Right spacing */
}
```

### Positioning Patterns
```css
/* Absolute positioning within relative parent */
.parent {
  position: relative;
}

.child {
  position: absolute;
  top: -2px;
  right: 4px;
  z-index: 10;
}
```

### Overlay Effects
```css
.overlay {
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);  /* Optional blur */
}
```

---

## Best Practices

### 1. Component-Scoped Styles
- Each component should have its own CSS file
- Location: `src/pages/css/{page}.css` or `src/components/{Component}/{Component}.css`
- Import in component file: `import "./css/home.css"`

### 2. Naming Rules
- Use lowercase with hyphens: `news-card`, not `newsCard` or `NewsCard`
- Prefix child elements with parent name: `.news-card-content`, not `.content`
- Use descriptive, semantic names: `.match-status`, not `.red-badge`
- State modifiers as additional classes: `.button.active`, not `.button-active`

### 3. Spacing Consistency
- Use `rem` for typography and large spacing
- Use `px` for borders, small spacing, and precise control
- Stick to spacing scale: 4px, 8px, 10px, 15px, 20px, 30px
- Use gap for flex/grid spacing instead of margins when possible

### 4. Color Usage
- Always use defined color variables (when possible)
- Never hardcode opacity in rgba - use defined colors
- Use semantic status colors for badges
- Maintain sufficient contrast for accessibility

### 5. Responsive Design
- Mobile-first approach when adding new features
- Always test at 768px and 480px breakpoints
- Reduce font sizes progressively, not dramatically
- Stack grids to single column on mobile

### 6. Performance
- Avoid overly complex selectors
- Use `will-change` sparingly for animations
- Minimize the use of box-shadow on many elements
- Use `transform` for animations instead of position changes

### 7. Transitions & Animations
- Keep transitions short: 0.2s for most interactions
- Use `ease` or `ease-in-out` timing functions
- Only transition specific properties when possible
- Avoid transitioning `all` for better performance

### 8. Typography
- Set base font size on body (12px)
- Use rem for scalable text
- Maintain line-height for readability (1.2-1.5)
- Limit font weights to 400, 500, 600, bold

### 9. Layout
- Use flexbox for one-dimensional layouts
- Use grid for two-dimensional layouts
- Prefer `gap` over margins in flex/grid
- Use `max-width` for content containers when appropriate

### 10. Dark Theme Considerations
- Base background: `#18181b`
- Component background: `#262628`
- Use lighter backgrounds for emphasis
- Ensure text contrast meets WCAG standards
- Test accent colors on dark backgrounds

### 11. Global Styles
- Only apply truly global styles in `index.css`
- Component-specific styles should never be global
- Use classnames, avoid element-only selectors at component level
- Reset margins on headings when needed: `margin: 0`

### 12. Commenting
```css
/* Section Headers */
/* Use comments to separate major sections */

/* More specific explanation for complex rules */
.complex-component {
  /* Explanation of why this specific value is used */
  padding: 0 15px;
}
```

---

## Component Checklist

When creating a new component or page, ensure:

- [ ] Component has its own CSS file
- [ ] CSS file is imported in the component
- [ ] Class names follow BEM-like pattern with component prefix
- [ ] Colors match the established color system
- [ ] Spacing uses standard values (gap, margin, padding)
- [ ] Typography uses standard font sizes and weights  
- [ ] Responsive behavior defined for 768px and 480px
- [ ] Hover/focus states defined for interactive elements
- [ ] Transitions are smooth (0.2s ease)
- [ ] Border radius matches pattern (4px, 8px, 10px, 25px)
- [ ] Dark theme compatibility verified
- [ ] Loading states styled consistently
- [ ] Status indicators use standard colors
- [ ] Images properly sized and positioned

---

## Quick Reference

### Standard Card
```css
.my-card {
  background: #262628;
  border-radius: 10px;
  padding: 1rem;
  margin: 2rem 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: all 0.2s ease;
}

.my-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  transform: translateY(-1px);
}
```

### Standard Section Header
```css
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h2 {
  margin: 0;
  color: #fff;
  font-size: 1.5rem;
}
```

### Standard Grid
```css
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

@media (max-width: 768px) {
  .grid-container {
    grid-template-columns: 1fr;
  }
}
```

---

## Additional Resources

- Global styles: `src/index.css`
- App wrapper: `src/App.css`
- Homepage reference: `src/pages/css/home.css`
- Team overview reference: `src/pages/css/teamoverview.css`
- Card components: See `src/components/*/` for examples

---

**Last Updated:** April 2026  
**Maintainers:** Development Team  
**Questions?** Refer to existing component CSS files for practical examples.
