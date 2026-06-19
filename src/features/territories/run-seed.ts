import { seedTerritories } from './territories.seed';
seedTerritories().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
