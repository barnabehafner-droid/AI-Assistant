import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBRxHj9UiEy3fQ2Y1918UCC6xFd1YZ9Ukk",
  authDomain: "ai-assistant-22464.firebaseapp.com",
  projectId: "ai-assistant-22464",
  storageBucket: "ai-assistant-22464.firebasestorage.app",
  messagingSenderId: "202618506057",
  appId: "1:202618506057:web:fc7e5277e3c49586582898",
  measurementId: "G-EV4CM12BN3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
