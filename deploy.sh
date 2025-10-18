#!/bin/bash
git init
git remote add origin https://github.com/barnabehafner-droid/AI-Assistant.git
git add .
git commit -m "Initial commit"
git branch -M main
npm install gh-pages --save-dev
npm audit fix --force
git push --force origin main
API_KEY="AIzaSyCqtyH-klbY4lKkK0_mdNhmm_DLsa5HhdI" VITE_GOOGLE_CLIENT_ID="110328616965-9l3mtbekgh58sfo87p31cm4mrq1lo3q3.apps.googleusercontent.com" npm run deploy
