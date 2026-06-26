/**
 * Permission-check helpers for slash commands.
 *
 * Every command that requires a role check should call the appropriate
 * function early in `execute()` and return early if it returns false.
 */

const { config } = require('../config');

/**
 * Check that the interaction member has at least one of the configured
 * staff roles.  Replies with an ephemeral error if not.
 *
 * @param {import('discord.js').CommandInteraction} interaction
 * @returns {boolean} true if the user is staff
 */
function requireStaff(interaction) {
  if (config.staffRoleIds.length === 0) return true;

  const memberRoles = interaction.member?.roles?.cache;
  if (!memberRoles) return false;

  const hasRole = config.staffRoleIds.some((rid) => memberRoles.has(rid));
  if (!hasRole) {
    interaction.reply({
      content: ':no_entry: You do not have permission to use this command.',
      ephemeral: true,
    });
  }
  return hasRole;
}

/**
 * Check that the interaction member has at least one of the configured
 * admin roles (or staff roles as a fallback).  Replies with an ephemeral
 * error if not.
 *
 * Admin commands are more sensitive (console access, etc.) so this check
 * is intentionally separate from requireStaff.
 *
 * @param {import('discord.js').CommandInteraction} interaction
 * @returns {boolean} true if the user is an admin
 */
function requireAdmin(interaction) {
  const memberRoles = interaction.member?.roles?.cache;
  if (!memberRoles) return false;

  // Check admin roles if configured.
  if (config.adminRoleIds.length > 0) {
    const hasAdminRole = config.adminRoleIds.some((rid) =>
      memberRoles.has(rid),
    );
    if (hasAdminRole) return true;
    // Admin roles are configured but user doesn't have one — deny.
    interaction.reply({
      content: ':no_entry: You do not have permission to use this command.',
      ephemeral: true,
    });
    return false;
  }

  // No admin roles configured — fall back to staff roles.
  if (config.staffRoleIds.length > 0) {
    const hasStaffRole = config.staffRoleIds.some((rid) =>
      memberRoles.has(rid),
    );
    if (hasStaffRole) return true;
  }

  // No roles configured at all — everyone is admin.
  if (config.adminRoleIds.length === 0 && config.staffRoleIds.length === 0) {
    return true;
  }

  interaction.reply({
    content: ':no_entry: You do not have permission to use this command.',
    ephemeral: true,
  });
  return false;
}

module.exports = { requireStaff, requireAdmin };
