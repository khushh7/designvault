const os = require('os');
const { loadGlobalConfig, saveGlobalConfig } = require('./config');

const SUPABASE_URL = 'https://gdzrhaycifcvetdvwztf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkenJoYXljaWZjdmV0ZHZ3enRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MzQzMzEsImV4cCI6MjA5MTExMDMzMX0.fLkvDTA5T4TTe5oSDL02ZXDw3a4XiJndlk7-Dn-n1u0';

async function trackFirstRun(version) {
  try {
    const global = await loadGlobalConfig();
    if (global.telemetrySent) return;

    await saveGlobalConfig({ telemetrySent: true });

    fetch(`${SUPABASE_URL}/rest/v1/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        event: 'install',
        version,
        platform: os.platform(),
        arch: os.arch(),
        node_version: process.version,
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  } catch {}
}

module.exports = { trackFirstRun };
