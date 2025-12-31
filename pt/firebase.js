// Firebase configuration and initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA95Q7b9fRRU3wFXcVrycpixgsok7Rmw10",
  authDomain: "pt-tracker-cloud.firebaseapp.com",
  projectId: "pt-tracker-cloud",
  storageBucket: "pt-tracker-cloud.firebasestorage.app",
  messagingSenderId: "32341171774",
  appId: "1:32341171774:web:454436291cb4c4e49dfb6f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

signInAnonymously(auth).catch((error) => {
  console.error("Anonymous auth failed:", error);
});

export { db };
