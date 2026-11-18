// Runs every minute (free) and asks the site to send the second alert / phone ring for unanswered messages.
export default {
  async scheduled(_event, env) {
    await fetch(env.SITE_URL + '/api/escalate', { method: 'POST', headers: { authorization: 'Bearer ' + env.CRON_KEY } });
  },
};
