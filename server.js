// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// базовая настройка
app.use(cors());
app.use(express.json());

// фиктивная загрузка "исполнителей", чтобы сохранить твой лог
const vendors = {
  animators: [],
  cakes: [],
  decor: [],
  venues: [],
  fullService: [],
};

console.log("Vendors loaded:", Object.keys(vendors));

// базовый пинг
app.get("/", (req, res) => {
  res.send("HOWWOW / PartyGen backend is running");
});

// основной эндпоинт генерации идеи праздника
app.post("/party", async (req, res) => {
  try {
    const {
      childName,
      age,
      gender,
      city,
      date,
      place,
      guests,
      interests,
      budget,
      extras,
      mustHave,
    } = req.body || {};

    // Соберём payload для удобства и JSON.stringify
    const payload = {
      childName,
      age,
      gender,
      city,
      date,
      place,
      guests,
      interests,
      budget,
      extras,
      mustHave,
    };

    // ===== НОВЫЙ "СУПЕР"-ПРОМПТ С HTML-СТРУКТУРОЙ =====
    const basePrompt = `
Ты — профессиональный организатор детских праздников в Новосибирске.
Твоя задача — создать персональную идею праздника и краткий структурированный сценарий для родителей на основе входных данных.

ПОЛУЧАЕШЬ НА ВХОД (пример структуры):

childName: string
age: number
city: string
date: string
guests: string
interests: string
budget: string
extras: string
gender: string
mustHave: string   (например: "аниматор, площадка")
allowedCategories: ["animator"] или ["venue"] или ["animator","venue"]
vendors: [
  {
    slug: "roblox-animator",
    category: "animator",
    title: "Аниматор в стиле Роблокс",
    theme: "Roblox, квест, активные игры",
    ageFrom: 5,
    ageTo: 12,
    priceFrom: 6000
  },
  ...
]

ТВОИ ЗАДАЧИ
1. Сформировать персональную идею праздника

Опираться на:
– возраст,
– интересы,
– формат (дом/центр/улица, если указан),
– желаемые элементы (аниматор, площадка — если разрешено).

Идея должна быть короткой, цепляющей, понятной родителям.

2. Составить ЧЁТКИЙ, СТРУКТУРИРОВАННЫЙ СЦЕНАРИЙ

Сценарий должен быть строго в HTML, с чёткими заголовками:

<h2>Главная идея</h2>

<h2>Краткое описание (TL;DR)</h2>

<h2>Сценарий по времени</h2>
<ul>
  <li>00:00–00:10 — ...</li>
  <li>00:10–00:25 — ...</li>
</ul>

<h2>Игры и активности</h2>

<h2>Что подготовить заранее</h2>

<h2>Ориентировочный бюджет</h2>


Требования к стилю:
– короткие абзацы,
– ясный, дружелюбный язык для родителей,
– никаких технических деталей,
– никаких ссылок,
– никаких Markdown.

3. Рекомендация исполнителей (vendor selection)

Ты получаешь список доступных исполнителей (аниматоры и площадки).
Твоя задача — выбрать от 1 до 3 исполнителей и вернуть их slug в массиве.

Правила выбора:

НЕ придумывать новых исполнителей.
Использовать только тех, что в списке vendors.

Выбирать только категории, указанные в allowedCategories:

Если allowedCategories = ["venue"], НЕЛЬЗЯ рекомендовать аниматора.
Сценарий НЕ должен содержать ведущего, аниматора, конкурсы с аниматором.

Если ["animator"], нельзя рекомендовать площадки.
Сценарий должен предполагать проведение дома/в лофте/в любом месте, но без упора на зал.

Если и то, и другое, можно выбирать любые.

Учитывать возрастные рамки (ageFrom ≤ возраст ≤ ageTo).

Учитывать тему и интересы ребёнка.

Приблизительно учитывать бюджет (priceFrom).

Рекомендовать только тех, кто реально подходит.

Формат результата:

recommendedVendors: ["roblox-animator", "Pryatki"]

4. Формат ответа (ОБЯЗАТЕЛЬНО)

Ответ должен быть в формате JSON:

{
  "title": "Название идеи праздника",
  "text": "<h2>Главная идея</h2> ... HTML-сценарий ...",
  "recommendedVendors": ["slug1", "slug2"]
}


Где:
title — короткое название праздника (например: «Космическая миссия в стиле Roblox»).
text — полностью HTML.
recommendedVendors — массив slug исполнителей.

5. Жёсткие ограничения

Ты НЕ имеешь права:

– упоминать исполнителей, которых нет в базе.
– рекомендовать категории, которые не указаны в allowedCategories.
– использовать Markdown.
– генерировать HTML вне тега <h2> и обычных <p> и <ul><li>.
– писать слишком длинные тексты — ценится краткость.

КРАТКОЕ РЕЗЮМЕ ДЛЯ МОДЕЛИ

Создай идею праздника.

Составь компактный сценарий в HTML с чёткой структурой.

Выбери подходящих исполнителей из vendors (1–3 шт.).

Соблюдай ограничения allowedCategories.

Верни JSON строго указанного формата.
`;

    const fullPrompt = `${basePrompt}\n\n${userBlock}`;

    // вызов OpenAI
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: fullPrompt,
      // при желании позже сюда добавим max_output_tokens и temperature
    });

    const aiText =
      response.output &&
      response.output[0] &&
      response.output[0].content &&
      response.output[0].content[0] &&
      response.output[0].content[0].text
        ? response.output[0].content[0].text
        : "Не удалось сформировать сценарий, но мы свяжемся с вами и доработаем праздник вручную.";

    const safeName = childName || "вашего ребёнка";
    const safeAge = age ? `${age} лет` : "";

    const title = `Идея праздника для ${safeName}`;
    const tag = safeAge
      ? `Черновик по вашим ответам · ${safeName}, ${safeAge}`
      : "Черновик по вашим ответам";

    res.json({
      ok: true,
      title,
      tag,
      text: aiText, // это уже HTML, фронт вставляет через innerHTML
    });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({
      ok: false,
      error: "AI_ERROR",
      message:
        "Ошибка при генерации сценария. Заявка всё равно может быть обработана вручную.",
    });
  }
});

app.listen(port, () => {
  console.log(`PartyGen AI server listening on port ${port}`);
});
