// LM Studioにモデル一覧を尋ねるスクリプト

async function getLmStudioModels() {
  try {
    const response = await fetch('http://127.0.0.1:1234/v1/models');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('--- LM Studio Available Models ---');
    if (data.data && data.data.length > 0) {
      data.data.forEach((model: any) => {
        console.log(`- ${model.id}`);
      });
    } else {
      console.log('No models found.');
    }
  } catch (error) {
    console.error('Failed to fetch models from LM Studio:', error);
  }
}

getLmStudioModels();
