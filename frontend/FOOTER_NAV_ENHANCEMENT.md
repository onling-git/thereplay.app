# FooterNav Enhancement: Favorite Team Integration

This update enhances the FooterNav component to display the user's favorite team instead of the generic "Matches" option when they are logged in.

## Changes Made

### 1. New Hook: `useFavoriteTeam.js`
- **Location**: `src/hooks/useFavoriteTeam.js`
- **Purpose**: Custom hook to fetch and manage the user's favorite team data
- **Features**:
  - Automatically fetches favorite team data when user is authenticated
  - Returns team object with `name`, `slug`, `image_path` properties
  - Handles loading states and error conditions
  - Optimized to only fetch data when needed

### 2. Updated Component: `FooterNav.jsx`
- **Location**: `src/components/FooterNav/FooterNav.jsx`
- **Changes**:
  - Integrated with `AuthContext` to check authentication status
  - Uses `useFavoriteTeam` hook to get favorite team data
  - Conditionally renders favorite team option:
    - **When logged in with favorite team**: Shows team badge and name, links to `/:teamSlug`
    - **When not logged in or no favorite team**: Hides the option completely
  - Includes fallback image handling for team badges
  - Maintains active state highlighting for navigation

### 3. Enhanced Styling: `footernav.css`
- **Location**: `src/components/FooterNav/footernav.css`
- **Improvements**:
  - Added text overflow handling for long team names
  - Set maximum width for footer labels to prevent layout breaking
  - Reduced font size slightly for better fit

## User Experience

### For Authenticated Users with Favorite Team:
- See their favorite team's badge in the footer navigation
- Click to navigate directly to their team's overview page (`/:teamSlug`)
- Team name is displayed with ellipsis if too long
- Active state highlighting when on team page

### For Non-Authenticated Users:
- The favorite team option is completely hidden
- Footer shows 4 options instead of 5: Trending, Home, Watchlist, News
- Clean, uncluttered navigation experience

### For Authenticated Users without Favorite Team:
- Similar to non-authenticated users - option is hidden
- Can set favorite team through account/team preferences

## Technical Implementation

### Data Flow:
1. `AuthContext` provides user authentication state and user data
2. `useFavoriteTeam` hook checks if user is authenticated and has `favourite_team` ID
3. Hook calls `getTeams` API to fetch team data and finds matching favorite team
4. `FooterNav` conditionally renders team option based on hook data

### API Dependencies:
- `getTeams()` - Fetches list of teams to match favorite team ID
- Team data includes: `id`, `name`, `slug`, `image_path`, `short_code`

### Performance Considerations:
- Team data is cached by the hook and only refetches when user changes
- API call only made when user is authenticated with a favorite team
- Graceful degradation when API calls fail

## Testing Scenarios

1. **Logged out user**: Footer should show 4 options (no favorite team option)
2. **Logged in user with favorite team**: Footer shows 5 options including favorite team
3. **Logged in user without favorite team**: Footer shows 4 options
4. **Team image load failure**: Should fallback to default Southampton logo
5. **Long team names**: Should truncate with ellipsis
6. **Navigation**: Clicking favorite team should navigate to `/:teamSlug`
7. **Active states**: Should highlight when on favorite team page

## Future Enhancements

- Add loading skeleton for favorite team option while fetching
- Consider caching team data in localStorage for better performance
- Add ability to quickly change favorite team from footer (long press menu)
- Support for multiple favorite teams in future iterations