import { generateChatCompletion } from '../ai/generateChatCompletion.js';

export const handleIssueOpened = async (context) => {
  const issueNumber = context.payload.issue.number;
  const repoOwner = context.payload.repository.owner.login;
  const repoName = context.payload.repository.name;

  const issueDescription = context.payload.issue.body;

  const messages = [
    {
      role: 'user',
      content: `Based on the following issue description, provide short and concise relevant 2-3 labels at max separated by comma. The labels should relate to the issue's type, difficulty, and domain, such as "easy", "moderate", "hard", "new-feature", "frontend", "backend", "design", "api-integration", "bug", "enhancement" and other relevant and self-explanatory terms only without any other message in response.

      Issue Description:
      ${issueDescription}`,
    },
  ];

  const aiLabels = await generateChatCompletion(messages);
  const labels = aiLabels.split(',').map((label) => label.trim());

  await context.octokit.issues.addLabels({
    owner: repoOwner,
    repo: repoName,
    issue_number: issueNumber,
    labels: labels,
  });
};
