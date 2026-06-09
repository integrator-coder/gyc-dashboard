# GBP Merge Location - UI Flow Reference

## Step 1: Select Target Location

```
┌─────────────────────────────────────────────┐
│ Merge Location                        Step 1 of 3 │
├─────────────────────────────────────────────┤
│                                             │
│ Merge "Apple Tree - Athens" into another   │
│ location.                                   │
│                                             │
│ Merge into:                                 │
│ ┌─────────────────────────────────────────┐ │
│ │ -- Select a location --             ▼ │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [       Compare →       ]  [  Cancel  ]    │
└─────────────────────────────────────────────┘
```

**After selecting:** Dropdown shows all other active locations for this client.

---

## Step 2: Resolve Conflicts

```
┌─────────────────────────────────────────────────────────────────────┐
│ Merge Location                                        Step 2 of 3   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Choose which values to keep when both records have data.            │
│                                                                     │
│ CONFLICTING FIELDS                                                  │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Location Name                                                   │ │
│ │ ┌──────────────────────────────┬───────────────────────────────┐│ │
│ │ │ ○ Apple Tree - Athens        │ ● Apple Tree Prep Athens      ││ │
│ │ │   (will be removed)          │   (will be kept)              ││ │
│ │ └──────────────────────────────┴───────────────────────────────┘│ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Place ID                                                        │ │
│ │ ┌──────────────────────────────┬───────────────────────────────┐│ │
│ │ │ ● ChIJj09z...                │ ○ ChIJabc123...               ││ │
│ │ │   (will be removed)          │   (will be kept)              ││ │
│ │ └──────────────────────────────┴───────────────────────────────┘│ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ AUTO-RESOLVED (NO CONFLICT)                                         │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Address: 810 Olympic Dr                              [auto]    │ │
│ │ City: Athens                                         [auto]    │ │
│ │ State: GA                                            [auto]    │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [← Back]       [    Continue →    ]       [  Cancel  ]            │
└─────────────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Click either radio button to choose which value to keep
- Selected option gets blue background highlight
- Auto-resolved fields are grayed out and non-interactive

---

## Step 3: Confirm Merge

```
┌─────────────────────────────────────────────┐
│ Merge Location                 Step 3 of 3  │
├─────────────────────────────────────────────┤
│                                             │
│ Confirm merge: Apple Tree - Athens →       │
│                Apple Tree Prep Athens       │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ SUMMARY                                 │ │
│ │ • Keeping 1 value(s) from Apple Tree -  │ │
│ │   Athens                                │ │
│ │ • Keeping 1 value(s) from Apple Tree    │ │
│ │   Prep Athens                           │ │
│ │ • Auto-resolving 3 field(s) with no     │ │
│ │   conflict                              │ │
│ │ • Apple Tree - Athens will be removed   │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [← Back]  [  Confirm Merge  ]  [  Cancel ] │
└─────────────────────────────────────────────┘
```

**Final action:**
- Clicking "Confirm Merge" sends the API request with all field choices
- Modal shows "Merging..." during API call
- On success: modal closes, GBP data refreshes, merged location appears in the list
- On error: error message appears at top of modal, user can try again or go back

---

## Visual States

### Radio Button Selection (Step 2)

**Unselected option:**
```
┌────────────────────────────────┐
│ ○ Apple Tree - Athens          │  (gray background)
│   (will be removed)            │
└────────────────────────────────┘
```

**Selected option:**
```
┌────────────────────────────────┐
│ ● Apple Tree Prep Athens       │  (blue background)
│   (will be kept)               │
└────────────────────────────────┘
```

### Auto-resolved Fields (Step 2)

```
┌─────────────────────────────────────────────┐
│ Address: 810 Olympic Dr          [auto]    │  (italic gray text)
│ City: Athens                     [auto]    │
└─────────────────────────────────────────────┘
```

---

## Error Handling

**If merge fails:**
```
┌─────────────────────────────────────────────┐
│ ⚠ Failed to merge locations: Database      │  (red border/background)
│   connection timeout                        │
└─────────────────────────────────────────────┘
```

**If user tries to merge location with itself:**
```
┌─────────────────────────────────────────────┐
│ ⚠ Cannot merge a location with itself      │
└─────────────────────────────────────────────┘
```

---

## Keyboard Navigation

- Tab through form elements
- Space/Enter to select radio buttons
- Enter on "Compare →" / "Continue →" / "Confirm Merge" buttons
- Escape to cancel (TODO: could add this)

---

## Responsive Design

Modal uses:
- `max-w-3xl` — wider to fit side-by-side comparison
- `max-h-[90vh] overflow-y-auto` — scrollable on small screens
- Grid layout collapses to single column on mobile (TODO: test this)

---

## Color Scheme (GYC Dark Theme)

- Background: `bg-gradient-to-br from-black via-gray-900 to-black`
- Border: `border-blue-500/30`
- Primary action button: `bg-blue-600 hover:bg-blue-500`
- Record A (delete): `text-rose-400` (pink/red)
- Record B (keep): `text-emerald-400` (green)
- Selected radio: `bg-blue-600/30` (semi-transparent blue)
- Auto-resolved: `text-gray-400 italic`
