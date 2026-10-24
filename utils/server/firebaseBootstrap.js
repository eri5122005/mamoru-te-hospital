// Product-facing server entry. The core remains directly testable in Node.
import 'server-only';

export { validateServerFirebaseConfig, createMockServerFirebaseBootstrap } from './firebaseBootstrapCore.js';
