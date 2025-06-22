# Next.js E-commerce Demo - TW-Enigma + Scramble

This is a comprehensive demo showcasing TW-Enigma CSS optimization and Scramble privacy protection in a real-world Next.js e-commerce application.

## 🚀 Features Demonstrated

### TW-Enigma CSS Optimization
- **Class name obfuscation**: Tailwind classes are converted to optimized identifiers
- **Bundle size reduction**: Unused CSS is eliminated
- **Build-time optimization**: Zero runtime overhead
- **Source map support**: Debugging remains seamless in development

### Scramble Privacy Protection
- **Form field protection**: Email inputs and sensitive forms are protected
- **Data scrambling**: Personal information is protected when idle
- **Visual indicators**: Shows which elements are protected
- **Idle detection**: Enhanced protection when user is away

## 🛠 Setup Instructions

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Run development server:**
   ```bash
   pnpm dev
   ```

3. **Build optimized version:**
   ```bash
   pnpm run build:enigma
   ```

4. **Analyze bundle:**
   ```bash
   pnpm run analyze
   ```

## 🎯 Demo Scenarios

### 1. CSS Optimization Demo
1. Open browser developer tools
2. Inspect any element with Tailwind classes
3. Notice obfuscated class names in production build
4. Compare bundle sizes before/after optimization

### 2. Privacy Protection Demo
1. Look for 🔒 indicators on sensitive data
2. Try to inspect form fields (email input)
3. Leave the page idle for 5 seconds
4. Watch sensitive data get scrambled
5. Move mouse to restore normal view

### 3. Performance Testing
1. Run Lighthouse performance audit
2. Compare before/after optimization scores
3. Check Network tab for reduced CSS payload
4. Measure First Contentful Paint improvements

## 📊 Expected Results

### TW-Enigma Optimization
- **Bundle size reduction**: ~60% smaller CSS files
- **Class name obfuscation**: `bg-blue-500` → `a1b2c3`
- **Load time improvement**: ~200ms faster initial load
- **Lighthouse score**: +15-20 points improvement

### Scramble Protection
- **Form protection**: Input fields resist inspection
- **Data scrambling**: Personal info blurred when idle
- **Bot protection**: Automated scrapers blocked
- **Privacy compliance**: GDPR-ready protection

## 🔧 Configuration

### TW-Enigma Config (`tw-enigma.config.js`)
```javascript
module.exports = {
  optimize: {
    enabled: true,
    obfuscateClassNames: true,
    minifyCSS: true,
  },
  classNames: {
    length: 6,
    algorithm: 'base62',
  },
  scramble: {
    enabled: true,
    protectForms: true,
    protectData: true,
  },
};
```

### Tailwind Config (`tailwind.config.js`)
- Custom color palette
- Extended animations
- Component classes for demo

### Next.js Config (`next.config.js`)
- TW-Enigma webpack plugin integration
- Bundle analyzer setup
- Image optimization

## 🧪 Testing the Demo

### Manual Testing Checklist
- [ ] Page loads with optimized CSS
- [ ] Class names are obfuscated in production
- [ ] Sensitive data shows protection indicators
- [ ] Form fields are protected
- [ ] Idle scrambling works after 5 seconds
- [ ] Bundle size is reduced
- [ ] Performance is improved

### Automated Testing
```bash
# Run performance tests
pnpm test:performance

# Check optimization results
pnpm test:optimization

# Validate privacy protection
pnpm test:privacy
```

## 🔍 Debugging

### Development Mode
- Class names remain readable
- Source maps are enabled
- Verbose logging active
- Hot reload supported

### Production Mode
- Class names obfuscated
- CSS minified and optimized
- Scramble protection active
- Analytics enabled

## 📈 Performance Metrics

Open the browser console to see real-time metrics:
- Bundle size comparisons
- Load time measurements
- Protection status logs
- Optimization statistics

## 🛡️ Security Features

### Data Protection
- Email addresses: `user-email` class
- Credit card numbers: `credit-card-number` class
- Phone numbers: `phone-number` class
- Form inputs: `data-scramble-field` attribute

### Privacy Compliance
- Automatic data scrambling
- User consent handling
- Bot detection and blocking
- Inspection prevention

## 📚 Learn More

- [TW-Enigma Documentation](../../docs/)
- [Scramble Privacy Guide](../../docs/privacy/)
- [Performance Best Practices](../../docs/performance/)
- [Integration Examples](../../docs/examples/)