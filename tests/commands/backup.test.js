/**
 * Tests for /backup command.
 *
 * Mocks the backup module and permissions so no real backup runs.
 */

const { createMockInteraction, setTestEnv } = require('../setup');

beforeAll(setTestEnv);

jest.mock('../../src/utils/backup');
jest.mock('../../src/utils/permissions');

const permissions = require('../../src/utils/permissions');
const backup = require('../../src/utils/backup');
const backupCommand = require('../../src/commands/backup');

describe('/backup', () => {
  let interaction;

  beforeEach(() => {
    jest.clearAllMocks();
    interaction = createMockInteraction();

    // Default: user is staff and backup succeeds.
    permissions.requireStaff.mockReturnValue(true);
    backup.runBackup.mockResolvedValue({
      fileName: 'backup-2026-01-15T03-00-00.db.gz',
      sizeBytes: 50000,
      durationMs: 1234,
    });
  });

  it('should trigger a backup and reply with an embed when staff runs it', async () => {
    await backupCommand.execute(interaction);

    expect(backup.runBackup).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalled();

    // Verify embed was passed.
    const replyArgs = interaction.editReply.mock.calls[0][0];
    expect(replyArgs.embeds).toBeDefined();
    expect(replyArgs.embeds.length).toBe(1);
    // EmbedBuilder stores data in .data — check title.
    const embed = replyArgs.embeds[0];
    const title = embed.data?.title || embed.title;
    expect(title).toContain('Backup Complete');
  });

  it('should not run backup when non-staff user runs it', async () => {
    permissions.requireStaff.mockImplementation(() => {
      // Simulate the real requireStaff behavior (reply + return false).
      return false;
    });

    await backupCommand.execute(interaction);

    expect(backup.runBackup).not.toHaveBeenCalled();
  });

  it('should reply with error message when backup fails', async () => {
    backup.runBackup.mockRejectedValue(new Error('Disk full'));

    await backupCommand.execute(interaction);

    expect(backup.runBackup).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining('Backup failed'),
    });
  });
});
