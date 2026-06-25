/**
 * Tests for src/utils/playerResolver.js
 *
 * The resolver delegates to mojang.getUuidByUsername() when the input
 * is not already a UUID, so we mock that module.
 */

jest.mock('../../src/integrations/mojang');

const { resolvePlayer } = require('../../src/utils/playerResolver');
const mojang = require('../../src/integrations/mojang');

describe('resolvePlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return uuid and input as username when input is a plain UUID', async () => {
    const result = await resolvePlayer('abc123def456abc123def456abc12345');

    expect(result).toEqual({
      uuid: 'abc123def456abc123def456abc12345',
      username: 'abc123def456abc123def456abc12345',
    });
    expect(mojang.getUuidByUsername).not.toHaveBeenCalled();
  });

  it('should strip hyphens and return input as username for hyphenated UUIDs', async () => {
    const result = await resolvePlayer('abc123de-f456-abc1-23de-f456abc12345');

    expect(result).toEqual({
      uuid: 'abc123def456abc123def456abc12345',
      username: 'abc123de-f456-abc1-23de-f456abc12345',
    });
  });

  it('should call Mojang API when input is a username', async () => {
    mojang.getUuidByUsername.mockResolvedValue({
      uuid: 'abc123def456abc123def456abc12345',
      username: 'Steve',
    });

    const result = await resolvePlayer('Steve');

    expect(mojang.getUuidByUsername).toHaveBeenCalledWith('Steve');
    expect(result).toEqual({
      uuid: 'abc123def456abc123def456abc12345',
      username: 'Steve',
    });
  });

  it('should return null when Mojang API returns no profile', async () => {
    mojang.getUuidByUsername.mockResolvedValue(null);

    const result = await resolvePlayer('UnknownPlayer');

    expect(result).toBeNull();
  });

  it('should propagate Mojang API errors', async () => {
    mojang.getUuidByUsername.mockRejectedValue(new Error('API error'));

    await expect(resolvePlayer('Steve')).rejects.toThrow('API error');
  });
});
