# Plan: Sort Sidebar Items and Add Lending Icon

## Context
The sidebar navigation needs two changes:
1. Reorder nav items to: Dashboard, Transactions, Lending, Categories, Reports
2. Add an SVG icon for the Lending item (currently shows nothing)

## File to Modify
`src/lib/components/Sidebar.svelte`

## Change 1: Reorder navItems array (lines 5-11)

**Current order:**
```typescript
const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/transactions', label: 'Transactions', icon: 'creditcard' },
    { href: '/categories', label: 'Categories', icon: 'tags' },
    { href: '/reports', label: 'Reports', icon: 'chart' },
    { href: '/lending', label: 'Lending', icon: 'lending' },
];
```

**Change to:**
```typescript
const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/transactions', label: 'Transactions', icon: 'creditcard' },
    { href: '/lending', label: 'Lending', icon: 'lending' },
    { href: '/categories', label: 'Categories', icon: 'tags' },
    { href: '/reports', label: 'Reports', icon: 'chart' },
];
```

## Change 2: Add Lending SVG icon (around line 109, before `{:else if item.icon === 'chart'}`)

**Add this block:**
```svelte
{:else if item.icon === 'lending'}
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 12h8"/>
        <path d="M12 8v8"/>
        <circle cx="12" cy="12" r="10"/>
    </svg>
```
Note: This is a target/crosshair-style icon representing "aiming" to get money back. Alternatively, use a handshake or bill icon.

**Alternative (recommended - peso/handshake):**
```svelte
{:else if item.icon === 'lending'}
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 6.1H3"/>
        <path d="M21 12.1H3"/>
        <path d="M15.1 18H3"/>
        <circle cx="20" cy="19" r="2"/>
        <circle cx="4" cy="5" r="2"/>
    </svg>
```

## Verification
1. Run `npm run dev`
2. Check sidebar order: Dashboard → Transactions → Lending → Categories → Reports
3. Check Lending nav item shows the icon correctly