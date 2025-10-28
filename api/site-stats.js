const SettingsModelPath = '../website-backend/src/models/MemoryStorage';

async function useMemoryStorage() {
  try { return require(SettingsModelPath); } catch (e) { return null; }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const mem = await useMemoryStorage();
    if (mem && typeof mem.getSettings === 'function') {
      const s = await mem.getSettings();
      // map to public stats shape
      const stats = {
        totalStudents: s?.system?.totalStudents ?? 450,
        totalStaff: s?.system?.totalStaff ?? 48,
        totalClubsTeams: s?.system?.totalClubsTeams ?? 15,
        yearsOfJoy: s?.system?.yearsOfJoy ?? 12
      };
      return res.json(stats);
    }

    // If no settings model available, return defaults
    return res.json({ totalStudents: 450, totalStaff: 48, totalClubsTeams: 15, yearsOfJoy: 12 });
  } catch (err) {
    console.error('api/site-stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch site stats' });
  }
};
