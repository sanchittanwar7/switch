export const MAX_WEB_FETCH_RESULT_CHARS = 50_000;
const TRUNCATION_NOTICE = "\n\n[Result truncated at 50,000 characters.]";

export function truncateWebFetchResult(content: string): string {
  if (content.length <= MAX_WEB_FETCH_RESULT_CHARS) return content;
  return `${content.slice(0, MAX_WEB_FETCH_RESULT_CHARS - TRUNCATION_NOTICE.length)}${TRUNCATION_NOTICE}`;
}
