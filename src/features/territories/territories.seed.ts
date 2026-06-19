import { db } from '../../db/client';
import { mahallaTerritories } from './territories.model';

function makePath(r: number, c: number): string {
  const x1 = c * 90, y1 = r * 80, x2 = x1 + 90, y2 = y1 + 80;
  return `M${x1},${y1} L${x2},${y1} L${x2},${y2} L${x1},${y2} Z`;
}

function getDistrict(r: number, c: number): string {
  if (r === 0) return 'Shimoliy';
  if (r >= 5) return 'Janubiy';
  if (c <= 2) return r <= 2 ? "G'arbiy Shimoliy" : "G'arbiy";
  if (c >= 7) return r <= 2 ? 'Sharqiy Shimoliy' : 'Sharqiy';
  return 'Markaziy';
}

const layout = [
  { r: 0, cols: [1,2,3,4,5,6,7,8] },
  { r: 1, cols: [0,1,2,3,4,5,6,7,8,9] },
  { r: 2, cols: [0,1,2,3,4,5,6,7,8,9] },
  { r: 3, cols: [0,1,2,3,4,5,6,7,8,9] },
  { r: 4, cols: [0,1,2,3,4,5,6,7,8,9] },
  { r: 5, cols: [1,2,3,4,5,6,7,8] },
  { r: 6, cols: [3,4,5,6] },
];

const names = [
  "Navro'z","Bahor","Mustaqillik","Istiqlol","Do'stlik","Hamkorlik","Yulduz","Baraka",
  "Bog'iston","Ko'klam","Yangi Hayot","Vatanparvar","Ipak yo'li","Mehr","Sevinch","Nur","Sharq","Osiyo",
  "Qorasuv","Guliston","Fayz","Alpomish","Markaziy","Zafar","Quvonch","Hayot","Shirin","Tinchlik",
  "Paxta","Galla","Oq oltin","Saodat","Tabassum","Orom","Rashk","Shimol","Janub","Maysazor",
  "Ko'ksaroy","Yashillik","Asal","Nilufar","Umid","Istak","Gilos","Mohitob","Durona","Sarvinoz",
  "Bug'doy","Tariq","Maysalar","Yangi Ko'cha","Yangi Turmush","Baxtiyorlik","Oltin Vodiy","Zarafshon",
  "Qashqadaryo","Mirzo Ulug'bek","Alisher Navoiy","Baxtli Yurt",
];

export async function seedTerritories() {
  const existing = await db.select({ id: mahallaTerritories.id }).from(mahallaTerritories).limit(1);
  if (existing.length > 0) {
    console.log('Territories already seeded, skipping.');
    return;
  }

  const rows: (typeof mahallaTerritories.$inferInsert)[] = [];
  let num = 1;
  for (const { r, cols } of layout) {
    for (const c of cols) {
      rows.push({
        number: num,
        name: names[num - 1]!,
        district: getDistrict(r, c),
        svgPath: makePath(r, c),
        centerX: String(c * 90 + 45),
        centerY: String(r * 80 + 40),
      });
      num++;
    }
  }

  await db.insert(mahallaTerritories).values(rows);
  console.log(`Seeded ${rows.length} territories.`);
}
