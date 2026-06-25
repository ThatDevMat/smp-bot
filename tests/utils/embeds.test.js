/**
 * Tests for src/utils/embeds.js
 *
 * Verifies that every embed builder returns the correct structure,
 * colours, and content for its intended use case.
 */

const {
  statusEmbed,
  chatMessageEmbed,
  playerEventEmbed,
  advancementEmbed,
  serverEventEmbed,
  pollEmbed,
  eventAnnouncementEmbed,
  eventListEmbed,
  poiRegisteredEmbed,
  poiListEmbed,
  seasonInfoEmbed,
  activePunishmentsEmbed,
  punishmentHistoryEmbed,
  warningIssuedEmbed,
  warningDmEmbed,
  localWarningsEmbed,
  registrationEmbed,
  whoisEmbed,
  formatDuration,
} = require('../../src/utils/embeds');

/* ------------------------------------------------------------------ */
/*  statusEmbed                                                        */
/* ------------------------------------------------------------------ */

describe('statusEmbed', () => {
  it('should show online status with players and details when server is online', () => {
    const data = {
      online: true,
      players: { online: 5, max: 20, list: ['Steve', 'Alex'] },
      version: '1.21',
      software: 'Paper',
      uptime: 7200,
      motd: 'A Minecraft Server',
    };

    const embed = statusEmbed(data);

    expect(embed.data.title).toContain('Server Online');
    expect(embed.data.color).toBe(0x2ecc71);
    expect(embed.data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Players', value: '5/20' }),
        expect.objectContaining({ name: 'Version', value: '1.21' }),
        expect.objectContaining({ name: 'Software', value: 'Paper' }),
        expect.objectContaining({ name: 'Uptime', value: '2h 0m' }),
      ]),
    );
    expect(embed.data.description).toContain('A Minecraft Server');
  });

  it('should show offline status when server is offline', () => {
    const data = { online: false, players: null };

    const embed = statusEmbed(data);

    expect(embed.data.title).toContain('Server Offline');
    expect(embed.data.color).toBe(0xe74c3c);
  });

  it('should handle missing player list gracefully', () => {
    const data = {
      online: true,
      players: { online: 0, max: 20, list: [] },
    };

    const embed = statusEmbed(data);
    const playersField = embed.data.fields.find((f) => f.name === 'Players');
    expect(playersField.value).toBe('0/20');
  });

  it('should handle null players object gracefully', () => {
    const data = { online: true };

    const embed = statusEmbed(data);
    const playersField = embed.data.fields.find((f) => f.name === 'Players');
    expect(playersField.value).toBe('?/?');
  });

  it('should not add player list field when players.list is empty', () => {
    const data = {
      online: true,
      players: { online: 0, max: 20, list: [] },
      version: '1.21',
    };

    const embed = statusEmbed(data);
    const onlinePlayersField = embed.data.fields.find(
      (f) => f.name === 'Online Players',
    );
    expect(onlinePlayersField).toBeUndefined();
  });

  it('should not add fields for software and uptime when absent', () => {
    const data = {
      online: true,
      players: { online: 2, max: 20, list: ['A', 'B'] },
    };

    const embed = statusEmbed(data);
    const names = embed.data.fields.map((f) => f.name);
    expect(names).not.toContain('Software');
    expect(names).not.toContain('Uptime');
  });
});

/* ------------------------------------------------------------------ */
/*  chatMessageEmbed                                                   */
/* ------------------------------------------------------------------ */

describe('chatMessageEmbed', () => {
  it('should include the username as author and the message as description', () => {
    const embed = chatMessageEmbed('Steve', 'Hello everyone!');

    expect(embed.data.author).toEqual({ name: 'Steve' });
    expect(embed.data.description).toBe('Hello everyone!');
    expect(embed.data.color).toBe(0x3498db);
  });

  it('should use fallback values when arguments are missing', () => {
    const embed = chatMessageEmbed(null, null);

    expect(embed.data.author).toEqual({ name: 'Unknown' });
    expect(embed.data.description).toBe('\u200B');
  });
});

/* ------------------------------------------------------------------ */
/*  playerEventEmbed                                                   */
/* ------------------------------------------------------------------ */

describe('playerEventEmbed', () => {
  it('should format join events', () => {
    const embed = playerEventEmbed('Steve', 'join');

    expect(embed.data.title).toContain('Player Joined');
    expect(embed.data.description).toContain('Steve');
    expect(embed.data.color).toBe(0x2ecc71);
  });

  it('should format leave events', () => {
    const embed = playerEventEmbed('Alex', 'leave');

    expect(embed.data.title).toContain('Player Left');
    expect(embed.data.color).toBe(0xe74c3c);
  });

  it('should format death events', () => {
    const embed = playerEventEmbed('Steve', 'death');

    expect(embed.data.title).toContain('Player Died');
    expect(embed.data.color).toBe(0x95a5a6);
  });

  it('should handle unknown event types gracefully', () => {
    const embed = playerEventEmbed('Test', 'unknown_type');

    expect(embed.data.title).toBe('unknown_type');
  });

  it('should handle null username', () => {
    const embed = playerEventEmbed(null, 'join');

    expect(embed.data.description).toContain('???');
  });
});

/* ------------------------------------------------------------------ */
/*  advancementEmbed                                                   */
/* ------------------------------------------------------------------ */

describe('advancementEmbed', () => {
  it('should include username, advancement title, and description', () => {
    const embed = advancementEmbed('Steve', 'Getting Wood', 'Punch a tree');

    expect(embed.data.title).toContain('Advancement Unlocked');
    expect(embed.data.description).toContain('Steve');
    expect(embed.data.description).toContain('Getting Wood');
    expect(embed.data.footer).toEqual({ text: 'Punch a tree' });
    expect(embed.data.color).toBe(0xf1c40f);
  });

  it('should use no footer when description is not provided', () => {
    const embed = advancementEmbed('Steve', 'Getting Wood');

    expect(embed.data.footer).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  serverEventEmbed                                                   */
/* ------------------------------------------------------------------ */

describe('serverEventEmbed', () => {
  it('should format server start events', () => {
    const embed = serverEventEmbed('start');

    expect(embed.data.title).toContain('Server Started');
    expect(embed.data.color).toBe(0x2ecc71);
  });

  it('should format server stop events', () => {
    const embed = serverEventEmbed('stop');

    expect(embed.data.title).toContain('Server Stopped');
    expect(embed.data.color).toBe(0xe74c3c);
  });

  it('should handle unknown event types', () => {
    const embed = serverEventEmbed('restart');

    expect(embed.data.title).toBe('restart');
    expect(embed.data.color).toBe(0x95a5a6);
  });
});

/* ------------------------------------------------------------------ */
/*  pollEmbed                                                          */
/* ------------------------------------------------------------------ */

describe('pollEmbed', () => {
  it('should include the question and numbered options', () => {
    const embed = pollEmbed('Best biome?', ['Plains', 'Forest', 'Desert']);

    expect(embed.data.title).toContain('Best biome?');
    expect(embed.data.description).toContain('Plains');
    expect(embed.data.description).toContain('Forest');
    expect(embed.data.description).toContain('Desert');
    expect(embed.data.color).toBe(0x9b59b6);
  });

  it('should handle up to 4 options', () => {
    const embed = pollEmbed('Test', ['A', 'B', 'C', 'D']);

    expect(embed.data.description).toContain('A');
    expect(embed.data.description).toContain('D');
  });
});

/* ------------------------------------------------------------------ */
/*  eventAnnouncementEmbed                                             */
/* ------------------------------------------------------------------ */

describe('eventAnnouncementEmbed', () => {
  const event = {
    name: 'Dragon Fight',
    description: 'Kill the Ender Dragon together',
    event_date: '2026-07-01',
    event_time: '20:00',
    timezone: 'UTC',
  };

  it('should include all event details', () => {
    const embed = eventAnnouncementEmbed(event);

    expect(embed.data.title).toContain('Dragon Fight');
    expect(embed.data.description).toBe('Kill the Ender Dragon together');
    expect(embed.data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Date', value: '2026-07-01' }),
        expect.objectContaining({ name: 'Time', value: '20:00 UTC' }),
      ]),
    );
    expect(embed.data.color).toBe(0x1abc9c);
  });

  it('should use fallback description when none given', () => {
    const embed = eventAnnouncementEmbed({ ...event, description: null });

    expect(embed.data.description).toBe('No description provided.');
  });
});

/* ------------------------------------------------------------------ */
/*  eventListEmbed                                                     */
/* ------------------------------------------------------------------ */

describe('eventListEmbed', () => {
  it('should return one embed per event', () => {
    const events = [
      {
        id: 1,
        name: 'A',
        event_date: '2026-07-01',
        event_time: '20:00',
        timezone: 'UTC',
        cancelled: 0,
      },
      {
        id: 2,
        name: 'B',
        event_date: '2026-07-02',
        event_time: '18:00',
        timezone: 'EST',
        cancelled: 0,
      },
    ];

    const embeds = eventListEmbed(events);

    expect(embeds).toHaveLength(2);
    expect(embeds[0].data.title).toContain('A');
    expect(embeds[1].data.title).toContain('B');
  });
});

/* ------------------------------------------------------------------ */
/*  POI embeds                                                         */
/* ------------------------------------------------------------------ */

describe('POI embeds', () => {
  it('poiRegisteredEmbed should include location and dimension details', () => {
    const poi = {
      name: 'Spawn',
      x: 0,
      y: 64,
      z: 0,
      dimension: 'overworld',
      description: 'Town center',
    };
    const embed = poiRegisteredEmbed(poi);

    expect(embed.data.title).toBe('\u{1F4CD} POI Registered');
    expect(embed.data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Location', value: '`0, 64, 0`' }),
        expect.objectContaining({
          name: 'Dimension',
          value: expect.stringContaining('overworld'),
        }),
      ]),
    );
  });

  it('poiListEmbed should create a paginated embed with POI fields', () => {
    const pois = [
      {
        name: 'A',
        x: 1,
        y: 2,
        z: 3,
        dimension: 'nether',
        description: 'Portal',
      },
      { name: 'B', x: 4, y: 5, z: 6, dimension: 'the_end', description: null },
    ];
    const embed = poiListEmbed(pois, 1, 1);

    expect(embed.data.fields).toHaveLength(2);
    expect(embed.data.fields[0].name).toBe('A');
    expect(embed.data.fields[1].name).toBe('B');
    expect(embed.data.footer).toEqual({ text: 'Page 1/1' });
  });
});

/* ------------------------------------------------------------------ */
/*  seasonInfoEmbed                                                     */
/* ------------------------------------------------------------------ */

describe('seasonInfoEmbed', () => {
  const season = { season_number: 5, start_date: '2026-06-01', seed: '12345' };

  it('should display season number, start date, and days elapsed', () => {
    const embed = seasonInfoEmbed(season, 24);

    expect(embed.data.title).toContain('Season 5');
    expect(embed.data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: '#5' }),
        expect.objectContaining({ name: 'Start Date', value: '2026-06-01' }),
        expect.objectContaining({ name: 'Days Elapsed', value: '24 days' }),
      ]),
    );
  });

  it('should include seed when present', () => {
    const embed = seasonInfoEmbed(season, 24);

    expect(embed.data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'World Seed', value: '`12345`' }),
      ]),
    );
  });

  it('should omit seed field when seed is null', () => {
    const embed = seasonInfoEmbed({ ...season, seed: null }, 24);

    const seedField = embed.data.fields.find((f) => f.name === 'World Seed');
    expect(seedField).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  activePunishmentsEmbed                                              */
/* ------------------------------------------------------------------ */

describe('activePunishmentsEmbed', () => {
  it('should list each punishment with type, reason, and duration', () => {
    const punishments = [
      {
        type: 'ban',
        reason: 'Griefing',
        start: '2026-06-01T00:00:00Z',
        end: null,
        executor: 'Admin',
      },
    ];

    const embed = activePunishmentsEmbed('Steve', punishments);

    expect(embed.data.title).toContain('Steve');
    expect(embed.data.fields[0].name).toContain('BAN');
    expect(embed.data.fields[0].value).toContain('Griefing');
    expect(embed.data.fields[0].value).toContain('Permanent');
  });

  it('should show expiry date when end is set', () => {
    const punishments = [
      {
        type: 'mute',
        reason: 'Spam',
        start: '2026-06-01T00:00:00Z',
        end: '2026-06-08T00:00:00Z',
        executor: 'Mod',
      },
    ];

    const embed = activePunishmentsEmbed('Alex', punishments);

    expect(embed.data.fields[0].value).toContain('Expires:');
  });

  it('should handle missing reason and executor', () => {
    const punishments = [
      {
        type: 'warn',
        reason: null,
        start: '2026-06-01T00:00:00Z',
        end: null,
        executor: null,
      },
    ];

    const embed = activePunishmentsEmbed('Test', punishments);

    expect(embed.data.fields[0].value).toContain('No reason provided');
    expect(embed.data.fields[0].value).toContain('Unknown');
  });
});

/* ------------------------------------------------------------------ */
/*  punishmentHistoryEmbed                                              */
/* ------------------------------------------------------------------ */

describe('punishmentHistoryEmbed', () => {
  it('should show recent entries and total count in footer', () => {
    const history = [
      {
        type: 'ban',
        reason: 'Xray',
        start: '2026-06-01T00:00:00Z',
        end: null,
        active: false,
        executor: 'Admin',
      },
      {
        type: 'mute',
        reason: 'Spam',
        start: '2026-06-05T00:00:00Z',
        end: null,
        active: true,
        executor: 'Mod',
      },
    ];

    const embed = punishmentHistoryEmbed('Steve', history);

    expect(embed.data.fields).toHaveLength(2);
    expect(embed.data.footer).toEqual({ text: 'Total entries: 2' });
    expect(embed.data.fields[0].name).toContain('Expired');
    expect(embed.data.fields[1].name).toContain('Active');
  });

  it('should add a "showing N of M" note when there are more than 10 entries', () => {
    const history = Array.from({ length: 15 }, (_, i) => ({
      type: 'ban',
      reason: 'Test',
      start: '2026-06-01T00:00:00Z',
      end: null,
      active: false,
      executor: 'Admin',
    }));

    const embed = punishmentHistoryEmbed('Steve', history);

    expect(embed.data.fields).toHaveLength(10);
    expect(embed.data.description).toContain('Showing 10 of 15');
  });
});

/* ------------------------------------------------------------------ */
/*  Warning embeds                                                     */
/* ------------------------------------------------------------------ */

describe('Warning embeds', () => {
  it('warningIssuedEmbed should contain player, reason, and issuer', () => {
    const embed = warningIssuedEmbed('Steve', 'abc123', 'Griefing', 'admin123');

    expect(embed.data.title).toContain('Warning Issued');
    expect(embed.data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Reason', value: 'Griefing' }),
        expect.objectContaining({ name: 'Issued By', value: '<@admin123>' }),
      ]),
    );
  });

  it('warningDmEmbed should include reason and mc username', () => {
    const embed = warningDmEmbed('Steve', 'Griefing');

    expect(embed.data.title).toContain('You Have Been Warned');
    expect(embed.data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Minecraft Account',
          value: '`Steve`',
        }),
        expect.objectContaining({ name: 'Reason', value: 'Griefing' }),
      ]),
    );
  });

  it('localWarningsEmbed should list warnings and show total', () => {
    const warnings = [
      { id: 1, reason: 'First', issued_by: 'admin1', issued_at: '2026-06-01' },
      { id: 2, reason: 'Second', issued_by: 'admin2', issued_at: '2026-06-02' },
    ];

    const embed = localWarningsEmbed('Steve', warnings);

    expect(embed.data.fields).toHaveLength(2);
    expect(embed.data.footer).toEqual({ text: 'Total: 2' });
    expect(embed.data.fields[0].value).toContain('First');
    expect(embed.data.fields[1].value).toContain('Second');
  });

  it('localWarningsEmbed should cap at 10 entries and show overflow note', () => {
    const warnings = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      reason: `W${i}`,
      issued_by: 'admin',
      issued_at: '2026-06-01',
    }));

    const embed = localWarningsEmbed('Steve', warnings);

    expect(embed.data.fields).toHaveLength(10);
    expect(embed.data.description).toContain('Showing 10 of 12');
  });
});

/* ------------------------------------------------------------------ */
/*  Player registry embeds                                             */
/* ------------------------------------------------------------------ */

describe('Player registry embeds', () => {
  const profile = { username: 'Steve', uuid: 'abc123def456' };

  it('registrationEmbed should show the linked account', () => {
    const embed = registrationEmbed(profile, 'discord123');

    expect(embed.data.title).toContain('Registration Successful');
    expect(embed.data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: '`Steve`' }),
        expect.objectContaining({ value: '`abc123def456`' }),
        expect.objectContaining({ value: '<@discord123>' }),
      ]),
    );
  });

  it('whoisEmbed should show player details', () => {
    const reg = {
      discord_id: 'discord123',
      minecraft_username: 'Steve',
      minecraft_uuid: 'abc123def456',
      registered_at: '2026-06-01',
    };

    const embed = whoisEmbed(reg);

    expect(embed.data.title).toBe('Player Lookup');
    expect(embed.data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Minecraft Username',
          value: '`Steve`',
        }),
        expect.objectContaining({ name: 'Registered', value: '2026-06-01' }),
      ]),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  formatDuration                                                     */
/* ------------------------------------------------------------------ */

describe('formatDuration', () => {
  it('should format days, hours, minutes', () => {
    const ms = (2 * 86400 + 3 * 3600 + 15 * 60) * 1000;
    expect(formatDuration(ms)).toBe('2d 3h 15m');
  });

  it('should show only minutes when under an hour', () => {
    expect(formatDuration(5 * 60 * 1000)).toBe('5m');
  });

  it('should show only seconds when under a minute', () => {
    expect(formatDuration(42 * 1000)).toBe('42s');
  });

  it('should return "now" for zero or near-zero input', () => {
    expect(formatDuration(0)).toBe('now');
    expect(formatDuration(500)).toBe('now');
  });
});
