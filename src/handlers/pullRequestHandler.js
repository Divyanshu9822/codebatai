import { generateChatCompletion } from '../ai/generateChatCompletion.js';

export const handlePullRequestEvents = async (context) => {
  const prNumber = context.payload.pull_request.number;
  const repoOwner = context.payload.repository.owner.login;
  const repoName = context.payload.repository.name;

  const filesResponse = await context.octokit.rest.pulls.listFiles({
    owner: repoOwner,
    repo: repoName,
    pull_number: prNumber,
  });

  const files = filesResponse.data;

  const reviewComments = [];

  const changesSummaryMap = {};

  for (const file of files) {
    const patches = file.patch.split('diff --git');

    for (const patch of patches) {
      const reviewPrompt = `
        Review the changes in the file '${file.filename}' and provide constructive feedback. Analyze the code quality, highlight potential issues, and suggest improvements. Separate the feedback into two sections:

        1. "reviewBody": Offer a detailed review of code changes and better code replacement.
        2. "changesSummary": Present a short and concise descriptive summary of changes made by analyzing the code patch provided below without any suggestions for improvement.

        Changes:
        \`\`\`
        ${patch}
        \`\`\`

        Please provide the response in the following format only without any other messages or comments like "Here my review" or "I have completed the task" etc.:

        OutputStructure: 
        \`\`\`
        {
          "reviewBody": "Your detailed review here",
          "changesSummary": "Your summary here"
        }
        \`\`\`
      `;

      const reviewMessages = [
        {
          role: 'system',
          content:
            'You are a Code Reviewer API capable of providing detailed code reviews and concise summaries of changes in JSON format only. Please analyze the code changes thoroughly and provide feedback accordingly.',
        },
        {
          role: 'user',
          content: reviewPrompt,
        },
      ];

      const aiReview = await generateChatCompletion(reviewMessages);
      const { reviewBody, changesSummary } = parseAIOutput(aiReview);

      reviewComments.push({
        path: file.filename,
        position: 1,
        body: reviewBody,
      });

      if (!changesSummaryMap[file.filename]) {
        changesSummaryMap[file.filename] = [];
      }
      changesSummaryMap[file.filename].push(changesSummary);
    }
  }

  const changesSummaryTable = `
  ## Changes Summary
  
  | File/Directory | Change Summary                                              |
  |----------------|-------------------------------------------------------------|
  ${Object.entries(changesSummaryMap)
    .map(([filename, summaries]) => summaries.map((summary) => `| \`${filename}\` | ${summary} |`).join('\n'))
    .join('\n')}
  `;

  await context.octokit.rest.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: prNumber,
    body: changesSummaryTable,
  });

  await context.octokit.rest.pulls.createReview({
    owner: repoOwner,
    repo: repoName,
    pull_number: prNumber,
    body: `**Actionable comments posted: ${reviewComments.length}**`,
    event: 'REQUEST_CHANGES',
    comments: reviewComments,
  });
};

const parseAIOutput = (aiReview) => {
  const parsedReview = JSON.parse(aiReview);
  const reviewBody = parsedReview.reviewBody;
  const changesSummary = parsedReview.changesSummary;

  return { reviewBody, changesSummary };
};
