/**
 * Stats Command
 * Shows current season team statistics
 */

const { getTeamAbbr, getTeamName } = require('../utils/teamUtils');
const { getTeamStats } = require('../api/nhlApi');

async function stats(message, args) {
    const teamInput = args[1];
    
    if (!teamInput) {
        message.reply('Please specify a team! Example: `!stats pen`');
        return;
    }
    
    const teamAbbr = getTeamAbbr(teamInput);
    const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
    
    if (!teamName) {
        message.reply(`Sorry, I don't recognize the team "${teamInput}". Use \`!commands\` to see supported teams.`);
        return;
    }
    
    const statsData = await getTeamStats(teamAbbr);
    
    if (!statsData) {
        message.reply(`No stats found for the ${teamName}.`);
        return;
    }
    
    const embed = {
        color: 0x0099ff,
        title: `📈 ${teamName} Stats`,
        fields: [
            {
                name: '🏒 Record',
                value: `${statsData.wins}-${statsData.losses}-${statsData.otLosses}`,
                inline: true
            },
            {
                name: '🎯 Games Played',
                value: `${statsData.gamesPlayed}`,
                inline: true
            },
            {
                name: '📊 Points',
                value: `${statsData.points}`,
                inline: true
            },
            {
                name: '📈 Points %',
                value: `${(statsData.pointPctg * 100).toFixed(1)}%`,
                inline: true
            },
            {
                name: '⚽ Goals For',
                value: `${statsData.goalFor}`,
                inline: true
            },
            {
                name: '🥅 Goals Against',
                value: `${statsData.goalAgainst}`,
                inline: true
            },
            {
                name: '📊 Goal Differential',
                value: `${statsData.goalDifferential > 0 ? '+' : ''}${statsData.goalDifferential}`,
                inline: true
            }
        ],
        timestamp: new Date().toISOString(),
        footer: {
            text: 'NHL Bot - Current Season Stats'
        }
    };
    
    message.reply({ embeds: [embed] });
}

module.exports = {
    stats
};
