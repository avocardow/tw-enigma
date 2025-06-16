<template>
  <div :class="containerClasses">
    <header
      class="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200"
    >
      <div class="max-w-6xl mx-auto px-4 py-3">
        <h1 class="text-2xl font-bold text-gray-900">
          Vue Dynamic Styling Test
        </h1>
      </div>
    </header>

    <main class="container mx-auto px-4 py-8 space-y-8">
      <!-- Dynamic binding with computed styles -->
      <section
        :class="[
          'p-6 rounded-xl transition-all duration-300',
          isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900',
          isExpanded
            ? 'shadow-2xl ring-2 ring-blue-500'
            : 'shadow-lg hover:shadow-xl',
          { 'border-l-4 border-blue-500': isHighlighted },
        ]"
      >
        <h2 class="text-xl font-semibold mb-4">Dynamic Class Binding</h2>

        <div class="flex flex-wrap gap-2 mb-4">
          <button @click="toggleDarkMode" :class="buttonClasses('primary')">
            {{ isDarkMode ? "Light Mode" : "Dark Mode" }}
          </button>

          <button
            @click="isExpanded = !isExpanded"
            :class="buttonClasses('secondary')"
          >
            {{ isExpanded ? "Collapse" : "Expand" }}
          </button>

          <button
            @click="isHighlighted = !isHighlighted"
            :class="buttonClasses('accent')"
          >
            Toggle Highlight
          </button>
        </div>

        <!-- Conditional content with v-show/v-if -->
        <div v-show="isExpanded" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="(item, index) in items"
              :key="item.id"
              :class="getItemClasses(item, index)"
              @click="selectItem(item.id)"
            >
              <div
                class="aspect-square bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg mb-3"
              ></div>
              <h3 class="font-medium truncate">{{ item.title }}</h3>
              <p class="text-sm opacity-70">{{ item.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Form with validation states -->
      <section class="bg-gray-50 p-6 rounded-lg">
        <h2 class="text-xl font-semibold mb-4">Form Validation States</h2>

        <form @submit.prevent="submitForm" class="space-y-4">
          <div
            v-for="field in formFields"
            :key="field.name"
            :class="getFieldClasses(field)"
          >
            <label
              :for="field.name"
              :class="[
                'block text-sm font-medium mb-1',
                getFieldValidationColor(field, 'text'),
              ]"
            >
              {{ field.label }}
            </label>

            <input
              :id="field.name"
              v-model="formData[field.name]"
              :type="field.type"
              :class="[
                'w-full px-3 py-2 border rounded-md transition-colors duration-150',
                'focus:outline-none focus:ring-2 focus:ring-offset-1',
                getFieldInputClasses(field),
              ]"
              @blur="validateField(field.name)"
            />

            <p
              v-if="fieldErrors[field.name]"
              :class="['mt-1 text-xs', getFieldValidationColor(field, 'text')]"
            >
              {{ fieldErrors[field.name] }}
            </p>
          </div>

          <button
            type="submit"
            :disabled="!isFormValid"
            :class="[
              'px-6 py-2 rounded-md font-medium transition-all duration-150',
              isFormValid
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed',
            ]"
          >
            Submit Form
          </button>
        </form>
      </section>

      <!-- Animation and transition states -->
      <section class="space-y-4">
        <h2 class="text-xl font-semibold">Animation States</h2>

        <div class="flex flex-wrap gap-4">
          <div
            v-for="animation in animations"
            :key="animation.name"
            @click="triggerAnimation(animation.name)"
            :class="[
              'relative p-4 bg-white rounded-lg shadow cursor-pointer',
              'transform transition-all duration-300 hover:scale-105',
              activeAnimations.includes(animation.name)
                ? animation.activeClass
                : '',
            ]"
          >
            <div
              class="w-12 h-12 bg-gradient-to-r from-pink-500 to-red-500 rounded-full mb-2"
            ></div>
            <p class="font-medium">{{ animation.label }}</p>
          </div>
        </div>
      </section>

      <!-- Responsive design showcase -->
      <section class="space-y-4">
        <h2 class="text-xl font-semibold">Responsive Design</h2>

        <div
          class="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
        >
          <div
            v-for="size in responsiveSizes"
            :key="size.breakpoint"
            :class="size.classes"
          >
            <div
              class="aspect-square bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold"
            >
              {{ size.breakpoint }}
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from "vue";

// Reactive state
const isDarkMode = ref(false);
const isExpanded = ref(true);
const isHighlighted = ref(false);
const selectedItems = ref<string[]>([]);
const activeAnimations = ref<string[]>([]);

// Form state
const formData = reactive({
  email: "",
  password: "",
  confirmPassword: "",
  username: "",
});

const fieldErrors = reactive<Record<string, string>>({});

// Computed classes
const containerClasses = computed(() => [
  "min-h-screen transition-all duration-300",
  isDarkMode.value ? "bg-gray-900" : "bg-gray-100",
]);

// Static data with dynamic classes
const items = ref([
  {
    id: "1",
    title: "Item One",
    description: "First item description",
    priority: "high",
  },
  {
    id: "2",
    title: "Item Two",
    description: "Second item description",
    priority: "medium",
  },
  {
    id: "3",
    title: "Item Three",
    description: "Third item description",
    priority: "low",
  },
  {
    id: "4",
    title: "Item Four",
    description: "Fourth item description",
    priority: "high",
  },
  {
    id: "5",
    title: "Item Five",
    description: "Fifth item description",
    priority: "medium",
  },
  {
    id: "6",
    title: "Item Six",
    description: "Sixth item description",
    priority: "low",
  },
]);

const formFields = [
  { name: "email", label: "Email", type: "email", required: true },
  { name: "username", label: "Username", type: "text", required: true },
  { name: "password", label: "Password", type: "password", required: true },
  {
    name: "confirmPassword",
    label: "Confirm Password",
    type: "password",
    required: true,
  },
];

const animations = [
  { name: "bounce", label: "Bounce", activeClass: "animate-bounce" },
  { name: "pulse", label: "Pulse", activeClass: "animate-pulse" },
  { name: "ping", label: "Ping", activeClass: "animate-ping" },
  { name: "spin", label: "Spin", activeClass: "animate-spin" },
];

const responsiveSizes = [
  { breakpoint: "xs", classes: "block sm:hidden p-2 bg-red-100 text-red-800" },
  {
    breakpoint: "sm",
    classes: "hidden sm:block md:hidden p-3 bg-orange-100 text-orange-800",
  },
  {
    breakpoint: "md",
    classes: "hidden md:block lg:hidden p-4 bg-yellow-100 text-yellow-800",
  },
  {
    breakpoint: "lg",
    classes: "hidden lg:block xl:hidden p-5 bg-green-100 text-green-800",
  },
  {
    breakpoint: "xl",
    classes: "hidden xl:block 2xl:hidden p-6 bg-blue-100 text-blue-800",
  },
  {
    breakpoint: "2xl",
    classes: "hidden 2xl:block p-7 bg-purple-100 text-purple-800",
  },
];

// Computed form validation
const isFormValid = computed(() => {
  return (
    Object.keys(fieldErrors).every((key) => !fieldErrors[key]) &&
    formFields.every((field) => (field.required ? formData[field.name] : true))
  );
});

// Methods with class generation
const buttonClasses = (variant: string) => {
  const baseClasses =
    "px-4 py-2 rounded-md font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1";

  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
    secondary:
      "bg-gray-200 hover:bg-gray-300 text-gray-900 focus:ring-gray-400",
    accent:
      "bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-500",
  };

  return `${baseClasses} ${variants[variant] || variants.secondary}`;
};

const getItemClasses = (item: any, index: number) => {
  const baseClasses =
    "p-4 bg-white rounded-lg shadow cursor-pointer transition-all duration-200";
  const isSelected = selectedItems.value.includes(item.id);
  const priorityColors = {
    high: "border-l-4 border-red-500",
    medium: "border-l-4 border-yellow-500",
    low: "border-l-4 border-green-500",
  };

  return [
    baseClasses,
    priorityColors[item.priority],
    isSelected ? "ring-2 ring-blue-500 bg-blue-50" : "hover:shadow-md",
    index % 2 === 0 ? "transform hover:scale-105" : "transform hover:-rotate-1",
  ];
};

const getFieldClasses = (field: any) => {
  return ["space-y-1", fieldErrors[field.name] ? "animate-shake" : ""];
};

const getFieldValidationColor = (field: any, prefix: string) => {
  if (fieldErrors[field.name]) {
    return `${prefix}-red-600`;
  } else if (formData[field.name] && !fieldErrors[field.name]) {
    return `${prefix}-green-600`;
  }
  return `${prefix}-gray-700`;
};

const getFieldInputClasses = (field: any) => {
  if (fieldErrors[field.name]) {
    return "border-red-500 focus:ring-red-500 bg-red-50";
  } else if (formData[field.name] && !fieldErrors[field.name]) {
    return "border-green-500 focus:ring-green-500 bg-green-50";
  }
  return "border-gray-300 focus:ring-blue-500";
};

// Methods
const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
};

const selectItem = (id: string) => {
  const index = selectedItems.value.indexOf(id);
  if (index > -1) {
    selectedItems.value.splice(index, 1);
  } else {
    selectedItems.value.push(id);
  }
};

const triggerAnimation = (name: string) => {
  if (!activeAnimations.value.includes(name)) {
    activeAnimations.value.push(name);
    setTimeout(() => {
      const index = activeAnimations.value.indexOf(name);
      if (index > -1) {
        activeAnimations.value.splice(index, 1);
      }
    }, 2000);
  }
};

const validateField = (fieldName: string) => {
  const value = formData[fieldName];

  switch (fieldName) {
    case "email":
      if (!value) {
        fieldErrors[fieldName] = "Email is required";
      } else if (!/\S+@\S+\.\S+/.test(value)) {
        fieldErrors[fieldName] = "Invalid email format";
      } else {
        delete fieldErrors[fieldName];
      }
      break;
    case "password":
      if (!value) {
        fieldErrors[fieldName] = "Password is required";
      } else if (value.length < 6) {
        fieldErrors[fieldName] = "Password must be at least 6 characters";
      } else {
        delete fieldErrors[fieldName];
      }
      break;
    case "confirmPassword":
      if (value !== formData.password) {
        fieldErrors[fieldName] = "Passwords do not match";
      } else {
        delete fieldErrors[fieldName];
      }
      break;
    default:
      if (!value) {
        fieldErrors[fieldName] = `${fieldName} is required`;
      } else {
        delete fieldErrors[fieldName];
      }
  }
};

const submitForm = () => {
  // Validate all fields
  formFields.forEach((field) => validateField(field.name));

  if (isFormValid.value) {
    console.log("Form submitted:", formData);
  }
};
</script>

<style scoped>
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}
</style>

<!-- 
This Vue component uses extensive dynamic class binding including:
- Computed classes with reactive state
- Array and object syntax for class binding
- Conditional classes with ternary operators
- Template literals in methods
- Complex validation states
- Responsive design utilities
- Animation and transition classes
- Pseudo-class variants (hover, focus)
- State-driven styling patterns
-->
