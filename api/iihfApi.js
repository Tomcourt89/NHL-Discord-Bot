/**
 * IIHF Men's World Championship API
 * Fetches schedule and scores from TheSportsDB's free API
 * League: 4976 - Mens Ice Hockey World Championships
 */

const axios = require('axios');

const API_KEY = '3'; // TheSportsDB free public test key
const LEAGUE_ID = '4976';
const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;

// Cache to reduce API calls
let scheduleCache = {
    season: null,
    data: null,
    timestamp: 0
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Determine the current IIHF Worlds season year.
 * Tournament typically runs in May. After July, roll to next year.
 */
function getCurrentSeason() {
    const now = new Date();
    const year = now.getFullYear();
    return now.getMonth() >= 7 ? String(year + 1) : String(year);
}

/**
 * Fetch the full season schedule from TheSportsDB.
 * @param {string} season - Season year (e.g. "2026")
 */
async function getIIHFSeason(season = getCurrentSeason()) {
    const now = Date.now();

    if (
        scheduleCache.season === season &&
        scheduleCache.data &&
        now - scheduleCache.timestamp < CACHE_TTL
    ) {
        return scheduleCache.data;
    }

    const url = `${BASE_URL}/eventsseason.php?id=${LEAGUE_ID}&s=${season}`;

    try {
        const response = await axios.get(url);
        const events = response.data?.events || [];

        scheduleCache = { season, data: events, timestamp: now };
        return events;
    } catch (error) {
        console.error('Error fetching IIHF schedule:', error.message);
        return [];
    }
}

/**
 * Clean a team name (strip " Ice Hockey" suffix used by TheSportsDB).
 */
function cleanTeamName(name) {
    if (!name) return 'TBD';
    return name.replace(/\s+Ice Hockey$/i, '').trim();
}

/**
 * Parse raw event objects into a normalized shape.
 */
function parseGames(events) {
    if (!Array.isArray(events)) return [];

    return events
        .map(event => {
            // TheSportsDB returns dateEvent (YYYY-MM-DD) and strTime (HH:MM:SS) in UTC.
            const dateStr = event.dateEvent || event.dateEventLocal;
            const timeStr = event.strTime || '00:00:00';
            const iso = dateStr ? `${dateStr}T${timeStr}Z` : null;
            const date = iso ? new Date(iso) : null;

            const homeScore = event.intHomeScore;
            const awayScore = event.intAwayScore;
            const hasScore = homeScore !== null && homeScore !== '' && homeScore !== undefined;
            const status = (event.strStatus || event.strPostponed || '').toString();

            const isComplete =
                hasScore &&
                (status === '' ||
                    /ft|finished|final|ended/i.test(status) ||
                    (date && date < new Date(Date.now() - 4 * 60 * 60 * 1000)));

            const isLive = /live|in progress|1st|2nd|3rd|ot|overtime/i.test(status);

            return {
                id: event.idEvent,
                name: event.strEvent,
                round: event.intRound || event.strRound || '',
                date,
                venue: event.strVenue || 'TBD',
                statusDetail: status || (isComplete ? 'Final' : 'Scheduled'),
                isComplete: !!isComplete,
                isLive,
                homeTeam: {
                    name: cleanTeamName(event.strHomeTeam),
                    score: hasScore ? String(homeScore) : ''
                },
                awayTeam: {
                    name: cleanTeamName(event.strAwayTeam),
                    score: awayScore !== null && awayScore !== undefined && awayScore !== ''
                        ? String(awayScore)
                        : ''
                }
            };
        })
        .filter(g => g.date && !isNaN(g.date.getTime()))
        .sort((a, b) => a.date - b.date);
}

/**
 * Upcoming games (next 7 days, plus any live games).
 */
async function getUpcomingIIHFGames() {
    const games = parseGames(await getIIHFSeason());
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + 7);

    return games.filter(g => g.isLive || (!g.isComplete && g.date >= now && g.date <= cutoff));
}

/**
 * Today's games only.
 */
async function getTodaysIIHFGames() {
    const games = parseGames(await getIIHFSeason());
    const todayStr = new Date().toDateString();
    return games.filter(g => g.date.toDateString() === todayStr);
}

/**
 * Full tournament schedule.
 */
async function getFullIIHFSchedule() {
    return parseGames(await getIIHFSeason());
}

module.exports = {
    getIIHFSeason,
    getUpcomingIIHFGames,
    getTodaysIIHFGames,
    getFullIIHFSchedule,
    parseGames
};
