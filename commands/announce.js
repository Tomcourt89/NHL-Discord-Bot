/**
 * Announce Commands
 * Subscribe/unsubscribe channels to game announcements
 */

const fs = require('fs');
const path = require('path');
const { getTeamAbbr, getTeamName } = require('../utils/teamUtils');

const SUBS_FILE = path.join(__dirname, '..', 'subscriptions.json');

/**
 * Load subscriptions from JSON file
 * @returns {Object} - { channelId: ['TEAM1', 'TEAM2'], ... }
 */
function loadSubscriptions() {
    try {
        if (!fs.existsSync(SUBS_FILE)) {
            return {};
        }
        const data = fs.readFileSync(SUBS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading subscriptions:', error);
        return {};
    }
}

/**
 * Save subscriptions to JSON file
 * @param {Object} subscriptions - The subscriptions object to save
 */
function saveSubscriptions(subscriptions) {
    try {
        fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving subscriptions:', error);
        throw error;
    }
}

/**
 * Subscribe a channel to game announcements for a team
 */
async function announce(message, args) {
    const teamInput = args.slice(1).join(' ');
    
    if (!teamInput) {
        message.reply('Please specify a team! Example: `!announce devils` or `!announce pit`');
        return;
    }
    
    const teamAbbr = getTeamAbbr(teamInput);
    const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
    
    if (!teamName) {
        message.reply(`Sorry, I don't recognize the team "${teamInput}". Use \`!commands\` to see supported teams.`);
        return;
    }
    
    const channelId = message.channel.id;
    const subscriptions = loadSubscriptions();
    
    // Initialize channel array if it doesn't exist
    if (!subscriptions[channelId]) {
        subscriptions[channelId] = [];
    }
    
    // Check if already subscribed
    if (subscriptions[channelId].includes(teamAbbr)) {
        message.reply(`This channel is already subscribed to ${teamName} game announcements!`);
        return;
    }
    
    // Add subscription
    subscriptions[channelId].push(teamAbbr);
    
    try {
        saveSubscriptions(subscriptions);
        
        const embed = {
            color: 0x00ff00,
            title: '🔔 Game Announcements Enabled',
            description: `This channel will now receive announcements **6 hours before** ${teamName} games.`,
            fields: [
                {
                    name: '📢 Subscribed Teams',
                    value: subscriptions[channelId].map(abbr => getTeamName(abbr)).join(', '),
                    inline: false
                },
                {
                    name: '❌ To Unsubscribe',
                    value: `Use \`!announceoff ${teamInput}\``,
                    inline: false
                }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'NHL Bot - Game Announcements'
            }
        };
        
        message.reply({ embeds: [embed] });
    } catch (error) {
        message.reply('Sorry, there was an error saving your subscription. Please try again.');
    }
}

/**
 * Unsubscribe a channel from game announcements for a team
 */
async function announceOff(message, args) {
    const teamInput = args.slice(1).join(' ');
    
    if (!teamInput) {
        message.reply('Please specify a team! Example: `!announceoff devils` or `!announceoff pit`');
        return;
    }
    
    const teamAbbr = getTeamAbbr(teamInput);
    const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
    
    if (!teamName) {
        message.reply(`Sorry, I don't recognize the team "${teamInput}". Use \`!commands\` to see supported teams.`);
        return;
    }
    
    const channelId = message.channel.id;
    const subscriptions = loadSubscriptions();
    
    // Check if channel has any subscriptions
    if (!subscriptions[channelId] || !subscriptions[channelId].includes(teamAbbr)) {
        message.reply(`This channel is not subscribed to ${teamName} game announcements.`);
        return;
    }
    
    // Remove subscription
    subscriptions[channelId] = subscriptions[channelId].filter(abbr => abbr !== teamAbbr);
    
    // Clean up empty channel entries
    if (subscriptions[channelId].length === 0) {
        delete subscriptions[channelId];
    }
    
    try {
        saveSubscriptions(subscriptions);
        
        const remainingTeams = subscriptions[channelId] 
            ? subscriptions[channelId].map(abbr => getTeamName(abbr)).join(', ')
            : 'None';
        
        const embed = {
            color: 0xff6600,
            title: '🔕 Game Announcements Disabled',
            description: `This channel will no longer receive ${teamName} game announcements.`,
            fields: [
                {
                    name: '📢 Remaining Subscriptions',
                    value: remainingTeams,
                    inline: false
                }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'NHL Bot - Game Announcements'
            }
        };
        
        message.reply({ embeds: [embed] });
    } catch (error) {
        message.reply('Sorry, there was an error saving your changes. Please try again.');
    }
}

/**
 * List all game announcement subscriptions for this channel
 */
async function announceList(message, args) {
    const channelId = message.channel.id;
    const subscriptions = loadSubscriptions();
    
    if (!subscriptions[channelId] || subscriptions[channelId].length === 0) {
        message.reply('This channel has no active game announcement subscriptions.\nUse `!announce [team]` to subscribe!');
        return;
    }
    
    const teams = subscriptions[channelId].map(abbr => getTeamName(abbr)).join('\n• ');
    
    const embed = {
        color: 0x0099ff,
        title: '📢 Active Game Announcements',
        description: `This channel will receive announcements 6 hours before games for:`,
        fields: [
            {
                name: '🏒 Subscribed Teams',
                value: `• ${teams}`,
                inline: false
            },
            {
                name: '➕ Add More',
                value: '`!announce [team]`',
                inline: true
            },
            {
                name: '➖ Remove',
                value: '`!announceoff [team]`',
                inline: true
            }
        ],
        timestamp: new Date().toISOString(),
        footer: {
            text: 'NHL Bot - Game Announcements'
        }
    };
    
    message.reply({ embeds: [embed] });
}

// Export functions for use by scheduler
function getSubscriptions() {
    return loadSubscriptions();
}

module.exports = {
    announce,
    announceOff,
    announceList,
    getSubscriptions
};
