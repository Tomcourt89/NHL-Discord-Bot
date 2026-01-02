/**
 * NHL Discord Bot - Main Entry Point
 * 
 * This is the main bot file that handles Discord client setup
 * and routes commands to their handlers.
 */

const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const { executeCommand, hasCommand } = require('./commands');

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Bot prefix
const PREFIX = '!';

// Ready event (using clientReady for discord.js v15+)
client.once('clientReady', () => {
    console.log(`✅ NHL Bot is online! Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
});

// Message handler
client.on('messageCreate', async (message) => {
    // Ignore bot messages and non-prefix messages
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;
    
    // Parse command and arguments
    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args[0].toLowerCase();
    
    // Skip empty commands
    if (!command) return;
    
    // Execute command if it exists
    if (hasCommand(command)) {
        await executeCommand(command, message, args);
    }
});

// Error handling
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
