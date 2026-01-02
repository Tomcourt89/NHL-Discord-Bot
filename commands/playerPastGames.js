/**
 * Player Past Games Commands
 * Shows last 5/10/20 games for a player with aggregate stats
 */

const { getTeamName } = require('../utils/teamUtils');
const { searchPlayer, getPlayerPastGames } = require('../api/playerApi');

async function playerPastGames(message, args, numGames) {
    const allArgs = args.slice(1);
    
    if (allArgs.length === 0) {
        message.reply(`Please specify a player name! Example: \`!playerpast${numGames} crosby\` or \`!playerpast${numGames} crosby playoffs\``);
        return;
    }
    
    // Check for playoffs flag and build player query
    const isPlayoffs = allArgs[allArgs.length - 1]?.toLowerCase() === 'playoffs';
    const playerQuery = isPlayoffs ? allArgs.slice(0, -1).join(' ') : allArgs.join(' ');
    
    if (!playerQuery) {
        message.reply(`Please specify a player name! Example: \`!playerpast${numGames} crosby\``);
        return;
    }
    
    // Search for the player
    const player = await searchPlayer(playerQuery);
    
    if (!player) {
        message.reply(`No active NHL player found matching "${playerQuery}".`);
        return;
    }
    
    const games = await getPlayerPastGames(player.playerId, numGames, isPlayoffs);
    
    if (!games || games.length === 0) {
        const gameTypeText = isPlayoffs ? 'playoff' : 'regular season';
        message.reply(`No recent ${gameTypeText} games found for ${player.name}.`);
        return;
    }
    
    const isGoalie = player.position === 'G';
    const actualGames = games.length;
    
    // Calculate aggregate stats based on position
    let totals = {};
    
    if (isGoalie) {
        totals = { 
            gamesStarted: 0, 
            wins: 0, 
            losses: 0, 
            otLosses: 0,
            shotsAgainst: 0, 
            goalsAgainst: 0, 
            saves: 0,
            shutouts: 0,
            toi: 0
        };
        
        games.forEach(game => {
            totals.gamesStarted += game.gamesStarted || 0;
            totals.wins += game.wins || 0;
            totals.losses += game.losses || 0;
            totals.otLosses += game.otLosses || 0;
            totals.shotsAgainst += game.shotsAgainst || 0;
            totals.goalsAgainst += game.goalsAgainst || 0;
            totals.saves += game.savePctg ? Math.round((game.shotsAgainst || 0) * game.savePctg) : (game.shotsAgainst || 0) - (game.goalsAgainst || 0);
            totals.shutouts += game.shutouts || 0;
            // Parse TOI if available (format: "MM:SS")
            if (game.toi) {
                const [mins, secs] = game.toi.split(':').map(Number);
                totals.toi += mins * 60 + secs;
            }
        });
        
        totals.savePct = totals.shotsAgainst > 0 ? (totals.saves / totals.shotsAgainst * 100).toFixed(1) : '0.0';
        totals.gaa = totals.toi > 0 ? (totals.goalsAgainst / (totals.toi / 3600) ).toFixed(2) : '0.00';
    } else {
        totals = { 
            goals: 0, 
            assists: 0, 
            points: 0, 
            plusMinus: 0, 
            pim: 0, 
            shots: 0,
            toi: 0
        };
        
        games.forEach(game => {
            totals.goals += game.goals || 0;
            totals.assists += game.assists || 0;
            totals.points += game.points || 0;
            totals.plusMinus += game.plusMinus || 0;
            totals.pim += game.pim || 0;
            totals.shots += game.shots || 0;
            if (game.toi) {
                const [mins, secs] = game.toi.split(':').map(Number);
                totals.toi += mins * 60 + secs;
            }
        });
    }
    
    // Group games by season for display with dividers
    const gamesBySeason = {};
    games.forEach(game => {
        const season = game.seasonDisplay;
        if (!gamesBySeason[season]) {
            gamesBySeason[season] = [];
        }
        gamesBySeason[season].push(game);
    });
    
    // Build game lines with season dividers
    const gameLines = [];
    const seasons = Object.keys(gamesBySeason);
    
    seasons.forEach((season, seasonIndex) => {
        if (seasons.length > 1) {
            const dividerText = isPlayoffs ? `${season} Playoffs` : `${season} Regular Season`;
            gameLines.push(`── ${dividerText} ──`);
        }
        
        gamesBySeason[season].forEach(game => {
            const gameDate = new Date(game.gameDate + 'T00:00:00'); // Ensure proper date parsing
            const dateStr = gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const opponent = game.opponentAbbrev || 'N/A';
            const homeAway = game.homeRoadFlag === 'H' ? 'vs' : '@';
            
            if (isGoalie) {
                // API returns 1/0 for wins/losses/otLosses, or decision field
                let result = '-';
                if (game.decision === 'W' || game.wins === 1 || game.wins === true) {
                    result = 'W';
                } else if (game.decision === 'L' || game.losses === 1 || game.losses === true) {
                    result = 'L';
                } else if (game.decision === 'O' || game.otLosses === 1 || game.otLosses === true) {
                    result = 'OTL';
                }
                const svPct = game.savePctg ? (game.savePctg * 100).toFixed(1) : '0.0';
                const ga = game.goalsAgainst || 0;
                const sa = game.shotsAgainst || 0;
                gameLines.push(`${dateStr} ${homeAway} ${opponent}: ${result} | ${sa - ga}/${sa} SV (${svPct}%) | ${ga} GA`);
            } else {
                const g = game.goals || 0;
                const a = game.assists || 0;
                const pts = game.points || 0;
                const pm = game.plusMinus || 0;
                const pmStr = pm >= 0 ? `+${pm}` : `${pm}`;
                const pim = game.pim || 0;
                gameLines.push(`${dateStr} ${homeAway} ${opponent}: ${g}G ${a}A ${pts}PTS | ${pmStr} | ${pim}PIM`);
            }
        });
    });
    
    const gameTypeTitle = isPlayoffs ? 'Playoff' : 'Regular Season';
    const insufficientNote = actualGames < numGames ? `\n*(Only ${actualGames} ${isPlayoffs ? 'playoff' : ''} games found)*` : '';
    
    // Build embed fields based on position
    let fields;
    
    if (isGoalie) {
        fields = [
            {
                name: '🏒 Record',
                value: `${totals.wins}-${totals.losses}-${totals.otLosses}`,
                inline: true
            },
            {
                name: '🥅 Save %',
                value: `${totals.savePct}%`,
                inline: true
            },
            {
                name: '🎯 GAA',
                value: `${totals.gaa}`,
                inline: true
            },
            {
                name: '🛡️ Saves',
                value: `${totals.saves}`,
                inline: true
            },
            {
                name: '⚽ GA',
                value: `${totals.goalsAgainst}`,
                inline: true
            },
            {
                name: '🚫 Shutouts',
                value: `${totals.shutouts}`,
                inline: true
            }
        ];
    } else {
        const avgToi = totals.toi > 0 ? Math.floor(totals.toi / actualGames / 60) + ':' + String(Math.floor((totals.toi / actualGames) % 60)).padStart(2, '0') : 'N/A';
        const shootPct = totals.shots > 0 ? (totals.goals / totals.shots * 100).toFixed(1) : '0.0';
        
        fields = [
            {
                name: '⚽ Goals',
                value: `${totals.goals}`,
                inline: true
            },
            {
                name: '🎯 Assists',
                value: `${totals.assists}`,
                inline: true
            },
            {
                name: '📊 Points',
                value: `${totals.points}`,
                inline: true
            },
            {
                name: '+/-',
                value: `${totals.plusMinus >= 0 ? '+' : ''}${totals.plusMinus}`,
                inline: true
            },
            {
                name: '🏒 PIM',
                value: `${totals.pim}`,
                inline: true
            },
            {
                name: '🎯 Shots',
                value: `${totals.shots} (${shootPct}%)`,
                inline: true
            }
        ];
    }
    
    // Build description with character limit safety (Discord max 4096)
    let gameListText = gameLines.join('\n');
    let descriptionText = `${player.position} • ${player.teamName || player.team}\n\`\`\`\n${gameListText}\n\`\`\`${insufficientNote}`;
    
    // Truncate if too long (leave room for formatting)
    if (descriptionText.length > 4000) {
        const maxGameLines = Math.floor((3900 - player.position.length - (player.teamName || player.team).length - insufficientNote.length) / 50);
        gameListText = gameLines.slice(0, maxGameLines).join('\n') + '\n... (truncated)';
        descriptionText = `${player.position} • ${player.teamName || player.team}\n\`\`\`\n${gameListText}\n\`\`\`${insufficientNote}`;
    }
    
    const embed = {
        color: isPlayoffs ? 0xffd700 : 0x0099ff,
        title: `📊 ${player.name} - Last ${actualGames} ${gameTypeTitle} Games`,
        description: descriptionText,
        fields: fields,
        timestamp: new Date().toISOString(),
        footer: {
            text: `NHL Bot - ${gameTypeTitle} Stats • Add "playoffs" for playoff stats`
        }
    };
    
    message.reply({ embeds: [embed] });
}

// Wrapper functions for each command
async function playerPast5(message, args) {
    await playerPastGames(message, args, 5);
}

async function playerPast10(message, args) {
    await playerPastGames(message, args, 10);
}

async function playerPast20(message, args) {
    await playerPastGames(message, args, 20);
}

module.exports = {
    playerPast5,
    playerPast10,
    playerPast20
};
