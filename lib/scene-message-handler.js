import { openTabScene, saveTabScene } from './tab-scene-actions.js';

/**
 * Handle a scene open/save message. Returns the result object, or null for
 * unrecognized types (caller must skip sendResponse for null).
 * Does NOT call enqueue or touch writeChain — that is intentional.
 * @param {{ type: string, slot?: number, windowId?: number }} message
 * @param {object} api  chrome-compatible API object
 */
export async function handleSceneMessage(message, api) {
  if (message?.type === 'open-tab-scene') {
    return openTabScene(api, message.slot, message.windowId);
  }
  if (message?.type === 'save-tab-scene') {
    return saveTabScene(api, message.slot, message.windowId);
  }
  return null;
}
