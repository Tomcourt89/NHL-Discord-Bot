const teamsData = require('../teams.json');

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

module.exports = {
    teamsData,
    getTeamAbbr,
    getTeamName,
    getTeamSearchKeywords,
    getTeamRssSlug
};
