// Simple test file with obvious repeating patterns for testing TW-Enigma
export default function SimpleTest() {
  return (
    <div>
      {/* These patterns should be detected as they appear multiple times */}
      <div className="a">Pattern 1</div>
      <div className="a">Pattern 1 repeated</div>
      <div className="a">Pattern 1 again</div>
      
      <div className="b">Pattern 2</div>
      <div className="b">Pattern 2 repeated</div>
      <div className="b">Pattern 2 again</div>
      
      <div className="c">Small pattern</div>
      <div className="c">Small pattern repeated</div>
      <div className="c">Small pattern again</div>
      
      <div className="d">Card pattern</div>
      <div className="d">Card pattern repeated</div>
      <div className="d">Card pattern again</div>
    </div>
  );
}