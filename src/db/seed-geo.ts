/**
 * Seeds Uzbekistan's 14 regions (viloyatlar) and their districts (tumanlar/shaharlar).
 * Run: npx tsx src/db/seed-geo.ts
 */
import { eq } from 'drizzle-orm';
import { db, pool } from './client';
import { districts, regions } from '../features/geo/geo.model';

const GEO_DATA: Array<{
  name: string;
  nameRu: string;
  code: string;
  sortOrder: number;
  districts: Array<{ name: string; nameRu: string; isCity?: boolean }>;
}> = [
  {
    name: "Toshkent shahri",
    nameRu: "г. Ташкент",
    code: "toshkent-shahar",
    sortOrder: 1,
    districts: [
      { name: "Bektemir tumani", nameRu: "Бектемирский район" },
      { name: "Chilonzor tumani", nameRu: "Чиланзарский район" },
      { name: "Hamza tumani", nameRu: "Хамзинский район" },
      { name: "Mirobod tumani", nameRu: "Мирабадский район" },
      { name: "Mirzo Ulug'bek tumani", nameRu: "Мирзо-Улугбекский район" },
      { name: "Olmazor tumani", nameRu: "Алмазарский район" },
      { name: "Sergeli tumani", nameRu: "Сергелийский район" },
      { name: "Shayxontohur tumani", nameRu: "Шайхантахурский район" },
      { name: "Uchtepa tumani", nameRu: "Учтепинский район" },
      { name: "Yakkasaroy tumani", nameRu: "Яккасарайский район" },
      { name: "Yashnobod tumani", nameRu: "Яшнободский район" },
      { name: "Yunusobod tumani", nameRu: "Юнусабадский район" },
    ],
  },
  {
    name: "Andijon viloyati",
    nameRu: "Андижанская область",
    code: "andijon",
    sortOrder: 2,
    districts: [
      { name: "Andijon shahri", nameRu: "г. Андижан", isCity: true },
      { name: "Asaka tumani", nameRu: "Асакинский район" },
      { name: "Baliqchi tumani", nameRu: "Балыкчинский район" },
      { name: "Bo'ston tumani", nameRu: "Бостонский район" },
      { name: "Bulung'ur tumani", nameRu: "Булунгурский район" },
      { name: "Izboskan tumani", nameRu: "Избасканский район" },
      { name: "Jalaquduq tumani", nameRu: "Жалакудукский район" },
      { name: "Marhamat tumani", nameRu: "Мархаматский район" },
      { name: "Oltinko'l tumani", nameRu: "Алтынкульский район" },
      { name: "Paxtaobod tumani", nameRu: "Пахтаабадский район" },
      { name: "Qo'rg'ontepa tumani", nameRu: "Кургантепинский район" },
      { name: "Shahrixon tumani", nameRu: "Шахриханский район" },
      { name: "Ulug'nor tumani", nameRu: "Улугнорский район" },
      { name: "Xo'jaobod tumani", nameRu: "Ходжаабадский район" },
    ],
  },
  {
    name: "Buxoro viloyati",
    nameRu: "Бухарская область",
    code: "buxoro",
    sortOrder: 3,
    districts: [
      { name: "Buxoro shahri", nameRu: "г. Бухара", isCity: true },
      { name: "G'ijduvon tumani", nameRu: "Гиждуванский район" },
      { name: "Jondor tumani", nameRu: "Жондорский район" },
      { name: "Kogon shahri", nameRu: "г. Каган", isCity: true },
      { name: "Olot tumani", nameRu: "Алатский район" },
      { name: "Peshku tumani", nameRu: "Пешкунский район" },
      { name: "Qorakul tumani", nameRu: "Каракульский район" },
      { name: "Qorovulbozor tumani", nameRu: "Каравулбазарский район" },
      { name: "Romitan tumani", nameRu: "Ромитанский район" },
      { name: "Shofirkon tumani", nameRu: "Шафирканский район" },
      { name: "Vobkent tumani", nameRu: "Вабкентский район" },
    ],
  },
  {
    name: "Farg'ona viloyati",
    nameRu: "Ферганская область",
    code: "fargona",
    sortOrder: 4,
    districts: [
      { name: "Farg'ona shahri", nameRu: "г. Фергана", isCity: true },
      { name: "Qo'qon shahri", nameRu: "г. Коканд", isCity: true },
      { name: "Marg'ilon shahri", nameRu: "г. Маргилан", isCity: true },
      { name: "Beshariq tumani", nameRu: "Бешарыкский район" },
      { name: "Bo'vayda tumani", nameRu: "Бувайдинский район" },
      { name: "Dang'ara tumani", nameRu: "Дангаринский район" },
      { name: "Furqat tumani", nameRu: "Фуркатский район" },
      { name: "Oltiariq tumani", nameRu: "Алтыарыкский район" },
      { name: "O'zbekiston tumani", nameRu: "Узбекистанский район" },
      { name: "Rishton tumani", nameRu: "Риштанский район" },
      { name: "So'x tumani", nameRu: "Сохский район" },
      { name: "Toshloq tumani", nameRu: "Ташлакский район" },
      { name: "Uchko'prik tumani", nameRu: "Учкупрский район" },
      { name: "Yozyovon tumani", nameRu: "Язъяванский район" },
    ],
  },
  {
    name: "Jizzax viloyati",
    nameRu: "Джизакская область",
    code: "jizzax",
    sortOrder: 5,
    districts: [
      { name: "Jizzax shahri", nameRu: "г. Джизак", isCity: true },
      { name: "Arnasoy tumani", nameRu: "Арнасайский район" },
      { name: "Baxmal tumani", nameRu: "Бахмальский район" },
      { name: "Do'stlik tumani", nameRu: "Дустликский район" },
      { name: "Forish tumani", nameRu: "Фаришский район" },
      { name: "G'allaorol tumani", nameRu: "Галлаоральский район" },
      { name: "Mirzacho'l tumani", nameRu: "Мирзачульский район" },
      { name: "Paxtakor tumani", nameRu: "Пахтакорский район" },
      { name: "Yangiobod tumani", nameRu: "Янгиободский район" },
      { name: "Zafar tumani", nameRu: "Зафарабадский район" },
      { name: "Zomin tumani", nameRu: "Зааминский район" },
      { name: "Sharof Rashidov tumani", nameRu: "Шараф Рашидовский район" },
    ],
  },
  {
    name: "Xorazm viloyati",
    nameRu: "Хорезмская область",
    code: "xorazm",
    sortOrder: 6,
    districts: [
      { name: "Urganch shahri", nameRu: "г. Ургенч", isCity: true },
      { name: "Xiva shahri", nameRu: "г. Хива", isCity: true },
      { name: "Bog'ot tumani", nameRu: "Багатский район" },
      { name: "Gurlan tumani", nameRu: "Гурленский район" },
      { name: "Hazorasp tumani", nameRu: "Хазараспский район" },
      { name: "Khonqa tumani", nameRu: "Хонкинский район" },
      { name: "Qo'shko'pir tumani", nameRu: "Кошкупырский район" },
      { name: "Shovot tumani", nameRu: "Шаватский район" },
      { name: "Tuproqqal'a tumani", nameRu: "Тупроккалинский район" },
      { name: "Urganch tumani", nameRu: "Ургенчский район" },
      { name: "Yangiariq tumani", nameRu: "Янгиарыкский район" },
      { name: "Yangibozor tumani", nameRu: "Янгибазарский район" },
    ],
  },
  {
    name: "Namangan viloyati",
    nameRu: "Наманганская область",
    code: "namangan",
    sortOrder: 7,
    districts: [
      { name: "Namangan shahri", nameRu: "г. Наманган", isCity: true },
      { name: "Chortoq tumani", nameRu: "Чартакский район" },
      { name: "Chust tumani", nameRu: "Чустский район" },
      { name: "Kosonsoy tumani", nameRu: "Касансайский район" },
      { name: "Mingbuloq tumani", nameRu: "Мингбулакский район" },
      { name: "Namangan tumani", nameRu: "Наманганский район" },
      { name: "Norin tumani", nameRu: "Наринский район" },
      { name: "Pop tumani", nameRu: "Папский район" },
      { name: "To'raqo'rg'on tumani", nameRu: "Туракурганский район" },
      { name: "Uchqo'rg'on tumani", nameRu: "Учкурганский район" },
      { name: "Uychi tumani", nameRu: "Уйчинский район" },
      { name: "Yangiqo'rg'on tumani", nameRu: "Янгикурганский район" },
    ],
  },
  {
    name: "Navoiy viloyati",
    nameRu: "Навоийская область",
    code: "navoiy",
    sortOrder: 8,
    districts: [
      { name: "Navoiy shahri", nameRu: "г. Навои", isCity: true },
      { name: "Zarafshon shahri", nameRu: "г. Зарафшон", isCity: true },
      { name: "Karmana tumani", nameRu: "Карманинский район" },
      { name: "Konimex tumani", nameRu: "Кониметский район" },
      { name: "Navbahor tumani", nameRu: "Навбахорский район" },
      { name: "Nurota tumani", nameRu: "Нуратинский район" },
      { name: "Qiziltepa tumani", nameRu: "Кызылтепинский район" },
      { name: "Tomdi tumani", nameRu: "Томдинский район" },
      { name: "Uchquduq tumani", nameRu: "Учкудукский район" },
      { name: "Xatirchi tumani", nameRu: "Хатырчинский район" },
    ],
  },
  {
    name: "Qashqadaryo viloyati",
    nameRu: "Кашкадарьинская область",
    code: "qashqadaryo",
    sortOrder: 9,
    districts: [
      { name: "Qarshi shahri", nameRu: "г. Карши", isCity: true },
      { name: "Shahrisabz shahri", nameRu: "г. Шахрисабз", isCity: true },
      { name: "Beshkent tumani", nameRu: "Бешкентский район" },
      { name: "Chiroqchi tumani", nameRu: "Чиракчинский район" },
      { name: "Dehqonobod tumani", nameRu: "Дехканабадский район" },
      { name: "G'uzor tumani", nameRu: "Гузарский район" },
      { name: "Kasbi tumani", nameRu: "Касбийский район" },
      { name: "Kitob tumani", nameRu: "Китабский район" },
      { name: "Koson tumani", nameRu: "Косонский район" },
      { name: "Mirishkor tumani", nameRu: "Миришкорский район" },
      { name: "Muborak tumani", nameRu: "Мубарекский район" },
      { name: "Nishon tumani", nameRu: "Нишанский район" },
      { name: "Qamashi tumani", nameRu: "Камашинский район" },
      { name: "Qarshi tumani", nameRu: "Каршинский район" },
      { name: "Yakkabog' tumani", nameRu: "Яккабагский район" },
    ],
  },
  {
    name: "Samarqand viloyati",
    nameRu: "Самаркандская область",
    code: "samarqand",
    sortOrder: 10,
    districts: [
      { name: "Samarqand shahri", nameRu: "г. Самарканд", isCity: true },
      { name: "Kattaqo'rg'on shahri", nameRu: "г. Каттакурган", isCity: true },
      { name: "Bulung'ur tumani", nameRu: "Булунгурский район" },
      { name: "Ishtixon tumani", nameRu: "Иштыханский район" },
      { name: "Jomboy tumani", nameRu: "Джамбайский район" },
      { name: "Kattaqo'rg'on tumani", nameRu: "Каттакурганский район" },
      { name: "Narpay tumani", nameRu: "Нарпайский район" },
      { name: "Nurobod tumani", nameRu: "Нурабадский район" },
      { name: "Oqdaryo tumani", nameRu: "Акдарьинский район" },
      { name: "Pastdarg'om tumani", nameRu: "Пастдаргомский район" },
      { name: "Payariq tumani", nameRu: "Пайарыкский район" },
      { name: "Qo'shrabot tumani", nameRu: "Кушрабатский район" },
      { name: "Samarqand tumani", nameRu: "Самаркандский район" },
      { name: "Toyloq tumani", nameRu: "Тайлакский район" },
      { name: "Urgut tumani", nameRu: "Ургутский район" },
    ],
  },
  {
    name: "Sirdaryo viloyati",
    nameRu: "Сырдарьинская область",
    code: "sirdaryo",
    sortOrder: 11,
    districts: [
      { name: "Guliston shahri", nameRu: "г. Гулистан", isCity: true },
      { name: "Yangiyer shahri", nameRu: "г. Янгиер", isCity: true },
      { name: "Boyovut tumani", nameRu: "Баяутский район" },
      { name: "Guliston tumani", nameRu: "Гулистанский район" },
      { name: "Mirzaobod tumani", nameRu: "Мирзаабадский район" },
      { name: "Oqoltin tumani", nameRu: "Акалтынский район" },
      { name: "Sardoba tumani", nameRu: "Сардобинский район" },
      { name: "Sayxunobod tumani", nameRu: "Сайхунабадский район" },
      { name: "Sirdaryo tumani", nameRu: "Сырдарьинский район" },
      { name: "Xovos tumani", nameRu: "Хавастский район" },
    ],
  },
  {
    name: "Surxondaryo viloyati",
    nameRu: "Сурхандарьинская область",
    code: "surxondaryo",
    sortOrder: 12,
    districts: [
      { name: "Termiz shahri", nameRu: "г. Термез", isCity: true },
      { name: "Angor tumani", nameRu: "Ангорский район" },
      { name: "Bandixon tumani", nameRu: "Бандихонский район" },
      { name: "Boysun tumani", nameRu: "Байсунский район" },
      { name: "Denov tumani", nameRu: "Деновский район" },
      { name: "Jarqo'rg'on tumani", nameRu: "Джаркурганский район" },
      { name: "Qiziriq tumani", nameRu: "Кизирикский район" },
      { name: "Qumqo'rg'on tumani", nameRu: "Кумкурганский район" },
      { name: "Muzrabot tumani", nameRu: "Музрабатский район" },
      { name: "Oltinsoy tumani", nameRu: "Алтынсайский район" },
      { name: "Sariosiyo tumani", nameRu: "Сариасийский район" },
      { name: "Sherobod tumani", nameRu: "Шерабадский район" },
      { name: "Sho'rchi tumani", nameRu: "Шурчинский район" },
      { name: "Termiz tumani", nameRu: "Термезский район" },
      { name: "Uzun tumani", nameRu: "Узунский район" },
    ],
  },
  {
    name: "Toshkent viloyati",
    nameRu: "Ташкентская область",
    code: "toshkent-viloyat",
    sortOrder: 13,
    districts: [
      { name: "Angren shahri", nameRu: "г. Ангрен", isCity: true },
      { name: "Bekabad shahri", nameRu: "г. Бекабад", isCity: true },
      { name: "Chirchiq shahri", nameRu: "г. Чирчик", isCity: true },
      { name: "Olmaliq shahri", nameRu: "г. Алмалык", isCity: true },
      { name: "Bo'ka tumani", nameRu: "Букинский район" },
      { name: "Bo'stonliq tumani", nameRu: "Бостанлыкский район" },
      { name: "Chinoz tumani", nameRu: "Чиназский район" },
      { name: "Ohangaron tumani", nameRu: "Ахангаранский район" },
      { name: "Oqqo'rg'on tumani", nameRu: "Аккурганский район" },
      { name: "Parkent tumani", nameRu: "Паркентский район" },
      { name: "Piskent tumani", nameRu: "Пскентский район" },
      { name: "Quyi Chirchiq tumani", nameRu: "Нижнечирчикский район" },
      { name: "Toshkent tumani", nameRu: "Ташкентский район" },
      { name: "Yuqori Chirchiq tumani", nameRu: "Верхнечирчикский район" },
      { name: "Zangiota tumani", nameRu: "Зангиатинский район" },
    ],
  },
  {
    name: "Qoraqalpog'iston Respublikasi",
    nameRu: "Республика Каракалпакстан",
    code: "qoraqalpogiston",
    sortOrder: 14,
    districts: [
      { name: "Nukus shahri", nameRu: "г. Нукус", isCity: true },
      { name: "Amudaryo tumani", nameRu: "Амударьинский район" },
      { name: "Beruniy tumani", nameRu: "Берунийский район" },
      { name: "Chimboy tumani", nameRu: "Чимбайский район" },
      { name: "Elliq qal'a tumani", nameRu: "Элликкалинский район" },
      { name: "Kegeyli tumani", nameRu: "Кегейлийский район" },
      { name: "Mo'ynoq tumani", nameRu: "Муйнакский район" },
      { name: "Nukus tumani", nameRu: "Нукусский район" },
      { name: "Qanlikul tumani", nameRu: "Канликольский район" },
      { name: "Qo'ng'irot tumani", nameRu: "Кунградский район" },
      { name: "Qorao'zak tumani", nameRu: "Караузякский район" },
      { name: "Shumanay tumani", nameRu: "Шуманайский район" },
      { name: "Taxtako'pir tumani", nameRu: "Тахтакупырский район" },
      { name: "To'rtko'l tumani", nameRu: "Турткульский район" },
      { name: "Xo'jayli tumani", nameRu: "Ходжейлийский район" },
    ],
  },
];

async function seedGeo() {
  console.log('🌍 Seeding geographic data (viloyatlar va tumanlar)...');

  for (const regionData of GEO_DATA) {
    let region = await db.query.regions.findFirst({
      where: eq(regions.code, regionData.code),
    });

    if (!region) {
      [region] = await db
        .insert(regions)
        .values({
          name: regionData.name,
          nameRu: regionData.nameRu,
          code: regionData.code,
          sortOrder: regionData.sortOrder,
        })
        .returning();
      console.log(`  ✓ ${regionData.name}`);
    }

    for (const [idx, d] of regionData.districts.entries()) {
      const existing = await db.query.districts.findFirst({
        where: (t, { and }) => and(eq(t.regionId, region!.id), eq(t.name, d.name)),
      });
      if (!existing) {
        await db.insert(districts).values({
          regionId: region!.id,
          name: d.name,
          nameRu: d.nameRu,
          isCity: d.isCity ?? false,
          sortOrder: idx,
        });
      }
    }
  }

  console.log('✅ Geo seed complete');
  await pool.end();
}

seedGeo().catch((e) => { console.error(e); process.exit(1); });
