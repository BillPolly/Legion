// Test what the new button regex actually captures

const buttonPattern = /^[Aa]\s+button\s+(?:labeled\s+)?"([^"]+)"[^a-zA-Z]*(?:that\s+(.+?)\s+on\s+(\w+))?$/;

const testLines = [
  'A button labeled "+1" that increments the count on click',
  'A button labeled "-1" that decrements the count on click',
  'A button labeled "Reset" that sets the count to 0 on click',
  'A button labeled "-1"/ that decrements the count on click',
];

testLines.forEach(line => {
  const match = line.match(buttonPattern);
  console.log(`\nLine: "${line}"`);
  if (match) {
    console.log('  match[0] (full):', match[0]);
    console.log('  match[1] (label):', match[1]);
    console.log('  match[2] (action):', match[2]);
    console.log('  match[3] (event):', match[3]);
  } else {
    console.log('  NO MATCH');
  }
});