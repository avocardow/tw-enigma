<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
    <!-- Navigation -->
    <nav class="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center space-x-4">
            <div class="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span class="text-white font-bold text-sm">V</span>
            </div>
            <h1 class="text-xl font-semibold text-gray-900">Vite + Vue App</h1>
          </div>
          <div class="flex items-center space-x-4">
            <button 
              @click="toggleTheme"
              class="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              {{ isDark ? '☀️' : '🌙' }}
            </button>
            <div class="relative">
              <button 
                @click="showNotifications = !showNotifications"
                class="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors relative"
              >
                🔔
                <span 
                  v-if="notifications.length > 0"
                  class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center"
                >
                  {{ notifications.length }}
                </span>
              </button>
              
              <!-- Notifications Dropdown -->
              <div 
                v-if="showNotifications"
                class="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
              >
                <div class="p-4 border-b border-gray-200">
                  <h3 class="font-semibold text-gray-900">Notifications</h3>
                </div>
                <div class="max-h-64 overflow-y-auto">
                  <div 
                    v-for="notification in notifications" 
                    :key="notification.id"
                    class="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    @click="markAsRead(notification.id)"
                  >
                    <div class="flex items-start space-x-3">
                      <div 
                        :class="[
                          'w-2 h-2 rounded-full mt-2',
                          notification.read ? 'bg-gray-300' : 'bg-blue-500'
                        ]"
                      ></div>
                      <div class="flex-1">
                        <p class="text-sm font-medium text-gray-900">{{ notification.title }}</p>
                        <p class="text-xs text-gray-500 mt-1">{{ notification.time }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="relative py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-4xl sm:text-6xl font-bold text-gray-900 mb-6">
          <span class="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Vue 3 + Vite
          </span>
          <br />
          Development
        </h1>
        <p class="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Fast, modern development with Vue 3 Composition API, Vite, and Tailwind CSS
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            @click="startDemo"
            class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-medium transition-colors duration-200"
          >
            Start Demo
          </button>
          <button 
            class="border border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-3 rounded-lg font-medium transition-colors duration-200"
          >
            Learn More
          </button>
        </div>
      </div>
    </section>

    <!-- Features Grid -->
    <section class="py-20 bg-white/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold text-gray-900 mb-4">Modern Features</h2>
          <p class="text-lg text-gray-600">Built with the latest technologies for optimal performance</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div 
            v-for="(feature, index) in features" 
            :key="feature.id"
            class="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
            :class="{ 'animate-pulse': loadingFeatures }"
          >
            <div 
              :class="[
                'w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg mb-4',
                index % 3 === 0 ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                index % 3 === 1 ? 'bg-gradient-to-br from-green-500 to-green-600' :
                'bg-gradient-to-br from-purple-500 to-purple-600'
              ]"
            >
              {{ feature.icon }}
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">{{ feature.title }}</h3>
            <p class="text-gray-600">{{ feature.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Interactive Demo -->
    <section v-if="demoActive" class="py-20">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div class="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900">Interactive Demo</h3>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <!-- Controls -->
              <div class="space-y-6">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Demo Type
                  </label>
                  <select 
                    v-model="selectedDemo"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="animation">Animation</option>
                    <option value="form">Form Validation</option>
                    <option value="data">Data Visualization</option>
                  </select>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Speed: {{ animationSpeed }}x
                  </label>
                  <input 
                    v-model="animationSpeed"
                    type="range" 
                    min="0.5" 
                    max="3" 
                    step="0.5"
                    class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div class="flex space-x-3">
                  <button 
                    @click="runDemo"
                    :disabled="demoRunning"
                    class="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                  >
                    {{ demoRunning ? 'Running...' : 'Run Demo' }}
                  </button>
                  <button 
                    @click="resetDemo"
                    class="flex-1 border border-gray-300 hover:border-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <!-- Demo Output -->
              <div class="bg-gray-50 rounded-lg p-6 min-h-64 flex items-center justify-center">
                <div v-if="selectedDemo === 'animation'" class="text-center">
                  <div 
                    :class="[
                      'w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg mx-auto mb-4 transition-transform duration-1000',
                      demoRunning ? 'transform rotate-180 scale-110' : ''
                    ]"
                  ></div>
                  <p class="text-gray-600">Animation Demo</p>
                </div>
                
                <div v-else-if="selectedDemo === 'form'" class="w-full max-w-sm">
                  <form @submit.prevent="submitForm" class="space-y-4">
                    <div>
                      <input 
                        v-model="formData.email"
                        type="email" 
                        placeholder="Enter your email"
                        :class="[
                          'w-full px-3 py-2 border rounded-lg transition-colors duration-200',
                          emailValid ? 'border-green-500 focus:ring-green-500' : 'border-gray-300 focus:ring-indigo-500'
                        ]"
                      />
                    </div>
                    <button 
                      type="submit"
                      :disabled="!emailValid"
                      class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white py-2 rounded-lg font-medium transition-colors duration-200"
                    >
                      Submit
                    </button>
                  </form>
                </div>
                
                <div v-else class="text-center">
                  <div class="grid grid-cols-3 gap-2 mb-4">
                    <div 
                      v-for="(bar, index) in dataViz" 
                      :key="index"
                      class="bg-gradient-to-t from-indigo-500 to-purple-600 rounded-sm transition-all duration-500"
                      :style="{ height: `${bar}px` }"
                    ></div>
                  </div>
                  <p class="text-gray-600">Data Visualization</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// Reactive state
const isDark = ref(false)
const showNotifications = ref(false)
const demoActive = ref(false)
const selectedDemo = ref('animation')
const animationSpeed = ref(1)
const demoRunning = ref(false)
const loadingFeatures = ref(true)

// Form data
const formData = ref({
  email: ''
})

// Data visualization
const dataViz = ref([40, 60, 30, 80, 50, 70])

// Notifications
const notifications = ref([
  {
    id: 1,
    title: 'Welcome to the app!',
    time: '2 minutes ago',
    read: false
  },
  {
    id: 2,
    title: 'Demo completed successfully',
    time: '1 hour ago',
    read: true
  },
  {
    id: 3,
    title: 'New feature available',
    time: '2 hours ago',
    read: false
  }
])

// Features data
const features = ref([
  {
    id: 1,
    icon: '⚡',
    title: 'Lightning Fast',
    description: 'Vite provides instant hot module replacement and optimized builds'
  },
  {
    id: 2,
    icon: '🎨',
    title: 'Modern Styling',
    description: 'Tailwind CSS for rapid UI development with utility-first approach'
  },
  {
    id: 3,
    icon: '🔧',
    title: 'Type Safety',
    description: 'Full TypeScript support with Vue 3 Composition API'
  },
  {
    id: 4,
    icon: '📱',
    title: 'Responsive',
    description: 'Mobile-first design that works on all screen sizes'
  },
  {
    id: 5,
    icon: '🚀',
    title: 'Optimized',
    description: 'Tree-shaking and code splitting for minimal bundle sizes'
  },
  {
    id: 6,
    icon: '🛠️',
    title: 'Developer Experience',
    description: 'Hot reload, debugging tools, and great error messages'
  }
])

// Computed properties
const emailValid = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(formData.value.email)
})

// Methods
const toggleTheme = () => {
  isDark.value = !isDark.value
}

const markAsRead = (id: number) => {
  const notification = notifications.value.find(n => n.id === id)
  if (notification) {
    notification.read = true
  }
}

const startDemo = () => {
  demoActive.value = true
}

const runDemo = async () => {
  demoRunning.value = true
  
  if (selectedDemo.value === 'data') {
    // Animate data visualization
    const duration = 2000 / animationSpeed.value
    const steps = 20
    const stepDuration = duration / steps
    
    for (let i = 0; i < steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration))
      dataViz.value = dataViz.value.map(() => Math.floor(Math.random() * 80) + 20)
    }
  } else {
    // Simple delay for other demos
    await new Promise(resolve => setTimeout(resolve, 2000 / animationSpeed.value))
  }
  
  demoRunning.value = false
}

const resetDemo = () => {
  demoRunning.value = false
  dataViz.value = [40, 60, 30, 80, 50, 70]
  formData.value.email = ''
}

const submitForm = () => {
  if (emailValid.value) {
    alert('Form submitted successfully!')
    formData.value.email = ''
  }
}

// Lifecycle
onMounted(() => {
  setTimeout(() => {
    loadingFeatures.value = false
  }, 1000)
})
</script>

<style scoped>
/* Custom scrollbar for notifications */
::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style> 