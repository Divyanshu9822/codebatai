const pullBranchDeleter = async (context) => {
  const repoOwner = context.payload.repository.owner.login;
  const repoName = context.payload.repository.name;
  const branchName = context.payload.pull_request.head.ref;
  const prNumber = context.payload.pull_request.number;
  const authorUsername = context.payload.pull_request.user.login;
  const isMerged = context.payload.pull_request.merged;

  if (isMerged) {
    await context.octokit.rest.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: prNumber,
      body: `@${authorUsername} Your pull request has been merged! The branch '${branchName}' is being deleted.`,
    });

    await context.octokit.rest.git.deleteRef({
      owner: repoOwner,
      repo: repoName,
      ref: `heads/${branchName}`,
    });
  } else {
    console.log(`Pull request #${prNumber} is not merged. Branch '${branchName}' will not be deleted.`);
  }
};

export default pullBranchDeleter;
