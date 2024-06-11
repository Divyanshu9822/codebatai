import { generateChatCompletion } from '../../ai/generateChatCompletion.js';

const issueLabeler = async (context) => {
  const action = context.payload.action;

  const issueNumber = context.payload.issue.number;
  const repoOwner = context.payload.repository.owner.login;
  const repoName = context.payload.repository.name;

  const issueTitle = context.payload.issue.title;
  const issueDescription = context.payload.issue.body;

  let prompt = `Based on the following issue title/description, provide short and concise relevant 3-4 labels at max, separated by commas. The labels should relate to the issue's type, difficulty, and domain, such as "easy", "moderate", "hard", "enhancement", "new-feature", "frontend", "backend", "design", "api-integration", "bug", and other relevant and self-explanatory terms only without any other message in response.

  Issue Title: ${issueTitle}
  
  ${issueDescription ? `Issue Description:\n\n ${issueDescription}` : ''}`;

  const messages = [
    {
      role: 'user',
      content: prompt,
    },
  ];

  const aiLabels = await generateChatCompletion(messages);
  const newLabels = aiLabels.split(',').map((label) => label.trim());

  if (action === 'opened') {
    await context.octokit.issues.addLabels({
      owner: repoOwner,
      repo: repoName,
      issue_number: issueNumber,
      labels: newLabels,
    });
  } else if (action === 'edited') {
    const existingLabelsResponse = await context.octokit.issues.listLabelsOnIssue({
      owner: repoOwner,
      repo: repoName,
      issue_number: issueNumber,
    });

    const existingLabels = existingLabelsResponse.data.map((label) => label.name);

    for (const label of existingLabels) {
      await context.octokit.issues.removeLabel({
        owner: repoOwner,
        repo: repoName,
        issue_number: issueNumber,
        name: label,
      });
    }

    await context.octokit.issues.addLabels({
      owner: repoOwner,
      repo: repoName,
      issue_number: issueNumber,
      labels: newLabels,
    });
  }
};

export default issueLabeler;
