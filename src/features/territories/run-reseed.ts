import { reseedTerritories } from './territories.reseed';

reseedTerritories()
  .then(() => process.exit(0))
  .catch((e: unknown) => { console.error(e); process.exit(1); });
