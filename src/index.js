import { handleIssueOpened } from './handlers/issueHandler.js';
import { handlePullRequestEvents } from './handlers/pullRequesthandler.js';

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default (app) => {
  app.log.info('Yay, the app was loaded!');

  app.on(['issues.opened', 'issues.edited'], handleIssueOpened);

  app.on(['pull_request.opened', 'pull_request.reopened', 'pull_request.synchronize'], handlePullRequestEvents);
};
