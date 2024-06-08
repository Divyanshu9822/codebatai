import { generateChatCompletion } from '../ai/generateChatCompletion.js';

export const handlePullRequestEvents = async (context) => {
  const prNumber = context.payload.pull_request.number;
  const repoOwner = context.payload.repository.owner.login;
  const repoName = context.payload.repository.name;

  const prDetails = context.payload.pull_request;
  const prTitle = prDetails.title;
  let prDescription = prDetails.body;

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

        Please provide the direct response in the following format only without any introductory phrases. Also ensure that JSON is valid and don't use backticks in the response JSON keys and values.

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

  const walkthroughPrompt = `
    Provide a precise walkthrough of all the changes made in the pull request based on the given JSON data containing files and their corresponding changes summaries.

    Data:
    \`\`\`
    ${JSON.stringify(changesSummaryMap, null, 2)}
    \`\`\`
  `;

  const walkthroughMessages = [
    {
      role: 'system',
      content:
        'You are a PR changes analyzer capable of providing a walkthrough of changes made in a pull request. Provide a walkthrough of the changes directly without any introductory phrases.',
    },
    {
      role: 'user',
      content: walkthroughPrompt,
    },
  ];

  const walkthroughAIReview = await generateChatCompletion(walkthroughMessages);

  const categorizedSummaryPrompt = `
    Categorize and summarize the changes in the pull request into the following aspects:
    - Bug Fixes
    - New Features
    - Enhancements
    - Refactorings
    - Chores
    - Documentation Updates
    - Configuration Changes
    - Dependency Updates

    Provide a short summary under each category (if applicable otherwise don't have that aspect in reponse) based on the given JSON data of changes.

    Data:
    \`\`\`
    ${JSON.stringify(changesSummaryMap, null, 2)}
    \`\`\`
  `;

  const categorizedSummaryMessages = [
    {
      role: 'system',
      content:
        'You are a PR changes analyzer capable of categorizing and summarizing changes into various aspects such as Bug Fixes, New Features, Enhancements, etc. Provide a categorized summary without any introductory phrases.',
    },
    {
      role: 'user',
      content: categorizedSummaryPrompt,
    },
  ];

  const categorizedSummaryAIReview = await generateChatCompletion(categorizedSummaryMessages);

  const walkthroughAndSummaryCommentContent = `
  ## Walkthrough

  ${walkthroughAIReview}

  ## Changes

  | Files/Directories | Change Summary                                              |
  |----------------|-------------------------------------------------------------|
  ${Object.entries(changesSummaryMap)
    .map(([filename, summaries]) => summaries.map((summary) => `| \`${filename}\` | ${summary} |`).join('\n'))
    .join('\n')}
  `;

  await context.octokit.rest.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: prNumber,
    body: walkthroughAndSummaryCommentContent,
  });

  await context.octokit.rest.pulls.createReview({
    owner: repoOwner,
    repo: repoName,
    pull_number: prNumber,
    body: `**Actionable comments posted: ${reviewComments.length}**`,
    event: 'REQUEST_CHANGES',
    comments: reviewComments,
  });

  let updatedDescription = prDescription || '';
  if (categorizedSummaryAIReview) {
    updatedDescription += `

## Summary by CodeBat AI

${categorizedSummaryAIReview}
    `;
  }

  await context.octokit.rest.pulls.update({
    owner: repoOwner,
    repo: repoName,
    pull_number: prNumber,
    body: updatedDescription,
    title: prTitle,
  });
};

const parseAIOutput = (aiReview) => {
  const parsedReview = JSON.parse(aiReview);
  const reviewBody = parsedReview.reviewBody;
  const changesSummary = parsedReview.changesSummary;

  return { reviewBody, changesSummary };
};
