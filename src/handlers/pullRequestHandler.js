export const handlePullRequestEvents = async (context) => {
  const prTitle = context.payload.pull_request.title;
  const prNumber = context.payload.pull_request.number;
  const repoOwner = context.payload.repository.owner.login;
  const repoName = context.payload.repository.name;
  const prAuthor = context.payload.pull_request.user.login;

  const commits_response = await context.octokit.rest.pulls.listCommits({
    owner: repoOwner,
    repo: repoName,
    pull_number: prNumber,
  });

  let commentBody = "### Changes Summary:\n\n";
  commentBody += "| File Path | Changes Made |\n";
  commentBody += "| --------- | ------------ |\n";

  for (const commit of commits_response.data) {
    commentBody += `| Commit: ${commit.sha} | Author: ${commit.commit.author.name} | Date: ${commit.commit.author.date} | Message: ${commit.commit.message} |\n`;
  }

  await context.octokit.rest.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: prNumber,
    body: commentBody,
  });

  const files_response = await context.octokit.rest.pulls.listFiles({
    owner: repoOwner,
    repo: repoName,
    pull_number: prNumber,
  });

  for (const file of files_response.data) {
    await context.octokit.rest.pulls.createReview({
      owner: repoOwner,
      repo: repoName,
      pull_number: prNumber,
      body: `Changes needed in file: ${file.filename}`,
      event: "REQUEST_CHANGES",
      comments: [
        {
          path: file.filename,
          position: 1,
          body: "Please make necessary changes.",
        },
      ],
    });
  }

  const updatedDescription =
    "\n### Description Updated by Bot\n\n" +
    "**Changes Made:**\n" +
    "- Updated pull request description to provide clearer context and instructions.\n" +
    "- Added a more informative description using Markdown syntax.\n\n" +
    "**Pull Request Details:**\n" +
    "- **Title:** " +
    prTitle +
    "\n" +
    "- **Pull Request Number:** " +
    prNumber +
    "\n" +
    "- **Repository:** " +
    repoName +
    "\n" +
    "- **Author:** " +
    prAuthor +
    "\n\n" +
    "**Updated Description:**\n" +
    "[Your updated description content goes here]\n";

  await context.octokit.rest.pulls.update({
    owner: repoOwner,
    repo: repoName,
    pull_number: prNumber,
    body: updatedDescription,
    title: prTitle,
  });

  const labelsToAdd = ["test1", "test2"];

  await context.octokit.issues.addLabels({
    owner: repoOwner,
    repo: repoName,
    issue_number: prNumber,
    labels: labelsToAdd,
  });
};
