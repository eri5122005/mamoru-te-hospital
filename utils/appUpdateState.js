let snapshot = { required: false, operations: 0, hasInput: false, reloading: false };
const listeners = new Set();
const publish = changes => { snapshot = { ...snapshot, ...changes }; listeners.forEach(fn => fn()); };
export const subscribeAppUpdate = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const getAppUpdateState = () => snapshot;
export const getServerAppUpdateState = () => serverSnapshot;
const serverSnapshot = { required: false, operations: 0, hasInput: false, reloading: false };
export const requireAppUpdate = () => { if (!snapshot.required) publish({ required: true }); };
export const setUpdateInput = hasInput => { if (snapshot.hasInput !== hasInput) publish({ hasInput }); };
export function beginUpdateOperation() {
  publish({ operations: snapshot.operations + 1 });
  let ended = false;
  return () => { if (!ended) { ended = true; publish({ operations: snapshot.operations - 1 }); } };
}
export function reloadUpdatedApp(reload) {
  if (!snapshot.required || snapshot.operations > 0 || snapshot.reloading) return false;
  // Set the latch before notifying React or saving the draft.
  publish({ reloading: true });
  let reloadStarted = false;
  try {
    if (updatePreparation) updatePreparation();
    if (snapshot.operations > 0) return false;
    reloadStarted = true;
    reload();
    return true;
  } finally {
    // Preparation failure is retryable; a requested navigation is never repeated.
    if (!reloadStarted) publish({ reloading: false });
  }
}

let updatePreparation = null;
export function registerUpdatePreparation(prepare) {
  updatePreparation = prepare;
  return () => { if (updatePreparation === prepare) updatePreparation = null; };
}
