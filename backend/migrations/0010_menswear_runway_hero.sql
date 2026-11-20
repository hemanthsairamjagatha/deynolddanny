-- =============================================================================
-- DEYNOLD DANNY — 100% Menswear 3D Runway Hero Campaign Sync
-- Migration: 0010_menswear_runway_hero.sql
-- =============================================================================

UPDATE cms_sections
SET
  draft_props_json = '{
    "eyebrow": "AUTUMN / WINTER 2026 · MENSWEAR RUNWAY",
    "headline": "DEYNOLD DANNY",
    "description": "Architectural Bespoke Tailoring & Cashmere",
    "tagline": "Architectural Bespoke Tailoring & Cashmere",
    "desktopImage": "/hero-banner.jpg",
    "videoUrl": "",
    "focalX": 66,
    "focalY": 28,
    "overlayOpacity": 16,
    "overlayColor": "#000000",
    "ctaLabel": "Shop Outerwear",
    "ctaUrl": "/categories/overcoats",
    "secondaryCtaLabel": "Explore Collection",
    "secondaryCtaUrl": "/categories",
    "runwayLooks": [
      {
        "code": "LOOK 01",
        "title": "The Monolith Overcoat Ensemble",
        "subtitle": "Obsidian Virgin Wool · Ivory Silk · Camel Cashmere",
        "image": "/images/hero-runway-1.jpg",
        "ctaLabel": "Shop Outerwear",
        "ctaUrl": "/categories/overcoats",
        "focalX": 66,
        "focalY": 28,
        "startScale": 1.0,
        "endScale": 1.075
      },
      {
        "code": "LOOK 02",
        "title": "Brushed Camel Cashmere Walk",
        "subtitle": "Single-Breasted Cashmere Overcoat · Espresso Ribbed Knit",
        "image": "/images/hero-runway-2.jpg",
        "ctaLabel": "Shop Cashmere & Knit",
        "ctaUrl": "/categories/knitwear",
        "focalX": 64,
        "focalY": 24,
        "startScale": 1.0,
        "endScale": 1.08
      },
      {
        "code": "LOOK 03",
        "title": "Architectural Bespoke Tailoring",
        "subtitle": "Sculpted Obsidian Wool & Ivory Double-Breasted Suiting",
        "image": "/images/hero-runway-1.jpg",
        "ctaLabel": "Explore Tailoring",
        "ctaUrl": "/categories/tailoring",
        "focalX": 76,
        "focalY": 20,
        "startScale": 1.12,
        "endScale": 1.2
      }
    ]
  }',
  published_props_json = '{
    "eyebrow": "AUTUMN / WINTER 2026 · MENSWEAR RUNWAY",
    "headline": "DEYNOLD DANNY",
    "description": "Architectural Bespoke Tailoring & Cashmere",
    "tagline": "Architectural Bespoke Tailoring & Cashmere",
    "desktopImage": "/hero-banner.jpg",
    "videoUrl": "",
    "focalX": 66,
    "focalY": 28,
    "overlayOpacity": 16,
    "overlayColor": "#000000",
    "ctaLabel": "Shop Outerwear",
    "ctaUrl": "/categories/overcoats",
    "secondaryCtaLabel": "Explore Collection",
    "secondaryCtaUrl": "/categories",
    "runwayLooks": [
      {
        "code": "LOOK 01",
        "title": "The Monolith Overcoat Ensemble",
        "subtitle": "Obsidian Virgin Wool · Ivory Silk · Camel Cashmere",
        "image": "/images/hero-runway-1.jpg",
        "ctaLabel": "Shop Outerwear",
        "ctaUrl": "/categories/overcoats",
        "focalX": 66,
        "focalY": 28,
        "startScale": 1.0,
        "endScale": 1.075
      },
      {
        "code": "LOOK 02",
        "title": "Brushed Camel Cashmere Walk",
        "subtitle": "Single-Breasted Cashmere Overcoat · Espresso Ribbed Knit",
        "image": "/images/hero-runway-2.jpg",
        "ctaLabel": "Shop Cashmere & Knit",
        "ctaUrl": "/categories/knitwear",
        "focalX": 64,
        "focalY": 24,
        "startScale": 1.0,
        "endScale": 1.08
      },
      {
        "code": "LOOK 03",
        "title": "Architectural Bespoke Tailoring",
        "subtitle": "Sculpted Obsidian Wool & Ivory Double-Breasted Suiting",
        "image": "/images/hero-runway-1.jpg",
        "ctaLabel": "Explore Tailoring",
        "ctaUrl": "/categories/tailoring",
        "focalX": 76,
        "focalY": 20,
        "startScale": 1.12,
        "endScale": 1.2
      }
    ]
  }',
  updated_at = datetime('now')
WHERE page_id = 'page_home' AND section_type = 'hero_banner';
