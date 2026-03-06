import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCEB23YlxPVyjPeGm68_vo1CYbaXQdnRYA",
  authDomain: "smart-medical-box-1dc59.firebaseapp.com",
  databaseURL: "https://smart-medical-box-1dc59-default-rtdb.firebaseio.com",
  projectId: "smart-medical-box-1dc59",
  storageBucket: "smart-medical-box-1dc59.firebasestorage.app",
  messagingSenderId: "590096675895",
  appId: "1:590096675895:web:6c2596b728a8fbe50a3bb2"
};
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const rtdb = getDatabase(app);