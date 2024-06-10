import pullReviewer from './pullReviewer.js';
import pullBranchDeleter from './pullBranchDeleter.js';

const pullsHandler = (app) => {
  app.on(['pull_request.opened', 'pull_request.reopened', 'pull_request.synchronize'], pullReviewer);
  app.on(['pull_request.closed'], pullBranchDeleter);
};

export default pullsHandler;
