# Environment Setup Guide

## Repository Structure

Your project is now set up with three distinct environments:

### 🟢 Production (main branch)
- **Branch:** `main`
- **Purpose:** Live production environment
- **Deployment:** Deploy to production servers
- **Repository:** https://github.com/onling-git/thereplay.app

### 🟡 Staging (staging branch)
- **Branch:** `staging`
- **Purpose:** Pre-production testing environment
- **Deployment:** Deploy to staging servers for QA
- **Repository:** https://github.com/onling-git/thereplay.app

### 🔵 Local Development
- **Branch:** Any feature branch (create from `staging`)
- **Purpose:** Local development and testing
- **Environment:** Your local machine

## Workflow

### 1. Development Workflow
```bash
# Start new feature from staging
git checkout staging
git pull origin staging
git checkout -b feature/your-feature-name

# Make your changes and commit
git add .
git commit -m "Your commit message"

# Push feature branch
git push origin feature/your-feature-name
```

### 2. Move to Staging
```bash
# Merge feature to staging
git checkout staging
git pull origin staging
git merge feature/your-feature-name
git push origin staging

# Test on staging environment
```

### 3. Move to Production
```bash
# After staging approval, merge to main
git checkout main
git pull origin main
git merge staging
git push origin main

# Deploy to production
```

## Quick Commands

### Switch Environments
```bash
# Go to production
git checkout main

# Go to staging
git checkout staging

# Go back to your feature
git checkout feature/your-feature-name
```

### Check Current Branch
```bash
git branch
git status
```

### Update from Remote
```bash
git pull origin main      # Update production
git pull origin staging   # Update staging
```

## Best Practices

1. **Never commit directly to `main`** - Always go through staging first
2. **Test thoroughly in staging** before promoting to production
3. **Use feature branches** for all development work
4. **Keep staging in sync** with main before starting new features
5. **Use descriptive branch names**: `feature/add-user-auth`, `bugfix/fix-login`, etc.

## Environment Variables

Make sure to set up environment-specific variables:

- **Local:** Use `.env` files (already in `.gitignore`)
- **Staging:** Configure staging server with staging credentials
- **Production:** Configure production server with production credentials

## Folder Structure

```
thefinalplay.com/
├── backend/          # Node.js backend API
├── frontend/         # React frontend
└── ENVIRONMENT_SETUP.md
```

Both `backend` and `frontend` folders exist in all branches (main, staging, and your feature branches).

## Security Note

⚠️ **Important:** Never commit API keys or secrets to the repository. Use environment variables and `.env` files (which are already in `.gitignore`).
