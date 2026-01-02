/**
 * Standings Commands
 * Division, conference, and league standings
 */

const { getTeamAbbr, getTeamName } = require('../utils/teamUtils');
const { getStandings } = require('../api/nhlApi');

async function divisionStandings(message, args) {
    const teamInput = args[1];
    
    if (!teamInput) {
        message.reply('Please specify a team! Example: `!divisionstandings pen`');
        return;
    }
    
    const teamAbbr = getTeamAbbr(teamInput);
    const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
    
    if (!teamName) {
        message.reply(`Sorry, I don't recognize the team "${teamInput}".`);
        return;
    }
    
    const standings = await getStandings();
    
    if (!standings) {
        message.reply('Sorry, there was an error getting the standings information.');
        return;
    }
    
    // Find team's division and show division standings
    let divisionStandings = null;
    for (const standing of standings.standings) {
        const teamInDivision = standing.teamAbbrev.default === teamAbbr;
        if (teamInDivision) {
            divisionStandings = standings.standings.filter(team => 
                team.divisionName === standing.divisionName
            ).sort((a, b) => b.points - a.points);
            break;
        }
    }
    
    if (!divisionStandings) {
        message.reply('Could not find division standings.');
        return;
    }
    
    const standingsText = divisionStandings.slice(0, 8).map((team, index) => 
        `${index + 1}. ${getTeamName(team.teamAbbrev.default) || team.teamName.default} (${team.wins}-${team.losses}-${team.otLosses}) - ${team.points}pts`
    ).join('\n');
    
    const embed = {
        color: 0x0099ff,
        title: `🏆 ${divisionStandings[0].divisionName} Division Standings`,
        description: '```' + standingsText + '```',
        footer: { text: 'NHL Bot - Division Standings' }
    };
    
    message.reply({ embeds: [embed] });
}

async function conferenceStandings(message, args) {
    const teamInput = args[1];
    
    if (!teamInput) {
        message.reply('Please specify a team! Example: `!conferencestandings pen`');
        return;
    }
    
    const teamAbbr = getTeamAbbr(teamInput);
    const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
    
    if (!teamName) {
        message.reply(`Sorry, I don't recognize the team "${teamInput}".`);
        return;
    }
    
    const standings = await getStandings();
    
    if (!standings) {
        message.reply('Sorry, there was an error getting the standings information.');
        return;
    }
    
    // Find team's conference and show conference standings
    let conferenceName = null;
    for (const standing of standings.standings) {
        if (standing.teamAbbrev.default === teamAbbr) {
            conferenceName = standing.conferenceName;
            break;
        }
    }
    
    if (!conferenceName) {
        message.reply('Could not find conference standings.');
        return;
    }
    
    const conferenceStandings = standings.standings
        .filter(team => team.conferenceName === conferenceName)
        .sort((a, b) => b.points - a.points);
    
    const firstHalf = conferenceStandings.slice(0, 8);
    const secondHalf = conferenceStandings.slice(8, 16);
    
    const formatTeamLine = (team, index) => {
        const name = getTeamName(team.teamAbbrev.default) || team.teamName.default;
        if (team.teamAbbrev.default === teamAbbr) {
            return `➤ ${index + 1}. ${name} (${team.wins}-${team.losses}-${team.otLosses}) - ${team.points}pts`;
        }
        return `  ${index + 1}. ${name} (${team.wins}-${team.losses}-${team.otLosses}) - ${team.points}pts`;
    };
    
    const standingsText1 = firstHalf.map((team, index) => formatTeamLine(team, index)).join('\n');
    const standingsText2 = secondHalf.map((team, index) => formatTeamLine(team, index + 8)).join('\n');
    
    const embed1 = {
        color: 0x0099ff,
        title: `🏆 ${conferenceName} Conference Standings (1-8)`,
        description: '```' + standingsText1 + '```',
        footer: { text: `${teamName} highlighted with ➤` }
    };
    
    const embed2 = {
        color: 0x0099ff,
        title: `🏆 ${conferenceName} Conference Standings (9-16)`,
        description: '```' + standingsText2 + '```',
        footer: { text: 'NHL Bot - Conference Standings' }
    };
    
    message.reply({ embeds: [embed1, embed2] });
}

async function leagueStandings(message, args) {
    const teamInput = args[1];
    
    const standings = await getStandings();
    
    if (!standings) {
        message.reply('Sorry, there was an error getting the standings information.');
        return;
    }
    
    const highlightTeam = teamInput ? getTeamAbbr(teamInput) : null;
    const isValidTeam = highlightTeam && getTeamName(highlightTeam);
    
    const sortedTeams = standings.standings.sort((a, b) => b.points - a.points);
    
    if (isValidTeam) {
        // Find the highlighted team's position and info
        const teamIndex = sortedTeams.findIndex(team => team.teamAbbrev.default === highlightTeam);
        const highlightedTeam = sortedTeams[teamIndex];
        const teamName = getTeamName(highlightedTeam.teamAbbrev.default);
        
        const highlightEmbed = {
            color: 0xffd700, // Gold color for highlight
            title: `🏒 ${teamName} - League Position`,
            description: `**Rank #${teamIndex + 1} of 32**`,
            fields: [
                {
                    name: '📊 Record',
                    value: `${highlightedTeam.wins}-${highlightedTeam.losses}-${highlightedTeam.otLosses}`,
                    inline: true
                },
                {
                    name: '🏆 Points',
                    value: `${highlightedTeam.points}`,
                    inline: true
                },
                {
                    name: '📈 Points %',
                    value: `${(highlightedTeam.pointPctg * 100).toFixed(1)}%`,
                    inline: true
                }
            ],
            footer: { text: 'Your team is highlighted below in the full standings' }
        };
        
        const firstHalf = sortedTeams.slice(0, 16);
        const secondHalf = sortedTeams.slice(16);
        
        const formatTeamLine = (team, index) => {
            const teamLineName = getTeamName(team.teamAbbrev.default) || team.teamName.default;
            // Use arrow emoji for highlighted team
            if (highlightTeam && team.teamAbbrev.default === highlightTeam) {
                return `➤ ${index + 1}. ${teamLineName} (${team.wins}-${team.losses}-${team.otLosses}) - ${team.points}pts`;
            }
            return `  ${index + 1}. ${teamLineName} (${team.wins}-${team.losses}-${team.otLosses}) - ${team.points}pts`;
        };
        
        const standingsText1 = firstHalf.map((team, index) => 
            formatTeamLine(team, index)
        ).join('\n');
        
        const standingsText2 = secondHalf.map((team, index) => 
            formatTeamLine(team, index + 16)
        ).join('\n');
        
        const embed1 = {
            color: 0x0099ff,
            title: '🏆 Full NHL League Standings (1-16)',
            description: '```' + standingsText1 + '```',
            footer: { text: 'NHL Bot - League Standings (Part 1 of 2)' }
        };
        
        const embed2 = {
            color: 0x0099ff,
            title: '🏆 Full NHL League Standings (17-32)',
            description: '```' + standingsText2 + '```',
            footer: { text: 'NHL Bot - League Standings (Part 2 of 2)' }
        };
        
        message.reply({ embeds: [highlightEmbed, embed1, embed2] });
    } else {
        const firstHalf = sortedTeams.slice(0, 16);
        const secondHalf = sortedTeams.slice(16);
        
        const standingsText1 = firstHalf.map((team, index) => 
            `${index + 1}. ${getTeamName(team.teamAbbrev.default) || team.teamName.default} (${team.wins}-${team.losses}-${team.otLosses}) - ${team.points}pts`
        ).join('\n');
        
        const standingsText2 = secondHalf.map((team, index) => 
            `${index + 17}. ${getTeamName(team.teamAbbrev.default) || team.teamName.default} (${team.wins}-${team.losses}-${team.otLosses}) - ${team.points}pts`
        ).join('\n');
        
        const embed1 = {
            color: 0x0099ff,
            title: '🏆 NHL League Standings (1-16)',
            description: '```' + standingsText1 + '```',
            footer: { text: 'NHL Bot - League Standings (Part 1 of 2)' }
        };
        
        const embed2 = {
            color: 0x0099ff,
            title: '🏆 NHL League Standings (17-32)',
            description: '```' + standingsText2 + '```',
            footer: { text: 'NHL Bot - League Standings (Part 2 of 2)' }
        };
        
        if (teamInput && !isValidTeam) {
            message.reply(`Sorry, I don't recognize the team "${teamInput}". Showing full standings without highlighting.`);
        }
        
        message.reply({ embeds: [embed1, embed2] });
    }
}

module.exports = {
    divisionStandings,
    conferenceStandings,
    leagueStandings
};
