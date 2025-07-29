# CLI Terminal Feature Test Checklist

## Tab Cycling Feature

### Test 1: Basic Tab Cycling
1. Type `mod` and press Tab
   - **Expected**: Autocomplete shows suggestions (module_list, module_load, etc.)
   - **Expected**: No item is initially selected (selectedIndex = -1)
2. Press Tab again
   - **Expected**: First item gets selected (highlighted)
3. Press Tab repeatedly
   - **Expected**: Selection cycles through all items
4. Press Tab after last item
   - **Expected**: Selection wraps to no selection (selectedIndex = -1)
5. Press Tab again
   - **Expected**: Selection wraps to first item

### Test 2: Enter Key Behavior
1. Type `mod` and press Tab to show suggestions
2. Tab to select `module_list`
3. Press Enter
   - **Expected**: Selected suggestion is applied
   - **Expected**: Command executes

### Test 3: Escape Key
1. Type `mod` and press Tab
2. Press Escape
   - **Expected**: Autocomplete hides
   - **Expected**: Ghost text also hides

## Ghost Text Feature

### Test 1: Basic Ghost Text
1. Type `module_load ` (with space at end)
   - **Expected**: Ghost text shows `<name>` after the cursor
   - **Expected**: Ghost text is gray (#888)
   - **Expected**: Ghost text position is correctly offset

### Test 2: Ghost Text with Autocomplete
1. Type `module_load ser`
   - **Expected**: Autocomplete shows suggestions
   - **Expected**: Ghost text STILL shows `<name>` after "ser"
   - **Expected**: Both features work together

### Test 3: Ghost Text for Different Commands
1. Type `context_add ` 
   - **Expected**: Ghost text shows `<name>`
2. Type `context_list `
   - **Expected**: Ghost text shows `[filter]`
3. Type `file_read `
   - **Expected**: Ghost text shows `<filepath>`

### Test 4: Ghost Text Updates
1. Type `module_load serper `
   - **Expected**: No ghost text (all required params provided)
2. Delete back to `module_load `
   - **Expected**: Ghost text reappears showing `<name>`

## Combined Feature Test

### Test 1: Tab + Ghost Text
1. Type `cont` and Tab to cycle to `context_add`
2. Press Enter to apply
   - **Expected**: Input becomes `context_add `
   - **Expected**: Ghost text immediately shows `<name>`

### Test 2: Similar Command Hints
1. Type `modul_load ` (typo)
   - **Expected**: Ghost text still shows based on similar command `module_load`
   - **Expected**: Ghost text shows `<name>` even with typo

## Edge Cases

### Test 1: Empty Input
1. Clear input completely
   - **Expected**: No ghost text
   - **Expected**: No autocomplete

### Test 2: Multiple Arguments
1. Type `file_write test.txt `
   - **Expected**: Ghost text shows `<content>` (second parameter)

### Test 3: Built-in Commands
1. Type `.search `
   - **Expected**: Ghost text shows `<term>`
2. Type `.describe `
   - **Expected**: Ghost text shows `<command>`

## Visual Verification

1. Ghost text color: Should be #888 (gray)
2. Ghost text positioning: Should appear right after cursor with small gap
3. Ghost text visibility: Should be 0.6 opacity
4. Autocomplete selection: Selected item should have different background (#2d2d30)
5. Both features visible: Ghost text and autocomplete should coexist

## Performance

1. Fast typing should update ghost text smoothly
2. Tab cycling should be instant with no lag
3. No flickering when showing/hiding elements