# Manual Test Scenario Template

**Version:** 1.0
**Created:** 2025-01-22
**Purpose:** Standardized template for manual test scenario execution

---

## Scenario Information

### **Scenario ID:** [MANUAL-{Category}-{Number}]

_Example: MANUAL-UX-001, MANUAL-EDGE-003_

### **Scenario Title:** [Descriptive title of the test scenario]

### **Category:** [Category from manual-test-categories.md]

_Options: User Experience, Edge Case Validation, Error Message Assessment, Workflow Integration, Cross-Platform Behavior, Performance Perception, Documentation Verification, Accessibility Validation_

### **Priority:** [High/Medium/Low]

### **Complexity:** [Low/Medium/High]

### **Estimated Execution Time:** [X minutes]

---

## Test Definition

### **Objective**

_What is this test trying to validate or verify?_

### **Target User**

_Who is the intended user for this scenario? (e.g., new user, experienced developer, team lead)_

### **Prerequisites**

_What setup or conditions are required before executing this test?_

- [ ] Requirement 1
- [ ] Requirement 2
- [ ] Requirement 3

### **Test Environment**

_Specify the environment requirements for this test_

- **Operating System:** [Windows/macOS/Linux/All]
- **Terminal/Shell:** [bash/zsh/cmd/PowerShell/All]
- **Node.js Version:** [Specific version or range]
- **Project State:** [Fresh install/Existing project/Specific configuration]

---

## Test Execution Steps

### **Setup Phase**

1. **Step 1:** [Detailed setup instruction]
2. **Step 2:** [Additional setup if needed]
3. **Step 3:** [Environment verification]

### **Execution Phase**

1. **Step 1:** [First test action]

   - **Action:** [What to do]
   - **Expected Result:** [What should happen]
   - **Observation Notes:** [ ]

2. **Step 2:** [Second test action]

   - **Action:** [What to do]
   - **Expected Result:** [What should happen]
   - **Observation Notes:** [ ]

3. **Step 3:** [Additional steps as needed]
   - **Action:** [What to do]
   - **Expected Result:** [What should happen]
   - **Observation Notes:** [ ]

### **Validation Phase**

1. **Validation 1:** [What to check or verify]
2. **Validation 2:** [Additional verification]
3. **Validation 3:** [Final validation]

---

## Success Criteria

### **Pass Criteria**

_When should this test be considered successful?_

- [ ] Criteria 1: [Specific measurable outcome]
- [ ] Criteria 2: [User experience expectation]
- [ ] Criteria 3: [Technical requirement]

### **Fail Criteria**

_When should this test be considered failed?_

- [ ] Failure 1: [Specific failure condition]
- [ ] Failure 2: [User experience problem]
- [ ] Failure 3: [Technical issue]

---

## Results Recording

### **Test Execution Details**

- **Executed By:** [Tester name]
- **Execution Date:** [YYYY-MM-DD]
- **Execution Time:** [Start] - [End]
- **Environment:** [Actual environment used]

### **Result:** [PASS/FAIL/PARTIAL/BLOCKED]

### **Detailed Observations**

_Record what actually happened during the test_

### **Evidence Collection**

_Attach or reference evidence of test execution_

- [ ] Screenshots: [File names or descriptions]
- [ ] Command output: [Relevant output captured]
- [ ] Error messages: [Any errors encountered]
- [ ] Performance data: [If applicable]

### **Issues Identified**

_List any problems, bugs, or improvements identified_

1. **Issue 1:** [Description] - [Severity: High/Medium/Low]
2. **Issue 2:** [Description] - [Severity: High/Medium/Low]

### **Recommendations**

_Suggestions for improvements or follow-up actions_

---

## Integration with Automated Tests

### **Automated Test Coverage**

_Which automated tests cover related functionality?_

- [Reference to automated test file 1]
- [Reference to automated test file 2]

### **Manual-Specific Validation**

_What aspects require manual verification that automated tests cannot cover?_

### **Correlation Points**

_How do the results of this manual test relate to automated test results?_

---

## Quality Assurance

### **Validation Checklist**

- [ ] All prerequisites were met
- [ ] All execution steps were followed
- [ ] Results were properly documented
- [ ] Evidence was collected
- [ ] Issues were properly categorized
- [ ] Recommendations are actionable

### **Tester Notes**

_Additional notes, insights, or context for future test executions_

---

## Template Usage Instructions

### **How to Use This Template**

1. Copy this template for each new manual test scenario
2. Fill in all sections completely
3. Customize steps and criteria for your specific test
4. Execute the test following the defined steps
5. Record all observations and results
6. File any issues found according to project procedures

### **Template Customization**

- Add category-specific sections as needed
- Include additional validation steps for complex scenarios
- Extend evidence collection requirements for specific test types
- Add integration points with specific automated tests

### **Quality Guidelines**

- Be specific and measurable in success/fail criteria
- Include enough detail for test reproducibility
- Document not just what happened, but why it matters
- Provide clear next steps for any issues found
