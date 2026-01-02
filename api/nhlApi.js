const axios = require('axios');
const { getTeamName } = require('../utils/teamUtils');
const { getCurrentNHLSeason, getPreviousSeason, formatSeasonDisplay } = require('../utils/seasonUtils');

async function getNextGame(teamAbbreviation) {
    const response = await axios.get(`https://api-web.nhle.com/v1/club-schedule-season/${teamAbbreviation}/now`);
    const games = response.data.games;
    
    const now = new Date();
    const upcomingGames = games.filter(game => new Date(game.startTimeUTC) >= now);
    
    if (upcomingGames.length === 0) {
        return null;
    }
    
    return upcomingGames[0];
}

async function getPreviousGame(teamAbbreviation) {
    const response = await axios.get(`https://api-web.nhle.com/v1/club-schedule-season/${teamAbbreviation}/now`);
    const games = response.data.games;
    
    const now = new Date();
    const pastGames = games.filter(game => new Date(game.startTimeUTC) < now && game.gameState === 'OFF');
    
    if (pastGames.length === 0) {
        return null;
    }
    
    return pastGames[pastGames.length - 1];
}

async function getTeamStats(teamAbbreviation) {
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
}

async function getStandings() {
    const response = await axios.get('https://api-web.nhle.com/v1/standings/now');
    return response.data;
}

async function getTeamPastGames(teamAbbr, numGames, isPlayoffs = false) {
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
            const response = await axios.get(`https://api-web.nhle.com/v1/club-schedule-season/${teamAbbr}/${currentSeason}`);
            
            if (response.data && response.data.games) {
                const seasonGames = response.data.games.filter(game => {
                    const isCorrectType = game.gameType === gameType;
                    const isCompleted = game.gameState === 'OFF' || game.gameState === 'FINAL';
                    return isCorrectType && isCompleted;
                });
                
                seasonGames.sort((a, b) => new Date(b.startTimeUTC) - new Date(a.startTimeUTC));
                seasonGames.forEach(game => {
                    game.seasonDisplay = formatSeasonDisplay(currentSeason);
                    game.season = currentSeason;
                });
                
                games.push(...seasonGames);
            }
        } catch (error) {
            // Season data not available, try previous season
        }
        
        currentSeason = getPreviousSeason(currentSeason);
        attempts++;
    }
    
    return games.slice(0, numGames);
}

async function getGameRecap(teamAbbreviation) {
    const response = await axios.get(`https://api-web.nhle.com/v1/club-schedule-season/${teamAbbreviation}/now`);
    const games = response.data.games;
    
    const now = new Date();
    const pastGames = games.filter(game => new Date(game.startTimeUTC) < now && game.gameState === 'OFF');
    
    if (pastGames.length === 0) {
        return null;
    }
    
    const lastGame = pastGames[pastGames.length - 1];
    
    try {
        const gameDetailsResponse = await axios.get(`https://api-web.nhle.com/v1/gamecenter/${lastGame.id}/landing`);
        
        let recapVideo = null;
        
        const awayTeamName = getTeamName(lastGame.awayTeam.abbrev) || lastGame.awayTeam.abbrev;
        const homeTeamName = getTeamName(lastGame.homeTeam.abbrev) || lastGame.homeTeam.abbrev;
        const gameDate = new Date(lastGame.startTimeUTC);
        
        const awayShortName = awayTeamName.split(' ').pop().toLowerCase();
        const homeShortName = homeTeamName.split(' ').pop().toLowerCase();
        
        const gameDateStart = new Date(gameDate);
        gameDateStart.setUTCHours(0, 0, 0, 0);
        const publishedAfter = gameDateStart.toISOString();
        
        const gameDateEnd = new Date(gameDate);
        gameDateEnd.setDate(gameDateEnd.getDate() + 3);
        gameDateEnd.setUTCHours(23, 59, 59, 999);
        const publishedBefore = gameDateEnd.toISOString();
        
        function isVideoDateValid(videoPublishDate, gameDate) {
            const videoDate = new Date(videoPublishDate);
            const gameDateTime = new Date(gameDate);
            const diffInMs = videoDate.getTime() - gameDateTime.getTime();
            const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
            return diffInDays >= -1 && diffInDays <= 3;
        }
        
        function doesVideoMatchTeams(title, awayShort, homeShort, awayFull, homeFull) {
            const titleLower = title.toLowerCase();
            const hasAwayTeam = titleLower.includes(awayShort) || titleLower.includes(awayFull.toLowerCase());
            const hasHomeTeam = titleLower.includes(homeShort) || titleLower.includes(homeFull.toLowerCase());
            return hasAwayTeam && hasHomeTeam;
        }
        
        try {
            const youtubeApiKey = process.env.YOUTUBE_API_KEY;
            
            if (youtubeApiKey) {
                const searchQueries = [
                    `${awayShortName} vs ${homeShortName} highlights`,
                    `${awayShortName} ${homeShortName} highlights`,
                    `${homeShortName} vs ${awayShortName} highlights`,
                    `${awayTeamName} vs ${homeTeamName} highlights`
                ];
                
                for (const query of searchQueries) {
                    try {
                        let youtubeSearchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=UCqFii6I0kpYUaHV3t_dUOOg&q=${encodeURIComponent(query)}&type=video&order=date&maxResults=15&publishedAfter=${encodeURIComponent(publishedAfter)}&publishedBefore=${encodeURIComponent(publishedBefore)}&key=${youtubeApiKey}`;
                        let ytResponse = await axios.get(youtubeSearchUrl);
                        
                        if (!ytResponse.data.items || ytResponse.data.items.length === 0) {
                            youtubeSearchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query + ' NHL highlights')}&type=video&order=date&maxResults=15&publishedAfter=${encodeURIComponent(publishedAfter)}&publishedBefore=${encodeURIComponent(publishedBefore)}&key=${youtubeApiKey}`;
                            ytResponse = await axios.get(youtubeSearchUrl);
                        }
                        
                        if (ytResponse.data.items && ytResponse.data.items.length > 0) {
                            const video = ytResponse.data.items.find(item => {
                                const title = item.snippet.title.toLowerCase();
                                const channelName = item.snippet.channelTitle.toLowerCase();
                                const publishDate = item.snippet.publishedAt;
                                
                                const isHighlightVideo = title.includes('highlights') || title.includes('recap') || title.includes('condensed');
                                const matchesTeams = doesVideoMatchTeams(title, awayShortName, homeShortName, awayTeamName, homeTeamName);
                                const isTrustedChannel = channelName.includes('nhl') || channelName.includes('sportsnet') || 
                                                        channelName.includes('tsn') || channelName.includes('espn');
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
}

module.exports = {
    getNextGame,
    getPreviousGame,
    getTeamStats,
    getStandings,
    getTeamPastGames,
    getGameRecap
};
