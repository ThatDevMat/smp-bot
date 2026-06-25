/**
 * Tests for src/utils/permissions.js
 *
 * Covers requireStaff and requireAdmin role-based permission guards.
 */

jest.mock('../../src/config', () => ({
  config: {
    staffRoleIds: ['333333', '555555'],
    adminRoleIds: ['999999'],
  },
  validateConfig: jest.fn(),
}));

const {
  requireStaff,
  requireAdmin,
} = require('../../src/utils/permissions');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Build a fake member whose roles.cache is a Map-like object with has().
 */
function makeMember({ roleIds = [] }) {
  const roleMap = new Map(roleIds.map((rid) => [rid, { id: rid, name: rid }]));
  return {
    roles: {
      cache: {
        has: (rid) => roleMap.has(rid),
      },
    },
  };
}

/**
 * Build a fake interaction with the given member, plus a reply spy.
 */
function makeInteraction({ roleIds = [] } = {}) {
  return {
    member: makeMember({ roleIds }),
    reply: jest.fn(),
  };
}

/* ------------------------------------------------------------------ */
/*  requireStaff                                                        */
/* ------------------------------------------------------------------ */

describe('requireStaff', () => {
  it('should return true when the user has a configured staff role', () => {
    const interaction = makeInteraction({ roleIds: ['333333'] });
    expect(requireStaff(interaction)).toBe(true);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('should return true for any role in the staffRoleIds list', () => {
    const interaction = makeInteraction({ roleIds: ['555555'] });
    expect(requireStaff(interaction)).toBe(true);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('should return false and reply when the user lacks a staff role', () => {
    const interaction = makeInteraction({ roleIds: ['444444'] });
    const result = requireStaff(interaction);
    expect(result).toBe(false);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('permission'),
      ephemeral: true,
    });
  });

  it('should return false when member is null', () => {
    const interaction = { member: null, reply: jest.fn() };
    expect(requireStaff(interaction)).toBe(false);
  });

  it('should return false when member.roles.cache is missing', () => {
    const interaction = {
      member: { roles: {} },
      reply: jest.fn(),
    };
    expect(requireStaff(interaction)).toBe(false);
  });

  it('should return true when staffRoleIds is empty (no role restriction)', () => {
    const origConfig = jest.requireMock('../../src/config').config;
    origConfig.staffRoleIds = [];
    const interaction = makeInteraction({ roleIds: [] });
    expect(requireStaff(interaction)).toBe(true);
    expect(interaction.reply).not.toHaveBeenCalled();
    origConfig.staffRoleIds = ['333333', '555555']; // restore
  });
});

/* ------------------------------------------------------------------ */
/*  requireAdmin                                                        */
/* ------------------------------------------------------------------ */

describe('requireAdmin', () => {
  it('should return true when the user has a configured admin role', () => {
    const interaction = makeInteraction({ roleIds: ['999999'] });
    expect(requireAdmin(interaction)).toBe(true);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('should fall back to staff role when user has a staff role (no admin config override)', () => {
    // With adminRoleIds and staffRoleIds both configured, staff-only should
    // NOT pass requireAdmin — because requireAdmin checks admin roles first.
    const interaction = makeInteraction({ roleIds: ['333333'] });
    expect(requireAdmin(interaction)).toBe(false);
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('should return false and reply when the user lacks both admin and staff roles', () => {
    const interaction = makeInteraction({ roleIds: ['444444'] });
    const result = requireAdmin(interaction);
    expect(result).toBe(false);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('permission'),
      ephemeral: true,
    });
  });

  it('should return false when member is null', () => {
    const interaction = { member: null, reply: jest.fn() };
    expect(requireAdmin(interaction)).toBe(false);
  });

  it('should return false when roles.cache is missing', () => {
    const interaction = {
      member: { roles: {} },
      reply: jest.fn(),
    };
    expect(requireAdmin(interaction)).toBe(false);
  });
});
