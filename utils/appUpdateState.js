let snapshot = { required: false, operations: 0, hasInput: false };
const listeners = new Set();
const publish = changes => { snapshot = { ...snapshot, ...changes }; listeners.forEach(fn => fn()); };
export const subscribeAppUpdate = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const getAppUpdateState = () => snapshot;
export const getServerAppUpdateState = () => serverSnapshot;
const serverSnapshot = { required: false, operations: 0, hasInput: false };
export const requireAppUpdate = () => { if (!snapshot.required) publish({ required: true }); };
export const setUpdateInput = hasInput => { if (snapshot.hasInput !== hasInput) publish({ hasInput }); };
export function beginUpdateOperation() {
  publish({ operations: snapshot.operations + 1 });
  let ended = false;
  return () => { if (!ended) { ended = true; publish({ operations: snapshot.operations - 1 }); } };
}
export function reloadUpdatedApp(reload) {
  if (!snapshot.required || snapshot.operations > 0) return false;
  reload();
  return true;
}
