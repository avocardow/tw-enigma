# TW-Enigma Demo Features Guide

This Next.js shop demonstrates TW-Enigma's CSS optimization and Scramble privacy protection features.

## 🚀 How to Run

```bash
cd examples/real-world-demo/nextjs-shop
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔒 Scramble Privacy Protection Features

### Development Mode Enhancements

When running in development (`pnpm dev`), you'll see enhanced debugging features:

1. **Visual Protection Indicators**: Protected elements show `🔒DEV` badges
2. **Enhanced Console Logging**: Detailed initialization and protection logs
3. **Shorter Timeouts**: 3-second idle timeout for easier testing
4. **Click-to-Debug**: Click on protection indicators to see debug info

### Features You Can Test

#### 1. **Sensitive Data Protection**

- Navigate to the "Scramble Demo" tab
- Look for elements with `🔒DEV` indicators
- Protected data includes:
  - Email addresses
  - Phone numbers
  - Credit card numbers
  - Addresses
  - Financial information

#### 2. **Form Field Protection**

- Go to the "Forms" tab
- The email input field is protected with `data-scramble-field`
- Focus/blur events are logged to console
- Form data is automatically protected during input

#### 3. **Idle Detection & Auto-Scramble**

- Stop interacting with the page for 3 seconds
- Protected elements will blur automatically
- Move mouse, click, or press any key to remove the blur
- Console logs will show idle detection events

#### 4. **Development Console**

Open browser console (F12) to see:

```
🔒 TW-Enigma Scramble - Development Mode
✅ Scramble Privacy Protection Initialized
⚙️ Config: {...}
🎯 Discovered CSS rules: X
📝 Registry built with classes: Y
🔧 Development features enabled:
   - Shorter idle timeout (3s)
   - Faster scramble animations
   - Visible protection indicators
   - Debug logging enabled
```

## ⚙️ TW-Enigma CSS Optimization

### Webpack Integration

The Next.js configuration includes TW-Enigma webpack plugin:

**Development Mode:**

- Source maps enabled
- No CSS minification
- No obfuscation
- Debug logging enabled
- Low security level for easier debugging

**Production Mode:**

- CSS minification enabled
- Full obfuscation active
- No source maps
- Medium security level

### Environment Variables

The following environment variables are available:

- `TW_ENIGMA_ENABLED=true`
- `SCRAMBLE_ENABLED=true`
- `SCRAMBLE_DEBUG=true` (in development)

## 🎯 Testing Different Scenarios

### Test Idle Protection

1. Open the page
2. Don't interact for 3 seconds
3. Watch protected elements blur
4. Move mouse to restore

### Test Form Protection

1. Go to Forms tab
2. Focus on email input
3. Check console for protection logs
4. Test blur events

### Test Development Debugging

1. Click on any `🔒DEV` indicator
2. Check console for element debug info
3. Inspect protection configuration

### Test Different Security Levels

The app automatically uses different settings for dev vs production:

- **Dev**: Low security, fast animations, debug features
- **Production**: Medium security, optimized performance

## 🔧 Configuration

### Scramble Configuration

Located in `src/components/ScrambleProvider.tsx`:

```typescript
const defaultConfig = {
  enabled: true,
  protectForms: true,
  protectData: true,
  idleTimeout: isDev ? 3000 : 5000,
  scrambleDelay: isDev ? 50 : 100,
  securityLevel: isDev ? 'low' : 'medium',
  preserveSourceMaps: isDev,
  enableObfuscation: !isDev,
  scrambleClassNames: true,
  scrambleVariables: !isDev,
};
```

### Next.js Configuration

Located in `next.config.js`:

```javascript
new TwEnigmaWebpackPlugin({
  enabled: true,
  obfuscate: dev ? false : true,
  minifyCSS: dev ? false : true,
  generateSourceMaps: dev ? true : false,
  scramble: {
    enabled: true,
    protectForms: true,
    protectData: true,
    securityLevel: dev ? 'low' : 'medium',
  },
  debug: dev,
});
```

## 🚨 What to Look For

1. **Console Messages**: Rich debugging output showing initialization
2. **Visual Indicators**: `🔒DEV` badges on protected elements
3. **Idle Blur Effect**: Elements blur after 3 seconds of inactivity
4. **Form Logging**: Input focus/blur events logged to console
5. **Click Debugging**: Click protection indicators for element details

## 📱 Browser Support

The demo works in all modern browsers. For best experience:

- Chrome/Edge/Safari: Full feature support
- Firefox: Full feature support
- Mobile browsers: Core features supported

## 🎨 Styling Notes

Protected elements receive:

- `data-scramble-protected="true"` attribute
- Visual protection indicators positioned absolutely
- Development indicators use orange background (`#f59e0b`)
- Production indicators use green background (`#10b981`)

This demonstrates how TW-Enigma and Scramble work together to provide CSS optimization and privacy protection in a real-world application.
