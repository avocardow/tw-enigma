<template>
  <div :class="[
    'min-h-screen transition-all duration-500',
    currentTheme.background,
    currentTheme.text
  ]">
    <!-- Loading Overlay -->
    <div 
      v-if="isLoading"
      class="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600"
    >
      <div class="text-center">
        <div class="relative">
          <div class="animate-spin rounded-full h-32 w-32 border-b-4 border-white"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-white text-2xl font-bold">{{ Math.round(loadingProgress) }}%</div>
          </div>
        </div>
        <h1 class="text-4xl font-bold text-white mt-8 mb-4">Loading Vue App</h1>
        <div class="flex justify-center space-x-2">
          <div 
            v-for="i in 5" 
            :key="i"
            :class="[
              'w-3 h-3 bg-white rounded-full animate-pulse',
              `delay-${i * 100}`
            ]"
          ></div>
        </div>
      </div>
    </div>

    <!-- Main App Content -->
    <div v-else>
      <!-- Navigation Header -->
      <nav :class="[
        'sticky top-0 z-40 backdrop-blur-lg border-b shadow-lg',
        currentTheme.navBg,
        currentTheme.border
      ]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16">
            <!-- Logo -->
            <div class="flex-shrink-0">
              <h1 :class="[
                'text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent',
                themeGradients[selectedTheme]
              ]">
                ViteApp
              </h1>
            </div>

            <!-- Desktop Navigation -->
            <div class="hidden md:flex items-center space-x-1">
              <button
                v-for="(item, index) in navItems"
                :key="item.name"
                @click="activeSection = item.key"
                :class="[
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform',
                  'hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  activeSection === item.key 
                    ? [currentTheme.primary, 'shadow-lg'] 
                    : [currentTheme.text, currentTheme.hover, 'hover:shadow-md'],
                  currentTheme.focusRing
                ]"
                :style="{ 
                  animationDelay: `${index * 100}ms`,
                  animation: isVisible ? 'slideInFromLeft 0.5s ease-out forwards' : ''
                }"
              >
                {{ item.name }}
              </button>
            </div>

            <!-- Theme Selector & Settings -->
            <div class="flex items-center space-x-4">
              <!-- Theme Dropdown -->
              <div class="relative">
                <select
                  v-model="selectedTheme"
                  @change="handleThemeChange"
                  :class="[
                    'appearance-none rounded-lg px-4 py-2 pr-8 text-sm font-medium border-2',
                    'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
                    currentTheme.input,
                    currentTheme.border,
                    currentTheme.focusRing
                  ]"
                >
                  <option 
                    v-for="theme in themes" 
                    :key="theme.key" 
                    :value="theme.key"
                  >
                    {{ theme.name }}
                  </option>
                </select>
                <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <!-- Notification Bell -->
              <button
                @click="showNotifications = !showNotifications"
                :class="[
                  'relative p-2 rounded-lg transition-all duration-200',
                  'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  currentTheme.text,
                  currentTheme.hover,
                  currentTheme.focusRing
                ]"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5-5 5-5h-5m-6 10v-4a6 6 0 1 1 12 0v4" />
                </svg>
                <span 
                  v-if="notifications.length > 0"
                  class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse"
                >
                  {{ notifications.length }}
                </span>
              </button>

              <!-- Mobile Menu Button -->
              <button
                @click="isMobileMenuOpen = !isMobileMenuOpen"
                :class="[
                  'md:hidden inline-flex items-center justify-center p-2 rounded-md',
                  'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  currentTheme.text,
                  currentTheme.hover,
                  currentTheme.focusRing
                ]"
              >
                <svg 
                  :class="[isMobileMenuOpen ? 'hidden' : 'block', 'h-6 w-6']"
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <svg 
                  :class="[isMobileMenuOpen ? 'block' : 'hidden', 'h-6 w-6']"
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Mobile Menu -->
        <div 
          v-show="isMobileMenuOpen"
          :class="[
            'md:hidden border-t',
            currentTheme.navBg,
            currentTheme.border
          ]"
        >
          <div class="px-2 pt-2 pb-3 space-y-1">
            <button
              v-for="item in navItems"
              :key="item.name"
              @click="activeSection = item.key; isMobileMenuOpen = false"
              :class="[
                'block w-full text-left px-3 py-2 rounded-md text-base font-medium',
                'transition-all duration-200',
                activeSection === item.key 
                  ? currentTheme.primary 
                  : [currentTheme.text, currentTheme.hover]
              ]"
            >
              {{ item.name }}
            </button>
          </div>
        </div>
      </nav>

      <!-- Notifications Panel -->
      <div 
        v-if="showNotifications"
        class="fixed top-16 right-4 z-50 max-w-sm"
      >
        <div :class="[
          'rounded-lg shadow-xl border p-4',
          currentTheme.cardBg,
          currentTheme.border
        ]">
          <h3 :class="['text-lg font-semibold mb-3', currentTheme.text]">
            Notifications
          </h3>
          <div v-if="notifications.length === 0" :class="['text-sm', currentTheme.textMuted]">
            No notifications
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="(notification, index) in notifications"
              :key="index"
              :class="[
                'p-3 rounded-lg border-l-4 text-sm',
                notification.type === 'success' ? 'border-green-500 bg-green-50 text-green-800' :
                notification.type === 'warning' ? 'border-yellow-500 bg-yellow-50 text-yellow-800' :
                'border-blue-500 bg-blue-50 text-blue-800'
              ]"
            >
              {{ notification.message }}
            </div>
          </div>
          <button
            @click="showNotifications = false"
            :class="[
              'mt-3 w-full py-2 px-4 rounded-lg text-sm font-medium',
              'transition-colors duration-200',
              currentTheme.secondary
            ]"
          >
            Close
          </button>
        </div>
      </div>

      <!-- Main Content Area -->
      <main class="flex-1">
        <!-- Hero Section -->
        <section 
          v-if="activeSection === 'home'"
          :class="[
            'relative overflow-hidden',
            selectedTheme === 'light' ? 'bg-gradient-to-br from-blue-50 to-indigo-100' :
            selectedTheme === 'dark' ? 'bg-gradient-to-br from-gray-900 to-gray-800' :
            'bg-gradient-to-br from-emerald-900 to-teal-800'
          ]"
        >
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div class="text-center">
              <h1 :class="[
                'text-4xl md:text-6xl font-bold mb-8',
                'bg-gradient-to-r bg-clip-text text-transparent',
                themeGradients[selectedTheme]
              ]">
                Welcome to ViteApp
              </h1>
              <p :class="['text-xl md:text-2xl mb-12 max-w-3xl mx-auto', currentTheme.textMuted]">
                Experience the power of Vue 3 with Vite, featuring extensive Tailwind CSS 
                styling, responsive design, and modern development patterns.
              </p>
              <div class="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
                <button
                  @click="activeSection = 'demo'"
                  :class="[
                    'px-8 py-4 rounded-xl text-lg font-semibold',
                    'transform transition-all duration-200 hover:scale-105',
                    'focus:outline-none focus:ring-4 focus:ring-offset-2',
                    currentTheme.primary,
                    currentTheme.focusRing
                  ]"
                >
                  Try Interactive Demo
                </button>
                <button
                  @click="activeSection = 'features'"
                  :class="[
                    'px-8 py-4 rounded-xl text-lg font-semibold border-2',
                    'transform transition-all duration-200 hover:scale-105',
                    'focus:outline-none focus:ring-4 focus:ring-offset-2',
                    currentTheme.secondary,
                    currentTheme.border,
                    currentTheme.focusRing
                  ]"
                >
                  Explore Features
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Demo Section -->
        <section 
          v-if="activeSection === 'demo'"
          class="py-16"
        >
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 :class="['text-3xl font-bold text-center mb-12', currentTheme.text]">
              Interactive Demo
            </h2>
            
            <!-- Demo Controls -->
            <div :class="[
              'mb-8 p-6 rounded-xl border',
              currentTheme.cardBg,
              currentTheme.border
            ]">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Animation Control -->
                <div>
                  <label :class="['block text-sm font-medium mb-2', currentTheme.text]">
                    Animation Speed
                  </label>
                  <input
                    v-model="animationSpeed"
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.5"
                    class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <div class="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Slow</span>
                    <span>Fast</span>
                  </div>
                </div>

                <!-- Color Scheme -->
                <div>
                  <label :class="['block text-sm font-medium mb-2', currentTheme.text]">
                    Demo Color
                  </label>
                  <div class="flex space-x-2">
                    <button
                      v-for="color in demoColors"
                      :key="color.name"
                      @click="selectedDemoColor = color.value"
                      :class="[
                        'w-8 h-8 rounded-full border-2 transition-all duration-200',
                        'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2',
                        color.value,
                        selectedDemoColor === color.value ? 'ring-4 ring-gray-400' : 'border-gray-300'
                      ]"
                      :title="color.name"
                    ></button>
                  </div>
                </div>

                <!-- Demo Type -->
                <div>
                  <label :class="['block text-sm font-medium mb-2', currentTheme.text]">
                    Demo Type
                  </label>
                  <select
                    v-model="selectedDemoType"
                    :class="[
                      'w-full rounded-lg px-3 py-2 border',
                      'focus:outline-none focus:ring-2 focus:ring-offset-1',
                      currentTheme.input,
                      currentTheme.border,
                      currentTheme.focusRing
                    ]"
                  >
                    <option value="cards">Animated Cards</option>
                    <option value="chart">Data Visualization</option>
                    <option value="timeline">Timeline Animation</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Demo Content -->
            <div :class="[
              'p-8 rounded-xl border min-h-96',
              currentTheme.cardBg,
              currentTheme.border
            ]">
              <!-- Animated Cards Demo -->
              <div v-if="selectedDemoType === 'cards'" class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                  v-for="(card, index) in demoCards"
                  :key="index"
                  :class="[
                    'p-6 rounded-lg border transform transition-all duration-300',
                    'hover:scale-105 hover:shadow-xl cursor-pointer',
                    selectedDemoColor,
                    'hover:rotate-1'
                  ]"
                  :style="{
                    animationDelay: `${index * 200}ms`,
                    animationDuration: `${animationSpeed}s`
                  }"
                  @click="triggerCardAnimation(index)"
                >
                  <div class="text-4xl mb-4">{{ card.icon }}</div>
                  <h3 class="text-lg font-semibold text-white mb-2">{{ card.title }}</h3>
                  <p class="text-sm text-white/80">{{ card.description }}</p>
                </div>
              </div>

              <!-- Chart Demo -->
              <div v-else-if="selectedDemoType === 'chart'" class="space-y-6">
                <h3 :class="['text-xl font-semibold', currentTheme.text]">Data Visualization</h3>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <div class="space-y-4">
                      <div
                        v-for="(item, index) in chartData"
                        :key="index"
                        class="flex items-center space-x-4"
                      >
                        <div :class="['w-4 h-4 rounded', item.color]"></div>
                        <span :class="['flex-1', currentTheme.text]">{{ item.label }}</span>
                        <div class="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                          <div
                            :class="['h-2 rounded-full transition-all duration-1000', item.color]"
                            :style="{ width: `${item.value}%`, transitionDelay: `${index * 100}ms` }"
                          ></div>
                        </div>
                        <span :class="['text-sm font-medium', currentTheme.textMuted]">{{ item.value }}%</span>
                      </div>
                    </div>
                  </div>
                  <div :class="[
                    'p-6 rounded-lg border text-center',
                    currentTheme.secondary,
                    currentTheme.border
                  ]">
                    <div class="text-6xl font-bold text-green-600 mb-2">{{ totalValue }}%</div>
                    <div :class="['text-sm', currentTheme.textMuted]">Total Performance</div>
                  </div>
                </div>
              </div>

              <!-- Timeline Demo -->
              <div v-else class="space-y-8">
                <h3 :class="['text-xl font-semibold', currentTheme.text]">Project Timeline</h3>
                <div class="relative">
                  <div :class="['absolute left-4 top-0 bottom-0 w-0.5', selectedDemoColor]"></div>
                  <div
                    v-for="(event, index) in timelineEvents"
                    :key="index"
                    :class="[
                      'relative flex items-start space-x-4 pb-8',
                      'transition-all duration-500',
                      { 'opacity-100 translate-x-0': isVisible, 'opacity-0 translate-x-4': !isVisible }
                    ]"
                    :style="{ transitionDelay: `${index * 200}ms` }"
                  >
                    <div :class="[
                      'w-8 h-8 rounded-full border-4 border-white flex items-center justify-center',
                      selectedDemoColor,
                      'shadow-lg'
                    ]">
                      <div class="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <div :class="[
                      'flex-1 p-4 rounded-lg border',
                      currentTheme.cardBg,
                      currentTheme.border
                    ]">
                      <div class="flex justify-between items-start mb-2">
                        <h4 :class="['font-semibold', currentTheme.text]">{{ event.title }}</h4>
                        <span :class="['text-sm', currentTheme.textMuted]">{{ event.date }}</span>
                      </div>
                      <p :class="['text-sm', currentTheme.textMuted]">{{ event.description }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Features Section -->
        <section 
          v-if="activeSection === 'features'"
          class="py-16"
        >
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 :class="['text-3xl font-bold text-center mb-12', currentTheme.text]">
              Features & Capabilities
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div
                v-for="(feature, index) in features"
                :key="index"
                :class="[
                  'p-6 rounded-xl border transform transition-all duration-300',
                  'hover:scale-105 hover:shadow-xl',
                  currentTheme.cardBg,
                  currentTheme.border
                ]"
                :style="{ animationDelay: `${index * 100}ms` }"
              >
                <div :class="[
                  'w-12 h-12 rounded-lg flex items-center justify-center text-2xl mb-4',
                  feature.color
                ]">
                  {{ feature.icon }}
                </div>
                <h3 :class="['text-lg font-semibold mb-3', currentTheme.text]">
                  {{ feature.title }}
                </h3>
                <p :class="['text-sm leading-relaxed', currentTheme.textMuted]">
                  {{ feature.description }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- About Section -->
        <section 
          v-if="activeSection === 'about'"
          class="py-16"
        >
          <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 :class="['text-3xl font-bold mb-8', currentTheme.text]">
              About ViteApp
            </h2>
            <div :class="[
              'p-8 rounded-xl border',
              currentTheme.cardBg,
              currentTheme.border
            ]">
              <p :class="['text-lg leading-relaxed mb-6', currentTheme.text]">
                ViteApp is a comprehensive demonstration of modern web development using Vue 3, 
                Vite, and Tailwind CSS. This application showcases advanced patterns including 
                reactive state management, dynamic theming, complex animations, and responsive design.
              </p>
              <p :class="['text-lg leading-relaxed', currentTheme.textMuted]">
                Built with performance and developer experience in mind, this project demonstrates 
                how modern tools can create highly interactive and visually appealing web applications 
                while maintaining clean, maintainable code.
              </p>
            </div>
          </div>
        </section>
      </main>

      <!-- Footer -->
      <footer :class="[
        'border-t mt-16',
        currentTheme.cardBg,
        currentTheme.border
      ]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div class="col-span-1 md:col-span-2">
              <h3 :class="['text-lg font-semibold mb-4', currentTheme.text]">
                ViteApp
              </h3>
              <p :class="['text-sm leading-relaxed', currentTheme.textMuted]">
                A demonstration of Vue 3 + Vite + Tailwind CSS showcasing modern web development 
                patterns with extensive styling and interactive components.
              </p>
            </div>
            <div>
              <h4 :class="['text-md font-medium mb-4', currentTheme.text]">
                Technologies
              </h4>
              <ul class="space-y-2">
                <li v-for="tech in technologies" :key="tech" :class="['text-sm', currentTheme.textMuted]">
                  {{ tech }}
                </li>
              </ul>
            </div>
            <div>
              <h4 :class="['text-md font-medium mb-4', currentTheme.text]">
                Connect
              </h4>
              <div class="flex space-x-4">
                <a
                  v-for="social in socialLinks"
                  :key="social.name"
                  :href="social.url"
                  :class="[
                    'p-2 rounded-lg transition-all duration-200',
                    'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2',
                    currentTheme.text,
                    currentTheme.hover,
                    currentTheme.focusRing
                  ]"
                >
                  <span class="sr-only">{{ social.name }}</span>
                  <div class="w-5 h-5">{{ social.icon }}</div>
                </a>
              </div>
            </div>
          </div>
          <div :class="[
            'mt-8 pt-8 border-t text-center',
            currentTheme.border
          ]">
            <p :class="['text-sm', currentTheme.textMuted]">
              © 2024 ViteApp. Built with Vue 3, Vite, and Tailwind CSS.
            </p>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'

// Reactive state
const isLoading = ref(true)
const loadingProgress = ref(0)
const selectedTheme = ref('light')
const activeSection = ref('home')
const isMobileMenuOpen = ref(false)
const showNotifications = ref(false)
const isVisible = ref(false)
const animationSpeed = ref(1.5)
const selectedDemoColor = ref('bg-blue-500')
const selectedDemoType = ref('cards')

// Notifications
const notifications = reactive([
  { type: 'success', message: 'Welcome to ViteApp!' },
  { type: 'info', message: 'Try switching themes to see dynamic styling' }
])

// Navigation items
const navItems = [
  { name: 'Home', key: 'home' },
  { name: 'Demo', key: 'demo' },
  { name: 'Features', key: 'features' },
  { name: 'About', key: 'about' }
]

// Theme definitions
const themes = [
  { key: 'light', name: 'Light' },
  { key: 'dark', name: 'Dark' },
  { key: 'nature', name: 'Nature' }
]

const themeGradients = {
  light: 'from-blue-600 to-purple-600',
  dark: 'from-purple-400 to-pink-400',
  nature: 'from-green-500 to-teal-500'
}

// Current theme computed properties
const currentTheme = computed(() => {
  const themeMap = {
    light: {
      background: 'bg-gray-50',
      text: 'text-gray-900',
      textMuted: 'text-gray-600',
      primary: 'bg-blue-600 text-white',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
      cardBg: 'bg-white',
      navBg: 'bg-white/95',
      border: 'border-gray-200',
      hover: 'hover:bg-gray-100',
      input: 'bg-gray-50 text-gray-900',
      focusRing: 'focus:ring-blue-500'
    },
    dark: {
      background: 'bg-gray-900',
      text: 'text-gray-100',
      textMuted: 'text-gray-400',
      primary: 'bg-purple-600 text-white',
      secondary: 'bg-gray-800 text-gray-100 hover:bg-gray-700',
      cardBg: 'bg-gray-800',
      navBg: 'bg-gray-900/95',
      border: 'border-gray-700',
      hover: 'hover:bg-gray-700',
      input: 'bg-gray-800 text-gray-100',
      focusRing: 'focus:ring-purple-500'
    },
    nature: {
      background: 'bg-green-50',
      text: 'text-green-900',
      textMuted: 'text-green-700',
      primary: 'bg-green-600 text-white',
      secondary: 'bg-green-100 text-green-900 hover:bg-green-200',
      cardBg: 'bg-white',
      navBg: 'bg-green-50/95',
      border: 'border-green-200',
      hover: 'hover:bg-green-100',
      input: 'bg-green-50 text-green-900',
      focusRing: 'focus:ring-green-500'
    }
  }
  return themeMap[selectedTheme.value as keyof typeof themeMap]
})

// Demo data
const demoColors = [
  { name: 'Blue', value: 'bg-blue-500' },
  { name: 'Purple', value: 'bg-purple-500' },
  { name: 'Green', value: 'bg-green-500' },
  { name: 'Red', value: 'bg-red-500' },
  { name: 'Yellow', value: 'bg-yellow-500' }
]

const demoCards = [
  { icon: '🚀', title: 'Performance', description: 'Lightning-fast development with Vite' },
  { icon: '🎨', title: 'Styling', description: 'Beautiful UI with Tailwind CSS' },
  { icon: '⚡', title: 'Reactive', description: 'Vue 3 Composition API power' }
]

const chartData = reactive([
  { label: 'Vue 3', value: 95, color: 'bg-green-500' },
  { label: 'Vite', value: 88, color: 'bg-blue-500' },
  { label: 'Tailwind', value: 92, color: 'bg-purple-500' },
  { label: 'TypeScript', value: 85, color: 'bg-yellow-500' }
])

const totalValue = computed(() => {
  return Math.round(chartData.reduce((sum, item) => sum + item.value, 0) / chartData.length)
})

const timelineEvents = [
  { title: 'Project Initialization', date: '2024-01', description: 'Set up Vue 3 + Vite project structure' },
  { title: 'Tailwind Integration', date: '2024-02', description: 'Configured Tailwind CSS with custom design system' },
  { title: 'Component Development', date: '2024-03', description: 'Built reusable components with TypeScript' },
  { title: 'Interactive Features', date: '2024-04', description: 'Added animations and dynamic theming' }
]

const features = [
  {
    icon: '⚡',
    title: 'Lightning Fast',
    description: 'Powered by Vite for instant development and optimal build performance',
    color: 'bg-yellow-100 text-yellow-600'
  },
  {
    icon: '🎨',
    title: 'Beautiful Design',
    description: 'Crafted with Tailwind CSS for consistent and responsive design',
    color: 'bg-purple-100 text-purple-600'
  },
  {
    icon: '🔧',
    title: 'Developer Experience',
    description: 'TypeScript support with excellent tooling and hot reload',
    color: 'bg-blue-100 text-blue-600'
  },
  {
    icon: '📱',
    title: 'Mobile First',
    description: 'Responsive design that works perfectly on all devices',
    color: 'bg-green-100 text-green-600'
  },
  {
    icon: '🌙',
    title: 'Theme Support',
    description: 'Dynamic theming with multiple color schemes and preferences',
    color: 'bg-indigo-100 text-indigo-600'
  },
  {
    icon: '🚀',
    title: 'Modern Stack',
    description: 'Built with the latest web technologies and best practices',
    color: 'bg-red-100 text-red-600'
  }
]

const technologies = [
  'Vue 3',
  'Vite',
  'Tailwind CSS',
  'TypeScript',
  'Composition API'
]

const socialLinks = [
  { name: 'GitHub', icon: '🐙', url: 'https://github.com' },
  { name: 'Twitter', icon: '🐦', url: 'https://twitter.com' },
  { name: 'LinkedIn', icon: '💼', url: 'https://linkedin.com' }
]

// Methods
const handleThemeChange = () => {
  notifications.push({
    type: 'success',
    message: `Switched to ${themes.find(t => t.key === selectedTheme.value)?.name} theme`
  })
  setTimeout(() => {
    notifications.splice(0, 1)
  }, 3000)
}

const triggerCardAnimation = (index: number) => {
  console.log(`Card ${index} clicked with animation speed ${animationSpeed.value}`)
}

// Lifecycle
onMounted(() => {
  // Simulate loading progress
  const interval = setInterval(() => {
    loadingProgress.value += 10
    if (loadingProgress.value >= 100) {
      clearInterval(interval)
      setTimeout(() => {
        isLoading.value = false
        isVisible.value = true
      }, 500)
    }
  }, 200)
})

// Watchers
watch(selectedTheme, (newTheme) => {
  console.log(`Theme changed to: ${newTheme}`)
})
</script>

<style scoped>
@keyframes slideInFromLeft {
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.animate-slide-in-right {
  animation: slideInFromRight 0.3s ease-out;
}

@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style> 