const { Client, GatewayIntentBits, Collection } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Team mappings for easier command usage
const teamMappings = {
    'pen': 'PIT',
    'pens': 'PIT',
    'penguins': 'PIT',
    'pittsburgh': 'PIT',
    'caps': 'WSH',
    'capitals': 'WSH',
    'washington': 'WSH',
    'rangers': 'NYR',
    'devils': 'NJD',
    'flyers': 'PHI',
    'islanders': 'NYI',
    'bruins': 'BOS',
    'sabres': 'BUF',
    'leafs': 'TOR',
    'senators': 'OTT',
    'canadiens': 'MTL',
    'lightning': 'TBL',
    'panthers': 'FLA',
    'hurricanes': 'CAR',
    'jackets': 'CBJ',
    'wings': 'DET',
    'predators': 'NSH',
    'blues': 'STL',
    'wild': 'MIN',
    'blackhawks': 'CHI',
    'avalanche': 'COL',
    'stars': 'DAL',
    'kings': 'LAK',
    'ducks': 'ANA',
    'sharks': 'SJS',
    'knights': 'VGK',
    'flames': 'CGY',
    'oilers': 'EDM',
    'canucks': 'VAN',
    'kraken': 'SEA'
};

// Full team names mapping
const teamNames = {
    'PIT': 'Pittsburgh Penguins',
    'WSH': 'Washington Capitals',
    'NYR': 'New York Rangers',
    'NJD': 'New Jersey Devils',
    'PHI': 'Philadelphia Flyers',
    'NYI': 'New York Islanders',
    'BOS': 'Boston Bruins',
    'BUF': 'Buffalo Sabres',
    'TOR': 'Toronto Maple Leafs',
    'OTT': 'Ottawa Senators',
    'MTL': 'Montreal Canadiens',
    'TBL': 'Tampa Bay Lightning',
    'FLA': 'Florida Panthers',
    'CAR': 'Carolina Hurricanes',
    'CBJ': 'Columbus Blue Jackets',
    'DET': 'Detroit Red Wings',
    'NSH': 'Nashville Predators',
    'STL': 'St. Louis Blues',
    'MIN': 'Minnesota Wild',
    'CHI': 'Chicago Blackhawks',
    'COL': 'Colorado Avalanche',
    'DAL': 'Dallas Stars',
    'LAK': 'Los Angeles Kings',
    'ANA': 'Anaheim Ducks',
    'SJS': 'San Jose Sharks',
    'VGK': 'Vegas Golden Knights',
    'CGY': 'Calgary Flames',
    'EDM': 'Edmonton Oilers',
    'VAN': 'Vancouver Canucks',
    'SEA': 'Seattle Kraken'
};

async function getNextGame(teamAbbreviation) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const response = await axios.get(`https://api-web.nhle.com/v1/club-schedule/${teamAbbreviation}/month/now`);
        const games = response.data.games;
        
        const now = new Date();
        const upcomingGames = games.filter(game => new Date(game.startTimeUTC) > now);
        
        if (upcomingGames.length === 0) {
            return null;
        }
        
        return upcomingGames[0];
    } catch (error) {
        console.error('Error fetching game data:', error);
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

client.on('ready', () => {
    console.log(`✅ ${client.user.tag} is online!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Check if message starts with ! and ends with "countdown"
    const content = message.content.toLowerCase();
    if (!content.startsWith('!') || !content.endsWith('countdown')) return;
    
    // Extract team name from command (e.g., "!pencountdown" -> "pen")
    const teamInput = content.slice(1, -9); // Remove "!" and "countdown"
    
    if (!teamInput) {
        message.reply('Please specify a team! Example: `!pencountdown` for Pittsburgh Penguins');
        return;
    }
    
    // Get team abbreviation
    const teamAbbr = teamMappings[teamInput] || teamInput.toUpperCase();
    const teamName = teamNames[teamAbbr];
    
    if (!teamName) {
        message.reply(`Sorry, I don't recognize the team "${teamInput}". Try using team abbreviations like "pen" for Penguins or "caps" for Capitals.`);
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
        const venue = game.venue.default;
        const isHome = game.homeTeam.abbrev === teamAbbr;
        
        const embed = {
            color: 0x0099ff,
            title: `⏰ ${teamName} Countdown`,
            description: `Next game: ${isHome ? 'vs' : '@'} ${teamNames[opponent.abbrev] || opponent.placeName.default}`,
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
                    name: '🏒 Venue',
                    value: venue,
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
});

client.login(process.env.DISCORD_TOKEN);