import pullReviewer from './pullReviewer.js';

const pullsHandler = (app) => {
  app.on(['pull_request.opened', 'pull_request.reopened', 'pull_request.synchronize'], pullReviewer);
};

export default pullsHandler;
