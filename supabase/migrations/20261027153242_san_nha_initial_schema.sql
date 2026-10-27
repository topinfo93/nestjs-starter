CREATE TABLE "competitions" (
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "area" TEXT,
  "emblem" TEXT,
  "seasonYear" INTEGER,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "competitions_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "teams" (
  "id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "short_name" TEXT,
  "tla" TEXT,
  "crest" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "matches" (
  "id" INTEGER NOT NULL,
  "competition_code" TEXT NOT NULL,
  "season_year" INTEGER,
  "utc_date" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL,
  "matchday" INTEGER,
  "stage" TEXT,
  "home_team_id" INTEGER NOT NULL,
  "away_team_id" INTEGER NOT NULL,
  "home_score" INTEGER,
  "away_score" INTEGER,
  "last_updated" TIMESTAMP(3),
  CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "matches_utc_date_idx" ON "matches"("utc_date");
CREATE INDEX "matches_competition_code_utc_date_idx" ON "matches"("competition_code", "utc_date");

CREATE TABLE "standings" (
  "id" SERIAL NOT NULL,
  "competition_code" TEXT NOT NULL,
  "season_year" INTEGER NOT NULL,
  "team_id" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "played_games" INTEGER NOT NULL,
  "won" INTEGER NOT NULL,
  "draw" INTEGER NOT NULL,
  "lost" INTEGER NOT NULL,
  "points" INTEGER NOT NULL,
  "goals_for" INTEGER NOT NULL,
  "goals_against" INTEGER NOT NULL,
  "goal_difference" INTEGER NOT NULL,
  "group" TEXT,
  CONSTRAINT "standings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "standings_competition_code_season_year_team_id_key" ON "standings"("competition_code", "season_year", "team_id");
CREATE INDEX "standings_competition_code_season_year_position_idx" ON "standings"("competition_code", "season_year", "position");

CREATE TABLE "sync_states" (
  "key" TEXT NOT NULL,
  "fetched_at" TIMESTAMP(3),
  "status" TEXT NOT NULL,
  "error" TEXT,
  "last_attempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sync_states_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "articles" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "excerpt" TEXT,
  "content" TEXT NOT NULL,
  "cover_image" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "is_sample" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "published_at" TIMESTAMP(3),
  CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");
CREATE INDEX "articles_status_published_at_idx" ON "articles"("status", "published_at");

ALTER TABLE "matches" ADD CONSTRAINT "matches_competition_code_fkey" FOREIGN KEY ("competition_code") REFERENCES "competitions"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "standings" ADD CONSTRAINT "standings_competition_code_fkey" FOREIGN KEY ("competition_code") REFERENCES "competitions"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "standings" ADD CONSTRAINT "standings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "standings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sync_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "articles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "competitions", "teams", "matches", "standings", "sync_states", "articles" FROM anon, authenticated;
REVOKE ALL ON SEQUENCE "standings_id_seq" FROM anon, authenticated;
