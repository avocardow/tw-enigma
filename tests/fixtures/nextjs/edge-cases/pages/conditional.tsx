import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";

interface ConditionalPageProps {
  theme: "light" | "dark";
  variant: string;
}

const ConditionalPage: React.FC<ConditionalPageProps> = ({
  theme,
  variant,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userPreference, setUserPreference] = useState<"compact" | "expanded">(
    "expanded",
  );
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Dynamic class generation with complex conditionals
  const getContainerClasses = () => {
    const baseClasses = "min-h-screen transition-all duration-300";
    const themeClasses =
      theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-gray-900";

    const variantClasses =
      variant === "premium"
        ? "border-2 border-gold-500 shadow-gold-lg"
        : "border border-gray-300 shadow-md";

    return `${baseClasses} ${themeClasses} ${variantClasses}`;
  };

  const getContentClasses = () => {
    if (isLoading) {
      return "opacity-50 blur-sm pointer-events-none";
    }

    return userPreference === "compact"
      ? "max-w-2xl mx-auto px-4 py-8"
      : "max-w-6xl mx-auto px-8 py-12";
  };

  // Template literal with complex expressions
  const cardClasses = `
    relative p-6 rounded-lg 
    ${theme === "dark" ? "bg-gray-800 hover:bg-gray-750" : "bg-gray-50 hover:bg-gray-100"}
    ${variant === "premium" ? "ring-2 ring-gold-400" : "ring-1 ring-gray-200"}
    ${isLoading ? "animate-pulse" : "hover:shadow-lg"}
    transition-all duration-200 ease-in-out
  `
    .trim()
    .replace(/\s+/g, " ");

  // Computed classes using array join
  const buttonVariants = {
    primary: [
      "bg-blue-600",
      "hover:bg-blue-700",
      "text-white",
      "focus:ring-blue-500",
    ],
    secondary: [
      "bg-gray-200",
      "hover:bg-gray-300",
      "text-gray-900",
      "focus:ring-gray-400",
    ],
    danger: [
      "bg-red-600",
      "hover:bg-red-700",
      "text-white",
      "focus:ring-red-500",
    ],
  };

  return (
    <div className={getContainerClasses()}>
      <div className={getContentClasses()}>
        <h1
          className={`text-4xl font-bold mb-8 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
        >
          Conditional Styling Demo
        </h1>

        <div className={cardClasses}>
          <h2 className="text-2xl font-semibold mb-4">Dynamic Content Card</h2>

          <div className="space-y-4">
            {/* Responsive grid with breakpoint-specific classes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className={`
                    p-4 rounded border
                    ${item % 2 === 0 ? "bg-blue-50 border-blue-200" : "bg-green-50 border-green-200"}
                    hover:scale-105 transform transition-transform
                    focus-within:ring-2 focus-within:ring-offset-2
                    ${theme === "dark" ? "dark:bg-gray-700 dark:border-gray-600" : ""}
                  `}
                >
                  Item {item}
                </div>
              ))}
            </div>

            {/* Complex state-driven styling */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(buttonVariants).map(([variant, classes]) => (
                <button
                  key={variant}
                  className={`
                    px-4 py-2 rounded-md font-medium transition-colors duration-150
                    focus:outline-none focus:ring-2 focus:ring-offset-2
                    ${classes.join(" ")}
                    ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  `}
                  disabled={isLoading}
                >
                  {variant.charAt(0).toUpperCase() + variant.slice(1)}
                </button>
              ))}
            </div>

            {/* Pseudo-class heavy section */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-lg"></div>
              <div className="relative p-6 border-2 border-dashed border-gray-300 group-hover:border-purple-400 transition-colors rounded-lg">
                <p className="text-center text-gray-600 group-hover:text-purple-600">
                  Hover to see group effects
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Media query and utility combinations */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className={`
                aspect-square rounded-lg flex items-center justify-center text-xs font-bold
                ${i % 4 === 0 ? "bg-red-100 text-red-800" : ""}
                ${i % 4 === 1 ? "bg-blue-100 text-blue-800" : ""}
                ${i % 4 === 2 ? "bg-green-100 text-green-800" : ""}
                ${i % 4 === 3 ? "bg-yellow-100 text-yellow-800" : ""}
                hover:scale-110 transform transition-transform duration-150
                sm:text-sm md:text-base
              `}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConditionalPage;

// This page uses extensive conditional classes, template literals,
// computed styling, responsive utilities, and pseudo-class variants
// to test edge cases in class extraction
