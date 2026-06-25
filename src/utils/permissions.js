const { config } = require('../config');

/**
 * Check if a member has at least one staff role.
 * @param {import('discord.js').GuildMember} member
 * @returns {boolean}
 */
function isStaff(member) {
  if (!member) return false;
  // Server owner is always staff
  if (member.id === member.guild.ownerId) return true;
  // Check configured staff roles
  return member.roles.cache.some((role) => config.staffRoleIds.includes(role.id));
}

/**
 * Check if a user has administrator permission.
 * @param {import('discord.js').GuildMember} member
 * @returns {boolean}
 */
function isAdmin(member) {
  if (!member) return false;
  return member.permissions.has('Administrator');
}

/**
 * Require staff role — returns an ephemeral error response if not staff.
 * @param {import('discord.js').Interaction} interaction
 * @returns {boolean} Whether the user has permission
 */
function requireStaff(interaction) {
  if (!isStaff(interaction.member)) {
    interaction.reply({
      content: '⛔ You do not have permission to use this command. Staff role required.',
      ephemeral: true,
    });
    return false;
  }
  return true;
}

module.exports = { isStaff, isAdmin, requireStaff };
