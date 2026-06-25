/**
 * Tests for src/utils/permissions.js
 *
 * Covers staff-role detection and the requireStaff guard.
 */

jest.mock('../../src/config', () => {
  // Return a config with the expected staffRoleIds so tests are deterministic.
  return {
    config: {
      staffRoleIds: ['333333', '555555'],
    },
    validateConfig: jest.fn(),
  };
});

const {
  isStaff,
  isAdmin,
  requireStaff,
} = require('../../src/utils/permissions');

/* ------------------------------------------------------------------ */
/*  Helpers: build a fake member with roles that support .some()       */
/* ------------------------------------------------------------------ */

function makeMember({ id, ownerGuildId, roleIds = [] }) {
  // Simulate a discord.js Collection which has .some()
  const roleMap = new Map(roleIds.map((rid) => [rid, { id: rid, name: rid }]));
  return {
    id,
    roles: {
      cache: {
        some: (fn) => {
          for (const [, role] of roleMap) {
            if (fn(role)) return true;
          }
          return false;
        },
      },
    },
    guild: { ownerId: ownerGuildId },
    permissions: { has: jest.fn() },
  };
}

/* ------------------------------------------------------------------ */
/*  isStaff                                                             */
/* ------------------------------------------------------------------ */

describe('isStaff', () => {
  it('should return true when the member has a configured staff role', () => {
    const member = makeMember({
      id: 'user1',
      ownerGuildId: 'owner1',
      roleIds: ['333333'],
    });

    expect(isStaff(member)).toBe(true);
  });

  it('should return true for the server owner even without staff role', () => {
    const member = makeMember({
      id: 'owner1',
      ownerGuildId: 'owner1',
      roleIds: [],
    });

    expect(isStaff(member)).toBe(true);
  });

  it('should return false for a non-staff, non-owner member', () => {
    const member = makeMember({
      id: 'user1',
      ownerGuildId: 'owner1',
      roleIds: ['444444'], // not in staffRoleIds
    });

    expect(isStaff(member)).toBe(false);
  });

  it('should return false when member is null or undefined', () => {
    expect(isStaff(null)).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });

  it('should match any role in the configured staffRoleIds list', () => {
    const member = makeMember({
      id: 'user1',
      ownerGuildId: 'owner1',
      roleIds: ['555555'], // second staff role
    });

    expect(isStaff(member)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  isAdmin                                                             */
/* ------------------------------------------------------------------ */

describe('isAdmin', () => {
  it('should return true when member has Administrator permission', () => {
    const member = { permissions: { has: jest.fn(() => true) } };
    expect(isAdmin(member)).toBe(true);
  });

  it('should return false when member lacks Administrator permission', () => {
    const member = { permissions: { has: jest.fn(() => false) } };
    expect(isAdmin(member)).toBe(false);
  });

  it('should return false when member is null', () => {
    expect(isAdmin(null)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  requireStaff                                                        */
/* ------------------------------------------------------------------ */

describe('requireStaff', () => {
  it('should return true and not reply when user is staff', () => {
    const member = makeMember({
      id: 'staff1',
      ownerGuildId: 'owner1',
      roleIds: ['333333'],
    });
    const interaction = { member, reply: jest.fn() };

    const result = requireStaff(interaction);

    expect(result).toBe(true);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('should return false and reply with permission denied when user is not staff', () => {
    const member = makeMember({
      id: 'user1',
      ownerGuildId: 'owner1',
      roleIds: [],
    });
    const interaction = { member, reply: jest.fn() };

    const result = requireStaff(interaction);

    expect(result).toBe(false);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('permission'),
      ephemeral: true,
    });
  });
});
