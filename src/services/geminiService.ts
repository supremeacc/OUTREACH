import type { SearchParams, Professor } from "../types";

export const fetchProfessorDetailsStream = async (
  params: SearchParams,
  onProfessorFound: (professor: Professor) => void,
  onError: (error: Error) => void
): Promise<void> => {
  if (!params.institute && !params.department && !params.keyword) {
    throw new Error("Please provide an institute, department, or keyword to start the search.");
  }

  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `Request failed with status ${response.status}` }));
      throw new Error(errorData.error || `An unknown error occurred.`);
    }

    if (!response.body) {
      throw new Error("Response body is empty.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processStream = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const professor = JSON.parse(line.trim());
              if (professor.Name && professor.Designation) {
                onProfessorFound(professor);
              }
            } catch (e) {
              console.warn("Could not parse a line of streamed JSON:", line, e);
            }
          }
        }
      }
    };
    
    await processStream();
    
    // Process any remaining data in the buffer
    if (buffer.trim()) {
        try {
            const professor = JSON.parse(buffer.trim());
            if (professor.Name && professor.Designation) {
                onProfessorFound(professor);
            }
        } catch (e) {
            console.warn("Could not parse the final buffer of streamed JSON:", buffer, e);
        }
    }

  } catch (error: any) {
    console.error("Error fetching data from backend API:", error);
    onError(new Error(error.message || "Failed to fetch professor details. Please check the network and try again."));
  }
};