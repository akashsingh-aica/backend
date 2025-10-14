# Git Workflow Guide for Trading Application

## 📋 Repository Setup

Your trading application is now a Git repository with:
- ✅ Initial commit with all source code
- ✅ Comprehensive `.gitignore` for Node.js projects
- ✅ Environment template (`.env.example`)
- ✅ Complete documentation

## 🌿 Branching Strategy

### **Main Branch**
- `main` - Production-ready code
- Always stable and deployable
- Protected branch (should require PR reviews)

### **Feature Branches**
```bash
# Create feature branch
git checkout -b feature/add-upstox-broker
git checkout -b feature/add-portfolio-analytics
git checkout -b fix/websocket-reconnection

# Work on your feature
git add .
git commit -m "✨ Add Upstox broker integration"

# Push feature branch
git push origin feature/add-upstox-broker
```

### **Release Branches**
```bash
# Create release branch
git checkout -b release/v1.1.0

# Make final adjustments
git commit -m "🔖 Bump version to 1.1.0"

# Merge to main
git checkout main
git merge release/v1.1.0
git tag v1.1.0
```

## 🔄 Development Workflow

### **Daily Development**
```bash
# 1. Start with latest main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Make changes and commit frequently
git add src/brokers/UpstoxBroker.js
git commit -m "✨ Add Upstox broker base implementation"

git add tests/upstox.test.js
git commit -m "🧪 Add Upstox broker tests"

git add README.md
git commit -m "📚 Update README with Upstox setup"

# 4. Push regularly
git push origin feature/your-feature-name

# 5. When ready, merge back to main
git checkout main
git merge feature/your-feature-name
git branch -d feature/your-feature-name
```

## 📝 Commit Message Convention

Use conventional commit format for better changelog generation:

### **Types**
- `✨ feat:` - New feature
- `🐛 fix:` - Bug fix  
- `📚 docs:` - Documentation
- `🧪 test:` - Tests
- `♻️ refactor:` - Code refactoring
- `⚡ perf:` - Performance improvement
- `🔧 chore:` - Build/config changes
- `🎨 style:` - Code style changes

### **Examples**
```bash
git commit -m "✨ feat: add Upstox broker integration"
git commit -m "🐛 fix: resolve WebSocket reconnection issue"
git commit -m "📚 docs: update API documentation"
git commit -m "🧪 test: add authentication service tests"
git commit -m "♻️ refactor: improve error handling in trading service"
git commit -m "⚡ perf: optimize database queries"
git commit -m "🔧 chore: update dependencies"
```

## 🚀 Deployment Workflow

### **Production Deployment**
```bash
# 1. Ensure main is ready
git checkout main
git pull origin main

# 2. Create release tag
git tag -a v1.0.0 -m "🚀 Release v1.0.0: Initial production release"
git push origin v1.0.0

# 3. Deploy using tag
# Your CI/CD pipeline should deploy based on tags
```

## 🛠️ Useful Git Aliases

Set up these aliases for faster development:

```bash
# Add Git aliases
git config alias.co checkout
git config alias.br branch
git config alias.ci commit
git config alias.st status
git config alias.unstage 'reset HEAD --'
git config alias.last 'log -1 HEAD'
git config alias.visual '!gitk'
git config alias.tree 'log --graph --pretty=format:"%h %s" --all'
git config alias.amend 'commit --amend --no-edit'
```

### **Usage Examples**
```bash
git st                    # git status
git co main              # git checkout main
git br feature/new-api   # git branch feature/new-api
git ci -m "fix bug"      # git commit -m "fix bug"
git tree                 # pretty git log tree
git amend                # amend last commit
```

## 🔍 File Management

### **What's Tracked**
- ✅ Source code (`src/`)
- ✅ Documentation (`.md` files)
- ✅ Configuration (`package.json`, etc.)
- ✅ Examples (`examples/`)
- ✅ Environment template (`.env.example`)

### **What's Ignored**
- ❌ Environment file (`.env`) - Contains secrets!
- ❌ Node modules (`node_modules/`)
- ❌ Logs (`*.log`, `logs/`)
- ❌ Build artifacts (`dist/`, `build/`)
- ❌ IDE files (`.vscode/`, `.idea/`)

## 🔐 Security Best Practices

### **Never Commit Secrets**
```bash
# ❌ NEVER do this
git add .env
git commit -m "add environment"

# ✅ Always check what you're committing
git status
git diff --cached

# ✅ Use the template instead
cp .env.example .env
# Then edit .env with real values
```

### **Check for Secrets Before Commit**
```bash
# Check for potential secrets
git diff --cached | grep -i "password\|secret\|key\|token"

# Remove file from staging if it has secrets
git reset HEAD .env
```

## 📊 Repository Maintenance

### **Regular Tasks**
```bash
# Clean up merged branches
git branch --merged | grep -v "main" | xargs -n 1 git branch -d

# Update dependencies
npm update
git add package*.json
git commit -m "⬆️ chore: update dependencies"

# Check repository size
git count-objects -vH

# Cleanup repository
git gc --prune=now
```

### **Backup Important Branches**
```bash
# Create backup tags
git tag backup/main-$(date +%Y%m%d) main
git tag backup/develop-$(date +%Y%m%d) develop

# Push all tags
git push origin --tags
```

## 🔄 Remote Repository Setup

### **GitHub Setup**
```bash
# Add GitHub remote
git remote add origin https://github.com/yourusername/trading-app.git

# Push initial code
git push -u origin main

# Set up branch protection rules on GitHub:
# - Require PR reviews
# - Require status checks
# - Restrict push to main
```

### **Multiple Remotes**
```bash
# Add multiple remotes for backup
git remote add github https://github.com/yourusername/trading-app.git
git remote add gitlab https://gitlab.com/yourusername/trading-app.git

# Push to multiple remotes
git push github main
git push gitlab main
```

## 🧪 Testing Integration

### **Pre-commit Checks**
```bash
# Create pre-commit hook
echo '#!/bin/sh
npm test
npm run lint
' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### **Continuous Integration**
Set up GitHub Actions or similar:
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run lint
```

## 📈 Monitoring Repository Health

### **Repository Statistics**
```bash
# Contributors
git shortlog -sn

# File changes over time
git log --stat

# Code churn
git log --since="1 month ago" --pretty=tformat: --numstat | \
  awk '{ add += $1; subs += $2; loc += $1 - $2 } END \
  { printf "added lines: %s, removed lines: %s, total lines: %s\n", add, subs, loc }'
```

---

## 🎯 Quick Reference

### **Most Used Commands**
```bash
git status                    # Check what's changed
git add .                     # Stage all changes  
git commit -m "message"       # Commit with message
git push                      # Push to remote
git pull                      # Pull latest changes
git checkout -b new-branch    # Create and switch to branch
git merge branch-name         # Merge branch
git log --oneline             # View commit history
```

### **Emergency Commands**
```bash
git stash                     # Temporarily save changes
git stash pop                 # Restore stashed changes
git reset --hard HEAD~1       # Undo last commit (dangerous!)
git checkout -- filename     # Discard file changes
git clean -fd                 # Remove untracked files
```

Remember: Your `.env` file with API keys is safely ignored by Git! 🔐