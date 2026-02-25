const axios = require('axios');
const { getTeamAbbr, getTeamName } = require('../utils/teamUtils');
const { formatCountdown } = require('../utils/formatUtils');
const { getNextGame } = require('../api/nhlApi');

async function executeCountdown(message, args) {
    const teamInput = args[1];
    
    if (!teamInput) {
        message.reply('Please specify a team! Example: `!countdown pen` for Pittsburgh Penguins');
        return;
    }
    
    const teamAbbr = getTeamAbbr(teamInput);
    const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
    
    if (!teamName) {
        message.reply(`Sorry, I don't recognize the team "${teamInput}". Use \`!commands\` to see supported teams.`);
        return;
    }
    
    const game = await getNextGame(teamAbbr);
    
    if (!game) {
        message.reply(`No upcoming games found for the ${teamName}.`);
        return;
    }
    
    const gameDate = new Date(game.startTimeUTC);
    const countdown = formatCountdown(game.startTimeUTC);
    const opponent = game.homeTeam.abbrev === teamAbbr ? game.awayTeam : game.homeTeam;
    const isHome = game.homeTeam.abbrev === teamAbbr;
    const hostCity = isHome ? teamName.split(' ').pop() : (getTeamName(opponent.abbrev) || '').split(' ').pop();
    
    // Discord dynamic timestamps
    const unixTimestamp = Math.floor(gameDate.getTime() / 1000);
    const discordTime = `<t:${unixTimestamp}:F>`;       // Full date/time (user's timezone)
    const discordCountdown = `<t:${unixTimestamp}:R>`;  // Live relative countdown
    
    const embed = {
        color: 0x0099ff,
        title: `⏰ ${teamName} Countdown`,
        description: `Next game: ${isHome ? 'vs' : '@'} ${getTeamName(opponent.abbrev) || opponent.placeName.default}`,
        fields: [
            {
                name: '🕐 Countdown',
                value: discordCountdown,
                inline: true
            },
            {
                name: '📅 Game Date & Time',
                value: discordTime,
                inline: true
            },
            {
                name: '🏙️ Host City',
                value: hostCity,
                inline: false
            }
        ],
        timestamp: new Date().toISOString(),
        footer: {
            text: 'NHL Countdown Bot'
        }
    };
    
    message.reply({ embeds: [embed] });
}

async function executeCountdownSite(message, args) {
    const embed = {
        color: 0x0099ff,
        title: '🏒 NHL Countdown Website',
        description: 'Check out the NHL Countdown website for live countdowns to all upcoming games!',
        fields: [
            {
                name: '🌐 Website',
                value: '[NHL Countdown](https://tomcourt89.github.io/NHL-Countdown/)',
                inline: false
            }
        ],
        footer: {
            text: 'NHL Countdown Bot'
        }
    };
    
    message.reply({ embeds: [embed] });
    await message.channel.send('https://tomcourt89.github.io/NHL-Countdown/');
}

async function executeSchedule(message, args) {
    const teamInput = args[1];
    
    if (!teamInput) {
        message.reply('Please specify a team! Example: `!schedule pen` for Pittsburgh Penguins');
        return;
    }
    
    const teamAbbr = getTeamAbbr(teamInput);
    const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
    
    if (!teamName) {
        message.reply(`Sorry, I don't recognize the team "${teamInput}". Use \`!commands\` to see supported teams.`);
        return;
    }
    
    const response = await axios.get(`https://api-web.nhle.com/v1/club-schedule-season/${teamAbbr}/now`);
    const games = response.data.games;
    
    const now = new Date();
    const upcomingGames = games.filter(game => new Date(game.startTimeUTC) >= now).slice(0, 5);
    
    if (upcomingGames.length === 0) {
        message.reply(`No upcoming games found for the ${teamName}.`);
        return;
    }
    
    const scheduleLines = upcomingGames.map(game => {
        const gameDate = new Date(game.startTimeUTC);
        const unixTs = Math.floor(gameDate.getTime() / 1000);
        const isHome = game.homeTeam.abbrev === teamAbbr;
        const opponent = isHome ? game.awayTeam.abbrev : game.homeTeam.abbrev;
        const location = isHome ? 'vs' : '@';
        return `<t:${unixTs}:D> ${location} ${opponent} • <t:${unixTs}:t> (<t:${unixTs}:R>)`;
    });
    
    const embed = {
        color: 0x0099ff,
        title: `📅 ${teamName} Schedule`,
        description: `Next ${upcomingGames.length} game${upcomingGames.length > 1 ? 's' : ''}:\n\n` + scheduleLines.join('\n'),
        timestamp: new Date().toISOString(),
        footer: {
            text: 'NHL Countdown Bot'
        }
    };
    
    message.reply({ embeds: [embed] });
}

module.exports = {
    countdown: executeCountdown,
    countdownsite: executeCountdownSite,
    schedule: executeSchedule
};
