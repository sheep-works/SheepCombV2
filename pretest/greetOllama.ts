// ollamaにモデル一覧を尋ねるスクリプト

async function getOllamaModels() {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('--- Ollama Available Models ---');
    if (data.models && data.models.length > 0) {
      data.models.forEach((model: any) => {
        console.log(`- ${model.name}`);
      });
    } else {
      console.log('No models found.');
    }
  } catch (error) {
    console.error('Failed to fetch models from Ollama:', error);
  }
}

getOllamaModels();
