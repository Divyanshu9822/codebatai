export class Prompts {
  summarizeFileDiff = (filename, patch) => {
    return `
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
  };

  triageFileDiff = (filename, summary) => {
    return `
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
  };

  summarizeChangesets = (file, file_diff_summaries) => {
    return `
  Below is a list of file difference summary in file difference summaries and the list of commit messages linked to file. Analyse the file difference summary and provide a grouped summary of the changes under 50 words.

  Filename : ${file}

  File difference summaries:
  \`\`\`
  ${file_diff_summaries.join('\n')}
  \`\`\`

  Important:

  - In your grouped summary do not mention that the file needs a through review or caution about
  potential issues.
  - Do not mention anything about the commit message in the grouped summary.
  - Do not provide any reasoning about the summary you will be generating.
  - Do not mention that these changes affect the logic or functionality of the code in the grouped summary. You must only tell about the changes made in the file by analysing the file difference summaries list.

  OutputStructure:
  \`\`\`
  <groupedSummary>Your grouped summary here</groupedSummary>
  \`\`\`
`;
  };

  reviewFileDiff = (filename, summary, patch, prDescription, prTitle) => {
    return `
  File: \`${filename}\`

  PR Title: ${prTitle}

  PR Description: ${prDescription}

  Summary:
  \`\`\`
  ${summary}
  \`\`\`

  ---Instuctions Start---

  IMPORTANT Instructions :

  Input: New hunks annotated with line numbers and old hunks (replaced code). Hunks represent incomplete code fragments.
  Additional Context: PR title, description and summaries.
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

  ## Examples

  ### Example changes and responses for your better understanding. So no need to review/provide a response for these examples.

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

  ---Instructions End---

  ## Data:

  ### Changes:
  \`\`\`diff
  ${patch}
  \`\`\`

  ### OutputStructure:
  \`\`\`
  <codeReview>Your review as instructed here</codeReview>
  \`\`\`
`;
  };

  walkthroughOfChanges = (data) => {
    return `
  Provide a walkthrough of the changes made across all files in this pull request. Based on the provided changes data, give a detailed walkthrough within the <walkthrough> tag. 

  ## Changes Data:
  \`\`\`
  ${data}
  \`\`\`

  Important Instructions:
  - Walkthrough should not be in points format and must be in paragraph format. 
  - Do consider the priority of the changes/files and provide the walkthrough accordingly.
  - Do not provide any reasoning why and how you are providing the walkthrough.
  - You must given direct walkthrough in concise manner without any additional information.
  - Do not mention that these changes affect the logic or functionality of the code in the walkthrough. You must only tell about the brief changes in the file by analysing the file difference summaries list.

  OutputStructure:
  \`\`\`
  <walkthrough>Your walkthrough here</walkthrough>
  \`\`\`
`;
  };

  categorizedSummary = (data, prDescription, prTitle) => {
    return `
  Categorize the changes into the following categories: Bug Fixes, New Features, Docs, Refactor etc. for the new PR description in proper markdown format.

  PR Title: ${prTitle}

  PR Description: ${prDescription}

  Changes Data:
  \`\`\`
  ${data}
  \`\`\`

  Important:

  - Return response in list and sublist form to tell about the type of changes in the pull request.
  - Do not mention any particular file review , caution and potential issues in the categorized summary.
  - You must only list in what aspect the changes has been made in the pull request.

  OutputStructure:
  \`\`\`
  <summary>Your categorized summary here</summary>
  \`\`\`
`;
  };
}
