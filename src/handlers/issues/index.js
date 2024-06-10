import issueLabeler from './issueLabeler.js';

const issuesHandler = (app) => {
  app.on(['issues.opened', 'issues.edited'], issueLabeler);
};

export default issuesHandler;
