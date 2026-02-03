# WebView Authentication System

## Overview

The AuraMusic app now includes a WebView-based authentication system that allows users to log in to YouTube Music and extract authentication cookies for API requests.

## Components

### 1. AuthScreen (`src/screens/AuthScreen.tsx`)
- WebView component that loads YouTube Music login page
- Extracts cookies after successful login
- Provides visual feedback and instructions
- Automatically detects when user is logged in

### 2. CookieManager (`src/utils/cookieManager.ts`)
- Manages storage and retrieval of authentication cookies
- Filters important authentication cookies
- Formats cookies for HTTP requests
- Provides utility functions for cookie operations

### 3. CookieViewer (`src/components/CookieViewer.tsx`)
- Displays stored cookies in a user-friendly interface
- Shows authentication status and cookie count
- Allows copying individual cookies or all cookies
- Separates important auth cookies from others

### 4. AuthenticatedHttpClient (`src/utils/authenticatedHttpClient.ts`)
- HTTP client that automatically includes authentication cookies
- Provides methods for authenticated API requests
- Handles YouTube Music API endpoints with proper headers

## How It Works

### Login Process
1. User opens the app and sees the WebView with YouTube Music
2. User signs in with their Google account
3. App detects successful login by monitoring URL changes
4. JavaScript injection extracts all cookies from the browser
5. Important authentication cookies are filtered and stored
6. User is redirected to the main app interface

### Cookie Management
- Cookies are stored securely using AsyncStorage
- Only important authentication cookies are kept:
  - `SAPISID`, `APISID`, `SSID`, `SID`, `HSID`
  - `__Secure-3PAPISID`, `__Secure-3PSID`
  - `LOGIN_INFO`, `VISITOR_INFO1_LIVE`
- Cookies persist between app sessions
- Users can view and copy cookies from the account modal

### API Integration
- All API requests automatically include authentication cookies
- Proper headers are set for YouTube Music compatibility
- Supports authenticated endpoints like user library, playlists, etc.

## Usage

### Installation
```bash
npm install expo-clipboard
```

### Viewing Cookies
1. Log in through the WebView
2. Navigate to any screen in the app
3. Tap the account icon in the header
4. Tap "View Cookies" to see all stored cookies
5. Copy individual cookies or all cookies to clipboard

### Making Authenticated Requests
```typescript
import { AuthenticatedHttpClient } from '../utils/authenticatedHttpClient';

// Search with authentication
const results = await AuthenticatedHttpClient.searchWithAuth('query');

// Get user library
const library = await AuthenticatedHttpClient.getUserLibrary();

// Get recommendations
const recommendations = await AuthenticatedHttpClient.getRecommendations();
```

## Security Considerations

### Cookie Storage
- Cookies are stored locally on the device
- No cookies are transmitted to external servers
- Cookies are automatically cleared on logout

### WebView Security
- WebView loads only YouTube Music domains
- JavaScript injection is minimal and focused
- No sensitive data is exposed to the app

### API Requests
- All requests use HTTPS
- Proper User-Agent and headers are set
- Cookies are only sent to YouTube Music domains

## Features

### Authentication Status
- Real-time authentication status display
- Cookie count and validity tracking
- Automatic session restoration on app restart

### Cookie Management
- View all stored cookies
- Copy cookies for debugging
- Clear cookies on logout
- Filter important authentication cookies

### WebView Features
- Full YouTube Music interface
- Refresh functionality
- Manual cookie extraction
- URL monitoring and feedback

## Troubleshooting

### Login Issues
- Ensure stable internet connection
- Try refreshing the WebView
- Clear app data if cookies are corrupted
- Check if YouTube Music is accessible in browser

### Cookie Problems
- Verify cookies are being extracted (check account modal)
- Ensure important cookies are present (SAPISID, etc.)
- Try logging out and logging in again
- Check cookie expiration dates

### API Request Failures
- Verify authentication cookies are valid
- Check network connectivity
- Ensure proper headers are being sent
- Try refreshing authentication

## Development Notes

### Testing Authentication
```typescript
// Check if user is authenticated
const { isAuthenticated, cookies } = useAuth();

// Get cookie count
console.log(`Stored cookies: ${cookies.length}`);

// Test authenticated request
try {
  const response = await AuthenticatedHttpClient.getUserLibrary();
  console.log('Authentication successful');
} catch (error) {
  console.log('Authentication failed:', error);
}
```

### Cookie Debugging
- Use the CookieViewer component to inspect cookies
- Copy cookies to external tools for testing
- Monitor network requests in development
- Check cookie expiration and validity

## Future Enhancements

1. **Automatic Cookie Refresh**: Detect expired cookies and prompt re-authentication
2. **Multiple Account Support**: Allow switching between different YouTube Music accounts
3. **Cookie Encryption**: Add encryption for stored cookies
4. **Background Sync**: Sync user data in background using authenticated requests
5. **Offline Mode**: Cache authenticated data for offline usage