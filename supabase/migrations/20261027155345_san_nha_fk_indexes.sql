CREATE INDEX IF NOT EXISTS "matches_home_team_id_idx" ON public.matches("home_team_id");
CREATE INDEX IF NOT EXISTS "matches_away_team_id_idx" ON public.matches("away_team_id");
CREATE INDEX IF NOT EXISTS "standings_team_id_idx" ON public.standings("team_id");
