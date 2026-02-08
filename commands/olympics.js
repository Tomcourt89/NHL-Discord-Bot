/**
 * Olympics Command
 * Shows Men's Olympic hockey schedule
 */

const { getUpcomingOlympicGames, getFullOlympicSchedule, getTodaysOlympicGames } = require('../api/olympicsApi');

/**
 * Format a game for display
 * @param {Object} game - Parsed game object
 * @returns {string} - Formatted game string
 */
function formatGame(game) {
    const dateOpts = { weekday: 'short', month: 'short', day: 'numeric' };
    const timeOpts = { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
    
    const dateStr = game.date.toLocaleDateString('en-US', dateOpts);
    const timeStr = game.date.toLocaleTimeString('en-US', timeOpts);
    
    const away = game.awayTeam.name;
    const home = game.homeTeam.name;
    
    // Check game status
    if (game.isComplete) {
        return `${dateStr} - ${away} ${game.awayTeam.score} @ ${home} ${game.homeTeam.score} (Final)`;
    } else if (game.status === 'STATUS_IN_PROGRESS') {
        return `${dateStr} - ${away} ${game.awayTeam.score} @ ${home} ${game.homeTeam.score} (${game.statusDetail})`;
    } else {
        return `${dateStr} ${timeStr} - ${away} @ ${home}`;
    }
}

/**
 * Group games by date
 * @param {Array} games - Array of game objects
 * @returns {Object} - Games grouped by date string
 */
function groupByDate(games) {
    const grouped = {};
    
    games.forEach(game => {
        const dateKey = game.date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
        });
        
        if (!grouped[dateKey]) {
            grouped[dateKey] = [];
        }
        grouped[dateKey].push(game);
    });
    
    return grouped;
}

/**
 * Main olympics command handler
 */
async function olympics(message, args) {
    const subcommand = args[1]?.toLowerCase();
    
    let games;
    let title;
    let description;
    
    try {
        if (subcommand === 'full' || subcommand === 'all') {
            // Show full tournament schedule
            games = await getFullOlympicSchedule();
            title = '🏒 2026 Milano Cortina Olympics - Full Schedule';
            description = "Men's Hockey Tournament - All Games";
        } else if (subcommand === 'today') {
            // Show only today's games
            games = await getTodaysOlympicGames();
            title = "🏒 Today's Olympic Hockey Games";
            description = "Men's Hockey - " + new Date().toLocaleDateString('en-US', { 
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
            });
        } else {
            // Default: show upcoming games (next 7 days)
            games = await getUpcomingOlympicGames();
            title = '🏒 2026 Milano Cortina Olympics - Upcoming Games';
            description = "Men's Hockey Tournament - Next 7 Days";
        }
    } catch (error) {
        console.error('Olympics command error:', error);
        message.reply('Sorry, there was an error fetching the Olympic schedule. Please try again later.');
        return;
    }
    
    if (!games || games.length === 0) {
        const embed = {
            color: 0x0099ff,
            title: title,
            description: 'No games found for this time period.\n\nThe 2026 Milano Cortina Olympics Men\'s Hockey runs **February 8-22, 2026**.',
            fields: [
                {
                    name: '📅 View Full Schedule',
                    value: '`!olympics full` - See all tournament games',
                    inline: false
                }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'NHL Bot - Olympics Schedule'
            }
        };
        
        message.reply({ embeds: [embed] });
        return;
    }
    
    // Group games by date for better display
    const groupedGames = groupByDate(games);
    
    // Build fields for each date
    const fields = [];
    for (const [date, dateGames] of Object.entries(groupedGames)) {
        const gameList = dateGames.map(g => {
            const timeStr = g.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const away = g.awayTeam.abbreviation || g.awayTeam.name;
            const home = g.homeTeam.abbreviation || g.homeTeam.name;
            
            if (g.isComplete) {
                return `✅ ${away} ${g.awayTeam.score} - ${g.homeTeam.score} ${home} (Final)`;
            } else if (g.status === 'STATUS_IN_PROGRESS') {
                return `🔴 ${away} ${g.awayTeam.score} - ${g.homeTeam.score} ${home} (${g.statusDetail})`;
            } else {
                return `⏰ ${timeStr} - ${away} vs ${home}`;
            }
        }).join('\n');
        
        fields.push({
            name: `📅 ${date}`,
            value: gameList || 'No games',
            inline: false
        });
        
        // Discord limits to 25 fields
        if (fields.length >= 20) {
            fields.push({
                name: '...',
                value: `*And ${Object.keys(groupedGames).length - 20} more days. Use \`!olympics today\` for specific dates.*`,
                inline: false
            });
            break;
        }
    }
    
    const embed = {
        color: 0x0066cc, // Olympic blue
        title: title,
        description: description,
        fields: fields,
        timestamp: new Date().toISOString(),
        footer: {
            text: 'NHL Bot - Olympics Schedule • Data from ESPN'
        }
    };
    
    message.reply({ embeds: [embed] });
}

module.exports = {
    olympics
};
