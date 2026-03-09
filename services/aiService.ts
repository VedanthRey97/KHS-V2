
import { GoogleGenAI, Type } from "@google/genai";
import { LearningContext } from "../types";

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1500): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const isUnavailable = error?.status === 503 || 
                            error?.code === 503 || 
                            error?.message?.includes('503') || 
                            error?.message?.includes('UNAVAILABLE');
      
      if (isUnavailable && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.warn(`Gemini service unavailable (503). Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Maximum retries reached for AI service");
}

export async function detectFocalPoint(
  base64Image: string, 
  subject: string = 'smart',
  learningContext?: LearningContext
): Promise<{ x: number, y: number, scale: number }> {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let subjectPrompt = "Analyze this image and identify the primary subject's focal point.";
    if (subject !== 'smart') {
      subjectPrompt = `Analyze this image and specifically identify the focal point for the following item: ${subject}.`;
    }

    let learningPrompt = "";
    if (learningContext) {
      if (learningContext.recentManualCrops && learningContext.recentManualCrops.length > 0) {
        const examples = learningContext.recentManualCrops.map((ex, i) => {
          const relX = (ex.crop.x + ex.crop.width / 2) / ex.imageWidth;
          const relY = (ex.crop.y + ex.crop.height / 2) / ex.imageHeight;
          const relScale = Math.max(ex.crop.width / ex.imageWidth, ex.crop.height / ex.imageHeight);
          return `Example ${i + 1}: Aspect Ratio ${ex.aspectRatio}, Focal Point (${relX.toFixed(2)}, ${relY.toFixed(2)}), Scale ${relScale.toFixed(2)}`;
        }).join("\n");
        learningPrompt = `
          USER PREFERENCE EXAMPLES (Mimic this style):
          The user has manually adjusted crops as follows. Analyze these to understand their preferred framing style, subject placement, and margin tightness:
          ${examples}
        `;
      } else if (learningContext.recentOffsets.length > 0) {
        const avgX = learningContext.recentOffsets.reduce((acc, o) => acc + o.dx, 0) / learningContext.recentOffsets.length;
        const avgY = learningContext.recentOffsets.reduce((acc, o) => acc + o.dy, 0) / learningContext.recentOffsets.length;
        learningPrompt = `Note: User has recently preferred offsets of around (${avgX.toFixed(2)}, ${avgY.toFixed(2)}) from the geometric center. Consider this style if it aligns with product integrity.`;
      }
    }

    const priorityRules = `
      STRICT FRAMING RULES:
      1. Primary Subject Focus: The product (carpet, cushion, furniture, or accessory) MUST be the "hero" of the image. It should be clearly bounded and prominent.
      2. Minimize Background: Strictly minimize empty floor, wall, or ceiling space. Mimic the tight margins seen in the user preference examples.
      3. Face Exclusion (CRITICAL): If a human model is present in the photo, you MUST calculate the crop to EXCLUDE the upper part of their face (eyes, forehead, and bridge of the nose). You may show the person only from BELOW THE NOSE (mouth, chin, neck, and body) as they interact with the product. The focus must remain on the product.
      4. Product Integrity: If a carpet or rug is present, ensure its significant features are not cut off awkwardly.
      5. Edge Safety: Ensure the subject is comfortably within the frame while maintaining tight margins.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image.split(',')[1], mimeType: base64Image.split(';')[0].split(':')[1] || 'image/jpeg' } },
          { text: `${subjectPrompt}\n${priorityRules}\n${learningPrompt}\nReturn the focal point as normalized coordinates (x, y) and a 'scale' factor (0.1 to 1.0, where 1.0 means full frame and 0.5 means the subject occupies 50% of the crop) in JSON format. Ensure the output is valid JSON.` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            x: { type: Type.NUMBER, description: "X coordinate (0.0 to 1.0)" },
            y: { type: Type.NUMBER, description: "Y coordinate (0.0 to 1.0)" },
            scale: { type: Type.NUMBER, description: "Suggested scale factor to keep subject edges visible with floor buffer" }
          },
          required: ["x", "y", "scale"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return { 
      x: result.x ?? 0.5, 
      y: result.y ?? 0.5, 
      scale: result.scale ?? 0.8 
    };
  }).catch(error => {
    console.error("AI Analysis failed permanently after retries:", error);
    return { x: 0.5, y: 0.5, scale: 0.8 };
  });
}
