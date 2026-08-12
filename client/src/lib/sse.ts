export interface SSEHandlers {
  onToolCall?: (data: { id: string; tool: string; args: unknown }) => void;
  onToolResult?: (data: { id: string; tool: string; summary: string }) => void;
  onMessage?: (data: { content: string }) => void;
  onDone?: (data: { outputPaths: string[] }) => void;
  onError?: (error: string) => void;
}

export function createSSEConnection(url: string, handlers: SSEHandlers): { close: () => void } {
  const eventSource = new EventSource(url);

  eventSource.addEventListener("tool_call", (e: MessageEvent) => {
    handlers.onToolCall?.(JSON.parse(e.data));
  });

  eventSource.addEventListener("tool_result", (e: MessageEvent) => {
    handlers.onToolResult?.(JSON.parse(e.data));
  });

  eventSource.addEventListener("message", (e: MessageEvent) => {
    handlers.onMessage?.(JSON.parse(e.data));
  });

  eventSource.addEventListener("done", (e: MessageEvent) => {
    const data = JSON.parse(e.data);
    handlers.onDone?.(data);
    eventSource.close();
  });

  eventSource.addEventListener("error", () => {
    handlers.onError?.("Connection lost or stream failed");
    eventSource.close();
  });

  return { close: () => eventSource.close() };
}
