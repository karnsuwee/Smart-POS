import { config } from '../config.js';

export async function getStockInsight({ question, dashboard, orderCount, ordersCsv }) {
  if (!config.geminiApiKey) {
    return {
      provider: 'demo-rule-based',
      insight: makeRuleBasedInsight(dashboard)
    };
  }

  const finalQuestion = question || 'ช่วยสรุปเมนูขายดีและแนะนำการสต็อกของร้านจากข้อมูลทั้งหมด';
  const prompt = [
    'You are a concise inventory advisor for a small Thai food or drink shop.',
    'Analyze sales data and recommend stock planning to reduce waste and lost sales.',
    'Answer in Thai with clear bullet points.',
    'If user asks a time range (e.g. last 2 weeks), focus on that range first.',
    `User question: ${finalQuestion}`,
    `Total orders in database: ${Number(orderCount || 0)}`,
    `Orders included in attached CSV: ${Math.max(ordersCsv.split('\n').length - 1, 0)} rows`,
    'Use the attached CSV file as the source of truth for your analysis.'
  ].join('\n\n');

  const uploadedFile = await uploadCsvToGemini(ordersCsv);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`;
    const aiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.geminiApiKey
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            {
              file_data: {
                mime_type: 'text/csv',
                file_uri: uploadedFile.uri
              }
            }
          ]
        }]
      })
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      throw new Error(detail);
    }

    const data = await aiResponse.json();
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text).join('\n').trim();
    return {
      provider: 'gemini',
      insight: text || makeRuleBasedInsight(dashboard)
    };
  } finally {
    await deleteGeminiFile(uploadedFile.name).catch(() => {});
  }
}

async function uploadCsvToGemini(csvText) {
  const buffer = new TextEncoder().encode(csvText);
  const metadataResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${config.geminiApiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(buffer.byteLength),
      'X-Goog-Upload-Header-Content-Type': 'text/csv',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      file: {
        display_name: `sales-data-${Date.now()}.csv`
      }
    })
  });

  if (!metadataResponse.ok) {
    throw new Error(await metadataResponse.text());
  }

  const uploadUrl = metadataResponse.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('Gemini file upload did not return an upload URL');
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(buffer.byteLength),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize'
    },
    body: buffer
  });

  if (!uploadResponse.ok) {
    throw new Error(await uploadResponse.text());
  }

  const data = await uploadResponse.json();
  const file = data.file || data;
  if (!file?.uri || !file?.name) {
    throw new Error('Gemini file upload response is missing file metadata');
  }
  return file;
}

async function deleteGeminiFile(fileName) {
  if (!fileName) return;
  await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${config.geminiApiKey}`, {
    method: 'DELETE'
  });
}

export function makeRuleBasedInsight(dashboard) {
  if (!dashboard.orderCount) {
    return 'ยังไม่มีข้อมูลออเดอร์เพียงพอสำหรับวิเคราะห์สต็อก ลองขายผ่านระบบสัก 5-10 ออเดอร์ แล้วกลับมากดวิเคราะห์อีกครั้ง';
  }

  const bestMenu = dashboard.topMenus[0];
  const bestHour = [...dashboard.hourlySales].sort((a, b) => b.value - a.value)[0];
  const bestDay = [...dashboard.dailySales].sort((a, b) => b.value - a.value)[0];

  return [
    `เมนูที่ควรเตรียมวัตถุดิบมากที่สุดคือ ${bestMenu?.name || '-'} เพราะขายได้ ${bestMenu?.qty || 0} หน่วย`,
    `ช่วงเวลาที่ขายดีที่สุดคือ ${bestHour?.label || '-'} ควรเตรียมของก่อนช่วงนี้อย่างน้อย 30-60 นาที`,
    `วันที่ยอดขายเด่นคือ ${bestDay?.label || '-'} ควรเพิ่มสต็อกเมนูขายดีประมาณ 15-25% จากวันปกติ`,
    'เมนูที่ไม่ติดอันดับขายดีควรเตรียมแบบพอดีรอบ เพื่อช่วยลดของเหลือและต้นทุนวัตถุดิบ'
  ].join('\n');
}
