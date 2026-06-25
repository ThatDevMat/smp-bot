/**
 * Tests for moderation commands: /checkbans, /history, /warn, /warnings.
 */

jest.mock('../../src/integrations/advancedbans');
jest.mock('../../src/integrations/mojang');
jest.mock('../../src/db');
jest.mock('../../src/utils/permissions');

const { createMockInteraction, setTestEnv } = require('../setup');

beforeAll(setTestEnv);

const advancedbans = require('../../src/integrations/advancedbans');
const mojang = require('../../src/integrations/mojang');
const db = require('../../src/db');
const permissions = require('../../src/utils/permissions');

const checkbansCommand = require('../../src/commands/checkbans');
const historyCommand = require('../../src/commands/history');
const warnCommand = require('../../src/commands/warn');
const warningsCommand = require('../../src/commands/warnings');

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Sets up player resolution via the playerResolver, which calls
 * mojang.getUuidByUsername when the input is not a UUID.
 */
function mockPlayerResolution(username, uuid) {
  // The command uses resolvePlayer which calls mojang.getUuidByUsername
  // for non-UUID inputs.  We mock the Mojang call here.
  if (uuid) {
    mojang.getUuidByUsername.mockResolvedValue({ uuid, username });
  } else {
    mojang.getUuidByUsername.mockResolvedValue(null);
  }
}

/* ------------------------------------------------------------------ */
/*  /checkbans                                                         */
/* ------------------------------------------------------------------ */

describe('/checkbans', () => {
  let interaction;

  beforeEach(() => {
    jest.clearAllMocks();
    interaction = createMockInteraction({ isStaff: true });
    permissions.requireStaff.mockReturnValue(true);
    interaction.options._setOption('player', 'Steve');
  });

  it('should show active punishments for a player looked up by username', async () => {
    interaction.options.getSubcommand
      ? jest.fn()
      : null;
    mockPlayerResolution('Steve', 'abc123');
    advancedbans.getActivePunishments.mockResolvedValue([
      { type: 'ban', reason: 'Griefing', start: '2026-06-01T00:00:00Z', end: null, executor: 'Admin' },
    ]);

    await checkbansCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalled();
    const embed = interaction._lastEmbeds[0];
    expect(embed.data.title).toContain('Active Punishments');
    expect(embed.data.fields[0].name).toContain('BAN');
  });

  it('should show clean message when no active punishments exist', async () => {
    mockPlayerResolution('Steve', 'abc123');
    advancedbans.getActivePunishments.mockResolvedValue([]);

    await checkbansCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining('no active punishments'),
    });
  });

  it('should report unknown players', async () => {
    mockPlayerResolution('Unknown', null);

    await checkbansCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining('Could not find'),
    });
    expect(advancedbans.getActivePunishments).not.toHaveBeenCalled();
  });

  it('should require staff role', async () => {
    permissions.requireStaff.mockReturnValue(false);

    await checkbansCommand.execute(interaction);

    expect(advancedbans.getActivePunishments).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    mockPlayerResolution('Steve', 'abc123');
    advancedbans.getActivePunishments.mockRejectedValue(new Error('Connection lost'));

    await checkbansCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining('Could not query'),
    });
  });
});

/* ------------------------------------------------------------------ */
/*  /history                                                           */
/* ------------------------------------------------------------------ */

describe('/history', () => {
  let interaction;

  beforeEach(() => {
    jest.clearAllMocks();
    interaction = createMockInteraction({ isStaff: true });
    permissions.requireStaff.mockReturnValue(true);
    interaction.options._setOption('player', 'Steve');
  });

  it('should show punishment history for a player', async () => {
    mockPlayerResolution('Steve', 'abc123');
    advancedbans.getPunishmentHistory.mockResolvedValue([
      { type: 'ban', reason: 'Hacking', start: '2026-01-01T00:00:00Z', end: null, active: false, executor: 'Admin' },
      { type: 'mute', reason: 'Spam', start: '2026-03-01T00:00:00Z', end: null, active: true, executor: 'Mod' },
    ]);

    await historyCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalled();
    const embed = interaction._lastEmbeds[0];
    expect(embed.data.title).toContain('Punishment History');
    expect(embed.data.fields).toHaveLength(2);
  });

  it('should show clean message when player has no history', async () => {
    mockPlayerResolution('Steve', 'abc123');
    advancedbans.getPunishmentHistory.mockResolvedValue([]);

    await historyCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining('no punishment history'),
    });
  });

  it('should require staff role', async () => {
    permissions.requireStaff.mockReturnValue(false);

    await historyCommand.execute(interaction);

    expect(advancedbans.getPunishmentHistory).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  /warn                                                              */
/* ------------------------------------------------------------------ */

describe('/warn', () => {
  let interaction;

  beforeEach(() => {
    jest.clearAllMocks();
    interaction = createMockInteraction({ isStaff: true });
    permissions.requireStaff.mockReturnValue(true);
    interaction.options._setOption('player', 'Steve');
    interaction.options._setOption('reason', 'Griefing');
    interaction.client.users.fetch = jest.fn().mockResolvedValue({
      send: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('should issue a warning and store it', async () => {
    mockPlayerResolution('Steve', 'abc123');
    db.getPlayerByUuid.mockReturnValue(null);

    await warnCommand.execute(interaction);

    expect(db.addWarning).toHaveBeenCalledWith({
      playerUuid: 'abc123',
      discordId: null,
      reason: 'Griefing',
      issuedBy: '111111',
    });
    expect(interaction.editReply).toHaveBeenCalled();
    const embed = interaction._lastEmbeds[0];
    expect(embed.data.title).toContain('Warning Issued');
  });

  it('should DM the player when their Discord account is linked', async () => {
    mockPlayerResolution('Steve', 'abc123');
    db.getPlayerByUuid.mockReturnValue({ discord_id: '222222' });

    await warnCommand.execute(interaction);

    expect(interaction.client.users.fetch).toHaveBeenCalledWith('222222');
  });

  it('should handle unknown players', async () => {
    mockPlayerResolution('Unknown', null);

    await warnCommand.execute(interaction);

    expect(db.addWarning).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining('Could not find'),
    });
  });

  it('should require staff role', async () => {
    permissions.requireStaff.mockReturnValue(false);

    await warnCommand.execute(interaction);

    expect(db.addWarning).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    mockPlayerResolution('Steve', 'abc123');
    db.getPlayerByUuid.mockImplementation(() => { throw new Error('DB error'); });

    await warnCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining('error'),
    });
  });
});

/* ------------------------------------------------------------------ */
/*  /warnings                                                          */
/* ------------------------------------------------------------------ */

describe('/warnings', () => {
  let interaction;

  beforeEach(() => {
    jest.clearAllMocks();
    interaction = createMockInteraction({ isStaff: true });
    permissions.requireStaff.mockReturnValue(true);
    interaction.options._setOption('player', 'Steve');
  });

  it('should show local warnings for a player', async () => {
    mockPlayerResolution('Steve', 'abc123');
    db.getWarningsByUuid.mockReturnValue([
      { id: 1, reason: 'First warning', issued_by: 'admin1', issued_at: '2026-06-01' },
    ]);

    await warningsCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalled();
    const embed = interaction._lastEmbeds[0];
    expect(embed.data.title).toContain('Local Warnings');
  });

  it('should show clean message when player has no warnings', async () => {
    mockPlayerResolution('Steve', 'abc123');
    db.getWarningsByUuid.mockReturnValue([]);

    await warningsCommand.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining('no local warnings'),
    });
  });

  it('should require staff role', async () => {
    permissions.requireStaff.mockReturnValue(false);

    await warningsCommand.execute(interaction);

    expect(db.getWarningsByUuid).not.toHaveBeenCalled();
  });
});
