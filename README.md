# NHL Discord Bot

A Discord bot that provides NHL game information, statistics, and video recaps.

## Features

### Game Information
- Game countdowns with date, time, and venue details
- Previous game results and scores  
- Video highlights with automatic embedding
- Three stars information

### Statistics  
- Team statistics for current season
- Player statistics (current season and career)
- Specialized goalie statistics
- Multiple player search results

### League Information
- Division standings
- Full league standings with optional team highlighting
- Conference standings (planned)

### Technical Features
- Flexible team name recognition (abbreviations, nicknames, full names)
- Real-time data from NHL APIs
- YouTube integration for game highlights
- Discord embed formatting

## Commands

### Basic Commands
```
!commands                    # Show all available commands
```

### Game Information
```
!countdown [team]            # Countdown to next game
!previousgame [team]         # Last game result and score
!recap [team]               # Video highlights of last game
```

### Statistics  
```
!stats [team]               # Current season team statistics
!playerstats [player]       # Current season player stats
!careerstats [player]       # Complete career statistics
```

### Standings
```
!divisionstandings [team]   # Division standings for team's division
!leaguestandings [team]     # Full league with optional team highlight  
!conferencestandings [team] # Conference standings (coming soon)
```

### Usage Examples
```
!countdown pen              # Pittsburgh Penguins next game countdown
!recap seattle             # Seattle Kraken last game highlights
!playerstats crosby         # Sidney Crosby current season stats
!careerstats ovechkin       # Alexander Ovechkin career totals
!stats caps                # Washington Capitals team statistics
!leaguestandings devils     # Full NHL standings highlighting New Jersey
```

## Setup

### Prerequisites
- Node.js 16.0.0 or higher
- Discord bot token
- Discord server with bot permissions
- YouTube Data API key (optional, for enhanced video search)

### Environment Variables

Edit the `.env` file in the project root and replace the placeholder values:
```
DISCORD_TOKEN=your_actual_discord_bot_token_here
YOUTUBE_API_KEY=your_actual_youtube_api_key_here
```

**Important**: Never commit your `.env` file to version control. The `.gitignore` file is configured to exclude it.

### Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create new application
3. Go to Bot section, create bot, copy token
4. Enable "Message Content Intent" under Privileged Gateway Intents
5. Go to OAuth2 > URL Generator
6. Select scopes: `bot`
7. Select permissions: `Send Messages`, `Send Messages in Threads`, `Embed Links`, `Read Message History`
8. Use generated URL to invite bot to your server

### YouTube API Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project or select existing
3. Enable YouTube Data API v3
4. Create API key credential
5. Add key to `.env` file

Without YouTube API key, video search will provide search links instead of embedded videos.

### Installation

```bash
npm install
npm start
```

### Hosting for 24/7 Availability

For production hosting, use environment variables instead of `.env` files:

**Platform-specific instructions:**

**Heroku:**
```bash
heroku config:set DISCORD_TOKEN=your_token_here
heroku config:set YOUTUBE_API_KEY=your_key_here
```

**Railway:**
```bash
railway variables set DISCORD_TOKEN=your_token_here
railway variables set YOUTUBE_API_KEY=your_key_here
```

**DigitalOcean App Platform:**
Add environment variables in the App Platform dashboard under Settings > Environment Variables

**VPS/Server:**
```bash
# Add to ~/.bashrc or /etc/environment
export DISCORD_TOKEN=your_token_here
export YOUTUBE_API_KEY=your_key_here
```

**Docker:**
```bash
docker run -e DISCORD_TOKEN=your_token -e YOUTUBE_API_KEY=your_key your_image
```

### Security Best Practices

1. Never commit API keys to version control
2. Use different API keys for development and production
3. Regularly rotate API keys
4. Use hosting platform's secret management when available
5. Monitor API key usage for unauthorized access

## API Information

This bot uses multiple data sources:

- **NHL API** (`api-web.nhle.com`): Game schedules, team stats, player information
- **NHL Search API** (`search.d3.nhle.com`): Player search and statistics
- **YouTube Data API v3** (optional): Video highlights and recaps

No API keys are required for NHL data as their APIs are publicly accessible.

## Development

### Project Structure
```
├── index.js          # Main bot file with all commands and logic
├── package.json      # Dependencies and scripts
├── .env              # Environment variables (git-ignored)
├── .gitignore        # Git ignore rules  
└── README.md         # Documentation
```

### Key Functions
- `getNextGame()` - Fetches upcoming game data
- `getPreviousGame()` - Gets most recent completed game
- `getGameRecap()` - Searches for video highlights with YouTube integration
- `getTeamStats()` - Current season team statistics  
- `getPlayerStats()` - Current season player data
- `getPlayerCareerStats()` - Complete career statistics
- `getStandings()` - League standings and rankings
- `getCurrentNHLSeason()` - Smart season detection based on date

### Adding New Features

**New Commands:**
1. Add command detection in main message handler
2. Create corresponding function to fetch/process data
3. Format response with Discord embeds
4. Handle error cases

**New Team Names:**
1. Add entries to `teamMappings` object in `index.js`
2. Ensure official abbreviation exists in `teamNames`

### Testing
```bash
!commands                   # Help menu
!countdown pit             # Upcoming game
!previousgame sea          # Recent game  
!recap van                 # Video highlights
!stats tor                 # Team statistics
!playerstats crosby        # Single player result
!playerstats smith         # Multiple player results
!careerstats ovechkin      # Career totals
!divisionstandings det     # Division standings
!leaguestandings bos       # Highlighted standings
```

## API Information

- **NHL API** (`api-web.nhle.com`): Game schedules, team stats, player information
- **NHL Search API** (`search.d3.nhle.com`): Player search and statistics
- **YouTube Data API v3** (optional): Video highlights and recaps

NHL APIs are publicly accessible and require no authentication.

## License

MIT License

## Troubleshooting

### Bot Not Responding
- Check bot online status in Discord
- Verify bot has Send Messages permission in channel
- Ensure Message Content Intent is enabled in Developer Portal
- Check console for error messages
- Verify `.env` file exists with correct `DISCORD_TOKEN`

### API/Data Issues  
- NHL API may have occasional outages
- Some players/teams might not have current season data
- Game highlights may not be available immediately after games
- Times are displayed in system timezone

### Video/YouTube Issues
- Without API key: Videos show as search links instead of embedded players
- Highlights may not exist for older games  
- Some videos can't be embedded due to creator settings
- When exact videos aren't found, search results are provided

### Performance Issues
- NHL APIs can be slow during peak times (game nights)
- Multiple rapid requests might be rate limited
- Bot loads all team mappings on startup (normal behavior)

### Common Error Messages
```
"Sorry, I don't recognize the team..."
→ Check team name spelling or try different variation

"No upcoming games found..."  
→ Team might be in off-season or have scheduling gaps

"No players found matching..."
→ Try partial names or check spelling
```

## Contributing

Areas for improvement:
- Caching for API responses
- Performance optimization for high-traffic servers  
- Enhanced embed designs
- Migration to Discord slash commands
- Input validation and rate limiting

### Development Workflow
1. Fork repository
2. Create feature branch
3. Test thoroughly
4. Update documentation  
5. Submit pull request

## License

MIT License