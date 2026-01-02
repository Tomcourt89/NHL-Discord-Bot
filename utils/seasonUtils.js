// Helper function to get current NHL season ID (format: 20242025)
function getCurrentNHLSeason() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    if (month >= 10) {
        return parseInt(`${year}${year + 1}`);
    } else {
        return parseInt(`${year - 1}${year}`);
    }
}

// Get previous season from a season ID
function getPreviousSeason(seasonId) {
    const seasonStr = seasonId.toString();
    const startYear = parseInt(seasonStr.substring(0, 4));
    return parseInt(`${startYear - 1}${startYear}`);
}

// Format season display string (e.g., "2024-25")
function formatSeasonDisplay(seasonId) {
    const seasonStr = seasonId.toString();
    const startYear = seasonStr.substring(0, 4);
    const endYear = seasonStr.substring(6, 8);
    return `${startYear}-${endYear}`;
}

module.exports = {
    getCurrentNHLSeason,
    getPreviousSeason,
    formatSeasonDisplay
};
