/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default (app) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");

  app.on("issues.opened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });

    await context.octokit.issues.createComment(issueComment);
    app.log.info("Comment added successfully.");

    const issueNumber = context.payload.issue.number;
    const repoOwner = context.payload.repository.owner.login;
    const repoName = context.payload.repository.name;

    app.log.info(
      `Adding label to issue #${issueNumber} in repo ${repoOwner}/${repoName}`
    );

    await context.octokit.issues.addLabels({
      owner: repoOwner,
      repo: repoName,
      issue_number: issueNumber,
      labels: ["new issue"],
    });

    app.log.info("Label added successfully.");
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
