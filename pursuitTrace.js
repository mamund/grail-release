// Optional diagnostic collector for the existing Client and Server event hooks.
// Attach before a pursuit. No runtime imports or changes are required.
export function createPursuitTrace() {
  const events = [];
  let sequence = 0;

  function attach(client, server = client.server) {
    if (!client || !server) throw new TypeError('Client and server are required');
    const previousStack = client.onStackEvent;
    const previousSelection = server.onSelectionEvent;
    const record = (event) => {
      try {
        events.push({ ...event, sequence: ++sequence });
      } catch {
        // Tracing is diagnostic and must never interrupt execution.
      }
    };
    const forward = (callback, event) => {
      if (typeof callback === 'function') {
        try { callback(event); } catch { /* Diagnostic callbacks are isolated. */ }
      }
    };
    const stackHook = event => { record(event); forward(previousStack, event); };
    const selectionHook = event => { record(event); forward(previousSelection, event); };
    client.onStackEvent = stackHook;
    server.onSelectionEvent = selectionHook;
    let detached = false;
    return () => {
      if (detached) return;
      detached = true;
      if (client.onStackEvent === stackHook) client.onStackEvent = previousStack;
      if (server.onSelectionEvent === selectionHook) server.onSelectionEvent = previousSelection;
    };
  }

  return { events, attach };
}
