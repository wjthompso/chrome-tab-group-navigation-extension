# Chrome Tab Group Navigation Extension

Keyboard selector for native Chrome tab groups in the current window. The toolbar popup has no default shortcut. Extra commands are listed on the shortcuts page with no key assigned, so they will not collide with Option+Shift shortcuts until you set one.

## Load unpacked

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder — the one that contains `manifest.json`.

After code changes, click the reload icon on this extension's card.

## Inspect

- **Popup:** click the toolbar icon, right-click inside the popup, and choose **Inspect**.
- **Service worker:** on `chrome://extensions`, find this extension and click the **service worker** link.

## Keyboard

Highlight and Chrome's active tab are independent. The first highlight is the group that contains this window's active tab, or the first group if that tab is ungrouped.

The popup is titled **Tab Group Navigation**. Under that it names the open group, for example “Open group: Linear”, and that group is also a row marked “current”. The list is built from every tab in the normal window, so the focused group is included even when Chrome’s group query skips it. Order follows the tab strip, not alphabetical order.

| Key | Action |
| --- | --- |
| Up / Down | Move the highlight only. Does not activate or expand a group. |
| Left / Right | Move the highlighted group one group to the left or right. Works while collapsed. |
| Space | Collapse or expand the highlighted group only. |
| R | Rename. Letters go into the field. Enter saves. Escape cancels and leaves the popup open. |
| Enter | Activate the group, then close the popup. |
| 1–9 | Open that frozen tab scene, then close the popup. |
| Shift+1–9 | Save this window’s groups into that slot, or overwrite the slot. |
| Escape | Close the popup. |

At either end, the popup says "No group to the left" or "No group to the right". Ungrouped tabs on that side do not count as a neighbor.

Clicking a row moves the highlight. Enter is what opens the group.

## Moving groups

The popup lists every group in the window, including the one that contains the active tab, left to right. `chrome.tabGroups.query()` is not strip order; the extension sorts by each group's first tab. Other window types show an explanation and an empty list.

`chrome.tabGroups.move` takes a tab insertion index applied **after** the group is removed. Left inserts at the previous group's first tab. Right inserts just after the next group. The extension does not move tabs one by one, and it does not use `-1` (end of the window) for a single step right.

Collapsed groups still occupy real tab indices. A move does not ask Chrome to change collapsed state. If the collapsed flag flips anyway, the extension writes the previous value back.

One move cannot keep loose tabs between the two groups it swaps:

```
Before:  [pin] [Work Work] [loose] [Research ×3] [Personal Personal]
Right:   [pin] [Work Work] [loose] [Personal Personal] [Research ×3]
Left:    [pin] [Research ×3] [Work Work] [loose] [Personal Personal]
```

Research + Right lands on Personal's far side. The loose tab stays left of Personal. Research + Left swaps Research with Work, and the loose tab that was between them ends up after Work, still before Personal.

## Last active tab

Enter prefers the last tab that was activated in that group. The id is stored in `chrome.storage.session` (session-only storage; it clears when the browser session ends) under `lastActiveTabIdByGroup`. Only numeric tab ids are stored — no URLs, titles, or favicons.

The service worker suspends, so this map lives in session storage, not in a global. It records a tab when you activate it while it belongs to a real group. It forgets a group when the group is removed, and forgets an entry when that tab is closed.

Nothing is backfilled when the popup opens. Until a tab in that group has been activated while this extension was installed during this browser session, Enter uses the group's first tab (lowest `index`). The same fallback is used if the stored tab is gone or no longer in the group.

## Group tabs by domain

On `chrome://extensions/shortcuts`, **Tab Group Navigation** has a command named “Group tabs by domain, title-case the name, and collapse”. It has no default key. Assign one there after you turn off the other extension’s matching shortcut, if you still use it.

The command looks at the focused normal window. Pinned tabs and browser pages (such as `chrome://`) stay where they are. Every other web tab is grouped by its site: `mail.google.com` and `www.google.com` become one group named **Google**, then that group is collapsed. The name keeps only the label before the first dot. Hyphenated names become **My-Cool-Site**. A country site such as `bbc.co.uk` becomes **Bbc**, and `gitea.parquesnacionales.gov.co` becomes **Parquesnacionales** because `.gov.co` is the country ending, not the name. Official brand spelling is not special-cased, so GitHub is **Github**.

Tabs that already share a domain and are already alone in one group are renamed and collapsed in place. Otherwise they are gathered into a new group, which pulls them out of any hand-made group they were in.

## Collapse or expand all groups

On `chrome://extensions/shortcuts`, the command appears as **Collapse/expand all groups**. It has no default key. Move Option+Shift+E onto this command yourself after you disable the other extension’s binding.

The command looks at the focused normal window. If any group is expanded, it collapses every group, including the one that contains the active tab. If every group is already collapsed, it expands all of them. With no groups, it does nothing.

## Collapse or expand the current group

On `chrome://extensions/shortcuts`, the command appears as **Collapse/expand the current tab group**. It has no default key.

The command looks at the focused normal window. If the active tab is in a group, that group folds when it is expanded and expands when it is folded. Other groups stay as they are. If the active tab is not in a group, it does nothing.

## Tab scenes

Nine frozen scenes, numbered 1 through 9, are listed under the group list. A scene stores each colored group label in the front window: its name, color, whether it is folded, and the page addresses in that group. Website tabs that are not in a colored group label are not stored. Editing the open tabs does not change the scene. Shift+1 through Shift+9, or the slot’s Save / Overwrite button, writes the current labels into that slot. If the tab row has no colored group labels, the popup says “No tab groups to save.”

Press 1 through 9 in the popup to open that slot. Opening replaces the front window’s tab row with the saved copy. Other windows stay as they are. Colored group labels this extension created are ungrouped first, while they are still in the tab row, so Chrome does not keep a saved group name for them. Colored group labels you created yourself only have their website tabs closed, and Chrome may keep those as saved group names on the new-tab page.

On `chrome://extensions/shortcuts`, the commands are “Open tab scene 1” through “Open tab scene 9”. They have no default key. Assign one combination per scene there, for example Option+Shift+1. Chrome fires one combination at a time. A two-step chord, such as a leader key and then a number, only exists inside the popup: open the popup, then press the number.

## Permissions

`tabGroups`, `storage`, and `tabs`. The `tabs` permission lets the extension read each tab’s address. Chrome shows that permission as “Read your browsing history.” Domain grouping uses the address only in memory. Tab scenes save group names and page addresses in `chrome.storage.local` on this computer. Addresses are not sent anywhere. The selector itself only needs tab id, index, and group id.

## Not in this milestone

Multi-select and the group/ungroup toggle come later.
