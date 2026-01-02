/**
 * Injuries Commands
 * Team injury reports and individual player injury details
 */

const { getTeamAbbr, getTeamName } = require('../utils/teamUtils');
const { getInjuries, getTeamInjuries, searchPlayerInjury } = require('../api/injuriesApi');

async function injuries(message, args) {
    const teamInput = args[1];
    
    if (!teamInput) {
        message.reply('Please specify a team! Example: `!injuries pens` for Pittsburgh Penguins');
        return;
    }
    
    const teamAbbr = getTeamAbbr(teamInput);
    const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
    
    if (!teamName) {
        message.reply(`Sorry, I don't recognize the team "${teamInput}". Use \`!commands\` to see supported teams.`);
        return;
    }
    
    const injuriesData = await getInjuries();
    
    if (!injuriesData) {
        message.reply('Sorry, there was an error fetching injury data. Please try again later.');
        return;
    }
    
    const teamInjuries = getTeamInjuries(injuriesData, teamName);
    
    if (teamInjuries.length === 0) {
        const embed = {
            color: 0x00ff00,
            title: `🏥 ${teamName} Injury Report`,
            description: 'No injuries reported.',
            timestamp: new Date().toISOString(),
            footer: { text: 'Injury data from ESPN' }
        };
        message.reply({ embeds: [embed] });
        return;
    }
    
    const injuryList = teamInjuries.map(injury => {
        const playerName = injury.athlete?.displayName || 'Unknown Player';
        const status = injury.status || 'Unknown';
        return `**${playerName}** - ${status}`;
    }).join('\n');
    
    const embed = {
        color: 0xff6b6b,
        title: `🏥 ${teamName} Injury Report`,
        description: injuryList,
        fields: [
            {
                name: '📊 Total Injured',
                value: `${teamInjuries.length} player${teamInjuries.length > 1 ? 's' : ''}`,
                inline: true
            }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Injury data from ESPN • Use !injury [player] for details' }
    };
    
    message.reply({ embeds: [embed] });
}

async function injury(message, args) {
    const playerQuery = args.slice(1).join(' ');
    
    if (!playerQuery) {
        message.reply('Please specify a player name! Example: `!injury malkin`');
        return;
    }
    
    const injuriesData = await getInjuries();
    
    if (!injuriesData) {
        message.reply('Sorry, there was an error fetching injury data. Please try again later.');
        return;
    }
    
    const matches = searchPlayerInjury(injuriesData, playerQuery);
    
    if (matches.length === 0) {
        message.reply(`No injury information found for "${playerQuery}". The player may not be injured or the name wasn't recognized.`);
        return;
    }
    
    const embeds = matches.slice(0, 5).map(injuryData => {
        const playerName = injuryData.athlete?.displayName || 'Unknown Player';
        const status = injuryData.status || 'Unknown';
        const injuryType = injuryData.details?.type || 'Undisclosed';
        const returnDate = injuryData.details?.returnDate;
        const lastUpdated = injuryData.date ? new Date(injuryData.date).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : 'Unknown';
        const longComment = injuryData.longComment || 'No additional details available.';
        
        const fields = [
            {
                name: '🏒 Team',
                value: injuryData.teamName || 'Unknown',
                inline: true
            },
            {
                name: '📋 Status',
                value: status,
                inline: true
            },
            {
                name: '🩹 Injury Type',
                value: injuryType,
                inline: true
            },
            {
                name: '📅 Last Updated',
                value: lastUpdated,
                inline: true
            }
        ];
        
        if (returnDate) {
            const returnDateFormatted = new Date(returnDate).toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            fields.push({
                name: '🔄 Expected Return',
                value: returnDateFormatted,
                inline: true
            });
        }
        
        fields.push({
            name: '📝 Details',
            value: longComment.length > 1024 ? longComment.substring(0, 1021) + '...' : longComment,
            inline: false
        });
        
        return {
            color: 0xff6b6b,
            title: `🏥 ${playerName} - Injury Report`,
            fields: fields,
            timestamp: new Date().toISOString(),
            footer: { text: 'Injury data from ESPN' }
        };
    });
    
    if (matches.length > 5) {
        message.reply({ 
            content: `Found ${matches.length} players matching "${playerQuery}". Showing first 5:`,
            embeds: embeds 
        });
    } else {
        message.reply({ embeds: embeds });
    }
}

module.exports = {
    injuries,
    injury
};
