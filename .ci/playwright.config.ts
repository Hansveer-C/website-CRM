import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests/e2e',testMatch:'accepted-ci.spec.ts',workers:1,retries:0,timeout:90000,reporter:'list',outputDir:'/tmp/pr65-browser-output',use:{baseURL:'http://127.0.0.1:4218',browserName:'chromium',ignoreHTTPSErrors:true,trace:'off',video:'off',screenshot:'off'}});
