// Utility to map SportMonks statistic type IDs to readable names
// This mapping can be expanded based on the SportMonks documentation or API response observation

const STATISTIC_TYPE_MAP = {
  // Official SportMonks mappings based on documentation
  34: 'Corners',
  41: 'Shots Off Target', 
  42: 'Shots Total',
  43: 'Attacks',
  44: 'Dangerous Attacks',
  45: 'Possession %',
  46: 'Ball Safe',
  47: 'Penalties',
  49: 'Shots Inside Box',
  50: 'Shots Outside Box',
  51: 'Offsides',
  52: 'Goals',
  53: 'Goal Kicks',
  54: 'Goal Attempts',
  55: 'Free Kicks',
  56: 'Fouls',
  57: 'Saves',
  58: 'Shots Blocked',
  59: 'Substitutions',
  60: 'Throw Ins',
  62: 'Long Passes',
  64: 'Hit Woodwork',
  65: 'Successful Headers',
  66: 'Successful Interceptions',
  68: 'Substitutions Overtime',
  69: 'Offsides Overtime',
  70: 'Headers',
  74: 'Yellow Cards Overtime',
  77: 'Challenges',
  78: 'Tackles',
  79: 'Assists',
  80: 'Passes',
  81: 'Successful Passes',
  82: 'Successful Passes %',
  83: 'Red Cards',
  84: 'Yellow Cards',
  85: 'Second Yellow Cards',
  86: 'Shots On Target',
  87: 'Injuries',
  98: 'Total Crosses',
  99: 'Accurate Crosses',
  100: 'Interceptions',
  106: 'Duels Won',
  108: 'Dribble Attempts',
  109: 'Successful Dribbles',
  117: 'Key Passes',
  580: 'Big Chances Created',
  581: 'Big Chances Missed',
  1489: 'Treatments',
  1527: 'Counter Attacks',
  1533: 'Successful Crosses %',
  1605: 'Successful Dribbles %',
  27264: 'Successful Long Passes',
  27265: 'Successful Long Passes %',
  
  // Additional stats that might appear
  1590: 'Ball Possession',
  1591: 'Target Shots',
  1592: 'Shots Outside Box',
  1593: 'Shots Inside Box',
  1594: 'Shots Blocked',
  1595: 'Shots on Woodwork',
  1596: 'Corner Kicks',
  1597: 'Attacks',
  1598: 'Dangerous Attacks',
  1599: 'Free Kicks',
  1600: 'Goal Kicks',
  1601: 'Throw Ins',
  1602: 'Crosses',
  1603: 'Offsides',
  1604: 'Fouls',
  1606: 'Yellow Cards',
  1607: 'Red Cards',
  1608: 'Substitutions',
  1609: 'Total Passes',
  1610: 'Completed Passes',
  1611: 'Tackles',
  1612: 'Duels',
  1613: 'Duels Won',
  1614: 'Saves',
  1615: 'Pen Area Entries',
  1616: 'Pen Area Saves',
  
  // Percentage stats
  1617: 'Pass Success Rate',
  1618: 'Aerial Duels Success Rate',
  1619: 'Dribble Success Rate',
  
  // Advanced stats
  1620: 'Expected Goals (xG)',
  1621: 'Expected Assists (xA)',
  1622: 'Progressive Passes',
  1623: 'Progressive Carries',
  1624: 'Progressive Pass Distance',
  1625: 'Touches',
  1626: 'Touches in Box',
  1627: 'Take-ons Attempted',
  1628: 'Take-ons Successful',
  1629: 'Times Dribbled Past',
  1630: 'Carries',
  1631: 'Carry Distance',
  1632: 'Progressive Carry Distance',
  1633: 'Shot Creating Actions',
  1634: 'Goal Creating Actions'
};

/**
 * Get human-readable name for a SportMonks statistic type ID
 * @param {number} typeId - The SportMonks statistic type ID  
 * @param {string} fallback - Fallback text if type not found
 * @returns {string} - Human readable statistic name
 */
function getStatisticTypeName(typeId, fallback = null) {
  return STATISTIC_TYPE_MAP[typeId] || fallback || `Stat ${typeId}`;
}

/**
 * Get all available statistic type mappings
 * @returns {Object} - Object with typeId -> name mappings
 */
function getAllStatisticTypes() {
  return { ...STATISTIC_TYPE_MAP };
}

/**
 * Check if a statistic type ID is known/mapped
 * @param {number} typeId - The SportMonks statistic type ID
 * @returns {boolean} - True if type is mapped
 */
function isKnownStatisticType(typeId) {
  return typeId in STATISTIC_TYPE_MAP;
}

/**
 * Format statistic value for display (handles percentages, etc.)
 * @param {number} value - The raw statistic value
 * @param {number} typeId - The SportMonks statistic type ID
 * @returns {string} - Formatted value for display
 */
function formatStatisticValue(value, typeId) {
  // Percentage stats based on correct SportMonks documentation
  if ([45, 82, 1533, 1605, 27265].includes(typeId)) {
    return `${value}%`;
  }
  
  // Decimal stats that should show precision
  if ([580, 581].includes(typeId)) {
    return parseFloat(value).toFixed(1);
  }
  
  // Default: return as integer
  return Math.round(value).toString();
}

module.exports = {
  STATISTIC_TYPE_MAP,
  getStatisticTypeName,
  getAllStatisticTypes, 
  isKnownStatisticType,
  formatStatisticValue
};