# Phase 2 & 3 Implementation Plan
**ChefSire - Social Explosion & Power User Features**

---

## Phase 2: "Social Explosion Bundle"

### 1. Cook Together Live Sessions 🎥
**Backend:**
- WebSocket room management for live sessions
- Session state management (active users, current step, timer sync)
- Video/audio stream coordination (WebRTC signaling)
- Session recording storage
- "Cook Together" badges/achievements

**Frontend:**
- Live session creation UI
- Real-time participant list
- Synchronized recipe steps display
- Group timer countdown
- Live chat during session
- End-of-session group photo
- Session replay viewer

**Database Schema:**
```sql
cook_together_sessions (
  id, recipe_id, host_user_id,
  started_at, ended_at, max_participants,
  status, recording_url
)
cook_together_participants (
  id, session_id, user_id,
  joined_at, left_at, completed
)
```

---

### 2. Recipe Duets/Reactions 📹
**Backend:**
- Duet video upload/processing
- Reaction video storage
- Link duets to original recipes
- Duet notification system
- Duet feed/discovery

**Frontend:**
- "Create Duet" button on recipes
- Side-by-side duet viewer
- Reaction recording UI
- Duet gallery on recipe page
- Duet notifications

**Database Schema:**
```sql
recipe_duets (
  id, original_recipe_id, original_user_id,
  duet_user_id, duet_video_url, duet_image_url,
  caption, created_at, likes_count
)
```

---

### 3. Seasonal Events & Leaderboards 🏆
**Backend:**
- Seasonal event management system
- Event-specific leaderboards
- Automatic event rotation (cron job)
- Event participation tracking
- Event rewards distribution
- Weather API integration for smart events

**Frontend:**
- Current events banner/card
- Event details page
- Live leaderboard with real-time updates
- Event progress tracker
- "Join Event" CTA
- Event history archive
- Event countdown timers

**Database Schema:**
```sql
seasonal_events (
  id, slug, title, description,
  event_type, start_date, end_date,
  rules_json, rewards_json,
  image_url, is_active
)
event_participants (
  id, event_id, user_id,
  score, rank, joined_at,
  completed, reward_claimed
)
event_leaderboard (
  id, event_id, user_id,
  points, rank, last_updated
)
```

---

### 4. Enhanced Community Competitions 🎯
**Backend:**
- Competition voting system
- Judge panel support
- Competition categories
- Prize distribution
- Competition analytics

**Frontend:**
- Competition browse/filter
- Submission gallery with voting
- Judge dashboard
- Winner announcements
- Competition templates

**Database Schema:**
```sql
competition_votes (
  id, competition_id, entry_id,
  user_id, vote_type, score
)
competition_judges (
  id, competition_id, user_id,
  is_lead_judge, specialty
)
```

---

## Phase 3: "Power User Bundle"

### 1. Advanced Analytics Dashboard 📊
**Backend:**
- User stats aggregation service
- Time-series data collection
- Nutrition trends calculation
- Taste profile analysis
- Cost tracking per recipe
- Performance metrics

**Frontend:**
- Interactive charts (Chart.js/Recharts)
- Nutrition heatmap calendar
- Taste profile radar chart
- Ingredient usage breakdown
- Cost analysis graphs
- Time-based insights
- Export reports (PDF/CSV)

**Database Schema:**
```sql
user_analytics (
  id, user_id, date,
  total_recipes_made, total_calories,
  total_protein, total_carbs, total_fat,
  most_used_ingredient, avg_prep_time,
  total_cost, recipes_by_category_json
)
taste_profiles (
  id, user_id,
  sweet_score, salty_score, sour_score,
  bitter_score, umami_score, spicy_score,
  preferred_categories, avoided_ingredients
)
```

---

### 2. Health App Integration 🏃
**Backend:**
- Apple HealthKit API integration
- Google Fit API integration
- Fitbit API integration
- MyFitnessPal API integration
- Nutrition data sync service
- OAuth flow for health apps

**Frontend:**
- Connected apps page
- Health app authorization flow
- Sync status indicators
- Auto-log nutrition toggle
- Import workout data view
- Sleep/activity correlation view

**Database Schema:**
```sql
health_integrations (
  id, user_id, provider,
  access_token, refresh_token,
  connected_at, last_sync,
  is_active, sync_settings_json
)
health_sync_log (
  id, user_id, provider,
  sync_type, data_points,
  synced_at, status, error_msg
)
```

---

### 3. Smart Notifications System 🔔
**Backend:**
- Context-aware notification engine
- User behavior analysis
- Notification scheduling
- Push notification service (FCM/APNS)
- Email digests
- Smart timing algorithm

**Frontend:**
- Notification preferences UI
- Real-time notification center
- In-app notification toasts
- Notification history
- Mute/snooze controls

**Enhancement to existing notifications table:**
```sql
ALTER TABLE notifications ADD COLUMN context_data JSONB;
ALTER TABLE notifications ADD COLUMN scheduled_for TIMESTAMP;
ALTER TABLE notifications ADD COLUMN delivery_method VARCHAR(20);
```

---

## Implementation Order (Most Impact First)

### Sprint 1: Social Foundation (Week 1)
1. ✅ Recipe Duets backend + frontend (high viral potential)
2. ✅ Seasonal Events system (drives daily engagement)
3. ✅ Enhanced leaderboards (gamification boost)

### Sprint 2: Advanced Features (Week 2)
4. ✅ Advanced Analytics Dashboard (power user retention)
5. ✅ Smart Notifications (re-engagement)
6. ✅ Competition enhancements (community building)

### Sprint 3: Live & Integration (Week 3)
7. ✅ Cook Together sessions (premium feature)
8. ✅ Health app integration prep (technical foundation)

---

## Technical Stack

**Real-time Features:**
- Socket.io (already installed)
- WebRTC for video (simple-peer or PeerJS)

**Charts/Visualizations:**
- Recharts or Chart.js
- react-calendar-heatmap

**Video Processing:**
- FFmpeg for server-side processing
- Cloudinary or AWS S3 for storage

**Push Notifications:**
- Firebase Cloud Messaging (FCM)
- Service Workers for web push

**Health APIs:**
- Apple HealthKit (iOS native)
- Google Fit REST API
- Fitbit Web API
- MyFitnessPal Partner API

---

## Database Migration Plan

**Migration File:** `0002_phase2_social_explosion.sql`
- cook_together_sessions, participants
- recipe_duets
- seasonal_events, event_participants, event_leaderboard
- competition_votes, competition_judges

**Migration File:** `0003_phase3_power_user.sql`
- user_analytics
- taste_profiles
- health_integrations, health_sync_log
- Enhanced notifications

---

## Let's Build! 🚀

Starting with highest-impact, easiest-to-implement features first:
1. **Recipe Duets** (viral social feature)
2. **Seasonal Events** (immediate engagement)
3. **Analytics Dashboard** (power user love)

Ready to start coding!
