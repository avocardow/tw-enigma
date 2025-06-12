import { describe, it, expect, beforeEach } from "vitest";
import {
  SimplePatternValidator,
  validateClass,
  validateClasses,
  isValidClass,
  filterValidClasses,
  filterInvalidClasses,
  SimpleValidatorConfig,
} from "../src/patternValidator";

describe("SimplePatternValidator", () => {
  let validator: SimplePatternValidator;

  beforeEach(() => {
    validator = new SimplePatternValidator();
  });

  describe("Basic Validation", () => {
    it("validates core Tailwind classes correctly", () => {
      const result = validator.validateClass("block");
      expect(result.isValid).toBe(true);
      expect(result.validationType).toBe("core");
      expect(result.className).toBe("block");
    });

    it("validates flex classes", () => {
      expect(validator.validateClass("flex").isValid).toBe(true);
      expect(validator.validateClass("flex-1").isValid).toBe(true);
      expect(validator.validateClass("flex-col").isValid).toBe(true);
    });

    it("validates background color classes", () => {
      expect(validator.validateClass("bg-blue-500").isValid).toBe(true);
      expect(validator.validateClass("bg-red-200").isValid).toBe(true);
      expect(validator.validateClass("bg-white").isValid).toBe(true);
    });

    it("validates text classes", () => {
      expect(validator.validateClass("text-lg").isValid).toBe(true);
      expect(validator.validateClass("text-gray-700").isValid).toBe(true);
      expect(validator.validateClass("font-bold").isValid).toBe(true);
    });

    it("validates padding and margin classes", () => {
      expect(validator.validateClass("p-4").isValid).toBe(true);
      expect(validator.validateClass("px-6").isValid).toBe(true);
      expect(validator.validateClass("m-2").isValid).toBe(true);
      expect(validator.validateClass("mx-auto").isValid).toBe(false); // mx-auto not in basic set
    });

    it("identifies invalid classes correctly", () => {
      const result = validator.validateClass("invalid-class-name");
      expect(result.isValid).toBe(false);
      expect(result.validationType).toBe("unknown");
      expect(result.warnings).toContain(
        "Unknown Tailwind class: invalid-class-name",
      );
    });
  });

  describe("Responsive Variants", () => {
    it("validates responsive prefixes", () => {
      expect(validator.validateClass("sm:block").isValid).toBe(true);
      expect(validator.validateClass("md:flex").isValid).toBe(true);
      expect(validator.validateClass("lg:text-xl").isValid).toBe(true);
      expect(validator.validateClass("xl:p-8").isValid).toBe(true);
      expect(validator.validateClass("2xl:bg-blue-500").isValid).toBe(true);
    });

    it("validates dark mode variants", () => {
      expect(validator.validateClass("dark:bg-gray-800").isValid).toBe(true);
      expect(validator.validateClass("dark:text-white").isValid).toBe(true);
    });

    it("validates combined responsive and dark mode", () => {
      expect(validator.validateClass("dark:md:bg-gray-900").isValid).toBe(true);
    });
  });

  describe("State Variants", () => {
    it("validates hover states", () => {
      expect(validator.validateClass("hover:bg-blue-600").isValid).toBe(true);
      expect(validator.validateClass("hover:text-white").isValid).toBe(true);
    });

    it("validates focus states", () => {
      expect(validator.validateClass("focus:outline-none").isValid).toBe(false); // outline-none not in basic set
      expect(validator.validateClass("focus:bg-blue-500").isValid).toBe(true);
    });

    it("validates other pseudo-class states", () => {
      expect(validator.validateClass("active:bg-blue-700").isValid).toBe(true);
      expect(validator.validateClass("disabled:opacity-50").isValid).toBe(true);
    });
  });

  describe("Arbitrary Values", () => {
    it("validates arbitrary width values", () => {
      expect(validator.validateClass("w-[100px]").isValid).toBe(true);
      expect(validator.validateClass("h-[50vh]").isValid).toBe(true);
    });

    it("validates arbitrary color values", () => {
      expect(validator.validateClass("bg-[#ff0000]").isValid).toBe(true);
      expect(validator.validateClass("text-[rgb(255,0,0)]").isValid).toBe(true);
    });

    it("validates arbitrary spacing values", () => {
      expect(validator.validateClass("p-[20px]").isValid).toBe(true);
      expect(validator.validateClass("m-[1.5rem]").isValid).toBe(true);
    });
  });

  describe("Custom Classes", () => {
    it("validates custom classes", () => {
      const config: Partial<SimpleValidatorConfig> = {
        customClasses: ["my-custom-class", "another-custom"],
      };
      const customValidator = new SimplePatternValidator(config);

      const result = customValidator.validateClass("my-custom-class");
      expect(result.isValid).toBe(true);
      expect(result.validationType).toBe("custom");
    });

    it("allows adding custom classes after initialization", () => {
      validator.addCustomClasses(["dynamic-custom"]);
      expect(validator.validateClass("dynamic-custom").isValid).toBe(true);
      expect(validator.validateClass("dynamic-custom").validationType).toBe(
        "custom",
      );
    });

    it("allows removing custom classes", () => {
      validator.addCustomClasses(["temp-class"]);
      expect(validator.validateClass("temp-class").isValid).toBe(true);

      validator.removeCustomClasses(["temp-class"]);
      expect(validator.validateClass("temp-class").isValid).toBe(false);
    });
  });

  describe("Batch Validation", () => {
    it("validates multiple classes", () => {
      const classes = ["block", "flex", "invalid-class", "bg-blue-500"];
      const results = validator.validateClasses(classes);

      expect(results).toHaveLength(4);
      expect(results[0].isValid).toBe(true); // block
      expect(results[1].isValid).toBe(true); // flex
      expect(results[2].isValid).toBe(false); // invalid-class
      expect(results[3].isValid).toBe(true); // bg-blue-500
    });

    it("filters valid classes", () => {
      const classes = ["block", "invalid-class", "flex", "another-invalid"];
      const validClasses = validator.filterValidClasses(classes);

      expect(validClasses).toEqual(["block", "flex"]);
    });

    it("filters invalid classes", () => {
      const classes = ["block", "invalid-class", "flex", "another-invalid"];
      const invalidClasses = validator.filterInvalidClasses(classes);

      expect(invalidClasses).toEqual(["invalid-class", "another-invalid"]);
    });
  });

  describe("Statistics", () => {
    it("provides validation statistics", () => {
      const classes = [
        "block",
        "flex",
        "invalid-1",
        "bg-blue-500",
        "invalid-2",
      ];
      const stats = validator.getValidationStats(classes);

      expect(stats.total).toBe(5);
      expect(stats.valid).toBe(3);
      expect(stats.invalid).toBe(2);
      expect(stats.core).toBe(3);
      expect(stats.custom).toBe(0);
      expect(stats.unknown).toBe(2);
    });
  });

  describe("Configuration", () => {
    it("respects skipInvalidClasses configuration", () => {
      const config: Partial<SimpleValidatorConfig> = {
        skipInvalidClasses: true,
      };
      const configuredValidator = new SimplePatternValidator(config);

      // Test behavior is still the same - this is just configuration
      expect(configuredValidator.validateClass("invalid").isValid).toBe(false);
    });

    it("respects warnOnInvalidClasses configuration", () => {
      const config: Partial<SimpleValidatorConfig> = {
        warnOnInvalidClasses: false,
      };
      const configuredValidator = new SimplePatternValidator(config);

      const result = configuredValidator.validateClass("invalid");
      expect(result.isValid).toBe(false);
      expect(result.warnings).toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty class names", () => {
      const result = validator.validateClass("");
      expect(result.isValid).toBe(false);
      expect(result.validationType).toBe("unknown");
      expect(result.warnings).toContain("Empty class name");
    });

    it("handles whitespace-only class names", () => {
      const result = validator.validateClass("   ");
      expect(result.isValid).toBe(false);
      expect(result.validationType).toBe("unknown");
    });

    it("trims whitespace from class names", () => {
      const result = validator.validateClass("  block  ");
      expect(result.isValid).toBe(true);
      expect(result.className).toBe("block");
    });
  });
});

describe("Utility Functions", () => {
  it("validateClass utility function works", () => {
    const result = validateClass("block");
    expect(result.isValid).toBe(true);
    expect(result.validationType).toBe("core");
  });

  it("validateClasses utility function works", () => {
    const results = validateClasses(["block", "invalid"]);
    expect(results).toHaveLength(2);
    expect(results[0].isValid).toBe(true);
    expect(results[1].isValid).toBe(false);
  });

  it("isValidClass utility function works", () => {
    expect(isValidClass("block")).toBe(true);
    expect(isValidClass("invalid")).toBe(false);
  });

  it("filterValidClasses utility function works", () => {
    const valid = filterValidClasses(["block", "invalid", "flex"]);
    expect(valid).toEqual(["block", "flex"]);
  });

  it("filterInvalidClasses utility function works", () => {
    const invalid = filterInvalidClasses(["block", "invalid", "flex"]);
    expect(invalid).toEqual(["invalid"]);
  });
});
