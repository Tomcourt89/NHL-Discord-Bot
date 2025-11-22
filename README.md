# NHL Countdown Discord Bot

A Discord bot that provides NHL game countdowns for any team. Users can request countdowns by typing commands like `!pencountdown` for Pittsburgh Penguins games.

## Features

- 🏒 Get countdowns for any NHL team's next game
- ⏰ Real-time countdown timers (days, hours, minutes)
- 📅 Game date, time, and venue information
- 🏟️ Home/away game indicators
- 🎯 Easy-to-use team commands (e.g., `!pencountdown`, `!capscountdown`)
- 📱 Rich Discord embeds with formatted information

## Supported Commands

The bot responds to commands in the format `![team]countdown`. Here are some examples:

### Popular Teams
- `!pencountdown` - Pittsburgh Penguins
- `!capscountdown` - Washington Capitals
- `!rangerscountdown` - New York Rangers
- `!bruinscountdown` - Boston Bruins
- `!leafscountdown` - Toronto Maple Leafs
- `!lightningcountdown` - Tampa Bay Lightning

### All Supported Team Names
You can use team abbreviations, nicknames, or full names:
- **Pittsburgh**: `pen`, `pens`, `penguins`, `pittsburgh`
- **Washington**: `caps`, `capitals`, `washington`
- **New York Rangers**: `rangers`
- **Boston**: `bruins`
- **Toronto**: `leafs`
- **Tampa Bay**: `lightning`
- And many more! (See the full list in the code)

## Setup Instructions

### Prerequisites
- Node.js 16.0.0 or higher
- A Discord bot token
- A Discord server where you have permission to add bots

### 1. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section
4. Click "Add Bot"
5. Copy the bot token (you'll need this later)
6. Under "Privileged Gateway Intents", enable:
   - Message Content Intent

### 2. Invite Bot to Your Server

1. In the Developer Portal, go to the "OAuth2" > "URL Generator" section
2. Select the following scopes:
   - `bot`
3. Select the following permissions:
   - Send Messages
   - Use Slash Commands
   - Embed Links
4. Copy the generated URL and open it in your browser
5. Select the server you want to add the bot to

### 3. Configure the Bot

1. Clone or download this repository
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and add your Discord bot token:
   ```
   DISCORD_TOKEN=your_discord_bot_token_here
   ```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Bot

```bash
npm start
```

You should see a message like "✅ [BotName] is online!" in the console.

## Usage Examples

Once the bot is running in your Discord server, try these commands:

```
!pencountdown
```
> Returns countdown to the next Pittsburgh Penguins game

```
!capscountdown  
```
> Returns countdown to the next Washington Capitals game

```
!bruinscountdown
```
> Returns countdown to the next Boston Bruins game

## API Information

This bot uses the official NHL API (`api-web.nhle.com`) to fetch:
- Team schedules
- Game times and venues
- Opponent information

No API key is required as the NHL API is publicly accessible.

## Development

### Project Structure
```
├── index.js          # Main bot file
├── package.json      # Dependencies and scripts
├── .env.example      # Environment variables template
├── .gitignore        # Git ignore rules
└── README.md         # This file
```

### Adding New Teams
To add support for new team names/abbreviations:

1. Add entries to the `teamMappings` object in `index.js`
2. Add the team's full name to the `teamNames` object

### Customization
- Modify the embed colors and styling in the `embed` object
- Add new command patterns by modifying the message parsing logic
- Extend functionality by adding new API endpoints or data sources

## Troubleshooting

### Bot Not Responding
1. Check that the bot is online (green status in Discord)
2. Verify the bot has permission to read and send messages in the channel
3. Ensure Message Content Intent is enabled in the Discord Developer Portal

### API Errors
1. Check your internet connection
2. The NHL API may occasionally be unavailable
3. Check the console for error messages

### Token Issues
1. Make sure your `.env` file contains the correct bot token
2. Regenerate the token in the Discord Developer Portal if needed
3. Don't share your bot token publicly

## Contributing

Feel free to submit issues and pull requests to improve the bot!

## License

MIT License - feel free to use and modify as needed.