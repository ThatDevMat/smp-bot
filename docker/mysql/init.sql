-- AdvancedBans seed data for local Docker development.
-- Table names and columns match what src/integrations/advancedbans.js queries.
--
-- If AdvancedBans updates its schema in production, update both this file
-- AND src/integrations/advancedbans.js together.
--
-- Two tables:
--   punishments       — active AND historical entries (bot queries both here)
--   player_aliases    — username ↔ UUID resolution

/* ------------------------------------------------------------------ */
/*  punishments                                                        */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS punishments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL,
  type VARCHAR(16) NOT NULL,
  reason TEXT NOT NULL,
  executor VARCHAR(36) NOT NULL,
  start BIGINT NOT NULL,
  end BIGINT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1
);

/* ------------------------------------------------------------------ */
/*  player_aliases                                                     */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS player_aliases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL,
  name VARCHAR(16) NOT NULL,
  lastSeen BIGINT NOT NULL
);

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

-- Insert known players first (aliases table).
INSERT INTO player_aliases (uuid, name, lastSeen) VALUES
  ('8532b8f3-2a4c-4b5d-9e6f-7a8b9c0d1e2f', 'Steve',      1728000000000),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Alex',       1727900000000),
  ('f1e2d3c4-b5a6-7890-abcd-ef0987654321', 'Notch',      1727800000000),
  ('00000000-0000-0000-0000-000000000001', 'Herobrine',  1727700000000),
  ('11111111-1111-1111-1111-111111111111', 'BuildMaster', 1727600000000);

-- Active bans
INSERT INTO punishments (uuid, type, reason, executor, start, end, active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'ban',  'Exploiting dupe glitch on the server',         'Admin',          1727500000000, 0,                            1),
  ('f1e2d3c4-b5a6-7890-abcd-ef0987654321', 'ban',  'Griefing spawn and stealing from chests',      'Admin',          1727000000000, 1735689600000,                  1);

-- Active mutes
INSERT INTO punishments (uuid, type, reason, executor, start, end, active) VALUES
  ('8532b8f3-2a4c-4b5d-9e6f-7a8b9c0d1e2f', 'mute', 'Excessive swearing in global chat',            'Moderator',      1727200000000, 1727800000000,                  1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'mute', 'Spamming invites to external Discord servers', 'Moderator',      1727400000000, 0,                            1);

-- Active warning
INSERT INTO punishments (uuid, type, reason, executor, start, end, active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'warn', 'Building too close to another players base',    'Admin',          1727300000000, 0,                            1);

-- Historical (expired / inactive) punishments
INSERT INTO punishments (uuid, type, reason, executor, start, end, active) VALUES
  ('8532b8f3-2a4c-4b5d-9e6f-7a8b9c0d1e2f', 'ban',  'X-ray resource pack (temp ban)',               'Admin',          1726000000000, 1726600000000,                  0),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'ban',  'Minor griefing (resolved)',                     'Moderator',      1725500000000, 1726100000000,                  0),
  ('8532b8f3-2a4c-4b5d-9e6f-7a8b9c0d1e2f', 'mute', 'Argued with staff in chat',                    'Admin',          1725000000000, 1725600000000,                  0),
  ('11111111-1111-1111-1111-111111111111', 'warn', 'Unsafe building without torches (first offence)','Moderator',      1724500000000, 0,                            0),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'mute', 'Advertising non-whitelisted server',            'Admin',          1724000000000, 1724600000000,                  0);
