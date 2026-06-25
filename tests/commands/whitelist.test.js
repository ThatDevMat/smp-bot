/**
 * Tests for /whitelist command.
 */

jest.mock('../../src/integrations/rcon');
jest.mock('../../src/utils/permissions');

const { createMockInteraction, setTestEnv } = require('../setup');

beforeAll(setTestEnv);

const rcon = require('../../src/integrations/rcon');
const permissions = require('../../src/utils/permissions');
const whitelistCommand = require('../../src/commands/whitelist');

describe('/whitelist', () => {
  let interaction;

  beforeEach(() => {
    jest.clearAllMocks();
    interaction = createMockInteraction();
    permissions.requireStaff.mockReturnValue(true);
  });

  describe('add', () => {
    it('should add a valid username to the whitelist via RCON', async () => {
      interaction.options.getSubcommand.mockReturnValue('add');
      interaction.options._setOption('username', 'Steve');
      rcon.whitelistAdd.mockResolvedValue('Added Steve to whitelist');

      await whitelistCommand.execute(interaction);

      expect(rcon.whitelistAdd).toHaveBeenCalledWith('Steve');
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('added'),
      });
    });

    it('should reject invalid usernames', async () => {
      interaction.options.getSubcommand.mockReturnValue('add');
      interaction.options._setOption('username', 'Steve; op Notch');
      rcon.whitelistAdd.mockRejectedValue(new Error('Invalid Minecraft username'));

      await whitelistCommand.execute(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('Could not'),
      });
    });

    it('should require staff role', async () => {
      permissions.requireStaff.mockReturnValue(false);
      interaction.options.getSubcommand.mockReturnValue('add');

      await whitelistCommand.execute(interaction);

      expect(rcon.whitelistAdd).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a valid username from the whitelist via RCON', async () => {
      interaction.options.getSubcommand.mockReturnValue('remove');
      interaction.options._setOption('username', 'Alex');
      rcon.whitelistRemove.mockResolvedValue('Removed Alex from whitelist');

      await whitelistCommand.execute(interaction);

      expect(rcon.whitelistRemove).toHaveBeenCalledWith('Alex');
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('removed'),
      });
    });

    it('should show friendly error when RCON is down', async () => {
      interaction.options.getSubcommand.mockReturnValue('remove');
      interaction.options._setOption('username', 'Alex');
      rcon.whitelistRemove.mockRejectedValue(new Error('Connection refused'));

      await whitelistCommand.execute(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('Could not'),
      });
    });
  });
});
