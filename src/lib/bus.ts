type Handler = (sessionId: string) => void;

const handlers = new Set<Handler>();

export function publish(sessionId: string): void {
  for (const handler of handlers) handler(sessionId);
}

export function subscribe(handler: Handler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}
