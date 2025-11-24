# Database Setup Instructions

## Syncing Schema Changes

When new tables or columns are added to the schema, you need to push these changes to your database.

### For Development (Local)

1. Ensure you have a `server/.env` file with your `DATABASE_URL`:
   ```bash
   DATABASE_URL=postgresql://user:password@host/database?sslmode=require
   ```

2. Run the migration:
   ```bash
   npm run db:push
   ```

### For Production (Plesk)

1. SSH into your Plesk server or use the Node.js app terminal

2. Navigate to your app directory:
   ```bash
   cd /var/www/vhosts/yourdomain.com/httpdocs
   ```

3. Ensure DATABASE_URL is set in Plesk environment variables:
   - Go to Plesk → Node.js → Custom environment variables
   - Add/verify `DATABASE_URL` is set

4. Run the migration:
   ```bash
   npm run db:push
   ```

## Recent Schema Changes

### Phase 1 Features (AI Suggestions, Quests, Achievements)

New tables added:
- `ai_suggestions` - Personalized daily drink suggestions
- `notifications` - User notifications system
- `daily_quests` - Daily challenges
- `quest_progress` - User quest completion tracking
- `recipe_remixes` - User recipe variations
- `achievements` - Achievement definitions
- `user_achievements` - User achievement progress

### Competitions System

New tables added:
- `competitions` - Competition details (with `videoRoomUrl` field)
- `competition_participants` - Participant submissions
- `competition_votes` - Spectator voting

### User Features

New fields added to `users` table:
- `isAdmin` - Admin user flag (for restricted operations)

## Troubleshooting

### Error: "relation does not exist"

This means the table hasn't been created in your database yet. Run `npm run db:push` to sync the schema.

### Error: "DATABASE_URL is not set"

For development: Create `server/.env` with your database connection string.

For production: Set the environment variable in Plesk or your hosting control panel.

### Graceful Degradation

The application is designed to handle missing tables gracefully:
- AI Suggestions: Returns empty array if table doesn't exist
- Competitions: Returns 404 if tables aren't initialized
- Feed: Falls back to demo data if queries fail

This allows the app to run even if some features aren't fully initialized yet.
