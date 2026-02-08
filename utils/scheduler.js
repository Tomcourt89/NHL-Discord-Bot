/**
 * Game Announcement Scheduler
 * Checks for upcoming games and posts announcements to subscribed channels
 */

const cron = require('node-cron');
const { getNextGame } = require('../api/nhlApi');
const { getTeamName } = require('../utils/teamUtils');
const { getSubscriptions } = require('../commands/announce');

// Track announced games to prevent duplicates (gameId-channelId)
const announcedGames = new Set();

// Time window for announcements (6 hours in milliseconds)
const ANNOUNCEMENT_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours
const ANNOUNCEMENT_BUFFER_MS = 30 * 60 * 1000; // 30 minutes buffer (check every 30 min)

/**
 * Check if a game should be announced
 * @param {Date} gameTime - The game start time
 * @returns {boolean} - True if game is within 6-6.5 hours from now
 */
function shouldAnnounce(gameTime) {
    const now = new Date();
    const timeUntilGame = gameTime.getTime() - now.getTime();
    
    // Announce if game is between 5.5 and 6.5 hours away
    // This gives a 1-hour window to catch games on the 30-min check cycle
    const minTime = ANNOUNCEMENT_WINDOW_MS - ANNOUNCEMENT_BUFFER_MS; // 5.5 hours
    const maxTime = ANNOUNCEMENT_WINDOW_MS + ANNOUNCEMENT_BUFFER_MS; // 6.5 hours
    
    return timeUntilGame >= minTime && timeUntilGame <= maxTime;
}

/**
 * Format time until game
 * @param {Date} gameTime - The game start time
 * @returns {string} - Formatted time string
 */
function formatTimeUntil(gameTime) {
    const now = new Date();
    const diffMs = gameTime.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

/**
 * Create announcement embed for a game
 * @param {Object} game - Game data from NHL API
 * @param {string} teamAbbr - The subscribed team abbreviation
 * @returns {Object} - Discord embed object
 */
function createAnnouncementEmbed(game, teamAbbr) {
    const gameTime = new Date(game.startTimeUTC);
    const homeTeam = getTeamName(game.homeTeam.abbrev);
    const awayTeam = getTeamName(game.awayTeam.abbrev);
    const isHome = game.homeTeam.abbrev === teamAbbr;
    const subscribedTeam = getTeamName(teamAbbr);
    const opponent = isHome ? awayTeam : homeTeam;
    const location = isHome ? 'vs' : '@';
    
    return {
        color: 0x00ff00,
        title: `🏒 Game Alert: ${subscribedTeam} ${location} ${opponent}`,
        description: `**${subscribedTeam}** play in approximately **${formatTimeUntil(gameTime)}**!`,
        fields: [
            {
                name: '🏠 Home',
                value: homeTeam,
                inline: true
            },
            {
                name: '✈️ Away',
                value: awayTeam,
                inline: true
            },
            {
                name: '🕐 Game Time',
                value: gameTime.toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short'
                }),
                inline: false
            },
            {
                name: '📊 Quick Links',
                value: `\`!countdown ${teamAbbr.toLowerCase()}\` - Full countdown\n\`!stats ${teamAbbr.toLowerCase()}\` - Team stats`,
                inline: false
            }
        ],
        timestamp: new Date().toISOString(),
        footer: {
            text: 'NHL Bot - Game Announcement • Use !announceoff to unsubscribe'
        }
    };
}

/**
 * Check all subscriptions and send announcements
 * @param {Client} client - Discord client instance
 */
async function checkAndAnnounce(client) {
    const subscriptions = getSubscriptions();
    
    if (Object.keys(subscriptions).length === 0) {
        return; // No subscriptions
    }
    
    // Get unique teams to check (avoid duplicate API calls)
    const allTeams = new Set();
    Object.values(subscriptions).forEach(teams => {
        teams.forEach(team => allTeams.add(team));
    });
    
    // Fetch next game for each team
    const gamesByTeam = {};
    for (const teamAbbr of allTeams) {
        try {
            const game = await getNextGame(teamAbbr);
            if (game) {
                gamesByTeam[teamAbbr] = game;
            }
        } catch (error) {
            console.error(`Error fetching next game for ${teamAbbr}:`, error.message);
        }
    }
    
    // Check each channel's subscriptions
    for (const [channelId, teams] of Object.entries(subscriptions)) {
        for (const teamAbbr of teams) {
            const game = gamesByTeam[teamAbbr];
            
            if (!game) continue;
            
            const gameTime = new Date(game.startTimeUTC);
            const announcementKey = `${game.id}-${channelId}`;
            
            // Check if we should announce and haven't already
            if (shouldAnnounce(gameTime) && !announcedGames.has(announcementKey)) {
                try {
                    const channel = await client.channels.fetch(channelId);
                    if (channel) {
                        const embed = createAnnouncementEmbed(game, teamAbbr);
                        await channel.send({ embeds: [embed] });
                        
                        // Mark as announced
                        announcedGames.add(announcementKey);
                        console.log(`📢 Announced ${teamAbbr} game to channel ${channelId}`);
                    }
                } catch (error) {
                    console.error(`Error sending announcement to channel ${channelId}:`, error.message);
                }
            }
        }
    }
    
    // Clean up old announcement records (older than 24 hours)
    cleanupAnnouncedGames();
}

/**
 * Remove old entries from the announcedGames set
 * This runs after each check cycle to prevent memory buildup
 */
function cleanupAnnouncedGames() {
    // Only keep the last 1000 entries to prevent unbounded growth
    // In practice, this is more than enough for a personal bot
    if (announcedGames.size > 1000) {
        const entries = Array.from(announcedGames);
        const toRemove = entries.slice(0, entries.length - 500);
        toRemove.forEach(entry => announcedGames.delete(entry));
    }
}

/**
 * Start the game announcement scheduler
 * @param {Client} client - Discord client instance
 */
function startGameScheduler(client) {
    console.log('📅 Starting game announcement scheduler (checking every 30 minutes)');
    
    // Run immediately on startup
    setTimeout(() => {
        checkAndAnnounce(client);
    }, 10000); // Wait 10 seconds after startup
    
    // Then run every 30 minutes
    // Cron pattern: "*/30 * * * *" = every 30 minutes
    cron.schedule('*/30 * * * *', () => {
        console.log('🔍 Checking for upcoming games...');
        checkAndAnnounce(client);
    });
}

module.exports = {
    startGameScheduler
};
