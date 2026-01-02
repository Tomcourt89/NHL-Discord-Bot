/**
 * Recap Command
 * Shows video recap and highlights for a team's most recent game
 */

const { getTeamAbbr, getTeamName } = require('../utils/teamUtils');
const { getGameRecap } = require('../api/nhlApi');

async function recap(message, args) {
    const teamInput = args[1];
    
    if (!teamInput) {
        message.reply('Please specify a team! Example: `!recap pen`');
        return;
    }
    
    const teamAbbr = getTeamAbbr(teamInput);
    const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
    
    if (!teamName) {
        message.reply(`Sorry, I don't recognize the team "${teamInput}". Use \`!commands\` to see supported teams.`);
        return;
    }
    
    const recapData = await getGameRecap(teamAbbr);
    
    if (!recapData) {
        message.reply(`No recent games found for the ${teamName}.`);
        return;
    }
    
    const { game, gameDetails, recapVideo } = recapData;
    const gameDate = new Date(game.startTimeUTC);
    const homeTeam = getTeamName(game.homeTeam.abbrev);
    const awayTeam = getTeamName(game.awayTeam.abbrev);
    const isHome = game.homeTeam.abbrev === teamAbbr;
    const opponent = isHome ? awayTeam : homeTeam;
    const homeScore = game.homeTeam.score;
    const awayScore = game.awayTeam.score;
    
    if (!recapVideo || !recapVideo.url) {
        const gameId = game.id;
        const nhlGameUrl = `https://www.nhl.com/gamecenter/${gameId}`;
        
        const embed = {
            color: 0x9b4dff,
            title: `🎬 ${teamName} vs ${opponent} - No Video Available`,
            description: `Game from ${gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${homeScore}-${awayScore})`,
            fields: [
                {
                    name: '🌐 Watch on NHL.com',
                    value: `[View game highlights and recap on NHL.com](${nhlGameUrl})`,
                    inline: false
                },
                {
                    name: '📊 Alternative',
                    value: `Use \`!previousgame ${teamInput}\` for game details and stats`,
                    inline: false
                }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'NHL Bot - Video not available via API'
            }
        };
        
        message.reply({ embeds: [embed] });
        return;
    }
    
    const embed = {
        color: 0x9b4dff,
        title: `🎬 ${teamName} vs ${opponent} - Video Recap`,
        description: `Game played on ${gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        fields: [],
        timestamp: new Date().toISOString(),
        footer: {
            text: 'NHL Bot - Video Recap'
        }
    };

    if (recapVideo && recapVideo.url) {
        if (recapVideo.isEmbeddable) {
            embed.fields.push({
                name: '🎥 Game Highlights',
                value: `**${recapVideo.title}**\n\n` +
                       `📺 Channel: ${recapVideo.channelTitle || 'NHL'}`,
                inline: false
            });
            
            if (recapVideo.thumbnail) {
                embed.thumbnail = {
                    url: recapVideo.thumbnail
                };
            }
            
            await message.reply({ embeds: [embed] });
            await message.channel.send(recapVideo.url);
            return;
            
        } else if (recapVideo.isSearch) {
            const searchNote = recapVideo.noVideoFound 
                ? `*Could not find an exact video match for this game date. The search results below should help you find the correct highlights.*`
                : `*The game highlights should be the first result. Copy that YouTube URL and paste it here for automatic embedding!*`;
            
            embed.fields.push({
                name: '🔍 Search for Highlights',
                value: `**${recapVideo.title}**\n\n` +
                       `[Click here to search YouTube](${recapVideo.url})\n\n` +
                       searchNote + `\n\n` +
                       `**Search term:** "${recapVideo.searchQuery}"`,
                inline: false
            });
        } else {
            embed.fields.push({
                name: '🎥 Video Recap',
                value: `**[${recapVideo.title}](${recapVideo.url})**`,
                inline: false
            });
            
            if (recapVideo.url.includes('youtube.com') || recapVideo.url.includes('youtu.be')) {
                embed.video = {
                    url: recapVideo.url
                };
            }
        }
    } else {
        embed.fields.push({
            name: '📺 Video Recap',
            value: 'No video recap available for this game yet.\n*Check back later as highlights are usually posted within a few hours of game completion.*',
            inline: false
        });
    }
    
    // Add three stars if available
    let stars = null;
    if (gameDetails?.summary?.threeStars) {
        stars = gameDetails.summary.threeStars;
    } else if (gameDetails?.threeStars) {
        stars = gameDetails.threeStars;
    } else if (gameDetails?.boxscore?.threeStars) {
        stars = gameDetails.boxscore.threeStars;
    }
    
    if (stars && stars.length > 0) {
        const starsText = stars.map((star, index) => {                    
            // Handle different possible star object structures
            let playerName = 'Unknown Player';
            
            if (typeof star === 'string') {
                playerName = star;
            } else if (star.name?.default) {
                playerName = star.name.default;
            } else if (star.name) {
                playerName = star.name;
            } else if (star.player?.name?.default) {
                playerName = star.player.name.default;
            } else if (star.player?.name) {
                playerName = star.player.name;
            } else if (star.firstName && star.lastName) {
                playerName = `${star.firstName} ${star.lastName}`;
            } else if (star.player?.firstName && star.player?.lastName) {
                playerName = `${star.player.firstName} ${star.player.lastName}`;
            }
            
            const teamAbbrev = star.teamAbbrev || star.team?.abbrev || star.teamAbbreviation || star.player?.team?.abbrev || '';
            const starTeamName = getTeamName(teamAbbrev) || teamAbbrev || '';
            
            return `${index + 1}⭐ ${playerName}${starTeamName ? ` (${starTeamName})` : ''}`;
        }).join('\n');
        
        embed.fields.push({
            name: '⭐ Three Stars',
            value: starsText,
            inline: false
        });
    }
    
    message.reply({ embeds: [embed] });
}

module.exports = {
    recap
};
