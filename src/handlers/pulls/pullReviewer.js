import { generateChatCompletion } from '../../ai/generateChatCompletion.js';
import { extractFieldsWithTags } from '../../utils/index.js';
import { Prompts } from '../../prompts/pulls.js';

const pullReviewer = async (context) => {
  const prNumber = context.payload.pull_request.number;
  const repoOwner = context.payload.repository.owner.login;
  const repoName = context.payload.repository.name;
  const prDetails = context.payload.pull_request;
  const prTitle = prDetails.title;
  const prDescription = prDetails.body;

  const reviewComments = [];
  const prChangesData = {};

  const commitsResponse = await context.octokit.repos.compareCommits({
    owner: repoOwner,
    repo: repoName,
    base: context.payload.pull_request.base.sha,
    head: context.payload.pull_request.head.sha,
  });

  const { commits, files: changedFiles } = commitsResponse.data;

  const prompts = new Prompts();

  for (const file of changedFiles) {
    if (file.status === 'removed') continue; // Skip removed files
    const patches = file.patch.split('diff --git');

    for (const patch of patches) {
      if (!patch.trim()) continue; // Skip empty patches

      const fileSummaryPrompt = prompts.summarizeFileDiff(file.filename, patch);
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

      const triagePrompt = prompts.triageFileDiff(file.filename, fileSummary);
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

      const reviewPrompt = prompts.reviewFileDiff(file.filename, fileSummary, patch, prDescription, prTitle);
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

      if (triageDecision === 'NEEDS_REVIEW') {
        reviewComments.push({
          path: file.filename,
          position: patch.split('\n').length - 1,
          body: codeReview,
        });

        if (!prChangesData[file.filename]) {
          prChangesData[file.filename] = {
            file_diff_summaries: [],
          };
        }

        prChangesData[file.filename].file_diff_summaries.push(fileSummary);
      }
    }
  }

  for (const file in prChangesData) {
    const file_diff_summaries = prChangesData[file].file_diff_summaries;

    const groupedSummaryPrompt = prompts.summarizeChangesets(file, file_diff_summaries);
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

    if (!prChangesData[file].hasOwnProperty('changes_summary')) {
      prChangesData[file].changes_summary = '';
    }

    prChangesData[file].changes_summary = groupedSummary;
  }

  const formatChangesMap = (prChangesData) => {
    return Object.entries(prChangesData)
      .map(
        ([filename, { changes_summary }]) => `**Filename:** \`${filename}\`\n**Changes Summary:** ${changes_summary}`
      )
      .join('\n\n');
  };

  const formattedChangesData = formatChangesMap(prChangesData);

  const walkthroughPrompt = prompts.walkthroughOfChanges(formattedChangesData);

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

  const categorizedSummaryPrompt = prompts.categorizedSummary(formattedChangesData, prDescription, prTitle);
  const categorizedSummaryMessages = [
    {
      role: 'system',
      content:
        'You are an AI capable of categorizing changes. Categorize the changes into aspects such as Bug Fixes, New Features, etc for pull request Description. Provide the categorized summary within the <summary> tag.',
    },
    {
      role: 'user',
      content: categorizedSummaryPrompt,
    },
  ];

  const categorizedSummaryResponse = await generateChatCompletion(categorizedSummaryMessages);
  const { summary } = extractFieldsWithTags(categorizedSummaryResponse, ['summary']);

  const changesEntries = Object.entries(prChangesData)
    .map(([filename, { changes_summary }]) => `| \`${filename}\` | ${changes_summary} |`)
    .join('\n');

  const walkthroughAndSummaryCommentContent = `
## Walkthrough

${walkthrough}

${
  changesEntries
    ? `
## Changes

| Files/Directories | Change Summary                                              |
|-------------------|-------------------------------------------------------------|
${changesEntries}
`
    : ''
}
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
${prDescription ? `${prDescription}\n---\n` : ''}
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
