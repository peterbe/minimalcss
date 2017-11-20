#!/usr/bin/env node

'use strict'


const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.goto('https://www.peterbe.com');
  await page.screenshot({path: 'example.png'});
  console.log('Created example.png');
  browser.close();
})();
