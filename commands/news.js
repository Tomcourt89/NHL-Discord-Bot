/**
 * News Command
 * Shows NHL news and rumors from Pro Hockey Rumors RSS
 */

const { getTeamAbbr, getTeamName } = require('../utils/teamUtils');
const { getNewsRSS, getTeamNewsRSS, filterNewsForTeam } = require('../api/newsApi');

async function news(message, args) {
    const teamInput = args[1];
    
    const newsItems = await getNewsRSS();
    
    if (!newsItems || newsItems.length === 0) {
        message.reply('Sorry, there was an error fetching news. Please try again later.');
        return;
    }
    
    // Check if team-specific news requested
    if (teamInput) {
        const teamAbbr = getTeamAbbr(teamInput);
        const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
        
        if (!teamName) {
            message.reply(`Sorry, I don't recognize the team "${teamInput}". Use \`!commands\` to see supported teams.`);
            return;
        }
        
        // Fetch team-specific RSS feed directly for better results
        let teamNews = await getTeamNewsRSS(teamAbbr);
        
        // Fallback to filtering main feed if team feed fails
        if (!teamNews || teamNews.length === 0) {
            teamNews = filterNewsForTeam(newsItems, teamAbbr);
        }
        
        if (teamNews.length === 0) {
            const embed = {
                color: 0x808080,
                title: `📰 ${teamName} News`,
                description: `No recent news found for the ${teamName}.\n\nUse \`!news\` for league-wide NHL news.`,
                timestamp: new Date().toISOString(),
                footer: { text: 'News from Pro Hockey Rumors' }
            };
            message.reply({ embeds: [embed] });
            return;
        }
        
        const articlesToShow = teamNews.slice(0, 5);
        
        // Use embed fields for better formatting with previews
        const fields = articlesToShow.map(item => {
            const title = item.title || 'Untitled';
            const link = item.link || '';
            const pubDate = item.pubDate ? new Date(item.pubDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            }) : '';
            
            // Truncate description for preview (max ~200 chars)
            let preview = item.description || '';
            if (preview.length > 200) {
                preview = preview.substring(0, 197) + '...';
            }
            
            return {
                name: title.length > 256 ? title.substring(0, 253) + '...' : title,
                value: `${preview}\n\n🕐 ${pubDate} • [Read full article](${link})`,
                inline: false
            };
        });
        
        const embed = {
            color: 0x1e90ff,
            title: `📰 ${teamName} News`,
            fields: fields,
            timestamp: new Date().toISOString(),
            footer: { text: `Showing ${articlesToShow.length} article${articlesToShow.length > 1 ? 's' : ''} • News from Pro Hockey Rumors` }
        };
        
        message.reply({ embeds: [embed] });
        
    } else {
        // League-wide news
        const articlesToShow = newsItems.slice(0, 5);
        
        // Use embed fields for better formatting with previews
        const fields = articlesToShow.map(item => {
            const title = item.title || 'Untitled';
            const link = item.link || '';
            const pubDate = item.pubDate ? new Date(item.pubDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            }) : '';
            
            // Truncate description for preview (max ~200 chars)
            let preview = item.description || '';
            if (preview.length > 200) {
                preview = preview.substring(0, 197) + '...';
            }
            
            return {
                name: title.length > 256 ? title.substring(0, 253) + '...' : title,
                value: `${preview}\n\n🕐 ${pubDate} • [Read full article](${link})`,
                inline: false
            };
        });
        
        const embed = {
            color: 0x1e90ff,
            title: '📰 NHL News & Rumors',
            fields: fields,
            timestamp: new Date().toISOString(),
            footer: { text: 'News from Pro Hockey Rumors • Use !news [team] for team-specific news' }
        };
        
        message.reply({ embeds: [embed] });
    }
}

module.exports = {
    news
};
