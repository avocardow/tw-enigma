import React, { useState, useMemo } from "react";

interface ConditionalClassesProps {
  variant: "primary" | "secondary" | "danger" | "success";
  size: "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

export function ConditionalClasses({
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = false,
}: ConditionalClassesProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [count, setCount] = useState(0);

  // Complex conditional class generation
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";

  const variantClasses = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
    secondary: "bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
    success: "bg-green-600 hover:bg-green-700 text-white focus:ring-green-500",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
    xl: "px-8 py-4 text-xl",
  };

  // Dynamic classes based on state
  const stateClasses = useMemo(() => {
    const classes = [];

    if (disabled) {
      classes.push("opacity-50 cursor-not-allowed");
    }

    if (loading) {
      classes.push("cursor-wait");
    }

    if (fullWidth) {
      classes.push("w-full");
    }

    if (isHovered && !disabled) {
      classes.push("shadow-lg transform scale-105");
    }

    if (isFocused && !disabled) {
      classes.push("ring-4 ring-offset-2");
    }

    return classes.join(" ");
  }, [disabled, loading, fullWidth, isHovered, isFocused]);

  // Template literal with complex logic
  const containerClasses = `
    ${baseClasses}
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${stateClasses}
    ${count > 5 ? "animate-pulse" : ""}
    ${count > 10 ? "ring-4 ring-yellow-400" : ""}
  `
    .trim()
    .replace(/\s+/g, " ");

  // Conditional rendering with classes
  const renderIcon = () => {
    if (loading) {
      return (
        <svg
          className={`animate-spin -ml-1 mr-2 h-4 w-4 text-white ${size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : size === "xl" ? "h-6 w-6" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      );
    }

    return (
      <span
        className={`mr-2 ${variant === "danger" ? "text-red-200" : variant === "success" ? "text-green-200" : "text-blue-200"}`}
      >
        {variant === "danger" ? "⚠️" : variant === "success" ? "✅" : "🚀"}
      </span>
    );
  };

  return (
    <div className="p-8 space-y-6">
      {/* Main button with complex conditional classes */}
      <button
        className={containerClasses}
        disabled={disabled || loading}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onClick={() => setCount(count + 1)}
      >
        {renderIcon()}
        {loading ? "Loading..." : `Click me (${count})`}
      </button>

      {/* Complex conditional rendering */}
      <div
        className={`grid gap-4 ${fullWidth ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}`}
      >
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className={`
              p-4 rounded-lg border-2 transition-all duration-300
              ${i % 2 === 0 ? "bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200" : "bg-gradient-to-br from-purple-50 to-pink-100 border-purple-200"}
              ${count > i ? "opacity-100 scale-100" : "opacity-50 scale-95"}
              ${isHovered && count > i ? "shadow-lg border-opacity-100" : "shadow-sm border-opacity-50"}
              hover:shadow-xl hover:scale-105 hover:border-opacity-100
              ${i === count - 1 ? "ring-2 ring-yellow-400 ring-opacity-75" : ""}
            `}
          >
            <div
              className={`text-center ${i % 2 === 0 ? "text-blue-700" : "text-purple-700"}`}
            >
              <div
                className={`text-2xl mb-2 ${count > i ? "animate-bounce" : ""}`}
              >
                {i % 4 === 0
                  ? "🎯"
                  : i % 4 === 1
                    ? "🎨"
                    : i % 4 === 2
                      ? "🚀"
                      : "⭐"}
              </div>
              <p className="text-sm font-medium">Item {i + 1}</p>
              <div
                className={`mt-2 h-2 rounded-full ${count > i ? "bg-current" : "bg-gray-200"} transition-colors duration-500`}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic styles based on multiple conditions */}
      <div className="space-y-4">
        {[
          {
            condition: count > 3,
            text: "Great job!",
            classes: "bg-green-100 text-green-800 border-green-200",
          },
          {
            condition: count > 7,
            text: "You're on fire!",
            classes: "bg-orange-100 text-orange-800 border-orange-200",
          },
          {
            condition: count > 12,
            text: "Absolutely amazing!",
            classes: "bg-purple-100 text-purple-800 border-purple-200",
          },
          {
            condition: count > 20,
            text: "You're a legend!",
            classes: "bg-yellow-100 text-yellow-800 border-yellow-200",
          },
        ].map(
          (item, index) =>
            item.condition && (
              <div
                key={index}
                className={`
                p-4 rounded-lg border-2 transition-all duration-500 transform
                ${item.classes}
                ${isHovered ? "scale-105 shadow-lg" : "shadow-sm"}
                animate-fade-in
              `}
              >
                <p className="font-semibold">{item.text}</p>
                <p className="text-sm opacity-75">
                  You've clicked {count} times!
                </p>
              </div>
            ),
        )}
      </div>

      {/* CSS-in-JS style dynamic classes */}
      <div
        className={`
          relative overflow-hidden rounded-xl
          ${count % 2 === 0 ? "bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500" : "bg-gradient-to-r from-green-400 via-blue-500 to-purple-600"}
          ${count > 5 ? "animate-gradient-x" : ""}
        `}
        style={{
          backgroundSize: count > 5 ? "200% 200%" : "100% 100%",
          animation: count > 10 ? "gradient 3s ease infinite" : undefined,
        }}
      >
        <div className="relative z-10 p-6 text-white text-center">
          <h3 className="text-2xl font-bold mb-2">Dynamic Background</h3>
          <p className="text-white/80">
            This background changes based on the click count: {count}
          </p>
        </div>
        <div
          className={`
            absolute inset-0 opacity-20
            ${count > 15 ? "bg-white animate-pulse" : ""}
          `}
        ></div>
      </div>

      {/* Reset button */}
      <button
        onClick={() => {
          setCount(0);
          setIsHovered(false);
          setIsFocused(false);
        }}
        className={`
          px-4 py-2 text-sm font-medium rounded-md transition-all duration-200
          ${
            count > 0
              ? "bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }
        `}
        disabled={count === 0}
      >
        Reset ({count})
      </button>
    </div>
  );
}

// Additional edge case: HOC with conditional classes
export function withConditionalStyling<T extends Record<string, unknown>>(
  WrappedComponent: React.ComponentType<T>,
) {
  return function ConditionalStyledComponent(
    props: T & {
      theme?: "light" | "dark";
      variant?: "compact" | "expanded";
    },
  ) {
    const { theme = "light", variant = "expanded", ...restProps } = props;

    const wrapperClasses = `
      ${theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-gray-900"}
      ${variant === "compact" ? "p-2" : "p-6"}
      ${theme === "dark" && variant === "expanded" ? "shadow-2xl shadow-black/20" : "shadow-lg"}
      transition-all duration-300 rounded-lg
    `
      .trim()
      .replace(/\s+/g, " ");

    return (
      <div className={wrapperClasses}>
        <WrappedComponent {...(restProps as T)} />
      </div>
    );
  };
}
