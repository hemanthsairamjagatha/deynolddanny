-- =============================================================================
-- DEYNOLD DANNY — Enable Live 1080p Veo 3.1 Menswear Walking Runway Film
-- Migration: 0011_menswear_runway_video.sql
-- =============================================================================

UPDATE cms_sections
SET
  draft_props_json = json_set(draft_props_json, '$.videoUrl', '/hero-runway.mp4'),
  published_props_json = json_set(published_props_json, '$.videoUrl', '/hero-runway.mp4'),
  updated_at = datetime('now')
WHERE page_id = 'page_home' AND section_type = 'hero_banner';
