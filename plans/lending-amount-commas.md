# Plan: Auto-Add Commas to Amount Input in Lending Route

## Context
The amount input in the lending form should display commas as the user types (e.g., "1,000,000" instead of "1000000"). The pattern already exists in `TransactionForm.svelte` (lines 48-82).

## File to Modify
`src/routes/lending/+page.svelte`

## Approach
Mirror the same pattern used in `TransactionForm.svelte` (lines 48-82):

### 1. Add state and formatter function (after line 20):
```svelte
let rawAmount = $state('');
function formatWithCommas(value: string): string {
    const raw = value.replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}
```

### 2. Change input from `type="number"` to `type="text"` (line 120):
**Current:**
```svelte
<input id="amount" name="amount" type="number" step="0.01" required placeholder="0.00" />
```

**Change to:**
```svelte
<input
    id="amount"
    name="amount"
    type="text"
    inputmode="decimal"
    required
    placeholder="0.00"
    bind:value={rawAmount}
    oninput={(e) => {
        const input = e.target as HTMLInputElement;
        const raw = input.value.replace(/[^0-9.]/g, '');
        rawAmount = raw;
        input.value = formatWithCommas(raw);
    }}
    onblur={(e) => {
        const input = e.target as HTMLInputElement;
        input.value = formatWithCommas(rawAmount);
    }}
/>
```

### 3. Also format the amount on form submit (in `use:enhance`):
```svelte
oninput={(e) => { ... }}
onblur={(e) => {
    const input = e.target as HTMLInputElement;
    rawAmount = input.value.replace(/,/g, '');
    input.value = formatWithCommas(rawAmount);
}}
```

## Verification
1. Go to Lending page → New Lending
2. Type "1000000" → should display as "1,000,000"
3. Blur/focus out → should stay "1,000,000"
4. Submit form → should submit numeric value correctly