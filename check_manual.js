import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  // Go to the manual page
  const response = await page.goto('http://127.0.0.1:3000/manual', { waitUntil: 'networkidle0' });
  console.log('Status:', response.status());
  
  // Wait for Nuxt to finish rendering
  await new Promise(r => setTimeout(r, 2000));
  
  const content = await page.content();
  
  // Check if it says Document not found or Page not found
  if (content.includes('Document not found')) {
    console.log('Error: Document not found (ContentDoc failed)');
  } else if (content.includes('Page not found')) {
    console.log('Error: Page not found (Vue Router failed)');
  } else {
    console.log('Success! Page rendered something else.');
    // Print the main text
    const text = await page.evaluate(() => document.body.innerText);
    console.log('Body Text:', text.substring(0, 500));
  }
  
  await browser.close();
})();
