// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

// Инициализация клиента OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * "База" исполнителей.
 * Пока просто массив в коде — для MVP этого достаточно.
 * Потом можно вынести в БД или Airtable.
 */
const vendors = [
  {
    id: "anim1",
    type: "animator",
    title: "Аниматор в образе героя Roblox",
    city: "Новосибирск",
    minAge: 7,
    maxAge: 11,
    priceLevel: "medium",
    tags: ["roblox", "батуты", "квест", "активный"],
    description:
      "Динамичная программа в стиле Roblox с квестом, заданиями и танцами. Подходит для активных ребят 7–11 лет.",
    image: "", // сюда позже подставишь URL фото
  },
  {
    id: "anim2",
    type: "animator",
    title: "Аниматор «Робо-учёный»",
    city: "Новосибирск",
    minAge: 7,
    maxAge: 10,
    priceLevel: "medium",
    tags: ["роботы", "киндеры", "научное шоу", "квест"],
    description:
      "Научно-игровая программа с роботами, опытами и элементами квеста. Хорошо заходит детям 8–10 лет.",
    image: "",
  },
  {
    id: "venue1",
    type: "venue",
    title: "Батутный центр «Джамп Хаус»",
    city: "Новосибирск",
    minAge: 6,
    maxAge: 14,
    priceLevel: "medium",
    tags: ["батуты", "активный", "roblox", "майнкрафт"],
    description:
      "Площадка с батутной ареной и зоной для праздников. Можно совместить квест и активные игры.",
    image: "",
  },
  {
    id: "venue2",
    type: "venue",
    title: "Развлекательный центр «Космик»",
    city: "Новосибирск",
    minAge: 5,
    maxAge: 14,
    priceLevel: "medium",
    tags: ["игровая комната", "семейный центр", "квест"],
    description:
      "Формат семейного центра: игровые зоны, боулинг, зона для проведения детских дней рождения.",
    image: "",
  },
  {
    id: "cake1",
    type: "cake",
    title: "Кондитерская с тортами в стиле игр",
    city: "Новосибирск",
    minAge: 0,
    maxAge: 16,
    priceLevel: "medium",
    tags: ["торт", "roblox", "майнкрафт", "фигурки"],
    description:
      "Тематические торты с фигурками героев из Roblox и Майнкрафт, индивидуальный дизайн.",
    image: "",
  },
  {
    id: "decor1",
    type: "decor",
    title: "Оформление шарами в игровой тематике",
    city: "Новосибирск",
    minAge: 0,
    maxAge: 16,
    priceLevel: "low",
    tags: ["шары", "оформление", "roblox", "майнкрафт"],
    description:
      "Гирлянды, фотозона и цифра с именем ребёнка. Подбор цветов под тему праздника.",
    image: "",
  },
  {
    id: "full1",
    type: "full_service",
    title: "Организаторы под ключ «Весёлый день»",
    city: "Новосибирск",
    minAge: 4,
    maxAge: 12,
    priceLevel: "high",
    tags: ["под ключ", "организация", "аниматор", "оформление", "торт"],
    description:
      "Полная организация детского праздника: программа, площадка, торт, декор и координация в день мероприятия.",
    image: "",
  },
];

/**
 * Простая оценка "уровня бюджета"
 * Можно будет усложнить, если захочешь.
 */
function detectBudgetLevel(budgetRaw) {
  const txt = (budgetRaw || "").toLowerCase();

  if (!txt) return "medium";

  if (txt.includes("миним") || txt.includes("до 10") || txt.includes("до 8")) {
    return "low";
  }
  if (txt.includes("до 15") || txt.includes("до 20") || txt.includes("средн")) {
    return "medium";
  }
  if (txt.includes("25") || txt.includes("30") || txt.includes("не важен")) {
    return "high";
  }
  return "medium";
}

/**
 * Матчинг исполнителей под запрос
 */
function matchVendors({ age, city, interests, mustHave, budget }) {
  const ageNum = parseInt(age, 10) || 0;
  const cityNorm = (city || "").toLowerCase();
  const interestsText = (interests || "").toLowerCase();
  const mustText = (mustHave || "").toLowerCase();
  const budgetLevel = detectBudgetLevel(budget);

  // чуть-чуть весов по типам
  const result = {
    animators: [],
    venues: [],
    cakes: [],
    decor: [],
    fullService: [],
  };

  vendors.forEach((v) => {
    // фильтр по городу
    if (v.city && cityNorm && !v.city.toLowerCase().includes(cityNorm)) {
      return;
    }

    // фильтр по возрасту
    if (ageNum && (v.minAge && ageNum < v.minAge || v.maxAge && ageNum > v.maxAge)) {
      return;
    }

    // грубый матч по интересам/теме
    const tagsText = (v.tags || []).join(" ").toLowerCase();

    let score = 0;

    if (interestsText) {
      if (interestsText.includes("роблокс") || interestsText.includes("roblox")) {
        if (tagsText.includes("roblox")) score += 3;
      }
      if (interestsText.includes("майнкрафт") || interestsText.includes("minecraft")) {
        if (tagsText.includes("майнкрафт")) score += 3;
      }
      if (interestsText.includes("диноз") || interestsText.includes("дино")) {
        if (tagsText.includes("динозавр") || tagsText.includes("дино")) score += 2;
      }
      if (interestsText.includes("робот") || interestsText.includes("техника")) {
        if (tagsText.includes("роботы")) score += 2;
      }
    }

    if (mustText) {
      if (mustText.includes("аниматор") && v.type === "animator") score += 2;
      if (mustText.includes("торт") && v.type === "cake") score += 2;
      if (mustText.includes("шар") && v.type === "decor") score += 2;
      if (mustText.includes("батут") && tagsText.includes("батуты")) score += 2;
    }

    // бюджетная грубая логика: если low, то режем high и наоборот
    if (budgetLevel === "low" && v.priceLevel === "high") {
      score -= 2;
    }
    if (budgetLevel === "high" && v.priceLevel === "low") {
      // можно наоборот чуть снижать приоритет
      score -= 1;
    }

    if (score <= 0) return;

    const shortVendor = {
      id: v.id,
      type: v.type,
      title: v.title,
      description: v.description,
      image: v.image,
      city: v.city,
      priceLevel: v.priceLevel,
      tags: v.tags,
      score,
    };

    if (v.type === "animator") result.animators.push(shortVendor);
    if (v.type === "venue") result.venues.push(shortVendor);
    if (v.type === "cake") result.cakes.push(shortVendor);
    if (v.type === "decor") result.decor.push(shortVendor);
    if (v.type === "full_service") result.fullService.push(shortVendor);
  });

  // немного сортировки и ограничений
  const sortByScore = (a, b) => b.score - a.score;

  result.animators.sort(sortByScore);
  result.venues.sort(sortByScore);
  result.cakes.sort(sortByScore);
  result.decor.sort(sortByScore);
  result.fullService.sort(sortByScore);

  result.animators = result.animators.slice(0, 3);
  result.venues = result.venues.slice(0, 3);
  result.cakes = result.cakes.slice(0, 3);
  result.decor = result.decor.slice(0, 3);
  result.fullService = result.fullService.slice(0, 3);

  return result;
}

/**
 * СИСТЕМНЫЙ ПРОМПТ — улучшенная версия
 */
const systemPrompt = `
Ты — сценарист детских праздников, эксперт по детской психологии и игровой педагогике. 
Ты работаешь в сервисе "PartyGen Kids" (Новосибирск), который подбирает идеальные сценарии детских праздников.

ТВОЯ РОЛЬ:
Создавать яркие, оригинальные, живые сценарии, которые:
- понятны родителям,
- увлекают детей,
- легко реализуются,
- выглядят как профессиональная разработка,
- дают ощущение заботы, креатива и "вау-эффекта".

ГЛАВНОЕ:
— НЕ указывай телефон клиента и НЕ вставляй контакты.  
— НЕ пиши "черновик".  
— НЕ добавляй "если нужно, могу помочь" (только рекомендации).  
— НЕ выдумывай цены и не указывай конкретные суммы.  
— НЕ используй шаблонный тон ChatGPT, пиши живо, эмоционально и по-человечески.

ОФОРМЛЕНИЕ СЦЕНАРИЯ:

1. **Тема и концепция праздника**  
   — название темы  
   — в чём уникальность  
   — как это выглядит для ребёнка  

2. **Формат и атмосфера**  
   — место (батутный центр, семейный центр, игровая комната и т.п.)  
   — количество детей  
   — атмосфера (динамично, уютно, приключенчески и т.д.)

3. **Сценарий на 2–3 часа**  
   — пиши блоками по времени  
   — делай сценарий живым, с эмоциями  
   — можно добавлять игровые находки и “механики"  

4. **Реалистичные места в Новосибирске (без адресов)**  
   Можно использовать только такие площадки:  
   — “Джамп Хаус”,  
   — “Космик”,  
   — “Парк чудес Галилео”,  
   — “Мегалэнд”,  
   — “Игровая галактика”,  
   — “Аэродром”.  

5. **Бюджет (ПРОПОРЦИИ, без денег)**  
   — доли в процентах: аниматор, торт, декор, площадка, фотограф, мастер-класс  

6. **Рекомендации по возрасту**  
   — советы про динамику, безопасность, вовлечённость детей  

7. **Варианты названия праздника**  
   — 5–7 штук  

СТИЛЬ:  
Лёгкий, дружелюбный, профессиональный, живой, эмоциональный.  
Пиши так, будто делаешь праздник “под ключ” — но не продавай себя, только идею.

ЗАПРЕЩЕНО:  
— Вставлять телефон или контакт.  
— Давать точные цены.  
— Писать "черновик".  
— Делать сухие канцелярские списки.  

ТВОЯ ЗАДАЧА — создать сценарий, который хочется реализовать.
`;

// Маршрут для генерации праздника + подбора исполнителей
app.post("/party", async (req, res) => {
  try {
    const {
      name,
      age,
      gender,
      guests,
      place,
      dateStr,
      city,
      mustHave,
      interests,
      budget,
      extras,
      contact,
    } = req.body || {};

    const safe = (v) => (v || "").toString().slice(0, 500);

    const userPrompt = `
Данные родителя:

- Имя ребёнка: ${safe(name)}
- Возраст: ${safe(age)}
- Пол: ${safe(gender)}
- Количество детей: ${safe(guests)}
- Место праздника: ${safe(place)}
- Город: ${safe(city)}
- Ориентировочная дата: ${safe(dateStr)}
- Что обязательно должно быть: ${safe(mustHave)}
- Интересы ребёнка: ${safe(interests)}
- Бюджет (описание): ${safe(budget)}
- Важно учесть: ${safe(extras)}

Сгенерируй, пожалуйста, предложение праздника по инструкции системного сообщения.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const text = completion.choices?.[0]?.message?.content || "";

    const vendorsMatched = matchVendors({
      age,
      city,
      interests,
      mustHave,
      budget,
    });

    res.json({
      ok: true,
      title: `Идея праздника для ${name || "вашего ребёнка"} (${age} лет)`,
      text,
      vendors: vendorsMatched,
    });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({
      ok: false,
      error: "AI_ERROR",
      message: "Ошибка при генерации сценария",
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("PartyGen AI server listening on port " + PORT);
});
