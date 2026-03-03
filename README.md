# CTRL+F Pro

Search across all your browser tabs at once. Uses the KMP algorithm for text matching.

## Features

- Search all open tabs from one search bar
- Live highlighting as you type
- Navigate between matches with keyboard
- Click a result to jump to that tab

## How It Works

Uses KMP (Knuth-Morris-Pratt) instead of built-in regex.

1. **Precompute**: Build the LPS failure table once for the pattern in O(m).
2. **Scan**: Reuse the table to scan every text node across all tabs in O(n) each.
3. **Total**: O(m + N) where m = pattern length, N = combined text of all tabs.

## Install

1. Download this folder
2. Go to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the folder

## Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Shift+F` | Open search |
| `Enter` | Next match |
| `Shift+Enter` | Previous match |
| `Esc` | Close |

## License

MIT
