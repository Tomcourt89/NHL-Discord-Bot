/**
 * Previous Game Command
 * Shows the most recent game result for a team
 */

const { getTeamAbbr, getTeamName } = require('../utils/teamUtils');
const { getPreviousGame } = require('../api/nhlApi');

async function previousGame(message, args) {
    const teamInput = args[1];
    
    if (!teamInput) {
        message.reply('Please specify a team! Example: `!previousgame pen`');
        return;
    }
    
    const teamAbbr = getTeamAbbr(teamInput);
    const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
    
    if (!teamName) {
        message.reply(`Sorry, I don't recognize the team "${teamInput}". Use \`!commands\` to see supported teams.`);
        return;
    }
    
    const game = await getPreviousGame(teamAbbr);
    
    if (!game) {
        message.reply(`No recent games found for the ${teamName}.`);
        return;
    }
    
    const gameDate = new Date(game.startTimeUTC);
    const homeTeam = getTeamName(game.homeTeam.abbrev);
    const awayTeam = getTeamName(game.awayTeam.abbrev);
    const homeScore = game.homeTeam.score;
    const awayScore = game.awayTeam.score;
    const isHome = game.homeTeam.abbrev === teamAbbr;
    const opponent = isHome ? awayTeam : homeTeam;
    const teamScore = isHome ? homeScore : awayScore;
    const opponentScore = isHome ? awayScore : homeScore;
    const result = teamScore > opponentScore ? 'WIN' : 'LOSS';
    const resultColor = result === 'WIN' ? 0x00ff00 : 0xff0000;
    
    const embed = {
        color: resultColor,
        title: `📊 ${teamName} Previous Game`,
        description: `${result}: ${isHome ? 'vs' : '@'} ${opponent}`,
        fields: [
            {
                name: '🏒 Final Score',
                value: `${teamName}: ${teamScore}\n${opponent}: ${opponentScore}`,
                inline: true
            },
            {
                name: '📅 Game Date',
                value: gameDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric'
                }),
                inline: true
            },
            {
                name: '🏆 Result',
                value: result,
                inline: true
            }
        ],
        timestamp: new Date().toISOString(),
        footer: {
            text: 'NHL Bot'
        }
    };
    
    message.reply({ embeds: [embed] });
}

module.exports = {
    previousGame
};
