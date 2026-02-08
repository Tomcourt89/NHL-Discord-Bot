/**
 * Olympics Hockey API
 * Fetches Men's Olympic hockey schedule from ESPN's API
 */

const axios = require('axios');

// ESPN Olympics endpoint for men's hockey
const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/hockey/olympics-mens-ice-hockey/scoreboard';

// Cache to reduce API calls
let scheduleCache = {
    data: null,
    timestamp: 0
};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch Olympic hockey schedule
 * @param {string} dates - Optional date string (YYYYMMDD) or range (YYYYMMDD-YYYYMMDD)
 * @returns {Object} - Schedule data from ESPN
 */
async function getOlympicSchedule(dates = null) {
    const now = Date.now();
    
    // Check cache (only for default/no-date requests)
    if (!dates && scheduleCache.data && (now - scheduleCache.timestamp) < CACHE_TTL) {
        return scheduleCache.data;
    }
    
    const url = dates ? `${SCOREBOARD_URL}?dates=${dates}` : SCOREBOARD_URL;
    
    try {
        const response = await axios.get(url);
        
        // Cache the response if no specific date
        if (!dates) {
            scheduleCache.data = response.data;
            scheduleCache.timestamp = now;
        }
        
        return response.data;
    } catch (error) {
        console.error('Error fetching Olympic schedule:', error.message);
        return null;
    }
}

/**
 * Parse games from ESPN schedule data
 * @param {Object} scheduleData - Raw schedule data from ESPN
 * @returns {Array} - Array of parsed game objects
 */
function parseGames(scheduleData) {
    if (!scheduleData || !scheduleData.events) {
        return [];
    }
    
    return scheduleData.events.map(event => {
        const competition = event.competitions?.[0];
        const competitors = competition?.competitors || [];
        
        const homeTeam = competitors.find(c => c.homeAway === 'home');
        const awayTeam = competitors.find(c => c.homeAway === 'away');
        
        return {
            id: event.id,
            name: event.name,
            shortName: event.shortName,
            date: new Date(event.date),
            status: competition?.status?.type?.name || 'STATUS_SCHEDULED',
            statusDetail: competition?.status?.type?.detail || 'Scheduled',
            isComplete: competition?.status?.type?.completed || false,
            venue: competition?.venue?.fullName || 'TBD',
            homeTeam: {
                name: homeTeam?.team?.displayName || homeTeam?.team?.name || 'TBD',
                abbreviation: homeTeam?.team?.abbreviation || '',
                score: homeTeam?.score || '0'
            },
            awayTeam: {
                name: awayTeam?.team?.displayName || awayTeam?.team?.name || 'TBD',
                abbreviation: awayTeam?.team?.abbreviation || '',
                score: awayTeam?.score || '0'
            },
            broadcasts: competition?.broadcasts?.[0]?.names || []
        };
    });
}

/**
 * Get upcoming Olympic games (next 7 days)
 * @returns {Array} - Array of upcoming games
 */
async function getUpcomingOlympicGames() {
    // Get games for the next 7 days
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 7);
    
    const startStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, '');
    
    const data = await getOlympicSchedule(`${startStr}-${endStr}`);
    const games = parseGames(data);
    
    // Filter to only upcoming/in-progress games
    const now = new Date();
    return games.filter(g => g.date >= now || !g.isComplete);
}

/**
 * Get today's Olympic games
 * @returns {Array} - Array of today's games only
 */
async function getTodaysOlympicGames() {
    // Get today's date string for the API
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const data = await getOlympicSchedule(todayStr);
    const games = parseGames(data);
    
    // Double-check filter to only games actually on today's date
    const todayDate = today.toDateString();
    return games.filter(g => g.date.toDateString() === todayDate);
}

/**
 * Get full Olympic tournament schedule
 * @returns {Array} - All games in the tournament
 */
async function getFullOlympicSchedule() {
    // 2026 Milano Cortina Olympics hockey: Feb 8-22, 2026
    const data = await getOlympicSchedule('20260208-20260222');
    return parseGames(data);
}

module.exports = {
    getOlympicSchedule,
    getUpcomingOlympicGames,
    getTodaysOlympicGames,
    getFullOlympicSchedule,
    parseGames
};
