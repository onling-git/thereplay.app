const Team = require('../models/Team');
const Venue = require('../models/Venue');
const { get } = require('../utils/sportmonks');
const { registerVenue } = require('../utils/venue');

async function getTeamHomeVenue(team) {
  const matchesVenueId = !team.venue_id || team.venue?.id === team.venue_id;
  if (matchesVenueId && team.venue?.name && team.venue?.slug) return team.venue;
  let venueId = team.venue_id;
  let rawVenue = matchesVenueId ? team.venue : null;
  if (!venueId && !rawVenue?.id && team.id) {
    const response = await get(`/teams/${team.id}`, { include: 'venue' });
    const provider = response?.data?.data;
    if (!provider) throw new Error(`Sportmonks returned no team for venue lookup: ${team.id}`);
    venueId = provider.venue_id;
    rawVenue = provider.venue?.data || provider.venue;
  }
  if (!rawVenue?.name && venueId) {
    const stored = await Venue.findOne({ id: venueId }).lean();
    if (stored?.name) rawVenue = stored;
    else {
      const response = await get(`/venues/${venueId}`);
      rawVenue = response?.data?.data;
      if (!rawVenue) throw new Error(`Sportmonks returned no venue: ${venueId}`);
    }
  }
  if (!rawVenue?.id) return null;
  const venue = await registerVenue(rawVenue);
  await Team.updateOne({ _id: team._id }, { $set: { venue_id: venue.id, venue } });
  return venue;
}

module.exports = { getTeamHomeVenue };
