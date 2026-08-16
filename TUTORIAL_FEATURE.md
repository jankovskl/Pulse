# Tutorial Feature Documentation

## Overview

An interactive onboarding tutorial that guides new users through the Pulse app on their first visit, showing them where everything is and how to use key features.

## Features

✅ **8-Step Interactive Tour**
- Welcome screen
- Home/Workout Split explanation
- Rest Timer overview
- Progress tracking
- Leaderboard & social features
- Calendar scheduling
- Settings customization
- Completion message

✅ **Smart Highlighting**
- Automatic element targeting
- Smooth scrolling to elements
- Highlighted outlines on target elements
- Semi-transparent overlay to focus attention

✅ **Progress Tracking**
- Visual progress dots showing current step
- Step counter (1/8, 2/8, etc.)
- Completed steps shown in green

✅ **User Controls**
- Skip button on all steps (except first/last)
- Close button (X) to exit anytime
- Next/Continue button
- "Let's Go" on first step, "Get Started" on last

✅ **Persistent State**
- Only shows once per user (stored in localStorage)
- Can be restarted from Settings
- Survives page refreshes

## How It Works

### First-Time Experience

1. User opens the app for the first time
2. Tutorial automatically appears with welcome message
3. User clicks "Let's Go" to start the tour
4. Tutorial highlights each section with tooltips
5. User clicks "Next" to progress through steps
6. Tutorial completes with "Get Started" button
7. Tutorial is marked as completed (won't show again)

### Tutorial Steps

```javascript
1. Welcome - Center modal introducing the app
2. Home - Highlights workout split section
3. Timer - Points to timer tab in navigation
4. Progress - Points to progress tab
5. Leaderboard - Points to leaderboard tab
6. Calendar - Points to calendar tab
7. Settings - Points to settings tab
8. Complete - Final encouragement message
```

### Restart Tutorial

Users can restart the tutorial anytime from:
**Settings → Restart Tutorial**

This will:
1. Clear the completion flag
2. Reload the page
3. Show the tutorial again

## Implementation Details

### Files Created

1. **`src/components/Tutorial.jsx`**
   - Main tutorial component
   - Step management logic
   - Tooltip positioning
   - `useTutorial()` hook for state management

### Files Modified

1. **`src/components/ui.jsx`**
   - Added `data-tutorial` attributes to TabDock buttons
   - Added `data-tutorial` attributes to Sidebar buttons

2. **`src/screens/HomeScreen.jsx`**
   - Added `data-tutorial="home-screen"` to main container

3. **`src/screens/SettingsScreen.jsx`**
   - Added "Restart Tutorial" option
   - Added HelpCircle icon import

4. **`src/App.jsx`**
   - Imported Tutorial component and useTutorial hook
   - Integrated tutorial into Router
   - Added first-time detection logic

### Data Attributes

Tutorial targets elements using `data-tutorial` attributes:

```html
<!-- Navigation tabs -->
<button data-tutorial="home-tab">Home</button>
<button data-tutorial="timer-tab">Timer</button>
<button data-tutorial="progress-tab">Progress</button>
<button data-tutorial="leaderboard-tab">Leaderboard</button>
<button data-tutorial="calendar-tab">Calendar</button>
<button data-tutorial="settings-tab">Settings</button>

<!-- Home screen -->
<div data-tutorial="home-screen">...</div>
```

### LocalStorage Key

```javascript
'pulse.tutorial.completed'
```

When this key exists, tutorial won't show automatically.

## Customization

### Adding New Steps

Edit `TUTORIAL_STEPS` array in `Tutorial.jsx`:

```javascript
{
  id: 'step-id',
  title: 'Step Title',
  description: 'Step description explaining what this does',
  target: '[data-tutorial="element-id"]', // CSS selector or null for center
  position: 'top', // 'top', 'bottom', or 'center'
}
```

### Changing Tutorial Text

All text is in the `TUTORIAL_STEPS` array - easy to modify or translate.

### Styling

Tutorial uses your app's theme variables:
- `--color-accent` for highlights and buttons
- `--color-ink` for titles
- `--color-sub` for descriptions
- Responsive design works on all screen sizes

## User Flow Diagram

```
User opens app
    ↓
Check localStorage for 'pulse.tutorial.completed'
    ↓
    ├─ Exists → Skip tutorial, show app normally
    ↓
    └─ Doesn't exist → Show tutorial
           ↓
       User completes or skips tutorial
           ↓
       Set 'pulse.tutorial.completed' = true
           ↓
       Show app normally
```

## Testing

### Test First-Time Experience
1. Clear localStorage: `localStorage.removeItem('pulse.tutorial.completed')`
2. Refresh page
3. Tutorial should appear automatically

### Test Skip Function
1. Start tutorial
2. Click X or Skip button
3. Tutorial should close
4. Tutorial should not appear again on refresh

### Test Restart from Settings
1. Go to Settings
2. Click "Restart Tutorial"
3. Page reloads
4. Tutorial appears again

## Browser Compatibility

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (iOS/macOS)
- ✅ Mobile browsers
- ✅ Progressive Web App (PWA)

## Accessibility

- Keyboard navigation support
- Focus management
- Click outside to close
- Clear visual hierarchy
- Readable font sizes

## Future Enhancements

Potential additions:
- Context-aware tips (show tips based on user actions)
- Video walkthroughs embedded in steps
- Interactive exercises ("Try creating a workout now!")
- Multiple tutorial tracks (beginner, advanced, specific features)
- Analytics to see where users drop off
- Skip option with "Don't show again" checkbox
- Tutorial progress saved per step (resume where you left off)
- Tooltips for specific features (mini-tutorials on demand)

## Tips for Maintaining

1. **Keep it short** - 5-8 steps maximum
2. **Update when UI changes** - Tutorial should match current app
3. **Test on mobile** - Different screen sizes need different positioning
4. **Clear language** - Avoid jargon, use simple words
5. **One concept per step** - Don't overwhelm with too much info

## Troubleshooting

**Tutorial not appearing?**
- Check localStorage: `localStorage.getItem('pulse.tutorial.completed')`
- Should be `null` or not exist for tutorial to show

**Elements not highlighting?**
- Check `data-tutorial` attribute exists
- Verify CSS selector in `TUTORIAL_STEPS`
- Check browser console for errors

**Tooltip position wrong?**
- Adjust `position` in step config ('top', 'bottom', 'center')
- Check element visibility and scroll position

**Tutorial stuck on a step?**
- User can always skip with X button or Skip button
- Tutorial state is cleared on completion
