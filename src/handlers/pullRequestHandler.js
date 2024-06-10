import { generateChatCompletion } from '../ai/generateChatCompletion.js';

export const handlePullRequestEvents = async (context) => {
  const prNumber = context.payload.pull_request.number;
  const repoOwner = context.payload.repository.owner.login;
  const repoName = context.payload.repository.name;

  const prDetails = context.payload.pull_request;
  const prTitle = prDetails.title;
  let prDescription = prDetails.body;

  const reviewComments = [];
  const commitsAndChangesSummaryMap = {};
  const commitMessagesMap = {};

  const commitsResponse = await context.octokit.rest.pulls.listCommits({
    owner: repoOwner,
    repo: repoName,
    pull_number: prNumber,
  });

  const commits = commitsResponse.data;

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

  console.log('Commit Messages Map:', commitMessagesMap);

  const filesResponse = await context.octokit.rest.pulls.listFiles({
    owner: repoOwner,
    repo: repoName,
    pull_number: prNumber,
  });

  const files = filesResponse.data;

  for (const file of files) {
    const patches = file.patch.split('diff --git');

    for (const patch of patches) {
      const reviewPrompt = `
        Review the changes in the file '${file.filename}' and provide constructive feedback. Analyze the code quality, highlight potential issues, and suggest improvements. Separate the feedback into two sections:
  
        1. <reviewBody>: Offer a detailed review of code changes and suggest better code replacements for particular codeblocks.
        2. <changesSummary>: Present a short and concise descriptive summary of changes made by analyzing the code patch provided below without any suggestions for improvement.
  
        Changes:
        \`\`\`
        ${patch}
        \`\`\`
  
        Please provide the direct response in the following format only without any introductory phrases. Use the custom tags for each section to ensure the response is easy to parse.
  
        OutputStructure: 
        \`\`\`
        <reviewBody>Your detailed review here</reviewBody>
        <changesSummary>Your short summary for changes done here</changesSummary>
        \`\`\`
      `;

      const reviewMessages = [
        {
          role: 'system',
          content:
            'You are a Code Reviewer API capable of providing detailed code reviews with potential code replacements and concise summaries of changes using custom tags. Please analyze the code changes thoroughly and provide feedback accordingly. Ensure each section is properly closed with its corresponding tag.',
        },
        {
          role: 'user',
          content: reviewPrompt,
        },
      ];

      const aiReview = await generateChatCompletion(reviewMessages);
      const { reviewBody, changesSummary } = extractFieldsWithTags(aiReview, ['reviewBody', 'changesSummary']);

      reviewComments.push({
        path: file.filename,
        position: 1,
        body: reviewBody,
      });

      if (!commitsAndChangesSummaryMap[file.filename]) {
        commitsAndChangesSummaryMap[file.filename] = {
          linked_commit_messages: [],
          summaries: [],
        };
      }

      commitsAndChangesSummaryMap[file.filename].linked_commit_messages = commitMessagesMap[file.filename] || [];
      commitsAndChangesSummaryMap[file.filename].summaries.push(changesSummary);
    }
  }

  console.log('Commits and Changes Summary Map:', commitsAndChangesSummaryMap);

  const walkthroughPrompt = `
  Provide a precise walkthrough of all the changes made in the pull request based on the given JSON data containing files and their corresponding changes summaries and linked commit messages. 
  
  Use the following format to give reponse:
  OutputStructure: 
    \`\`\`
    <walkthrough>Detailed walkthrough of changes made in PR</walkthrough>
    \`\`\`
  
  Data:
  \`\`\`
  ${JSON.stringify(commitsAndChangesSummaryMap, null, 2)}
  \`\`\`

  Please ensure that the response is structured correctly using the custom tag specified and should have direct answer. Do not include any introductory phrases or additional formatting outside of the tags.
`;

  const walkthroughMessages = [
    {
      role: 'system',
      content:
        'You are a PR changes analyzer capable of providing a structured walkthrough of changes made in a pull request. Provide a walkthrough using custom tags without any introductory phrases. Ensure that the content remains within the tag <walkthrough> and is structured correctly.',
    },
    {
      role: 'user',
      content: walkthroughPrompt,
    },
  ];

  const walkthroughAIReview = await generateChatCompletion(walkthroughMessages);
  const { walkthrough } = extractFieldsWithTags(walkthroughAIReview, ['walkthrough']);

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

    Use the following format to give reponse:
    OutputStructure:
    \`\`\`
    <summary> 
      Here goes the summary in list style covering applicable aspects with nested sublist to examplain 
    </summary>
    \`\`\`

    ${prDescription !== '' ? `PR Description by Author: ${prDescription}` : ''}

    Data:
    \`\`\`
    ${JSON.stringify(commitsAndChangesSummaryMap, null, 2)}
    \`\`\`
  `;

  const categorizedSummaryMessages = [
    {
      role: 'system',
      content:
        'You are a PR changes analyzer capable of categorizing and summarizing changes into various aspects such as Bug Fixes, New Features, Enhancements, etc. Provide a categorized summary without any introductory phrases. Ensure that the content remains within the tag <summary> and is structured correctly.',
    },
    {
      role: 'user',
      content: categorizedSummaryPrompt,
    },
  ];

  const categorizedSummaryAIReview = await generateChatCompletion(categorizedSummaryMessages);
  const { summary } = extractFieldsWithTags(categorizedSummaryAIReview, ['summary']);

  const overallSummaryMap = {};

  for (const filename in commitsAndChangesSummaryMap) {
    const summaries = commitsAndChangesSummaryMap[filename].summaries;

    const summaryPrompt = `
      Generate an overall summary in a singel sentance or short description for the changes made in this file based on the provided changes summary data:
  
      ${summaries.join('\n')}
  
      Please provide a concise overall summary that captures the essence of the changes made and ensure not to give data in list form as i want want a decriptive short text or a sentance.
  
      OutputStructure: 
      \`\`\`
      <overallSummary>Your overall summary here</overallSummary>
      \`\`\`
    `;

    const summaryMessages = [
      {
        role: 'system',
        content:
          'You are a summarizer tasked with generating an overall summary for the changes made in a file. Please analyze the provided changes summary and generate a concise overall summary in a single sentance or short description without using any list form to summarize changes.',
      },
      {
        role: 'user',
        content: summaryPrompt,
      },
    ];

    const aiResponse = await generateChatCompletion(summaryMessages);
    const { overallSummary } = extractFieldsWithTags(aiResponse, ['overallSummary']);

    overallSummaryMap[filename] = overallSummary;
  }

  console.log('Overall Summary Map:', overallSummaryMap);

  const walkthroughAndSummaryCommentContent = `
  ## Walkthrough
  
  ${walkthrough}
  
  ## Changes
  
  | Files/Directories | Change Summary                                              |
  |----------------|-------------------------------------------------------------|
  ${Object.entries(overallSummaryMap)
    .map(([filename, summary]) => `| \`${filename}\` | ${summary} |`)
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

function extractFieldsWithTags(text, tags, delimiter = '\n\n') {
  const result = {};

  tags.forEach((tag) => {
    const matches = [];
    let regex = new RegExp(`<${tag}>([\\s\\S]*?)(<\/${tag}>|<|$)`, 'g');
    let match;

    while ((match = regex.exec(text)) !== null) {
      let content = match[1].trim();

      if (!match[2] || !match[2].startsWith(`</${tag}>`)) {
        const nextTagStart = text.substring(match.index + match[0].length).search(/<[^\/][^>]*>/);
        if (nextTagStart !== -1) {
          content = text
            .substring(match.index + match[0].length - match[1].length, match.index + match[0].length + nextTagStart)
            .trim();
        } else {
          content = text.substring(match.index + match[0].length - match[1].length).trim();
        }
      }

      matches.push(content);
    }

    result[tag] = matches.length > 0 ? matches.join(delimiter) : 'Not found';
  });

  return result;
}
