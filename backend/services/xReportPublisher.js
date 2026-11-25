const axios = require('axios');
const crypto = require('crypto');
const Report = require('../models/Report');
const Match = require('../models/Match');
const Team = require('../models/Team');
const coveragePolicy = require('./coveragePolicy');

const CREATE_URL = 'https://api.x.com/2/tweets';
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function authorization(credentials, nonce = crypto.randomBytes(16).toString('hex'), timestamp = Math.floor(Date.now() / 1000)) {
  const { consumerKey, consumerSecret, accessToken, accessSecret } = credentials;
  if (!consumerKey || !consumerSecret || !accessToken || !accessSecret) throw new Error('X posting credentials are incomplete');
  const params = {
    oauth_consumer_key: consumerKey, oauth_nonce: nonce, oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp), oauth_token: accessToken, oauth_version: '1.0'
  };
  const normalized = Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encode(key)}=${encode(value)}`).join('&');
  const base = `POST&${encode(CREATE_URL)}&${encode(normalized)}`;
  params.oauth_signature = crypto.createHmac('sha1', `${encode(consumerSecret)}&${encode(accessSecret)}`).update(base).digest('base64');
  return `OAuth ${Object.entries(params).map(([key, value]) => `${encode(key)}="${encode(value)}"`).join(', ')}`;
}

function composePost(report, team, siteUrl) {
  const hashtag = team?.twitter?.hashtag?.trim();
  if (!/^#[a-zA-Z0-9_]+$/.test(hashtag || '')) throw new Error('Team has no valid primary hashtag');
  if (!/^[a-z0-9-]+$/.test(report.team_slug || '') || !Number.isSafeInteger(report.match_id) || report.match_id <= 0) {
    throw new Error('Report has no valid public URL');
  }
  const base = new URL(siteUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('X report site URL must be an HTTPS origin');
  }
  const url = `${base.origin}/${encodeURIComponent(report.team_slug)}/match/${report.match_id}/report`;
  const headline = String(report.headline || report.generated?.headline || '').replace(/\s+/g, ' ').trim();
  if (!headline) throw new Error('Report has no headline');
  // X counts URLs as 23 characters regardless of their actual length.
  const suffix = `\n\n${hashtag}\n${url}`;
  const maxHeadline = 280 - Array.from(`\n\n${hashtag}\n`).length - 23;
  if (maxHeadline < 2) throw new Error('Hashtag is too long to publish');
  const characters = Array.from(headline);
  const weight = character => character.codePointAt(0) <= 127 ? 1 : 2;
  let length = 0;
  let shortened = '';
  for (const character of characters) {
    if (length + weight(character) > maxHeadline - 3) break;
    shortened += character;
    length += weight(character);
  }
  if (shortened.length < headline.length) shortened += '...';
  return `${shortened}${suffix}`;
}

function publishMode() {
  const mode = process.env.X_REPORT_PUBLISH_MODE || 'off';
  if (!['off', 'dry-run', 'live'].includes(mode)) throw new Error('Invalid X report publishing mode');
  if (mode === 'live' && [process.env.NODE_ENV, process.env.RAILWAY_ENVIRONMENT_NAME].some(value => /stag(e|ing)/i.test(value || ''))) {
    if (process.env.X_REPORT_ALLOW_STAGING_LIVE !== 'true' || !process.env.X_REPORT_SITE_URL) {
      throw new Error('Live X report publishing on staging requires explicit opt-in and a staging site URL');
    }
    const url = new URL(process.env.X_REPORT_SITE_URL);
    if (url.hostname.toLowerCase() === 'thereplay.app' || url.hostname.toLowerCase() === 'www.thereplay.app') {
      throw new Error('Staging X publication cannot link to the production site');
    }
  }
  return mode;
}

async function publishReport(reportId) {
  const mode = publishMode();
  if (mode === 'off') return;
  const report = await Report.findOneAndUpdate(
    { _id: reportId, 'x_publication.state': 'pending', 'x_publication.mode': mode },
    { $set: { 'x_publication.state': 'sending', 'x_publication.started_at': new Date() }, $inc: { 'x_publication.attempts': 1 } },
    { new: true }
  ).lean();
  if (!report) return;
  let text;
  let posted = false;
  try {
    const match = await Match.findOne({ match_id: report.match_id, ...(await coveragePolicy.publicMatchFilter()) }).lean();
    const linked = [match?.reports?.home, match?.reports?.away].some(id => String(id) === String(report._id));
    if (!linked) throw new Error('Report is not linked to a publicly covered match');
    const team = await Team.findOne({ id: report.team_id }).lean();
    text = composePost(report, team, process.env.X_REPORT_SITE_URL || 'https://thereplay.app');
    if (mode === 'dry-run') {
      await Report.updateOne({ _id: report._id, 'x_publication.state': 'sending' }, {
        $set: { 'x_publication.state': 'dry_run', 'x_publication.text': text, 'x_publication.completed_at': new Date() }
      });
      return;
    }
    const header = authorization({
      consumerKey: process.env.X_API_KEY, consumerSecret: process.env.X_API_SECRET,
      accessToken: process.env.X_ACCESS_TOKEN, accessSecret: process.env.X_ACCESS_TOKEN_SECRET
    });
    let response;
    try {
      response = await axios.post(CREATE_URL, { text }, { headers: { Authorization: header }, timeout: 10000 });
      posted = true;
    } catch (error) {
      if (error.response?.status === 429 && report.x_publication?.attempts < 3) {
        await Report.updateOne({ _id: report._id, 'x_publication.state': 'sending' }, {
          $set: {
            'x_publication.state': 'pending', 'x_publication.text': text,
            'x_publication.error': 'X rate limit reached', 'x_publication.retry_at': new Date(Date.now() + 15 * 60 * 1000)
          }
        });
        console.warn(`[x-publishing] Rate limited for report ${report._id}; retry scheduled`);
        return;
      }
      const state = error.response?.status >= 400 && error.response.status < 500 ? 'failed' : 'uncertain';
      await Report.updateOne({ _id: report._id, 'x_publication.state': 'sending' }, {
        $set: { 'x_publication.state': state, 'x_publication.text': text, 'x_publication.error': `X request failed (${error.response?.status || 'no response'})`, 'x_publication.completed_at': new Date() }
      });
      console.error(`[x-publishing] ${state} for report ${report._id}:`, error.response?.status || error.message);
      return;
    }
    if (!response.data?.data?.id) throw new Error('X returned success without a post ID; manual reconciliation required');
    await Report.updateOne({ _id: report._id, 'x_publication.state': 'sending' }, {
      $set: { 'x_publication.state': 'published', 'x_publication.text': text, 'x_publication.post_id': response.data.data.id, 'x_publication.completed_at': new Date() }
    });
  } catch (error) {
    // A successful POST followed by a database failure must never be retried automatically.
    const state = posted ? 'uncertain' : 'failed';
    await Report.updateOne({ _id: report._id, 'x_publication.state': 'sending' }, {
      $set: { 'x_publication.state': state, 'x_publication.error': error.message, 'x_publication.completed_at': new Date() }
    });
    console.error(`[x-publishing] ${state} for report ${report._id}:`, error.message);
  }
}

async function processPendingReports() {
  if (publishMode() === 'off') return;
  const mode = publishMode();
  const stale = await Report.updateMany({
    'x_publication.state': 'sending', 'x_publication.mode': mode,
    'x_publication.started_at': { $lte: new Date(Date.now() - 2 * 60 * 1000) }
  }, {
    $set: { 'x_publication.state': 'uncertain', 'x_publication.error': 'Publishing interrupted; reconcile with X before retrying', 'x_publication.completed_at': new Date() }
  });
  if (stale.modifiedCount) console.error(`[x-publishing] ${stale.modifiedCount} interrupted posts require reconciliation`);
  const reports = await Report.find({
    'x_publication.state': 'pending', 'x_publication.mode': mode,
    'x_publication.queued_at': { $lte: new Date(Date.now() - 30000) },
    $or: [{ 'x_publication.retry_at': { $exists: false } }, { 'x_publication.retry_at': { $lte: new Date() } }]
  }).sort({ 'x_publication.queued_at': 1 }).limit(10).select('_id').lean();
  for (const report of reports) await publishReport(report._id);
}

module.exports = { authorization, composePost, publishMode, publishReport, processPendingReports };
