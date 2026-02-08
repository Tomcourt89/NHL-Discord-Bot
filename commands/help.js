const commandsEmbed = {
    color: 0x0099ff,
    title: '🏒 NHL Bot Commands',
    description: 'Available commands for the NHL Discord Bot',
    fields: [
        {
            name: '⏰ Countdown Commands',
            value: '`!countdown [team]` - Shows countdown to next game\n`!schedule [team]` - Shows next 5 upcoming games\n`!countdownsite` - Link to the NHL Countdown website\nExample: `!countdown pen`, `!schedule seattle`',
            inline: false
        },
        {
            name: '📊 Previous Game',
            value: '`!previousgame [team]` - Shows the most recent game result\n`!previousgame [team] spoilerfree` - Shows last game without scores\nExample: `!previousgame pen`, `!previousgame seattle spoilerfree`',
            inline: false
        },
        {
            name: '🎬 Game Recap',
            value: '`!recap [team]` - Shows video recap of last game\n`!recap [team] spoilerfree` - Recap without scores (video may contain spoilers)\nExample: `!recap pen`, `!recap seattle spoilerfree`',
            inline: false
        },
        {
            name: '📈 Team Stats',
            value: '`!stats [team]` - Shows current season statistics\nExample: `!stats pen`, `!stats seattle`',
            inline: false
        },
        {
            name: '👤 Player Stats',
            value: '`!playerstats [name]` - Shows player statistics\nExample: `!playerstats crosby`, `!playerstats hughes` (shows all Hughes players)',
            inline: false
        },
        {
            name: '📊 Career Stats',
            value: '`!careerstats [name]` - Shows player career totals\nExample: `!careerstats crosby`, `!careerstats ovechkin`',
            inline: false
        },
        {
            name: '📈 Team Recent Games',
            value: '`!teampast5 [team]` - Last 5 games stats\n`!teampast10 [team]` - Last 10 games stats\n`!teampast20 [team]` - Last 20 games stats\nAdd `playoffs` for playoff stats, `spoilerfree` to hide scores\nExample: `!teampast5 pen`, `!teampast10 seattle playoffs`, `!teampast5 nyr spoilerfree`',
            inline: false
        },
        {
            name: '👤 Player Recent Games',
            value: '`!playerpast5 [name]` - Last 5 games stats\n`!playerpast10 [name]` - Last 10 games stats\n`!playerpast20 [name]` - Last 20 games stats\nAdd `playoffs` for playoff stats\nExample: `!playerpast5 crosby`, `!playerpast10 ovechkin playoffs`',
            inline: false
        },
        {
            name: '🏆 Standings',
            value: '`!divisionstandings [team]` - Division standings\n`!conferencestandings [team]` - Conference standings\n`!leaguestandings [team]` - Full league standings (optional team highlight)',
            inline: false
        },
        {
            name: '🤕 Injury Reports',
            value: '`!injuries [team]` - List of injured players for a team\n`!injury [player]` - Detailed injury info for a specific player\nExample: `!injuries pens`, `!injury malkin`',
            inline: false
        },
        {
            name: '📰 News',
            value: '`!news` - Latest NHL news and rumors\n`!news [team]` - Team-specific news\nExample: `!news`, `!news pens`',
            inline: false
        },
        {
            name: '🔔 Game Announcements',
            value: '`!announce [team]` - Get notified 6 hours before games\n`!announceoff [team]` - Stop notifications for a team\n`!announcelist` - View active subscriptions\nExample: `!announce devils`, `!announceoff pit`',
            inline: false
        },
        {
            name: '🏅 Olympics',
            value: '`!olympics` - Upcoming Olympic hockey games (next 7 days)\n`!olympics today` - Today\'s Olympic games only\n`!olympics full` - Full tournament schedule',
            inline: false
        },
        {
            name: '🔤 Supported Teams',
            value: 'Use team names, cities, or abbreviations:\n`pen/pens/penguins/pittsburgh`, `seattle/kraken/sea`, `caps/capitals/washington`, etc.',
            inline: false
        }
    ],
    footer: {
        text: 'All commands follow the format: !command team'
    }
};

async function execute(message, args) {
    message.reply({ embeds: [commandsEmbed] });
}

module.exports = { execute };
