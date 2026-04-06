// ===========================================
// pulse - DRY_RUN Mode Support
// ===========================================
// Utilities for checking and logging DRY_RUN mode.
// When DRY_RUN=true:
//   - Plane.so write operations are blocked and logged
//   - LobeHub push notifications are blocked and logged
//   - Plane.so read operations execute normally
//   - DeepSeek API calls execute normally

const isDryRun = () => {
  const value = (process.env.PULSE_DRY_RUN || 'false').toLowerCase();
  return value === 'true' || value === '1';
};

const dryRunLog = (action) => {
  return `[DRY_RUN] Would ${action}`;
};

const guardWrite = async (action, executeFn) => {
  if (isDryRun()) {
    const message = dryRunLog(action);
    console.log(message);
    return { dry_run: true, message, skipped: true };
  }
  return await executeFn();
};

module.exports = {
  isDryRun,
  dryRunLog,
  guardWrite,
};
