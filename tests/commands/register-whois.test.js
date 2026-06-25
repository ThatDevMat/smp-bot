/**
 * Tests for /register and /whois commands.
 */

jest.mock('../../src/integrations/mojang');
jest.mock('../../src/db');

const { createMockInteraction, setTestEnv } = require('../setup');

beforeAll(setTestEnv);

const mojang = require('../../src/integrations/mojang');
const db = require('../../src/db');
const registerCommand = require('../../src/commands/register');
const whoisCommand = require('../../src/commands/whois');

/* ------------------------------------------------------------------ */
/*  /register                                                          */
/* ------------------------------------------------------------------ */

describe('/register', () => {
  let interaction;

  beforeEach(() => {
    jest.clearAllMocks();
    interaction = createMockInteraction();
    interaction.options.getSubcommand
      ? jest.fn().mockReturnValue('register')
      : null;
    interaction.options._setOption('minecraft_username', 'Steve');
  });

  it('should register a verified Minecraft account', async () => {
    mojang.getUuidByUsername.mockResolvedValue({
      uuid: 'abc123def456abc123def456abc12345',
      username: 'Steve',
    });

    await registerCommand.execute(interaction);

    expect(mojang.getUuidByUsername).toHaveBeenCalledWith('Steve');
    expect(db.registerPlayer).toHaveBeenCalledWith(
      '111111',
      'Steve',
      'abc123def456abc123def456abc12345',
    );
    expect(interaction.editReply).toHaveBeenCalled();
    const embed = interaction._lastEmbeds[0];
    expect(embed.data.title).toContain('Registration Successful');
  });

  it('should show error when Mojang API returns no match', async () => {
    mojang.getUuidByUsername.mockResolvedValue(null);

    await registerCommand.execute(interaction);

    expect(db.registerPlayer).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining('Could not find'),
    });
  });

  it('should show friendly error when Mojang API is unavailable', async () => {
    mojang.getUuidByUsername.mockRejectedValue(new Error('API timeout'));

    await registerCommand.execute(interaction);

    expect(db.registerPlayer).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining('temporarily unavailable'),
    });
  });
});

/* ------------------------------------------------------------------ */
/*  /whois                                                             */
/* ------------------------------------------------------------------ */

describe('/whois', () => {
  let interaction;

  beforeEach(() => {
    jest.clearAllMocks();
    interaction = createMockInteraction();
  });

  it('should show player details when the user is registered', async () => {
    const targetUser = { id: '222222', tag: 'TestUser#1234' };
    interaction.options.getUser.mockReturnValue(targetUser);

    db.getPlayerByDiscord.mockReturnValue({
      discord_id: '222222',
      minecraft_username: 'Alex',
      minecraft_uuid: 'def456',
      registered_at: '2026-01-15T12:00:00Z',
    });

    await whoisCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalled();
    const embed = interaction._lastEmbeds[0];
    expect(embed.data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Minecraft Username',
          value: '`Alex`',
        }),
      ]),
    );
  });

  it('should tell the user to register when not found', async () => {
    const targetUser = { id: '222222', tag: 'TestUser#1234' };
    interaction.options.getUser.mockReturnValue(targetUser);
    db.getPlayerByDiscord.mockReturnValue(undefined);

    await whoisCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('not registered'),
      ephemeral: true,
    });
  });

  it('should handle database errors gracefully', async () => {
    const targetUser = { id: '222222', tag: 'TestUser#1234' };
    interaction.options.getUser.mockReturnValue(targetUser);
    db.getPlayerByDiscord.mockImplementation(() => {
      throw new Error('DB error');
    });

    await whoisCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('error'),
      ephemeral: true,
    });
  });
});
