const axios = require('axios');

// ESPN injuries cache
let injuriesCache = {
    data: null,
    timestamp: 0
};
const INJURIES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getInjuries() {
    const now = Date.now();
    
    if (injuriesCache.data && (now - injuriesCache.timestamp) < INJURIES_CACHE_TTL) {
        return injuriesCache.data;
    }
    
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries');
    
    injuriesCache.data = response.data;
    injuriesCache.timestamp = now;
    
    return response.data;
}

function getTeamInjuries(injuriesData, teamName) {
    if (!injuriesData || !injuriesData.injuries) return [];
    
    const team = injuriesData.injuries.find(t => t.displayName === teamName);
    return team ? team.injuries : [];
}

function searchPlayerInjury(injuriesData, playerQuery) {
    if (!injuriesData || !injuriesData.injuries) return [];
    
    const query = playerQuery.toLowerCase();
    const matches = [];
    
    for (const team of injuriesData.injuries) {
        for (const injury of team.injuries) {
            const playerName = injury.athlete?.displayName?.toLowerCase() || '';
            if (playerName.includes(query)) {
                matches.push({
                    ...injury,
                    teamName: team.displayName
                });
            }
        }
    }
    
    return matches;
}

module.exports = {
    getInjuries,
    getTeamInjuries,
    searchPlayerInjury
};
