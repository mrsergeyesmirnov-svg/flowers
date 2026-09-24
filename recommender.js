export const bouquets = [
  {
    id: "cloud",
    name: "Белое облако",
    flowers: "Ранункулюсы, эустома, эвкалипт",
    description: "Воздушный и тактичный — выглядит дорого, но не кричит о себе.",
    price: 5900,
    image: "https://unsplash.com/photos/iNdzEsWTJ7w/download?force=true&w=900",
    tags: ["нежная", "спокойная", "минимализм", "светлый", "бело-зелёный", "первая встреча", "без повода", "мама", "учитель", "благодарность", "день учителя", "1 сентября"]
  },
  {
    id: "berry",
    name: "Ягодный вечер",
    flowers: "Пионовидные розы, диантус, маттиола",
    description: "Глубокие оттенки и выразительная форма — для человека, которого трудно не заметить.",
    price: 7900,
    image: "https://unsplash.com/photos/A9HoCmuYU6Q/download?force=true&w=900",
    tags: ["яркая", "смелая", "пышный", "вечеринка", "мода", "годовщина", "день рождения", "красный", "девушка"]
  },
  {
    id: "garden",
    name: "Тихий сад",
    flowers: "Гортензия, кустовая роза, зелень",
    description: "Свободная садовая сборка, будто цветы только что принесли с летней веранды.",
    price: 6900,
    image: "https://unsplash.com/photos/nQgYsOJNsTs/download?force=true&w=900",
    tags: ["творческая", "естественная", "пышный", "зелень", "уют", "природа", "необычная", "без повода", "день рождения", "девушка"]
  },
  {
    id: "peach",
    name: "Тёплый свет",
    flowers: "Персиковые розы, хризантема, хамелациум",
    description: "Тёплый, мягкий и очень живой букет — универсальный способ сказать «я рядом».",
    price: 4900,
    image: "https://unsplash.com/photos/aTVOIeiO4fY/download?force=true&w=900",
    tags: ["добрая", "весёлая", "тёплая", "забота", "мама", "извинение", "пастель"]
  },
  {
    id: "mono",
    name: "Чистая линия",
    flowers: "Каллы, антуриум, аспидистра",
    description: "Архитектурная форма и ничего лишнего. Для тех, кто выбирает вещи с характером.",
    price: 9900,
    image: "https://unsplash.com/photos/u2ast8gVEzw/download?force=true&w=900",
    tags: ["стильная", "деловая", "минимализм", "необычная", "современная", "зелень", "годовщина", "коллега"]
  },
  {
    id: "sunny",
    name: "Солнечный день",
    flowers: "Хризантемы, гипсофила, эвкалипт",
    description: "Лёгкий и жизнерадостный букет с мягкой полевой фактурой.",
    price: 4500,
    image: "https://unsplash.com/photos/6ZRU59xbGsY/download?force=true&w=900",
    tags: ["весёлая", "тёплая", "естественная", "забота", "мама", "без повода", "жёлтый", "учитель", "школа", "благодарность", "день матери", "8 марта", "1 сентября"]
  },
  {
    id: "meadow",
    name: "Летний луг",
    flowers: "Ромашки, сезонные полевые цветы, зелень",
    description: "Нарочито свободная сборка для тех, кто любит простоту и живые детали.",
    price: 3900,
    image: "https://unsplash.com/photos/ha0D2ocbHaw/download?force=true&w=900",
    tags: ["творческая", "естественная", "зелень", "уют", "природа", "без повода", "первая встреча", "светлый", "школа", "выпускной", "последний звонок"]
  },
  {
    id: "white",
    name: "Белый штрих",
    flowers: "Белые хризантемы, маттиола, сезонная зелень",
    description: "Спокойная светлая композиция — аккуратная, свежая и универсальная.",
    price: 5200,
    image: "https://unsplash.com/photos/vYhtjwCcE3I/download?force=true&w=900",
    tags: ["нежная", "спокойная", "минимализм", "светлый", "бело-зелёный", "мама", "коллега", "учитель", "школа", "извинение", "благодарность", "день учителя", "1 сентября", "профессиональный праздник"]
  },
  {
    id: "rose",
    name: "Главные слова",
    flowers: "Красные розы, сезонная зелень",
    description: "Уверенная классика без лишних объяснений — для большого романтического жеста.",
    price: 11900,
    image: "https://unsplash.com/photos/N-SDwTIagr4/download?force=true&w=900",
    tags: ["романтичная", "классика", "монобукет", "пышный", "любовь", "годовщина", "предложение", "красный", "девушка"]
  }
];

const flowerRoots = [
  "роз", "лили", "пион", "хризантем", "гортенз", "эустом", "ранункул",
  "тюльпан", "гвоздик", "диантус", "калл", "антуриум", "ромаш",
  "маттиол", "эвкалипт", "гипсофил", "хамелациум"
];

const normalize = (value = "") => value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е");

export function excludedFlowerRoots(avoid = "") {
  const words = normalize(avoid);
  return flowerRoots.filter((root) => words.includes(root));
}

export function availableBouquets({ avoid = "", personDescription = "", bouquetDescription = "", description = "", catalog = bouquets } = {}) {
  const notes = normalize(`${personDescription || description} ${bouquetDescription}`);
  const excluded = [...new Set([
    ...excludedFlowerRoots(avoid),
    ...flowerRoots.filter((root) => new RegExp(`(?:без|не любит|не нрав|исключ)[^,.!?]{0,40}${root}`, "i").test(notes))
  ])];
  if (!excluded.length) return catalog;
  return catalog.filter((bouquet) => {
    const composition = normalize(bouquet.flowers);
    return excluded.every((root) => !composition.includes(root));
  });
}

export function recommend({ recipientType = "", personDescription = "", bouquetDescription = "", description = "", occasion = "", budget = 8000, avoid = "", catalog = bouquets }) {
  const personWords = normalize(`${recipientType} ${personDescription || description} ${occasion}`);
  const bouquetWords = normalize(bouquetDescription);
  return availableBouquets({ avoid, personDescription, bouquetDescription, description, catalog })
    .map((bouquet) => ({
      ...bouquet,
      score:
        bouquet.tags.reduce((score, tag) => score + (personWords.includes(tag) ? 3 : 0) + (bouquetWords.includes(tag) ? 5 : 0), 0) +
        (bouquet.price <= budget ? 2 : -Math.ceil((bouquet.price - budget) / 3000))
    }))
    .sort((a, b) => b.score - a.score || Math.abs(a.price - budget) - Math.abs(b.price - budget))
    .slice(0, 3);
}

export const formatPrice = (value) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
