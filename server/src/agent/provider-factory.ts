import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LLMSettings } from "../settings.js";

export function createModel(settings: LLMSettings) {
  const { provider, apiKey, baseUrl, model } = settings;

  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey, baseURL: baseUrl })(model);
    case "gemini":
      return createGoogleGenerativeAI({ apiKey, baseURL: baseUrl })(model);
    case "claude":
      return createAnthropic({ apiKey, baseURL: baseUrl })(model);
    case "deepseek":
      return createDeepSeek({ apiKey, baseURL: baseUrl })(model);
    case "qwen":
      return createOpenAI({ apiKey, baseURL: baseUrl })(model);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
