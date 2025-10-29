import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge', // Use edge runtime for performance and streaming
};

const getPrompt = ({ institute, department, keyword }: { institute: string; department: string; keyword: string }) => `
    You are a smart outreach automation assistant. Your task is to fetch details of professors at selected IITs/NITs and stream them as you find them.

    User's Search Criteria:
    - Institute: ${institute || 'Any relevant IIT/NIT'}
    - Department/Branch: ${department || 'Any relevant department'}
    - Research Keyword/Topic: ${keyword || 'Not specified'}

    Rules:
    - Find professors matching the user's criteria.
    - If a keyword is provided, filter professors whose research aligns with the keyword.
    - For each professor, find all the required details.
    - CRITICAL: If you cannot find a valid, working webpage for the professor or their department, you MUST return "Link not working" for the "Institute Website" field. Do not invent links.
    - CRITICAL: Return each professor found as a separate, complete JSON object on a new line. Do not wrap them in a JSON array. Each line must be a valid JSON object.
    - If no professors are found, return nothing.

    Example of a single line of output for one professor:
    {"Name": "Dr. Example Name", "Designation": "Professor, Computer Science", "Institute": "IIT Example", "Email": "prof@example.com", "LinkedIn": "https://linkedin.com/in/prof", "Research Interests": "AI, ML", "Internship/Outreach": null, "Institute Website": "https://example.edu/prof", "Summary": "A summary of work."}
  `;

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { institute, department, keyword } = await req.json();
    
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key is not configured on the server.' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = getPrompt({ institute, department, keyword });

    const responseStream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: prompt,
    });
    
    // Create a ReadableStream to pipe the Gemini response to the client
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of responseStream) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(new TextEncoder().encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    console.error("Error in API route:", error);
    return new Response(JSON.stringify({ error: 'Failed to fetch from Gemini API.' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
