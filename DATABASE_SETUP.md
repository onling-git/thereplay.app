# Database Setup Guide

## Overview

Your application now uses **environment-specific databases**:

| Environment | Database Name | Connection String |
|------------|---------------|-------------------|
| **Production** | `fulltime` | Same cluster, production database |
| **Staging** | `fulltime-staging` | Same cluster, staging database |
| **Local** | `fulltime-local` | Same cluster, local development database |

All three databases use the same **MongoDB Atlas cluster** (`cluster0.4fdbxhw.mongodb.net`) but separate database names for isolation.

## 🚀 Quick Start

### 1. The databases will be auto-created!

**Good news:** MongoDB Atlas automatically creates databases when you first connect to them. You don't need to manually create anything in the Atlas UI.

When you start your backend in staging mode, MongoDB will:
1. Connect to your cluster
2. See the database name `fulltime-staging` in the connection string
3. Automatically create it if it doesn't exist
4. Start storing data there

### 2. Start Backend in Different Environments

```bash
# Local development
cd backend
npm run dev:local

# Staging environment
npm run dev:staging

# Production environment
npm run start:prod
```

## 📊 Environment Configuration

### Configuration Files

| File | Purpose | Git Status |
|------|---------|------------|
| `.env.local` | Local development | ❌ Not committed (in .gitignore) |
| `.env.staging` | Staging environment | ❌ Not committed (in .gitignore) |
| `.env.production` | Production environment | ❌ Not committed (in .gitignore) |

**Important:** These files are already in `.gitignore` and won't be committed to git for security.

### How It Works

The backend automatically loads the correct `.env` file based on `NODE_ENV`:

```javascript
// In server.js
NODE_ENV=local      → loads .env.local
NODE_ENV=staging    → loads .env.staging
NODE_ENV=production → loads .env.production
```

## 🗄️ Database Isolation

Each environment has its own isolated database:

```
MongoDB Atlas Cluster: cluster0.4fdbxhw.mongodb.net
├── fulltime (production data)
├── fulltime-staging (staging data)
└── fulltime-local (local dev data)
```

**Benefits:**
- ✅ Test changes in staging without affecting production
- ✅ Development work doesn't pollute staging or production
- ✅ Same credentials, easy management
- ✅ Cost-effective (all in one cluster)

## 🔧 Server Deployment Setup

### For Production Server (Railway/Heroku/etc.)

Set environment variables in your hosting platform:

```bash
NODE_ENV=production
PORT=8080
DBURI=mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay
# ... other production variables
```

### For Staging Server (Railway/Heroku/etc.)

Set environment variables in your hosting platform:

```bash
NODE_ENV=staging
PORT=8080
DBURI=mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime-staging?retryWrites=true&w=majority&appName=thefinalplay
# ... other staging variables
```

## 📦 Copying Production Data to Staging

If you want to test with real production data:

### Option 1: Using MongoDB Compass (GUI)

1. Open MongoDB Compass
2. Connect to your cluster
3. Select `fulltime` database (production)
4. For each collection:
   - Export to JSON
   - Switch to `fulltime-staging` database
   - Import the JSON

### Option 2: Using mongodump/mongorestore (CLI)

```bash
# Dump production database
mongodump --uri="mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime" --out=./backup

# Restore to staging database
mongorestore --uri="mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime-staging" ./backup/fulltime --nsFrom='fulltime.*' --nsTo='fulltime-staging.*'
```

### Option 3: MongoDB Atlas Cloud Backup (Recommended)

1. Go to MongoDB Atlas dashboard
2. Navigate to your cluster
3. Click "Restore" on a backup snapshot
4. Choose "Download" or "Restore to different database"
5. Specify `fulltime-staging` as the target database

## 🔍 Monitoring & Management

### View Databases in MongoDB Atlas

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Select your cluster
3. Click "Collections"
4. You'll see all three databases:
   - `fulltime`
   - `fulltime-staging`
   - `fulltime-local`

### View Database in Code

The server logs which database it's connecting to on startup:

```
[server] Starting in staging mode, using .env.staging
[server] Database: cluster0.4fdbxhw.mongodb.net/fulltime-staging
[db] MongoDB connected
```

## 🧪 Testing the Setup

### Test Local Environment

```bash
cd backend
npm run dev:local
```

Expected output:
```
[server] Starting in local mode, using .env.local
[server] Database: cluster0.4fdbxhw.mongodb.net/fulltime-local
[db] MongoDB connected
Server is listening on port 8080
```

### Test Staging Environment

```bash
npm run dev:staging
```

Expected output:
```
[server] Starting in staging mode, using .env.staging
[server] Database: cluster0.4fdbxhw.mongodb.net/fulltime-staging
[db] MongoDB connected
Server is listening on port 8080
```

## 🔐 Security Best Practices

1. **Never commit .env files** - Already in .gitignore ✅
2. **Rotate API keys periodically** - Update in Atlas and env files
3. **Use different API keys for staging** - If your external APIs support it
4. **Restrict database access** - Set up Atlas IP whitelist
5. **Monitor database activity** - Use Atlas monitoring dashboard

## ⚠️ Important Notes

1. **Staging database is NOT automatically synced with production**
   - Data changes in staging won't affect production (and vice versa)
   - You need to manually copy data if needed (see section above)

2. **API Rate Limits**
   - Staging and production share the same API keys by default
   - Consider getting separate API keys for staging to avoid rate limit conflicts

3. **Costs**
   - All three databases in one cluster = same cost as one database
   - MongoDB Atlas charges per cluster, not per database
   - Monitor cluster storage and usage in Atlas dashboard

4. **Backups**
   - Atlas backups cover the entire cluster (all databases)
   - Configure backup schedules in Atlas dashboard

## 🎯 Next Steps

1. ✅ Databases are configured (auto-created on first connect)
2. ✅ Environment files are set up
3. ⏭️ Deploy staging backend to your hosting platform
4. ⏭️ Update frontend staging environment to point to staging backend
5. ⏭️ Test the full staging environment

## 📞 Troubleshooting

### "MongoServerError: bad auth"
- Check your credentials in the `.env.*` files
- Verify Atlas user has access to all databases

### "Database not showing in Atlas"
- Make sure you've started the backend and it connected successfully
- Create at least one document (databases appear after first write)

### "Wrong database being used"
- Check `NODE_ENV` environment variable
- Look at server startup logs to see which .env file was loaded
- Verify the DBURI in your .env file

### "Can't connect to database"
- Check your IP is whitelisted in MongoDB Atlas
- Verify cluster is running (not paused)
- Test connection string in MongoDB Compass
