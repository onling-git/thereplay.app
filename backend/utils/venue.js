function normalizeVenue(raw) {
  const venue = raw?.data || raw;
  if (!venue || typeof venue !== 'object') return null;
  const id = Number(venue.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return {
    id,
    name: venue.name || venue.venue_name || '',
    address: venue.address || '',
    city_name: venue.city_name || venue.city?.name || (typeof venue.city === 'string' ? venue.city : ''),
    country_code: venue.country_code || venue.country?.iso2 || venue.city?.country?.iso2 || '',
    country_id: venue.country_id || venue.city?.country_id || null,
    postal_code: venue.postal_code || '',
    capacity: venue.capacity ?? null,
    image_path: venue.image_path || '',
  };
}

async function registerVenue(raw) {
  const venue = normalizeVenue(raw);
  if (!venue) return null;
  const Venue = require('../models/Venue');
  if (!venue.country_code && venue.country_id) {
    const Country = require('../models/Country');
    const country = await Country.findOne({ id: venue.country_id }).lean();
    venue.country_code = country?.iso2 || '';
  }
  const slug = venue.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const update = Object.fromEntries(Object.entries(venue).filter(([, value]) => value !== '' && value !== null));
  const stored = await Venue.findOneAndUpdate(
    { id: venue.id },
    {
      $set: update,
      // The provider ID avoids collisions; a renamed stadium retains its original slug.
      $setOnInsert: { slug: `${slug || 'venue'}-${venue.id}` },
    },
    { upsert: true, new: true, runValidators: true }
  ).lean();
  return stored;
}

function venuePlace(venue) {
  if (!venue?.name) return null;
  const address = {
    ...(venue.address ? { streetAddress: venue.address } : {}),
    ...(venue.city_name ? { addressLocality: venue.city_name } : {}),
    ...(venue.country_code ? { addressCountry: venue.country_code } : {}),
    ...(venue.postal_code ? { postalCode: venue.postal_code } : {}),
  };
  return {
    '@type': 'Place',
    ...(venue.slug ? { '@id': `https://thereplay.app/venues/${encodeURIComponent(venue.slug)}#place` } : {}),
    name: venue.name,
    ...(Object.keys(address).length ? { address: { '@type': 'PostalAddress', ...address } } : {}),
  };
}

module.exports = { normalizeVenue, registerVenue, venuePlace };
