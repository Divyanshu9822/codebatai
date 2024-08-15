export const summarizeFileDiff = (filename, patch) => `
  Review the changes in the file \`${filename}\` and summarize the modifications.

  Changes:
  \`\`\`diff
  ${patch}
  \`\`\`

  Instructions :

  I would like you to succinctly summarize the diff within 100 words.
  If applicable, your summary should include a note about alterations
  to the signatures of exported functions, global data structures and
  variables, and any changes that might affect the external interface or
  behavior of the code.

  OutputStructure:
  \`\`\`
  <fileSummary>Your summary here</fileSummary>
  \`\`\`
`;

export const triageFileDiff = (filename, summary) => `
  Based on the following summary of changes, triage the file as either \`NEEDS_REVIEW\` or \`APPROVED\`.

  File: \`${filename}\`

  Summary:
  \`\`\`
  ${summary}
  \`\`\`

  You must strictly follow the format below for triaging the diff:
  <TRIAGE> NEEDS_REVIEW or APPROVED </TRIAGE>

  Important:

  - In your summary do not mention that the file needs a through review or caution about
  potential issues.
  - Do not provide any reasoning why you triaged the diff as \`NEEDS_REVIEW\` or \`APPROVED\`.
  - Do not mention that these changes affect the logic or functionality of the code in the summary. You must only use the triage status format above to indicate that.

  OutputStructure:
  \`\`\`
  <TRIAGE> NEEDS_REVIEW or APPROVED </TRIAGE>
  \`\`\`
`;

export const summarizeChangesets = (rawSummary) => `
  Below is a list of changesets. Group related changes and remove duplicates.

  Changesets:
  \`\`\`
  ${rawSummary}
  \`\`\`

  OutputStructure:
  \`\`\`
  <groupedSummary>Your grouped summary here</groupedSummary>
  \`\`\`
`;

export const reviewFileDiff = (filename, summary, patch) => `
  File: \`${filename}\`

  Summary:
  \`\`\`
  ${summary}
  \`\`\`

  IMPORTANT Instructions :

  Input: New hunks annotated with line numbers and old hunks (replaced code). Hunks represent incomplete code fragments.
  Additional Context: PR title, description, summaries and comment chains.
  Task: Review new hunks for substantive issues using provided context and respond with comments if necessary.
  Output: Review comments in markdown with exact line number ranges in new hunks. Start and end line numbers must be within the same hunk. For single-line comments, start=end line number. Must use example response format below.
  Use fenced code blocks using the relevant language identifier where applicable.
  Don't annotate code snippets with line numbers. Format and indent code correctly.
  Do not use \`suggestion\` code blocks.
  For fixes, use \`diff\` code blocks, marking changes with \`+\` or \`-\`. The line number range for comments with fix snippets must exactly match the range to replace in the new hunk.

  - Do NOT provide general feedback, summaries, explanations of changes, or praises
  for making good additions.
  - Focus solely on offering specific, objective insights based on the
  given context and refrain from making broad comments about potential impacts on
  the system or question intentions behind the changes.

  If there are no issues found on a line range, you MUST respond with the
  text \`LGTM!\` for that line range in the review section.

  ## Example

  ### Example changes

  ---new_hunk---
  \`\`\`
  z = x / y
  return z

  20: def add(x, y):
  21: z = x + y
  22: retrn z
  23:
  24: def multiply(x, y):
  25: return x \* y

  def subtract(x, y):
  z = x - y
  \`\`\`

  ---old_hunk---
  \`\`\`
  z = x / y
  return z

  def add(x, y):
  return x + y

  def subtract(x, y):
  z = x - y
  \`\`\`

  ---comment_chains---
  \`\`\`
  Please review this change.
  \`\`\`

  ---end_change_section---

  ### Example response

  22-22:
  There's a syntax error in the add function.
  \`\`\`diff

  - retrn z

  * return z
  \`\`\`

  ---

  24-25:
  LGTM!

  ---

  Changes:
  \`\`\`diff
  ${patch}
  \`\`\`

  OutputStructure:
  \`\`\`
  <codeReview>Your review here</codeReview>
  \`\`\`
`;

export const walkthroughOfChanges = (groupedSummary) => `
  Provide a walkthrough of the changes made across all files in this pull request.

  Changes:
  \`\`\`
  ${groupedSummary}
  \`\`\`

  OutputStructure:
  \`\`\`
  <walkthrough>Your walkthrough here</walkthrough>
  \`\`\`
`;

export const categorizedSummary = (groupedSummary, prDescription) => `
  Categorize the changes into the following categories: Bug Fixes, New Features, etc.

  PR Description: ${prDescription}

  Changes:
  \`\`\`
  ${groupedSummary}
  \`\`\`

  OutputStructure:
  \`\`\`
  <summary>Your categorized summary here</summary>
  \`\`\`
`;