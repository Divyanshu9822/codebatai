import issuesHandler from './handlers/issues/index.js';
import pullsHandler from './handlers/pulls/index.js';

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default (app) => {
  app.log.info('Yay, the app was loaded!');
  issuesHandler(app);
  pullsHandler(app);
};
