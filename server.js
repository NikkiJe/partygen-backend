// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

// Инициализация клиента OpenAI (ключ берётся из .env)
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Маршрут для генерации праздника
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

    // Безопасный обрезатель строк
    const safe = (v) => (v || "").toString().slice(0, 500);

    // Системное описание задачи для ИИ
    const systemPrompt = `
Ты помогаешь сервису, который подбирает детские праздники в Новосибирске.
На основе данных о ребёнке и пожеланий родителей нужно:

1. Придумать тему и общий концепт праздника.
2. Кратко описать формат (где, сколько детей, какая атмосфера).
3. Составить примерный сценарий на 2–3 часа с блоками по времени.
4. Разбить бюджет по блокам (приоритеты, без конкретных цен).
5. Дать рекомендации с учётом возраста и интересов ребёнка.
6. Предложить 3–5 вариантов названия праздника.

Пиши по-русски, структурировано.
`;

    // Данные родителя (вставляются в промпт)
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
- Бюджет: ${safe(budget)}
- Важно учесть: ${safe(extras)}
- Контакт: ${safe(contact)}

Сгенерируй, пожалуйста, предложение праздника по инструкции системного сообщения.
`;

    // Запрос к OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const text = completion.choices?.[0]?.message?.content || "";

    res.json({
      ok: true,
      title: `Идея праздника для ${name || "вашего ребёнка"} (${age} лет)`,
      text,
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

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("PartyGen AI server listening on port " + PORT);
});
