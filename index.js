const { Client, GatewayIntentBits, Collection } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

// Load team data from JSON file
const teamsData = require('./teams.json');

// Helper function to get team abbreviation from alias
function getTeamAbbr(input) {
    const inputLower = input.toLowerCase();
    // Check if it's already a valid abbreviation
    if (teamsData[input.toUpperCase()]) {
        return input.toUpperCase();
    }
    // Search through aliases
    for (const [abbr, data] of Object.entries(teamsData)) {
        if (data.aliases.includes(inputLower)) {
            return abbr;
        }
    }
    return null;
}

// Helper function to get team name from abbreviation
function getTeamName(abbr) {
    return teamsData[abbr]?.name || null;
}

// Helper function to get search keywords for RSS filtering
function getTeamSearchKeywords(abbr) {
    return teamsData[abbr]?.searchKeywords || [];
}

// Helper function to get RSS slug
function getTeamRssSlug(abbr) {
    return teamsData[abbr]?.rssSlug || null;
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ESPN injuries cache (5 minute TTL)
let injuriesCache = {
    data: null,
    timestamp: 0
};

const INJURIES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Pro Hockey Rumors RSS cache (10 minute TTL)
let newsCache = {
    data: null,
    timestamp: 0
};

const NEWS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Helper function to clean HTML entities and tags from RSS content
function cleanHtmlContent(html) {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, '')  // Remove HTML tags
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#8217;/g, "'")
        .replace(/&#8216;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&#8230;/g, '...')
        .replace(/&#8211;/g, '-')
        .replace(/&#8212;/g, '—')
        .replace(/&nbsp;/g, ' ')
        .replace(/Â /g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Helper function to parse RSS XML
function parseRssXml(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        
        // Extract title (handle CDATA wrapped or plain)
        const titleMatch = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/s.exec(itemXml);
        const linkMatch = /<link>(.*?)<\/link>/s.exec(itemXml);
        const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/s.exec(itemXml);
        const descMatch = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/s.exec(itemXml);
        
        // Clean and truncate description
        let description = descMatch ? cleanHtmlContent(descMatch[1] || descMatch[2] || '') : '';
        
        items.push({
            title: titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : '',
            link: linkMatch ? linkMatch[1].trim() : '',
            pubDate: pubDateMatch ? pubDateMatch[1].trim() : '',
            description: description
        });
    }
    
    return items;
}

async function getNewsRSS() {
    try {
        const now = Date.now();
        
        // Return cached data if still valid
        if (newsCache.data && (now - newsCache.timestamp) < NEWS_CACHE_TTL) {
            return newsCache.data;
        }
        
        const response = await axios.get('https://www.prohockeyrumors.com/feed');
        const items = parseRssXml(response.data);
        
        // Cache the response
        newsCache.data = items;
        newsCache.timestamp = now;
        
        return items;
    } catch (error) {
        console.error('Error fetching news RSS:', error);
        return null;
    }
}

// Fetch team-specific RSS feed (not cached, used as fallback)
async function getTeamNewsRSS(teamAbbr) {
    try {
        const slug = getTeamRssSlug(teamAbbr);
        if (!slug) return null;
        
        const response = await axios.get(`https://www.prohockeyrumors.com/category/${slug}/feed`);
        return parseRssXml(response.data);
    } catch (error) {
        console.error(`Error fetching team news RSS for ${teamAbbr}:`, error);
        return null;
    }
}

function filterNewsForTeam(newsItems, teamAbbr) {
    if (!newsItems || !Array.isArray(newsItems)) return [];
    
    const keywords = getTeamSearchKeywords(teamAbbr);
    if (!keywords || keywords.length === 0) return [];
    
    // Create regex pattern for team keywords (case insensitive)
    const pattern = new RegExp(keywords.join('|'), 'i');
    
    return newsItems.filter(item => {
        const title = item.title || '';
        return pattern.test(title);
    });
}

async function getInjuries() {
    try {
        const now = Date.now();
        
        // Return cached data if still valid
        if (injuriesCache.data && (now - injuriesCache.timestamp) < INJURIES_CACHE_TTL) {
            return injuriesCache.data;
        }
        
        const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries');
        
        // Cache the response
        injuriesCache.data = response.data;
        injuriesCache.timestamp = now;
        
        return response.data;
    } catch (error) {
        console.error('Error fetching injuries data:', error);
        return null;
    }
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

async function getNextGame(teamAbbreviation) {
    try {
        const response = await axios.get(`https://api-web.nhle.com/v1/club-schedule-season/${teamAbbreviation}/now`);
        const games = response.data.games;
        
        const now = new Date();
        const upcomingGames = games.filter(game => new Date(game.startTimeUTC) >= now);
        
        if (upcomingGames.length === 0) {
            return null;
        }
        
        return upcomingGames[0];
    } catch (error) {
        console.error('Error fetching game data:', error);
        return null;
    }
}

async function getPreviousGame(teamAbbreviation) {
    try {
        const response = await axios.get(`https://api-web.nhle.com/v1/club-schedule-season/${teamAbbreviation}/now`);
        const games = response.data.games;
        
        const now = new Date();
        const pastGames = games.filter(game => new Date(game.startTimeUTC) < now && game.gameState === 'OFF');
        
        if (pastGames.length === 0) {
            return null;
        }
        
        return pastGames[pastGames.length - 1]; // Most recent game
    } catch (error) {
        console.error('Error fetching previous game data:', error);
        return null;
    }
}

async function getTeamStats(teamAbbreviation) {
    try {
        // Try the standings API to get current season stats
        const response = await axios.get('https://api-web.nhle.com/v1/standings/now');
        const teamStats = response.data.standings.find(team => team.teamAbbrev.default === teamAbbreviation);
        
        if (teamStats) {
            return {
                wins: teamStats.wins,
                losses: teamStats.losses,
                otLosses: teamStats.otLosses,
                points: teamStats.points,
                pointPctg: teamStats.pointPctg,
                gamesPlayed: teamStats.gamesPlayed,
                goalFor: teamStats.goalFor,
                goalAgainst: teamStats.goalAgainst,
                goalDifferential: teamStats.goalDifferential
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching team stats:', error);
        return null;
    }
}

function getCurrentNHLSeason() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // getMonth() returns 0-11, so add 1
    
    // NHL season typically starts in October and ends in June
    // So if it's January-June, we're in the season that started the previous year
    // If it's July-December, we're in the season that starts this year
    
    let seasonStartYear;
    if (month >= 7) { // July through December - current year season
        seasonStartYear = year;
    } else { // January through June - season started last year
        seasonStartYear = year - 1;
    }
    
    // NHL season format: 2024-25 season = 20242025
    const seasonEndYear = seasonStartYear + 1;
    return parseInt(`${seasonStartYear}${seasonEndYear}`);
}

// Helper function to get previous season from a season number
function getPreviousSeason(season) {
    const startYear = Math.floor(season / 10000);
    const prevStartYear = startYear - 1;
    return parseInt(`${prevStartYear}${prevStartYear + 1}`);
}

// Helper function to format season for display (e.g., 20252026 -> "2025-26")
function formatSeasonDisplay(season) {
    const startYear = Math.floor(season / 10000);
    const endYear = season % 10000;
    return `${startYear}-${String(endYear).slice(-2)}`;
}

// Fetch team's past games across multiple seasons
async function getTeamPastGames(teamAbbr, numGames, isPlayoffs = false) {
    const games = [];
    let currentSeason = getCurrentNHLSeason();
    const gameType = isPlayoffs ? 3 : 2; // 2 = regular season, 3 = playoffs
    
    // If looking for playoffs during regular season, start from previous season
    const now = new Date();
    const month = now.getMonth() + 1;
    if (isPlayoffs && month >= 9 && month <= 12) {
        // We're in October-December, playoffs haven't started yet
        currentSeason = getPreviousSeason(currentSeason);
    } else if (isPlayoffs && month >= 1 && month <= 4) {
        // We're in Jan-April, current season playoffs likely haven't started
        currentSeason = getPreviousSeason(currentSeason);
    }
    
    // Fetch games going back through seasons until we have enough
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loops
    
    while (games.length < numGames && attempts < maxAttempts) {
        try {
            const response = await axios.get(`https://api-web.nhle.com/v1/club-schedule-season/${teamAbbr}/${currentSeason}`);
            
            if (response.data && response.data.games) {
                // Filter for completed games of the correct type
                const seasonGames = response.data.games.filter(game => {
                    const isCorrectType = game.gameType === gameType;
                    const isCompleted = game.gameState === 'OFF' || game.gameState === 'FINAL';
                    return isCorrectType && isCompleted;
                });
                
                // Sort by date descending (most recent first) and add season info
                seasonGames.sort((a, b) => new Date(b.startTimeUTC) - new Date(a.startTimeUTC));
                seasonGames.forEach(game => {
                    game.seasonDisplay = formatSeasonDisplay(currentSeason);
                    game.season = currentSeason;
                });
                
                games.push(...seasonGames);
            }
        } catch (error) {
            // Season data might not exist, continue to previous season
            console.log(`No data for ${teamAbbr} season ${currentSeason}`);
        }
        
        currentSeason = getPreviousSeason(currentSeason);
        attempts++;
    }
    
    // Return only the requested number of games
    return games.slice(0, numGames);
}

// Fetch player's past games across multiple seasons
async function getPlayerPastGames(playerId, numGames, isPlayoffs = false) {
    const games = [];
    let currentSeason = getCurrentNHLSeason();
    const gameType = isPlayoffs ? 3 : 2; // 2 = regular season, 3 = playoffs
    
    // If looking for playoffs during regular season, start from previous season
    const now = new Date();
    const month = now.getMonth() + 1;
    if (isPlayoffs && month >= 9 && month <= 12) {
        currentSeason = getPreviousSeason(currentSeason);
    } else if (isPlayoffs && month >= 1 && month <= 4) {
        currentSeason = getPreviousSeason(currentSeason);
    }
    
    // Fetch games going back through seasons until we have enough
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
            console.log(`No game log for player ${playerId} season ${currentSeason} gameType ${gameType}`);
        }
        
        currentSeason = getPreviousSeason(currentSeason);
        attempts++;
    }
    
    return games.slice(0, numGames);
}

// Search for a player and return their info including position
async function searchPlayer(playerQuery) {
    try {
        const searchResponse = await axios.get(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=5&q=${encodeURIComponent(playerQuery)}`);
        
        if (!searchResponse.data || searchResponse.data.length === 0) {
            return null;
        }
        
        // Get the first match
        const player = searchResponse.data[0];
        
        // Fetch player landing page for position info
        const landingResponse = await axios.get(`https://api-web.nhle.com/v1/player/${player.playerId}/landing`);
        
        return {
            playerId: player.playerId,
            name: player.name,
            position: landingResponse.data?.position || 'N/A',
            positionCode: landingResponse.data?.position || 'N/A',
            team: landingResponse.data?.currentTeamAbbrev || 'N/A',
            teamName: landingResponse.data?.currentTeamAbbrev ? getTeamName(landingResponse.data.currentTeamAbbrev) : 'N/A'
        };
    } catch (error) {
        console.error('Error searching for player:', error);
        return null;
    }
}

async function getPlayerStats(playerQuery) {
    try {
        // Search for players matching the query
        const searchResponse = await axios.get(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=20&q=${encodeURIComponent(playerQuery)}`);
        
        if (!searchResponse.data || searchResponse.data.length === 0) {
            return null;
        }
        
        const players = searchResponse.data;
        const playerStats = [];
        const currentSeason = getCurrentNHLSeason();
        
        for (const player of players.slice(0, 5)) { // Limit to 5 players max
            try {
                const statsResponse = await axios.get(`https://api-web.nhle.com/v1/player/${player.playerId}/landing`);
                if (statsResponse.data && statsResponse.data.seasonTotals && statsResponse.data.seasonTotals.length > 0) {
                    // Find current season stats
                    const currentSeasonStats = statsResponse.data.seasonTotals.find(season => season.season === currentSeason);
                    
                    if (currentSeasonStats) {
                        playerStats.push({
                            name: `${player.name}`,
                            team: statsResponse.data.currentTeamAbbrev || 'N/A',
                            position: statsResponse.data.position || 'N/A',
                            stats: currentSeasonStats,
                            playerId: player.playerId,
                            season: currentSeason
                        });
                    }
                }
            } catch (error) {
                console.error(`Error fetching stats for player ${player.playerId}:`, error);
                continue;
            }
        }
        
        return playerStats;
    } catch (error) {
        console.error('Error fetching player stats:', error);
        return null;
    }
}

async function getPlayerCareerStats(playerQuery) {
    try {
        // Search for players matching the query
        const searchResponse = await axios.get(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=20&q=${encodeURIComponent(playerQuery)}`);
        
        if (!searchResponse.data || searchResponse.data.length === 0) {
            return null;
        }
        
        const players = searchResponse.data;
        const playerCareerStats = [];
        
        for (const player of players.slice(0, 5)) { // Limit to 5 players max
            try {
                const statsResponse = await axios.get(`https://api-web.nhle.com/v1/player/${player.playerId}/landing`);
                if (statsResponse.data && statsResponse.data.careerTotals) {
                    const careerStats = statsResponse.data.careerTotals.regularSeason;
                    
                    if (careerStats) {
                        playerCareerStats.push({
                            name: `${player.name}`,
                            team: statsResponse.data.currentTeamAbbrev || 'N/A',
                            position: statsResponse.data.position || 'N/A',
                            stats: careerStats,
                            playerId: player.playerId,
                            birthDate: statsResponse.data.birthDate,
                            birthCity: statsResponse.data.birthCity?.default,
                            birthCountry: statsResponse.data.birthCountry
                        });
                    }
                }
            } catch (error) {
                console.error(`Error fetching career stats for player ${player.playerId}:`, error);
                continue;
            }
        }
        
        return playerCareerStats;
    } catch (error) {
        console.error('Error fetching player career stats:', error);
        return null;
    }
}

async function getGameRecap(teamAbbreviation) {
    try {
        const response = await axios.get(`https://api-web.nhle.com/v1/club-schedule-season/${teamAbbreviation}/now`);
        const games = response.data.games;
        
        const now = new Date();
        const pastGames = games.filter(game => new Date(game.startTimeUTC) < now && game.gameState === 'OFF');
        
        if (pastGames.length === 0) {
            return null;
        }
        
        const lastGame = pastGames[pastGames.length - 1]; // Most recent game
        
        try {
            const gameDetailsResponse = await axios.get(`https://api-web.nhle.com/v1/gamecenter/${lastGame.id}/landing`);
            
            let recapVideo = null;
            
            // Search for YouTube video of the game highlights using YouTube Data API
            const awayTeamName = getTeamName(lastGame.awayTeam.abbrev) || lastGame.awayTeam.abbrev;
            const homeTeamName = getTeamName(lastGame.homeTeam.abbrev) || lastGame.homeTeam.abbrev;
            const gameDate = new Date(lastGame.startTimeUTC);
            const dateString = gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            // Extract short team names for more flexible matching
            const awayShortName = awayTeamName.split(' ').pop().toLowerCase(); // e.g., "Ducks" from "Anaheim Ducks"
            const homeShortName = homeTeamName.split(' ').pop().toLowerCase(); // e.g., "Penguins" from "Pittsburgh Penguins"
            
            // Calculate date range for YouTube search - videos are typically uploaded within 2 days of the game
            // Use the game date and day after for the search window
            const gameDateStart = new Date(gameDate);
            gameDateStart.setUTCHours(0, 0, 0, 0);
            const publishedAfter = gameDateStart.toISOString();
            
            // Allow up to 3 days after the game for video uploads
            const gameDateEnd = new Date(gameDate);
            gameDateEnd.setDate(gameDateEnd.getDate() + 3);
            gameDateEnd.setUTCHours(23, 59, 59, 999);
            const publishedBefore = gameDateEnd.toISOString();
            
            // Helper function to check if video publish date is within acceptable range of game date
            function isVideoDateValid(videoPublishDate, gameDate) {
                const videoDate = new Date(videoPublishDate);
                const gameDateTime = new Date(gameDate);
                
                // Video should be published on game day or within 3 days after
                const diffInMs = videoDate.getTime() - gameDateTime.getTime();
                const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
                
                // Allow videos published from game day up to 3 days after
                return diffInDays >= -1 && diffInDays <= 3;
            }
            
            // Helper function to check if video title matches the teams playing
            function doesVideoMatchTeams(title, awayShort, homeShort, awayFull, homeFull) {
                const titleLower = title.toLowerCase();
                
                // Check if title contains both teams (either short or full names)
                const hasAwayTeam = titleLower.includes(awayShort) || titleLower.includes(awayFull.toLowerCase());
                const hasHomeTeam = titleLower.includes(homeShort) || titleLower.includes(homeFull.toLowerCase());
                
                // Must have both teams mentioned
                return hasAwayTeam && hasHomeTeam;
            }
            
            // Try to find actual YouTube video
            try {
                // YouTube Data API search (you'll need to add YOUTUBE_API_KEY to .env)
                const youtubeApiKey = process.env.YOUTUBE_API_KEY;
                
                if (youtubeApiKey) {
                    // More specific search queries with team short names
                    const searchQueries = [
                        `${awayShortName} vs ${homeShortName} highlights`,
                        `${awayShortName} ${homeShortName} highlights`,
                        `${homeShortName} vs ${awayShortName} highlights`,
                        `${awayTeamName} vs ${homeTeamName} highlights`
                    ];
                    
                    for (const query of searchQueries) {
                        try {
                            // Search NHL's official channel with date filtering
                            let youtubeSearchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=UCqFii6I0kpYUaHV3t_dUOOg&q=${encodeURIComponent(query)}&type=video&order=date&maxResults=15&publishedAfter=${encodeURIComponent(publishedAfter)}&publishedBefore=${encodeURIComponent(publishedBefore)}&key=${youtubeApiKey}`;
                            let ytResponse = await axios.get(youtubeSearchUrl);
                            
                            // If no results from NHL channel, try broader search with date filter
                            if (!ytResponse.data.items || ytResponse.data.items.length === 0) {
                                youtubeSearchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query + ' NHL highlights')}&type=video&order=date&maxResults=15&publishedAfter=${encodeURIComponent(publishedAfter)}&publishedBefore=${encodeURIComponent(publishedBefore)}&key=${youtubeApiKey}`;
                                ytResponse = await axios.get(youtubeSearchUrl);
                            }
                            
                            if (ytResponse.data.items && ytResponse.data.items.length > 0) {
                                // Find a video that matches both teams AND has a valid publish date
                                const video = ytResponse.data.items.find(item => {
                                    const title = item.snippet.title.toLowerCase();
                                    const channelName = item.snippet.channelTitle.toLowerCase();
                                    const publishDate = item.snippet.publishedAt;
                                    
                                    // Must be a highlight/recap video
                                    const isHighlightVideo = title.includes('highlights') || title.includes('recap') || title.includes('condensed');
                                    
                                    // Must match both teams
                                    const matchesTeams = doesVideoMatchTeams(title, awayShortName, homeShortName, awayTeamName, homeTeamName);
                                    
                                    // Must be from a trusted sports channel
                                    const isTrustedChannel = channelName.includes('nhl') || channelName.includes('sportsnet') || 
                                                            channelName.includes('tsn') || channelName.includes('espn');
                                    
                                    // Must have valid publish date (within range of game date)
                                    const hasValidDate = isVideoDateValid(publishDate, gameDate);
                                    
                                    return isHighlightVideo && matchesTeams && isTrustedChannel && hasValidDate;
                                });
                                
                                if (video) {
                                    recapVideo = {
                                        url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
                                        title: video.snippet.title,
                                        thumbnail: video.snippet.thumbnails.medium?.url,
                                        channelTitle: video.snippet.channelTitle,
                                        publishedAt: video.snippet.publishedAt,
                                        isYouTube: true,
                                        isEmbeddable: true
                                    };
                                    break;
                                }
                            }
                        } catch (error) {
                            console.error(`YouTube search error for query "${query}":`, error.message);
                            continue;
                        }
                    }
                    
                    // If no video found with strict matching, provide a search link instead of wrong video
                    if (!recapVideo) {
                        const longDateString = gameDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                        recapVideo = {
                            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${awayShortName} vs ${homeShortName} highlights ${longDateString} NHL`)}`,
                            title: `${awayTeamName} vs ${homeTeamName} Highlights`,
                            searchQuery: `${awayShortName} vs ${homeShortName} highlights ${longDateString} NHL`,
                            isYouTube: true,
                            isSearch: true,
                            noVideoFound: true
                        };
                    }
                } else {
                    const longDateString = gameDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                    recapVideo = {
                        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${awayShortName} vs ${homeShortName} highlights ${longDateString} NHL`)}`,
                        title: `${awayTeamName} vs ${homeTeamName} Highlights`,
                        searchQuery: `${awayShortName} vs ${homeShortName} highlights ${longDateString} NHL`,
                        isYouTube: true,
                        isSearch: true
                    };
                }
                
            } catch (error) {
                const longDateString = gameDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                recapVideo = {
                    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${awayShortName} vs ${homeShortName} highlights ${longDateString} NHL`)}`,
                    title: `${awayTeamName} vs ${homeTeamName} Highlights`,
                    searchQuery: `${awayShortName} vs ${homeShortName} highlights ${longDateString} NHL`,
                    isYouTube: true,
                    isSearch: true
                };
            }
            
            if (!recapVideo) {
                try {
                    const multimediaResponse = await axios.get(`https://api-web.nhle.com/v1/gamecenter/${lastGame.id}/play-by-play`);
                    if (multimediaResponse.data && multimediaResponse.data.summary) {
                        // Additional video content could be extracted here if needed
                    }
                } catch (mmError) {
            
                }
            }
            
            // Method 4: Try NHL.tv style URLs (common patterns)
            if (!recapVideo) {
                // Try constructing common NHL video URLs
                const gameId = lastGame.id;
                const season = lastGame.season;
                
                // Common NHL video URL patterns to try
                const possibleUrls = [
                    `https://www.nhl.com/video/recap-${gameId}`,
                    `https://hlslive-wsczoominwestus.med.nhl.com/publish/${gameId}_recap.mp4`,
                    `https://nhl.bamcontent.com/images/videos/recap/${season}/${gameId}.mp4`
                ];
                
                // For now, we'll assume no direct video URL construction works
                // The NHL API structure may have changed
            }
            
            return {
                game: lastGame,
                gameDetails: gameDetailsResponse.data,
                recapVideo: recapVideo
            };
            
        } catch (detailsError) {
            console.error('Error fetching game details:', detailsError.message);
            return {
                game: lastGame,
                gameDetails: null,
                recapVideo: null
            };
        }
        
    } catch (error) {
        console.error('Error fetching game recap:', error);
        return null;
    }
}

async function getStandings(type = 'league') {
    try {
        let url = 'https://api-web.nhle.com/v1/standings/now';
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching standings:', error);
        return null;
    }
}

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
    
    let countdown = "";
    if (days > 0) countdown += `${days}d `;
    if (hours > 0 || days > 0) countdown += `${hours}h `;
    countdown += `${minutes}m`;
    
    return countdown.trim();
}

client.on('clientReady', () => {
    console.log(`✅ ${client.user.tag} is online!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const content = message.content.toLowerCase();
    if (!content.startsWith('!')) return;
    
    const args = content.slice(1).split(' ');
    const command = args[0];
    const teamInput = args[1];
    
    if (command === 'commands') {
        const commandsEmbed = {
            color: 0x0099ff,
            title: '🏒 NHL Bot Commands',
            description: 'Available commands for the NHL Discord Bot',
            fields: [
                {
                    name: '⏰ Countdown Commands',
                    value: '`!countdown [team]` - Shows countdown to next game\n`!schedule [team]` - Shows next 5 upcoming games\n`!countdownsite` - Link to the NHL Countdown website\nExample: `!countdown pen`, `!schedule seattle`',
                    inline: false
                },
                {
                    name: '📊 Previous Game',
                    value: '`!previousgame [team]` - Shows the most recent game result\nExample: `!previousgame pen`, `!previousgame seattle`',
                    inline: false
                },
                {
                    name: '🎬 Game Recap',
                    value: '`!recap [team]` - Shows video recap of last game\nExample: `!recap pen`, `!recap seattle`',
                    inline: false
                },
                {
                    name: '📈 Team Stats',
                    value: '`!stats [team]` - Shows current season statistics\nExample: `!stats pen`, `!stats seattle`',
                    inline: false
                },
                {
                    name: '👤 Player Stats',
                    value: '`!playerstats [name]` - Shows player statistics\nExample: `!playerstats crosby`, `!playerstats hughes` (shows all Hughes players)',
                    inline: false
                },
                {
                    name: '📊 Career Stats',
                    value: '`!careerstats [name]` - Shows player career totals\nExample: `!careerstats crosby`, `!careerstats ovechkin`',
                    inline: false
                },
                {
                    name: '📈 Team Recent Games',
                    value: '`!teampast5 [team]` - Last 5 games stats\n`!teampast10 [team]` - Last 10 games stats\n`!teampast20 [team]` - Last 20 games stats\nAdd `playoffs` for playoff stats\nExample: `!teampast5 pen`, `!teampast10 seattle playoffs`',
                    inline: false
                },
                {
                    name: '👤 Player Recent Games',
                    value: '`!playerpast5 [name]` - Last 5 games stats\n`!playerpast10 [name]` - Last 10 games stats\n`!playerpast20 [name]` - Last 20 games stats\nAdd `playoffs` for playoff stats\nExample: `!playerpast5 crosby`, `!playerpast10 ovechkin playoffs`',
                    inline: false
                },
                {
                    name: '🏆 Standings',
                    value: '`!divisionstandings [team]` - Division standings\n`!conferencestandings [team]` - Conference standings\n`!leaguestandings [team]` - Full league standings (optional team highlight)',
                    inline: false
                },
                {
                    name: '🤕 Injury Reports',
                    value: '`!injuries [team]` - List of injured players for a team\n`!injury [player]` - Detailed injury info for a specific player\nExample: `!injuries pens`, `!injury malkin`',
                    inline: false
                },
                {
                    name: '� News',
                    value: '`!news` - Latest NHL news and rumors\n`!news [team]` - Team-specific news\nExample: `!news`, `!news pens`',
                    inline: false
                },
                {
                    name: '�🔤 Supported Teams',
                    value: 'Use team names, cities, or abbreviations:\n`pen/pens/penguins/pittsburgh`, `seattle/kraken/sea`, `caps/capitals/washington`, etc.',
                    inline: false
                }
            ],
            footer: {
                text: 'All commands follow the format: !command team'
            }
        };
        
        message.reply({ embeds: [commandsEmbed] });
        return;
    }
    
    if (command === 'countdownsite') {
        const embed = {
            color: 0x0099ff,
            title: '🏒 NHL Countdown Website',
            description: 'Check out the NHL Countdown website for live countdowns to all upcoming games!',
            fields: [
                {
                    name: '🌐 Website',
                    value: '[NHL Countdown](https://tomcourt89.github.io/NHL-Countdown/)',
                    inline: false
                }
            ],
            footer: {
                text: 'NHL Countdown Bot'
            }
        };
        
        message.reply({ embeds: [embed] });
        await message.channel.send('https://tomcourt89.github.io/NHL-Countdown/');
        return;
    }
    
    if (command === 'countdown') {
        if (!teamInput) {
            message.reply('Please specify a team! Example: `!countdown pen` for Pittsburgh Penguins');
            return;
        }
        
        const teamAbbr = getTeamAbbr(teamInput);
        const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
        
        if (!teamName) {
            message.reply(`Sorry, I don't recognize the team "${teamInput}". Use \`!commands\` to see supported teams.`);
            return;
        }
        
        try {
            const game = await getNextGame(teamAbbr);
            
            if (!game) {
                message.reply(`No upcoming games found for the ${teamName}.`);
                return;
            }
            
            const gameDate = new Date(game.startTimeUTC);
            const countdown = formatCountdown(game.startTimeUTC);
            const opponent = game.homeTeam.abbrev === teamAbbr ? game.awayTeam : game.homeTeam;
            const isHome = game.homeTeam.abbrev === teamAbbr;
            const hostCity = isHome ? teamName.split(' ').pop() : (getTeamName(opponent.abbrev) || '').split(' ').pop();
            
            const embed = {
                color: 0x0099ff,
                title: `⏰ ${teamName} Countdown`,
                description: `Next game: ${isHome ? 'vs' : '@'} ${getTeamName(opponent.abbrev) || opponent.placeName.default}`,
                fields: [
                    {
                        name: '🕐 Time Until Game',
                        value: countdown,
                        inline: true
                    },
                    {
                        name: '📅 Game Date',
                        value: gameDate.toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }),
                        inline: true
                    },
                    {
                        name: '🕒 Game Time',
                        value: gameDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZoneName: 'short'
                        }),
                        inline: true
                    },
                    {
                        name: '🏙️ Host City',
                        value: hostCity,
                        inline: false
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'NHL Countdown Bot'
                }
            };
            
            message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error processing countdown request:', error);
            message.reply('Sorry, there was an error getting the countdown information. Please try again later.');
        }
        return;
    }
    
    if (command === 'schedule') {
        if (!teamInput) {
            message.reply('Please specify a team! Example: `!schedule pen` for Pittsburgh Penguins');
            return;
        }
        
        const teamAbbr = getTeamAbbr(teamInput);
        const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
        
        if (!teamName) {
            message.reply(`Sorry, I don't recognize the team "${teamInput}". Use \`!commands\` to see supported teams.`);
            return;
        }
        
        try {
            const response = await axios.get(`https://api-web.nhle.com/v1/club-schedule-season/${teamAbbr}/now`);
            const games = response.data.games;
            
            const now = new Date();
            const upcomingGames = games.filter(game => new Date(game.startTimeUTC) >= now).slice(0, 5);
            
            if (upcomingGames.length === 0) {
                message.reply(`No upcoming games found for the ${teamName}.`);
                return;
            }
            
            const scheduleLines = upcomingGames.map(game => {
                const gameDate = new Date(game.startTimeUTC);
                const dateStr = gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const timeStr = gameDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                const isHome = game.homeTeam.abbrev === teamAbbr;
                const opponent = isHome ? game.awayTeam.abbrev : game.homeTeam.abbrev;
                const location = isHome ? 'vs' : '@';
                return `${dateStr} ${location} ${opponent} @ ${timeStr}`;
            });
            
            const embed = {
                color: 0x0099ff,
                title: `📅 ${teamName} Schedule`,
                description: `Next ${upcomingGames.length} game${upcomingGames.length > 1 ? 's' : ''}:\n\n` + scheduleLines.join('\n'),
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'NHL Countdown Bot'
                }
            };
            
            message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error processing schedule request:', error);
            message.reply('Sorry, there was an error getting the schedule information. Please try again later.');
        }
        return;
    }
    
    if (command === 'previousgame') {
        if (!teamInput) {
            message.reply('Please specify a team! Example: `!previousgame pen`');
            return;
        }
        
        const teamAbbr = getTeamAbbr(teamInput);
        const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
        
        if (!teamName) {
            message.reply(`Sorry, I don't recognize the team "${teamInput}". Use \`!commands\` to see supported teams.`);
            return;
        }
        
        try {
            const game = await getPreviousGame(teamAbbr);
            
            if (!game) {
                message.reply(`No recent games found for the ${teamName}.`);
                return;
            }
            
            const gameDate = new Date(game.startTimeUTC);
            const homeTeam = getTeamName(game.homeTeam.abbrev);
            const awayTeam = getTeamName(game.awayTeam.abbrev);
            const homeScore = game.homeTeam.score;
            const awayScore = game.awayTeam.score;
            const isHome = game.homeTeam.abbrev === teamAbbr;
            const opponent = isHome ? awayTeam : homeTeam;
            const teamScore = isHome ? homeScore : awayScore;
            const opponentScore = isHome ? awayScore : homeScore;
            const result = teamScore > opponentScore ? 'WIN' : 'LOSS';
            const resultColor = result === 'WIN' ? 0x00ff00 : 0xff0000;
            
            const embed = {
                color: resultColor,
                title: `📊 ${teamName} Previous Game`,
                description: `${result}: ${isHome ? 'vs' : '@'} ${opponent}`,
                fields: [
                    {
                        name: '🏒 Final Score',
                        value: `${teamName}: ${teamScore}\n${opponent}: ${opponentScore}`,
                        inline: true
                    },
                    {
                        name: '📅 Game Date',
                        value: gameDate.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric'
                        }),
                        inline: true
                    },
                    {
                        name: '🏆 Result',
                        value: result,
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'NHL Bot'
                }
            };
            
            message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error processing previous game request:', error);
            message.reply('Sorry, there was an error getting the previous game information. Please try again later.');
        }
        return;
    }
    
    if (command === 'recap') {
        if (!teamInput) {
            message.reply('Please specify a team! Example: `!recap pen`');
            return;
        }
        
        const teamAbbr = getTeamAbbr(teamInput);
        const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
        
        if (!teamName) {
            message.reply(`Sorry, I don't recognize the team "${teamInput}". Use \`!commands\` to see supported teams.`);
            return;
        }
        
        try {
            const recapData = await getGameRecap(teamAbbr);
            
            if (!recapData) {
                message.reply(`No recent games found for the ${teamName}.`);
                return;
            }
            
            const { game, gameDetails, recapVideo } = recapData;
            const gameDate = new Date(game.startTimeUTC);
            const homeTeam = getTeamName(game.homeTeam.abbrev);
            const awayTeam = getTeamName(game.awayTeam.abbrev);
            const isHome = game.homeTeam.abbrev === teamAbbr;
            const opponent = isHome ? awayTeam : homeTeam;
            const homeScore = game.homeTeam.score;
            const awayScore = game.awayTeam.score;
            
            if (!recapVideo || !recapVideo.url) {
                const gameId = game.id;
                const nhlGameUrl = `https://www.nhl.com/gamecenter/${gameId}`;
                
                const embed = {
                    color: 0x9b4dff,
                    title: `🎬 ${teamName} vs ${opponent} - No Video Available`,
                    description: `Game from ${gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${homeScore}-${awayScore})`,
                    fields: [
                        {
                            name: '🌐 Watch on NHL.com',
                            value: `[View game highlights and recap on NHL.com](${nhlGameUrl})`,
                            inline: false
                        },
                        {
                            name: '📊 Alternative',
                            value: `Use \`!previousgame ${teamInput}\` for game details and stats`,
                            inline: false
                        }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: 'NHL Bot - Video not available via API'
                    }
                };
                
                message.reply({ embeds: [embed] });
                return;
            }
            
            const embed = {
                color: 0x9b4dff,
                title: `🎬 ${teamName} vs ${opponent} - Video Recap`,
                description: `Game played on ${gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                fields: [],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'NHL Bot - Video Recap'
                }
            };


            if (recapVideo && recapVideo.url) {
                if (recapVideo.isEmbeddable) {
                    embed.fields.push({
                        name: '🎥 Game Highlights',
                        value: `**${recapVideo.title}**\n\n` +
                               `📺 Channel: ${recapVideo.channelTitle || 'NHL'}`,
                        inline: false
                    });
                    
                    if (recapVideo.thumbnail) {
                        embed.thumbnail = {
                            url: recapVideo.thumbnail
                        };
                    }
                    
                    await message.reply({ embeds: [embed] });
                    await message.channel.send(recapVideo.url);
                    return;
                    
                } else if (recapVideo.isSearch) {
                    const searchNote = recapVideo.noVideoFound 
                        ? `*Could not find an exact video match for this game date. The search results below should help you find the correct highlights.*`
                        : `*The game highlights should be the first result. Copy that YouTube URL and paste it here for automatic embedding!*`;
                    
                    embed.fields.push({
                        name: '🔍 Search for Highlights',
                        value: `**${recapVideo.title}**\n\n` +
                               `[Click here to search YouTube](${recapVideo.url})\n\n` +
                               searchNote + `\n\n` +
                               `**Search term:** "${recapVideo.searchQuery}"`,
                        inline: false
                    });
                } else {
                    embed.fields.push({
                        name: '🎥 Video Recap',
                        value: `**[${recapVideo.title}](${recapVideo.url})**`,
                        inline: false
                    });
                    
                    if (recapVideo.url.includes('youtube.com') || recapVideo.url.includes('youtu.be')) {
                        embed.video = {
                            url: recapVideo.url
                        };
                    }
                }
            } else {
                embed.fields.push({
                    name: '📺 Video Recap',
                    value: 'No video recap available for this game yet.\n*Check back later as highlights are usually posted within a few hours of game completion.*',
                    inline: false
                });
            }
            

            let stars = null;
            if (gameDetails?.summary?.threeStars) {
                stars = gameDetails.summary.threeStars;
            } else if (gameDetails?.threeStars) {
                stars = gameDetails.threeStars;
            } else if (gameDetails?.boxscore?.threeStars) {
                stars = gameDetails.boxscore.threeStars;
            }
            
            if (stars && stars.length > 0) {
                const starsText = stars.map((star, index) => {                    
                    // Handle different possible star object structures
                    let playerName = 'Unknown Player';
                    
                    if (typeof star === 'string') {
                        playerName = star;
                    } else if (star.name?.default) {
                        // NHL API returns name as object with 'default' property
                        playerName = star.name.default;
                    } else if (star.name) {
                        playerName = star.name;
                    } else if (star.player?.name?.default) {
                        playerName = star.player.name.default;
                    } else if (star.player?.name) {
                        playerName = star.player.name;
                    } else if (star.firstName && star.lastName) {
                        playerName = `${star.firstName} ${star.lastName}`;
                    } else if (star.player?.firstName && star.player?.lastName) {
                        playerName = `${star.player.firstName} ${star.player.lastName}`;
                    }
                    
                    const teamAbbrev = star.teamAbbrev || star.team?.abbrev || star.teamAbbreviation || star.player?.team?.abbrev || '';
                    const starTeamName = getTeamName(teamAbbrev) || teamAbbrev || '';
                    
                    return `${index + 1}⭐ ${playerName}${starTeamName ? ` (${starTeamName})` : ''}`;
                }).join('\n');
                
                embed.fields.push({
                    name: '⭐ Three Stars',
                    value: starsText,
                    inline: false
                });
            }
            
            message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error processing recap request:', error);
            message.reply('Sorry, there was an error getting the game recap. Please try again later.');
        }
        return;
    }
    
    if (command === 'stats') {
        if (!teamInput) {
            message.reply('Please specify a team! Example: `!stats pen`');
            return;
        }
        
        const teamAbbr = getTeamAbbr(teamInput);
        const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
        
        if (!teamName) {
            message.reply(`Sorry, I don't recognize the team "${teamInput}". Use \`!commands\` to see supported teams.`);
            return;
        }
        
        try {
            const stats = await getTeamStats(teamAbbr);
            
            if (!stats) {
                message.reply(`No stats found for the ${teamName}.`);
                return;
            }
            
            const embed = {
                color: 0x0099ff,
                title: `📈 ${teamName} Stats`,
                fields: [
                    {
                        name: '🏒 Record',
                        value: `${stats.wins}-${stats.losses}-${stats.otLosses}`,
                        inline: true
                    },
                    {
                        name: '🎯 Games Played',
                        value: `${stats.gamesPlayed}`,
                        inline: true
                    },
                    {
                        name: '📊 Points',
                        value: `${stats.points}`,
                        inline: true
                    },
                    {
                        name: '📈 Points %',
                        value: `${(stats.pointPctg * 100).toFixed(1)}%`,
                        inline: true
                    },
                    {
                        name: '⚽ Goals For',
                        value: `${stats.goalFor}`,
                        inline: true
                    },
                    {
                        name: '🥅 Goals Against',
                        value: `${stats.goalAgainst}`,
                        inline: true
                    },
                    {
                        name: '📊 Goal Differential',
                        value: `${stats.goalDifferential > 0 ? '+' : ''}${stats.goalDifferential}`,
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'NHL Bot - Current Season Stats'
                }
            };
            
            message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error processing stats request:', error);
            message.reply('Sorry, there was an error getting the team statistics. Please try again later.');
        }
        return;
    }
    
    if (command === 'playerstats') {
        if (!teamInput) { // teamInput is actually player name in this case
            message.reply('Please specify a player name! Example: `!playerstats crosby` or `!playerstats hughes`');
            return;
        }
        
        try {
            const playerStats = await getPlayerStats(teamInput);
            
            if (!playerStats || playerStats.length === 0) {
                message.reply(`No players found matching "${teamInput}".`);
                return;
            }
            
            if (playerStats.length === 1) {
                const player = playerStats[0];
                const stats = player.stats;
                
                const embed = {
                    color: 0x0099ff,
                    title: `👤 ${player.name} Stats`,
                    description: `${player.position} • ${getTeamName(player.team) || player.team}`,
                    fields: [
                        {
                            name: '🏒 Games Played',
                            value: `${stats.gamesPlayed || 0}`,
                            inline: true
                        },
                        {
                            name: '⚽ Goals',
                            value: `${stats.goals || 0}`,
                            inline: true
                        },
                        {
                            name: '🎯 Assists',
                            value: `${stats.assists || 0}`,
                            inline: true
                        },
                        {
                            name: '📊 Points',
                            value: `${(stats.goals || 0) + (stats.assists || 0)}`,
                            inline: true
                        },
                        {
                            name: '+/-',
                            value: `${stats.plusMinus || 0}`,
                            inline: true
                        },
                        {
                            name: '🏒 PIM',
                            value: `${stats.penaltyMinutes || 0}`,
                            inline: true
                        }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: `NHL Bot - ${Math.floor(player.season / 10000)}-${player.season % 10000} Season Stats`
                    }
                };
                
                // Add goalie-specific stats if position is goalie
                if (player.position === 'G' && stats.wins !== undefined) {
                    embed.fields = [
                        {
                            name: '🏒 Games Played',
                            value: `${stats.gamesPlayed || 0}`,
                            inline: true
                        },
                        {
                            name: '🏆 Wins',
                            value: `${stats.wins || 0}`,
                            inline: true
                        },
                        {
                            name: '❌ Losses',
                            value: `${stats.losses || 0}`,
                            inline: true
                        },
                        {
                            name: '🥅 Save %',
                            value: `${stats.savePct ? (stats.savePct * 100).toFixed(1) + '%' : 'N/A'}`,
                            inline: true
                        },
                        {
                            name: '🎯 GAA',
                            value: `${stats.goalsAgainstAvg ? stats.goalsAgainstAvg.toFixed(2) : 'N/A'}`,
                            inline: true
                        },
                        {
                            name: '🚫 Shutouts',
                            value: `${stats.shutouts || 0}`,
                            inline: true
                        }
                    ];
                }
                
                message.reply({ embeds: [embed] });
            } else {
                const embeds = playerStats.map(player => {
                    const stats = player.stats;
                    const points = (stats.goals || 0) + (stats.assists || 0);
                    
                    if (player.position === 'G') {
                        return {
                            color: 0x00ff88,
                            title: `👤 ${player.name}`,
                            description: `${player.position} • ${getTeamName(player.team) || player.team}`,
                            fields: [
                                {
                                    name: '🏒 GP',
                                    value: `${stats.gamesPlayed || 0}`,
                                    inline: true
                                },
                                {
                                    name: '🏆 W-L',
                                    value: `${stats.wins || 0}-${stats.losses || 0}`,
                                    inline: true
                                },
                                {
                                    name: '🥅 Save %',
                                    value: `${stats.savePct ? (stats.savePct * 100).toFixed(1) + '%' : 'N/A'}`,
                                    inline: true
                                }
                            ]
                        };
                    } else {
                        return {
                            color: 0x0099ff,
                            title: `👤 ${player.name}`,
                            description: `${player.position} • ${getTeamName(player.team) || player.team}`,
                            fields: [
                                {
                                    name: '🏒 GP',
                                    value: `${stats.gamesPlayed || 0}`,
                                    inline: true
                                },
                                {
                                    name: '⚽ G-A',
                                    value: `${stats.goals || 0}-${stats.assists || 0}`,
                                    inline: true
                                },
                                {
                                    name: '📊 PTS',
                                    value: `${points}`,
                                    inline: true
                                }
                            ]
                        };
                    }
                });
                
                const headerEmbed = {
                    color: 0xffd700,
                    title: `🔍 Found ${playerStats.length} player(s) matching "${teamInput}"`,
                    description: 'Here are their current season stats:',
                    footer: { text: 'Use full name for detailed stats of a specific player' }
                };
                
                message.reply({ embeds: [headerEmbed, ...embeds] });
            }
            
        } catch (error) {
            console.error('Error processing player stats request:', error);
            message.reply('Sorry, there was an error getting the player statistics. Please try again later.');
        }
        return;
    }
    
    if (command === 'careerstats') {
        if (!teamInput) { // teamInput is actually player name in this case
            message.reply('Please specify a player name! Example: `!careerstats crosby` or `!careerstats ovechkin`');
            return;
        }
        
        try {
            const playerCareerStats = await getPlayerCareerStats(teamInput);
            
            if (!playerCareerStats || playerCareerStats.length === 0) {
                message.reply(`No players found matching "${teamInput}".`);
                return;
            }
            
            if (playerCareerStats.length === 1) {
                const player = playerCareerStats[0];
                const stats = player.stats;
                
                // Calculate age if birth date is available
                let ageString = '';
                if (player.birthDate) {
                    const birthDate = new Date(player.birthDate);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                    ageString = ` (${age} years old)`;
                }
                
                const birthPlace = [player.birthCity, player.birthCountry].filter(Boolean).join(', ') || 'N/A';
                
                const embed = {
                    color: 0xff6b35, // Orange color for career stats
                    title: `🏆 ${player.name} Career Stats`,
                    description: `${player.position} • ${getTeamName(player.team) || player.team}${ageString}`,
                    fields: [
                        {
                            name: '🏒 Games Played',
                            value: `${stats.gamesPlayed || 0}`,
                            inline: true
                        },
                        {
                            name: '⚽ Goals',
                            value: `${stats.goals || 0}`,
                            inline: true
                        },
                        {
                            name: '🎯 Assists',
                            value: `${stats.assists || 0}`,
                            inline: true
                        },
                        {
                            name: '📊 Points',
                            value: `${(stats.goals || 0) + (stats.assists || 0)}`,
                            inline: true
                        },
                        {
                            name: '+/-',
                            value: `${stats.plusMinus || 0}`,
                            inline: true
                        },
                        {
                            name: '🏒 PIM',
                            value: `${stats.penaltyMinutes || 0}`,
                            inline: true
                        },
                        {
                            name: '📍 Born',
                            value: birthPlace,
                            inline: false
                        }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: 'NHL Bot - Career Totals'
                    }
                };
                
                // Add goalie-specific career stats if position is goalie
                if (player.position === 'G' && stats.wins !== undefined) {
                    embed.fields = [
                        {
                            name: '🏒 Games Played',
                            value: `${stats.gamesPlayed || 0}`,
                            inline: true
                        },
                        {
                            name: '🏆 Wins',
                            value: `${stats.wins || 0}`,
                            inline: true
                        },
                        {
                            name: '❌ Losses',
                            value: `${stats.losses || 0}`,
                            inline: true
                        },
                        {
                            name: '🥅 Save %',
                            value: `${stats.savePct ? (stats.savePct * 100).toFixed(1) + '%' : 'N/A'}`,
                            inline: true
                        },
                        {
                            name: '🎯 GAA',
                            value: `${stats.goalsAgainstAvg ? stats.goalsAgainstAvg.toFixed(2) : 'N/A'}`,
                            inline: true
                        },
                        {
                            name: '🚫 Shutouts',
                            value: `${stats.shutouts || 0}`,
                            inline: true
                        },
                        {
                            name: '📍 Born',
                            value: birthPlace,
                            inline: false
                        }
                    ];
                }
                
                message.reply({ embeds: [embed] });
            } else {
                const embeds = playerCareerStats.map(player => {
                    const stats = player.stats;
                    const points = (stats.goals || 0) + (stats.assists || 0);
                    
                    if (player.position === 'G') {
                        return {
                            color: 0xff8c42,
                            title: `🏆 ${player.name}`,
                            description: `${player.position} • ${getTeamName(player.team) || player.team}`,
                            fields: [
                                {
                                    name: '🏒 GP',
                                    value: `${stats.gamesPlayed || 0}`,
                                    inline: true
                                },
                                {
                                    name: '🏆 W-L',
                                    value: `${stats.wins || 0}-${stats.losses || 0}`,
                                    inline: true
                                },
                                {
                                    name: '🚫 SO',
                                    value: `${stats.shutouts || 0}`,
                                    inline: true
                                }
                            ]
                        };
                    } else {
                        return {
                            color: 0xff6b35,
                            title: `🏆 ${player.name}`,
                            description: `${player.position} • ${getTeamName(player.team) || player.team}`,
                            fields: [
                                {
                                    name: '🏒 GP',
                                    value: `${stats.gamesPlayed || 0}`,
                                    inline: true
                                },
                                {
                                    name: '⚽ G-A',
                                    value: `${stats.goals || 0}-${stats.assists || 0}`,
                                    inline: true
                                },
                                {
                                    name: '📊 PTS',
                                    value: `${points}`,
                                    inline: true
                                }
                            ]
                        };
                    }
                });
                
                const headerEmbed = {
                    color: 0xffd700,
                    title: `🔍 Found ${playerCareerStats.length} player(s) matching "${teamInput}"`,
                    description: 'Here are their career totals:',
                    footer: { text: 'Use full name for detailed career stats of a specific player' }
                };
                
                message.reply({ embeds: [headerEmbed, ...embeds] });
            }
            
        } catch (error) {
            console.error('Error processing career stats request:', error);
            message.reply('Sorry, there was an error getting the career statistics. Please try again later.');
        }
        return;
    }
    
    if (command.includes('standings')) {
        try {
            const standings = await getStandings();
            
            if (!standings) {
                message.reply('Sorry, there was an error getting the standings information.');
                return;
            }
            
            if (command === 'divisionstandings') {
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
                return;
            }
            
            if (command === 'conferencestandings') {
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
                return;
            }
            
            if (command === 'leaguestandings') {
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
                return;
            }
            
        } catch (error) {
            console.error('Error processing standings request:', error);
            message.reply('Sorry, there was an error getting the standings information.');
        }
    }
    
    // Injuries command - list injured players for a team
    if (command === 'injuries') {
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
        
        try {
            const injuriesData = await getInjuries();
            
            if (!injuriesData) {
                message.reply('Sorry, there was an error fetching injury data. Please try again later.');
                return;
            }
            
            const injuries = getTeamInjuries(injuriesData, teamName);
            
            if (injuries.length === 0) {
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
            
            const injuryList = injuries.map(injury => {
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
                        value: `${injuries.length} player${injuries.length > 1 ? 's' : ''}`,
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'Injury data from ESPN • Use !injury [player] for details' }
            };
            
            message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error processing injuries command:', error);
            message.reply('Sorry, there was an error getting the injury information.');
        }
        return;
    }
    
    // Injury command - detailed info for a specific player
    if (command === 'injury') {
        if (!teamInput) {
            message.reply('Please specify a player name! Example: `!injury malkin`');
            return;
        }
        
        // Combine all args for player name (in case of multi-word names)
        const playerQuery = args.slice(1).join(' ');
        
        try {
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
            
            const embeds = matches.slice(0, 5).map(injury => {
                const playerName = injury.athlete?.displayName || 'Unknown Player';
                const status = injury.status || 'Unknown';
                const injuryType = injury.details?.type || 'Undisclosed';
                const returnDate = injury.details?.returnDate;
                const lastUpdated = injury.date ? new Date(injury.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }) : 'Unknown';
                const longComment = injury.longComment || 'No additional details available.';
                
                const fields = [
                    {
                        name: '🏒 Team',
                        value: injury.teamName || 'Unknown',
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
            
        } catch (error) {
            console.error('Error processing injury command:', error);
            message.reply('Sorry, there was an error getting the injury information.');
        }
        return;
    }
    
    // News command - show NHL news from Pro Hockey Rumors RSS
    if (command === 'news') {
        try {
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
            
        } catch (error) {
            console.error('Error processing news command:', error);
            message.reply('Sorry, there was an error getting news information.');
        }
        return;
    }
    
    // Team Past Games Commands (!teampast5, !teampast10, !teampast20)
    if (command === 'teampast5' || command === 'teampast10' || command === 'teampast20') {
        const numGames = parseInt(command.replace('teampast', ''));
        
        if (!teamInput) {
            message.reply(`Please specify a team! Example: \`!${command} pen\` or \`!${command} pen playoffs\``);
            return;
        }
        
        // Check for playoffs flag
        const allArgs = args.slice(1);
        const isPlayoffs = allArgs[allArgs.length - 1]?.toLowerCase() === 'playoffs';
        const teamArg = isPlayoffs ? allArgs.slice(0, -1).join(' ') : allArgs.join(' ');
        
        const teamAbbr = getTeamAbbr(teamArg || teamInput);
        const teamName = teamAbbr ? getTeamName(teamAbbr) : null;
        
        if (!teamName) {
            message.reply(`Sorry, I don't recognize the team "${teamArg || teamInput}". Use \`!commands\` to see supported teams.`);
            return;
        }
        
        try {
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
                    const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
                    const oppScore = isHome ? game.awayTeam.score : game.homeTeam.score;
                    const location = isHome ? 'vs' : '@';
                    
                    let result = teamScore > oppScore ? 'W' : 'L';
                    if (teamScore < oppScore && (game.gameOutcome?.lastPeriodType === 'OT' || game.gameOutcome?.lastPeriodType === 'SO')) {
                        result = 'OTL';
                    }
                    
                    const otIndicator = (game.gameOutcome?.lastPeriodType === 'OT' || game.gameOutcome?.lastPeriodType === 'SO') ? ` (${game.gameOutcome.lastPeriodType})` : '';
                    
                    gameLines.push(`${dateStr} ${location} ${opponent}: ${result} ${teamScore}-${oppScore}${otIndicator}`);
                });
            });
            
            const gameTypeTitle = isPlayoffs ? 'Playoff' : 'Regular Season';
            const actualGames = games.length;
            const insufficientNote = actualGames < numGames ? `\n*(Only ${actualGames} ${isPlayoffs ? 'playoff' : ''} games found)*` : '';
            
            // Build description with character limit safety (Discord max 4096)
            let gameListText = gameLines.join('\n');
            let descriptionText = '```\n' + gameListText + '\n```' + insufficientNote;
            
            // Truncate if too long
            if (descriptionText.length > 4000) {
                const maxGameLines = Math.floor(3900 / 45);
                gameListText = gameLines.slice(0, maxGameLines).join('\n') + '\n... (truncated)';
                descriptionText = '```\n' + gameListText + '\n```' + insufficientNote;
            }
            
            const embed = {
                color: isPlayoffs ? 0xffd700 : 0x0099ff,
                title: `📊 ${teamName} - Last ${actualGames} ${gameTypeTitle} Games`,
                description: descriptionText,
                fields: [
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
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: `NHL Bot - ${gameTypeTitle} Stats • Add "playoffs" for playoff stats`
                }
            };
            
            message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error processing team past games request:', error);
            message.reply('Sorry, there was an error getting the team game history. Please try again later.');
        }
        return;
    }
    
    // Player Past Games Commands (!playerpast5, !playerpast10, !playerpast20)
    if (command === 'playerpast5' || command === 'playerpast10' || command === 'playerpast20') {
        const numGames = parseInt(command.replace('playerpast', ''));
        
        if (!teamInput) { // teamInput is actually player name here
            message.reply(`Please specify a player name! Example: \`!${command} crosby\` or \`!${command} crosby playoffs\``);
            return;
        }
        
        // Check for playoffs flag and build player query
        const allArgs = args.slice(1);
        const isPlayoffs = allArgs[allArgs.length - 1]?.toLowerCase() === 'playoffs';
        const playerQuery = isPlayoffs ? allArgs.slice(0, -1).join(' ') : allArgs.join(' ');
        
        if (!playerQuery) {
            message.reply(`Please specify a player name! Example: \`!${command} crosby\``);
            return;
        }
        
        try {
            // Search for the player
            const player = await searchPlayer(playerQuery);
            
            if (!player) {
                message.reply(`No player found matching "${playerQuery}".`);
                return;
            }
            
            const games = await getPlayerPastGames(player.playerId, numGames, isPlayoffs);
            
            if (!games || games.length === 0) {
                const gameTypeText = isPlayoffs ? 'playoff' : 'regular season';
                message.reply(`No recent ${gameTypeText} games found for ${player.name}.`);
                return;
            }
            
            const isGoalie = player.position === 'G';
            const actualGames = games.length;
            
            // Calculate aggregate stats based on position
            let totals = {};
            
            if (isGoalie) {
                totals = { 
                    gamesStarted: 0, 
                    wins: 0, 
                    losses: 0, 
                    otLosses: 0,
                    shotsAgainst: 0, 
                    goalsAgainst: 0, 
                    saves: 0,
                    shutouts: 0,
                    toi: 0
                };
                
                games.forEach(game => {
                    totals.gamesStarted += game.gamesStarted || 0;
                    totals.wins += game.wins || 0;
                    totals.losses += game.losses || 0;
                    totals.otLosses += game.otLosses || 0;
                    totals.shotsAgainst += game.shotsAgainst || 0;
                    totals.goalsAgainst += game.goalsAgainst || 0;
                    totals.saves += game.savePctg ? Math.round((game.shotsAgainst || 0) * game.savePctg) : (game.shotsAgainst || 0) - (game.goalsAgainst || 0);
                    totals.shutouts += game.shutouts || 0;
                    // Parse TOI if available (format: "MM:SS")
                    if (game.toi) {
                        const [mins, secs] = game.toi.split(':').map(Number);
                        totals.toi += mins * 60 + secs;
                    }
                });
                
                totals.savePct = totals.shotsAgainst > 0 ? (totals.saves / totals.shotsAgainst * 100).toFixed(1) : '0.0';
                totals.gaa = totals.toi > 0 ? (totals.goalsAgainst / (totals.toi / 3600) ).toFixed(2) : '0.00';
            } else {
                totals = { 
                    goals: 0, 
                    assists: 0, 
                    points: 0, 
                    plusMinus: 0, 
                    pim: 0, 
                    shots: 0,
                    toi: 0
                };
                
                games.forEach(game => {
                    totals.goals += game.goals || 0;
                    totals.assists += game.assists || 0;
                    totals.points += game.points || 0;
                    totals.plusMinus += game.plusMinus || 0;
                    totals.pim += game.pim || 0;
                    totals.shots += game.shots || 0;
                    if (game.toi) {
                        const [mins, secs] = game.toi.split(':').map(Number);
                        totals.toi += mins * 60 + secs;
                    }
                });
            }
            
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
                if (seasons.length > 1) {
                    const dividerText = isPlayoffs ? `${season} Playoffs` : `${season} Regular Season`;
                    gameLines.push(`── ${dividerText} ──`);
                }
                
                gamesBySeason[season].forEach(game => {
                    const gameDate = new Date(game.gameDate + 'T00:00:00'); // Ensure proper date parsing
                    const dateStr = gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const opponent = game.opponentAbbrev || 'N/A';
                    const homeAway = game.homeRoadFlag === 'H' ? 'vs' : '@';
                    
                    if (isGoalie) {
                        // API returns 1/0 for wins/losses/otLosses, or decision field
                        let result = '-';
                        if (game.decision === 'W' || game.wins === 1 || game.wins === true) {
                            result = 'W';
                        } else if (game.decision === 'L' || game.losses === 1 || game.losses === true) {
                            result = 'L';
                        } else if (game.decision === 'O' || game.otLosses === 1 || game.otLosses === true) {
                            result = 'OTL';
                        }
                        const svPct = game.savePctg ? (game.savePctg * 100).toFixed(1) : '0.0';
                        const ga = game.goalsAgainst || 0;
                        const sa = game.shotsAgainst || 0;
                        gameLines.push(`${dateStr} ${homeAway} ${opponent}: ${result} | ${sa - ga}/${sa} SV (${svPct}%) | ${ga} GA`);
                    } else {
                        const g = game.goals || 0;
                        const a = game.assists || 0;
                        const pts = game.points || 0;
                        const pm = game.plusMinus || 0;
                        const pmStr = pm >= 0 ? `+${pm}` : `${pm}`;
                        const pim = game.pim || 0;
                        gameLines.push(`${dateStr} ${homeAway} ${opponent}: ${g}G ${a}A ${pts}PTS | ${pmStr} | ${pim}PIM`);
                    }
                });
            });
            
            const gameTypeTitle = isPlayoffs ? 'Playoff' : 'Regular Season';
            const insufficientNote = actualGames < numGames ? `\n*(Only ${actualGames} ${isPlayoffs ? 'playoff' : ''} games found)*` : '';
            
            // Build embed fields based on position
            let fields;
            
            if (isGoalie) {
                fields = [
                    {
                        name: '🏒 Record',
                        value: `${totals.wins}-${totals.losses}-${totals.otLosses}`,
                        inline: true
                    },
                    {
                        name: '🥅 Save %',
                        value: `${totals.savePct}%`,
                        inline: true
                    },
                    {
                        name: '🎯 GAA',
                        value: `${totals.gaa}`,
                        inline: true
                    },
                    {
                        name: '🛡️ Saves',
                        value: `${totals.saves}`,
                        inline: true
                    },
                    {
                        name: '⚽ GA',
                        value: `${totals.goalsAgainst}`,
                        inline: true
                    },
                    {
                        name: '🚫 Shutouts',
                        value: `${totals.shutouts}`,
                        inline: true
                    }
                ];
            } else {
                const avgToi = totals.toi > 0 ? Math.floor(totals.toi / actualGames / 60) + ':' + String(Math.floor((totals.toi / actualGames) % 60)).padStart(2, '0') : 'N/A';
                const shootPct = totals.shots > 0 ? (totals.goals / totals.shots * 100).toFixed(1) : '0.0';
                
                fields = [
                    {
                        name: '⚽ Goals',
                        value: `${totals.goals}`,
                        inline: true
                    },
                    {
                        name: '🎯 Assists',
                        value: `${totals.assists}`,
                        inline: true
                    },
                    {
                        name: '📊 Points',
                        value: `${totals.points}`,
                        inline: true
                    },
                    {
                        name: '+/-',
                        value: `${totals.plusMinus >= 0 ? '+' : ''}${totals.plusMinus}`,
                        inline: true
                    },
                    {
                        name: '🏒 PIM',
                        value: `${totals.pim}`,
                        inline: true
                    },
                    {
                        name: '🎯 Shots',
                        value: `${totals.shots} (${shootPct}%)`,
                        inline: true
                    }
                ];
            }
            
            // Build description with character limit safety (Discord max 4096)
            let gameListText = gameLines.join('\n');
            let descriptionText = `${player.position} • ${player.teamName || player.team}\n\`\`\`\n${gameListText}\n\`\`\`${insufficientNote}`;
            
            // Truncate if too long (leave room for formatting)
            if (descriptionText.length > 4000) {
                const maxGameLines = Math.floor((3900 - player.position.length - (player.teamName || player.team).length - insufficientNote.length) / 50);
                gameListText = gameLines.slice(0, maxGameLines).join('\n') + '\n... (truncated)';
                descriptionText = `${player.position} • ${player.teamName || player.team}\n\`\`\`\n${gameListText}\n\`\`\`${insufficientNote}`;
            }
            
            const embed = {
                color: isPlayoffs ? 0xffd700 : 0x0099ff,
                title: `📊 ${player.name} - Last ${actualGames} ${gameTypeTitle} Games`,
                description: descriptionText,
                fields: fields,
                timestamp: new Date().toISOString(),
                footer: {
                    text: `NHL Bot - ${gameTypeTitle} Stats • Add "playoffs" for playoff stats`
                }
            };
            
            message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error processing player past games request:', error);
            message.reply('Sorry, there was an error getting the player game history. Please try again later.');
        }
        return;
    }
});

client.login(process.env.DISCORD_TOKEN);