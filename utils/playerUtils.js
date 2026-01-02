const { teamsData } = require('./teamUtils');

// Score how well a player name matches the search query
function scorePlayerMatch(playerName, queryParts) {
    const nameLower = playerName.toLowerCase();
    const nameParts = nameLower.split(' ');
    const queryLower = queryParts.map(p => p.toLowerCase());
    
    // Exact full name match (highest priority)
    if (nameLower === queryLower.join(' ')) {
        return 100;
    }
    
    const querySurname = queryLower[queryLower.length - 1];
    const playerSurname = nameParts[nameParts.length - 1];
    const surnameMatches = playerSurname === querySurname || 
                           playerSurname.includes(querySurname) || 
                           querySurname.includes(playerSurname);
    
    // For multi-word queries (full name search), surname MUST match
    if (queryLower.length > 1) {
        if (!surnameMatches) {
            return 0;
        }
        
        const allPartsMatch = queryLower.every(qPart => 
            nameParts.some(nPart => nPart.includes(qPart) || qPart.includes(nPart))
        );
        
        if (allPartsMatch) {
            return 80;
        }
        
        return 40;
    }
    
    // Single word query (surname only search)
    if (surnameMatches) {
        if (playerSurname === querySurname) {
            return 70;
        }
        return 50;
    }
    
    // Check if query matches first name (for single word queries)
    const firstNameMatches = nameParts.some(nPart => 
        nPart.includes(querySurname) || querySurname.includes(nPart)
    );
    
    if (firstNameMatches) {
        return 20;
    }
    
    return 0;
}

// Check if player is on an active NHL roster
function isActiveNHLPlayer(landingData) {
    const teamAbbrev = landingData?.currentTeamAbbrev;
    return teamAbbrev && teamsData[teamAbbrev] !== undefined;
}

module.exports = {
    scorePlayerMatch,
    isActiveNHLPlayer
};
