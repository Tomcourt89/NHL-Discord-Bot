/**
 * Team Past Games Commands
 * Shows last 5/10/20 games for a team with aggregate stats
 */

const { getTeamAbbr, getTeamName } = require('../utils/teamUtils');
const { getTeamPastGames } = require('../api/nhlApi');
const { parseFlags } = require('../utils/formatUtils');

async function teamPastGames(message, args, numGames) {
    const { flags, cleanArgs } = parseFlags(args, ['spoilerfree', 'playoffs']);
    const isSpoilerFree = flags.spoilerfree;
    const isPlayoffs = flags.playoffs;
    const teamArg = cleanArgs.join(' ');
    
    if (cleanArgs.length === 0) {
        message.reply(`Please specify a team! Example: \`!teampast${numGames} pen\` or \`!teampast${numGames} pen playoffs\` or \`!teampast${numGames} pen spoilerfree\``);
        return;
    }
    
    const teamAbbr = getTeamAbbr(teamArg);
    const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
    
    if (!teamName) {
        message.reply(`Sorry, I don't recognize the team "${teamArg}". Use \`!commands\` to see supported teams.`);
        return;
    }
    
    const games = await getTeamPastGames(teamAbbr, numGames, isPlayoffs);
    
    if (!games || games.length === 0) {
        const gameTypeText = isPlayoffs ? 'playoff' : 'regular season';
        message.reply(`No recent ${gameTypeText} games found for the ${teamName}.`);
        return;
    }
    
    // Calculate aggregate stats
    let wins = 0, losses = 0, otLosses = 0, goalsFor = 0, goalsAgainst = 0;
    
    games.forEach(game => {
        const isHome = game.homeTeam.abbrev === teamAbbr;
        const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
        const oppScore = isHome ? game.awayTeam.score : game.homeTeam.score;
        
        goalsFor += teamScore;
        goalsAgainst += oppScore;
        
        if (teamScore > oppScore) {
            wins++;
        } else if (game.gameOutcome?.lastPeriodType === 'OT' || game.gameOutcome?.lastPeriodType === 'SO') {
            otLosses++;
        } else {
            losses++;
        }
    });
    
    const goalDiff = goalsFor - goalsAgainst;
    
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
        // Add season divider if multiple seasons
        if (seasons.length > 1) {
            const dividerText = isPlayoffs ? `${season} Playoffs` : `${season} Regular Season`;
            gameLines.push(`── ${dividerText} ──`);
        }
        
        gamesBySeason[season].forEach(game => {
            const gameDate = new Date(game.startTimeUTC);
            const dateStr = gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const isHome = game.homeTeam.abbrev === teamAbbr;
            const opponent = isHome ? game.awayTeam.abbrev : game.homeTeam.abbrev;
            const location = isHome ? 'vs' : '@';
            
            if (isSpoilerFree) {
                // Spoiler-free: only show date, location, and opponent
                gameLines.push(`${dateStr} ${location} ${opponent}`);
            } else {
                // Normal mode: show full results
                const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
                const oppScore = isHome ? game.awayTeam.score : game.homeTeam.score;
                
                let result = teamScore > oppScore ? 'W' : 'L';
                if (teamScore < oppScore && (game.gameOutcome?.lastPeriodType === 'OT' || game.gameOutcome?.lastPeriodType === 'SO')) {
                    result = 'OTL';
                }
                
                const otIndicator = (game.gameOutcome?.lastPeriodType === 'OT' || game.gameOutcome?.lastPeriodType === 'SO') ? ` (${game.gameOutcome.lastPeriodType})` : '';
                
                gameLines.push(`${dateStr} ${location} ${opponent}: ${result} ${teamScore}-${oppScore}${otIndicator}`);
            }
        });
    });
    
    const gameTypeTitle = isPlayoffs ? 'Playoff' : 'Regular Season';
    const actualGames = games.length;
    const insufficientNote = actualGames < numGames ? `\n*(Only ${actualGames} ${isPlayoffs ? 'playoff' : ''} games found)*` : '';
    const spoilerNote = isSpoilerFree ? '\n*(Spoiler-free mode - scores hidden)*' : '';
    
    // Build description with character limit safety (Discord max 4096)
    let gameListText = gameLines.join('\n');
    let descriptionText = '```\n' + gameListText + '\n```' + insufficientNote + spoilerNote;
    
    // Truncate if too long
    if (descriptionText.length > 4000) {
        const maxGameLines = Math.floor(3900 / 45);
        gameListText = gameLines.slice(0, maxGameLines).join('\n') + '\n... (truncated)';
        descriptionText = '```\n' + gameListText + '\n```' + insufficientNote;
    }
    
    // Build embed - hide stats fields in spoiler-free mode
    const embedFields = isSpoilerFree ? [] : [
        {
            name: '🏒 Record',
            value: `${wins}-${losses}-${otLosses}`,
            inline: true
        },
        {
            name: '⚽ Goals For',
            value: `${goalsFor}`,
            inline: true
        },
        {
            name: '🥅 Goals Against',
            value: `${goalsAgainst}`,
            inline: true
        },
        {
            name: '📊 Goal Diff',
            value: `${goalDiff > 0 ? '+' : ''}${goalDiff}`,
            inline: true
        },
        {
            name: '📈 GF/Game',
            value: `${(goalsFor / actualGames).toFixed(2)}`,
            inline: true
        },
        {
            name: '📉 GA/Game',
            value: `${(goalsAgainst / actualGames).toFixed(2)}`,
            inline: true
        }
    ];
    
    const embed = {
        color: isSpoilerFree ? 0x808080 : (isPlayoffs ? 0xffd700 : 0x0099ff),
        title: `📊 ${teamName} - Last ${actualGames} ${gameTypeTitle} Games`,
        description: descriptionText,
        fields: embedFields,
        timestamp: new Date().toISOString(),
        footer: {
            text: isSpoilerFree 
                ? `NHL Bot - Spoiler Free • Add "playoffs" for playoff games`
                : `NHL Bot - ${gameTypeTitle} Stats • Add "playoffs" for playoff stats`
        }
    };
    
    message.reply({ embeds: [embed] });
}

// Wrapper functions for each command
async function teamPast5(message, args) {
    await teamPastGames(message, args, 5);
}

async function teamPast10(message, args) {
    await teamPastGames(message, args, 10);
}

async function teamPast20(message, args) {
    await teamPastGames(message, args, 20);
}

module.exports = {
    teamPast5,
    teamPast10,
    teamPast20
};
