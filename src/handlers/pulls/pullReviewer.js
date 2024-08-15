import { generateChatCompletion } from '../../ai/generateChatCompletion.js';
import { extractFieldsWithTags } from '../../utils/index.js';

const summarizeFileDiff = (filename, patch) => `
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

const triageFileDiff = (filename, summary) => `
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

const summarizeChangesets = (rawSummary) => `
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

const reviewFileDiff = (filename, summary, patch) => `
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

const walkthroughOfChanges = (groupedSummary) => `
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

const categorizedSummary = (groupedSummary, prDescription) => `
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

const pullReviewer = async (context) => {
  const prNumber = context.payload.pull_request.number;
  const repoOwner = context.payload.repository.owner.login;
  const repoName = context.payload.repository.name;
  const prDetails = context.payload.pull_request;
  const prTitle = prDetails.title;
  let prDescription = prDetails.body;

  const reviewComments = [];
  const commitsAndChangesSummaryMap = {};
  const commitMessagesMap = {};

  const commitsResponse = await context.octokit.repos.compareCommits({
    owner: repoOwner,
    repo: repoName,
    base: context.payload.pull_request.base.sha,
    head: context.payload.pull_request.head.sha,
  });

  const { commits, files: changedFiles } = commitsResponse.data;

  for (const commit of commits) {
    const commitMessage = commit.commit.message;
    const commitUrl = commit.url;
    const commitDetailsResponse = await context.octokit.request(`GET ${commitUrl}`);
    const commitFiles = commitDetailsResponse.data.files;

    for (const file of commitFiles) {
      const filename = file.filename;

      if (!commitMessagesMap[filename]) {
        commitMessagesMap[filename] = [];
      }

      commitMessagesMap[filename].push(commitMessage);
    }
  }

  console.log('Changed files:', changedFiles);
  console.log('Commit messages:', commitMessagesMap);

  for (const file of changedFiles) {
    const patches = file.patch.split('diff --git');

    for (const patch of patches) {
      if (!patch.trim()) continue; // Skip empty patches

      const fileSummaryPrompt = summarizeFileDiff(file.filename, patch);
      const fileSummaryMessages = [
        {
          role: 'system',
          content:
            'You are an AI capable of summarizing file changes. Review the changes in the file and provide a summary. Ensure the response is within the <fileSummary> tag.',
        },
        {
          role: 'user',
          content: fileSummaryPrompt,
        },
      ];

      const fileSummaryResponse = await generateChatCompletion(fileSummaryMessages);
      const { fileSummary } = extractFieldsWithTags(fileSummaryResponse, ['fileSummary']);

      console.log('File summary:', fileSummary);

      const triagePrompt = triageFileDiff(file.filename, fileSummary);
      const triageMessages = [
        {
          role: 'system',
          content:
            'You are an AI capable of triaging file changes. Based on the provided summary, determine if the file needs further review or if it can be approved. Provide your decision within the <TRIAGE> tag.',
        },
        {
          role: 'user',
          content: triagePrompt,
        },
      ];

      const triageResponse = await generateChatCompletion(triageMessages);
      const { TRIAGE: triageDecision } = extractFieldsWithTags(triageResponse, ['TRIAGE']);

      console.log('Triage response:', triageResponse);
      console.log('Triage decision:', triageDecision);

      const reviewPrompt = reviewFileDiff(file.filename, fileSummary, patch);
      const reviewMessages = [
        {
          role: 'system',
          content:
            'You are an AI reviewer. Based on the file changes and summary, provide detailed review comments identifying issues or suggesting improvements. Ensure the response is within the <codeReview> tag.',
        },
        {
          role: 'user',
          content: reviewPrompt,
        },
      ];

      const reviewResponse = await generateChatCompletion(reviewMessages);
      const { codeReview } = extractFieldsWithTags(reviewResponse, ['codeReview']);

      console.log('Review comments:', codeReview);

      // if (triageDecision === 'NEEDS_REVIEW') {
        reviewComments.push({
          path: file.filename,
          position: patch.split('\n').length - 1,
          body: codeReview,
        });

        if (!commitsAndChangesSummaryMap[file.filename]) {
          commitsAndChangesSummaryMap[file.filename] = {
            linked_commit_messages: [],
            summaries: [],
          };
        }

        commitsAndChangesSummaryMap[file.filename].linked_commit_messages = commitMessagesMap[file.filename] || [];
        commitsAndChangesSummaryMap[file.filename].summaries.push(fileSummary);
      // }
    }
  }

  console.log('Commits and changes summary:', commitsAndChangesSummaryMap);

  const rawSummary = Object.values(commitsAndChangesSummaryMap)
    .map(({ summaries }) => summaries.join('\n'))
    .join('\n');

  const groupedSummaryPrompt = summarizeChangesets(rawSummary);
  const groupedSummaryMessages = [
    {
      role: 'system',
      content:
        'You are an AI capable of grouping and summarizing changesets. Group related changes and remove duplicates. Provide the summary within the <groupedSummary> tag.',
    },
    {
      role: 'user',
      content: groupedSummaryPrompt,
    },
  ];

  const groupedSummaryResponse = await generateChatCompletion(groupedSummaryMessages);
  const { groupedSummary } = extractFieldsWithTags(groupedSummaryResponse, ['groupedSummary']);

  console.log('Grouped summary:', groupedSummary);

  const walkthroughPrompt = walkthroughOfChanges(groupedSummary);
  const walkthroughMessages = [
    {
      role: 'system',
      content:
        'You are an AI capable of providing a walkthrough of changes across all files. Based on the provided grouped summary, give a detailed walkthrough within the <walkthrough> tag.',
    },
    {
      role: 'user',
      content: walkthroughPrompt,
    },
  ];

  const walkthroughResponse = await generateChatCompletion(walkthroughMessages);
  const { walkthrough } = extractFieldsWithTags(walkthroughResponse, ['walkthrough']);

  console.log('Walkthrough:', walkthrough);

  const categorizedSummaryPrompt = categorizedSummary(groupedSummary, prDescription);
  const categorizedSummaryMessages = [
    {
      role: 'system',
      content:
        'You are an AI capable of categorizing and summarizing changes. Categorize the changes into aspects such as Bug Fixes, New Features, etc. Provide the categorized summary within the <summary> tag.',
    },
    {
      role: 'user',
      content: categorizedSummaryPrompt,
    },
  ];

  const categorizedSummaryResponse = await generateChatCompletion(categorizedSummaryMessages);
  const { summary } = extractFieldsWithTags(categorizedSummaryResponse, ['summary']);

  console.log('Categorized summary:', summary);

  const walkthroughAndSummaryCommentContent = `
## Walkthrough

${walkthrough}

## Changes

| Files/Directories | Change Summary                                              |
|-------------------|-------------------------------------------------------------|
  ${Object.entries(commitsAndChangesSummaryMap)
    .map(([filename, { summaries }]) => `| \`${filename}\` | ${summaries.join(' ')} |`)
    .join('\n')}
`;

  await context.octokit.rest.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: prNumber,
    body: walkthroughAndSummaryCommentContent,
  });

  if (reviewComments.length != 0) {
    await context.octokit.rest.pulls.createReview({
      owner: repoOwner,
      repo: repoName,
      pull_number: prNumber,
      body: `**Actionable comments posted: ${reviewComments.length}**`,
      event: 'REQUEST_CHANGES',
      comments: reviewComments,
    });
  }

  const updatedDescription = `
## Summary by CodeBat AI

${summary}
  `;

  await context.octokit.rest.pulls.update({
    owner: repoOwner,
    repo: repoName,
    pull_number: prNumber,
    body: updatedDescription,
    title: prTitle,
  });
};

export default pullReviewer;
