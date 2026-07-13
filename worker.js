const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "xiaobai-english-v3" });
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: "服务器没有设置 OPENAI_API_KEY" }, 500);
    }

    if (url.pathname === "/speech" && request.method === "POST") {
      try {
        const { text, voice = "marin", speed = 0.92 } = await request.json();
        if (!text || typeof text !== "string") return json({ error: "缺少英文句子" }, 400);
        if (text.length > 1000) return json({ error: "句子太长" }, 400);

        const response = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini-tts",
            voice,
            input: text,
            speed: Math.min(1.2, Math.max(0.6, Number(speed) || 0.92)),
            response_format: "mp3",
            instructions:
              "Speak as a natural native American English speaker. Use a subtle New York City working-professional cadence, clear pronunciation, warm tone, and natural connected speech. Do not exaggerate the accent. This is for a beginner learning practical worksite English.",
          }),
        });

        if (!response.ok) return json({ error: await response.text() }, response.status);

        return new Response(response.body, {
          status: 200,
          headers: {
            ...cors,
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=86400",
          },
        });
      } catch (error) {
        return json({ error: String(error) }, 500);
      }
    }

    if (url.pathname === "/translate" && request.method === "POST") {
      try {
        const { text, direction } = await request.json();
        if (!text || typeof text !== "string") return json({ error: "缺少翻译内容" }, 400);

        const instructions = direction === "zh-en"
          ? "Translate the Chinese into natural, concise American English suitable for construction, glass installation, metal installation, payment, driving, or daily communication in New York. Return only the English translation."
          : "Translate the English into clear Simplified Chinese. Return only the Chinese translation.";

        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-5-mini",
            instructions,
            input: text,
            max_output_tokens: 200,
          }),
        });

        if (!response.ok) return json({ error: await response.text() }, response.status);

        const data = await response.json();
        const translation =
          data.output_text ||
          data.output?.flatMap(x => x.content || []).find(x => x.type === "output_text")?.text ||
          "";

        return json({ translation: translation.trim() });
      } catch (error) {
        return json({ error: String(error) }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  },
};