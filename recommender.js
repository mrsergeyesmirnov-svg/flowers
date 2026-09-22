export const bouquets = [
  {
    id: "cloud",
    name: "Белое облако",
    flowers: "Ранункулюсы, эустома, эвкалипт",
    description: "Воздушный и тактичный — выглядит дорого, но не кричит о себе.",
    price: 5900,
    image: "https://unsplash.com/photos/Iginxta1uqs/download?force=true&w=900",
    tags: ["нежная", "спокойная", "минимализм", "светлый", "первая встреча", "без повода", "мама"]
  },
  {
    id: "berry",
    name: "Ягодный вечер",
    flowers: "Пионовидные розы, диантус, маттиола",
    description: "Глубокие оттенки и выразительная форма — для человека, которого трудно не заметить.",
    price: 7900,
    image: "https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?auto=format&fit=crop&w=900&q=85",
    tags: ["яркая", "смелая", "вечеринка", "мода", "годовщина", "день рождения", "красный"]
  },
  {
    id: "garden",
    name: "Тихий сад",
    flowers: "Гортензия, кустовая роза, зелень",
    description: "Свободная садовая сборка, будто цветы только что принесли с летней веранды.",
    price: 6900,
    image: "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=900&q=85",
    tags: ["творческая", "естественная", "уют", "природа", "необычная", "без повода", "день рождения"]
  },
  {
    id: "peach",
    name: "Тёплый свет",
    flowers: "Персиковые розы, хризантема, хамелациум",
    description: "Тёплый, мягкий и очень живой букет — универсальный способ сказать «я рядом».",
    price: 4900,
    image: "https://images.unsplash.com/photo-1487070183336-b863922373d4?auto=format&fit=crop&w=900&q=85",
    tags: ["добрая", "весёлая", "тёплая", "забота", "мама", "извинение", "пастель"]
  },
  {
    id: "mono",
    name: "Чистая линия",
    flowers: "Каллы, антуриум, аспидистра",
    description: "Архитектурная форма и ничего лишнего. Для тех, кто выбирает вещи с характером.",
    price: 9900,
    image: "https://unsplash.com/photos/wzpCYipvHmM/download?force=true&w=900",
    tags: ["стильная", "деловая", "минимализм", "необычная", "современная", "годовщина", "коллега"]
  },
  {
    id: "sunny",
    name: "Солнечный день",
    flowers: "Хризантемы, гипсофила, эвкалипт",
    description: "Лёгкий и жизнерадостный букет с мягкой полевой фактурой.",
    price: 4500,
    image: "https://unsplash.com/photos/hcH4yj7atVM/download?force=true&w=900",
    tags: ["весёлая", "тёплая", "естественная", "забота", "мама", "без повода", "жёлтый"]
  },
  {
    id: "meadow",
    name: "Летний луг",
    flowers: "Ромашки, сезонные полевые цветы, зелень",
    description: "Нарочито свободная сборка для тех, кто любит простоту и живые детали.",
    price: 3900,
    image: "https://unsplash.com/photos/zjZkslZn9V8/download?force=true&w=900",
    tags: ["творческая", "естественная", "уют", "природа", "без повода", "первая встреча", "светлый"]
  },
  {
    id: "white",
    name: "Белый штрих",
    flowers: "Белые хризантемы, маттиола, сезонная зелень",
    description: "Спокойная светлая композиция — аккуратная, свежая и универсальная.",
    price: 5200,
    image: "https://unsplash.com/photos/cDihILxrdYw/download?force=true&w=900",
    tags: ["нежная", "спокойная", "минимализм", "светлый", "мама", "коллега", "извинение"]
  },
  {
    id: "rose",
    name: "Главные слова",
    flowers: "Красные розы, сезонная зелень",
    description: "Уверенная классика без лишних объяснений — для большого романтического жеста.",
    price: 11900,
    image: "https://unsplash.com/photos/N-SDwTIagr4/download?force=true&w=900",
    tags: ["романтичная", "классика", "любовь", "годовщина", "предложение", "красный"]
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

export function availableBouquets({ avoid = "", catalog = bouquets } = {}) {
  const excluded = excludedFlowerRoots(avoid);
  if (!excluded.length) return catalog;
  return catalog.filter((bouquet) => {
    const composition = normalize(bouquet.flowers);
    return excluded.every((root) => !composition.includes(root));
  });
}

export function recommend({ description = "", occasion = "", budget = 8000, avoid = "", catalog = bouquets }) {
  const words = normalize(`${description} ${occasion}`);
  return availableBouquets({ avoid, catalog })
    .map((bouquet) => ({
      ...bouquet,
      score:
        bouquet.tags.reduce((score, tag) => score + (words.includes(tag) ? 3 : 0), 0) +
        (bouquet.price <= budget ? 2 : -Math.ceil((bouquet.price - budget) / 3000))
    }))
    .sort((a, b) => b.score - a.score || Math.abs(a.price - budget) - Math.abs(b.price - budget))
    .slice(0, 3);
}

export const formatPrice = (value) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
