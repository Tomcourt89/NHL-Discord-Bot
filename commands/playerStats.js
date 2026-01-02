/**
 * Player Stats Command
 * Shows current season statistics for a player
 */

const { getTeamName } = require('../utils/teamUtils');
const { getPlayerStats } = require('../api/playerApi');

async function playerStats(message, args) {
    const playerQuery = args.slice(1).join(' ');
    
    if (!playerQuery) {
        message.reply('Please specify a player name! Example: `!playerstats crosby` or `!playerstats connor mcdavid`');
        return;
    }
    
    const playerStatsData = await getPlayerStats(playerQuery);
    
    if (!playerStatsData || playerStatsData.length === 0) {
        message.reply(`No active NHL players found matching "${playerQuery}".`);
        return;
    }
    
    if (playerStatsData.length === 1) {
        const player = playerStatsData[0];
        const stats = player.stats;
        
        const embed = {
            color: 0x0099ff,
            title: `👤 ${player.name} Stats`,
            description: `${player.position} • ${getTeamName(player.team) || player.team}`,
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
                }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: `NHL Bot - ${Math.floor(player.season / 10000)}-${player.season % 10000} Season Stats`
            }
        };
        
        // Add goalie-specific stats if position is goalie
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
                }
            ];
        }
        
        message.reply({ embeds: [embed] });
    } else {
        const embeds = playerStatsData.map(player => {
            const stats = player.stats;
            const points = (stats.goals || 0) + (stats.assists || 0);
            
            if (player.position === 'G') {
                return {
                    color: 0x00ff88,
                    title: `👤 ${player.name}`,
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
                            name: '🥅 Save %',
                            value: `${stats.savePct ? (stats.savePct * 100).toFixed(1) + '%' : 'N/A'}`,
                            inline: true
                        }
                    ]
                };
            } else {
                return {
                    color: 0x0099ff,
                    title: `👤 ${player.name}`,
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
            title: `🔍 Found ${playerStatsData.length} player(s) matching "${playerQuery}"`,
            description: 'Here are their current season stats:',
            footer: { text: 'Use full name for detailed stats of a specific player' }
        };
        
        message.reply({ embeds: [headerEmbed, ...embeds] });
    }
}

module.exports = {
    playerStats
};
