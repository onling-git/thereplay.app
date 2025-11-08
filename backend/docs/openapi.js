// docs/openapi.js
const swaggerJSDoc = require('swagger-jsdoc');

const apiVersion = process.env.npm_package_version || '1.0.0';
const baseUrl = process.env.SELF_BASE || 'http://localhost:8000';

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'The Final Play API',
      version: apiVersion,
      description: 'Internal API for teams, matches, sync jobs, reports and live.'
    },
    servers: [
      { url: baseUrl, description: 'Current server' },
      { url: 'http://localhost:8000', description: 'Local dev' }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' }
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            detail: { type: 'string' }
          }
        },
        Match: {
          type: 'object',
          properties: {
            match_id: { type: 'integer', example: 19427515 },
            date: { type: 'string', format: 'date-time' },
            home_team: { type: 'string' },
            away_team: { type: 'string' },
            score: {
              type: 'object',
              properties: {
                home: { type: 'integer', example: 2 },
                away: { type: 'integer', example: 0 }
              }
            },
            status: { type: 'string', example: 'FT' },
            report: { type: 'string' }
          }
        },
        // Report schema: include POTM rating (number) so documentation reflects what the API returns
        Report: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            match_id: { type: 'integer', example: 19431868 },
            team_id: { type: 'integer', example: 12345 },
            team_focus: { type: 'string', example: 'Example FC' },
            team_slug: { type: 'string', example: 'example-fc' },
            headline: { type: 'string' },
            status: { type: 'string', example: 'final' },
            last_synced_at: { type: 'string', format: 'date-time', nullable: true },
            finalized_at: { type: 'string', format: 'date-time', nullable: true },
            source_counts: { type: 'object' },
            summary_paragraphs: { type: 'array', items: { type: 'string' } },
            key_moments: { type: 'array', items: { type: 'string' } },
            comments: { type: 'array', items: { type: 'object' } },
            commentary: { type: 'array', items: { type: 'string' } },
            // player of the match object. Critically include `rating` (number) which was missing previously
            potm: {
              type: 'object',
              properties: {
                player: { type: 'string', nullable: true },
                rating: { type: 'number', nullable: true, description: 'Numeric player rating (provider or inferred) e.g. 7.5' },
                reason: { type: 'string', nullable: true },
                sources: { type: 'object' }
              }
            },
            evidence_ref: {
              type: 'object',
              properties: {
                events_count: { type: 'integer' },
                tweets_count: { type: 'integer' }
              }
            },
            meta: { type: 'object' },
            generated: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          },
          example: {
            _id: '650a8fb2c9c1f2a1b23c9dfe',
            match_id: 19431868,
            team_id: 12345,
            team_focus: 'Example FC',
            team_slug: 'example-fc',
            headline: 'Example FC edge a narrow win',
            status: 'final',
            finalized_at: '2025-10-22T18:30:00.000Z',
            summary_paragraphs: ['Example FC produced a resilient performance.', 'The decisive moment came late in the second half.'],
            key_moments: ['78: Goal — Example FC', '85: Close chance — Opponent'],
            commentary: ['Solid defensive shape', 'Clinical finishing on the break'],
            potm: {
              player: 'Example Player',
              rating: 7.5,
              reason: 'Highest provider rating (7.5) and decisive involvement',
              sources: { player_stats: true, events: true }
            },
            evidence_ref: { events_count: 34, tweets_count: 2 },
            meta: { generated_by: 'gpt-4o-mini' },
            createdAt: '2025-10-22T18:30:01.000Z',
            updatedAt: '2025-10-22T18:30:01.000Z'
          }
        }
      }
    },
    tags: [
      { name: 'Matches' }, { name: 'Teams' }, { name: 'Reports' }, { name: 'Sync' }, { name: 'Live' }
    ]
  },
  // Where swagger-jsdoc will look for @openapi blocks:
  apis: [
    './routes/**/*.js'
  ]
};

const openapiSpec = swaggerJSDoc(options);
module.exports = { openapiSpec };
