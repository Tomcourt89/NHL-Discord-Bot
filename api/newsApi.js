const axios = require('axios');
const { getTeamSearchKeywords, getTeamRssSlug } = require('../utils/teamUtils');
const { parseRssXml } = require('../utils/formatUtils');

// News cache
let newsCache = {
    data: null,
    timestamp: 0
};
const NEWS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getNewsRSS() {
    const now = Date.now();
    
    if (newsCache.data && (now - newsCache.timestamp) < NEWS_CACHE_TTL) {
        return newsCache.data;
    }
    
    const response = await axios.get('https://www.prohockeyrumors.com/feed');
    const items = parseRssXml(response.data);
    
    newsCache.data = items;
    newsCache.timestamp = now;
    
    return items;
}

async function getTeamNewsRSS(teamAbbr) {
    const slug = getTeamRssSlug(teamAbbr);
    if (!slug) return null;
    
    const response = await axios.get(`https://www.prohockeyrumors.com/category/${slug}/feed`);
    return parseRssXml(response.data);
}

function filterNewsForTeam(newsItems, teamAbbr) {
    if (!newsItems || !Array.isArray(newsItems)) return [];
    
    const keywords = getTeamSearchKeywords(teamAbbr);
    if (!keywords || keywords.length === 0) return [];
    
    const pattern = new RegExp(keywords.join('|'), 'i');
    
    return newsItems.filter(item => {
        const title = item.title || '';
        return pattern.test(title);
    });
}

module.exports = {
    getNewsRSS,
    getTeamNewsRSS,
    filterNewsForTeam
};
