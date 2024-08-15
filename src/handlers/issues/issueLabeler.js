import { generateChatCompletion } from '../../ai/generateChatCompletion.js';

const issueLabeler = async (context) => {
  const action = context.payload.action;
  const issueNumber = context.payload.issue.number;
  const repoOwner = context.payload.repository.owner.login;
  const repoName = context.payload.repository.name;
  const issueTitle = context.payload.issue.title;
  const issueDescription = context.payload.issue.body;

  const labelPrompt = `
    Based on the following issue title and description, generate a list of 3-4 relevant labels. These labels should be concise, specific to the issue's type, difficulty, and domain, and should include terms such as "bug", "enhancement", "new-feature", "frontend", "backend", "design", "api-integration", "easy", "moderate", "hard", etc. 

    Avoid including any extraneous text or messages in your response. Provide the labels separated by commas.

    Issue Title: ${issueTitle}
    
    ${issueDescription ? `Issue Description:\n\n${issueDescription}` : ''}
  `;

  const messages = [
    {
      role: 'system',
      content:
        'You are an AI designed to label issues based on their title and description. Provide relevant labels for issues, ensuring they are concise and reflect the type, difficulty, and domain of the issue.',
    },
    {
      role: 'user',
      content: labelPrompt,
    },
  ];

  const aiLabelsResponse = await generateChatCompletion(messages);
  const newLabels = aiLabelsResponse.split(',').map((label) => label.trim());

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
