# Real-Time Workout Status Feature

This feature adds real-time user presence and workout status tracking to the Pulse app. Users can see:
- Online/Offline status of other users
- Who is currently working out
- Live workout progress (duration, current exercise, exercises completed)

## Setup Instructions

### 1. Database Migration

Run the SQL migration in your Supabase SQL editor:

```bash
# The migration file is located at:
Pulse/supabase_migration_presence.sql
```

This will:
- Create the `presence` table
- Set up Row Level Security policies
- Enable real-time subscriptions
- Add necessary indexes

### 2. Enable Realtime in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Database** → **Replication**
3. Make sure the `presence` table is added to the publication (should be automatic via the migration)

### 3. Test the Feature

The feature is now fully integrated! Here's how it works:

#### When You Start a Workout:
1. Go to any workout day
2. Click "Start Workout"
3. Your status automatically changes to "Working out" 🟡
4. Your workout data (duration, current exercise, progress) is broadcast in real-time

#### When Others View Your Profile:
- They'll see your online status (green dot = online, gray = offline, yellow pulsing = working out)
- If you're working out, they'll see:
  - Workout name
  - Current exercise
  - Live duration timer (updates every second)
  - Progress (X/Y exercises done)
  - Progress bar

#### When You Complete or Stop:
- Your status automatically returns to "Online"
- Workout data is cleared

## How It Works

### Architecture

1. **Presence Provider** (`src/lib/presenceProvider.jsx`)
   - Manages presence heartbeats (every 2 minutes)
   - Handles online/offline status
   - Updates workout status in real-time

2. **Timer Integration** (`src/lib/timer.jsx`)
   - Tracks when workouts start/stop
   - Pushes workout data to presence
   - Updates current exercise as you progress

3. **Real-time Subscriptions** (`src/lib/presence.js`)
   - Subscribes to presence changes via Supabase Realtime
   - Updates UI instantly when someone's status changes

4. **UI Components**
   - `UserStatus`: Shows online/offline/working out badge
   - `WorkoutStatusCard`: Shows live workout details with timer

### Data Flow

```
User starts workout
    ↓
Timer sets session.startedAt
    ↓
Presence provider detects session change
    ↓
Updates presence table in Supabase
    ↓
Supabase Realtime broadcasts change
    ↓
Other users' ProfileView components receive update
    ↓
UI updates instantly with live data
```

## Privacy

- All presence data is publicly readable (for leaderboard features)
- Users can only update their own presence
- Workout data is cleared when the workout ends or app closes
- No sensitive personal information is shared

## Features

✅ Real-time online/offline status  
✅ Live "Working out" indicator  
✅ Current exercise display  
✅ Live workout duration timer  
✅ Progress tracking (X/Y exercises)  
✅ Progress bar visualization  
✅ Automatic status updates  
✅ Presence heartbeat (stays accurate)  
✅ Graceful offline handling  

## Testing Checklist

- [ ] Run the database migration
- [ ] Start a workout and verify status changes to "Working out"
- [ ] Open your profile in another browser/device - see live workout data
- [ ] Watch the duration timer update every second
- [ ] Complete exercises and see progress update in real-time
- [ ] Stop/complete workout and verify status returns to "Online"
- [ ] Close the app and verify status changes to "Offline"

## Troubleshooting

**Status not updating?**
- Check that the migration ran successfully
- Verify Realtime is enabled in Supabase for the `presence` table
- Check browser console for errors

**Timer not counting?**
- Make sure `session.startedAt` is set when starting a workout
- Check that the presence heartbeat is running (console logs)

**Other users can't see your status?**
- Verify you're signed in
- Check that RLS policies are correct (run migration again if needed)
- Ensure the presence table exists

## Future Enhancements

Potential additions:
- Workout feed (see friends' recent workouts)
- Workout notifications ("John just started Push Day!")
- Social features (like/comment on workouts)
- Leaderboard filtering (show only online users)
- Status messages ("Crushing leg day 💪")
