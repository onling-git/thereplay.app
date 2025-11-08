const mongoose = require('mongoose');

/**
 * Connect to MongoDB using mongoose. Validates the url and logs on success/failure.
 * Returns the mongoose connection promise.
 */
async function connectDB(url, options = {}) {
    if (!url) {
        throw new Error('Missing MongoDB connection URL. Please set DBURI (or MONGO_URI) in the environment.');
    }

    // sensible defaults can be supplied here if you need them
    const connectOpts = Object.assign({
        // use the default mongoose recommendations; keep minimal here to avoid surprises
    }, options);

    try {
        const conn = await mongoose.connect(url, connectOpts);
        console.log('[db] MongoDB connected');
        return conn;
    } catch (err) {
        console.error('[db] MongoDB connection error:', err.message || err);
        throw err;
    }
}

async function closeDB() {
    try {
        await mongoose.connection.close();
        console.log('[db] MongoDB connection closed');
    } catch (err) {
        console.warn('[db] Error closing MongoDB connection:', err?.message || err);
    }
}

module.exports = { connectDB, closeDB };
