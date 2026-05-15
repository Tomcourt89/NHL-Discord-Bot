/**
 * IIHF Command
 * Shows IIHF Men's World Championship schedule and scores
 */

const {
    getUpcomingIIHFGames,
    getFullIIHFSchedule,
    getTodaysIIHFGames
} = require('../api/iihfApi');

function groupByDate(games) {
    const grouped = {};
    games.forEach(game => {
        const dateKey = game.date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(game);
    });
    return grouped;
}

async function iihf(message, args) {
    const subcommand = args[1]?.toLowerCase();

    let games;
    let title;
    let description;

    try {
        if (subcommand === 'full' || subcommand === 'all') {
            games = await getFullIIHFSchedule();
            title = '🏒 IIHF Men\'s World Championship - Full Schedule';
            description = 'All tournament games';
        } else if (subcommand === 'today') {
            games = await getTodaysIIHFGames();
            title = '🏒 Today\'s IIHF World Championship Games';
            description = new Date().toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
            });
        } else {
            games = await getUpcomingIIHFGames();
            title = '🏒 IIHF Men\'s World Championship - Upcoming Games';
            description = 'Next 7 days';
        }
    } catch (error) {
        console.error('IIHF command error:', error);
        message.reply('Sorry, there was an error fetching the IIHF schedule. Please try again later.');
        return;
    }

    if (!games || games.length === 0) {
        const embed = {
            color: 0xc8102e,
            title,
            description: 'No games found for this time period.',
            fields: [
                {
                    name: '📅 View Full Schedule',
                    value: '`!iihf full` - See all tournament games',
                    inline: false
                }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'NHL Bot - IIHF Schedule' }
        };
        message.reply({ embeds: [embed] });
        return;
    }

    const grouped = groupByDate(games);
    const fields = [];
    const dateKeys = Object.keys(grouped);

    for (let i = 0; i < dateKeys.length; i++) {
        const date = dateKeys[i];
        const dateGames = grouped[date];

        const gameList = dateGames.map(g => {
            const unix = Math.floor(g.date.getTime() / 1000);
            const timeStr = `<t:${unix}:t>`;
            const away = g.awayTeam.name;
            const home = g.homeTeam.name;

            if (g.isLive) {
                return `🔴 ${away} ${g.awayTeam.score || 0} - ${g.homeTeam.score || 0} ${home} (${g.statusDetail})`;
            } else if (g.isComplete) {
                return `✅ ${away} ${g.awayTeam.score} - ${g.homeTeam.score} ${home} (Final)`;
            } else {
                return `⏰ ${timeStr} - ${away} vs ${home}`;
            }
        }).join('\n');

        fields.push({
            name: `📅 ${date}`,
            value: gameList.length > 1024 ? gameList.slice(0, 1020) + '…' : gameList,
            inline: false
        });

        if (fields.length >= 20 && i < dateKeys.length - 1) {
            fields.push({
                name: '...',
                value: `*And ${dateKeys.length - fields.length} more days. Use \`!iihf today\` for specific dates.*`,
                inline: false
            });
            break;
        }
    }

    const embed = {
        color: 0xc8102e, // IIHF red
        title,
        description,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: 'NHL Bot - IIHF Schedule • Data from TheSportsDB' }
    };

    message.reply({ embeds: [embed] });
}

module.exports = { iihf };
