import issueLabeler from './issues/issueLabeler.js';
import pullReviewer from './pulls/pullReviewer.js';
import pullBranchDeleter from './pulls/pullBranchDeleter.js';

const handler = (app) => {
  app.on(['issues.opened', 'issues.edited'], issueLabeler);
  app.on(['pull_request.opened', 'pull_request.reopened', 'pull_request.synchronize'], pullReviewer);
  app.on(['pull_request.closed'], pullBranchDeleter);
};

export default handler;
