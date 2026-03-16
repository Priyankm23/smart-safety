import Groq from "groq-sdk";
import { GROQ_API_KEY, GROQ_MODEL } from "../config";

export type SafetyRecommendation = {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  category: string;
}

const CATEGORY_CONFIG: Record<string, { icon: string; iconColor: string; iconBg: string }> = {
  Weather: { icon: 'weather-partly-cloudy', iconColor: '#5B9BD5', iconBg: '#D4EBFC' },
  Transportation: { icon: 'bus', iconColor: '#3D9A6A', iconBg: '#D1F0E4' },
  'Night Travel': { icon: 'weather-night', iconColor: '#7A5BA5', iconBg: '#E8DDF5' },
  Belongings: { icon: 'wallet', iconColor: '#C98E3A', iconBg: '#FCECD4' },
  Emergency: { icon: 'phone-alert', iconColor: '#D66A6A', iconBg: '#FADED9' },
};

const DEFAULT_TIMEOUT = 20000;

async function timeoutPromise<T>(p: Promise<T>, ms: number): Promise<T> {
  let id: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => {
    id = setTimeout(() => rej(new Error('timeout')), ms);
  });
  const res = await Promise.race([p, timeout]);
  clearTimeout(id!);
  return res as T;
}

function getStaticTip(category: string): SafetyRecommendation {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Emergency;
  const staticTips: Record<string, { title: string; description: string }> = {
    Weather: { title: 'Weather Advisory', description: 'Check local weather conditions before heading out. Carry appropriate gear for sudden changes.' },
    Transportation: { title: 'Transport Safety', description: 'Use verified transport services. Share your ride details with trusted contacts.' },
    'Night Travel': { title: 'Night Safety', description: 'Stay on well-lit main paths after sunset. Avoid isolated areas during late hours.' },
    Belongings: { title: 'Protect Valuables', description: 'Keep your belongings secure in crowded areas. Use anti-theft bags when possible.' },
    Emergency: { title: 'Emergency Ready', description: 'Save local emergency numbers. Keep your phone charged and location services on.' },
  };
  const tip = staticTips[category] || staticTips.Emergency;
  return { ...config, ...tip, category };
}

export async function fetchCategoryRecommendation(category: string): Promise<SafetyRecommendation> {
  if (!GROQ_API_KEY) {
    console.warn('Groq: API key not configured, using static recommendation');
    return getStaticTip(category);
  }

  try {
    const groq = new Groq({ 
      apiKey: GROQ_API_KEY,
      dangerouslyAllowBrowser: true,
    });

    // Use a non-reasoning model for faster, more concise responses
    const model = GROQ_MODEL === 'llama-3.3-70b-versatile' ? 'llama-3.1-8b-instant' : GROQ_MODEL;

    const result = await timeoutPromise(
      groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: `Safety tip for "${category}" in India. JSON only: {"title":"max 5 words","description":"max 100 chars"}`,
          },
        ],
        model: model,
        temperature: 0.7,
      }),
      DEFAULT_TIMEOUT
    );
    
    // Get content from either content or reasoning field
    let text = result.choices[0]?.message?.content?.trim() || "";
    const reasoning = (result.choices[0]?.message as any)?.reasoning?.trim() || "";
    
    // If content is empty but reasoning exists, try to extract from reasoning
    if (!text && reasoning) {
      text = reasoning;
    }
    
    if (!text) {
      console.warn(`Groq: Empty response for ${category}, using static tip`);
      return getStaticTip(category);
    }

    // Extract JSON from response
    let jsonText = text;
    
    // Remove markdown code blocks
    if (text.includes('```')) {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonText = match[1].trim();
      }
    }
    
    // Find JSON object in text
    const jsonMatch = jsonText.match(/\{[^{}]*"title"[^{}]*"description"[^{}]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonText);
    
    if (parsed.title && parsed.description) {
      const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Emergency;
      return {
        ...config,
        title: String(parsed.title).slice(0, 50),
        description: String(parsed.description).slice(0, 120),
        category,
      };
    } else {
      console.warn(`Groq: Invalid JSON structure for ${category}`);
      return getStaticTip(category);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Groq: Failed to fetch ${category} recommendation:`, errorMessage);
    return getStaticTip(category);
  }
}

export async function fetchAllSafetyRecommendations(): Promise<SafetyRecommendation[]> {
  const categories = ['Weather', 'Transportation', 'Night Travel', 'Belongings', 'Emergency'];
  
  // Fetch recommendations sequentially with delay to avoid rate limits
  const recommendations: SafetyRecommendation[] = [];
  
  for (const category of categories) {
    try {
      const rec = await fetchCategoryRecommendation(category);
      recommendations.push(rec);
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (err) {
      console.error(`Error fetching ${category}:`, err);
      recommendations.push(getStaticTip(category));
    }
  }
  
  return recommendations;
}
