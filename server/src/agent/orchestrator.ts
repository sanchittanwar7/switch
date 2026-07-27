import { streamText, isStepCount } from "ai";
import type { Response } from "express";
import { createModel } from "./provider-factory";
import { createTools } from "./tools";
import { buildSystemPrompt } from "./system-prompt";
import { addMessage, setProcessing } from "./session-store";
import type { AgentSession } from "./session-store";

export async function runAgentStream(session: AgentSession, res: Response): Promise<void> {
  const model = createModel(session.settings);
  const tools = createTools(session.userId);
  const systemPrompt = buildSystemPrompt(session.resumeProjectPath);

  if (session.processing) {
    res.writeHead(409, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Session is already processing. Wait for current response to finish." }));
    return;
  }

  setProcessing(session.id, true);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sendSSE = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let assistantResponse = "";

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: session.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      tools,
      stopWhen: isStepCount(20),
      onToolExecutionStart: ({ toolCall }) => {
        addMessage(session.id, "tool_call", `${toolCall.toolName}(${JSON.stringify(toolCall.input)})`, {
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          toolInput: toolCall.input,
        });
        sendSSE("tool_call", {
          id: toolCall.toolCallId,
          tool: toolCall.toolName,
          args: toolCall.input,
        });
      },
      onToolExecutionEnd: ({ toolCall, toolOutput }) => {
        const fullResult =
          toolOutput.type === "tool-result"
            ? typeof toolOutput.output === "string"
              ? toolOutput.output
              : JSON.stringify(toolOutput.output)
            : `Error: ${toolOutput.error}`;
        addMessage(session.id, "tool_result", fullResult, {
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
        });
        sendSSE("tool_result", {
          id: toolCall.toolCallId,
          tool: toolCall.toolName,
          summary: fullResult.slice(0, 500),
        });
      },
    });

    for await (const chunk of result.textStream) {
      assistantResponse += chunk;
      sendSSE("message", { content: chunk });
    }

    if (assistantResponse) {
      addMessage(session.id, "assistant", assistantResponse);
    }

    sendSSE("done", { outputPaths: [] });
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Agent stream failed" }));
      return;
    }
    sendSSE("error", {
      message: err instanceof Error ? err.message : "Unknown error",
    });
  } finally {
    setProcessing(session.id, false);
    if (!res.writableEnded) {
      res.end();
    }
  }
}
