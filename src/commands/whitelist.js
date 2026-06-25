const { SlashCommandBuilder } = require('discord.js');
const rcon = require('../integrations/rcon');
const { requireStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Manage Minecraft server whitelist (staff only)')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a player to the whitelist')
        .addStringOption((opt) =>
          opt.setName('username').setDescription('Minecraft username').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a player from the whitelist')
        .addStringOption((opt) =>
          opt.setName('username').setDescription('Minecraft username').setRequired(true)),
    ),

  async execute(interaction) {
    if (!requireStaff(interaction)) return;

    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const username = interaction.options.getString('username');

    try {
      if (subcommand === 'add') {
        const response = await rcon.whitelistAdd(username);
        await interaction.editReply({ content: `✅ \`${username}\` added to the whitelist.\n\`\`\`${response}\`\`\`` });
      } else if (subcommand === 'remove') {
        const response = await rcon.whitelistRemove(username);
        await interaction.editReply({ content: `✅ \`${username}\` removed from the whitelist.\n\`\`\`${response}\`\`\`` });
      }
    } catch (err) {
      await interaction.editReply({ content: `❌ RCON error: ${err.message}` });
    }
  },
};
