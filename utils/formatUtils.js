// Format countdown string from a target date
function formatCountdown(targetDate) {
    const now = new Date();
    const target = new Date(targetDate);
    const timeDiff = target.getTime() - now.getTime();
    
    if (timeDiff <= 0) {
        return "Game time!";
    }
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0 || days > 0) result += `${hours}h `;
    result += `${minutes}m`;
    
    return result.trim();
}

// Clean HTML content from RSS feeds
function cleanHtmlContent(html) {
    if (!html) return '';
    
    let text = html.replace(/<[^>]*>/g, '');
    
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&#8217;/g, "'");
    text = text.replace(/&#8216;/g, "'");
    text = text.replace(/&#8220;/g, '"');
    text = text.replace(/&#8221;/g, '"');
    text = text.replace(/&#8211;/g, '-');
    text = text.replace(/&#8212;/g, '—');
    text = text.replace(/&hellip;/g, '...');
    text = text.replace(/&#038;/g, '&');
    
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
}

// Parse RSS XML content
function parseRssXml(xmlText) {
    const items = [];
    const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g);
    
    if (!itemMatches) return items;
    
    for (const itemXml of itemMatches) {
        const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
        const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
        const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
        
        if (titleMatch && linkMatch) {
            items.push({
                title: cleanHtmlContent(titleMatch[1] || titleMatch[2]),
                link: linkMatch[1],
                description: descMatch ? cleanHtmlContent(descMatch[1] || descMatch[2]) : '',
                pubDate: pubDateMatch ? new Date(pubDateMatch[1]) : new Date()
            });
        }
    }
    
    return items;
}

/**
 * Parse flags from arguments (spoilerfree, playoffs, etc.)
 * Flags are always at the end of the arguments array
 * @param {string[]} args - Full args array including command name at index 0
 * @param {string[]} flagNames - Array of flag names to look for (e.g., ['spoilerfree', 'playoffs'])
 * @returns {{ flags: Object, cleanArgs: string[] }} - Object with flag states and cleaned args (excluding command name)
 */
function parseFlags(args, flagNames = ['spoilerfree', 'playoffs']) {
    const flags = {};
    flagNames.forEach(flag => flags[flag] = false);
    
    // Start from args[1] to skip command name
    let cleanArgs = args.slice(1);
    
    // Check for flags from the end
    while (cleanArgs.length > 0) {
        const lastArg = cleanArgs[cleanArgs.length - 1]?.toLowerCase();
        if (flagNames.includes(lastArg)) {
            flags[lastArg] = true;
            cleanArgs = cleanArgs.slice(0, -1);
        } else {
            break;
        }
    }
    
    return { flags, cleanArgs };
}

module.exports = {
    formatCountdown,
    cleanHtmlContent,
    parseRssXml,
    parseFlags
};
