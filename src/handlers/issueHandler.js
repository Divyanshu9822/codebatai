export const handleIssueOpened = async (context) => {
  const issueComment = context.issue({
    body: "Thanks for opening this issue!",
  });

  await context.octokit.issues.createComment(issueComment);

  const issueNumber = context.payload.issue.number;
  const repoOwner = context.payload.repository.owner.login;
  const repoName = context.payload.repository.name;

  await context.octokit.issues.addLabels({
    owner: repoOwner,
    repo: repoName,
    issue_number: issueNumber,
    labels: ["new issue"],
  });
};
