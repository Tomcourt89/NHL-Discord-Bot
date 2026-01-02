/**
 * Command Registry
 * Central registry of all bot commands with their handlers
 */

const { execute: helpCommand } = require('./help');
const { countdown, countdownsite, schedule } = require('./countdown');
const { previousGame } = require('./previousGame');
const { recap } = require('./recap');
const { stats } = require('./stats');
const { playerStats } = require('./playerStats');
const { careerStats } = require('./careerStats');
const { divisionStandings, conferenceStandings, leagueStandings } = require('./standings');
const { injuries, injury } = require('./injuries');
const { news } = require('./news');
const { teamPast5, teamPast10, teamPast20 } = require('./teamPastGames');
const { playerPast5, playerPast10, playerPast20 } = require('./playerPastGames');

/**
 * Command registry mapping command names to their handlers
 * Each handler is an async function that takes (message, args)
 */
const commandRegistry = {
    // Help
    'commands': helpCommand,
    'help': helpCommand,
    
    // Countdown & Schedule
    'countdown': countdown,
    'countdownsite': countdownsite,
    'schedule': schedule,
    
    // Game Info
    'previousgame': previousGame,
    'recap': recap,
    
    // Team Stats
    'stats': stats,
    
    // Player Stats
    'playerstats': playerStats,
    'careerstats': careerStats,
    
    // Standings
    'divisionstandings': divisionStandings,
    'conferencestandings': conferenceStandings,
    'leaguestandings': leagueStandings,
    
    // Injuries
    'injuries': injuries,
    'injury': injury,
    
    // News
    'news': news,
    
    // Team Past Games
    'teampast5': teamPast5,
    'teampast10': teamPast10,
    'teampast20': teamPast20,
    
    // Player Past Games
    'playerpast5': playerPast5,
    'playerpast10': playerPast10,
    'playerpast20': playerPast20
};

/**
 * Execute a command with centralized error handling
 * @param {string} commandName - The command to execute
 * @param {object} message - Discord message object
 * @param {string[]} args - Command arguments
 * @returns {boolean} - Whether the command was found and executed
 */
async function executeCommand(commandName, message, args) {
    const handler = commandRegistry[commandName.toLowerCase()];
    
    if (!handler) {
        return false; // Command not found
    }
    
    try {
        await handler(message, args);
        return true;
    } catch (error) {
        console.error(`Error executing command '${commandName}':`, error);
        message.reply('Sorry, there was an error processing your request. Please try again later.');
        return true; // Command was found but errored
    }
}

/**
 * Check if a command exists in the registry
 * @param {string} commandName - The command name to check
 * @returns {boolean}
 */
function hasCommand(commandName) {
    return commandName.toLowerCase() in commandRegistry;
}

/**
 * Get all registered command names
 * @returns {string[]}
 */
function getCommandNames() {
    return Object.keys(commandRegistry);
}

module.exports = {
    commandRegistry,
    executeCommand,
    hasCommand,
    getCommandNames
};
