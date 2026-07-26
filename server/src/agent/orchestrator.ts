import { streamText, isStepCount } from "ai";
import type { Response } from "express";
import { createModel } from "./provider-factory";
import { createTools } from "./tools";
import { buildSystemPrompt } from "./system-prompt";
import type { AgentSession } from "./session-store";

export async function runAgentStream(session: AgentSession, res: Response): Promise<void> {
  const model = createModel(session.settings);
  const tools = createTools(session.userId);
  const systemPrompt = buildSystemPrompt(session.resumeProjectPath);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sendSSE = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: [
        {
          role: "user" as const,
          content: `Tailor my resume at "${session.resumeProjectPath}" for this job: ${session.jobUrl}`,
        },
      ],
      tools,
      stopWhen: isStepCount(20),
      onToolExecutionStart: ({ toolCall }) => {
        sendSSE("tool_call", {
          id: toolCall.toolCallId,
          tool: toolCall.toolName,
          args: toolCall.input,
        });
      },
      onToolExecutionEnd: ({ toolCall, toolOutput }) => {
        const summary =
          toolOutput.type === "tool-result"
            ? typeof toolOutput.output === "string"
              ? toolOutput.output.slice(0, 500)
              : JSON.stringify(toolOutput.output).slice(0, 500)
            : `Error: ${toolOutput.error}`;
        sendSSE("tool_result", {
          id: toolCall.toolCallId,
          tool: toolCall.toolName,
          summary,
        });
      },
    });

    for await (const chunk of result.textStream) {
      sendSSE("message", { content: chunk });
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
    if (!res.writableEnded) {
      res.end();
    }
  }
}
