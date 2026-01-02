/**
 * Career Stats Command
 * Shows career totals for a player
 */

const { getTeamName } = require('../utils/teamUtils');
const { getPlayerCareerStats } = require('../api/playerApi');

async function careerStats(message, args) {
    const playerQuery = args.slice(1).join(' ');
    
    if (!playerQuery) {
        message.reply('Please specify a player name! Example: `!careerstats crosby` or `!careerstats connor mcdavid`');
        return;
    }
    
    const playerCareerStats = await getPlayerCareerStats(playerQuery);
    
    if (!playerCareerStats || playerCareerStats.length === 0) {
        message.reply(`No active NHL players found matching "${playerQuery}".`);
        return;
    }
    
    if (playerCareerStats.length === 1) {
        const player = playerCareerStats[0];
        const stats = player.stats;
        
        // Calculate age if birth date is available
        let ageString = '';
        if (player.birthDate) {
            const birthDate = new Date(player.birthDate);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            ageString = ` (${age} years old)`;
        }
        
        const birthPlace = [player.birthCity, player.birthCountry].filter(Boolean).join(', ') || 'N/A';
        
        const embed = {
            color: 0xff6b35, // Orange color for career stats
            title: `🏆 ${player.name} Career Stats`,
            description: `${player.position} • ${getTeamName(player.team) || player.team}${ageString}`,
            fields: [
                {
                    name: '🏒 Games Played',
                    value: `${stats.gamesPlayed || 0}`,
                    inline: true
                },
                {
                    name: '⚽ Goals',
                    value: `${stats.goals || 0}`,
                    inline: true
                },
                {
                    name: '🎯 Assists',
                    value: `${stats.assists || 0}`,
                    inline: true
                },
                {
                    name: '📊 Points',
                    value: `${(stats.goals || 0) + (stats.assists || 0)}`,
                    inline: true
                },
                {
                    name: '+/-',
                    value: `${stats.plusMinus || 0}`,
                    inline: true
                },
                {
                    name: '🏒 PIM',
                    value: `${stats.penaltyMinutes || 0}`,
                    inline: true
                },
                {
                    name: '📍 Born',
                    value: birthPlace,
                    inline: false
                }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'NHL Bot - Career Totals'
            }
        };
        
        // Add goalie-specific career stats if position is goalie
        if (player.position === 'G' && stats.wins !== undefined) {
            embed.fields = [
                {
                    name: '🏒 Games Played',
                    value: `${stats.gamesPlayed || 0}`,
                    inline: true
                },
                {
                    name: '🏆 Wins',
                    value: `${stats.wins || 0}`,
                    inline: true
                },
                {
                    name: '❌ Losses',
                    value: `${stats.losses || 0}`,
                    inline: true
                },
                {
                    name: '🥅 Save %',
                    value: `${stats.savePct ? (stats.savePct * 100).toFixed(1) + '%' : 'N/A'}`,
                    inline: true
                },
                {
                    name: '🎯 GAA',
                    value: `${stats.goalsAgainstAvg ? stats.goalsAgainstAvg.toFixed(2) : 'N/A'}`,
                    inline: true
                },
                {
                    name: '🚫 Shutouts',
                    value: `${stats.shutouts || 0}`,
                    inline: true
                },
                {
                    name: '📍 Born',
                    value: birthPlace,
                    inline: false
                }
            ];
        }
        
        message.reply({ embeds: [embed] });
    } else {
        const embeds = playerCareerStats.map(player => {
            const stats = player.stats;
            const points = (stats.goals || 0) + (stats.assists || 0);
            
            if (player.position === 'G') {
                return {
                    color: 0xff8c42,
                    title: `🏆 ${player.name}`,
                    description: `${player.position} • ${getTeamName(player.team) || player.team}`,
                    fields: [
                        {
                            name: '🏒 GP',
                            value: `${stats.gamesPlayed || 0}`,
                            inline: true
                        },
                        {
                            name: '🏆 W-L',
                            value: `${stats.wins || 0}-${stats.losses || 0}`,
                            inline: true
                        },
                        {
                            name: '🚫 SO',
                            value: `${stats.shutouts || 0}`,
                            inline: true
                        }
                    ]
                };
            } else {
                return {
                    color: 0xff6b35,
                    title: `🏆 ${player.name}`,
                    description: `${player.position} • ${getTeamName(player.team) || player.team}`,
                    fields: [
                        {
                            name: '🏒 GP',
                            value: `${stats.gamesPlayed || 0}`,
                            inline: true
                        },
                        {
                            name: '⚽ G-A',
                            value: `${stats.goals || 0}-${stats.assists || 0}`,
                            inline: true
                        },
                        {
                            name: '📊 PTS',
                            value: `${points}`,
                            inline: true
                        }
                    ]
                };
            }
        });
        
        const headerEmbed = {
            color: 0xffd700,
            title: `🔍 Found ${playerCareerStats.length} player(s) matching "${playerQuery}"`,
            description: 'Here are their career totals:',
            footer: { text: 'Use full name for detailed career stats of a specific player' }
        };
        
        message.reply({ embeds: [headerEmbed, ...embeds] });
    }
}

module.exports = {
    careerStats
};
