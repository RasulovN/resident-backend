/**
 * Reseed Qarshi city mahalla territories from real GeoJSON boundaries.
 * 30 mahallas sourced from public/data/mahalla/*.geojson.
 * centerX/centerY are SVG coordinates projected from geographic data.
 */

import { db } from '../../db/client';
import { mahallaTerritories } from './territories.model';

const MAHALLAS: (typeof mahallaTerritories.$inferInsert)[] = [
  { number: 1,  name: 'Alisher Navoiy',          district: 'Sharqiy',          svgPath: 'alisher-navoiy',          centerX: '496.5', centerY: '409.0' },
  { number: 2,  name: 'Beglar',                   district: 'Shimoliy-Sharqiy', svgPath: 'beglar',                  centerX: '488.9', centerY: '380.3' },
  { number: 3,  name: "Bog'ishamol",               district: 'Shimoliy',         svgPath: 'bogishamol',              centerX: '462.8', centerY: '327.1' },
  { number: 4,  name: 'Chaqar',                   district: 'Shimoliy',         svgPath: 'chaqar',                  centerX: '468.3', centerY: '349.5' },
  { number: 5,  name: 'Cholquvar',                district: 'Janubiy',          svgPath: 'cholquvar',               centerX: '450.8', centerY: '453.4' },
  { number: 6,  name: 'Darvozatutak',             district: 'Shimoliy',         svgPath: 'darvozatutak',            centerX: '485.2', centerY: '367.5' },
  { number: 7,  name: 'Eski Anhor',               district: 'Shimoliy',         svgPath: 'eski-anhor',              centerX: '476.0', centerY: '330.4' },
  { number: 8,  name: 'Kamandi',                  district: "G'arbiy",          svgPath: 'kamandi',                 centerX: '397.1', centerY: '401.3' },
  { number: 9,  name: "Xo'ja Xiyol",              district: "G'arbiy",          svgPath: 'khoja-xiyol',             centerX: '446.1', centerY: '410.3' },
  { number: 10, name: 'Xontepa',                  district: "G'arbiy",          svgPath: 'khontepa',                centerX: '414.0', centerY: '443.4' },
  { number: 11, name: 'Komilon',                  district: 'Markaziy',         svgPath: 'komilon',                 centerX: '470.4', centerY: '392.1' },
  { number: 12, name: 'Kunchiqar',                district: 'Markaziy',         svgPath: 'kunchiqar',               centerX: '477.0', centerY: '425.1' },
  { number: 13, name: "Mag'zon",                   district: "G'arbiy",          svgPath: 'magzon',                  centerX: '418.7', centerY: '406.1' },
  { number: 14, name: 'Mahallot',                 district: 'Markaziy',         svgPath: 'mahallot',                centerX: '485.3', centerY: '400.6' },
  { number: 15, name: 'Mahallot-1',               district: 'Markaziy',         svgPath: 'mahallot1',               centerX: '479.8', centerY: '408.5' },
  { number: 16, name: 'Maxsumobod',               district: "G'arbiy-Shimoliy", svgPath: 'maxsumobod',              centerX: '445.4', centerY: '372.4' },
  { number: 17, name: 'Mustaqillik',              district: "G'arbiy",          svgPath: 'mustaqillik',             centerX: '458.0', centerY: '431.7' },
  { number: 18, name: 'Nasaf',                    district: "G'arbiy-Shimoliy", svgPath: 'nasaf',                   centerX: '461.8', centerY: '362.6' },
  { number: 19, name: 'Neftchi',                  district: 'Sharqiy',          svgPath: 'neftchi',                 centerX: '502.5', centerY: '433.4' },
  { number: 20, name: 'Nuriston',                 district: 'Janubiy',          svgPath: 'nuriston',                centerX: '478.4', centerY: '434.3' },
  { number: 21, name: 'Otchopar',                 district: 'Sharqiy',          svgPath: 'otchopar',                centerX: '542.6', centerY: '407.4' },
  { number: 22, name: 'Oydin',                    district: 'Janubiy',          svgPath: 'oydin',                   centerX: '485.5', centerY: '457.9' },
  { number: 23, name: 'Paxtazor',                 district: 'Janubiy',          svgPath: 'paxtazor',                centerX: '476.2', centerY: '455.9' },
  { number: 24, name: 'Qarlikhona',               district: "G'arbiy-Shimoliy", svgPath: 'qarlikhona',              centerX: '457.4', centerY: '375.5' },
  { number: 25, name: "Qarluqbo'g'ot",             district: "G'arbiy-Shimoliy", svgPath: 'qarluqbogot',             centerX: '450.6', centerY: '390.2' },
  { number: 26, name: "Qilichbek Qo'rg'oncha",    district: "G'arbiy",          svgPath: 'qilichbek-qorgoncha',     centerX: '415.9', centerY: '394.4' },
  { number: 27, name: "Rog'uzar",                  district: 'Shimoliy-Sharqiy', svgPath: 'roguzar',                 centerX: '490.9', centerY: '336.9' },
  { number: 28, name: 'Samarqand',                district: 'Shimoliy-Sharqiy', svgPath: 'samarqand',               centerX: '489.1', centerY: '352.3' },
  { number: 29, name: 'Shodlik',                  district: "G'arbiy",          svgPath: 'shodlik',                 centerX: '442.8', centerY: '451.0' },
  { number: 30, name: 'Tabassum',                 district: "G'arbiy",          svgPath: 'tabassum',                centerX: '456.0', centerY: '416.1' },
];

export async function reseedTerritories() {
  console.log('Reseeding territories with real GeoJSON mahalla data...');
  await db.delete(mahallaTerritories);
  await db.insert(mahallaTerritories).values(MAHALLAS);
  console.log(`Seeded ${MAHALLAS.length} mahalla territories from GeoJSON sources.`);
}
