const axios = require('axios');
const { teamsData, getTeamName } = require('../utils/teamUtils');
const { getCurrentNHLSeason, getPreviousSeason, formatSeasonDisplay } = require('../utils/seasonUtils');
const { scorePlayerMatch } = require('../utils/playerUtils');

async function searchPlayer(playerQuery) {
    const searchResponse = await axios.get(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=50&q=${encodeURIComponent(playerQuery)}`);
    
    if (!searchResponse.data || searchResponse.data.length === 0) {
        return null;
    }
    
    const queryParts = playerQuery.trim().split(/\s+/);
    
    const candidates = searchResponse.data
        .filter(player => player.active === true && player.teamAbbrev && teamsData[player.teamAbbrev])
        .map(player => ({
            ...player,
            score: scorePlayerMatch(player.name, queryParts)
        }))
        .filter(player => player.score > 0)
        .sort((a, b) => b.score - a.score);
    
    if (candidates.length === 0) {
        return null;
    }
    
    const bestMatch = candidates[0];
    
    const landingResponse = await axios.get(`https://api-web.nhle.com/v1/player/${bestMatch.playerId}/landing`);
    const landingData = landingResponse.data;
    
    return {
        playerId: bestMatch.playerId,
        name: bestMatch.name,
        position: landingData?.position || 'N/A',
        positionCode: landingData?.position || 'N/A',
        team: landingData?.currentTeamAbbrev || 'N/A',
        teamName: landingData?.currentTeamAbbrev ? getTeamName(landingData.currentTeamAbbrev) : 'N/A',
        score: bestMatch.score
    };
}

async function getPlayerStats(playerQuery) {
    const searchResponse = await axios.get(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=50&q=${encodeURIComponent(playerQuery)}`);
    
    if (!searchResponse.data || searchResponse.data.length === 0) {
        return null;
    }
    
    const queryParts = playerQuery.trim().split(/\s+/);
    const isFullNameQuery = queryParts.length > 1;
    const currentSeason = getCurrentNHLSeason();
    
    const candidates = searchResponse.data
        .filter(player => player.active === true && player.teamAbbrev && teamsData[player.teamAbbrev])
        .map(player => ({
            ...player,
            score: scorePlayerMatch(player.name, queryParts)
        }))
        .filter(player => player.score > 0)
        .sort((a, b) => b.score - a.score);
    
    if (candidates.length === 0) {
        return null;
    }
    
    const topCandidate = candidates[0];
    if (isFullNameQuery && topCandidate.score >= 80) {
        const statsResponse = await axios.get(`https://api-web.nhle.com/v1/player/${topCandidate.playerId}/landing`);
        const landingData = statsResponse.data;
        const currentSeasonStats = landingData?.seasonTotals?.find(season => 
            season.season === currentSeason && season.leagueAbbrev === 'NHL'
        );
        if (currentSeasonStats) {
            return [{
                name: topCandidate.name,
                team: landingData.currentTeamAbbrev || 'N/A',
                position: landingData.position || 'N/A',
                stats: currentSeasonStats,
                playerId: topCandidate.playerId,
                season: currentSeason,
                score: topCandidate.score
            }];
        }
    }
    
    const toFetch = candidates.slice(0, 8);
    const results = await Promise.all(toFetch.map(async (player) => {
        try {
            const statsResponse = await axios.get(`https://api-web.nhle.com/v1/player/${player.playerId}/landing`);
            const landingData = statsResponse.data;
            const currentSeasonStats = landingData?.seasonTotals?.find(season => 
                season.season === currentSeason && season.leagueAbbrev === 'NHL'
            );
            if (currentSeasonStats) {
                return {
                    name: player.name,
                    team: landingData.currentTeamAbbrev || 'N/A',
                    position: landingData.position || 'N/A',
                    stats: currentSeasonStats,
                    playerId: player.playerId,
                    season: currentSeason,
                    score: player.score
                };
            }
        } catch (error) {
            console.error(`Error fetching stats for player ${player.playerId}:`, error);
        }
        return null;
    }));
    
    const playerStats = results.filter(p => p !== null).sort((a, b) => b.score - a.score);
    return playerStats.slice(0, 5);
}

async function getPlayerCareerStats(playerQuery) {
    const searchResponse = await axios.get(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=50&q=${encodeURIComponent(playerQuery)}`);
    
    if (!searchResponse.data || searchResponse.data.length === 0) {
        return null;
    }
    
    const queryParts = playerQuery.trim().split(/\s+/);
    const isFullNameQuery = queryParts.length > 1;
    
    const candidates = searchResponse.data
        .map(player => ({
            ...player,
            score: scorePlayerMatch(player.name, queryParts),
            isActiveNHL: player.active === true && player.teamAbbrev && teamsData[player.teamAbbrev]
        }))
        .filter(player => player.score > 0)
        .sort((a, b) => {
            if (a.isActiveNHL !== b.isActiveNHL) return b.isActiveNHL ? 1 : -1;
            return b.score - a.score;
        });
    
    if (candidates.length === 0) {
        return null;
    }
    
    const topCandidate = candidates[0];
    if (isFullNameQuery && topCandidate.score >= 80) {
        const statsResponse = await axios.get(`https://api-web.nhle.com/v1/player/${topCandidate.playerId}/landing`);
        const landingData = statsResponse.data;
        const hasNHLCareer = landingData?.seasonTotals?.some(season => season.leagueAbbrev === 'NHL');
        const careerStats = landingData?.careerTotals?.regularSeason;
        if (hasNHLCareer && careerStats) {
            return [{
                name: topCandidate.name,
                team: landingData.currentTeamAbbrev || 'N/A',
                position: landingData.position || 'N/A',
                stats: careerStats,
                playerId: topCandidate.playerId,
                birthDate: landingData.birthDate,
                birthCity: landingData.birthCity?.default,
                birthCountry: landingData.birthCountry,
                score: topCandidate.score,
                isActive: topCandidate.isActiveNHL
            }];
        }
    }
    
    const toFetch = candidates.slice(0, 10);
    const results = await Promise.all(toFetch.map(async (player) => {
        try {
            const statsResponse = await axios.get(`https://api-web.nhle.com/v1/player/${player.playerId}/landing`);
            const landingData = statsResponse.data;
            const hasNHLCareer = landingData?.seasonTotals?.some(season => season.leagueAbbrev === 'NHL');
            const careerStats = landingData?.careerTotals?.regularSeason;
            if (hasNHLCareer && careerStats) {
                return {
                    name: player.name,
                    team: landingData.currentTeamAbbrev || 'N/A',
                    position: landingData.position || 'N/A',
                    stats: careerStats,
                    playerId: player.playerId,
                    birthDate: landingData.birthDate,
                    birthCity: landingData.birthCity?.default,
                    birthCountry: landingData.birthCountry,
                    score: player.score,
                    isActive: player.isActiveNHL
                };
            }
        } catch (error) {
            console.error(`Error fetching career stats for player ${player.playerId}:`, error);
        }
        return null;
    }));
    
    const playerCareerStats = results
        .filter(p => p !== null)
        .sort((a, b) => {
            if (a.isActive !== b.isActive) return b.isActive ? 1 : -1;
            return b.score - a.score;
        });
    
    return playerCareerStats.slice(0, 5);
}

async function getPlayerPastGames(playerId, numGames, isPlayoffs = false) {
    const games = [];
    let currentSeason = getCurrentNHLSeason();
    const gameType = isPlayoffs ? 3 : 2;
    
    const now = new Date();
    const month = now.getMonth() + 1;
    if (isPlayoffs && month >= 9 && month <= 12) {
        currentSeason = getPreviousSeason(currentSeason);
    } else if (isPlayoffs && month >= 1 && month <= 4) {
        currentSeason = getPreviousSeason(currentSeason);
    }
    
    let attempts = 0;
    const maxAttempts = 10;
    
    while (games.length < numGames && attempts < maxAttempts) {
        try {
            const response = await axios.get(`https://api-web.nhle.com/v1/player/${playerId}/game-log/${currentSeason}/${gameType}`);
            
            if (response.data && response.data.gameLog && response.data.gameLog.length > 0) {
                const seasonGames = response.data.gameLog.map(game => ({
                    ...game,
                    seasonDisplay: formatSeasonDisplay(currentSeason),
                    season: currentSeason
                }));
                
                games.push(...seasonGames);
            }
        } catch (error) {
            // Game log not available for this season, try previous
        }
        
        currentSeason = getPreviousSeason(currentSeason);
        attempts++;
    }
    
    return games.slice(0, numGames);
}

module.exports = {
    searchPlayer,
    getPlayerStats,
    getPlayerCareerStats,
    getPlayerPastGames
};
