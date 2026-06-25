/**
 * deploy-commands.js
 * Run this script to register or update all slash commands with Discord.
 * Usage: node deploy-commands.js
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const { config, validateConfig } = require('./src/config');

// Validate that required env vars are present
validateConfig();

const commands = [];

// Load all command definitions
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js') && !file.startsWith('_'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command) {
    commands.push(command.data.toJSON());
    console.log(`[Deploy] Loaded /${command.data.name}`);
  } else {
    console.warn(`[Deploy] Skipped ${file}: missing "data" property`);
  }
}

const rest = new REST({ version: '10' }).setToken(config.bot.token);

(async () => {
  try {
    console.log(`[Deploy] Registering ${commands.length} slash commands...`);

    const data = await rest.put(
      Routes.applicationGuildCommands(config.bot.clientId, config.bot.guildId),
      { body: commands },
    );

    console.log(`[Deploy] Successfully registered ${data.length} commands:`);
    data.forEach((cmd) => console.log(`  - /${cmd.name}`));
  } catch (error) {
    console.error('[Deploy] Error:', error);
    process.exit(1);
  }
})();
