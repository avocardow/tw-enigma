import type { AppProps } from 'next/app';
import { useState, useEffect } from 'react';
import Head from 'next/head';

// Mock global styles import (would be real in actual Next.js app)
// import '../styles/globals.css';

interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
}

const themes: Record<string, Theme> = {
  light: {
    name: 'Light',
    colors: {
      primary: 'bg-blue-600 text-white',
      secondary: 'bg-gray-100 text-gray-900',
      background: 'bg-white text-gray-900',
      text: 'text-gray-900'
    }
  },
  dark: {
    name: 'Dark',
    colors: {
      primary: 'bg-purple-600 text-white',
      secondary: 'bg-gray-800 text-gray-100',
      background: 'bg-gray-900 text-gray-100',
      text: 'text-gray-100'
    }
  },
  ocean: {
    name: 'Ocean',
    colors: {
      primary: 'bg-teal-600 text-white',
      secondary: 'bg-blue-50 text-blue-900',
      background: 'bg-blue-950 text-blue-50',
      text: 'text-blue-50'
    }
  }
};

function MyApp({ Component, pageProps }: AppProps) {
  const [currentTheme, setCurrentTheme] = useState('light');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const addNotification = (message: string) => {
    setNotifications(prev => [...prev, message]);
    setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 3000);
  };

  const theme = themes[currentTheme];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mb-8"></div>
          <h1 className="text-4xl font-bold text-white mb-4">Loading Application</h1>
          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-75"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-150"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Complex Next.js App</title>
        <meta name="description" content="A complex Next.js application with extensive Tailwind CSS usage" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={`min-h-screen transition-all duration-300 ${theme.colors.background}`}>
        {/* Navigation */}
        <nav className={`sticky top-0 z-50 backdrop-blur-md border-b shadow-lg ${
          currentTheme === 'light' 
            ? 'bg-white/95 border-gray-200' 
            : currentTheme === 'dark'
              ? 'bg-gray-900/95 border-gray-700'
              : 'bg-blue-950/95 border-blue-800'
        }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo */}
              <div className="flex-shrink-0">
                <h1 className={`text-2xl font-bold bg-gradient-to-r ${
                  currentTheme === 'light'
                    ? 'from-blue-600 to-purple-600'
                    : currentTheme === 'dark'
                      ? 'from-purple-400 to-pink-400'
                      : 'from-teal-400 to-blue-400'
                } bg-clip-text text-transparent`}>
                  NextApp
                </h1>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  {['Home', 'About', 'Services', 'Contact'].map((item) => (
                    <a
                      key={item}
                      href={`/${item.toLowerCase()}`}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        theme.colors.text
                      } hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        currentTheme === 'light'
                          ? 'hover:bg-gray-100 focus:ring-blue-500'
                          : currentTheme === 'dark'
                            ? 'hover:bg-gray-800 focus:ring-purple-500'
                            : 'hover:bg-blue-900 focus:ring-teal-500'
                      }`}
                    >
                      {item}
                    </a>
                  ))}
                </div>
              </div>

              {/* Theme Selector & Mobile Menu Button */}
              <div className="flex items-center space-x-4">
                {/* Theme Selector */}
                <div className="relative">
                  <select
                    value={currentTheme}
                    onChange={(e) => {
                      setCurrentTheme(e.target.value);
                      addNotification(`Switched to ${themes[e.target.value].name} theme`);
                    }}
                    className={`appearance-none rounded-lg px-4 py-2 pr-8 text-sm font-medium border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      currentTheme === 'light'
                        ? 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-blue-500'
                        : currentTheme === 'dark'
                          ? 'bg-gray-800 border-gray-600 text-gray-100 focus:ring-purple-500'
                          : 'bg-blue-900 border-blue-700 text-blue-100 focus:ring-teal-500'
                    }`}
                  >
                    {Object.entries(themes).map(([key, theme]) => (
                      <option key={key} value={key}>
                        {theme.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Mobile menu button */}
                <div className="md:hidden">
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className={`inline-flex items-center justify-center p-2 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      theme.colors.text
                    } ${
                      currentTheme === 'light'
                        ? 'hover:bg-gray-100 focus:ring-blue-500'
                        : currentTheme === 'dark'
                          ? 'hover:bg-gray-800 focus:ring-purple-500'
                          : 'hover:bg-blue-900 focus:ring-teal-500'
                    }`}
                  >
                    <span className="sr-only">Open main menu</span>
                    <svg
                      className={`${isMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <svg
                      className={`${isMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          {isMenuOpen && (
            <div className="md:hidden">
              <div className={`px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t ${
                currentTheme === 'light'
                  ? 'border-gray-200 bg-white'
                  : currentTheme === 'dark'
                    ? 'border-gray-700 bg-gray-900'
                    : 'border-blue-800 bg-blue-950'
              }`}>
                {['Home', 'About', 'Services', 'Contact'].map((item) => (
                  <a
                    key={item}
                    href={`/${item.toLowerCase()}`}
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                      theme.colors.text
                    } ${
                      currentTheme === 'light'
                        ? 'hover:bg-gray-100'
                        : currentTheme === 'dark'
                          ? 'hover:bg-gray-800'
                          : 'hover:bg-blue-900'
                    }`}
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Notifications */}
        <div className="fixed top-20 right-4 z-50 space-y-2">
          {notifications.map((notification, index) => (
            <div
              key={index}
              className={`max-w-sm p-4 rounded-lg shadow-lg transform transition-all duration-300 animate-slide-in-right ${
                currentTheme === 'light'
                  ? 'bg-blue-500 text-white'
                  : currentTheme === 'dark'
                    ? 'bg-purple-500 text-white'
                    : 'bg-teal-500 text-white'
              }`}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{notification}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <main className="flex-1">
          <Component {...pageProps} />
        </main>

        {/* Footer */}
        <footer className={`mt-auto border-t ${
          currentTheme === 'light'
            ? 'border-gray-200 bg-gray-50'
            : currentTheme === 'dark'
              ? 'border-gray-700 bg-gray-800'
              : 'border-blue-800 bg-blue-900'
        }`}>
          <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Company Info */}
              <div className="col-span-1 md:col-span-2">
                <h3 className={`text-lg font-semibold mb-4 ${theme.colors.text}`}>
                  NextApp
                </h3>
                <p className={`text-sm leading-relaxed ${
                  currentTheme === 'light'
                    ? 'text-gray-600'
                    : currentTheme === 'dark'
                      ? 'text-gray-400'
                      : 'text-blue-200'
                }`}>
                  A comprehensive Next.js application showcasing modern web development
                  patterns with extensive Tailwind CSS styling and responsive design.
                </p>
              </div>

              {/* Quick Links */}
              <div>
                <h4 className={`text-md font-medium mb-4 ${theme.colors.text}`}>
                  Quick Links
                </h4>
                <ul className="space-y-2">
                  {['Documentation', 'API Reference', 'Support', 'Changelog'].map((link) => (
                    <li key={link}>
                      <a
                        href={`/${link.toLowerCase().replace(' ', '-')}`}
                        className={`text-sm transition-colors duration-200 ${
                          currentTheme === 'light'
                            ? 'text-gray-600 hover:text-blue-600'
                            : currentTheme === 'dark'
                              ? 'text-gray-400 hover:text-purple-400'
                              : 'text-blue-200 hover:text-teal-300'
                        }`}
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Social Links */}
              <div>
                <h4 className={`text-md font-medium mb-4 ${theme.colors.text}`}>
                  Connect
                </h4>
                <div className="flex space-x-4">
                  {['GitHub', 'Twitter', 'LinkedIn'].map((social) => (
                    <a
                      key={social}
                      href={`https://${social.toLowerCase()}.com`}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        currentTheme === 'light'
                          ? 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                          : currentTheme === 'dark'
                            ? 'text-gray-400 hover:text-purple-400 hover:bg-gray-700'
                            : 'text-blue-200 hover:text-teal-300 hover:bg-blue-800'
                      }`}
                    >
                      <span className="sr-only">{social}</span>
                      <div className="w-5 h-5">📱</div>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className={`mt-8 pt-8 border-t ${
              currentTheme === 'light'
                ? 'border-gray-200'
                : currentTheme === 'dark'
                  ? 'border-gray-700'
                  : 'border-blue-800'
            }`}>
              <p className={`text-center text-sm ${
                currentTheme === 'light'
                  ? 'text-gray-600'
                  : currentTheme === 'dark'
                    ? 'text-gray-400'
                    : 'text-blue-200'
              }`}>
                © 2024 NextApp. All rights reserved. Built with Next.js and Tailwind CSS.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

export default MyApp; 